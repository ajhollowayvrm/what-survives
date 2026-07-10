// Title screen + battle loop. The engine decides everything; this file just
// alternates "whose turn" between the player's menu and the AI, and lets the
// UI play back what happened.
(function () {
  const WS = globalThis.WS;
  const ui = new WS.UI();
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

  async function startBattle(battleId) {
    document.querySelector('#title-screen').classList.add('hidden');
    document.querySelector('#battle-screen').classList.remove('hidden');

    let alive = true;
    abortRun = () => { alive = false; };

    const battle = new WS.Battle(WS.BATTLES[battleId], { onEvent: ui.onEvent });
    ui.setup(battle);
    battle.log(`${WS.BATTLES[battleId].name} — begin.`, 'turn');
    await ui.playEvents();

    while (alive && battle.state === 'active') {
      const actor = battle.beginTurn();
      await ui.playEvents(); // turn-start regen/gauge ticks
      ui.renderAll();
      ui.markActive(actor);

      let action;
      if (battle.isPlayerControlled(actor)) {
        action = await ui.promptAction(actor);
      } else {
        await ui.sleep(650);
        action = battle.aiAct(actor);
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

  showTitle();
})();
