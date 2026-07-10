// Enemies (handoff §8 + multi-enemy roster). Fixed stat blocks, fixed HP, no gauges.
// Element spread is deliberate: each weakness has a different party answer
// (Tide→Siren, Stone→Cinne's Gale, everything else→Earl's Attune).
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  WS.ENEMIES = {
    sparring_construct: {
      id: 'sparring_construct', name: 'Academy Sparring Construct',
      element: 'ember', // Siren's Tide Ruptures it
      hp: 300, weaponAtk: 20, arteBonus: 0,
      stats: { VIT: 0, PWR: 30, FOC: 20, SPR: 5, GRD: 25, WRD: 20, AGI: 20, LCK: 5 },
      ai: 'grunt',
      skills: [
        { id: 'construct_basic', name: 'Piston Strike', kind: 'phys', element: null,
          power: 100, weight: 1.0, target: 'enemy', tags: ['basic'] },
      ],
    },

    stoneline_construct: {
      id: 'stoneline_construct', name: 'Stoneline Construct',
      element: 'stone', // Cinne's Gale Ruptures it
      hp: 360, weaponAtk: 24, arteBonus: 0,
      stats: { VIT: 0, PWR: 34, FOC: 16, SPR: 5, GRD: 40, WRD: 24, AGI: 13, LCK: 5 },
      ai: 'grunt',
      skills: [
        { id: 'piledriver', name: 'Piledriver', kind: 'phys', element: 'weapon',
          power: 120, weight: 1.2, target: 'enemy', tags: ['basic'] },
      ],
    },

    galeline_construct: {
      id: 'galeline_construct', name: 'Galeline Construct',
      element: 'gale', // weak to Stone — only Earl's Attune answers it
      hp: 230, weaponAtk: 18, arteBonus: 0,
      stats: { VIT: 0, PWR: 27, FOC: 20, SPR: 5, GRD: 17, WRD: 18, AGI: 33, LCK: 10 },
      ai: 'grunt',
      skills: [
        { id: 'rotor_slash', name: 'Rotor Slash', kind: 'phys', element: 'weapon',
          power: 80, weight: 0.7, target: 'enemy', tags: ['basic'] },
      ],
    },

    academy_proctor: {
      id: 'academy_proctor', name: 'Academy Proctor',
      element: 'radiance', // weak to Umbra — Earl's puzzle
      hp: 850, weaponAtk: 52, arteBonus: 48,
      stats: { VIT: 0, PWR: 44, FOC: 42, SPR: 12, GRD: 34, WRD: 34, AGI: 30, LCK: 14 },
      ai: 'proctor',
      skills: [
        { id: 'credential_cut', name: 'Credential Cut', kind: 'phys', element: 'weapon',
          power: 100, weight: 0.7, target: 'enemy', tags: ['basic'] },
        { id: 'flash_sear', name: 'Flash Sear', kind: 'arte', element: 'weapon',
          power: 125, weight: 1.0, target: 'enemy' },
        { id: 'blinding_order', name: 'Blinding Order', kind: 'support', element: null,
          power: 0, weight: 1.0, target: 'enemy',
          effects: [{ type: 'freeze', chance: 55, push: 0.7 }],
          desc: 'A dazzling command — drags a target’s next turn back' },
      ],
    },

    aspect_warden: {
      id: 'aspect_warden', name: 'Aspect-Warden',
      element: 'ember', // starting Aspect; cycles Ember → Stone → Tide every 3 turns
      aspectCycle: ['ember', 'stone', 'tide'],
      // HP stretched from the handoff's ~2200 and action weights dropped well below
      // 1.0 so the boss takes ~2 actions per party rotation — at spec values it died
      // in ~2.4 turns, before its aspect cycle or Seal ever mattered
      hp: 3500, weaponAtk: 95, arteBonus: 85,
      stats: { VIT: 0, PWR: 55, FOC: 48, SPR: 10, GRD: 50, WRD: 42, AGI: 22, LCK: 8 },
      ai: 'warden',
      skills: [
        { id: 'aspect_strike', name: 'Aspect Strike', kind: 'phys', element: 'weapon',
          power: 110, weight: 0.55, target: 'enemy', tags: ['basic'] },
        { id: 'aspect_surge', name: 'Aspect Surge', kind: 'arte', element: 'weapon',
          power: 130, weight: 0.55, target: 'enemy' },
        { id: 'wardenfall', name: 'Wardenfall', kind: 'arte', element: 'weapon',
          power: 100, weight: 1.0, target: 'allEnemies' },
        { id: 'seal_protocol', name: 'Seal Protocol', kind: 'support', element: null,
          power: 0, weight: 0.55, target: 'enemy',
          effects: [{ type: 'seal', chance: 85, turns: 2 }],
          desc: 'Locks a target’s artes for 2 turns' },
      ],
    },

    tidebound_shard: {
      id: 'tidebound_shard', name: 'Tidebound Shard',
      element: 'tide', // weak to Ember — Earl attunes to answer it
      hp: 320, weaponAtk: 30, arteBonus: 34,
      stats: { VIT: 0, PWR: 38, FOC: 42, SPR: 8, GRD: 30, WRD: 36, AGI: 26, LCK: 8 },
      ai: 'grunt',
      skills: [
        { id: 'undertow', name: 'Undertow', kind: 'arte', element: 'weapon',
          power: 95, weight: 1.0, target: 'enemy', tags: ['basic'] },
      ],
    },

    stonebound_shard: {
      id: 'stonebound_shard', name: 'Stonebound Shard',
      element: 'stone', // weak to Gale — Cinne's meat
      hp: 380, weaponAtk: 34, arteBonus: 0,
      stats: { VIT: 0, PWR: 44, FOC: 20, SPR: 8, GRD: 42, WRD: 26, AGI: 16, LCK: 6 },
      ai: 'grunt',
      skills: [
        { id: 'shardfall', name: 'Shardfall', kind: 'phys', element: 'weapon',
          power: 115, weight: 1.1, target: 'enemy', tags: ['basic'] },
      ],
    },
  };

  // Battle setups selectable from the title screen (listed in difficulty order)
  WS.BATTLES = {
    sparring: {
      id: 'sparring', name: 'Sparring Match',
      desc: 'Academy training hall. One Ember construct — learn the loop. Party level 5.',
      partyLevel: 5,
      enemies: ['sparring_construct'],
    },
    gauntlet: {
      id: 'gauntlet', name: 'Training Gauntlet',
      desc: 'Three constructs, three elements. Every weakness has a different answer. Party level 6.',
      partyLevel: 6,
      enemies: ['sparring_construct', 'stoneline_construct', 'galeline_construct'],
    },
    proctor: {
      id: 'proctor', name: 'The Proctor’s Detail',
      desc: 'A fast Radiance duelist and two escorts. Kill order matters. Party level 9.',
      partyLevel: 9,
      enemies: ['academy_proctor', 'sparring_construct', 'stoneline_construct'],
    },
    warden: {
      id: 'warden', name: 'The Aspect-Warden',
      desc: 'A Korveth war-construct that cycles its Aspect every 3 turns. Party level 13.',
      partyLevel: 13,
      enemies: ['aspect_warden'],
    },
    retinue: {
      id: 'retinue', name: 'Warden and Retinue',
      desc: 'The Warden flanked by two Shards. The hard run. Party level 14.',
      partyLevel: 14,
      enemies: ['aspect_warden', 'tidebound_shard', 'stonebound_shard'],
    },
  };

  if (typeof module !== 'undefined') module.exports = WS;
})();
