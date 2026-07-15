// The overworld: a walkable, tile-based exploration scene. Mirrors the battle
// Stage (js/ui/stage.js) in shape — its own Phaser.Game, generated art, pure
// presentation that reads map data (js/data/maps.js) but knows nothing about
// battles. The controller (js/main.js) wires it: set `onTalk` / `onTrigger`,
// call `load(mapId)`, and drive overworld <-> battle transitions.
//
// Movement is grid-locked (one tile per step, tweened). Triggers fire either on
// entering a tile (doors, the sparring ring) or on facing + Enter (signs, NPCs).
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  const W = 960, H = 540;
  const TS = 40;                 // tile size in source pixels
  const STEP_MS = 130;           // per-tile move duration
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, g: c.getContext('2d') };
  }

  class Overworld {
    constructor() {
      this.game = null;
      this.scene = null;
      this.ready = false;
      this.map = null;
      this.player = null;
      this.npcSprites = [];
      this.decor = [];
      this.inputLocked = false;
      this.moving = false;
      this.dir = 'down';
      this.px = 0; this.py = 0;   // player tile
      this.prevTile = [0, 0];     // tile stepped from (for post-battle step-back)
      // callbacks the controller supplies
      this.onTalk = () => {};
      this.onTrigger = () => {};
    }

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
            key: 'overworld',
            create: function () {
              self.scene = this;
              WS.Sprites.ensureFxTextures(this);
              self._setupInput();
              self.scene.events.on('update', () => self._update());
              resolve();
            },
          },
        });
      });
      return this._readyP;
    }

    _setupInput() {
      const kb = this.scene.input.keyboard;
      this.cursors = kb.createCursorKeys();
      this.keys = kb.addKeys({
        W: 'W', A: 'A', S: 'S', D: 'D', ENTER: 'ENTER', SPACE: 'SPACE',
      });
    }

    // ---------- map loading ----------
    load(mapId, spawn) {
      const map = WS.MAPS[mapId];
      if (!map) throw new Error('unknown map: ' + mapId);
      const s = this.scene;
      for (const o of this.decor) o.destroy();
      this.decor = [];
      this.npcSprites.forEach((n) => n.destroy());
      this.npcSprites = [];
      if (this.player) { this.player.destroy(); this.player = null; }

      // parse grid -> tile names, note spawn from '@'
      const rows = map.grid;
      const gh = rows.length, gw = rows[0].length;
      this.mapId = mapId;
      this.map = map;
      this.gw = gw; this.gh = gh;
      this.tiles = [];
      let spawnTile = spawn || null;
      for (let y = 0; y < gh; y++) {
        this.tiles[y] = [];
        for (let x = 0; x < gw; x++) {
          const ch = rows[y][x];
          if (ch === '@') { this.tiles[y][x] = 'floor'; if (!spawnTile) spawnTile = [x, y]; }
          else this.tiles[y][x] = map.legend[ch] || 'floor';
        }
      }
      spawnTile = spawnTile || [1, 1];

      // occupancy: npc tiles block movement + carry the npc for interaction
      this.npcAt = {};
      for (const npc of (map.npcs || [])) this.npcAt[npc.x + ',' + npc.y] = npc;

      this._paintMap();
      this._placeNpcs();
      this._placePlayer(spawnTile[0], spawnTile[1], 'up');

      const cam = s.cameras.main;
      cam.setBounds(0, 0, gw * TS, gh * TS);
      cam.setZoom(1.35);
      cam.startFollow(this.player, true, 0.15, 0.15);

      this._hud(map.name);
      this.ready = true;
      this.inputLocked = false;
    }

    _paintMap() {
      const key = 'map_' + this.mapId;
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      const { c, g } = makeCanvas(this.gw * TS, this.gh * TS);
      for (let y = 0; y < this.gh; y++) {
        for (let x = 0; x < this.gw; x++) {
          this._paintTile(g, x, y, this.tiles[y][x]);
        }
      }
      this.scene.textures.addCanvas(key, c);
      const img = this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
      this.decor.push(img);

      // glow markers over interactive 'enter' targets (the sparring ring etc.)
      for (const t of (this.map.triggers || [])) {
        if (t.mode !== 'enter' || t.kind !== 'battle') continue;
        for (const [tx, ty] of t.tiles) {
          const glow = this.scene.add.image(tx * TS + TS / 2, ty * TS + TS / 2, 'fx_glow')
            .setScale(1.6).setTint(0xffd166).setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.35).setDepth(1);
          this.scene.tweens.add({ targets: glow, alpha: 0.7, scale: 2.0, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          this.decor.push(glow);
        }
      }
    }

    _paintTile(g, x, y, kind) {
      const d = WS.TILEDEFS[kind] || WS.TILEDEFS.floor;
      const ox = x * TS, oy = y * TS;
      g.fillStyle = d.color; g.fillRect(ox, oy, TS, TS);
      if (kind === 'wall') {
        g.fillStyle = d.top; g.fillRect(ox, oy, TS, Math.round(TS * 0.32));
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(ox, oy + TS - 4, TS, 4);
      } else {
        // subtle tiling grid
        g.strokeStyle = d.edge; g.lineWidth = 1;
        g.strokeRect(ox + 0.5, oy + 0.5, TS - 1, TS - 1);
      }
      const cx = ox + TS / 2, cy = oy + TS / 2;
      if (d.paint === 'tree') {
        g.fillStyle = '#2b1c12'; g.fillRect(cx - 3, oy + TS - 14, 6, 12);      // trunk
        g.fillStyle = '#20402c'; g.beginPath(); g.arc(cx, oy + TS * 0.42, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2c5238'; g.beginPath(); g.arc(cx - 4, oy + TS * 0.36, 9, 0, Math.PI * 2); g.fill();
      } else if (d.paint === 'water') {
        g.fillStyle = '#0f2a3e'; g.fillRect(ox + 3, oy + 3, TS - 6, TS - 6);
        g.fillStyle = 'rgba(150,200,235,0.18)'; g.fillRect(ox + 6, oy + 7, TS - 12, 3);
        g.fillStyle = 'rgba(150,200,235,0.10)'; g.fillRect(ox + 9, oy + 15, TS - 18, 2);
      } else if (d.paint === 'door') {
        g.fillStyle = '#241811'; g.fillRect(ox + 6, oy + 4, TS - 12, TS - 8);
        g.fillStyle = '#4a3623'; g.fillRect(ox + 8, oy + 6, TS - 16, TS - 12);
        g.fillStyle = '#ffd166'; g.fillRect(cx + 4, cy, 3, 3);                 // knob
      } else if (d.paint === 'ring') {
        g.strokeStyle = 'rgba(255,209,102,0.35)'; g.lineWidth = 2;
        g.strokeRect(ox + 3, oy + 3, TS - 6, TS - 6);
      }
    }

    _makeSprite(defId, wx, wy, dir) {
      const s = this.scene;
      const { key, w, h } = WS.Sprites.ensureBattlerTexture(s, defId);
      const scale = TS / h * 1.05;            // ~one tile tall, feet-anchored
      const spr = s.add.sprite(wx, wy, key, 'f0').setOrigin(0.5, 1).setScale(scale);
      if (dir === 'left') spr.setFlipX(true);
      spr.setDepth(Math.round(wy));
      return spr;
    }

    _placeNpcs() {
      for (const npc of (this.map.npcs || [])) {
        const spr = this._makeSprite(npc.sprite, npc.x * TS + TS / 2, npc.y * TS + TS - 2, npc.dir);
        spr._npc = npc;
        this.npcSprites.push(spr);
      }
    }

    _placePlayer(tx, ty, dir) {
      this.px = tx; this.py = ty; this.dir = dir || this.dir;
      const wx = tx * TS + TS / 2, wy = ty * TS + TS - 2;
      if (!this.player) {
        this.player = this._makeSprite('siren', wx, wy, this.dir);
      } else {
        this.player.setPosition(wx, wy).setDepth(Math.round(wy));
        this.player.setFlipX(this.dir === 'left');
      }
    }

    // controller helper: drop the player back onto a tile (e.g. after a battle)
    placePlayer(tile, dir) { if (this.ready) this._placePlayer(tile[0], tile[1], dir); }

    _hud(name) {
      // location name + controls live in the DOM (project convention: canvas is
      // battlers/tiles only, overlays are DOM) — and it sidesteps camera-zoom
      // pushing screen-fixed Phaser text off the corner.
      const nameEl = document.querySelector('#ow-name');
      if (nameEl) nameEl.textContent = name;
      // the "▸ Enter" prompt is world-space (follows the faced tile), so it
      // stays on the canvas.
      if (this._prompt) this._prompt.destroy();
      this._prompt = this.scene.add.text(0, 0, '▸ Enter', {
        fontFamily: '"Segoe UI", sans-serif', fontSize: '13px', color: '#ffd166',
        stroke: '#0b0e14', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(9999).setVisible(false);
    }

    // ---------- walkability & interaction targets ----------
    _tileKind(x, y) {
      if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return 'wall';
      return this.tiles[y][x];
    }
    _walkable(x, y) {
      const d = WS.TILEDEFS[this._tileKind(x, y)];
      if (!d || d.solid) return false;
      return !this.npcAt[x + ',' + y];
    }
    _npcFront() {
      const [dx, dy] = DIRV[this.dir];
      return this.npcAt[(this.px + dx) + ',' + (this.py + dy)] || null;
    }
    _interactTriggerFront() {
      const [dx, dy] = DIRV[this.dir];
      const fx = this.px + dx, fy = this.py + dy;
      return (this.map.triggers || []).find(
        (t) => t.mode === 'interact' && t.tiles.some(([x, y]) => x === fx && y === fy)
      ) || null;
    }
    _enterTrigger(x, y) {
      return (this.map.triggers || []).find(
        (t) => t.mode === 'enter' && t.tiles.some(([tx, ty]) => tx === x && ty === y)
      ) || null;
    }

    // ---------- per-frame ----------
    _update() {
      if (!this.ready || this.inputLocked || this.moving) { this._syncPrompt(); return; }
      if (WS.dialogueActive && WS.dialogueActive()) return;

      // interaction press
      const interact = Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
        || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
      if (interact) {
        const npc = this._npcFront();
        if (npc) { this.onTalk(npc); return; }
        const trig = this._interactTriggerFront();
        if (trig) { this.onTrigger(trig); return; }
      }

      // movement
      const c = this.cursors, k = this.keys;
      let dir = null;
      if (c.left.isDown || k.A.isDown) dir = 'left';
      else if (c.right.isDown || k.D.isDown) dir = 'right';
      else if (c.up.isDown || k.W.isDown) dir = 'up';
      else if (c.down.isDown || k.S.isDown) dir = 'down';
      this._syncPrompt();
      if (!dir) return;

      this.dir = dir;
      if (dir === 'left' || dir === 'right') this.player.setFlipX(dir === 'left');
      const [dx, dy] = DIRV[dir];
      const nx = this.px + dx, ny = this.py + dy;
      if (this._walkable(nx, ny)) this._step(nx, ny);
    }

    _step(nx, ny) {
      this.moving = true;
      this.prevTile = [this.px, this.py];
      const wx = nx * TS + TS / 2, wy = ny * TS + TS - 2;
      this.scene.tweens.add({
        targets: this.player, x: wx, y: wy, duration: STEP_MS, ease: 'Linear',
        onUpdate: () => this.player.setDepth(Math.round(this.player.y)),
        onComplete: () => {
          this.px = nx; this.py = ny; this.moving = false;
          const trig = this._enterTrigger(nx, ny);
          if (trig) this.onTrigger(trig);
        },
      });
    }

    _syncPrompt() {
      if (!this._prompt) return;
      if (this.moving || this.inputLocked || (WS.dialogueActive && WS.dialogueActive())) {
        this._prompt.setVisible(false); return;
      }
      const target = this._npcFront() || this._interactTriggerFront();
      if (target) {
        const [dx, dy] = DIRV[this.dir];
        const tx = (this.px + dx) * TS + TS / 2, ty = (this.py + dy) * TS;
        this._prompt.setPosition(tx, ty - 6).setVisible(true);
      } else this._prompt.setVisible(false);
    }

    // ---------- controller lifecycle ----------
    freeze() { this.inputLocked = true; }
    unfreeze() { this.inputLocked = false; }
    sleep() {
      if (this.game) this.game.loop.sleep();
      if (this.scene) this.scene.input.keyboard.enabled = false;
    }
    wake() {
      if (this.game) this.game.loop.wake();
      if (this.scene) {
        this.scene.input.keyboard.enabled = true;
        this.scene.scale.refresh();   // re-fit after the screen was display:none
      }
    }
  }

  WS.Overworld = Overworld;
})();
