// UI layer: renders battle state, plays engine events back as timed animations,
// and turns menu clicks into engine actions. No game rules live here.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});
  const $ = (sel) => document.querySelector(sel);

  const CHAR_COLORS = {
    siren: '#3fa7d6', cinne: '#8ee06e', earl: '#c9b8ff', katarina: '#e8a33d',
  };
  const GAUGE_COLORS = { resonance: '#3fa7d6', rage: '#e3405f', fervor: '#e8a33d' };
  const ENEMY_GLYPHS = { sparring_construct: '⚙', aspect_warden: '👁' };

  const DELAYS = {
    action: 220, damage: 340, rupture: 650, heal: 180, freeze: 300, attune: 450,
    awaken: 1100, amplify: 2100, combo: 1500, aspect: 1100, bloodrun: 1400, bloodrunEnd: 900,
    ko: 550, status: 120, end: 500,
  };

  class UI {
    constructor() {
      this.speed = 1;
      this.events = [];
      this.cards = {};
      $('#speed-btn').addEventListener('click', () => {
        this.speed = this.speed === 1 ? 2.5 : 1;
        $('#speed-btn').textContent = this.speed === 1 ? '1×' : '2.5×';
      });
    }

    sleep(ms) { return new Promise((r) => setTimeout(r, ms / this.speed)); }
    onEvent = (e) => { this.events.push(e); };

    // ---------- setup ----------
    setup(battle) {
      this.battle = battle;
      this.events = [];
      this.cards = {};
      $('#log').innerHTML = '';
      $('#enemy-zone').innerHTML = '';
      $('#party-row').innerHTML = '';
      $('#end-overlay').classList.add('hidden');
      $('#cinematic').classList.add('hidden');
      $('#banner').classList.add('hidden');

      for (const u of battle.enemies) {
        const card = document.createElement('div');
        card.className = 'enemy-card';
        card.dataset.uid = u.uid;
        card.innerHTML = `
          <div class="glyph">${ENEMY_GLYPHS[u.defId] || '☠'}</div>
          <h3>${u.name}</h3>
          <div class="el-badge"></div>
          <div class="bar-row"><span class="lbl">HP</span><div class="bar"><div class="fill hp-ok"></div></div><span class="num"></span></div>
          <div class="chips"></div>
          <div class="popups"></div>`;
        $('#enemy-zone').appendChild(card);
        this.cards[u.uid] = card;
      }
      for (const u of battle.party) {
        const card = document.createElement('div');
        card.className = 'party-card';
        card.dataset.uid = u.uid;
        const g = u.gauge;
        card.innerHTML = `
          <div class="head"><h4 style="color:${CHAR_COLORS[u.defId]}">${u.name}</h4><span class="el-badge"></span></div>
          <div class="bar-row"><span class="lbl">HP</span><div class="bar"><div class="fill hp-ok"></div></div><span class="num hp-num"></span></div>
          <div class="bar-row"><span class="lbl">MP</span><div class="bar"><div class="fill mp"></div></div><span class="num mp-num"></span></div>
          <div class="bar-row"><span class="lbl">${g.label.slice(0, 4).toUpperCase()}</span>
            <div class="bar"><div class="fill gauge" style="background:${GAUGE_COLORS[g.type]}"></div></div>
            <span class="num gauge-num" style="color:${GAUGE_COLORS[g.type]}"></span></div>
          <div class="chips"></div>
          <div class="popups"></div>`;
        $('#party-row').appendChild(card);
        this.cards[u.uid] = card;
      }
      this.renderAll();
    }

    // ---------- rendering ----------
    elBadge(u) {
      const el = this.battle.elementOf(u);
      if (el) {
        const e = WS.ELEMENTS[el];
        return { text: `${e.icon} ${e.name}`, bg: e.color };
      }
      if (u.def.spirit) return { text: '✧ Spirit', bg: '#d7dfef' };
      return { text: '— Elementless', bg: '#55617a' };
    }

    renderUnit(u) {
      const card = this.cards[u.uid];
      if (!card) return;
      const badge = this.elBadge(u);
      const badgeEl = card.querySelector('.el-badge');
      badgeEl.textContent = badge.text;
      badgeEl.style.background = badge.bg;

      const pct = (u.hp / u.maxHp) * 100;
      const hpFill = card.querySelector('.fill.hp-ok, .fill.hp-mid, .fill.hp-low');
      hpFill.style.width = pct + '%';
      hpFill.className = 'fill ' + (pct > 50 ? 'hp-ok' : pct > 25 ? 'hp-mid' : 'hp-low');
      const hpNum = card.querySelector('.num');
      hpNum.textContent = `${u.hp}/${u.maxHp}`;

      if (u.side === 'party') {
        card.querySelector('.mp-num').textContent = `${u.mp}/${u.maxMp}`;
        card.querySelector('.fill.mp').style.width = (u.mp / u.maxMp) * 100 + '%';
        card.querySelector('.fill.gauge').style.width = u.gauge.value + '%';
        card.querySelector('.gauge-num').textContent =
          u.gauge.value >= 100 ? 'MAX' : Math.floor(u.gauge.value);
        card.classList.toggle('awakened', this.battle.hasStatus(u, 'awaken'));
        card.classList.toggle('bloodrunning', this.battle.hasStatus(u, 'bloodrun'));
      }
      card.classList.toggle('dead', u.hp <= 0);

      const chips = card.querySelector('.chips');
      chips.innerHTML = '';
      if (u.shield > 0) chips.insertAdjacentHTML('beforeend',
        `<span class="status-chip shield">🛡 ${u.shield}</span>`);
      for (const s of u.statuses) {
        if (s.id === 'mark') { chips.insertAdjacentHTML('beforeend', '<span class="status-chip">◎ Opening</span>'); continue; }
        const cls = { seal: 'seal', awaken: 'awaken', bloodrun: 'bloodrun' }[s.id] || '';
        chips.insertAdjacentHTML('beforeend',
          `<span class="status-chip ${cls}">${s.name}${s.turns < 90 ? ' ' + s.turns : ''}</span>`);
      }
    }

    renderQueue() {
      const q = $('#queue');
      q.innerHTML = '';
      const preview = this.battle.queuePreview(9);
      preview.forEach((uid, i) => {
        const u = this.battle.unit(uid);
        const chip = document.createElement('div');
        chip.className = 'chip' + (u.side === 'enemy' ? ' enemy' : '') + (i === 0 ? ' now' : '');
        chip.style.background = u.side === 'enemy'
          ? (WS.ELEMENTS[u.element] ? WS.ELEMENTS[u.element].color : '#e3405f')
          : CHAR_COLORS[u.defId];
        chip.textContent = u.name[0];
        chip.title = u.name;
        q.appendChild(chip);
      });
    }

    renderAll() {
      for (const u of this.battle.units) this.renderUnit(u);
      this.renderQueue();
    }

    markActive(actor) {
      for (const el of document.querySelectorAll('.active-turn')) el.classList.remove('active-turn');
      if (actor && this.cards[actor.uid]) this.cards[actor.uid].classList.add('active-turn');
    }

    // ---------- log & popups ----------
    logLine(text, cls) {
      const p = document.createElement('p');
      if (cls) p.className = cls;
      p.textContent = text;
      $('#log').appendChild(p);
      $('#log').scrollTop = $('#log').scrollHeight;
    }

    popup(uid, text, cls) {
      const card = this.cards[uid];
      if (!card) return;
      const el = document.createElement('div');
      el.className = 'popup ' + (cls || '');
      el.textContent = text;
      el.style.left = 30 + Math.random() * 40 + '%';
      card.querySelector('.popups').appendChild(el);
      setTimeout(() => el.remove(), 1100);
    }

    banner(text, cls, sub) {
      const b = $('#banner');
      b.className = cls || '';
      b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
      b.classList.remove('hidden');
      clearTimeout(this._bannerT);
      this._bannerT = setTimeout(() => b.classList.add('hidden'), 1600 / this.speed);
    }

    flash() {
      const f = $('#flash');
      f.classList.remove('go');
      void f.offsetWidth; // restart animation
      f.classList.add('go');
    }

    shake() {
      const bf = $('#battlefield');
      bf.classList.remove('shake');
      void bf.offsetWidth;
      bf.classList.add('shake');
    }

    // ---------- event playback ----------
    async playEvents() {
      const events = this.events;
      this.events = [];
      for (const e of events) {
        const u = e.uid ? this.battle.unit(e.uid) : null;
        switch (e.type) {
          case 'log':
            this.logLine(e.text, e.cls);
            break;
          case 'turnStart':
            this.logLine(`— ${u.name} —`, 'turn');
            break;
          case 'action':
            await this.sleep(DELAYS.action);
            break;
          case 'damage': {
            if (e.rupture) { this.flash(); this.shake(); this.popup(e.uid, 'RUPTURE!', 'tag rupture'); }
            const cls = e.rupture ? 'rupture' : e.crit ? 'crit' : e.resist ? 'resist' : '';
            this.popup(e.uid, e.amount, cls);
            if (e.absorbed) this.popup(e.uid, `-${e.absorbed} 🛡`, 'absorb');
            this.renderUnit(u);
            await this.sleep(e.rupture ? DELAYS.rupture : DELAYS.damage);
            break;
          }
          case 'heal':
            this.popup(e.uid, '+' + e.amount, 'heal');
            this.renderUnit(u);
            await this.sleep(DELAYS.heal);
            break;
          case 'gauge': case 'mp': case 'shield': case 'status': case 'statusEnd':
            this.renderUnit(u);
            break;
          case 'freeze':
            this.popup(e.uid, 'STAGGERED', 'tag');
            this.renderQueue();
            await this.sleep(DELAYS.freeze);
            break;
          case 'attune':
            this.renderUnit(u);
            await this.sleep(DELAYS.attune);
            break;
          case 'awaken':
            this.banner(`${u.name} — ${e.name}`, 'gold', 'AWAKENED');
            this.renderUnit(u);
            await this.sleep(DELAYS.awaken);
            break;
          case 'amplify': {
            $('#cin-name').textContent = `${u.name} — ${e.name}`;
            $('#cin-cue').textContent = e.cue ? `“${e.cue}”` : e.name;
            $('#cinematic').classList.remove('hidden');
            await this.sleep(DELAYS.amplify);
            $('#cinematic').classList.add('hidden');
            this.flash();
            break;
          }
          case 'combo': {
            $('#cin-name').textContent = e.name;
            $('#cin-cue').textContent = e.cue || e.name;
            $('#cinematic').classList.remove('hidden');
            await this.sleep(DELAYS.combo);
            $('#cinematic').classList.add('hidden');
            break;
          }
          case 'aspect': {
            const el = WS.ELEMENTS[e.element];
            this.banner(`ASPECT SHIFT — ${el.icon} ${el.name.toUpperCase()}`, 'aspect-b',
              `now weak to ${WS.ELEMENTS[el.opposite].name}`);
            this.renderUnit(u);
            this.renderQueue();
            await this.sleep(DELAYS.aspect);
            break;
          }
          case 'bloodrun':
            this.banner(`${u.name} — BLOODRUN`, 'blood', 'she is beyond reach');
            this.renderUnit(u);
            await this.sleep(DELAYS.bloodrun);
            break;
          case 'bloodrunEnd':
            this.renderUnit(u);
            await this.sleep(DELAYS.bloodrunEnd);
            break;
          case 'ko':
            this.renderUnit(u);
            await this.sleep(DELAYS.ko);
            break;
          case 'end':
            await this.sleep(DELAYS.end);
            break;
        }
      }
    }

    // ---------- command menu ----------
    promptAction(actor) {
      return new Promise((resolve) => {
        this._resolve = (action) => {
          this.clearTargeting();
          $('#command-menu').innerHTML = '';
          $('#command-title').textContent = '';
          resolve(action);
        };
        this.rootMenu(actor);
      });
    }

    menuButton(label, cost, opts = {}) {
      const btn = document.createElement('button');
      btn.className = 'cmd-btn' + (opts.amplify ? ' amplify' : '') + (opts.back ? ' back' : '');
      btn.innerHTML = `<span>${label}</span>` + (cost ? `<span class="cost">${cost}</span>` : '');
      if (opts.disabled) { btn.disabled = true; btn.title = opts.why || ''; }
      if (opts.title) btn.title = opts.title;
      $('#command-menu').appendChild(btn);
      return btn;
    }

    setMenu(title) {
      $('#command-title').textContent = title;
      $('#command-menu').innerHTML = '';
      this.clearTargeting();
    }

    rootMenu(actor) {
      const b = this.battle;
      const cmds = b.commandsFor(actor);
      this.setMenu(`${actor.name} — choose`);

      const basic = cmds.skills.find((c) => c.isBasic);
      this.menuButton('Attack', null, { title: 'Basic attack (power 100)' })
        .addEventListener('click', () => this.pickTarget(actor, basic.skill, () => this.rootMenu(actor)));

      const artes = cmds.skills.filter((c) => c.skill.mp);
      if (artes.length) {
        this.menuButton('Artes', 'MP', {})
          .addEventListener('click', () => this.skillMenu(actor, artes, 'Artes', (sk) => `${sk.mp} MP`));
      }

      const gaugeSkills = cmds.skills.filter((c) => c.skill.gauge != null);
      if (cmds.awaken || gaugeSkills.length) {
        const g = actor.gauge;
        this.menuButton(g.label, `${Math.floor(g.value)}/100`, {})
          .addEventListener('click', () => this.gaugeMenu(actor, cmds, gaugeSkills));
      }

      if (cmds.attune) {
        this.menuButton('Attune', actor.attuned ? WS.ELEMENTS[actor.attuned].name : '—', {
          title: 'Full action: set your element (+25 gauge). You can Rupture only while attuned.',
        }).addEventListener('click', () => this.attuneMenu(actor, cmds.attune));
      }

      const combos = b.combosFor(actor);
      if (combos.length) {
        this.menuButton('Combos', '✦', { title: 'Joint moves — relationships as mechanics' })
          .addEventListener('click', () => this.comboMenu(actor, combos));
      }
    }

    comboMenu(actor, combos) {
      this.setMenu(`${actor.name} — Combos`);
      for (const c of combos) {
        const btn = this.menuButton(c.combo.name, c.combo.costLabel,
          { disabled: !c.ok, why: c.why, title: c.combo.desc || '' });
        if (c.ok) btn.addEventListener('click', () => {
          if (c.combo.target === 'enemy') this.pickTarget(actor, c.combo, () => this.comboMenu(actor, combos), true);
          else this._resolve({ type: 'combo', comboId: c.combo.id });
        });
      }
      this.menuButton('◂ Back', null, { back: true }).addEventListener('click', () => this.rootMenu(actor));
    }

    skillMenu(actor, list, title, costFn) {
      this.setMenu(`${actor.name} — ${title}`);
      for (const c of list) {
        const btn = this.menuButton(c.skill.name, costFn(c.skill),
          { disabled: !c.ok, why: c.why, title: c.skill.desc || '', amplify: (c.skill.tags || []).includes('amplify') });
        if (c.ok) btn.addEventListener('click', () => this.dispatchSkill(actor, c.skill, () => this.skillMenu(actor, list, title, costFn)));
      }
      this.menuButton('◂ Back', null, { back: true }).addEventListener('click', () => this.rootMenu(actor));
    }

    gaugeMenu(actor, cmds, gaugeSkills) {
      const g = actor.gauge;
      this.setMenu(`${actor.name} — ${g.label} ${Math.floor(g.value)}/100`);
      if (cmds.awaken) {
        const a = cmds.awaken;
        const btn = this.menuButton(`Awaken — ${a.def.name}`, `${a.def.cost}`,
          { disabled: !a.ok, why: a.why, title: a.def.desc });
        if (a.ok) btn.addEventListener('click', () => this._resolve({ type: 'awaken' }));
      }
      for (const c of gaugeSkills) {
        const cost = c.skill.gauge === 'full' ? '100' : String(c.skill.gauge);
        const btn = this.menuButton(c.skill.name, cost,
          { disabled: !c.ok, why: c.why, title: c.skill.desc || '', amplify: (c.skill.tags || []).includes('amplify') });
        if (c.ok) btn.addEventListener('click', () => this.dispatchSkill(actor, c.skill, () => this.gaugeMenu(actor, cmds, gaugeSkills)));
      }
      if (g.type === 'rage') {
        const note = document.createElement('p');
        note.className = 'cmd-note';
        note.textContent = 'Rage adds +0.5% damage per point — but at 100 she Seizes.';
        $('#command-menu').appendChild(note);
      }
      this.menuButton('◂ Back', null, { back: true }).addEventListener('click', () => this.rootMenu(actor));
    }

    attuneMenu(actor, elements) {
      this.setMenu(`${actor.name} — Attune to…`);
      for (const id of elements) {
        const el = WS.ELEMENTS[id];
        const btn = this.menuButton(`${el.icon} ${el.name}`, `weak to ${WS.ELEMENTS[el.opposite].name}`,
          { disabled: actor.attuned === id, why: 'Already attuned' });
        if (actor.attuned !== id) btn.addEventListener('click', () => this._resolve({ type: 'attune', element: id }));
      }
      this.menuButton('◂ Back', null, { back: true }).addEventListener('click', () => this.rootMenu(actor));
    }

    dispatchSkill(actor, skill, backFn) {
      if (skill.target === 'enemy' || skill.target === 'ally') this.pickTarget(actor, skill, backFn);
      else this._resolve({ type: 'skill', skillId: skill.id });
    }

    pickTarget(actor, skill, backFn, isCombo) {
      const action = (uid) => isCombo
        ? { type: 'combo', comboId: skill.id, targetUid: uid }
        : { type: 'skill', skillId: skill.id, targetUid: uid };
      const targets = this.battle.validTargets(actor, skill);
      if (targets.length === 1) {
        this._resolve(action(targets[0].uid));
        return;
      }
      this.setMenu(`${skill.name} — choose target`);
      this.menuButton('◂ Back', null, { back: true }).addEventListener('click', () => { this.clearTargeting(); backFn(); });
      this._targetHandlers = [];
      for (const t of targets) {
        const card = this.cards[t.uid];
        card.classList.add('targetable');
        const h = () => this._resolve(action(t.uid));
        card.addEventListener('click', h);
        this._targetHandlers.push([card, h]);
      }
    }

    clearTargeting() {
      for (const [card, h] of this._targetHandlers || []) {
        card.classList.remove('targetable');
        card.removeEventListener('click', h);
      }
      this._targetHandlers = [];
    }

    // ---------- end screen ----------
    showEnd(result, onRetry, onTitle) {
      const t = $('#end-text');
      t.textContent = result === 'victory' ? 'VICTORY' : 'WHAT SURVIVES…';
      t.className = result;
      $('#end-overlay').classList.remove('hidden');
      $('#retry-btn').onclick = onRetry;
      $('#title-btn').onclick = onTitle;
    }
  }

  WS.UI = UI;
})();
