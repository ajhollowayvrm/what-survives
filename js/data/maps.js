// Overworld maps — data only. A map is a grid of single-character tiles plus a
// legend, a spawn point, NPCs, and triggers. The Overworld scene (js/ui/
// overworld.js) reads this; it never hard-codes a map. Author new areas by
// adding entries here — no engine changes needed. All tuning (tile look,
// solidity) lives in TILEDEFS so painting stays data-driven, matching the rest
// of the project (js/data/ holds every number).
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  // Tile kinds: solid = blocks movement. color/edge = flat paint; `paint` is an
  // optional decorator (fountain water, tree canopy, ring chalk) drawn on top.
  // Kept deliberately spare — silhouette-and-signal, cold palette, gold accents
  // (docs/art_direction_v0.1.md) — so commissioned tilesets can replace it later.
  WS.TILEDEFS = {
    floor: { solid: false, color: '#20283a', edge: '#1a2131' },
    grass: { solid: false, color: '#1d3326', edge: '#16261c' },
    path:  { solid: false, color: '#2a2f3f', edge: '#222634' },
    wall:  { solid: true,  color: '#39445c', top: '#4c597a' },
    tree:  { solid: true,  color: '#1d3326', edge: '#16261c', paint: 'tree' },
    water: { solid: true,  color: '#16344c', edge: '#0f2438', paint: 'water' },
    door:  { solid: false, color: '#3a2c1e', edge: '#241b12', paint: 'door' },
    ring:  { solid: false, color: '#242c40', edge: '#1c2334', paint: 'ring' },
  };

  // legend: grid char -> tile kind. `@` in a grid marks the default spawn tile
  // (painted as floor). Every grid row must be the same length.
  WS.MAPS = {
    academy_courtyard: {
      name: 'Academy Courtyard',
      legend: {
        '#': 'wall', '.': 'floor', ',': 'grass', ':': 'path',
        'T': 'tree', '~': 'water', 'D': 'door', 'o': 'ring',
      },
      grid: [
        '################',
        '#,,..........,,#',
        '#,T....DD....T,#',
        '#......::......#',
        '#.....~~~~.....#',
        '#.....~~~~.....#',
        '#.....~~~~.....#',
        '#......::......#',
        '#......oo......#',
        '#......::......#',
        '#,T....::....T,#',
        '#,,....@@....,,#',
        '################',
      ],
      // NPCs are solid (you can't walk through them) and face `dir`. `sprite`
      // is any battler defId (js/ui/sprites.js); unknown ids fall back cleanly.
      npcs: [
        {
          id: 'earl', sprite: 'earl', name: 'Earl', x: 11, y: 8, dir: 'left',
          lines: [
            'Earl: Oh! Hi hi! You’re the new one, right?',
            'Earl: Everyone here is so… sharp. You seem nice, though.',
            'Earl: If you wanna warm up, the sparring ring’s right there. Mmhm!',
          ],
        },
        {
          id: 'proctor', sprite: 'radiant_duelist', name: 'Proctor', x: 4, y: 8, dir: 'right',
          lines: [
            'Proctor: Low-born. Try not to embarrass the Academy.',
            'Proctor: Step into the ring when you think you’re ready.',
          ],
        },
      ],
      // Triggers fire on tile events. mode:'enter' fires when you step onto the
      // tile; mode:'interact' fires when you face it and press Enter/Space.
      // kind is handled by the controller (js/main.js): 'battle' | 'dialogue'.
      triggers: [
        {
          id: 'sparring_ring', mode: 'enter', kind: 'battle', battle: 'sparring',
          tiles: [[7, 8], [8, 8]],
          confirm: 'Enter the sparring ring?',
        },
        {
          id: 'north_gate', mode: 'enter', kind: 'dialogue',
          tiles: [[6, 2], [7, 2]],
          lines: [
            'The gate to the Academy proper is barred for now.',
            '(More of the world opens up as the story is authored.)',
          ],
        },
      ],
    },
  };
})();
