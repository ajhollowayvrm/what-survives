// Game controller. Three screens — title, overworld, battle — and the flow
// between them. The battle engine and the overworld scene are each self-
// contained and UI-agnostic; this file is the only place that knows they exist
// together. It runs a battle to completion (returning the outcome) and lets the
// overworld hand off into battles and take control back.
//
// Dev hooks: ?battle=<id> jumps straight into a battle; ?map=<id> drops into an
// overworld map. add &demo=1 and battles play themselves (screenshot/soak aid).
(function () {
  const WS = globalThis.WS;
  const ui = new (WS.StageUI || WS.UI)();
  const dialogue = new WS.Dialogue();
  WS.dialogueActive = () => dialogue.active;   // overworld pauses input while this is true

  const params = new URLSearchParams(location.search);
  const demo = params.get('demo') === '1';
  let abortRun = null;   // set while a battle loop runs so a stale one can stop
  let ow = null;         // lazily-created overworld

  const $ = (s) => document.querySelector(s);
  function showScreen(id) {
    for (const s of ['title-screen', 'overworld-screen', 'battle-screen'])
      $('#' + s).classList.toggle('hidden', s !== id);
  }

  // ---------- title ----------
  function showTitle() {
    if (abortRun) abortRun();
    if (ow) ow.sleep();
    showScreen('title-screen');
    const sel = $('#battle-select');
    sel.innerHTML = '';
    for (const id of Object.keys(WS.BATTLES)) {
      const b = WS.BATTLES[id];
      const card = document.createElement('div');
      card.className = 'battle-card';
      card.innerHTML = `<h3>${b.name}</h3><p>${b.desc}</p>`;
      card.addEventListener('click', () => {
        showScreen('battle-screen');
        playBattle(id, { continueLabel: 'Return to Title' }).then(showTitle);
      });
      sel.appendChild(card);
    }
  }

  // ---------- overworld ----------
  async function enterOverworld(mapId) {
    if (abortRun) abortRun();
    showScreen('overworld-screen');
    if (!ow) {
      ow = new WS.Overworld();
      await ow.init('overworld-canvas');
      wireOverworld();
    } else {
      ow.wake();
    }
    ow.load(mapId);
  }

  function wireOverworld() {
    ow.onTalk = async (npc) => {
      ow.freeze();
      await dialogue.say(npc.lines, { name: npc.name });
      ow.unfreeze();
    };
    ow.onTrigger = async (trig) => {
      ow.freeze();
      try {
        if (trig.kind === 'battle') {
          let go = true;
          if (trig.confirm) go = await dialogue.confirm(trig.confirm);
          if (go) {
            ow.sleep();
            showScreen('battle-screen');
            await playBattle(trig.battle, { continueLabel: 'Continue ▸' });
            showScreen('overworld-screen');
            ow.wake();
          }
        } else if (trig.kind === 'dialogue') {
          await dialogue.say(trig.lines, { name: trig.name });
        }
      } finally {
        // enter-triggers put the player back where they stepped from, so the
        // trigger doesn't immediately re-fire and they aren't stuck on a door.
        if (trig.mode === 'enter') ow.placePlayer(ow.prevTile, ow.dir);
        ow.unfreeze();
      }
    };
  }

  // ---------- battle ----------
  // Runs one battle to completion; resolves with 'victory'/'defeat' when the
  // player leaves the end screen. Retry restarts in place without resolving.
  function playBattle(battleId, opts = {}) {
    return new Promise((resolve) => {
      let settled = false;
      async function start() {
        let alive = true;
        abortRun = () => { alive = false; };

        const battle = new WS.Battle(WS.BATTLES[battleId], { onEvent: ui.onEvent });
        await ui.setup(battle, battleId);
        battle.log(`${WS.BATTLES[battleId].name} — begin.`, 'turn');
        await ui.playEvents();

        while (alive && battle.state === 'active') {
          const actor = battle.beginTurn();
          await ui.playEvents();
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
        if (opts.continueLabel) $('#title-btn').textContent = opts.continueLabel;
        ui.showEnd(
          battle.state,
          () => start(),
          () => { if (!settled) { settled = true; resolve(battle.state); } },
        );
      }
      start();
    });
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

  // ---------- boot ----------
  $('#explore-btn').addEventListener('click', () => enterOverworld('academy_courtyard'));
  $('#ow-exit-btn').addEventListener('click', showTitle);

  const jumpBattle = params.get('battle');
  const jumpMap = params.get('map');
  if (jumpBattle && WS.BATTLES[jumpBattle]) {
    showScreen('battle-screen');
    playBattle(jumpBattle, { continueLabel: 'Return to Title' }).then(showTitle);
  } else if (jumpMap && WS.MAPS[jumpMap]) {
    enterOverworld(jumpMap);
  } else {
    showTitle();
  }
})();
