// Battle engine: CTB turn order, damage resolution, gauges, statuses, enemy AI.
// UI-agnostic — all presentation flows through opts.onEvent. Data stays in js/data.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});
  const F = WS.F;

  const GAUGE_MAX = 100;

  let nextUid = 1;

  function makePartyUnit(def, level) {
    const stats = {};
    for (const k of Object.keys(def.base)) stats[k] = F.statAt(def.base[k], def.growth[k], level);
    return baseUnit({
      def, level, stats, side: 'party',
      maxHp: F.maxHp(stats.VIT, level), maxMp: F.maxMp(stats.FOC, level),
      gauge: def.gauge ? { type: def.gauge.type, label: def.gauge.label, value: def.gauge.start || 0 } : null,
    });
  }

  function makeEnemyUnit(def) {
    return baseUnit({
      def, level: 0, stats: { ...def.stats }, side: 'enemy',
      maxHp: def.hp, maxMp: 999,
      gauge: null,
    });
  }

  function baseUnit(o) {
    return {
      uid: 'u' + (nextUid++),
      defId: o.def.id, name: o.def.name, def: o.def,
      side: o.side, level: o.level, stats: o.stats,
      maxHp: o.maxHp, hp: o.maxHp, maxMp: o.maxMp, mp: o.maxMp,
      weaponAtk: o.def.weaponAtk, arteBonus: o.def.arteBonus,
      element: o.def.element || null, attuned: null,
      gauge: o.gauge, shield: 0,
      statuses: [], nextTurn: 0, turnCount: 0, cooldowns: {},
      storedTickMult: 1, pendingTickMult: null,
      ampBoost: 1, aspectIndex: 0, lastSealTurn: -99,
    };
  }

  class Battle {
    constructor(battleDef, opts = {}) {
      this.onEvent = opts.onEvent || (() => {});
      this.state = 'active';
      this.current = null;
      this.totems = { party: null, enemy: null };
      this.comboCooldowns = {};

      const roster = battleDef.party || WS.DEFAULT_PARTY;
      this.party = roster.map((id) =>
        makePartyUnit(WS.CHARACTERS.find((c) => c.id === id), battleDef.partyLevel));
      this.enemies = battleDef.enemies.map((id) => makeEnemyUnit(WS.ENEMIES[id]));
      // disambiguate duplicate enemies ("Construct A", "Construct B")
      for (const u of this.enemies) {
        const twins = this.enemies.filter((e) => e.defId === u.defId);
        if (twins.length > 1) twins.forEach((e, i) => { e.name = `${e.def.name} ${'ABCD'[i]}`; });
      }
      this.units = [...this.party, ...this.enemies];

      // initialize each actor's counter to their first action cost
      for (const u of this.units) u.nextTurn = F.tickCost(this.stat(u, 'AGI'), 1.0);
    }

    // ---------- events ----------
    emit(type, data) { this.onEvent(Object.assign({ type }, data)); }
    log(text, cls) { this.emit('log', { text, cls: cls || '' }); }

    // ---------- lookups ----------
    unit(uid) { return this.units.find((u) => u.uid === uid); }
    alive(u) { return u.hp > 0; }
    living(side) { return this.units.filter((u) => u.side === side && u.hp > 0); }
    foesOf(u) { return this.living(u.side === 'party' ? 'enemy' : 'party'); }
    alliesOf(u) { return this.living(u.side); }
    hasStatus(u, id) { return u.statuses.some((s) => s.id === id); }
    getStatus(u, id) { return u.statuses.find((s) => s.id === id); }

    // effective stat with buff/debuff/bloodrun modifiers (additive %)
    stat(u, key) {
      let mod = 0;
      for (const s of u.statuses) {
        if (s.data && s.data.stats && s.data.stats[key]) mod += s.data.stats[key];
        if (s.id === 'bloodrun' && (key === 'PWR' || key === 'AGI')) mod += 0.3;
      }
      return Math.max(1, u.stats[key] * (1 + mod));
    }

    elementOf(u) { return u.attuned || u.element; }

    // support (heals/buffs/gauge gifts/shields) can't reach a unit in Bloodrun
    supportable(u) { return !this.hasStatus(u, 'bloodrun'); }

    // ---------- turn flow ----------
    beginTurn() {
      const alive = this.units.filter((u) => u.hp > 0);
      alive.sort((a, b) => a.nextTurn - b.nextTurn || this.stat(b, 'AGI') - this.stat(a, 'AGI'));
      const actor = alive[0];
      this.current = actor;
      actor.turnCount++;
      this.emit('turnStart', { uid: actor.uid });
      this.tickCooldowns(actor);

      const totem = this.totems[actor.side];
      if (totem && this.supportable(actor)) {
        this.heal(actor, Math.round(actor.maxHp * totem.pct), 'Rootbind');
      }

      if (actor.gauge) {
        const g = actor.gauge.type;
        if (g === 'rage') this.addGauge(actor, 3, 'passive');
        // Defiance is adversity-fed only — no passive fill
        else if (g !== 'defiance') this.addGauge(actor, this.stat(actor, 'SPR') / 10, 'passive');
      }

      // Defiance: +2 per enemy action while the party stands outnumbered
      if (actor.side === 'enemy' && this.living('enemy').length > this.living('party').length) {
        for (const u of this.living('party')) {
          if (u.gauge && u.gauge.type === 'defiance') this.addGauge(u, 2, 'outnumbered');
        }
      }
      return actor;
    }

    isPlayerControlled(u) { return u.side === 'party' && !this.hasStatus(u, 'bloodrun'); }

    // skill cooldowns tick on the owner's turns; combo cooldowns are shared
    // and tick on any participant's turn
    tickCooldowns(actor) {
      for (const id of Object.keys(actor.cooldowns)) {
        if (--actor.cooldowns[id] <= 0) delete actor.cooldowns[id];
      }
      for (const combo of WS.COMBOS || []) {
        if (this.comboCooldowns[combo.id] > 0 && combo.participants.includes(actor.defId)) {
          if (--this.comboCooldowns[combo.id] <= 0) delete this.comboCooldowns[combo.id];
        }
      }
    }

    endTurn(actor) {
      // durations tick down on the holder's own turn
      for (const s of [...actor.statuses]) {
        s.turns--;
        if (s.turns <= 0) this.removeStatus(actor, s);
      }
      const totem = this.totems[actor.side];
      if (totem && totem.caster === actor.uid && --totem.turns <= 0) {
        this.totems[actor.side] = null;
        this.log('The totem crumbles.', 'dim');
      }
      // boss aspect cycling: every 3 of its turns
      const cyc = actor.def.aspectCycle;
      if (cyc && actor.hp > 0 && actor.turnCount % 3 === 0) {
        actor.aspectIndex = (actor.aspectIndex + 1) % cyc.length;
        actor.element = cyc[actor.aspectIndex];
        const el = WS.ELEMENTS[actor.element];
        this.emit('aspect', { uid: actor.uid, element: actor.element });
        this.log(`${actor.name} shifts its Aspect — ${el.name}! (weak to ${WS.ELEMENTS[el.opposite].name})`, 'aspect');
      }
      this.checkEnd();
      this.current = null;
    }

    removeStatus(u, s) {
      u.statuses = u.statuses.filter((x) => x !== s);
      this.emit('statusEnd', { uid: u.uid, id: s.id });
      if (s.id === 'awaken') this.log(`${u.name}'s ${s.name} fades.`, 'dim');
      if (s.id === 'bloodrun') {
        u.gauge.value = 0;
        this.emit('gauge', { uid: u.uid, value: 0 });
        this.addStatus(u, { id: 'comedown', name: 'Comedown', turns: 1, data: {} });
        this.emit('bloodrunEnd', { uid: u.uid });
        this.log(`${u.name} comes back to herself, shaking. (Rage spent — 1 turn comedown)`, 'bloodrun');
      }
    }

    addStatus(u, s) {
      const existing = this.getStatus(u, s.id);
      if (existing) existing.turns = Math.max(existing.turns, s.turns);
      else u.statuses.push(s);
      this.emit('status', { uid: u.uid, id: s.id, name: s.name });
      // he rises as things go wrong: a debuff landing feeds Defiance
      if (s.harmful && u.gauge && u.gauge.type === 'defiance') this.addGauge(u, 10, 'defied');
    }

    // ---------- gauges ----------
    addGauge(u, amt, reason) {
      if (!u.gauge || u.hp <= 0 || amt === 0) return;
      if (this.hasStatus(u, 'bloodrun')) return; // frozen at max while seized
      u.gauge.value = Math.min(GAUGE_MAX, Math.max(0, u.gauge.value + amt));
      this.emit('gauge', { uid: u.uid, value: u.gauge.value, reason });
      if (u.gauge.type === 'rage' && u.gauge.value >= GAUGE_MAX) this.triggerBloodrun(u);
    }

    triggerBloodrun(u) {
      const turns = 3 + (this.current === u ? 1 : 0);
      this.addStatus(u, { id: 'bloodrun', name: 'Bloodrun', turns, data: {} });
      this.emit('bloodrun', { uid: u.uid });
      this.log(`${u.name}'s Rage crests — BLOODRUN! She is beyond reach.`, 'bloodrun');
    }

    // Note: Amplify hits feed the wielder's gauge like any hit (spec §6a). For
    // Cinne this is deliberate post-playtest: Last Dance only half-vents her
    // Rage — Earl's Calm Down is the only real way to bring her down.
    onHitDealt(attacker, { crit, rupture }) {
      if (attacker.gauge) {
        if (attacker.gauge.type === 'rage') this.addGauge(attacker, crit ? 12 : 4, 'hit');
        else if (attacker.gauge.type === 'resonance') {
          this.addGauge(attacker, 4 + (rupture ? 15 : 0), rupture ? 'rupture' : 'hit');
        }
      }
      if (rupture) {
        for (const a of this.alliesOf(attacker)) {
          if (a !== attacker && a.gauge && a.gauge.type === 'fervor') this.addGauge(a, 6, 'ally rupture');
        }
      }
    }

    onHitTaken(u) {
      if (!u.gauge || u.hp <= 0) return;
      const amt = { resonance: 6, rage: 8, fervor: 10, defiance: 8 }[u.gauge.type];
      this.addGauge(u, amt, 'hit taken');
    }

    // ---------- damage ----------
    resolveElement(attacker, skill) {
      if (skill.element === 'weapon') return this.elementOf(attacker);
      if (skill.element === 'attuned') return attacker.attuned;
      return skill.element || null;
    }

    computeHit(attacker, defender, skill, ctx) {
      const phys = skill.kind === 'phys';
      const awaken = this.getStatus(attacker, 'awaken');
      const wMult = awaken ? 1.5 : 1.0;
      const atk = phys
        ? this.stat(attacker, 'PWR') + attacker.weaponAtk * wMult
        : this.stat(attacker, 'FOC') + attacker.arteBonus * wMult;

      const el = this.resolveElement(attacker, skill);
      const aff = (ctx && ctx.affinityOverride) || WS.affinity(el, this.elementOf(defender));

      // guard piercing: skill-innate + Opening mark
      let pierce = 0;
      for (const e of skill.effects || []) if (e.type === 'ignoreGuard') pierce = e.pct;
      const mark = this.getStatus(defender, 'mark');
      let guaranteedCrit = false;
      if (mark) { guaranteedCrit = true; pierce = Math.max(pierce, 0.3); this.removeStatus(defender, mark); }

      const def = this.stat(defender, phys ? 'GRD' : 'WRD') * (1 - pierce);

      const comedown = this.hasStatus(attacker, 'comedown');
      // her vow: bonus crit/damage vs anyone who has hurt Earl
      const vow = this.hasStatus(attacker, 'vow') && defender.hurtEarl;
      let critBonus = (skill.critBonus || 0)
        + (awaken && awaken.data.critBonus ? awaken.data.critBonus : 0)
        + (this.hasStatus(attacker, 'bloodrun') ? 50 : 0)
        + (vow ? 15 : 0);
      const crit = comedown ? false
        : (guaranteedCrit || F.rollCrit(this.stat(attacker, 'LCK'), critBonus));

      let extraMult = 1.0;
      // Rage damage bonus — deliberately excluded from Amplifies (balance flag #1)
      if (attacker.gauge && attacker.gauge.type === 'rage' && !ctx.isAmplify) {
        extraMult *= 1 + attacker.gauge.value * 0.005;
      }
      if (ctx.isAmplify && attacker.ampBoost !== 1) extraMult *= attacker.ampBoost;
      if (ctx.extraMult) extraMult *= ctx.extraMult;
      if (vow) extraMult *= 1.25;
      if (comedown) extraMult *= 0.8;
      // Watermark: an awakened protector shields the defender's side
      for (const a of this.alliesOf(defender)) {
        const aw = this.getStatus(a, 'awaken');
        if (aw && aw.data.allyDamageTakenMult) { extraMult *= aw.data.allyDamageTakenMult; break; }
      }

      const power = typeof skill.power === 'function' ? skill.power(attacker) : skill.power;
      const dmg = F.damage({ atk, power, affinityMult: aff.mult, def, crit, extraMult });
      return { dmg, crit, affinity: aff.kind, element: el };
    }

    applyDamage(target, hit, attacker) {
      if (attacker && attacker.side === 'enemy' && target.defId === 'earl') attacker.hurtEarl = true;
      let dmg = hit.dmg, absorbed = 0;
      if (target.shield > 0) {
        absorbed = Math.min(target.shield, dmg);
        target.shield -= absorbed;
        dmg -= absorbed;
        this.emit('shield', { uid: target.uid, value: target.shield });
      }
      const before = target.hp;
      target.hp = Math.max(0, target.hp - dmg);
      this.emit('damage', {
        uid: target.uid, amount: hit.dmg, absorbed, crit: hit.crit,
        rupture: hit.affinity === 'rupture', resist: hit.affinity === 'resist',
        element: hit.element, hp: target.hp,
      });

      if (hit.affinity === 'rupture') this.log(`RUPTURE! ${hit.dmg} damage to ${target.name}!`, 'rupture');
      else this.log(`${target.name} takes ${hit.dmg}${hit.crit ? ' — CRITICAL!' : ''}${hit.affinity === 'resist' ? ' (resisted)' : ''}`, hit.crit ? 'crit' : '');

      if (attacker) this.onHitDealt(attacker, { crit: hit.crit, rupture: hit.affinity === 'rupture' });

      if (target.hp <= 0) {
        this.emit('ko', { uid: target.uid });
        this.log(`${target.name} falls!`, 'ko');
      } else {
        this.onHitTaken(target);
      }

      // Fervor rises when an ally drops to critical HP or falls;
      // Defiance rises when an ally falls
      if (target.side === 'party') {
        const droppedCritical = (before / target.maxHp >= 0.25 && target.hp / target.maxHp < 0.25) || target.hp <= 0;
        if (droppedCritical) {
          for (const a of this.living('party')) {
            if (a !== target && a.gauge && a.gauge.type === 'fervor') this.addGauge(a, 15, 'ally critical');
          }
        }
        if (target.hp <= 0) {
          for (const a of this.living('party')) {
            if (a !== target && a.gauge && a.gauge.type === 'defiance') this.addGauge(a, 10, 'ally down');
          }
        }
      }
    }

    heal(u, amt, label) {
      if (u.hp <= 0) return;
      const healed = Math.min(amt, u.maxHp - u.hp);
      if (healed <= 0) return;
      u.hp += healed;
      this.emit('heal', { uid: u.uid, amount: healed, hp: u.hp, label });
    }

    // ---------- commands ----------
    commandsFor(actor) {
      const def = actor.def;
      const sealed = this.hasStatus(actor, 'seal');
      const skills = def.skills.map((sk) => {
        const isBasic = (sk.tags || []).includes('basic');
        const isAwakenOnly = (sk.tags || []).includes('awakenOnly');
        let ok = true, why = '';
        if (isAwakenOnly && !this.hasStatus(actor, 'awaken')) { ok = false; why = 'Awaken first'; }
        if (sk.mp && actor.mp < sk.mp) { ok = false; why = 'Not enough MP'; }
        if (sk.mp && sealed) { ok = false; why = 'Sealed'; }
        if (sk.gauge === 'full' && actor.gauge.value < GAUGE_MAX) { ok = false; why = `Needs ${GAUGE_MAX} ${actor.gauge.label}`; }
        if (typeof sk.gauge === 'number' && actor.gauge.value < sk.gauge) { ok = false; why = `Needs ${sk.gauge} ${actor.gauge.label}`; }
        if (sk.requiresAttuned && !actor.attuned) { ok = false; why = 'Attune first'; }
        const cdLeft = actor.cooldowns[sk.id] || 0;
        if (cdLeft > 0) { ok = false; why = `Ready in ${cdLeft} turn${cdLeft > 1 ? 's' : ''}`; }
        if (ok && (sk.target === 'enemy' || sk.target === 'ally') && this.validTargets(actor, sk).length === 0) {
          ok = false; why = sk.noTargetWhy || 'No valid target';
        }
        return { skill: sk, ok, why, isBasic, cdLeft };
      });
      let awaken = null;
      if (def.awaken) {
        let ok = true, why = '';
        if (this.hasStatus(actor, 'awaken')) { ok = false; why = 'Already Awakened'; }
        else if (actor.gauge.value < def.awaken.cost) { ok = false; why = `Needs ${def.awaken.cost} ${actor.gauge.label}`; }
        awaken = { ok, why, def: def.awaken };
      }
      return { skills, awaken, attune: def.attuner ? Object.keys(WS.ELEMENTS) : null };
    }

    validTargets(actor, skill) {
      if (skill.target === 'enemy') return this.foesOf(actor);
      if (skill.target === 'ally') {
        return this.alliesOf(actor).filter((u) =>
          this.supportable(u) && (!skill.excludeSelf || u !== actor)
          && (!skill.targetDefId || u.defId === skill.targetDefId));
      }
      return []; // AoE/self need no target pick
    }

    // ---------- combos ----------
    comboUnit(defId) { return this.party.find((u) => u.defId === defId); }

    combosFor(actor) {
      return (WS.COMBOS || [])
        // absent partners aren't "down" — the combo just isn't offered
        .filter((c) => c.initiators.includes(actor.defId)
          && c.participants.every((id) => this.comboUnit(id)))
        .map((combo) => {
          let ok = true, why = '';
          for (const id of combo.participants) {
            const u = this.comboUnit(id);
            if (!u || u.hp <= 0) { ok = false; why = `${u ? u.name : id} is down`; break; }
            if (this.hasStatus(u, 'bloodrun')) { ok = false; why = combo.bloodrunWhy || `${u.name} is beyond reach`; break; }
            const cost = combo.gaugeCost[id];
            if (cost && u.gauge.value < cost) { ok = false; why = `Needs ${cost} ${u.gauge.label} (${u.name})`; break; }
          }
          const cdLeft = this.comboCooldowns[combo.id] || 0;
          if (ok && cdLeft > 0) { ok = false; why = `Ready in ${cdLeft} turn${cdLeft > 1 ? 's' : ''}`; }
          return { combo, ok, why, cdLeft };
        });
    }

    doCombo(actor, comboId, targetUid) {
      const combo = WS.COMBOS.find((c) => c.id === comboId);
      const units = combo.participants.map((id) => this.comboUnit(id));
      if (combo.cooldown) this.comboCooldowns[combo.id] = combo.cooldown;
      for (const u of units) {
        const cost = combo.gaugeCost[u.defId];
        if (cost) this.addGauge(u, -cost, 'combo');
      }
      this.emit('combo', { uid: actor.uid, name: combo.name, cue: combo.cue });
      this.log(`${units.map((u) => u.name).join(' + ')} — ${combo.name}!`, 'amplify');

      const target = targetUid ? this.unit(targetUid) : null;
      if (combo.hits && target && target.hp > 0) {
        let affinityOverride = null;
        if (combo.guaranteedRuptureIfEitherWeak) {
          const defEl = this.elementOf(target);
          const els = combo.hits.map((h) => this.resolveElement(this.comboUnit(h.by), h));
          if (defEl && els.some((el) => el && WS.ELEMENTS[defEl].opposite === el)) {
            affinityOverride = { mult: 2.0, kind: 'rupture' };
          }
        }
        let extraMult = combo.coordBonus || 1;
        // seeing-through-the-lie: bonus vs tagged (Artificial / state) enemies
        if (combo.bonusVs && (target.def.tags || []).some((t) => combo.bonusVs.includes(t))) {
          extraMult *= combo.bonusMult;
        }
        const ctx = { affinityOverride, extraMult };
        for (const h of combo.hits) {
          const dealer = this.comboUnit(h.by);
          if (!dealer || dealer.hp <= 0) continue;
          // "no Attune setup": the strike resolves as the target's opposing
          // element at cast time (Gale — freedom — against the elementless)
          let hit = h;
          if (h.element === 'trueElement') {
            const defEl = this.elementOf(target);
            hit = { ...h, element: defEl ? WS.ELEMENTS[defEl].opposite : 'gale' };
          }
          for (let i = 0; i < (h.times || 1); i++) {
            if (target.hp <= 0) break;
            this.applyDamage(target, this.computeHit(dealer, target, hit, ctx), dealer);
          }
        }
      }

      if (combo.effect === 'guardian') {
        const [cinne, earl] = units;
        this.addStatus(earl, { id: 'guarded', name: 'Guarded', turns: combo.turns, data: { by: cinne.uid } });
        this.addStatus(cinne, { id: 'vow', name: 'Vow', turns: combo.turns, data: {} });
        this.log(`${cinne.name} takes a guardian stance over ${earl.name}.`, 'buff');
      }
      if (combo.effect === 'ventRage') {
        const [earl, cinne] = units;
        this.addGauge(cinne, -combo.vent, 'vented');
        this.addGauge(earl, combo.selfGauge, 'combo');
        this.log(`${earl.name} reaches his sister. ${cinne.name}'s Rage falls to ${Math.floor(cinne.gauge.value)}.`, 'buff');
      }

      const awaken = this.getStatus(actor, 'awaken');
      this.advance(actor, combo.weight * (awaken && awaken.data.weightMult ? awaken.data.weightMult : 1));
      this.checkEnd();
    }

    // ---------- actions ----------
    act(actor, action) {
      if (action.type === 'awaken') return this.doAwaken(actor);
      if (action.type === 'attune') return this.doAttune(actor, action.element);
      if (action.type === 'combo') return this.doCombo(actor, action.comboId, action.targetUid);
      return this.doSkill(actor, action.skillId, action.targetUid);
    }

    doAwaken(actor) {
      const aw = actor.def.awaken;
      this.addGauge(actor, -aw.cost, 'awaken');
      // +1 so the buff survives this turn's own end-of-turn tick
      this.addStatus(actor, {
        id: 'awaken', name: aw.name, turns: 4,
        data: { critBonus: aw.critBonus, weightMult: aw.weightMult, allyDamageTakenMult: aw.allyDamageTakenMult, controlSlip: aw.controlSlip },
      });
      this.emit('awaken', { uid: actor.uid, name: aw.name });
      this.log(`${actor.name} AWAKENS — ${aw.name}!`, 'awaken');
      this.advance(actor, 1.0);
      this.checkEnd();
    }

    doAttune(actor, element) {
      actor.attuned = element;
      this.emit('attune', { uid: actor.uid, element });
      const el = WS.ELEMENTS[element];
      this.log(`${actor.name} attunes to ${el.name}. (weak to ${WS.ELEMENTS[el.opposite].name} now)`, 'attune');
      this.addGauge(actor, actor.def.attuneGauge || 25, 'attune');
      this.advance(actor, 1.0);
      this.checkEnd();
    }

    doSkill(actor, skillId, targetUid) {
      const skill = actor.def.skills.find((s) => s.id === skillId);
      const isAmplify = (skill.tags || []).includes('amplify');
      const ctx = { isAmplify };

      // costs
      if (skill.mp) { actor.mp -= skill.mp; this.emit('mp', { uid: actor.uid, mp: actor.mp }); }
      if (skill.gauge === 'full') this.addGauge(actor, -GAUGE_MAX, 'amplify');
      else if (typeof skill.gauge === 'number') this.addGauge(actor, -skill.gauge, 'spend');
      if (skill.cooldown) actor.cooldowns[skill.id] = skill.cooldown;

      if (isAmplify) this.emit('amplify', { uid: actor.uid, name: skill.name, cue: skill.cue });
      this.log(`${actor.name} — ${skill.name}!`, isAmplify ? 'amplify' : 'action');
      this.emit('action', { uid: actor.uid, skillId: skill.id, name: skill.name });

      // damage
      let anyRupture = false;
      if (skill.power) {
        let targets = skill.target === 'allEnemies'
          ? this.foesOf(actor)
          : [this.unit(targetUid)].filter((u) => u && u.hp > 0);
        // guardian stance: single-target enemy attacks aimed at the ward hit her instead
        targets = targets.map((t) => {
          const g = this.getStatus(t, 'guarded');
          if (!g || actor.side === t.side || skill.target === 'allEnemies') return t;
          if (actor.side === 'enemy') actor.hurtEarl = true; // they tried
          const guardian = this.unit(g.data.by);
          if (!guardian || guardian.hp <= 0 || this.hasStatus(guardian, 'bloodrun')) return t;
          this.log(`${guardian.name} steps in front of ${t.name}!`, 'buff');
          return guardian;
        });
        for (const t of targets) {
          const hits = typeof skill.hits === 'function' ? skill.hits(actor) : (skill.hits || 1);
          for (let i = 0; i < hits; i++) {
            if (t.hp <= 0) break;
            const hit = this.computeHit(actor, t, skill, ctx);
            if (hit.affinity === 'rupture') anyRupture = true;
            this.applyDamage(t, hit, actor);
          }
        }
      }
      ctx.anyRupture = anyRupture;

      // secondary effects
      for (const e of skill.effects || []) this.applyEffect(actor, e, skill, targetUid, ctx);

      if (isAmplify) actor.ampBoost = 1; // Kindle/Stand boost consumed

      const awaken = this.getStatus(actor, 'awaken');
      this.advance(actor, skill.weight * (awaken && awaken.data.weightMult ? awaken.data.weightMult : 1));
      this.checkEnd();
    }

    applyEffect(actor, e, skill, targetUid, ctx) {
      const target = targetUid ? this.unit(targetUid) : null;
      switch (e.type) {
        case 'freeze': {
          if (!target || target.hp <= 0) break;
          if (this.hasStatus(target, 'unbound')) { this.log(`${target.name} will not be held.`, 'buff'); break; }
          const chance = F.statusChance(e.chance, this.stat(actor, 'LCK'), this.stat(target, 'LCK'))
            * this.controlSlipFor(target);
          if (F.rand() * 100 < chance) {
            const push = Math.round(F.tickCost(this.stat(target, 'AGI'), 1.0) * e.push);
            target.nextTurn += push;
            this.emit('freeze', { uid: target.uid, push });
            this.log(`${target.name} is FROZEN — turn dragged back!`, 'freeze');
          } else this.log(`${target.name} shrugs off the Freeze.`, 'dim');
          break;
        }
        case 'buff':
          if (target && this.supportable(target)) {
            this.addStatus(target, { id: 'guard_up', name: 'Guard Up', turns: e.turns, data: { stats: e.stats } });
            this.log(`${target.name}'s defenses rise.`, 'buff');
          }
          break;
        case 'shield':
          if (target && this.supportable(target)) {
            const amt = Math.round(e.amount(actor));
            target.shield += amt;
            this.emit('shield', { uid: target.uid, value: target.shield });
            this.log(`${target.name} gains a ${amt} shield.`, 'buff');
          }
          break;
        case 'partyShield': {
          const amt = Math.round(e.amount(actor));
          for (const a of this.alliesOf(actor)) {
            if (!this.supportable(a)) continue;
            a.shield += amt;
            this.emit('shield', { uid: a.uid, value: a.shield });
          }
          this.log(`A barrier settles over the party (${amt}).`, 'buff');
          break;
        }
        case 'nextTickMult':
          actor.pendingTickMult = e.mult;
          this.log(`${actor.name} cuts in line — next action comes fast.`, 'buff');
          break;
        case 'mark':
          if (target && target.hp > 0) {
            this.addStatus(target, { id: 'mark', name: 'Opening', turns: 99, data: {} });
            this.log(`${actor.name} finds an Opening on ${target.name}.`, 'buff');
          }
          break;
        case 'refundAlliesOnRupture':
          if (ctx && ctx.anyRupture) {
            for (const a of this.alliesOf(actor)) {
              if (a === actor || !a.gauge || !this.supportable(a)) continue;
              this.addGauge(a, e.amount, 'prism refund');
            }
            this.log(`The Rupture cracks open — gauge refunds to the party (+${e.amount}).`, 'buff');
          }
          break;
        case 'ignoreGuard':
          break; // consumed inside computeHit
        case 'totemRegen':
          this.totems[actor.side] = { pct: e.pct, turns: e.turns, caster: actor.uid };
          this.log('A totem takes root — the party mends each turn.', 'buff');
          break;
        case 'pushAllEnemies':
          for (const t of this.foesOf(actor)) {
            const push = Math.round(F.tickCost(this.stat(t, 'AGI'), 1.0) * e.frac);
            t.nextTurn += push;
            this.emit('freeze', { uid: t.uid, push });
          }
          this.log('The Roar drives every enemy back!', 'freeze');
          break;
        case 'debuffAllEnemies':
          for (const t of this.foesOf(actor)) {
            this.addStatus(t, { id: 'grd_down', name: 'Guard Down', turns: e.turns, harmful: true, data: { stats: e.stats } });
          }
          this.log('Enemy Guard crumbles.', 'buff');
          break;
        case 'gaugeGift':
          if (target && this.supportable(target) && target.gauge) {
            this.addGauge(target, e.amount, 'kindle');
            target.ampBoost *= 1 + e.ampBoost;
            this.log(`${target.name}'s spirit is Kindled (+${e.amount} ${target.gauge.label}, next Amplify +${Math.round(e.ampBoost * 100)}%).`, 'buff');
          }
          break;
        case 'partyGauge':
          for (const a of this.alliesOf(actor)) {
            if (a === actor || !this.supportable(a) || !a.gauge) continue;
            this.addGauge(a, e.amount, 'stand');
            a.ampBoost *= 1 + e.ampBoost;
          }
          this.log(`The ancestors rise — the party surges (+${e.amount} gauge, Amplifies empowered).`, 'amplify');
          break;
        case 'seal': {
          if (!target || target.hp <= 0) break;
          if (this.hasStatus(target, 'unbound')) { this.log(`${target.name} will not be bound.`, 'buff'); break; }
          const chance = F.statusChance(e.chance, this.stat(actor, 'LCK'), this.stat(target, 'LCK'))
            * this.controlSlipFor(target);
          if (F.rand() * 100 < chance) {
            this.addStatus(target, { id: 'seal', name: 'Seal', turns: e.turns, harmful: true, data: {} });
            this.log(`${target.name} is SEALED — artes locked!`, 'seal');
          } else this.log(`${target.name} resists the Seal.`, 'dim');
          break;
        }
        case 'debuff':
          if (target && target.hp > 0) {
            this.addStatus(target, { id: e.id, name: e.name, turns: e.turns, harmful: true, data: { stats: e.stats } });
            this.log(`${target.name} is weighed down — ${e.name}.`, 'seal');
          }
          break;
        case 'cleanse': {
          const t = target || actor; // Break cleanses himself; Unshackle an ally
          const bound = t.statuses.filter((s) => s.harmful);
          for (const s of bound) this.removeStatus(t, s);
          this.log(bound.length
            ? `${t.name}'s bindings shatter — ${bound.map((s) => s.name).join(', ')} gone.`
            : `${t.name} carries nothing that binds.`, 'buff');
          break;
        }
        case 'unbound':
          this.addStatus(actor, { id: 'unbound', name: 'Unbound', turns: e.turns, data: { stats: { PWR: e.pwr } } });
          this.log(`${actor.name} will not be bound again — control-immune, PWR up.`, 'buff');
          break;
      }
    }

    // Maelstrom: while an awakened storm stands on this side, control slips
    controlSlipFor(defender) {
      for (const a of this.alliesOf(defender)) {
        const aw = this.getStatus(a, 'awaken');
        if (aw && aw.data.controlSlip) return aw.data.controlSlip;
      }
      return 1;
    }

    advance(actor, weight) {
      const cost = Math.round(F.tickCost(this.stat(actor, 'AGI'), weight) * actor.storedTickMult);
      actor.nextTurn += Math.max(1, cost);
      actor.storedTickMult = actor.pendingTickMult != null ? actor.pendingTickMult : 1;
      actor.pendingTickMult = null;
    }

    checkEnd() {
      if (this.state !== 'active') return;
      if (this.living('enemy').length === 0) { this.state = 'victory'; this.emit('end', { result: 'victory' }); }
      else if (this.living('party').length === 0) { this.state = 'defeat'; this.emit('end', { result: 'defeat' }); }
    }

    // ---------- turn queue preview ----------
    queuePreview(n = 8) {
      const sim = this.units.filter((u) => u.hp > 0)
        .map((u) => ({ uid: u.uid, nt: u.nextTurn, agi: this.stat(u, 'AGI') }));
      const out = [];
      while (out.length < n && sim.length) {
        sim.sort((a, b) => a.nt - b.nt || b.agi - a.agi);
        out.push(sim[0].uid);
        sim[0].nt += F.tickCost(sim[0].agi, 1.0);
      }
      return out;
    }

    // ---------- AI ----------
    aiAct(actor) {
      if (this.hasStatus(actor, 'bloodrun')) {
        // seized: basic attack on a random living unit, allies not safe
        const pool = this.units.filter((u) => u.hp > 0 && u !== actor);
        const t = pool[Math.floor(F.rand() * pool.length)];
        const basic = actor.def.skills.find((s) => (s.tags || []).includes('basic'));
        return { type: 'skill', skillId: basic.id, targetUid: t.uid };
      }
      const foes = this.foesOf(actor);
      const pick = (arr) => arr[Math.floor(F.rand() * arr.length)];
      const target = pick(foes);

      if (actor.def.ai === 'warden') {
        const seal = actor.def.skills.find((s) => s.id === 'seal_protocol');
        const unsealed = foes.filter((f) => !this.hasStatus(f, 'seal'));
        if (actor.turnCount - actor.lastSealTurn >= 4 && unsealed.length && F.rand() < 0.6) {
          actor.lastSealTurn = actor.turnCount;
          return { type: 'skill', skillId: seal.id, targetUid: pick(unsealed).uid };
        }
        const r = F.rand();
        if (r < 0.25 && foes.length > 1) return { type: 'skill', skillId: 'wardenfall' };
        if (r < 0.6) return { type: 'skill', skillId: 'aspect_surge', targetUid: target.uid };
        return { type: 'skill', skillId: 'aspect_strike', targetUid: target.uid };
      }

      if (actor.def.ai === 'sergeant') {
        const r = F.rand();
        const collarable = foes.filter((f) => !this.hasStatus(f, 'seal') && !this.hasStatus(f, 'unbound'));
        if (actor.turnCount - actor.lastSealTurn >= 3 && collarable.length && r < 0.55) {
          actor.lastSealTurn = actor.turnCount;
          return { type: 'skill', skillId: 'collar_toss', targetUid: pick(collarable).uid };
        }
        if (r < 0.3 && foes.length > 2) return { type: 'skill', skillId: 'suppression_volley' };
        return { type: 'skill', skillId: 'iron_writ', targetUid: target.uid };
      }

      if (actor.def.ai === 'bindwright') {
        const r = F.rand();
        const sealable = foes.filter((f) => !this.hasStatus(f, 'seal') && !this.hasStatus(f, 'unbound'));
        if (r < 0.35 && sealable.length) return { type: 'skill', skillId: 'shackle_writ', targetUid: pick(sealable).uid };
        const unburdened = foes.filter((f) => !this.hasStatus(f, 'leaden'));
        if (r < 0.7 && unburdened.length) return { type: 'skill', skillId: 'leaden_writ', targetUid: pick(unburdened).uid };
        return { type: 'skill', skillId: 'censer_lash', targetUid: target.uid };
      }

      if (actor.def.ai === 'proctor') {
        const r = F.rand();
        // never repeats the dazzle back-to-back
        if (r < 0.25 && actor.lastSkillId !== 'blinding_order') {
          actor.lastSkillId = 'blinding_order';
          return { type: 'skill', skillId: 'blinding_order', targetUid: target.uid };
        }
        actor.lastSkillId = r < 0.6 ? 'flash_sear' : 'credential_cut';
        return { type: 'skill', skillId: actor.lastSkillId, targetUid: target.uid };
      }

      // grunt: simple basic attacks
      const basic = actor.def.skills.find((s) => (s.tags || []).includes('basic'));
      return { type: 'skill', skillId: basic.id, targetUid: target.uid };
    }
  }

  WS.Battle = Battle;
  if (typeof module !== 'undefined') module.exports = Battle;
})();
