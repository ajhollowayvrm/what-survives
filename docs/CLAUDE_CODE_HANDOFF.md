# Claude Code Handoff — Build Spec: Combat Prototype

*Read this first. It's a build-ready distillation of the four design docs (jrpg_system, cast_and_kits, world_lore, story_structure). Those docs hold the lore/story/character depth; **this doc holds the numbers and the plan.** Point Claude Code at all five files.*

---

## 0. What we're building (and NOT building)

**Goal of v1:** ONE playable turn-based battle, in the browser. Not the game. Not a town, not a story, not menus beyond the battle. Just: a party of characters fights an enemy, using the real combat system, and it's *fun to press the buttons.*

**Why this scope:** the combat system is the most-designed, most-exciting, most-testable piece. A single working battle proves (a) the pipeline works end-to-end, and (b) whether the mechanics are fun — the only question that matters before building anything bigger.

**Tech stack (recommended):**
- **Plain HTML/CSS/JavaScript** (or **Phaser 3** if we want sprites/animation later). The battle is menu-driven — numbers, turn order, effects — so it does NOT need a heavy engine.
- **Pipeline:** Claude Code (local) → git → GitHub → **GitHub Pages** (free hosting, live URL). Confirm this works with a "hello world" page *before* building the battle.
- Keep all game data (characters, enemies, skills) in **separate JS/JSON data files** so tuning doesn't require touching logic.

---

## 1. Build order (milestones — build in this order, test each)

1. **Skeleton:** HTML page + a `hello world`, pushed live to GitHub Pages. Prove the pipeline.
2. **Data layer:** define stat blocks, skills, elements as data (Section 5–7).
3. **Turn engine (CTB):** compute turn order from AGI (Section 3). Render the upcoming turn queue on screen.
4. **Basic attack + damage:** one character, one enemy, physical damage formula (Section 4). Numbers appear, HP drops.
5. **Elements + Rupture:** add affinities; hitting a weakness does 2× and *feels* loud (Section 6).
6. **The Resonance gauge + one Amplify:** Siren fills Resonance, spends it on "We Came For You" (Section 5).
7. **Full starting party (4):** Siren, Cinne, Earl, Katariña — each with their gauge (Section 7). This is the real test.
8. **A real enemy with an affinity shift** (Section 8). Now it's a fight.
9. *(Later)* Mael, combos, status effects, the Amplify balance fix.

---

## 2. Core stats (every combatant)

`VIT · PWR · FOC · SPR · GRD · WRD · AGI · LCK`

- **HP** = `40 + VIT*8 + level*6`
- **MP** = `10 + FOC*2 + level*1` (artes cost MP)
- **Resonance / gauge** = 0–100 (per-character; see Section 7)
- Characters have a **level**; each level adds their per-stat growth (Section 7 blocks show `base (+growth)`).

---

## 3. Turn system — CTB (Conditional Turn-Based)

Each actor has a `nextTurn` tick counter. **Lowest acts next.** After acting, push their counter forward:

```
nextTurn += round( BASE_TICK / AGI * actionWeight )
BASE_TICK = 300
actionWeight: fast = 0.7 | normal = 1.0 | heavy = 1.5
```

- Initialize each actor's `nextTurn` to their first action cost.
- Always render the next ~6 actors in the queue (players love seeing turn order).
- Higher AGI = acts more often (not just first). Heavy moves cost tempo.

---

## 4. Damage formulas

```
physical = (PWR + weaponAtk) * (skillPower/100) * affinity * (100/(100+GRD)) * variance * crit
arte     = (FOC + arteBonus) * (skillPower/100) * affinity * (100/(100+WRD)) * variance * crit
```
- `skillPower`: basic attack = 100; artes ~60 (cheap) to 250+ (signature).
- `variance` = random 0.95–1.05
- `crit` = 1.5 on crit, else 1.0. **Crit chance = 5% + LCK/2 (%)**
- `affinity` = see Section 6.
- Round to integer. Never below 1 (except Null = 0).

---

## 5. Resonance, Awaken & Amplify (the core loop)

The signature system. The **standard gauge is "Resonance" (0–100)**; some characters rename/reflavor it (Section 7).

**Fill (standard):** `+SPR/10 per turn` · `+4 on hit dealt` · `+15 on Rupture` · `+6 on hit taken`

**At 100, choose ONE:**
- **Awaken** (3 turns): weaponAtk ×1.5, unlocks Awakened-only artes, a manifestation flares. *(Cost decays with attunement; at high mastery, free.)*
- **Amplify** (spend full gauge): a signature move whose power scales off the wielder: `amplifiedPower = basePower + (SPR * ampCoef)`. **Amplifies are unique per character** and get a cinematic beat + spoken cue.

---

## 6. Elements & affinity (Rupture)

Six elements: **Ember, Tide, Gale, Stone, Radiance, Umbra** (+ Silence reserved, not in v1).

**Opposed pairs:** Ember⚔Tide · Gale⚔Stone · Radiance⚔Umbra

| Result | When | Multiplier | Extra |
|--------|------|-----------|-------|
| **Rupture** | hit with the OPPOSITE of target's element | **2.0** | **+15 gauge** to attacker; big screen/sound feedback |
| Neutral | any non-paired element | 1.0 | — |
| Resist | hit with target's OWN element | 0.5 | — |
| Null / Absorb | special enemies only | 0 / heal | — |

Rupture is the heart of the loop: it does double damage AND fuels signature moves. Make it *feel* loud.

---

## 7. The starting party (build-ready data)

*Stat format: `base (+growth per level)`. weaponAtk ≈ 28 unless noted. Skills: name — type, skillPower, effect (cost).*

### SIREN — Tide — gauge: **Resonance** (standard, "Spend")
`VIT 14(+3) PWR 13(+3) FOC 8(+1) SPR 16(+4) GRD 12(+2) WRD 9(+1) AGI 11(+2) LCK 10(+2)` — Reason: **Hymerdom**
- Basic — phys, 100
- **Deadweight** — arte, 120, chance to **Freeze/Stagger** (push target's CTB back) (MP 6)
- **Breakwater** — support, +GRD/WRD to an ally + small SPR-scaled shield (MP 10)
- **Full Fathom** — arte AoE, 90 to all, heavy (MP 14)
- **Awaken "Watermark"** (3 turns): weaponAtk ×1.5, nearby allies take reduced damage
- **AMPLIFY "We Came For You"** — power = `220 + SPR*2.5`; ALSO grants party a barrier absorbing `SPR*4`. Cue: *"We came for you…"*

### CINNE — Gale — gauge: **Rage** ("Ride" — push-your-luck)
`VIT 11(+2) PWR 14(+3) FOC 9(+1) SPR 12(+2) GRD 8(+1) WRD 8(+1) AGI 16(+4) LCK 15(+3)` — Reason: **Fleshound** (daggers)
- Basic — phys, 100, **fast** (0.7 weight)
- **Needlework** — 2–3 fast hits, each rolls crit independently (MP 6)
- **Overtake** — sharply reduce her next action's tick cost (fast) (MP 8)
- **Opening** — mark target: next hit on it is guaranteed crit + ignores some GRD (MP 7)
- **Awaken "Split Second"** (3 turns): +crit chance, tempo
- **AMPLIFY "Last Dance"** — hits = `4 + floor(AGI/15)`; each hit power 70; crit chance during = `base+40%`. Cue: *"Try to keep up."* **⚠️ SEE BALANCE FLAG (Section 10).**
- **RAGE gauge (0–100):**
  - Fills: `+12 crit landed` · `+4 hit landed` · `+8 hit taken` · `+3 passive/turn`
  - **Damage bonus: +0.5% dmg per Rage point** (up to ~+50%). *You want it high.*
  - **Last Dance costs 50 Rage** (vent).
  - **At 100 → "Bloodrun" (3 turns):** player LOSES control (she auto-attacks nearest/random, allies not safe) AND **cannot be targeted by items/heals/buffs.** Buffs: +50% crit, +PWR/AGI, acts every turn. Ends: Rage→0, 1-turn accuracy dip.

### EARL — elementless — gauge: standard, quirk: **Attunement** ("Aim")
`VIT 9(+1) PWR 8(+1) FOC 15(+4) SPR 11(+2) GRD 8(+1) WRD 12(+2) AGI 14(+3) LCK 12(+2)` — Reason: **[Quill]**
- **Elementless default:** takes 1.0× from ALL elements (never Ruptured) BUT can be hit by every element's status.
- **Attune [element]** — full action, no damage, sets his active element; grants +gauge. (He can Rupture only while attuned; gains a weakness to that element's opposite.)
- **Prism Lance** — arte in current attuned element; on Rupture, big dmg + refund gauge to allies (MP 10)
- **AMPLIFY [pending name]** — big FOC-scaled burst in attuned element
- *(Note: Earl is a "setup" caster — spend a turn to aim, then unload.)*

### KATARIÑA — "Spirit" (no standard element; can't be Ruptured) — gauge: **Fervor** ("Give")
`VIT 17(+4) PWR 13(+2) FOC 11(+2) SPR 16(+4) GRD 15(+3) WRD 12(+2) AGI 8(+1) LCK 10(+2)` — Reason: **Staff of Nagandahl**
- **No elemental affinity** (neither weak nor strong; can't be Ruptured)
- **FERVOR gauge (0–100):** fills `+10 hit taken` · `+SPR/10 passive` · `+6 when an ally lands a Rupture` · `+15 when an ally drops critical`
- **Rootbind** (25): totem, party regen ~8% maxHP/turn, 3 turns
- **Ancestral Roar** (35): push ALL enemies' CTB back + −GRD to all, 3 turns
- **Old Blood** (30): phys strike, power 180, ignores 50% of GRD
- **Kindle** (40): +40 to a chosen ally's gauge AND +30% to their next Amplify
- **AMPLIFY "The Da'Charta Stand"** (needs 100): party-wide +50 gauge, +25% each ally's next Amplify, party regen 2 turns
- ⚠️ Very slow (AGI 8) — consider a small starting Fervor so she's not dead weight early (Section 10).

### MAEL — Tide→awakens Gale ("tempest") — gauge: **Defiance** ("Spend", adversity-fed) — *(add in milestone 9)*
`VIT 15(+3) PWR 15(+3) FOC 9(+1) SPR 12(+2) GRD 13(+3) WRD 10(+2) AGI 10(+2) LCK 11(+2)` — Reason: **Heanmetal** (chain-blade)
- **DEFIANCE gauge:** fills `+8 hit taken` · `+10 when debuffed` · `+2 per enemy action while outnumbered` · `+10 ally down`
- **Break** (30): cleanse own debuffs, control-immunity 2 turns, +25% PWR 2 turns
- **Unshackle** (25): cleanse one ally of all debuffs/control *(cannot touch Cinne's Bloodrun)*
- **Awaken:** maelstrom — weaponAtk ×1.5, nearby enemies' status accuracy reduced
- **AMPLIFY "[name pending]"** — power = `210 + PWR*2`. Cue: *"It was all… a lie!"*

---

## 8. Enemy for the first real fight

**Grunt (milestone 4–6 testing):** "Academy Sparring Construct" — HP 300, PWR 30, GRD 25, AGI 20, element **Ember** (so Siren/Tide can Rupture it). Simple basic attacks.

**Boss (milestone 8):** **"Aspect-Warden"** (Korveth war-construct) — HP ~2200 (scale to party level ~13), PWR 55, GRD 50, AGI 22.
- **Cycles its Aspect every 3 turns:** Ember → Stone → Tide → (repeat). Its current Aspect = its element (so its weakness rotates: Tide, then Gale, then Ember). This forces the party to adapt and makes Earl's Attune shine.
- Can inflict **Seal** (locks a target's artes 2 turns) — which is where Mael's Unshackle matters.

---

## 9. Combo moves (add after the party works)

Joint abilities; require both participants active; cost gauge/cooldown:
- **Friendstrike** (Siren+Earl): coordinated 2-hit, guaranteed Rupture if either element hits weakness
- **Calm Down** (Earl→Cinne): Cinne Rage −40 (prevention, not usable during Bloodrun)
- **Watch and Learn** (Siren+Cinne+Earl): chained triple hit, +25% coordination bonus
- **"I won't let them hurt you again"** (Cinne→Earl): Cinne guards Earl + bonus vs. whoever hurt him
- **"You don't have to be anything / Yeah, just me!"** (Mael+Earl): Earl strikes with a real element, no Attune setup
- **"You're not like them / and I never will be!"** (Cinne+Mael): dual burst, bonus vs. Artificial/state enemies

---

## 10. Known balance flags (respect these)

1. **⚠️ Cinne's "Last Dance" is overtuned.** Rupture ×2 · crit ×1.5 · Rage +~50%, across many hits, stacks multiplicatively → can hit ~950 (way too high). **Fix:** exclude the Rage damage bonus from Amplifies, OR cap Rupture on multi-hit moves, OR reduce Last Dance to ~5 hits. Pick one; don't let all three multipliers ride.
2. **Bloodrun must stay scary.** With the Rage damage bonus, players may *want* to seize — so the loss of control + no-healing downside must bite. Don't soften it.
3. **Katariña too slow early** (AGI 8) — give a small starting Fervor or a cheap early tool so she contributes before mid-fight.
4. **Control without Mael hurts** by design — fine, but don't make Seal/status so common that benching Mael feels forbidden.

---

## 11. Where the depth lives (the other four docs)

- **jrpg_system_v0.1.md** — full combat system + the world-canon front-matter (alignment ladder, Primal, Silence, Artificials).
- **cast_and_kits_v0.1.md** — every character in full: lore, arcs, relationships, gauges, combos.
- **world_lore_v0.1.md** — the founding myth, the six houses, the three Saints, the Church, Gesherimi, cosmology.
- **story_structure_v0.1.md** — Acts 0–7, both endings, the stinger.

**Start with the battle. Make it fun. Everything else grows from there.**
