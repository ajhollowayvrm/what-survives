// Generated placeholder battlers & backdrops (art_direction_v0.1.md).
// Everything is painted onto canvas textures at runtime, keyed by defId, so
// commissioned sprite sheets can later replace them with zero engine changes.
// Battlers are drawn FACING RIGHT at native pixel size; the stage scales them
// up (nearest-neighbor) and flips the party to face left.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const px = (x, y, pw, ph, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(pw), Math.round(ph)); };
    return { c, g, px };
  }

  // ---------- shared humanoid painter (40×48, feet on y≈46) ----------
  // b = breath frame (0|1). o = palette + build + weapon/hair hooks.
  function human(px, b, o) {
    const dy = (o.dy || 0) + b;      // dy>0 = shorter figure; b = breathing
    const tw = o.torsoW || 14;
    const tx = 20 - Math.floor(tw / 2);
    const coatD = o.coatDark || shade(o.coat, -18);
    const skinD = shade(o.skin, -22);

    // legs & boots (feet stay planted — breathing moves only the upper body)
    px(16, 36 + (o.dy || 0), 4, 8 - (o.dy || 0), o.pants);
    px(21, 36 + (o.dy || 0), 4, 8 - (o.dy || 0), shade(o.pants, -12));
    px(15, 44, 5, 2, o.boots);
    px(21, 44, 5, 2, shade(o.boots, -10));

    if (o.behind) o.behind(px, dy);  // hair tails, cloaks — drawn behind torso

    // torso + trim
    px(tx, 22 + dy, tw, 14, o.coat);
    px(tx, 22 + dy, 3, 14, coatD);
    if (o.trim) { px(tx, 34 + dy, tw, 1, o.trim); px(18, 21 + dy, 5, 1, o.trim); }
    px(tx, 32 + dy, tw, 2, o.belt || '#12161f');

    // arms (far arm darker)
    px(tx - 3, 23 + dy, 4, 10, coatD);
    px(tx + tw - 1, 23 + dy, 4, 10, o.coat);
    px(tx + tw, 31 + dy, 3, 3, o.skin); // near hand

    // head
    px(15, 12 + dy, 9, 9, o.skin);
    px(15, 19 + dy, 9, 2, skinD);
    if (o.hair) o.hair(px, dy);
    px(21, 15 + dy, 2, 2, '#eaf1ff');   // eye, facing right
    if (o.face) o.face(px, dy);

    // rim light on the lit (right) side — identity color on a cold body
    px(tx + tw + 2, 23 + dy, 1, 8, o.rim);
    px(23, 12 + dy, 1, 6, o.rim);

    if (o.weapon) o.weapon(px, dy);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    const r = f(n >> 16), gg = f((n >> 8) & 255), bb = f(n & 255);
    return '#' + ((r << 16) | (gg << 8) | bb).toString(16).padStart(6, '0');
  }

  // ---------- party ----------
  const UNIFORM = { pants: '#1a2233', boots: '#12161f', trim: '#8a7434' };

  const PARTY_PAINTERS = {
    siren: (px, b) => human(px, b, {
      ...UNIFORM, skin: '#d9a066', coat: '#26354f', rim: '#3fa7d6', belt: '#274b5e',
      hair: (p, dy) => { p(14, 10 + dy, 10, 4, '#1d2735'); p(15, 9 + dy, 2, 2, '#1d2735'); p(19, 8 + dy, 2, 2, '#1d2735'); p(22, 9 + dy, 2, 2, '#1d2735'); },
      weapon: (p, dy) => { // Hymerdom — gauntlet-blade wrapping the right arm
        p(26, 22 + dy, 6, 12, '#274b5e');
        p(27, 24 + dy, 4, 1, '#12161f'); p(27, 28 + dy, 4, 1, '#12161f'); // segments
        p(31, 22 + dy, 1, 12, '#3fa7d6');
        p(29, 8 + dy, 2, 15, '#9fd8ef'); p(30, 8 + dy, 1, 15, '#d9f2ff');
      },
    }),
    cinne: (px, b) => human(px, b, {
      ...UNIFORM, skin: '#e8c090', coat: '#212b38', rim: '#8ee06e', torsoW: 12, belt: '#2c3b2e',
      behind: (p, dy) => { p(10, 13 + dy, 3, 10, '#3c2317'); }, // ponytail
      hair: (p, dy) => { p(14, 10 + dy, 10, 3, '#4a2c1e'); p(12, 11 + dy, 3, 3, '#4a2c1e'); p(12, 13 + dy, 2, 1, '#8ee06e'); },
      face: (p, dy) => { p(17, 22 + dy, 6, 2, '#8ee06e'); }, // gale scarf
      weapon: (p, dy) => { // Fleshound — a dagger in each hand
        p(30, 26 + dy, 2, 8, '#cfe3d0'); p(30, 26 + dy, 1, 2, '#eafff0');
        p(9, 26 + dy, 2, 8, '#9fb3a0');
      },
    }),
    earl: (px, b) => human(px, b, {
      ...UNIFORM, skin: '#e8c090', coat: '#463f6b', rim: '#c9b8ff', dy: 4, torsoW: 12, trim: '#c9b8ff',
      hair: (p, dy) => { p(13, 9 + dy, 11, 5, '#cbb98e'); p(12, 11 + dy, 2, 3, '#cbb98e'); p(24, 11 + dy, 1, 3, '#cbb98e'); },
      weapon: (p, dy) => { p(30, 23 + dy, 1, 10, '#e8e4f5'); p(30, 21 + dy, 1, 3, '#9b5de5'); }, // the [Quill]
    }),
    katarina: (px, b) => human(px, b, {
      skin: '#b97a50', coat: '#5a4632', rim: '#e8a33d', dy: -3, torsoW: 16,
      pants: '#3c2f22', boots: '#241c12', belt: '#7a6248',
      behind: (p, dy) => { p(11, 11 + dy, 2, 12, '#2a1f1a'); p(11, 15 + dy, 2, 1, '#e8a33d'); p(11, 19 + dy, 2, 1, '#e8a33d'); }, // braid
      hair: (p, dy) => { p(14, 8 + dy, 10, 4, '#2a1f1a'); },
      face: (p, dy) => { p(16, 16 + dy, 7, 1, '#e8a33d'); }, // paint stripe
      weapon: (p, dy) => { // Staff of Nagandahl — totem head, teal feather
        p(32, 10 + dy, 2, 36 - dy, '#6b4b2e');
        p(29, 5 + dy, 8, 7, '#8a6a3c');
        p(30, 7 + dy, 2, 2, '#3fa7d6'); p(34, 7 + dy, 2, 2, '#3fa7d6');
        p(28, 2 + dy, 2, 6, '#4db6ac');
      },
      hairExtra: null,
      // fur mantle over the shoulders
      face2: null,
    }),
    mael: (px, b) => human(px, b, {
      ...UNIFORM, skin: '#c78d5a', coat: '#23413f', rim: '#4db6ac', torsoW: 16, belt: '#1a2f2d',
      hair: (p, dy) => { p(14, 9 + dy, 11, 5, '#1d2735'); p(13, 12 + dy, 2, 3, '#1d2735'); },
      weapon: (p, dy) => { // Heanmetal — chain across the chest to a blade
        [[14, 33], [17, 31], [20, 29], [23, 27], [26, 25]].forEach(([cx, cy]) => p(cx, cy + dy, 1, 1, '#9fb2b0'));
        p(29, 25 + dy, 3, 11, '#bfd8d2'); p(31, 25 + dy, 1, 11, '#e8f4f0');
        p(28, 36 + dy, 1, 2, '#9fb2b0'); p(29, 39 + dy, 1, 2, '#9fb2b0');
      },
    }),
  };

  // Katariña's mantle needs to draw over the torso — patch her painter
  const katBase = PARTY_PAINTERS.katarina;
  PARTY_PAINTERS.katarina = (px, b) => {
    katBase(px, b);
    const dy = -3 + b;
    px(11, 21 + dy, 18, 4, '#7a6248'); // fur mantle
    px(11, 21 + dy, 18, 1, '#8f7659');
  };

  // ---------- enemies ----------
  function construct(px, b, o) {
    const core = o.core;
    px(10, 40, 24, 6, '#171d2b');                       // treads
    px(12, 42, 2, 2, '#0b0e14'); px(20, 42, 2, 2, '#0b0e14'); px(28, 42, 2, 2, '#0b0e14');
    if (o.heavy) { px(4, 20, 5, 18, '#1e2536'); px(35, 20, 5, 18, '#1e2536'); } // side plates
    px(8, 16 - b, 28, 24 + b, '#232c42');               // torso
    px(8, 16 - b, 28, 1, '#8a7434');                    // gilt inlay (rank)
    px(8, 24, 28, 1, '#171d2b'); px(8, 32, 28, 1, '#171d2b');
    px(4, 18 - b, 4, 13, '#1a2233'); px(36, 18 - b, 4, 13, '#1a2233'); // piston arms
    px(3, 30, 6, 5, '#2b3650'); px(35, 30, 6, 5, '#2b3650');           // fists
    px(14, 8 - b, 16, 8, '#2b3650');                    // head
    px(16, 11 - b, 12, 2, core);                        // visor
    if (o.rotor) { px(12, 2 - b, 20, 2, '#3a4763'); px(21, 0 - b, 2, 6, '#3a4763'); }
    px(19, 23 - b, 6, 6, core);                         // the borrowed light
    px(18, 22 - b, 8, 1, core + '66'); px(18, 29 - b, 8, 1, core + '66');
  }

  function shard(px, b, o) {
    const rows = [[2, 8], [6, 11], [10, 14], [14, 17], [16, 20], [16, 24], [14, 28], [10, 32], [6, 36], [3, 39]];
    for (const [w, y] of rows) {
      const x = 20 - w / 2;
      px(x, y, w / 2, 3, shade(o.color, -30));
      px(x + w / 2, y, w / 2, 3, o.color);
    }
    px(18, 20, 4, 5, '#eaf1ff');                        // inner light
    px(5, 14 + b, 3, 5, shade(o.color, -15));           // satellites
    px(33, 22 - b, 3, 5, shade(o.color, -15));
  }

  function hound(px, b, o) {
    [[3, 25]].forEach(() => {});
    px(8, 16 - b, 3, 3, '#9fb2b0'); px(5, 19 - b, 2, 3, '#9fb2b0'); px(3, 23, 2, 3, '#9fb2b0'); // chain tail
    px(10, 14 - b, 26, 10, '#232c42');                  // body
    px(10, 14 - b, 26, 2, '#2b3650');
    px(32, 8 - b, 12, 9, '#2b3650');                    // head
    px(36, 15 - b, 8, 3, '#1a2233');                    // jaw
    px(40, 10 - b, 2, 2, '#ff5a5a');                    // eye
    px(20, 17 - b, 4, 4, o.core);                       // flank core
    px(12, 24, 4, 8, '#1a2233'); px(20, 24, 4, 8, '#171d2b');
    px(28, 24, 4, 8, '#1a2233'); px(34, 24, 4, 8, '#171d2b');
  }

  const ENEMY_PAINTERS = {
    sparring_construct: (px, b) => construct(px, b, { core: '#ff6b3d' }),
    stoneline_construct: (px, b) => construct(px, b, { core: '#c2a878', heavy: true }),
    galeline_construct: (px, b) => construct(px, b, { core: '#8ee06e', rotor: true }),
    tidebound_shard: (px, b) => shard(px, b, { color: '#3fa7d6' }),
    stonebound_shard: (px, b) => shard(px, b, { color: '#c2a878' }),
    chainhound_construct: (px, b) => hound(px, b, { core: '#c2a878' }),
    academy_proctor: (px, b) => human(px, b, {
      skin: '#e8c090', coat: '#4a4436', rim: '#ffd166', trim: '#ffd166',
      pants: '#2e2a20', boots: '#1c1913', torsoW: 14,
      hair: (p, dy) => { p(14, 10 + dy, 11, 3, '#3a3450'); p(13, 12 + dy, 2, 8, '#3a3450'); }, // hood
      face: (p, dy) => { p(14, 5 + dy, 11, 1, '#ffd166'); }, // thin halo sigil
      weapon: (p, dy) => { p(30, 18 + dy, 2, 16, '#ffe9b0'); p(31, 18 + dy, 1, 16, '#fff6dd'); },
    }),
    bind_sergeant: (px, b) => human(px, b, {
      skin: '#c78d5a', coat: '#402a28', rim: '#ff6b3d', trim: '#8a7434',
      pants: '#241a19', boots: '#15100f', torsoW: 16, belt: '#5c3a2e',
      hair: (p, dy) => { p(14, 9 + dy, 11, 4, '#26170f'); },
      weapon: (p, dy) => { // iron writ-club + the suppression collar at his belt
        p(30, 20 + dy, 3, 14, '#5c6a80'); p(32, 20 + dy, 1, 14, '#8a99b0');
        p(10, 33 + dy, 5, 5, '#402a28');
        p(10, 33 + dy, 5, 1, '#9fb2b0'); p(10, 37 + dy, 5, 1, '#9fb2b0');
        p(10, 33 + dy, 1, 5, '#9fb2b0'); p(14, 33 + dy, 1, 5, '#9fb2b0');
      },
    }),
    bindwright: (px, b) => human(px, b, {
      skin: '#d9c4a8', coat: '#2a2338', rim: '#ffd166', trim: '#9b5de5',
      pants: '#1d1828', boots: '#131019', torsoW: 14,
      hair: (p, dy) => { p(13, 9 + dy, 12, 4, '#1d1828'); p(13, 12 + dy, 2, 7, '#1d1828'); p(24, 12 + dy, 2, 7, '#1d1828'); }, // deep hood
      weapon: (p, dy) => { // censer on a chain
        p(29, 24 + dy, 1, 2, '#9fb2b0'); p(30, 27 + dy, 1, 2, '#9fb2b0'); p(31, 30 + dy, 1, 2, '#9fb2b0');
        p(29, 32 + dy, 5, 5, '#8a7434'); p(30, 33 + dy, 3, 3, '#ffd166');
      },
    }),
  };

  // the Warden is bespoke: a monolith whose eye is a separate, re-tintable core
  function paintWarden(px, g, b) {
    px(16, 76, 40, 6, '#171d2b');                       // hover skirt shadow
    px(20, 20 - b, 32, 56, '#1e2536');                  // monolith
    px(24, 12 - b, 24, 8, '#232c42');                   // crown
    px(20, 20 - b, 32, 1, '#8a7434');
    px(35, 54 - b, 2, 20, '#8a7434');                   // inlay
    px(6, 26 + b, 10, 22, '#232c42'); px(6, 26 + b, 10, 1, '#8a7434');   // floating plates
    px(56, 26 - b, 10, 22, '#232c42'); px(56, 26 - b, 10, 1, '#8a7434');
    g.strokeStyle = '#8a7434'; g.lineWidth = 3;
    g.beginPath(); g.arc(36, 40 - b, 13, 0, Math.PI * 2); g.stroke();    // eye socket ring
    g.fillStyle = '#0b0e14';
    g.beginPath(); g.arc(36, 40 - b, 11, 0, Math.PI * 2); g.fill();
  }

  const SIZES = {
    party: { w: 40, h: 48, scale: 2.9 },
    construct: { w: 44, h: 48, scale: 2.6 },
    shard: { w: 40, h: 48, scale: 2.4 },
    hound: { w: 48, h: 36, scale: 2.5 },
    humanoid: { w: 40, h: 48, scale: 2.8 },
    warden: { w: 72, h: 88, scale: 2.7 },
  };
  function sizeFor(defId) {
    if (PARTY_PAINTERS[defId]) return SIZES.party;
    if (defId === 'aspect_warden') return SIZES.warden;
    if (defId.includes('shard')) return SIZES.shard;
    if (defId.includes('hound')) return SIZES.hound;
    if (defId.includes('construct')) return SIZES.construct;
    return SIZES.humanoid;
  }

  // ---------- texture assembly ----------
  function ensureBattlerTexture(scene, defId) {
    const key = 'battler_' + defId;
    const size = sizeFor(defId);
    if (scene.textures.exists(key)) return { key, ...size };

    const { c, g, px } = makeCanvas(size.w * 2, size.h);
    for (let b = 0; b <= 1; b++) {
      g.save();
      g.translate(b * size.w, 0); // px() draws through g, so the translate covers both
      const painter = PARTY_PAINTERS[defId] || ENEMY_PAINTERS[defId];
      if (defId === 'aspect_warden') paintWarden(px, g, b);
      else if (painter) painter(px, b);
      else construct(px, b, { core: '#e3405f' }); // unknown enemy fallback
      g.restore();
    }
    const tex = scene.textures.addCanvas(key, c);
    tex.add('f0', 0, 0, 0, size.w, size.h);
    tex.add('f1', 0, size.w, 0, size.w, size.h);
    return { key, ...size };
  }

  // soft radial glow + tiny square, for particles/auras/the Warden's eye
  function ensureFxTextures(scene) {
    if (!scene.textures.exists('fx_glow')) {
      const { c, g } = makeCanvas(32, 32);
      const rg = g.createRadialGradient(16, 16, 1, 16, 16, 16);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
      scene.textures.addCanvas('fx_glow', c);
    }
    if (!scene.textures.exists('fx_px')) {
      const { c, px } = makeCanvas(3, 3);
      px(0, 0, 3, 3, '#ffffff');
      scene.textures.addCanvas('fx_px', c);
    }
  }

  // ---------- backdrops (960×540 painted panels) ----------
  function vignette(g, W, H) {
    const rg = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H / 2, W * 0.62);
    rg.addColorStop(0, 'rgba(5,7,12,0)');
    rg.addColorStop(1, 'rgba(5,7,12,0.6)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }

  const BACKDROPS = {
    hall(g, W, H) {
      let lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, '#131b2f'); lg.addColorStop(1, '#0b0e14');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#11182a'; g.fillRect(0, 370, W, H - 370);        // floor
      g.fillStyle = '#0d1220'; g.fillRect(0, 366, W, 4);
      for (const x of [150, 460, 770]) {                              // arched windows
        g.fillStyle = 'rgba(185,205,240,0.16)';
        g.fillRect(x, 90, 80, 170);
        g.beginPath(); g.arc(x + 40, 90, 40, Math.PI, 0); g.fill();
        g.fillStyle = '#0d1220'; g.fillRect(x + 38, 55, 4, 205);      // mullion
        g.fillStyle = 'rgba(185,205,240,0.045)';                      // god-ray
        g.beginPath();
        g.moveTo(x, 250); g.lineTo(x + 80, 250); g.lineTo(x + 150, 450); g.lineTo(x - 70, 450);
        g.closePath(); g.fill();
      }
      for (const x of [340, 650]) {                                   // gilt banners
        g.fillStyle = '#1a2233'; g.fillRect(x, 70, 26, 130);
        g.beginPath(); g.moveTo(x, 200); g.lineTo(x + 13, 216); g.lineTo(x + 26, 200); g.closePath(); g.fill();
        g.fillStyle = '#8a7434'; g.fillRect(x, 70, 26, 3); g.fillRect(x + 10, 125, 6, 6);
      }
      g.strokeStyle = '#232c42'; g.lineWidth = 3;                     // sparring circle
      g.beginPath(); g.ellipse(480, 468, 310, 54, 0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(480, 468, 180, 30, 0, 0, Math.PI * 2); g.stroke();
    },
    night(g, W, H) {
      let lg = g.createLinearGradient(0, 0, 0, 360);
      lg.addColorStop(0, '#04060c'); lg.addColorStop(1, '#0e1526');
      g.fillStyle = lg; g.fillRect(0, 0, W, 360);
      g.fillStyle = 'rgba(215,223,239,0.8)';
      for (let i = 0; i < 60; i++) {
        g.globalAlpha = 0.15 + ((i * 37) % 10) / 18;
        g.fillRect(((i * 149) % W), ((i * 83) % 300), 2, 2);
      }
      g.globalAlpha = 1;
      const mg = g.createRadialGradient(760, 110, 8, 760, 110, 90);   // moon
      mg.addColorStop(0, 'rgba(215,223,239,0.5)'); mg.addColorStop(1, 'rgba(215,223,239,0)');
      g.fillStyle = mg; g.fillRect(650, 0, 220, 220);
      g.fillStyle = '#cfd8ea'; g.beginPath(); g.arc(760, 110, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b9c4da'; g.beginPath(); g.arc(750, 104, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a0f1c';                                        // ridge line
      g.beginPath(); g.moveTo(0, 330);
      for (let x = 0; x <= W; x += 60) g.lineTo(x, 330 - ((x * 7919) % 50));
      g.lineTo(W, 360); g.lineTo(0, 360); g.closePath(); g.fill();
      g.fillStyle = '#0d1220'; g.fillRect(0, 340, W, H - 340);        // ground
      g.fillStyle = '#131a2c';                                        // the road
      g.beginPath(); g.moveTo(430, 340); g.lineTo(530, 340); g.lineTo(700, H); g.lineTo(260, H); g.closePath(); g.fill();
      g.strokeStyle = '#0d1220'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(480, 340); g.lineTo(480, H); g.stroke();
      for (const x of [220, 720]) {                                   // watch-fires
        g.fillStyle = '#1a2233'; g.fillRect(x, 280, 5, 62);
        const fg = g.createRadialGradient(x + 2, 274, 2, x + 2, 274, 42);
        fg.addColorStop(0, 'rgba(255,140,60,0.5)'); fg.addColorStop(1, 'rgba(255,140,60,0)');
        g.fillStyle = fg; g.fillRect(x - 40, 232, 84, 84);
        g.fillStyle = '#ffb36b'; g.fillRect(x, 270, 5, 7);
      }
    },
    vault(g, W, H) {
      const rg = g.createRadialGradient(300, 280, 60, 300, 280, 700);
      rg.addColorStop(0, '#141d33'); rg.addColorStop(1, '#090b12');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#232c42';                                      // the great door
      for (const [r, w] of [[270, 10], [215, 7], [160, 5]]) {
        g.lineWidth = w;
        g.beginPath(); g.arc(300, 290, r, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = '#131a2c'; g.beginPath(); g.arc(300, 290, 62, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(138,116,52,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.arc(300, 290, 62, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(160,190,230,0.05)';                         // cold shaft
      g.beginPath(); g.moveTo(640, 0); g.lineTo(860, 0); g.lineTo(700, 460); g.lineTo(520, 460); g.closePath(); g.fill();
      g.fillStyle = '#0f1626'; g.fillRect(0, 400, W, H - 400);        // floor
      g.strokeStyle = '#161f33'; g.lineWidth = 2;
      for (let i = -4; i <= 8; i++) {
        g.beginPath(); g.moveTo(300 + i * 40, 400); g.lineTo(300 + i * 150, H); g.stroke();
      }
      g.fillStyle = '#1a2233';                                        // rubble
      g.fillRect(120, 430, 26, 10); g.fillRect(840, 470, 34, 12); g.fillRect(600, 418, 18, 8);
    },
  };

  function ensureBackdropTexture(scene, theme) {
    const key = 'backdrop_' + theme;
    if (scene.textures.exists(key)) return key;
    const { c, g } = makeCanvas(960, 540);
    (BACKDROPS[theme] || BACKDROPS.hall)(g, 960, 540);
    vignette(g, 960, 540);
    scene.textures.addCanvas(key, c);
    return key;
  }

  WS.Sprites = { ensureBattlerTexture, ensureFxTextures, ensureBackdropTexture, sizeFor };
})();
