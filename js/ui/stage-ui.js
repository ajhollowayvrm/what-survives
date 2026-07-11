// StageUI: the Phaser-era presentation. Extends the classic DOM UI — command
// menus, party cards, log, and overlays are inherited unchanged — but battlers
// live on the WS.Stage canvas, and event playback drives stage effects + SFX.
// Pages that load this file get the staged battle; classic.html doesn't.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});
  const $ = (sel) => document.querySelector(sel);

  const CHAR_COLORS = {
    siren: '#3fa7d6', cinne: '#8ee06e', earl: '#c9b8ff', katarina: '#e8a33d', mael: '#4db6ac',
  };
  const GAUGE_COLORS = { resonance: '#3fa7d6', rage: '#e3405f', fervor: '#e8a33d', defiance: '#4db6ac' };
  const THEMES = {
    sparring: 'hall', gauntlet: 'hall', proctor: 'hall',
    retrieval: 'night', warden: 'vault', retinue: 'vault',
  };
  const DELAYS = {
    action: 280, damage: 340, rupture: 700, heal: 200, freeze: 300, attune: 500,
    awaken: 1100, amplify: 2100, combo: 1500, aspect: 1100, bloodrun: 1400, bloodrunEnd: 900,
    ko: 550, status: 120, end: 600,
  };

  class StageUI extends WS.UI {
    constructor() {
      super();
      this.stage = new WS.Stage();
      const mute = $('#mute-btn');
      if (mute) {
        const label = () => { mute.textContent = WS.SFX.muted ? '🔇' : '🔊'; };
        label();
        mute.addEventListener('click', () => { WS.SFX.muted = !WS.SFX.muted; label(); });
      }
    }

    // ---------- setup (party cards in the DOM; battlers on the stage) ----------
    async setup(battle, battleId) {
      this.battle = battle;
      this.events = [];
      this.cards = {};
      $('#log').innerHTML = '';
      $('#party-row').innerHTML = '';
      $('#end-overlay').classList.add('hidden');
      $('#cinematic').classList.add('hidden');
      $('#banner').classList.add('hidden');

      await this.stage.init('battlefield');
      this.stage.speedFn = () => this.speed;
      this.stage.setupBattle(battle, THEMES[battleId] || 'hall');

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

    renderUnit(u) {
      super.renderUnit(u);
      if (this.stage.scene) this.stage.syncUnit(u, this.battle);
    }

    markActive(actor) {
      super.markActive(actor);
      if (this.stage.scene) this.stage.setActive(actor ? actor.uid : null);
    }

    // menu clicks get audible feedback
    menuButton(label, cost, opts = {}) {
      const btn = super.menuButton(label, cost, opts);
      if (!opts.disabled) btn.addEventListener('click', () => WS.SFX.play(opts.back ? 'back' : 'confirm'));
      return btn;
    }

    // enemy targeting happens on the canvas; ally targeting keeps the cards
    pickTarget(actor, skill, backFn, isCombo) {
      const action = (uid) => isCombo
        ? { type: 'combo', comboId: skill.id, targetUid: uid }
        : { type: 'skill', skillId: skill.id, targetUid: uid };
      const targets = this.battle.validTargets(actor, skill);
      if (targets.length === 1) { this._resolve(action(targets[0].uid)); return; }
      if (targets.length && targets[0].side === 'enemy') {
        this.setMenu(`${skill.name} — choose target`);
        this.menuButton('◂ Back', null, { back: true })
          .addEventListener('click', () => { this.stage.clearTargetable(); backFn(); });
        this.stage.setTargetable(targets.map((t) => t.uid), (uid) => this._resolve(action(uid)));
        return;
      }
      super.pickTarget(actor, skill, backFn, isCombo);
    }

    clearTargeting() {
      super.clearTargeting();
      if (this.stage.scene) this.stage.clearTargetable();
    }

    // ---------- event playback: the loudness ladder, conducted ----------
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
            this.stage.lunge(e.uid);
            await this.sleep(DELAYS.action);
            break;
          case 'damage': {
            if (e.rupture) {
              WS.SFX.play('rupture');
              this.stage.popup(e.uid, 'RUPTURE!', 'rupture');
            } else {
              WS.SFX.play(e.crit ? 'crit' : e.resist ? 'resist' : 'hit');
            }
            this.stage.hitReact(e.uid, { crit: e.crit, rupture: e.rupture, element: e.element });
            this.stage.popup(e.uid, e.amount, e.rupture || e.crit ? 'crit' : e.resist ? 'resist' : 'dmg');
            if (e.absorbed) this.stage.popup(e.uid, `-${e.absorbed}`, 'absorb');
            this.renderUnit(u);
            await this.sleep(e.rupture ? DELAYS.rupture : DELAYS.damage);
            break;
          }
          case 'heal':
            WS.SFX.play('heal');
            this.stage.healBurst(e.uid);
            this.stage.popup(e.uid, '+' + e.amount, 'heal');
            this.renderUnit(u);
            await this.sleep(DELAYS.heal);
            break;
          case 'shield':
            this.stage.shieldShimmer(e.uid);
            this.renderUnit(u);
            break;
          case 'gauge': case 'mp': case 'statusEnd':
            this.renderUnit(u);
            break;
          case 'status': {
            if (e.id === 'seal') { WS.SFX.play('seal'); this.stage.statusPulse(e.uid, 'seal'); }
            else if (e.id === 'leaden' || e.id === 'grd_down') { WS.SFX.play('seal'); this.stage.statusPulse(e.uid, 'debuff'); }
            else if (e.id === 'guard_up' || e.id === 'unbound' || e.id === 'guarded' || e.id === 'vow') WS.SFX.play('buff');
            this.renderUnit(u);
            break;
          }
          case 'freeze':
            WS.SFX.play('freeze');
            this.stage.statusPulse(e.uid, 'freeze');
            this.stage.popup(e.uid, 'STAGGERED', 'tag');
            this.renderQueue();
            await this.sleep(DELAYS.freeze);
            break;
          case 'attune':
            WS.SFX.play('attune');
            this.stage.attuneSwirl(e.uid, e.element);
            this.renderUnit(u);
            await this.sleep(DELAYS.attune);
            break;
          case 'awaken':
            WS.SFX.play('awaken');
            this.stage.awakenFlare(e.uid);
            this.banner(`${u.name} — ${e.name}`, 'gold', 'AWAKENED');
            this.renderUnit(u);
            await this.sleep(DELAYS.awaken);
            break;
          case 'amplify': {
            WS.SFX.play('amplify');
            this.stage.amplifyIn(e.uid);
            $('#cin-name').textContent = `${u.name} — ${e.name}`;
            $('#cin-cue').textContent = e.cue ? `“${e.cue}”` : e.name;
            $('#cinematic').classList.remove('hidden');
            await this.sleep(DELAYS.amplify);
            $('#cinematic').classList.add('hidden');
            this.stage.amplifyOut(e.uid, this.battle);
            break;
          }
          case 'combo': {
            WS.SFX.play('combo');
            $('#cin-name').textContent = e.name;
            $('#cin-cue').textContent = e.cue || e.name;
            $('#cinematic').classList.remove('hidden');
            await this.sleep(DELAYS.combo);
            $('#cinematic').classList.add('hidden');
            this.stage.flash();
            break;
          }
          case 'aspect': {
            WS.SFX.play('aspect');
            const el = WS.ELEMENTS[e.element];
            this.stage.aspectPulse(e.uid, e.element);
            this.banner(`ASPECT SHIFT — ${el.icon} ${el.name.toUpperCase()}`, 'aspect-b',
              `now weak to ${WS.ELEMENTS[el.opposite].name}`);
            this.renderUnit(u);
            this.renderQueue();
            await this.sleep(DELAYS.aspect);
            break;
          }
          case 'bloodrun':
            WS.SFX.play('bloodrun');
            this.stage.bloodrunFlare(e.uid);
            this.banner(`${u.name} — BLOODRUN`, 'blood', 'she is beyond reach');
            this.renderUnit(u);
            await this.sleep(DELAYS.bloodrun);
            break;
          case 'bloodrunEnd':
            this.renderUnit(u);
            await this.sleep(DELAYS.bloodrunEnd);
            break;
          case 'ko':
            WS.SFX.play('ko');
            this.stage.koFall(e.uid);
            this.renderUnit(u);
            await this.sleep(DELAYS.ko);
            break;
          case 'end':
            WS.SFX.play(e.result === 'victory' ? 'victory' : 'defeat');
            await this.sleep(DELAYS.end);
            break;
        }
      }
    }
  }

  WS.StageUI = StageUI;
})();
