// The starting party (handoff §7, cast_and_kits). Stats: base (+growth/level).
// Numbers live here so tuning never touches engine logic.
//
// Skill fields the engine understands:
//   kind: 'phys' | 'arte' | 'support'
//   element: 'weapon' (wielder's element) | 'attuned' (Earl) | <elementId> | null
//   power: number | fn(unit) — skillPower; basic attack = 100
//   hits: number | fn(unit) — multi-hit moves roll variance/crit per hit
//   mp / gauge: costs ('full' = needs 100, spends all)
//   weight: CTB action weight (fast 0.7 / normal 1.0 / heavy 1.5)
//   target: 'enemy' | 'ally' | 'allEnemies' | 'allAllies' | 'self'
//   effects: engine-interpreted effect list
//   tags: 'basic' | 'amplify' | 'awakenOnly' | 'invocation'
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  WS.CHARACTERS = [
    {
      id: 'siren', name: 'Siren', title: 'Tide Vanguard', reason: 'Hymerdom',
      element: 'tide', weaponAtk: 28, arteBonus: 20,
      base:   { VIT: 14, PWR: 13, FOC: 8, SPR: 16, GRD: 12, WRD: 9, AGI: 11, LCK: 10 },
      growth: { VIT: 3,  PWR: 3,  FOC: 1, SPR: 4,  GRD: 2,  WRD: 1, AGI: 2,  LCK: 2 },
      gauge: { type: 'resonance', label: 'Resonance', start: 0 },
      awaken: {
        name: 'Watermark', cost: 100,
        desc: 'weaponAtk ×1.5 for 3 turns; allies take reduced damage; unlocks Dirge',
        allyDamageTakenMult: 0.85,
      },
      skills: [
        { id: 'siren_basic', name: 'Attack', kind: 'phys', element: 'weapon', power: 100,
          weight: 1.0, target: 'enemy', tags: ['basic'] },
        { id: 'deadweight', name: 'Deadweight', kind: 'arte', element: 'weapon', power: 120,
          mp: 6, weight: 1.0, target: 'enemy',
          effects: [{ type: 'freeze', chance: 45, push: 0.8 }],
          desc: 'Tide strike; chance to Freeze (drag the target’s next turn back)' },
        { id: 'breakwater', name: 'Breakwater', kind: 'support', element: null,
          mp: 10, weight: 1.0, target: 'ally',
          effects: [
            { type: 'buff', stats: { GRD: 0.3, WRD: 0.3 }, turns: 3 },
            { type: 'shield', amount: (u) => u.stats.SPR * 2 },
          ],
          desc: '+GRD/WRD to an ally and a small Spirit-scaled shield' },
        { id: 'full_fathom', name: 'Full Fathom', kind: 'arte', element: 'weapon', power: 90,
          mp: 14, weight: 1.5, target: 'allEnemies',
          desc: 'Heavy Tide flood over every enemy' },
        { id: 'dirge', name: 'Dirge', kind: 'arte', element: 'weapon', power: 160,
          mp: 12, weight: 1.5, target: 'enemy', tags: ['awakenOnly'],
          effects: [{ type: 'freeze', chance: 60, push: 0.8 }],
          desc: 'Awakened only: heavy Tide hit, high Freeze chance' },
        { id: 'we_came_for_you', name: 'We Came For You', kind: 'phys', element: 'weapon',
          power: (u) => 220 + u.stats.SPR * 2.5,
          gauge: 'full', weight: 1.5, target: 'enemy', tags: ['amplify'],
          cue: 'We came for you…',
          effects: [{ type: 'partyShield', amount: (u) => u.stats.SPR * 4 }],
          desc: 'Amplify: one crashing strike that pulls back to shield the whole party' },
      ],
    },

    {
      id: 'cinne', name: 'Cinne', title: 'Duelist', reason: 'Fleshound',
      element: 'gale', weaponAtk: 26, arteBonus: 16,
      base:   { VIT: 11, PWR: 14, FOC: 9, SPR: 12, GRD: 8, WRD: 8, AGI: 16, LCK: 15 },
      growth: { VIT: 2,  PWR: 3,  FOC: 1, SPR: 2,  GRD: 1, WRD: 1, AGI: 4,  LCK: 3 },
      // Rage: not spent so much as survived. At 100 → Bloodrun (engine-enforced).
      gauge: { type: 'rage', label: 'Rage', start: 0 },
      awaken: {
        // Rage 100 seizes her, so Split Second vents 50 instead of costing a full bar
        name: 'Split Second', cost: 50,
        desc: 'weaponAtk ×1.5, +25% crit, faster actions for 3 turns',
        critBonus: 25, weightMult: 0.85,
      },
      skills: [
        { id: 'cinne_basic', name: 'Attack', kind: 'phys', element: 'weapon', power: 100,
          weight: 0.7, target: 'enemy', tags: ['basic'] },
        { id: 'needlework', name: 'Needlework', kind: 'phys', element: 'weapon', power: 45,
          hits: () => 2 + (WS.F.rand() < 0.5 ? 1 : 0),
          mp: 6, weight: 1.0, target: 'enemy',
          desc: '2–3 fast hits, each rolls crit independently' },
        { id: 'overtake', name: 'Overtake', kind: 'support', element: null,
          mp: 8, weight: 0.7, target: 'self',
          effects: [{ type: 'nextTickMult', mult: 0.4 }],
          desc: 'Sharply reduces her next action’s tick cost — cut in line' },
        { id: 'opening', name: 'Opening', kind: 'support', element: null,
          mp: 7, weight: 1.0, target: 'enemy',
          effects: [{ type: 'mark' }],
          desc: 'Mark a target: next hit on it is a guaranteed crit and ignores some GRD' },
        { id: 'last_dance', name: 'Last Dance', kind: 'phys', element: 'weapon', power: 70,
          hits: (u) => 4 + Math.floor(u.stats.AGI / 15),
          gauge: 50, weight: 1.5, target: 'enemy', tags: ['amplify'],
          cue: 'Try to keep up.',
          critBonus: 40,
          desc: 'Amplify (50 Rage): the whole pack descends — a storm of crit-fishing strikes' },
      ],
    },

    {
      id: 'earl', name: 'Earl', title: 'Artist', reason: '[Quill]',
      element: null, // elementless: never Ruptured until he Attunes
      attuner: true,
      weaponAtk: 12, arteBonus: 34,
      base:   { VIT: 9, PWR: 8, FOC: 15, SPR: 11, GRD: 8, WRD: 12, AGI: 14, LCK: 12 },
      growth: { VIT: 1, PWR: 1, FOC: 4,  SPR: 2,  GRD: 1, WRD: 2,  AGI: 3,  LCK: 2 },
      gauge: { type: 'resonance', label: 'Resonance', start: 0 },
      attuneGauge: 25, // Attune is a wind-up, not dead air
      awaken: {
        name: '[Sigil Orbit]', cost: 100,
        desc: 'weaponAtk & arte bonus ×1.5 for 3 turns; shifting sigils orbit him',
      },
      skills: [
        { id: 'earl_basic', name: 'Attack', kind: 'phys', element: 'attuned', power: 100,
          weight: 1.0, target: 'enemy', tags: ['basic'] },
        { id: 'prism_lance', name: 'Prism Lance', kind: 'arte', element: 'attuned', power: 130,
          mp: 10, weight: 1.0, target: 'enemy',
          effects: [{ type: 'refundAlliesOnRupture', amount: 12 }],
          desc: 'Arte in his current attuned element; a Rupture refunds gauge to all allies' },
        { id: 'prismbreak', name: '[Prismbreak]', kind: 'arte', element: 'attuned',
          power: (u) => 200 + u.stats.FOC * 2.5,
          gauge: 'full', weight: 1.5, target: 'enemy', tags: ['amplify'],
          requiresAttuned: true,
          cue: 'Mmhm!',
          desc: 'Amplify: a massive Focus-scaled burst in his attuned element' },
      ],
    },

    {
      id: 'katarina', name: 'Katariña', title: 'The Amplifier', reason: 'Staff of Nagandahl',
      element: null, // Spirit — no elemental affinity, can't be Ruptured
      spirit: true,
      weaponAtk: 30, arteBonus: 24,
      base:   { VIT: 17, PWR: 13, FOC: 11, SPR: 16, GRD: 15, WRD: 12, AGI: 8, LCK: 10 },
      growth: { VIT: 4,  PWR: 2,  FOC: 2,  SPR: 4,  GRD: 3,  WRD: 2,  AGI: 1, LCK: 2 },
      // starts warm so low AGI doesn't bench her early (balance flag #3)
      gauge: { type: 'fervor', label: 'Fervor', start: 30 },
      awaken: null, // old ways — no weapon Awakening; her manifestation is the totems
      skills: [
        { id: 'kat_basic', name: 'Attack', kind: 'phys', element: null, power: 100,
          weight: 1.0, target: 'enemy', tags: ['basic'] },
        { id: 'rootbind', name: 'Rootbind', kind: 'support', element: null,
          gauge: 25, weight: 1.0, target: 'allAllies', tags: ['invocation'],
          effects: [{ type: 'totemRegen', pct: 0.08, turns: 3 }],
          desc: 'Plant a totem: the party regenerates 8% max HP per turn for 3 turns' },
        { id: 'ancestral_roar', name: 'Ancestral Roar', kind: 'support', element: null,
          gauge: 35, weight: 1.0, target: 'allEnemies', tags: ['invocation'],
          effects: [
            { type: 'pushAllEnemies', frac: 0.6 },
            { type: 'debuffAllEnemies', stats: { GRD: -0.25 }, turns: 3 },
          ],
          desc: 'Push every enemy’s turn back and lower their GRD for 3 turns' },
        { id: 'old_blood', name: 'Old Blood', kind: 'phys', element: null, power: 180,
          gauge: 30, weight: 1.0, target: 'enemy', tags: ['invocation'],
          effects: [{ type: 'ignoreGuard', pct: 0.5 }],
          desc: 'Defense-piercing strike: power 180, ignores 50% of GRD' },
        { id: 'kindle', name: 'Kindle', kind: 'support', element: null,
          gauge: 40, weight: 1.0, target: 'ally', tags: ['invocation'],
          effects: [{ type: 'gaugeGift', amount: 40, ampBoost: 0.30 }],
          desc: 'Pour spirit into an ally: +40 to their gauge and +30% to their next Amplify' },
        { id: 'dacharta_stand', name: 'The Da’Charta Stand', kind: 'support', element: null,
          gauge: 'full', weight: 1.5, target: 'allAllies', tags: ['amplify', 'invocation'],
          cue: 'The dead stand with the living.',
          effects: [
            { type: 'partyGauge', amount: 50, ampBoost: 0.25 },
            { type: 'totemRegen', pct: 0.08, turns: 2 },
          ],
          desc: 'Amplify: party-wide +50 gauge, +25% to each ally’s next Amplify, regen' },
      ],
    },
  ];

  if (typeof module !== 'undefined') module.exports = WS;
})();
