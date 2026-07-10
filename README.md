# What Survives — Combat Prototype (v1)

One playable turn-based battle in the browser, built to the spec in
[docs/CLAUDE_CODE_HANDOFF.md](docs/CLAUDE_CODE_HANDOFF.md). Plain HTML/CSS/JS,
no build step, no dependencies.

## Play it

Open `index.html` in a browser (double-click works — no server needed).

Two battles from the title screen:

- **Sparring Match** (party level 5) — one Ember construct. Learn the loop:
  Siren's Tide attacks Rupture it for 2× damage and big gauge.
- **The Aspect-Warden** (party level 13) — the real fight. It cycles its
  Aspect (Ember → Stone → Tide) every 3 of its turns, so its weakness rotates;
  it Seals artes. Earl's Attune is how you keep up.

### The loop, in one paragraph

Turn order is tick-based CTB (high AGI acts more often; heavy moves cost
tempo — the queue at the top shows who's next). Hit an enemy with the element
*opposite* its own for a **Rupture**: 2× damage plus a flood of gauge. At 100
gauge, choose: **Awaken** (3 turns of empowered attacks) or **Amplify** (dump
it all into a signature move). Cinne's Rage is different — you *ride* it: more
Rage = more damage, but at 100 she Seizes into **Bloodrun** and you lose her
for 3 turns (and can't heal or buff her). Katariña runs on **Fervor**, built
by endurance and spent on invocations that arm everyone else's big moments.

## Repo layout

```
index.html            battle client (GitHub Pages entry point)
css/style.css
js/data/              elements, characters, enemies — ALL tuning numbers live here
js/engine/            formulas.js (math), battle.js (CTB, damage, gauges, statuses, AI)
js/ui/ui.js           rendering, event playback, command menus
js/main.js            title screen + turn loop
test/run-tests.js     node test suite (unit tests + seeded auto-battle sims)
test/autoplay.html    soak tool: party plays itself (?battle=warden&mode=menu)
docs/                 the five design docs — CLAUDE_CODE_HANDOFF.md is the spec
```

## Testing

```
node test/run-tests.js
```

57 checks: formulas pinned to the design docs' worked examples (tick costs,
damage sanity, L1 HP values), affinity wheel, gauge triggers, Bloodrun,
Attune, plus 21 seeded auto-battles proving both fights terminate and every
system (aspect shift, Seal, Amplify, Bloodrun) fires.

`test/autoplay.html` lets you *watch* a random-play battle to eyeball feel
and balance (`?battle=sparring|warden`, add `&mode=menu` to drive the real
command menus with synthetic clicks).

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
5b. **Rage accrues only from Cinne's own actions** (playtest feedback: the
   +8-per-hit-taken on top of her action rate seized her too fast — she now
   maxes in ~7 unmanaged turns of her own). **Calm Down (Earl → Cinne) is
   pulled forward from the milestone-9 combo roster** as the vent tool:
   Rage −40, Earl +20 Resonance, and it cannot reach her during Bloodrun.
6. **Earl's Amplify is named `[Prismbreak]`** and his Awaken `[Sigil Orbit]`
   — bracketed placeholders per the docs' convention, cue line "Mmhm!".
7. Not yet modeled from the docs: elemental status afflictions (so Earl's
   "status magnet" downside is inert), Awaken cost decay, item commands.

## What's next (handoff milestone 9+)

- Mael (Defiance gauge, Break/Unshackle) — the answer to Seal
- Remaining combo moves (Friendstrike, Watch and Learn…) — Calm Down is in
- Status effect set (Burn/Poison/Weaken/Guard Break) and elemental statuses
- Amplify cost decay with attunement; bench/reserve system
