// Combo moves (handoff §9 / cast doc roster) — relationships as mechanics.
// All participants must be active & reachable; costs come from each
// participant's own gauge. Combos whose participants aren't in the battle's
// party simply don't appear (Mael's pair only shows where Mael fights).
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
      gaugeCost: { siren: 15, earl: 15 }, costLabel: '15 ea', cooldown: 4,
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
      gaugeCost: { cinne: 30, earl: 30, siren: 30 }, costLabel: '30 ea', cooldown: 6,
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
      gaugeCost: { cinne: 30 }, costLabel: '30 Rage', cooldown: 5,
      target: 'none', weight: 1.0,
      effect: 'guardian', turns: 2,
      desc: 'Cinne guards Earl for 2 turns: attacks aimed at him strike her instead, and she hits harder against anyone who has hurt him. Spends Rage as protection.',
    },
    {
      id: 'just_me', name: '“You Don’t Have to Be Anything”',
      cue: '“You don’t have to be anything.” — “Yeah, just me!”',
      participants: ['mael', 'earl'], initiators: ['mael', 'earl'],
      gaugeCost: { mael: 25, earl: 15 }, costLabel: '25/15', cooldown: 5,
      target: 'enemy', weight: 1.0,
      // one Artificial freeing another: Earl strikes as himself — a real
      // element, no Attune setup. 'trueElement' resolves at cast time to the
      // target's opposite element (Gale, freedom, if it has none).
      hits: [
        { by: 'earl', kind: 'arte', element: 'trueElement', power: 150 },
      ],
      desc: 'Mael frees Earl to strike as himself: one powerful arte in the target’s opposing element, no Attune needed (Gale if it has no element).',
    },
    {
      id: 'never_will_be', name: '“You’re Not Like Them”',
      cue: '“You’re… not like them.” — “And I never will be!”',
      participants: ['cinne', 'mael'], initiators: ['cinne', 'mael'],
      gaugeCost: { cinne: 40, mael: 40 }, costLabel: '40 ea', cooldown: 6,
      target: 'enemy', weight: 1.5,
      // seeing-through-the-lie made lethal against the machine
      bonusVs: ['artificial', 'state'], bonusMult: 1.3,
      hits: [
        { by: 'cinne', kind: 'phys', element: 'weapon', power: 50, times: 3, critBonus: 30 },
        { by: 'mael', kind: 'phys', element: 'weapon', power: 100 },
        { by: 'mael', kind: 'phys', element: 'gale', power: 100 },
      ],
      desc: 'The lovers’ signature: Cinne’s crit-storm and Mael’s tempest (Tide, then Gale), +30% vs Artificial and state enemies. Heavy gauge cost on both.',
    },
    {
      id: 'calm_down', name: 'Calm Down',
      cue: '“Calm down. I’m right here.”',
      participants: ['earl', 'cinne'], initiators: ['earl'],
      gaugeCost: {}, costLabel: '—', cooldown: 4,
      target: 'none', weight: 1.0,
      effect: 'ventRage', vent: 40, selfGauge: 20,
      bloodrunWhy: 'She is beyond reach',
      desc: 'Earl grounds his sister — Cinne’s Rage −40, Earl +20 Resonance. Prevention, not rescue: useless once she Seizes.',
    },
  ];

  if (typeof module !== 'undefined') module.exports = WS;
})();
