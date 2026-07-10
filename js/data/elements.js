// Six elements + opposed pairs (handoff §6). Silence reserved, not in v1.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  WS.ELEMENTS = {
    ember:    { id: 'ember',    name: 'Ember',    opposite: 'tide',     color: '#ff6b3d', icon: '🔥' },
    tide:     { id: 'tide',     name: 'Tide',     opposite: 'ember',    color: '#3fa7d6', icon: '🌊' },
    gale:     { id: 'gale',     name: 'Gale',     opposite: 'stone',    color: '#8ee06e', icon: '🌪' },
    stone:    { id: 'stone',    name: 'Stone',    opposite: 'gale',     color: '#c2a878', icon: '⛰' },
    radiance: { id: 'radiance', name: 'Radiance', opposite: 'umbra',    color: '#ffd166', icon: '☀' },
    umbra:    { id: 'umbra',    name: 'Umbra',    opposite: 'radiance', color: '#9b5de5', icon: '🌑' },
  };

  // affinity of an attack element vs a defender element (either may be null:
  // elementless attacks and elementless/Spirit defenders are always neutral)
  WS.affinity = function (attackEl, defenderEl) {
    if (!attackEl || !defenderEl) return { mult: 1.0, kind: 'neutral' };
    if (WS.ELEMENTS[defenderEl].opposite === attackEl) return { mult: 2.0, kind: 'rupture' };
    if (attackEl === defenderEl) return { mult: 0.5, kind: 'resist' };
    return { mult: 1.0, kind: 'neutral' };
  };

  if (typeof module !== 'undefined') module.exports = WS;
})();
