// Title screen + battle loop. The engine decides everything; this file just
// alternates "whose turn" between the player's menu and the AI, and lets the
// UI play back what happened. Pages that load stage-ui.js get the Phaser
// presentation; classic.html gets the original DOM one.
//
// Dev hooks: ?battle=<id> jumps straight into a battle; add &demo=1 and the
// party plays itself with random valid actions (screenshot/soak aid).
(function () {
  const WS = globalThis.WS;
  const ui = new (WS.StageUI || WS.UI)();
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo') === '1';
  let abortRun = null; // set when leaving a battle so a stale loop stops

  function showTitle() {
    if (abortRun) abortRun();
    document.querySelector('#battle-screen').classList.add('hidden');
    document.querySelector('#title-screen').classList.remove('hidden');
    const sel = document.querySelector('#battle-select');
    sel.innerHTML = '';
    for (const id of Object.keys(WS.BATTLES)) {
      const b = WS.BATTLES[id];
      const card = document.createElement('div');
      card.className = 'battle-card';
      card.innerHTML = `<h3>${b.name}</h3><p>${b.desc}</p>`;
      card.addEventListener('click', () => startBattle(id));
      sel.appendChild(card);
    }
  }

  // demo mode: any random valid action, chosen at the engine level
  function randomAction(battle, actor) {
    const cmds = battle.commandsFor(actor);
    const options = [];
    for (const c of cmds.skills) {
      if (!c.ok) continue;
      const targets = battle.validTargets(actor, c.skill);
      if (c.skill.target === 'enemy' || c.skill.target === 'ally') {
        if (!targets.length) continue;
        options.push({ type: 'skill', skillId: c.skill.id, targetUid: targets[Math.floor(Math.random() * targets.length)].uid });
      } else options.push({ type: 'skill', skillId: c.skill.id });
    }
    if (cmds.awaken && cmds.awaken.ok) options.push({ type: 'awaken' });
    if (cmds.attune && !actor.attuned) options.push({ type: 'attune', element: cmds.attune[Math.floor(Math.random() * 6)] });
    for (const c of battle.combosFor(actor)) {
      if (!c.ok) continue;
      if (c.combo.target === 'enemy') {
        const foes = battle.foesOf(actor);
        options.push({ type: 'combo', comboId: c.combo.id, targetUid: foes[Math.floor(Math.random() * foes.length)].uid });
      } else options.push({ type: 'combo', comboId: c.combo.id });
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  async function startBattle(battleId) {
    document.querySelector('#title-screen').classList.add('hidden');
    document.querySelector('#battle-screen').classList.remove('hidden');

    let alive = true;
    abortRun = () => { alive = false; };

    const battle = new WS.Battle(WS.BATTLES[battleId], { onEvent: ui.onEvent });
    await ui.setup(battle, battleId);
    battle.log(`${WS.BATTLES[battleId].name} — begin.`, 'turn');
    await ui.playEvents();

    while (alive && battle.state === 'active') {
      const actor = battle.beginTurn();
      await ui.playEvents(); // turn-start regen/gauge ticks
      ui.renderAll();
      ui.markActive(actor);

      let action;
      if (battle.isPlayerControlled(actor) && !demo) {
        action = await ui.promptAction(actor);
      } else {
        await ui.sleep(650);
        action = battle.isPlayerControlled(actor) ? randomAction(battle, actor) : battle.aiAct(actor);
      }
      if (!alive) return;

      battle.act(actor, action);
      await ui.playEvents();
      if (battle.state === 'active') {
        battle.endTurn(actor);
        await ui.playEvents();
      }
      ui.renderAll();
    }

    if (!alive) return;
    ui.markActive(null);
    ui.showEnd(battle.state, () => startBattle(battleId), showTitle);
  }

  const jump = params.get('battle');
  if (jump && WS.BATTLES[jump]) startBattle(jump);
  else showTitle();
})();
