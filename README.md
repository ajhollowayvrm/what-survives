# What Survives — Combat Prototype (v1)

One playable turn-based battle in the browser, built to the spec in
[docs/CLAUDE_CODE_HANDOFF.md](docs/CLAUDE_CODE_HANDOFF.md). Plain HTML/CSS/JS,
no build step; Phaser 3 is vendored in `js/vendor/` for the battle stage.

## Play it

Open `index.html` in a browser (double-click works — no server needed).
Battles render on a **Phaser stage** — pixel battlers on painted backdrops,
with the full juice ladder (lunges, hit bursts, camera shake, Amplify
cut-ins, synthesized SFX) per
[docs/art_direction_v0.1.md](docs/art_direction_v0.1.md). The original
text-mode client is preserved at `classic.html`.

Dev hooks: `index.html?battle=sparring` jumps straight into a battle;
add `&demo=1` and the party plays itself (screenshot/soak aid).

Six battles from the title screen, in difficulty order:

- **Sparring Match** (party level 5) — one Ember construct. Learn the loop:
  Siren's Tide attacks Rupture it for 2× damage and big gauge.
- **Training Gauntlet** (level 6) — three constructs, three elements. Each
  weakness has a different answer: Tide→Siren, Stone→Cinne, Gale→only
  Earl's Attune.
- **The Proctor's Detail** (level 9) — a fast Radiance duelist (hits hard,
  drags your turns back) with two escorts. Kill order matters.
- **The Retrieval Detail** (level 11) — **Mael joins the party.** Six of
  Korveth's finest sent to re-collar him: Seals, stat debuffs, turn-dragging
  chains. Outnumbered and bound is exactly where his Defiance rises — Break
  and Unshackle are the answer.
- **The Aspect-Warden** (party level 13) — the real fight. It cycles its
  Aspect (Ember → Stone → Tide) every 3 of its turns, so its weakness rotates;
  it Seals artes. Earl's Attune is how you keep up.
- **Warden and Retinue** (level 14) — the Warden flanked by a Tidebound and
  a Stonebound Shard. The hard run (~1 party KO per fight even in sims).

### The loop, in one paragraph

Turn order is tick-based CTB (high AGI acts more often; heavy moves cost
tempo — the queue at the top shows who's next). Hit an enemy with the element
*opposite* its own for a **Rupture**: 2× damage plus a flood of gauge. At 100
gauge, choose: **Awaken** (3 turns of empowered attacks) or **Amplify** (dump
it all into a signature move). Cinne's Rage is different — you *ride* it: more
Rage = more damage, but at 100 she Seizes into **Bloodrun** and you lose her
for 3 turns (and can't heal or buff her). Katariña runs on **Fervor**, built
by endurance and spent on invocations that arm everyone else's big moments.
Mael (from The Retrieval Detail on) runs on **Defiance**, fed only by
adversity — hits taken, debuffs landed, allies down, fighting outnumbered —
and spent breaking control: his own (**Break**) or an ally's (**Unshackle**).

## Repo layout

```
index.html            battle client, Phaser stage (GitHub Pages entry point)
classic.html          the original text-mode client (same engine, no canvas)
css/style.css
js/vendor/phaser.min.js   Phaser 3.90, vendored (no build step, works offline)
js/data/              elements, characters, enemies — ALL tuning numbers live here
js/engine/            formulas.js (math), battle.js (CTB, damage, gauges, statuses, AI)
js/ui/ui.js           classic DOM rendering, event playback, command menus
js/ui/sprites.js      generated pixel battlers + painted backdrops (art doc §9)
js/ui/stage.js        Phaser scene: battlers, placement, the juice ladder
js/ui/stage-ui.js     StageUI extends UI: playback → stage effects + SFX
js/ui/sfx.js          synthesized WebAudio sound (no assets)
js/main.js            title screen + turn loop (+ ?battle= / &demo=1 dev hooks)
test/run-tests.js     node test suite (unit tests + seeded auto-battle sims)
test/autoplay.html    soak tool: party plays itself (?battle=warden&mode=menu)
docs/                 design docs — CLAUDE_CODE_HANDOFF.md is the spec,
                      art_direction_v0.1.md is the look
```

## Testing

```
node test/run-tests.js
```

159 checks: formulas pinned to the design docs' worked examples (tick costs,
damage sanity, L1 HP values), affinity wheel, gauge triggers, Bloodrun,
Attune, combos, cooldowns, Mael's Defiance/Break/Unshackle/Maelstrom, plus
61 seeded auto-battles proving every fight terminates and every system
(aspect shift, Seal, Amplify, Bloodrun, Unbound) fires.

`test/autoplay.html` lets you *watch* a random-play battle to eyeball feel
and balance (`?battle=` any battle id, e.g. `sparring`, `retrieval`,
`warden`; add `&mode=menu` to drive the real command menus with synthetic
clicks).

## Deploy (GitHub Pages)

```
gh repo create what-survives --public --source . --push
gh api repos/{owner}/what-survives/pages -X POST -f build_type=workflow \
  || true  # or: repo Settings → Pages → deploy from branch → main /(root)
```

Then the game is live at `https://<user>.github.io/what-survives/`.

## Tuning decisions made while building (designer, please review)

Everything numeric is in `js/data/` — tune there, logic never has to change.

1. **Balance flag #1 (Last Dance overtuned):** fixed by **excluding the Rage
   damage bonus from Amplifies** (the handoff offered three options; this one
   keeps Rupture and crits intact on the move itself).
2. **Balance flag #3:** Katariña starts battles at **30 Fervor**.
3. **Cinne's Awaken (Split Second) costs 50 Rage**, like Last Dance. The
   handoff lists it at 100, but Rage at 100 *seizes* her — she could never
   choose it. Both vents at 50 preserves the ride-or-vent decision.
4. **Aspect-Warden retuned:** at the handoff's literal numbers the party
   killed it before it acted 3 times — its aspect cycle and Seal never
   appeared. HP 2200 → 3500, action weights ~0.55 (≈2 actions per party
   rotation), weaponAtk/arteBonus up. Sim-verified: ~6 boss actions and ~1.7
   aspect shifts per fight; random play wins ~95% with ~1 KO, so deliberate
   play is comfortable and careless play bleeds.
5. **The Da'Charta Stand's +50 gauge excludes Katariña herself** (otherwise
   it half-refunds its own 100 cost).
5b. **Rage runs hot by design** (playtest direction, after trying a tamer
   version and reverting it): fills per spec §6a including +8 on hit taken,
   and Last Dance's own hits feed Rage back, so it only *half*-vents.
   **Earl's Calm Down is the only real way to bring her down** — and it has
   a cooldown, so he can't always be there. Bloodrun is meant to happen.
5c. **The combo roster is in** (milestone 9, pulled forward), under a
   **Combos** root menu. Costs are my first pass: Friendstrike 15 gauge
   each; Watch and Learn 30 each (+25% coordination); "I Won't Let Them
   Hurt You Again" 30 Rage (2-turn redirect + vengeance bonus vs anyone
   who has hurt Earl); Calm Down free (its cost is Earl's turn). Combos are
   blocked if any participant is down or Seized; the Mael pair waits for
   Mael. Story-gating/unlocks deferred — everything is available in the
   prototype. Friendstrike's guaranteed Rupture applies to *both* hits if
   either element finds the weakness.
5d. **Cooldowns** (playtest feedback: Last Dance → Calm Down → repeat looped
   ~2000 damage). Skills can carry `cooldown: N` (ticks on the owner's
   turns); combos share one cooldown that ticks on any participant's turn.
   Current values: Last Dance 3, Friendstrike 4, Watch and Learn 6, the Vow
   5, Calm Down 4. Menus show ⏳ with turns remaining. (An earlier companion
   fix stopped Amplify hits from feeding the wielder's gauge; that was
   reverted on purpose — see 5b — the cooldowns alone gate the loop.)
6. **Earl's Amplify is named `[Prismbreak]`** and his Awaken `[Sigil Orbit]`
   — bracketed placeholders per the docs' convention, cue line "Mmhm!".
7. Not yet modeled from the docs: elemental status afflictions (so Earl's
   "status magnet" downside is inert), Awaken cost decay, item commands.
8. **Mael is in (milestone 9 complete).** Battles now carry an optional
   `party` roster (default: the founding four) — Mael fights only where
   listed, and combos with absent partners simply don't appear. His numbers,
   first pass: weaponAtk 30 / arteBonus 14 (a PWR bruiser; his artes are
   utility). Defiance fills per spec with **"outnumbered" read as living
   enemies > living party** — which is why the Retrieval Detail fields six.
   No passive fill: adversity only. Break's Unbound = cleanse + control
   immunity + 25% PWR for 2 turns; Unshackle can't target himself (that's
   Break's job) and — per spec — can never reach Bloodrun. **Maelstrom
   costs 100** like Siren's Awaken (same save-or-spend economy) and halves
   enemy status accuracy against the whole party. His Amplify is the
   placeholder **`[Stormbreak]`** (power 210 + PWR×2, cue "It was all… a
   lie!").
9. **Mael's combo costs, first pass:** "You Don't Have to Be Anything"
   25 Defiance + 15 Resonance, cooldown 5 — Earl strikes in the target's
   *opposing* element with no Attune (Gale, freedom, against the
   elementless), so it's a guaranteed Rupture against anything elemental;
   priced above Friendstrike for that certainty. "You're Not Like Them"
   40 + 40, cooldown 6 — Cinne's crit flurry then Mael's Tide + Gale burst,
   +30% vs `artificial`/`state` tags. (The entire prototype roster is
   state-tagged, so the bonus always applies for now — it starts mattering
   when Primal/wildlife enemies arrive.)
10. **Retrieval Detail tuning (sim-verified, 200 seeds):** random play wins
   95% with 0.92 party KOs — same calibration as the Warden. Seals land
   ~1.8/fight; Mael Breaks or Unshackles ~1.4×/fight, so the liberation
   kit has real work. His Defiance peaks at 53 on average and only reaches
   100 in 8% of random-play fights — under random play he vents at 25/30
   constantly, so `[Stormbreak]`/Maelstrom are things a deliberate player
   *banks* for. That's the intended ride-or-vent choice, left as is.

11. **Presentation layer (milestone 10): Phaser 3, vendored, generated art.**
   Engine untouched (it was already UI-agnostic via `onEvent`; the only change
   was adding `element` to damage events so hit bursts can be element-colored).
   `StageUI` subclasses the classic `UI` — menus/cards/log inherited, battlers
   and playback on canvas. Framework decision: Phaser over Godot/Unity because
   the JS engine + tests port for free and the browser playtest loop stays.
   Battler art is **generated placeholder pixel art** (silhouette-and-signal
   style, `docs/art_direction_v0.1.md`) drawn onto canvas textures at runtime —
   swapping in commissioned sprite sheets later needs no code changes beyond
   the texture loader. SFX are synthesized (WebAudio); music deferred.

## What's next (handoff milestone 9+)

- Status effect set (Burn/Poison/Weaken/Guard Break) and elemental statuses
- Amplify cost decay with attunement; bench/reserve system
- Story-gating for combo unlocks; "realness" progression on Earl from the
  Mael combo (currently mechanical only)
