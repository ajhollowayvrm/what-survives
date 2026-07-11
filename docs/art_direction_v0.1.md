# Art Direction v0.1 — "Grief Under Gilt"

*Taste-lock for the game's look. v0.1 ships with **generated placeholder art** built to
this spec; every rule here survives the eventual swap to commissioned sprites, because
the rules are about palette, silhouette, and restraint — not rendering technique.*

---

## 1. The one-line vision

**A somber empire lit by borrowed light.** Dark slate and cold night-blues everywhere;
imperial gold used thin and sparingly (gilt, not glow); the six elements are the only
saturated voices in the frame. When color shouts, it's because a Reason is speaking.

This inverts the usual JRPG brightness: the world is muted because the world is hollow
— grief hollows, the state hollows, the Artificial process hollows. Rupture, Awaken,
and Amplify feel loud partly because everything around them is quiet.

## 2. Style: silhouette & signal

Battlers are **chunky pixel figures** (3× nearest-neighbor scale, no antialiasing):

- **Silhouette first.** Each character must be identifiable at 100% black. Cinne's
  ponytail and twin daggers, Katariña's staff and mantle, Mael's chain — shape carries
  identity, not facial detail.
- **One signal per character.** A single saturated accent (their canonical color) on a
  dark body: Siren's gauntlet-blade glow, Earl's quill tip, Katariña's totem feather.
  Everything else stays within the base palette.
- **Rim light, not outlines.** Figures get a 1px edge of their accent color on the lit
  side — cold light from the world, warm identity from the character.

**Enemy design language:** the state's machines are **geometry around a single glowing
core** — boxes, plates, and shards arranged around a light that isn't theirs. (The
"hollow" motif made visible: a container for borrowed Resonance.) The core takes the
element color; the chassis stays iron-dark with gilt inlay for rank.

## 3. Palette (canonical — matches `js/data/elements.js` / `js/ui/ui.js`)

| Role | Hex | Notes |
|---|---|---|
| Background base | `#0b0e14` | near-black navy, never pure black |
| Panel / chassis | `#121826` / `#232c42` | slate family |
| Text light | `#d7dfef` | cold paper |
| Imperial gilt | `#ffd166` (thin) / `#8a7434` (cloth trim) | authority, Awaken |
| Blood / Rage | `#e3405f` | Cinne's bar, Bloodrun, defeat |
| Ember | `#ff6b3d` | Tide `#3fa7d6` · Gale `#8ee06e` · Stone `#c2a878` · Radiance `#ffd166` · Umbra `#9b5de5` |
| Siren | `#3fa7d6` | Cinne `#8ee06e` · Earl `#c9b8ff` · Katariña `#e8a33d` · Mael `#4db6ac` |

Rule of thumb per frame: **90% base palette, 9% one accent, 1% white** (hits, eyes,
blade edges).

## 4. Character sheets (silhouette / signal / weapon / read)

- **Siren** — medium build, Academy slate coat, teal sash. Signal: **Hymerdom**, the
  segmented gauntlet-blade wrapping his right arm, edge-lit teal. Reads: steady, planted;
  idle is a slow breath, not a bounce.
- **Cinne** — slim, high ponytail, fitted dark leathers, gale-green scarf. Signal: twin
  dagger glints. Reads: coiled; her idle sits lower, weight forward. In Bloodrun her rim
  light turns blood-red — the only time a character's accent changes.
- **Earl** — small, soft posture, lavender-trimmed uniform, fluffy light hair. Signal:
  the quill-wand's violet tip; when attuned, a floating element-colored gem above him
  (the manufactured boy wearing an element that isn't his).
- **Katariña** — tallest, broad, fur-and-leather mantle over earth tones, dark braid,
  a paint stripe across the face. Signal: the **Staff of Nagandahl**'s totem head with a
  teal feather. Reads: rooted — she barely moves, the world moves around her.
- **Mael** — broad like a door, storm-grey coat, chain crossing his chest to the
  chain-blade **Heanmetal** at his right fist. Signal: the chain's pale links (forged
  from his own manacles). Same dark hair as Siren — they must read as brothers.

**Enemies:** constructs = riveted boxes on treads, core color = element; Shards =
floating crystal clusters; Chainhounds = low quadrupeds with chain tails; human
agents (Proctor, Bind-Sergeant, Bindwright) = the uniform silhouette with rank gilt;
the **Aspect-Warden** = a monolith with one great eye — the eye *is* its Aspect and
re-tints when it shifts (Ember→Stone→Tide), so its weakness is always readable on-screen.

## 5. Stage & backdrops

Side-view battles, party right, enemies left, on painted low-detail backdrops
(960×540 logical, letterboxed to fit). Backdrops obey the palette and stay dark at the
edges (vignette) so battlers pop. Three v1 themes:

- **hall** (Sparring, Gauntlet, Proctor) — Academy training hall: tall arched windows,
  pale god-rays, gilt banners, a worn sparring circle on the floor.
- **night** (Retrieval) — a frontier road at night: moonlight, watch-fires, the convoy
  the party ambushes.
- **vault** (Warden fights) — a Korveth vault: massive door rings, cold light shafts.

Ambient dust motes drift in the light. That's it — backdrops are stage sets, not scenes.

## 6. Motion & juice (the loudness ladder)

Restraint below, spectacle above — each tier must feel bigger than the last:

1. Basic hit — attacker lunge, white hit-flash on target, small popup, thud.
2. Crit — gold popup, ping, slightly bigger burst.
3. **Rupture** — freeze-beat, zoom punch, camera shake, white flash, element-colored
   burst, big orange "RUPTURE!", loud crash. The loop's heartbeat; nothing else at
   this tier.
4. Awaken — gold banner + persistent aura on the battler for its duration.
5. **Amplify / Combo** — the screen goes dark, letterboxed; the battler steps into
   light and scales up; the spoken cue in large serif italic; then the flash and the
   hit. These are the game's cinematics — the cue line *is* the animation.

## 7. UI & typography

Dark panels, 1px slate borders, thin gilt only on Awaken/Amplify affordances. Numbers
in tabular sans. Display type (title, cue lines, names) in a **serif italic** —
liturgical, an empire that writes scripture on its weapons. Placeholder stack:
Cormorant Garamond → Georgia. Gauges keep their canonical colors so a glance reads
the party's state.

## 8. Audio direction (v1)

Synthesized minimal SFX (WebAudio, no assets): dry thuds and pings under the loudness
ladder, one deep swell for Amplify, a heartbeat for Bloodrun. Music deferred — silence
suits the tone until we can do leitmotifs properly (Siren/Tide theme first).

## 9. Pipeline to real art (the swap path)

Placeholders are generated at runtime onto canvas textures, keyed by character/enemy id.
Real art replaces them by dropping PNG sprite sheets with the same keys and sizes — no
code changes beyond the texture loader:

- humanoid battler: 40×48 px per frame, 2-frame idle (later: attack/hurt/KO rows)
- large boss: 72×88 · shard 40×48 · hound 48×36
- backdrops: 960×540 painted panels

When commissioning: this doc + the character sheets above are the brief. Non-negotiables
for the artist: silhouette-first, one-accent rule, the palette table, and the Warden's
readable eye.
