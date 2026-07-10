// Core math (handoff §2–4). Pure functions; RNG injectable so tests can seed it.
(function () {
  const WS = (globalThis.WS = globalThis.WS || {});

  let rng = Math.random;

  const F = {
    BASE_TICK: 300,

    setRng(fn) { rng = fn; },
    rand() { return rng(); },

    statAt(base, growth, level) { return base + growth * (level - 1); },
    maxHp(vit, level) { return 40 + vit * 8 + level * 6; },
    maxMp(foc, level) { return 10 + foc * 2 + level; },

    // ticks until an actor's next turn after acting
    tickCost(agi, weight) {
      return Math.max(1, Math.round(F.BASE_TICK / Math.max(1, agi) * weight));
    },

    critChance(lck, bonus) { return Math.min(95, 5 + lck / 2 + (bonus || 0)); },
    rollCrit(lck, bonus) { return rng() * 100 < F.critChance(lck, bonus); },
    variance() { return 0.95 + rng() * 0.10; },

    // one hit. atk = PWR+weaponAtk (phys) or FOC+arteBonus (arte); def = GRD or WRD.
    // extraMult carries Rage bonus, Watermark protection, Kindle amp boosts, etc.
    damage({ atk, power, affinityMult, def, crit, extraMult, deterministic }) {
      const v = deterministic ? 1.0 : F.variance();
      const raw = atk * (power / 100) * affinityMult * (100 / (100 + def))
        * v * (crit ? 1.5 : 1.0) * (extraMult || 1.0);
      if (affinityMult === 0) return 0; // Null (special enemies)
      return Math.max(1, Math.round(raw));
    },

    // status landing chance, modified by attacker LCK vs defender LCK
    statusChance(base, atkLck, defLck) {
      return Math.min(95, Math.max(5, base + (atkLck - defLck)));
    },
  };

  WS.F = F;
  if (typeof module !== 'undefined') module.exports = F;
})();
