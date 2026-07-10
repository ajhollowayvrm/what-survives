// Combo moves (handoff §9 / cast doc roster) — relationships as mechanics.
// All participants must be active & reachable; costs come from each
// participant's own gauge. Mael's two combos arrive with Mael.
// (Story-gating deferred: in the prototype every combo is unlocked.)
//
// hits[]: resolved in order, each credited to its dealer (`by`), so gauge
// feeds per hit like any attack. 'attuned'/'weapon' elements resolve per
// dealer at cast time.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  WS.COMBOS = [
    {
      id: 'friendstrike', name: 'Friendstrike',
      cue: '“Earl!” — “Mmhm!”',
      participants: ['siren', 'earl'], initiators: ['siren', 'earl'],
      gaugeCost: { siren: 15, earl: 15 }, costLabel: '15 ea',
      target: 'enemy', weight: 1.0,
      hits: [
        { by: 'siren', kind: 'phys', element: 'weapon', power: 90 },
        { by: 'earl', kind: 'arte', element: 'attuned', power: 90 },
      ],
      // the first friendship: if either element finds the weakness, the whole
      // coordinated strike Ruptures (big gauge to both, via normal hit credit)
      guaranteedRuptureIfEitherWeak: true,
      desc: 'Siren + Earl, one target, two hits. If either element hits the weakness, both hits are guaranteed Ruptures.',
    },
    {
      id: 'watch_and_learn', name: 'Watch and Learn',
      cue: '“Watch and learn!”',
      participants: ['cinne', 'earl', 'siren'], initiators: ['cinne', 'earl', 'siren'],
      gaugeCost: { cinne: 30, earl: 30, siren: 30 }, costLabel: '30 ea',
      target: 'enemy', weight: 1.5,
      coordBonus: 1.25,
      hits: [
        { by: 'cinne', kind: 'phys', element: 'weapon', power: 45, times: 3 },
        { by: 'earl', kind: 'arte', element: 'attuned', power: 110 },
        { by: 'siren', kind: 'phys', element: 'weapon', power: 130 },
      ],
      desc: 'The original trio at full sync — Cinne’s flurry, Earl’s arte, Siren’s finisher, all at +25% coordination.',
    },
    {
      id: 'wont_let_them', name: 'I Won’t Let Them Hurt You Again',
      cue: '“I won’t let them hurt you again…”',
      participants: ['cinne', 'earl'], initiators: ['cinne'],
      gaugeCost: { cinne: 30 }, costLabel: '30 Rage',
      target: 'none', weight: 1.0,
      effect: 'guardian', turns: 2,
      desc: 'Cinne guards Earl for 2 turns: attacks aimed at him strike her instead, and she hits harder against anyone who has hurt him. Spends Rage as protection.',
    },
    {
      id: 'calm_down', name: 'Calm Down',
      cue: '“Calm down. I’m right here.”',
      participants: ['earl', 'cinne'], initiators: ['earl'],
      gaugeCost: {}, costLabel: '—',
      target: 'none', weight: 1.0,
      effect: 'ventRage', vent: 40, selfGauge: 20,
      bloodrunWhy: 'She is beyond reach',
      desc: 'Earl grounds his sister — Cinne’s Rage −40, Earl +20 Resonance. Prevention, not rescue: useless once she Seizes.',
    },
  ];

  if (typeof module !== 'undefined') module.exports = WS;
})();
