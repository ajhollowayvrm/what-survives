// The Phaser stage: renders battlers on painted backdrops and performs the
// loudness ladder (art_direction §6). Pure presentation — it reads battle
// state but never mutates it. The DOM keeps menus, cards, log, and overlays.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  const W = 960, H = 540;
  const COLORS = { gold: 0xffd166, blood: 0xe3405f, white: 0xffffff, cyan: 0x8fd0f0, heal: 0x59c96a, freeze: 0x9fd0ff, seal: 0x9b5de5 };

  function elColor(el) {
    return el && WS.ELEMENTS[el] ? parseInt(WS.ELEMENTS[el].color.slice(1), 16) : 0xffffff;
  }

  class Stage {
    constructor() {
      this.game = null;
      this.scene = null;
      this.battlers = {};
      this._objects = [];
      this._targetCb = null;
      this.speedFn = () => 1;
    }
    ms(base) { return Math.max(30, base / this.speedFn()); }

    init(parentId) {
      if (this._readyP) return this._readyP;
      const self = this;
      this._readyP = new Promise((resolve) => {
        self.game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: parentId,
          width: W, height: H,
          backgroundColor: '#0b0e14',
          pixelArt: true,
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: {
            key: 'battle',
            create: function () {
              self.scene = this;
              WS.Sprites.ensureFxTextures(this);
              resolve();
            },
          },
        });
      });
      return this._readyP;
    }

    // ---------- battle setup ----------
    setupBattle(battle, theme) {
      const s = this.scene;
      for (const o of this._objects) o.destroy();
      this._objects = [];
      this.battlers = {};
      this._targetCb = null;
      s.cameras.main.setZoom(1).setScroll(0, 0);

      const bg = s.add.image(W / 2, H / 2, WS.Sprites.ensureBackdropTexture(s, theme)).setDepth(0);
      this._objects.push(bg);

      const dust = s.add.particles(0, 0, 'fx_px', {
        x: { min: 40, max: W - 40 }, y: { min: 100, max: 470 },
        lifespan: 8000, quantity: 1, frequency: 700,
        speedY: { min: -8, max: -3 }, speedX: { min: -5, max: 5 },
        alpha: { start: 0.22, end: 0 }, scale: { start: 0.8, end: 0.4 },
        tint: 0xb9c8e0,
      }).setDepth(4);
      this._objects.push(dust);

      // full-screen dim used by the Amplify focus moment
      this._dim = s.add.rectangle(W / 2, H / 2, W, H, 0x04060a, 1).setAlpha(0).setDepth(900);
      this._objects.push(this._dim);

      const eSlots = this.enemyLayout(battle.enemies);
      battle.enemies.forEach((u, i) => this.makeBattler(u, eSlots[i][0], eSlots[i][1], 1));
      const pSlots = this.partyLayout(battle.party.length);
      battle.party.forEach((u, i) => this.makeBattler(u, pSlots[i][0], pSlots[i][1], -1));

      for (const u of [...battle.enemies, ...battle.party]) this.syncUnit(u, battle);
    }

    enemyLayout(units) {
      const wardenIdx = units.findIndex((u) => u.defId === 'aspect_warden');
      if (wardenIdx >= 0) {
        const escorts = [[398, 262], [402, 430], [318, 172]];
        let e = 0;
        return units.map((u, i) => (i === wardenIdx ? [222, 312] : escorts[e++] || [330, 200]));
      }
      const n = units.length;
      if (n === 1) return [[258, 330]];
      return units.map((_, i) => [272 - (i % 2) * 118, 232 + i * (202 / (n - 1))]);
    }
    partyLayout(n) {
      if (n === 1) return [[700, 330]];
      return Array.from({ length: n }, (_, i) => [686 + i * 32, 218 + i * (222 / (n - 1))]);
    }

    makeBattler(u, x, y, facing) {
      const s = this.scene;
      const { key, w, h, scale } = WS.Sprites.ensureBattlerTexture(s, u.defId);
      const animKey = 'idle_' + key;
      if (!s.anims.exists(animKey)) {
        s.anims.create({
          key: animKey, frameRate: 1.5, repeat: -1,
          frames: [{ key, frame: 'f0' }, { key, frame: 'f1' }],
        });
      }

      const dw = w * scale, dh = h * scale;
      const shadow = s.add.ellipse(0, dh / 2 - 3, dw * 0.62, 14, 0x04060a, 0.5);
      const aura = s.add.image(0, dh * 0.08, 'fx_glow')
        .setScale(dw / 14).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const spr = s.add.sprite(0, 0, key, 'f0').setScale(scale);
      spr.play({ key: animKey, startFrame: Math.random() < 0.5 ? 1 : 0 });
      if (facing < 0) spr.setFlipX(true);

      const cont = s.add.container(x, y, [shadow, aura, spr]);
      cont.setDepth(Math.round(y));
      const rec = {
        uid: u.uid, unit: u, cont, spr, aura, facing,
        home: { x, y }, dw, dh, dead: false,
      };

      // hover marker for the active actor
      rec.marker = s.add.triangle(0, -dh / 2 - 16, 0, 0, 12, 0, 6, 9, 0xffd166).setVisible(false);
      cont.add(rec.marker);
      s.tweens.add({ targets: rec.marker, y: -dh / 2 - 22, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // target ring
      rec.ring = s.add.ellipse(0, dh / 2 - 3, dw * 0.85, 26).setStrokeStyle(2.5, 0x3fa7d6).setVisible(false);
      cont.add(rec.ring);

      if (u.side === 'enemy') {
        const fy = dh / 2 + 6;
        rec.nameTxt = s.add.text(6, fy, u.name, {
          fontFamily: '"Segoe UI", sans-serif', fontSize: '12px', color: '#d7dfef',
          stroke: '#0b0e14', strokeThickness: 3,
        }).setOrigin(0.5, 0);
        rec.badge = s.add.rectangle(0, fy + 7, 8, 8, 0xffffff).setAngle(45);
        rec.hpG = s.add.graphics();
        rec.statusTxt = s.add.text(0, fy + 30, '', {
          fontFamily: '"Segoe UI", sans-serif', fontSize: '10px', color: '#cbaef5',
          stroke: '#0b0e14', strokeThickness: 2,
        }).setOrigin(0.5, 0);
        cont.add([rec.nameTxt, rec.badge, rec.hpG, rec.statusTxt]);
        rec.fy = fy;
      }

      if (u.defId === 'aspect_warden') {
        rec.core = s.add.image(0, -4 * scale, 'fx_glow')
          .setScale(0.9).setBlendMode(Phaser.BlendModes.ADD);
        cont.addAt(rec.core, cont.getIndex(spr) + 1);
      }
      if (u.defId === 'earl') {
        rec.gem = s.add.image(0, -dh / 2 - 8, 'fx_glow').setScale(0.5)
          .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        cont.add(rec.gem);
        s.tweens.add({ targets: rec.gem, y: -dh / 2 - 14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }

      // idle breath-bob on top of the 2-frame animation
      s.tweens.add({ targets: spr, y: -2, duration: 1300 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      cont.setSize(dw, dh + 10);
      cont.setInteractive({ useHandCursor: true });
      cont.on('pointerdown', () => { if (this._targetCb && rec.targetable) this._targetCb(u.uid); });
      cont.on('pointerover', () => { if (rec.targetable) rec.ring.setStrokeStyle(3.5, 0xd9f2ff); });
      cont.on('pointerout', () => { if (rec.targetable) rec.ring.setStrokeStyle(2.5, 0x3fa7d6); });
      cont.disableInteractive();

      this._objects.push(cont);
      this.battlers[u.uid] = rec;
      return rec;
    }

    // ---------- per-unit state sync (cheap; called after every event batch) ----------
    syncUnit(u, battle) {
      const rec = this.battlers[u.uid];
      if (!rec) return;

      if (u.side === 'enemy') {
        const pct = Math.max(0, u.hp / u.maxHp);
        rec.hpG.clear();
        rec.hpG.fillStyle(0x0a0d15, 1).fillRect(-32, rec.fy + 18, 64, 5);
        rec.hpG.fillStyle(pct > 0.5 ? 0x59c96a : pct > 0.25 ? 0xe0b13e : 0xe04d4d, 1)
          .fillRect(-32, rec.fy + 18, Math.round(64 * pct), 5);
        const el = battle.elementOf(u);
        rec.badge.fillColor = elColor(el);
        rec.badge.x = -rec.nameTxt.width / 2 - 6;
        rec.nameTxt.x = 6;
        const bits = u.statuses.filter((st) => st.id !== 'mark').map((st) => `${st.name}${st.turns < 90 ? ' ' + st.turns : ''}`);
        if (u.shield > 0) bits.unshift(`🛡${u.shield}`);
        rec.statusTxt.setText(bits.join(' · '));
        if (rec.core) rec.core.setTint(elColor(el));
      } else {
        const awakened = battle.hasStatus(u, 'awaken');
        const bloodrun = battle.hasStatus(u, 'bloodrun');
        rec.aura.setVisible(awakened || bloodrun);
        rec.aura.setTint(bloodrun ? COLORS.blood : COLORS.gold);
        rec.aura.setAlpha(bloodrun ? 0.5 : 0.4);
        if (bloodrun) rec.spr.setTint(0xffb0b8);
        else if (u.hp > 0) rec.spr.clearTint();
        if (rec.gem) {
          rec.gem.setVisible(!!u.attuned);
          if (u.attuned) rec.gem.setTint(elColor(u.attuned));
        }
      }

      if (u.hp <= 0 && !rec.dead) this.koFall(u.uid);          // safety net if an event was missed
      if (u.hp > 0 && rec.dead) {                              // fresh battle objects handle retry; this is for safety
        rec.dead = false;
        rec.cont.setVisible(true).setAlpha(1);
        rec.spr.setAngle(0).clearTint();
      }
    }

    // ---------- the loudness ladder ----------
    lunge(uid) {
      const rec = this.battlers[uid];
      if (!rec || rec.dead) return;
      this.scene.tweens.add({
        targets: rec.cont, x: rec.home.x + 46 * rec.facing * -1,
        duration: this.ms(120), yoyo: true, hold: this.ms(70), ease: 'Power2',
      });
    }

    burst(x, y, tint, big) {
      const s = this.scene;
      const e = s.add.particles(x, y, 'fx_px', {
        speed: { min: big ? 120 : 60, max: big ? 340 : 190 },
        lifespan: big ? 460 : 300, quantity: big ? 26 : 12,
        scale: { start: big ? 1.8 : 1.3, end: 0 }, tint, emitting: false,
      }).setDepth(800);
      e.explode(big ? 26 : 12);
      if (big) {
        const g = s.add.image(x, y, 'fx_glow').setScale(0.5).setTint(tint)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(799);
        s.tweens.add({ targets: g, scale: 5, alpha: 0, duration: this.ms(320), onComplete: () => g.destroy() });
      }
      s.time.delayedCall(700, () => e.destroy());
    }

    hitReact(uid, { crit, rupture, element } = {}) {
      const rec = this.battlers[uid];
      if (!rec) return;
      const tint = rupture ? elColor(element) : crit ? COLORS.gold : 0xdfe8f5;
      this.burst(rec.cont.x, rec.cont.y - rec.dh * 0.15, tint, !!rupture);
      rec.spr.setTintFill(0xffffff);
      this.scene.time.delayedCall(this.ms(80), () => { if (rec.unit.hp > 0 && !this.battlersBloodrun(rec)) rec.spr.clearTint(); });
      this.scene.tweens.add({
        targets: rec.cont, x: rec.home.x - 10 * rec.facing * -1,
        duration: this.ms(70), yoyo: true, ease: 'Power2',
        onComplete: () => { rec.cont.x = rec.home.x; },
      });
      if (rupture) { this.zoomPunch(); this.shake(true); }
      else if (crit) this.shake(false);
    }
    battlersBloodrun(rec) { return rec.spr.tintTopLeft === 0xffb0b8; }

    popup(uid, text, style) {
      const rec = this.battlers[uid];
      if (!rec) return;
      const P = {
        dmg: { size: 22, color: '#ffffff' }, crit: { size: 27, color: '#ffd166' },
        rupture: { size: 31, color: '#ff9d5c' }, resist: { size: 16, color: '#8a94a8' },
        heal: { size: 21, color: '#59c96a' }, absorb: { size: 15, color: '#8fd0f0' },
        tag: { size: 13, color: '#8fc7ff' },
      }[style || 'dmg'];
      // stagger consecutive popups so multi-hits and tags don't overprint
      rec.popN = ((rec.popN || 0) + 1) % 3;
      const lift = style === 'rupture' ? 30 : rec.popN * 17;
      const t = this.scene.add.text(
        rec.cont.x + (Math.random() * 26 - 13), rec.cont.y - rec.dh / 2 - 6 - lift, String(text),
        { fontFamily: '"Segoe UI", sans-serif', fontSize: P.size + 'px', fontStyle: 'bold', color: P.color, stroke: '#0b0e14', strokeThickness: 5 },
      ).setOrigin(0.5, 1).setDepth(850);
      this.scene.tweens.add({
        targets: t, y: t.y - 46, alpha: { value: 0, delay: this.ms(380), duration: this.ms(420) },
        duration: this.ms(820), ease: 'Power1', onComplete: () => t.destroy(),
      });
    }

    shake(strong) { this.scene.cameras.main.shake(strong ? 260 : 120, strong ? 0.011 : 0.004); }
    flash() { this.scene.cameras.main.flash(240, 255, 255, 255); }
    zoomPunch() {
      const cam = this.scene.cameras.main;
      cam.zoomTo(1.05, this.ms(90), 'Sine.easeInOut', true);
      this.scene.time.delayedCall(this.ms(150), () => cam.zoomTo(1, this.ms(160), 'Sine.easeInOut', true));
    }

    koFall(uid) {
      const rec = this.battlers[uid];
      if (!rec || rec.dead) return;
      rec.dead = true;
      rec.targetable = false;
      rec.ring.setVisible(false);
      rec.marker.setVisible(false);
      if (rec.unit.side === 'enemy') {
        this.scene.tweens.add({
          targets: rec.cont, alpha: 0, angle: 5, y: rec.home.y + 14,
          duration: this.ms(420), ease: 'Power2',
          onComplete: () => rec.cont.setVisible(false),
        });
      } else {
        rec.spr.setTint(0x4a505f);
        rec.aura.setVisible(false);
        this.scene.tweens.add({ targets: rec.spr, angle: -86 * rec.facing * -1, y: rec.dh / 4, duration: this.ms(380), ease: 'Power2' });
        rec.cont.setAlpha(0.8);
      }
    }

    healBurst(uid) {
      const rec = this.battlers[uid];
      if (!rec) return;
      const e = this.scene.add.particles(rec.cont.x, rec.cont.y + rec.dh / 3, 'fx_px', {
        speedY: { min: -90, max: -40 }, speedX: { min: -25, max: 25 },
        lifespan: 550, quantity: 10, scale: { start: 1.2, end: 0 }, tint: COLORS.heal, emitting: false,
      }).setDepth(800);
      e.explode(10);
      this.scene.time.delayedCall(700, () => e.destroy());
    }
    shieldShimmer(uid) {
      const rec = this.battlers[uid];
      if (!rec) return;
      const g = this.scene.add.image(rec.cont.x, rec.cont.y, 'fx_glow').setScale(rec.dw / 22)
        .setTint(COLORS.cyan).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setDepth(798);
      this.scene.tweens.add({ targets: g, alpha: 0, scale: g.scale * 1.5, duration: this.ms(420), onComplete: () => g.destroy() });
    }
    statusPulse(uid, kind) {
      const rec = this.battlers[uid];
      if (!rec) return;
      const tint = kind === 'freeze' ? COLORS.freeze : kind === 'seal' ? COLORS.seal : 0xb9a3e8;
      this.burst(rec.cont.x, rec.cont.y - rec.dh * 0.2, tint, false);
      rec.spr.setTint(tint);
      this.scene.time.delayedCall(this.ms(260), () => { if (rec.unit.hp > 0) rec.spr.clearTint(); });
    }
    attuneSwirl(uid, element) {
      const rec = this.battlers[uid];
      if (!rec) return;
      const tint = elColor(element);
      const e = this.scene.add.particles(rec.cont.x, rec.cont.y, 'fx_px', {
        speed: { min: 50, max: 130 }, lifespan: 600, quantity: 20,
        scale: { start: 1.5, end: 0 }, tint, emitting: false,
      }).setDepth(800);
      e.explode(20);
      this.scene.time.delayedCall(750, () => e.destroy());
    }
    awakenFlare(uid) {
      const rec = this.battlers[uid];
      if (!rec) return;
      this.burst(rec.cont.x, rec.cont.y, COLORS.gold, true);
    }
    aspectPulse(uid, element) {
      const rec = this.battlers[uid];
      if (!rec) return;
      this.burst(rec.cont.x, rec.cont.y - rec.dh * 0.1, elColor(element), true);
      if (rec.core) rec.core.setTint(elColor(element));
    }
    bloodrunFlare(uid) {
      const rec = this.battlers[uid];
      if (!rec) return;
      this.burst(rec.cont.x, rec.cont.y, COLORS.blood, true);
      this.shake(true);
    }

    // the Amplify focus moment: world dims, the battler steps into the light
    amplifyIn(uid) {
      const rec = this.battlers[uid];
      this.scene.tweens.add({ targets: this._dim, alpha: 0.62, duration: this.ms(240) });
      if (!rec) return;
      rec.cont.setDepth(950);
      this.scene.tweens.add({ targets: rec.cont, scale: 1.22, duration: this.ms(300), ease: 'Power2' });
      rec.aura.setVisible(true).setTint(COLORS.white).setAlpha(0.5);
    }
    amplifyOut(uid, battle) {
      const rec = this.battlers[uid];
      this.scene.tweens.add({ targets: this._dim, alpha: 0, duration: this.ms(200) });
      if (!rec) return;
      this.scene.tweens.add({
        targets: rec.cont, scale: 1, duration: this.ms(180),
        onComplete: () => rec.cont.setDepth(Math.round(rec.home.y)),
      });
      if (battle) this.syncUnit(rec.unit, battle);
      else rec.aura.setVisible(false);
      this.flash();
    }

    // ---------- active marker & targeting ----------
    setActive(uid) {
      for (const k of Object.keys(this.battlers)) this.battlers[k].marker.setVisible(false);
      if (uid && this.battlers[uid] && !this.battlers[uid].dead) this.battlers[uid].marker.setVisible(true);
    }

    setTargetable(uids, cb) {
      this.clearTargetable();
      this._targetCb = cb;
      for (const uid of uids) {
        const rec = this.battlers[uid];
        if (!rec || rec.dead) continue;
        rec.targetable = true;
        rec.ring.setVisible(true).setAlpha(0.5);
        rec.ringTween = this.scene.tweens.add({ targets: rec.ring, alpha: 1, duration: 420, yoyo: true, repeat: -1 });
        rec.cont.setInteractive({ useHandCursor: true });
      }
    }
    clearTargetable() {
      this._targetCb = null;
      for (const k of Object.keys(this.battlers)) {
        const rec = this.battlers[k];
        if (rec.ringTween) { rec.ringTween.stop(); rec.ringTween = null; }
        rec.targetable = false;
        rec.ring.setVisible(false);
        rec.cont.disableInteractive();
      }
    }
  }

  WS.Stage = Stage;
})();
