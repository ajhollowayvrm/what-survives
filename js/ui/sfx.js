// Synthesized SFX (WebAudio, no assets) — the audio tier of the loudness ladder
// (art_direction §6, §8). Names are semantic; the UI decides when to play them.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  let ctx = null;
  let master = null;
  let muted = localStorage.getItem('ws_muted') === '1';

  function ensure() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // browsers only allow audio after a user gesture — arm on the first one
  document.addEventListener('pointerdown', ensure, { once: true });

  // one oscillator with an exponential-decay envelope; f2 = pitch slide target
  function tone({ f = 440, f2, type = 'sine', dur = 0.15, g = 0.15, at = 0 }) {
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    gn.gain.setValueAtTime(g, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(gn).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // filtered noise burst (impacts, crashes)
  function noise({ dur = 0.12, freq = 1000, g = 0.2, at = 0, type = 'lowpass' }) {
    const t0 = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(g, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(flt).connect(gn).connect(master);
    src.start(t0);
  }

  const SOUNDS = {
    tick:    () => tone({ f: 700, type: 'square', dur: 0.04, g: 0.04 }),
    confirm: () => tone({ f: 620, f2: 880, type: 'triangle', dur: 0.09, g: 0.08 }),
    back:    () => tone({ f: 440, f2: 320, type: 'triangle', dur: 0.09, g: 0.06 }),
    hit:     () => { noise({ dur: 0.09, freq: 800, g: 0.22 }); tone({ f: 170, f2: 80, dur: 0.1, g: 0.18 }); },
    crit:    () => { noise({ dur: 0.1, freq: 1400, g: 0.25 }); tone({ f: 1320, f2: 990, type: 'triangle', dur: 0.14, g: 0.12 }); },
    rupture: () => {
      noise({ dur: 0.34, freq: 2200, g: 0.32 });
      tone({ f: 70, f2: 32, type: 'sawtooth', dur: 0.4, g: 0.3 });
      tone({ f: 1760, f2: 880, type: 'triangle', dur: 0.28, g: 0.1, at: 0.03 });
    },
    resist:  () => tone({ f: 220, f2: 190, type: 'sine', dur: 0.1, g: 0.08 }),
    heal:    () => [523, 659, 784].forEach((f, i) => tone({ f, type: 'sine', dur: 0.16, g: 0.07, at: i * 0.06 })),
    buff:    () => [392, 523].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.14, g: 0.07, at: i * 0.07 })),
    gauge:   () => tone({ f: 980, type: 'sine', dur: 0.05, g: 0.03 }),
    freeze:  () => [1568, 1245].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.12, g: 0.08, at: i * 0.08 })),
    seal:    () => tone({ f: 220, f2: 92, type: 'sawtooth', dur: 0.3, g: 0.12 }),
    attune:  () => [440, 587, 880].forEach((f, i) => tone({ f, type: 'sine', dur: 0.12, g: 0.06, at: i * 0.05 })),
    awaken:  () => { tone({ f: 220, f2: 880, type: 'sawtooth', dur: 0.45, g: 0.1 }); [880, 1108, 1318].forEach((f, i) => tone({ f, type: 'sine', dur: 0.2, g: 0.06, at: 0.25 + i * 0.07 })); },
    amplify: () => { tone({ f: 58, type: 'sine', dur: 0.9, g: 0.3 }); noise({ dur: 0.8, freq: 400, g: 0.1, type: 'highpass' }); tone({ f: 440, f2: 1760, type: 'sine', dur: 0.7, g: 0.05 }); },
    combo:   () => [523, 659, 880].forEach((f, i) => tone({ f, type: 'square', dur: 0.1, g: 0.05, at: i * 0.09 })),
    bloodrun:() => { tone({ f: 55, type: 'sawtooth', dur: 0.8, g: 0.22 }); tone({ f: 110, f2: 55, type: 'square', dur: 0.25, g: 0.12, at: 0.1 }); tone({ f: 110, f2: 55, type: 'square', dur: 0.25, g: 0.12, at: 0.45 }); },
    aspect:  () => { tone({ f: 330, f2: 660, type: 'sawtooth', dur: 0.35, g: 0.1 }); noise({ dur: 0.3, freq: 900, g: 0.08, type: 'bandpass' }); },
    ko:      () => tone({ f: 330, f2: 78, type: 'square', dur: 0.3, g: 0.12 }),
    victory: () => [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.22, g: 0.09, at: i * 0.12 })),
    defeat:  () => [220, 174, 130].forEach((f, i) => tone({ f, type: 'sine', dur: 0.5, g: 0.1, at: i * 0.3 })),
  };

  WS.SFX = {
    play(name) {
      if (muted || !SOUNDS[name]) return;
      if (!ensure()) return;
      try { SOUNDS[name](); } catch (e) { /* audio is never worth crashing a battle */ }
    },
    get muted() { return muted; },
    set muted(v) {
      muted = !!v;
      localStorage.setItem('ws_muted', muted ? '1' : '0');
    },
  };
})();
