// Node test harness: `node test/run-tests.js`
// Unit tests pin the engine to the design docs' worked examples, then seeded
// auto-battles play both fights to completion with random-but-valid actions.
'use strict';

require('../js/data/elements.js');
require('../js/engine/formulas.js');
require('../js/data/characters.js');
require('../js/data/enemies.js');
require('../js/data/combos.js');
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

  // Rage fills from violence both ways (spec §6a): +8 on hit taken
  const before = cinne.gauge.value;
  b.applyDamage(cinne, { dmg: 30, crit: false, affinity: 'neutral' }, grunt);
  check('hit taken feeds Rage +8', cinne.gauge.value, before + 8);

  // Calm Down vents 40 and feeds Earl 20
  cinne.gauge.value = 70;
  b.act(earl, { type: 'combo', comboId: 'calm_down' });
  check('Calm Down vents Rage to 30', cinne.gauge.value, 30);
  check('Calm Down gives Earl +20 Resonance', earl.gauge.value >= 20, true);

  // prevention, not rescue: unusable during Bloodrun
  b.addGauge(cinne, 100, 'test');
  check('Cinne Seizes at 100', b.hasStatus(cinne, 'bloodrun'), true);
  const cd = b.combosFor(earl).find((c) => c.combo.id === 'calm_down');
  check('Calm Down blocked during Bloodrun', cd.ok, false);
  check('…with the right reason', cd.why, 'She is beyond reach');
}

console.log('— combos —');
{
  F.setRng(seeded(11));
  const events = [];
  const b = new WS.Battle(WS.BATTLES.sparring, { onEvent: (e) => events.push(e) });
  const siren = b.party.find((u) => u.defId === 'siren');
  const cinne = b.party.find((u) => u.defId === 'cinne');
  const earl = b.party.find((u) => u.defId === 'earl');
  const grunt = b.enemies[0];

  // gating: Friendstrike needs 15 gauge from BOTH
  siren.gauge.value = 20; earl.gauge.value = 5;
  let fs = b.combosFor(siren).find((c) => c.combo.id === 'friendstrike');
  check('Friendstrike gated on Earl\'s gauge', fs.ok, false);
  earl.gauge.value = 20;
  fs = b.combosFor(siren).find((c) => c.combo.id === 'friendstrike');
  check('Friendstrike ready when both have 15', fs.ok, true);

  // Siren's Tide finds the Ember weakness → BOTH hits guaranteed Ruptures,
  // even Earl's unattuned (elementless) one
  events.length = 0;
  b.act(siren, { type: 'combo', comboId: 'friendstrike', targetUid: grunt.uid });
  const rup = events.filter((e) => e.type === 'damage' && e.rupture);
  check('Friendstrike: both hits Ruptured', rup.length, 2);
  check('Friendstrike is initiator-listed for Earl too',
    !!b.combosFor(earl).find((c) => c.combo.id === 'friendstrike'), true);

  // Watch and Learn: 5 hits (3 Cinne + Earl + Siren), all three pay 30
  siren.gauge.value = 40; earl.gauge.value = 35; cinne.gauge.value = 45;
  events.length = 0;
  b.act(cinne, { type: 'combo', comboId: 'watch_and_learn', targetUid: grunt.uid });
  const hits = events.filter((e) => e.type === 'damage');
  check('Watch and Learn lands 5 hits', hits.length >= 4, true); // <5 only if grunt dies mid-chain
  check('Watch and Learn spent Cinne\'s Rage', cinne.gauge.value < 45, true);

  // guardian vow: attacks aimed at Earl strike Cinne instead
  cinne.gauge.value = 35;
  b.act(cinne, { type: 'combo', comboId: 'wont_let_them' });
  check('Earl is Guarded', b.hasStatus(earl, 'guarded'), true);
  check('Cinne holds her Vow', b.hasStatus(cinne, 'vow'), true);
  const earlHp = earl.hp, cinneHp = cinne.hp;
  b.act(grunt, { type: 'skill', skillId: 'construct_basic', targetUid: earl.uid });
  check('the hit redirected to Cinne', earl.hp === earlHp && cinne.hp < cinneHp, true);
  check('the attacker is marked as having hurt Earl', grunt.hurtEarl, true);
}

console.log('— cooldowns —');
{
  F.setRng(seeded(13));
  const b = new WS.Battle(WS.BATTLES.warden, {});
  const cinne = b.party.find((u) => u.defId === 'cinne');
  const siren = b.party.find((u) => u.defId === 'siren');
  const earl = b.party.find((u) => u.defId === 'earl');
  const boss = b.enemies[0];

  // Last Dance locks for 3 of her turns after use
  // (start at exactly 50: its own hits feed Rage back, and from higher she can
  // Seize mid-move — that self-refund is deliberate, Earl is the real vent)
  cinne.gauge.value = 50;
  b.act(cinne, { type: 'skill', skillId: 'last_dance', targetUid: boss.uid });
  check('Last Dance hits fed Rage back', cinne.gauge.value > 0, true);
  cinne.gauge.value = 60; // normalize: gauge is not the limiter under test
  let ld = b.commandsFor(cinne).skills.find((c) => c.skill.id === 'last_dance');
  check('Last Dance on cooldown after use', ld.ok, false);
  check('…3 turns of it', ld.cdLeft, 3);
  b.tickCooldowns(cinne); b.tickCooldowns(cinne); b.tickCooldowns(cinne);
  ld = b.commandsFor(cinne).skills.find((c) => c.skill.id === 'last_dance');
  check('Last Dance ready after 3 of her turns', ld.ok, true);

  // combo cooldown is shared: Earl's Calm Down locks it for Siren-side reuse too
  b.act(earl, { type: 'combo', comboId: 'calm_down' });
  const cd = b.combosFor(earl).find((c) => c.combo.id === 'calm_down');
  check('Calm Down on shared cooldown', cd.ok, false);
  // ticks on any participant's turn: 2 Cinne + 2 Earl turns clears the 4
  b.tickCooldowns(cinne); b.tickCooldowns(earl); b.tickCooldowns(cinne); b.tickCooldowns(earl);
  check('Calm Down ready again', b.combosFor(earl).find((c) => c.combo.id === 'calm_down').ok, true);
  // non-participants don't tick it
  b.act(earl, { type: 'combo', comboId: 'calm_down' });
  b.tickCooldowns(siren); b.tickCooldowns(boss);
  check('non-participant turns do not tick it', b.comboCooldowns.calm_down, 4);
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

console.log('— Mael: Defiance (adversity-fed) —');
{
  F.setRng(seeded(21));
  const b = new WS.Battle(WS.BATTLES.retrieval, {});
  const mael = b.party.find((u) => u.defId === 'mael');
  const siren = b.party.find((u) => u.defId === 'siren');
  const sergeant = b.enemies.find((u) => u.defId === 'bind_sergeant');
  const hound = b.enemies.find((u) => u.defId === 'chainhound_construct');

  check('retrieval fields a party of 5', b.party.length, 5);
  check('default battles stay a party of 4', new WS.Battle(WS.BATTLES.sparring, {}).party.length, 4);
  check('Mael L1 HP = 166 (cast doc)', F.maxHp(15, 1), 166);
  check('six enemies — the party is outnumbered', b.enemies.length, 6);

  // no passive fill: Defiance rises only from adversity
  for (const u of b.units) u.nextTurn = u === mael ? 0 : 999;
  b.beginTurn();
  check('Defiance has no passive fill on his turn', mael.gauge.value, 0);

  // +8 hit taken
  b.applyDamage(mael, { dmg: 20, crit: false, affinity: 'neutral' }, sergeant);
  check('hit taken feeds Defiance +8', mael.gauge.value, 8);

  // +10 when a debuff lands, and the debuff actually bites
  b.applyEffect(b.enemies[1], WS.ENEMIES.bindwright.skills.find((s) => s.id === 'leaden_writ').effects[0],
    {}, mael.uid, {});
  check('debuff landing feeds Defiance +10', mael.gauge.value, 18);
  check('Leaden cuts PWR by 20%', b.stat(mael, 'PWR'), mael.stats.PWR * 0.8);

  // +2 per enemy action while outnumbered (6 living enemies > 5 living party)
  for (const u of b.units) u.nextTurn = u === hound ? 0 : 999;
  b.beginTurn();
  check('outnumbered: enemy action feeds Defiance +2', mael.gauge.value, 20);

  // Break: cleanse own debuffs, control-immunity, +25% PWR
  b.addStatus(mael, { id: 'seal', name: 'Seal', turns: 2, harmful: true, data: {} });
  check('Seal landing on him feeds Defiance too', mael.gauge.value, 30);
  b.act(mael, { type: 'skill', skillId: 'break' });
  check('Break spends 30 Defiance', mael.gauge.value, 0);
  check('Break cleansed his Seal', b.hasStatus(mael, 'seal'), false);
  check('Break cleansed his Leaden', b.hasStatus(mael, 'leaden'), false);
  check('Break leaves him Unbound', b.hasStatus(mael, 'unbound'), true);
  check('Unbound: +25% PWR', b.stat(mael, 'PWR'), mael.stats.PWR * 1.25);
  b.applyEffect(sergeant, { type: 'seal', chance: 100, turns: 2 }, {}, mael.uid, {});
  check('Unbound: Seal cannot touch him', b.hasStatus(mael, 'seal'), false);
  const nt = mael.nextTurn;
  b.applyEffect(hound, { type: 'freeze', chance: 100, push: 0.5 }, {}, mael.uid, {});
  check('Unbound: Freeze cannot hold him', mael.nextTurn, nt);

  // Unshackle: frees an ally; not himself; never Bloodrun
  b.addStatus(siren, { id: 'seal', name: 'Seal', turns: 2, harmful: true, data: {} });
  mael.gauge.value = 25;
  b.act(mael, { type: 'skill', skillId: 'unshackle', targetUid: siren.uid });
  check('Unshackle frees the ally', b.hasStatus(siren, 'seal'), false);
  const unshackle = mael.def.skills.find((s) => s.id === 'unshackle');
  check('Unshackle cannot target himself',
    b.validTargets(mael, unshackle).includes(mael), false);
  const cinne = b.party.find((u) => u.defId === 'cinne');
  b.addGauge(cinne, 100, 'test');
  check('Unshackle cannot reach Bloodrun',
    b.validTargets(mael, unshackle).includes(cinne), false);

  // Amplify formula: 210 + PWR×2 (L11 PWR 45 → 300)
  const storm = mael.def.skills.find((s) => s.id === 'stormbreak');
  check('[Stormbreak] power = 210 + PWR×2', storm.power(mael), 300);
}

console.log('— Mael: Maelstrom control-slip —');
{
  F.setRng(seeded(23));
  const b = new WS.Battle(WS.BATTLES.retrieval, {});
  const mael = b.party.find((u) => u.defId === 'mael');
  const earl = b.party.find((u) => u.defId === 'earl');
  const sergeant = b.enemies.find((u) => u.defId === 'bind_sergeant');
  const sealFx = WS.ENEMIES.bind_sergeant.skills.find((s) => s.id === 'collar_toss').effects[0];

  // chance 75 vs Earl (LCK 32) from the sergeant (LCK 12) = 55%. A 50-roll
  // lands without the Maelstrom, slips (27.5%) with it.
  F.setRng(() => 0.5);
  b.applyEffect(sergeant, sealFx, {}, earl.uid, {});
  check('without Maelstrom the collar lands', b.hasStatus(earl, 'seal'), true);
  b.removeStatus(earl, b.getStatus(earl, 'seal'));
  b.addStatus(mael, { id: 'awaken', name: 'Maelstrom', turns: 4, data: { controlSlip: 0.5 } });
  b.applyEffect(sergeant, sealFx, {}, earl.uid, {});
  check('with Maelstrom up the collar slips', b.hasStatus(earl, 'seal'), false);
}

console.log('— Mael: combos —');
{
  F.setRng(seeded(29));
  const events = [];
  const b = new WS.Battle(WS.BATTLES.retrieval, { onEvent: (e) => events.push(e) });
  const mael = b.party.find((u) => u.defId === 'mael');
  const earl = b.party.find((u) => u.defId === 'earl');
  const cinne = b.party.find((u) => u.defId === 'cinne');
  const sergeant = b.enemies.find((u) => u.defId === 'bind_sergeant');

  // absent partners: in the founding-four battles Mael's combos don't appear
  const four = new WS.Battle(WS.BATTLES.sparring, {});
  const earl4 = four.party.find((u) => u.defId === 'earl');
  check('Mael combos hidden without Mael',
    !!four.combosFor(earl4).find((c) => ['just_me', 'never_will_be'].includes(c.combo.id)), false);

  // "You don't have to be anything": unattuned Earl strikes the Ember sergeant
  // with his true element — Tide — and Ruptures without any Attune setup
  mael.gauge.value = 30; earl.gauge.value = 20;
  check('Earl is unattuned', earl.attuned, null);
  events.length = 0;
  b.act(mael, { type: 'combo', comboId: 'just_me', targetUid: sergeant.uid });
  const jm = events.filter((e) => e.type === 'damage');
  check('“Just me” lands one strike', jm.length, 1);
  check('…and it Ruptures with no Attune', jm[0].rupture, true);
  check('…costing Mael 25 Defiance', mael.gauge.value, 5);

  // "You're not like them": crit-storm + tempest, Tide then Gale, 5 hits
  cinne.gauge.value = 45; mael.gauge.value = 45;
  events.length = 0;
  b.act(cinne, { type: 'combo', comboId: 'never_will_be', targetUid: sergeant.uid });
  const nlt = events.filter((e) => e.type === 'damage');
  check('“Not like them” lands 5 hits', nlt.length, 5);
  check('…the Tide hit Ruptures the Ember sergeant', nlt.some((e) => e.rupture), true);
  check('…spending 40 Defiance', mael.gauge.value, 5);
  check('…and 40 Rage (plus on-hit gains)', cinne.gauge.value < 45, true);
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
  for (const c of b.combosFor(actor)) {
    if (!c.ok) continue;
    if (c.combo.target === 'enemy') {
      const foes = b.foesOf(actor);
      options.push({ type: 'combo', comboId: c.combo.id, targetUid: foes[Math.floor(r() * foes.length)].uid });
    } else options.push({ type: 'combo', comboId: c.combo.id });
  }
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
for (const id of ['gauntlet', 'proctor', 'retinue']) {
  let wins = 0, total = 10;
  for (let seed = 1; seed <= total; seed++) {
    const s = simulate(id, seed);
    check(`${id} #${seed} terminates`, s.result !== 'active', true);
    if (s.result === 'victory') wins++;
  }
  check(`${id} is winnable`, wins > 0, true);
  console.log(`  ${id}: random-play win rate ${wins}/${total}`);
}
{
  // the Retrieval Detail: Mael's systems must actually fire in play
  let wins = 0, total = 10, sawUnbound = false, sawSeal = false, maxDefiance = 0;
  for (let seed = 1; seed <= total; seed++) {
    const s = simulate('retrieval', seed);
    check(`retrieval #${seed} terminates`, s.result !== 'active', true);
    if (s.result === 'victory') wins++;
    for (const e of s.events) {
      if (e.type === 'status' && e.id === 'unbound') sawUnbound = true;
      if (e.type === 'status' && e.id === 'seal') sawSeal = true;
      if (e.type === 'gauge' && e.reason &&
        ['outnumbered', 'defied', 'ally down'].includes(e.reason)) maxDefiance = Math.max(maxDefiance, e.value);
    }
  }
  check('retrieval is winnable', wins > 0, true);
  check('the detail lands its Seals', sawSeal, true);
  check('Mael Breaks his bindings across sims', sawUnbound, true);
  check('adversity feeds Defiance across sims', maxDefiance > 0, true);
  console.log(`  retrieval: random-play win rate ${wins}/${total}, peak adversity-fed Defiance ${Math.round(maxDefiance)}`);
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
