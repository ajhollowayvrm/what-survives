// Enemies (handoff §8). Enemies use fixed stat blocks + fixed HP, no gauges.
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
  };

  // Battle setups selectable from the title screen
  WS.BATTLES = {
    sparring: {
      id: 'sparring', name: 'Sparring Match',
      desc: 'Academy training hall. One Ember construct — learn the loop. Party level 5.',
      partyLevel: 5,
      enemies: ['sparring_construct'],
    },
    warden: {
      id: 'warden', name: 'The Aspect-Warden',
      desc: 'A Korveth war-construct that cycles its Aspect every 3 turns. Party level 13.',
      partyLevel: 13,
      enemies: ['aspect_warden'],
    },
  };

  if (typeof module !== 'undefined') module.exports = WS;
})();
