// Node test harness: `node test/run-tests.js`
// Unit tests pin the engine to the design docs' worked examples, then seeded
// auto-battles play both fights to completion with random-but-valid actions.
'use strict';

require('../js/data/elements.js');
require('../js/engine/formulas.js');
require('../js/data/characters.js');
require('../js/data/enemies.js');
require('../js/engine/battle.js');

const WS = globalThis.WS;
const F = WS.F;

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  if (ok) { passed++; }
  else { failed++; console.error(`  FAIL ${name}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); }
}

// deterministic RNG (mulberry32)
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log('— formulas (worked examples from the docs) —');
// CTB worked examples (system doc §3)
check('AGI 30 normal = 10 ticks', F.tickCost(30, 1.0), 10);
check('AGI 60 normal = 5 ticks', F.tickCost(60, 1.0), 5);
check('AGI 30 heavy = 15 ticks', F.tickCost(30, 1.5), 15);
// Damage sanity check (system doc §4): PWR45+wa30 vs GRD40 basic ≈ 54
check('basic dmg sanity ≈ 54',
  F.damage({ atk: 75, power: 100, affinityMult: 1, def: 40, crit: false, deterministic: true }), 54);
check('rupture doubles it ≈ 107',
  F.damage({ atk: 75, power: 100, affinityMult: 2, def: 40, crit: false, deterministic: true }), 107);
// Amplify worked example (system doc §6c): base 250 + SPR50×2.0 = 350 → 187.5 rounds to 188
check('amplified dmg ≈ 188',
  F.damage({ atk: 75, power: 350, affinityMult: 1, def: 40, crit: false, deterministic: true }), 188);
// Derived resources: cast doc L1 HP values
check('Siren L1 HP = 158', F.maxHp(14, 1), 158);
check('Cinne L1 HP = 134', F.maxHp(11, 1), 134);
check('Earl L1 HP = 118', F.maxHp(9, 1), 118);
check('Katariña L1 HP = 182', F.maxHp(17, 1), 182);
check('crit chance LCK 15 = 12.5%', F.critChance(15, 0), 12.5);

console.log('— affinity wheel —');
check('Tide vs Ember = Rupture 2.0', WS.affinity('tide', 'ember').mult, 2.0);
check('Ember vs Ember = Resist 0.5', WS.affinity('ember', 'ember').mult, 0.5);
check('Gale vs Ember = neutral', WS.affinity('gale', 'ember').mult, 1.0);
check('vs elementless = neutral', WS.affinity('ember', null).mult, 1.0);
check('elementless attack = neutral', WS.affinity(null, 'ember').mult, 1.0);

console.log('— battle basics —');
{
  F.setRng(seeded(42));
  const b = new WS.Battle(WS.BATTLES.sparring, {});
  const siren = b.party.find((u) => u.defId === 'siren');
  const kat = b.party.find((u) => u.defId === 'katarina');
  const cinne = b.party.find((u) => u.defId === 'cinne');
  const grunt = b.enemies[0];

  check('party of 4', b.party.length, 4);
  check('grunt HP 300', grunt.maxHp, 300);
  check('Katariña starts with 30 Fervor', kat.gauge.value, 30);
  check('Siren L5 SPR = 32', siren.stats.SPR, 32);
  check('queue preview returns 8', b.queuePreview(8).length, 8);
  check('Cinne acts before Katariña', // AGI 24+16 vs 8+4
    b.queuePreview(8).indexOf(cinne.uid) < b.queuePreview(8).indexOf(kat.uid), true);

  // Siren's Tide basic Ruptures the Ember construct and feeds his gauge
  const before = siren.gauge.value;
  const hit = b.computeHit(siren, grunt, siren.def.skills[0], {});
  check('Tide vs Ember construct is a rupture', hit.affinity, 'rupture');
  b.applyDamage(grunt, hit, siren);
  check('rupture fed Siren +19 Resonance', siren.gauge.value - before, 19); // +4 hit +15 rupture

  // Rage seizes at 100
  b.addGauge(cinne, 100, 'test');
  check('Cinne at 100 Rage enters Bloodrun', b.hasStatus(cinne, 'bloodrun'), true);
  check('Bloodrun blocks support targeting', b.supportable(cinne), false);
  const act = b.aiAct(cinne);
  check('seized Cinne auto-attacks someone', !!act.targetUid, true);
}

console.log('— Rage pacing / Calm Down —');
{
  F.setRng(seeded(9));
  const b = new WS.Battle(WS.BATTLES.sparring, {});
  const cinne = b.party.find((u) => u.defId === 'cinne');
  const earl = b.party.find((u) => u.defId === 'earl');
  const grunt = b.enemies[0];

  // Rage accrues only from her own actions — hits taken feed nothing
  const before = cinne.gauge.value;
  b.applyDamage(cinne, { dmg: 30, crit: false, affinity: 'neutral' }, grunt);
  check('hit taken adds no Rage', cinne.gauge.value, before);

  // Calm Down vents 40 and feeds Earl 20
  cinne.gauge.value = 70;
  b.doSkill(earl, 'calm_down', cinne.uid);
  check('Calm Down vents Rage to 30', cinne.gauge.value, 30);
  check('Calm Down gives Earl +20 Resonance', earl.gauge.value >= 20, true);

  // prevention, not rescue: unusable during Bloodrun
  b.addGauge(cinne, 100, 'test');
  check('Cinne Seizes at 100', b.hasStatus(cinne, 'bloodrun'), true);
  const cd = b.commandsFor(earl).skills.find((c) => c.skill.id === 'calm_down');
  check('Calm Down blocked during Bloodrun', cd.ok, false);
  check('…with the right reason', cd.why, 'She is beyond reach');
}

console.log('— Earl attune / rupture refund —');
{
  F.setRng(seeded(7));
  const b = new WS.Battle(WS.BATTLES.sparring, {});
  const earl = b.party.find((u) => u.defId === 'earl');
  const grunt = b.enemies[0];
  check('unattuned Earl cannot be ruptured', WS.affinity('ember', b.elementOf(earl)).mult, 1.0);
  b.doAttune(earl, 'tide');
  check('attune fills gauge +25', earl.gauge.value >= 25, true);
  check('attuned Earl is weak to Ember', WS.affinity('ember', b.elementOf(earl)).mult, 2.0);
  const hit = b.computeHit(earl, grunt, earl.def.skills.find((s) => s.id === 'prism_lance'), {});
  check('attuned Prism Lance ruptures Ember', hit.affinity, 'rupture');
}

console.log('— auto-battle simulations —');
// random-but-valid player policy; proves fights terminate and systems fire
function randomAction(b, actor) {
  const r = F.rand;
  const cmds = b.commandsFor(actor);
  const options = [];
  for (const c of cmds.skills) {
    if (!c.ok) continue;
    const targets = b.validTargets(actor, c.skill);
    if (c.skill.target === 'enemy' || c.skill.target === 'ally') {
      if (!targets.length) continue;
      options.push({ type: 'skill', skillId: c.skill.id, targetUid: targets[Math.floor(r() * targets.length)].uid });
    } else options.push({ type: 'skill', skillId: c.skill.id });
  }
  if (cmds.awaken && cmds.awaken.ok) options.push({ type: 'awaken' });
  if (cmds.attune && !actor.attuned) options.push({ type: 'attune', element: cmds.attune[Math.floor(r() * cmds.attune.length)] });
  return options[Math.floor(r() * options.length)];
}

function simulate(battleId, seed) {
  F.setRng(seeded(seed));
  const events = [];
  const b = new WS.Battle(WS.BATTLES[battleId], { onEvent: (e) => events.push(e) });
  let turns = 0;
  while (b.state === 'active' && turns < 2000) {
    turns++;
    const actor = b.beginTurn();
    const action = b.isPlayerControlled(actor) ? randomAction(b, actor) : b.aiAct(actor);
    if (action) b.act(actor, action);
    else b.advance(actor, 1.0); // nothing legal — pass
    if (b.state === 'active') b.endTurn(actor);
  }
  return { result: b.state, turns, events };
}

{
  const s = simulate('sparring', 1);
  check('sparring fight terminates', s.result !== 'active', true);
  check('sparring is winnable', s.result, 'victory');
  console.log(`  sparring: ${s.result} in ${s.turns} turns`);
}
{
  let wins = 0, total = 20, maxTurns = 0, sawAspect = false, sawBloodrun = false, sawAmplify = false, sawSeal = false;
  for (let seed = 1; seed <= total; seed++) {
    const s = simulate('warden', seed);
    check(`warden #${seed} terminates`, s.result !== 'active', true);
    if (s.result === 'victory') wins++;
    maxTurns = Math.max(maxTurns, s.turns);
    for (const e of s.events) {
      if (e.type === 'aspect') sawAspect = true;
      if (e.type === 'bloodrun') sawBloodrun = true;
      if (e.type === 'amplify') sawAmplify = true;
      if (e.type === 'status' && e.id === 'seal') sawSeal = true;
    }
  }
  check('boss cycles its Aspect', sawAspect, true);
  check('Bloodrun occurred across sims', sawBloodrun, true);
  check('Amplifies occurred across sims', sawAmplify, true);
  check('Seal Protocol landed across sims', sawSeal, true);
  console.log(`  warden: random-play win rate ${wins}/${total}, longest fight ${maxTurns} turns`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
