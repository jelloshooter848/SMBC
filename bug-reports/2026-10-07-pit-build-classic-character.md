# Classic SMBC: add Pit and Dark Pit as Classic Samus variants (crouch-walk, no beam from the crouch, no walking while aiming up, no morph ball, lower shots); optional phase 2 for the cut bow-and-arrow Pit

- **Severity:** feature request (new character, Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=pit` or `&char=darkpit` (once the toggle exists; today `?dev=1&level=1-1&char=samus` shows the Current behaviour, and `char=pit` falls back to Mario)
- **Character and power:** Pit and Dark Pit, all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=samus`. This is Current Samus: Down curls into the morph ball at once, and she can't crouch.
2. Once built, open `?dev=1&rules=classic&level=1-1&char=samus`. Classic Samus crouches on Down, can't move while crouched, and curls into the ball on a second Down.
3. Open `?dev=1&rules=classic&level=1-1&char=pit`. Hold Down and Right: Pit walks in the crouch pose. Press Attack while crouched: nothing fires. Press Jump: he jumps and stays in the crouch pose while Down is held.
4. Stand still, hold Up and press Right: Pit doesn't move. Fire a beam while standing: it comes out lower than Classic Samus's. Press Down twice: no morph ball.
5. Take a Mushroom (missiles), crouch and press Special: a missile fires from the crouch.
6. Open the same link with `&char=darkpit`: the same rules. Set Rules back to Current: neither hero is on the character select.

## Expected

The Classic SMBC spec. **Part A** (PI-1 to PI-25) is the shipped form: Pit and Dark Pit are **Classic Samus with six rule changes** (PI-7, PI-8, PI-9, PI-13, PI-15, PI-17) and their own look and sound. Every value not listed here is Classic Samus's, as specified in `2026-10-07-samus-classic-smbc-rules.md`. Where this report restates a Classic Samus value and the Samus report gives a different number, the Samus report wins: both cite the same source lines. The crouch hitbox is Classic Samus's 12 × 15 (PI-3, SA-C4). **Part B** (PI-S1 to PI-S14) is an optional phase 2 for the cut standalone Pit; build it only if the owner asks.

Both use the Classic shared systems: power states (`2026-10-07-classic-power-states.md`), enemy HP and armour (`2026-10-07-classic-enemy-hp-and-armour.md`), bricks and shots (`2026-10-07-classic-bricks-and-shots.md`) and swimming (`2026-10-07-classic-swimming.md`). They appear only while dev mode is on and Rules is Classic SMBC (the TG requirements in `2026-10-07-dev-classic-smbc-rules-toggle.md`).

### 1. Status in 3.1.21

- **Skin only (shipped).** Pit plays in 3.1.21 only as two Samus graphics sets: skin 6 "Pit" (Kid Icarus) and skin 11 "Dark Pit" (Kid Icarus: Uprising). Both pass the same `Samus.skinSettingsWrite(22, true, false, true, false, SFX_PIT_SHOOT, SFX_PIT_JUMP)` (`BmdInfo.as:1127, 1147`). The skin menu text is "Can move and jump while crouching, can't move while aiming up, no bombs".
  - Fidelity: every rule is a flag read in `Samus.as`, so Part A can match the original exactly. Only art, sounds and music are missing.
- **Cut (standalone).** `Pit.as` is an unfinished fork of Samus. Its roster row and graphics sets are commented out, its constructor body is commented out, it would not compile (`REPOSITION_BULLETS_DCT` is declared only in `Samus.as`), and its class code is not in the shipped SWF. Only its art shipped. Part B describes what the draft would do; it was never playable.

### Part A: Pit and Dark Pit (Classic Samus variants)

### 2. Character definition

**PI-1. Two definitions from one factory.** Add two `CharacterDef`s (`src/game/characters/character.ts:103-147`), built by the Classic Samus definition with variant options. Every field not in this table is copied from Classic Samus.

| Field | Pit | Dark Pit |
|---|---|---|
| `id` | `pit` | `darkpit` |
| `name` | `Pit` | `Dark Pit` |
| `hudName` | `PIT` | `D.PIT` |
| `movement`, `damage`, `stomps` (false), `drop`, `blockPowerUp`, `tools`, `devKit` | Classic Samus's | same |
| `crouches` | `false`, as `SAMUS_CLASSIC`: the crouch is handled in `behaviour.update` (Samus report, implementation hints) | same |
| `canBreakBricks` | Classic Samus's (head bumps only; shots break bricks) | same |
| `hitbox` | Classic Samus's 12 × 24, and **12 × 15 while the crouch pose shows** (PI-3) | same |
| `sprite` | Classic Samus's function, palette prefix `pit`, plus the `crouch` frame for the crouch pose | prefix `darkpit` |
| `jumpSfx` | `pit-jump` | same |
| `portrait` | `{ sheet: 'samus', palette: 'pit', frame: 'idle' }` | `palette: 'darkpit'` |
| `guide` | `PIT_CLASSIC_GUIDE` (PI-25) | the same guide with the name changed |
| `rules` | `'classic'` (TG-41: a Classic-only hero) | same |
| Variant options (new) | `crouchWalk: true`, `airCrouchPose: true`, `noBeamInCrouch: true`, `noWalkWhileAimUp: true`, `morphBall: false`, `standShotHeight: 11 px`, `beamSfx: 'pit-shoot'` | the same |

Classic Samus itself uses the defaults: `crouchWalk: false`, `airCrouchPose: false`, `noBeamInCrouch: false`, `noWalkWhileAimUp: false`, `morphBall: true`, `standShotHeight: 22 px`, her own beam sounds.

**PI-2. Roster and select-screen slot.** Register both in `CLASSIC_EXTRAS` (TG-41) at Pit's place in its order (Bass, Sophia III, Proto Man, **Pit, Dark Pit**, Vic Viper, Warriors of Light), so they show on the select screen's second row only while dev mode is on and Rules is Classic SMBC. `?char=pit` and `?char=darkpit` then work through TG-41's roster; otherwise the unknown id falls back exactly as today. Locking, saves and rooms follow TG-42 and TG-43.

**PI-3. Hitbox.** Standing, walking, jumping and aiming up: Classic Samus's 12 × 24 px (SA-C4, SA-C11). **In the crouch pose (ground or air): 12 × 15 px**, bottom-aligned, so a crouching Pit fits through a 1-tile-high (16 px) gap, walking or jumping. Call `refitHitbox()` whenever the pose changes.

Why: in the original each animation frame carries its own hit rectangle, and collision uses it (`AnimatedObject.setHitPoints` copies the current frame's `HRect` into `hTop`/`hBot`/`hLft`/`hRht`, `main/AnimatedObject.as:297-315`). Extracted from the SWF for this report (`SamusMc`, sprite 85; the Pit skins share this timeline):

| Pose | Flash px | Ours |
|---|---|---|
| Standing, walking, aiming up | 27 × 62 | 13.5 × 31 px |
| Jumping, somersault | 27 × 50 | 13.5 × 25 px |
| **Crouch (ground or air)** | 27 × 31 | **13.5 × 15.5 px** |

The original crouch box is under one tile; 15 px keeps that in whole pixels. The same mechanism is what lets the original's Mega Man slide under 1-tile gaps (his `slide` frame's box is 15 px tall). This is the same 12 × 15 box Classic Samus uses while crouched (SA-C4, from the same SWF frames). Pit differs only in when the box is used: also while crouch-walking and in the air crouch pose, because crouch-walking through gaps is his skin's main gameplay.

**PI-4. Per-player rules.** The flags belong to the hero. In 2-player, a Pit next to a Samus keeps his own rules.

### 3. Controls

**PI-5.** Controls in Classic, with the differences from Classic Samus in bold:

| Input | Pit / Dark Pit |
|---|---|
| Left / Right | Walk, instant start and stop. **Also while crouched.** **Not on the ground while Up is held.** |
| Jump | Jump from the ground. **Also from the crouch; the crouch pose stays while Down is held.** |
| Up (held) | Aim straight up (standing or in the air). |
| Down (held), on the ground | Crouch. **He can walk and jump while crouched.** **The crouch lasts only while Down is held** (Classic Samus's crouch is latched, SA-C4). **A second Down does nothing (no morph ball).** |
| Down (held), in the air | **Crouch pose and crouch hitbox** (Classic Samus curls into the ball instead). |
| Attack | Fire the beam (3 shots on screen, shared with missiles). **Nothing while the crouch pose shows.** |
| Special | Fire a missile, if he has missiles. **Also from the crouch.** |
| Select | Nothing, as Classic Samus. With `&kit=full`: switch the Flower beam between Wave and Ice (SA-C11, TG-44). |
| On a vine | Climb; no attacks. |

### 4. Movement and jumping

**PI-6. Inherited constants.** Every constant is Classic Samus's (SA-C3, SA-C6 to SA-C9). For reference (`Samus.as:207, 223, 398-412`; fact-check B):

| Constant | Flash | Ours | Fixed point |
|---|---|---|---|
| Walk (instant, also crouched) | 185 px/s clamped by `vxMax = 150` | **1.25 px/f** | `0x01400` |
| Jump take-off | 500 px/s | 4.1667 px/f; profile `initial` 4.0693 px/f (one frame of gravity less, SA-C6) | `0x0411C` |
| High Jump (580) | can't be obtained in 3.1.21 | not used | |
| Gravity | 700 px/s² | 0.0972 px/f² | `0x0018E` |
| Max fall | 450 px/s | 3.75 px/f | `0x03C00` |
| Full jump apex | ≈ 179 px | 87 px, 5.4 tiles, on frame 42 (stepped, SA-C6) | |
| Jump release | `vy × 0.0001^dt` while rising | `vy × 0.8577` per frame while rising (SA-C7) | |
| Somersault | needs Left/Right at take-off, starts after a 30 px rise (SA-C8) | same | |
| Air control | full, instant | full, instant; neither direction held stops him (SA-C3, `airStop`) | |

**PI-7 (rule change 1). Crouch-walk.** On the ground, holding Down crouches. While crouched he walks at the full 1.25 px/f in either direction, keeps the crouch pose (one still frame, no walk cycle) and the crouch hitbox, and can jump. Letting go of Down returns him to standing or walking at once; unlike SA-C4 the crouch is not latched, and Down is the only way into it (Down then Left/Right walks crouched; it doesn't stand him up). Source: `Samus.as:504` (the crouch stop is skipped when `skinCanMoveWhileCrouching`), `:950-982` (`relDwnBtn`), `:1094-1106` (`pressDwnBtn` keeps `vx`).

**PI-8 (rule change 2). Crouch pose in the air.** Holding Down in the air (after a jump, a crouch-jump or a walk-off) shows the crouch pose and uses the crouch hitbox. Letting go of Down shows the jump pose again, or the aim-up jump pose if Up is held. The pose does not end the somersault state, so a Screw Attack in progress keeps hurting enemies. Source: `Samus.as:840-844` (sets only the frame and clears `shoot`), `:950-982`.

**PI-9 (rule change 3). No walking while aiming up.** On the ground, while Up is held, Left/Right do nothing: he doesn't walk or turn. In the air, Up doesn't limit movement. Source: `Samus.as:495-516` (`!skinCanWalkWhileShooting && upBtn`, `dir = 0`).

**PI-10. Standing up under a ceiling.** If Down is released where the standing box doesn't fit, keep the crouch pose and box until it fits (PI-M1 has the original's behaviour and asks the coder to confirm).

### 5. Swimming

**PI-11.** Classic Samus's water rules (SA-C10): no stroke; he walks on the floor and jumps from it at 4.1667 px/f (profile `initial` `0x041C7` under water). Water gravity 400 → 0.0556 px/f² (`0x000E4`); sink cap per the swimming report. Crouch-walk works in water too. See `2026-10-07-classic-swimming.md`.

### 6. Health and power states

**PI-12.** As Classic Samus (SA-C11 to SA-C13), with When Hit = Lose Everything (`Samus.as:81-113`; `GameSettings.as:124`, Classic weapon Wave Beam by default):

| State | What it gives Pit / Dark Pit | What a hit does |
|---|---|---|
| Small | Short beam (range 50 px). The Morph Ball upgrade is held from the start but can't be used (PI-17). | dies |
| Mushroom | One extra hit, Long Beam, missiles (ammo set to 4 if he had none) | drops to small; loses the Long Beam; keeps missiles |
| Fire Flower | Mushroom, plus the Wave Beam, Screw Attack and Missile Expansion (99), and the second look (Varia colours) | drops straight to small; loses Wave, Screw Attack and Long Beam; keeps missiles and the expansion |
| Star | 12 s invincibility; missiles cost nothing, as for Classic Samus | |

Hit response is Classic Samus's (SA-C15: 1.25 px/f knockback away from the source, 15 f without control, then 75 f of flicker). Classic has no morph-ball or bomb pickups: the Morph Ball is a starting upgrade and is not in any obtainable list (`Samus.as:81-89, 107`), so a Pit never meets one.

### 7. Weapons

**PI-13 (rule change 4). No beam from the crouch.** While the crouch pose shows (Down held, on the ground or in the air), Attack fires nothing. Source: `Samus.as:984-990`.

**PI-14. Missiles from the crouch.** Special still fires a missile while crouched, with the usual ammo and the 3-shot cap (`Samus.as:1032-1074`; fact-check B). Its height follows PI-15.

**PI-15 (rule change 5). Lower standing shots.** On the ground, sideways shots (beams and missiles) come out lower:

| Where the shot starts | Classic Samus | Pit / Dark Pit |
|---|---|---|
| On the ground, standing or walking (also crouch-walking, and crouched after a step) | 44 Flash px = 22 px above the feet | **22 Flash px = 11 px above the feet** |
| On the ground, crouched without having moved since crouching | 25 Flash px = 12.5 px | 12.5 px (unchanged) |
| In the air (also in the air crouch pose) | 30 Flash px = 15 px | 15 px (unchanged) |
| Aiming up | 72 Flash px = 36 px, 2 px ahead of centre | unchanged |
| Horizontal offset, sideways shots | 25 Flash px = 12.5 px from centre | unchanged |

Why two crouch rows: the source keeps a separate crouch state only until he moves. Pressing Down while standing still enters it; the first step switches him to the walk state, which keeps the crouch pose but not the crouch state (`Samus.as:698-737, 840-844`). The offset is added only for the standing state on the ground. Source: `SamusShot.as:54-62, 176-220`.

**PI-16. Damage, caps and terrain: unchanged.** As Classic Samus (SA-C17 to SA-C23):

| Shot | Damage | Speed | Notes |
|---|---|---|---|
| Short beam | 150 | 500 → 4.167 px/f | vanishes after 50 px |
| Long beam | 150 | 4.167 px/f | full screen |
| Ice Beam (built; reached only through `&kit=full`, SA-C11, TG-44) | 125 | 4.167 px/f | freezes 6 s |
| Wave Beam (Classic default) | 225 | 400 → 3.333 px/f | passes through solid ground, stops at bricks and breaks them |
| Missile | 400 | 4.167 px/f | pierces armour |
| Bomb | none: Pit has no bombs | | |

At most 3 shots on screen, beams and missiles together. Hits at Normal attack strength: Goomba 2 beams or 1 missile; Bowser 16 / 24 / 30 beams (2400 / 3600 / 4400 HP). See `2026-10-07-classic-enemy-hp-and-armour.md` and `2026-10-07-classic-bricks-and-shots.md`.

### 8. Special abilities

**PI-17 (rule change 6). No morph ball and no bombs.** Down never curls him into the ball: not from the crouch, not in the air. With no ball there are no bombs and no bomb jumps. Source: `Samus.as:1108, 1124` (`!skinDisableMorphBall`).

**PI-18. Somersault and Screw Attack.** As Classic Samus (SA-C8, SA-C24), with PI-8 for the air crouch pose.

### 9. Interactions

**PI-19.** As Classic Samus, plus:

- His head always bumps bricks, even in the crouch pose. In the original only the ball state stops bumping (`Samus.as:1394-1400`), and Pit never balls.
- Shots break and bump bricks as for Classic Samus.
- No stomp. Fire bars hurt him as they hurt Classic Samus (the fire-bar immunity belongs to the Varia Suit upgrade, which no Classic list grants; `Samus.as:339, 1152`).
- The crouch box lets him crouch-walk and crouch-jump through 1-tile-high gaps (PI-3).
- Springs: Samus's values (green boost 1750, rise gravity 700; SA-C9). Our spring tables are keyed by hero id and fall back to Mario's 2750 and 1500 (`spring.ts:24-49, 119-121`), so add `pit` and `darkpit` entries (`flash(1750)`, `flashAccel(700)`).

### 10. Level data needs

None. No Pit-specific tiles exist.

### 11. Sprites and sound

**PI-20. Palettes (minimum to test).** Palette swaps of our `samus` sheet (`src/content/sprites/samus.ts:14-22`; roles: 0 outline, 1 light armour, 2 dark armour, 3 visor, 4 white, 5 glow):

| Palette | Suggested colours |
|---|---|
| `pit` | `NES.black, NES.white, NES.brownLight, NES.skin, NES.white, NES.yellow` |
| `pit-varia` (Flower look) | `NES.black, NES.yellowLight, NES.brownLight, NES.skin, NES.white, NES.yellow` |
| `darkpit` | `NES.black, NES.darkGray, NES.purple, NES.skin, NES.lightGray, NES.red` |
| `darkpit-varia` | `NES.black, NES.gray, NES.purple, NES.skin, NES.lightGray, NES.red` |
| `pit-star-*`, `darkpit-star-*` | fall back to the Samus star palettes (`content/sprites/index.ts:95-111`) |

**PI-21. Frames.** Pit needs every Classic Samus frame except the ball frames, plus a `crouch` frame (16 × 32 cell like the rest of our Samus sheet, body in the lower 16 px). Classic Samus adds `crouch` and `crouch-shoot` (SA-C4); Pit reuses `crouch` with his palette. One still frame covers standing crouch, crouch-walk and air crouch, as in the original. A `crouch-shoot` frame is not needed: the crouch pose clears the shooting pose (`Samus.as:840-844`). The original's Pit sheet also draws beams as arrows, missiles as mallets and pickups as Kid Icarus items; until that art exists, use Samus's.

**PI-22. Sounds.** Every beam (short, long, ice, wave) plays `pit-shoot`. Every jump plays `pit-jump`. Missiles keep Samus's missile sound. No footstep sound (ours has none for Samus). Source: `SamusShot.as:129-175`; `Samus.as:532-552, 1086-1092`.

**PI-23. Castle text.** Keep our shared castle text (`world.ts:2000-2001`), as Classic Samus does. The original replaces "our princess" with the skin's third name: "Palutena" for Pit and "the Reaper" for Dark Pit (`BmdInfo.as:1127, 1147`; `ScreenManager.as:404-411`; `GameTextMessages.as:7-9`). PI-M5 asks the owner whether to add per-hero names.

**PI-24. Music.** The original plays a Kid Icarus set for these skins on every console setting (Underworld for normal levels, Overworld for underground and water, Fortress for castles, Medusa for the final boss, the Reaper theme for hurry; `GameKidIcarus.as`). Ours keeps the level music until the owner decides (PI-M4).

### 12. Guide text

**PI-25.** Add `PIT_CLASSIC_GUIDE` by copying the Classic Samus guide and changing these rows (our guide style: short sentences, read in upper case):

- tagline: `Samus's rules, Pit's moves. No morph ball.`
- `left/right`: `Walk. You can't walk on the ground while aiming up.`
- `down`: `Crouch. You can walk and jump while crouched, and fit one-tile gaps.`
- `attack`: `Fire the beam. Not while crouched.`
- `special`: `Fire a missile, even while crouched.`
- tip: `No morph ball and no bombs.`
- demo poses: `idle`, `walk`, `jump`, `attack`, `crouch`.

Dark Pit uses the same guide with "Dark Pit" where the name appears.

### 13. Build steps (Part A)

1. Make Classic Samus (`src/game/characters/samus/classic.ts`, which exports `SAMUS_CLASSIC`) come from a factory, `classicSamus(variant)`, whose defaults give `SAMUS_CLASSIC` exactly. Read the variant options of PI-1 where Classic Samus handles Down (her `scratch.crouch` latch and ball entry), Attack, the walk direction and shot spawning.
2. Walking: the Samus report adds an optional `behaviour.holdsStill?(p, input)` hook read at `player.ts:181` to force `dir = 0`. For Pit it returns true only while Up is held on the ground (PI-9), never for the crouch (PI-7). Keep `crouches: false`, so the shared held-Down crouch (`player.ts:174-181`) never runs for Pit; his crouch pose, in the air too, is his own `scratch` flag, with `hitbox` returning 12 × 15 while it is set.
3. Add `src/game/characters/pit/classic.ts` exporting `PIT_CLASSIC` and `DARKPIT_CLASSIC`, and `src/game/characters/pit/guide.ts` with `PIT_CLASSIC_GUIDE`.
4. Add the palettes of PI-20 to `src/content/sprites/samus.ts` and fallbacks to `src/content/sprites/index.ts` (the `crouch` frame comes with SA-C4).
5. Add `pit-shoot` and `pit-jump` to `src/content/sfx/sfx.ts` (placeholders allowed, PI-M3).
6. Only if the owner accepts PI-M5: add an optional `rescueName` to `CharacterDef` and use it in the castle text at `src/game/world/world.ts:2000-2001` (the same field as PM-M8 in the Proto Man report; build it once).
7. Add both to `CLASSIC_EXTRAS` in `src/game/characters/registry.ts` (TG-41). The roster, the second select row and `?char=` come from TG-41 to TG-43. Add their spring entries to `src/game/entities/objects/spring.ts` (PI-19).
8. Add the tests in Notes → Acceptance checks.

### Part B (optional): phase 2, the cut standalone Pit

Build only if the owner asks. It would be a third entry, id `pitbow`, name "Pit (bow)", in the same dev-and-Classic roster, after Dark Pit. Everything below is what `Pit.as` and `PitProjectile.as` would do if they worked; it was never played. Gaps are PI-M10 to PI-M20.

**PI-S1. Definition.** A new `CharacterDef` (not a Samus variant): power-state damage model, `stomps: false`, `crouches: false` (his crouch allows walking, so it is his own flag, as in Part A). Hitbox from SWF `PitMc` (sprite 195): standing 12 × 22 px, crouching 12 × 12 px, climbing 11 × 19 px. Portrait: `idle` of a `pitbow` sheet.

**PI-S2. Movement.** Constants (`Pit.as:122-135, 193-219, 306-331, 413-419`):

| Constant | Flash | Ours | Fixed point |
|---|---|---|---|
| Walk (instant start and stop; `vxMax` = 180, so not clamped) | 180 px/s | 1.50 px/f | `0x01800` |
| Jump take-off (ground only) | 500 px/s | 4.1667 px/f; profile `initial` `0x0411C` as SA-C6 | `0x0411C` |
| Gravity | 700 px/s² | 0.0972 px/f² | `0x0018E` |
| Max fall | 450 px/s | 3.75 px/f | `0x03C00` |
| Full jump apex | | 87 px (as SA-C6) | |
| Jump release | `vy × 0.0001^dt` | `vy × 0.8577` per frame while rising (as SA-C7) | |
| Air control | full, instant | full, instant | |
| Water gravity / sink cap | 400 / 250 | 0.0556 px/f² / 2.083 px/f, no stroke | |

**PI-S3. Controls.**
- Up held on the ground: stand still and aim up (no walking). In the air: aim up, movement free.
- Down: crouch, on the ground or in the air. Walking still works. No shooting while Down is held.
- Attack: one arrow per press while fewer than 2 are on screen. Not on a vine.
- Special, Select: nothing.

**PI-S4. Arrows.** Speed 500 → 4.167 px/f. Damage **300** for every tier (`DamageValue.as:51-55`). Hitbox 7 × 7 px (SWF `PitProjectileMc`, sprite 270). Spawn (`PitProjectile.as:56-63, 136-163`):

| Shot | Spawn |
|---|---|
| Forward, on the ground | 12.5 px ahead of centre, 11 px above the feet |
| Forward, in the air | 12.5 px ahead, 15 px above the feet |
| Up (Up held) | 2 px ahead, 36 px above the feet, `vy = −4.167`, rotated 270° |

The shooting pose lasts 50 ms (3 f) when standing still or aiming up in the air, 140 ms (8 f) when moving (`Pit.as:121-122, 480-505`).

**PI-S5. Arrow tiers.** Short arrow (start): vanishes after 100 Flash px = **50 px** (12 f). Long arrow: unlimited range. Fire arrow: unlimited range, `arrowFire` frame, fireball stub (PI-M10).

**PI-S6. Arrows and terrain.** Non-brick solid ground destroys the arrow. A brick takes 300 damage, so it breaks, and **the arrow is destroyed** (fact-check B: `PitProjectile` has no passthrough, so `Brick.confirmedHitProj` ends with `proj.confirmedHit`). An item block is bumped and gives its item, and the arrow is destroyed.

**PI-S7. Hits to kill** at Normal attack strength: Goomba 1, Koopa 2, Hammer Bro 3, Bowser 8 / 12 / 15 (2400 / 3600 / 4400 HP).

**PI-S8. Power states.** Generic Mushroom model: small dies in one hit, a Mushroom gives one extra hit. **In Classic mode the Mushroom and Flower give Pit nothing else:** he doesn't override `classicGetMushroomUpgrades` or `classicGetFireFlowerUpgrades`, so the long arrow comes with the Mushroom **only in Modern mode** (fact-check B; `Pit.as:62`, `Character.as:378-385`, `StatManager.as:1192-1206`). See PI-M16 for the default.

**PI-S9. Head and bricks.** His head bumps bricks and never breaks them, even with a Mushroom. The draft meant a crouched Pit not to bump (`BRICK_NONE`, `Pit.as:680-686`), but its state code only keeps the crouch state while walking with Down held (PI-M19).

**PI-S10. Swimming.** No stroke: he jumps only from the floor (`pressJmpBtn` needs `onGround`). Water constants in PI-S2.

**PI-S11. Death.** Pit-fall death timer 2.5 s. Everything else is the generic death (his own death code is commented out).

**PI-S12. HUD.** An arrow-tier icon: `arrowWeak` (short), `arrowMid` (long), `arrowStrong` (fire). Three palette rows recolour him per tier (`Pit.as:174-184, 287-304`).

**PI-S13. Sprites.** SWF frame labels to draw, 16 × 32 cells suggested: `stand`, `standShoot`, `walk-1..4`, `walkShoot-1..4`, `fall`, `fallShoot`, `standUp`, `standUpShoot`, `crouch`, `climbStart`, `climbEnd`, `die`, `cheer-1`, `cheer-2`; unused art `fly-1`, `fly-2`, `flyShoot-1`, `flyShoot-2`. Projectiles: `arrowShort`, `arrowLong`, `arrowFire`, fireball frames, `barrier` (4 frames), `hammer` (2 frames). Minimum to test: a palette swap of our Samus sheet and a thin arrow recoloured from our beam sprite.

**PI-S14. Guide.** Tagline `Angel archer: two arrows at a time.` Rows: walk; jump; up aims up (no walking on the ground); down crouches (walk allowed, no shooting); attack fires an arrow. Power-up rows follow the owner's PI-M16 decision.

### Missing information to fill in

| ID | Gap | Suggested default | Decides |
|---|---|---|---|
| PI-M1 | **Standing up under a ceiling.** When Down is released, the original shows the standing frame at once (`relDwnBtn`, no room check). A standing box inside a ceiling is then pushed backwards 3 Flash px = 1.5 px per frame until it is clear (`Character.as:963-973`, `STUCK_IN_WALL_SHIFT` `:318`). Inferred from source, not played. | Keep the crouch until the standing box fits (PI-10), using the same room check as leaving the ball (SA-C26; Current has one at `samus/index.ts:87-96`). It avoids a push-back our engine doesn't have. | coder |
| PI-M2 | **Art.** Pit and Dark Pit sheets: every Samus pose except the ball, plus crouch; arrow beams; mallet missiles; Kid Icarus pickup icons; a second (Flower) look. The original sheets are not ours to use. | Palette swaps of our Samus sheet (PI-20) and a `crouch` frame. | owner |
| PI-M3 | **Sounds:** `pit-shoot` and `pit-jump`. The original uses tracks 16 and 19 of the Kid Icarus NSF (`MusicInfo.as:799-800`). | Compose short original MML sounds. Until then, `pit-shoot` = our `buster`, `pit-jump` = our `jump-small`. | owner |
| PI-M4 | **Music.** The original's Kid Icarus music set (PI-24). | Keep the level music. | owner |
| PI-M5 | **Per-hero castle names** ("Palutena" for Pit, "the Reaper" for Dark Pit; "the hatchling" for Samus). | Keep our shared text for every hero (PI-23), as the Samus, Mega Man and Bass reports do. If wanted, add it once for all heroes with an optional `rescueName` (the Proto Man report's PM-M8). | owner |
| PI-M6 | **One slot or two.** Dark Pit differs only in looks and the castle name. | Two adjacent slots (PI-2). | owner |
| PI-M7 | **Up and Down held together.** The crouch pose wins (`Samus.as:840` runs after the aim-up frame), so no beam fires; whether he can walk follows the ground rule for Up. | Crouch pose; no walking on the ground (Up wins for movement, Down wins for the pose). | coder |
| PI-M8 | **Screw Attack in the air crouch pose.** The source keeps the somersault state; whether the original then draws the crouch frame or the spin is not visible without playing. | Keep the Screw Attack active and show the crouch frame (PI-8). | coder |
| PI-M9 | **Is the crouch box used for collision in the air?** The original sets the hitbox from the current frame's `HRect`, so yes by source; not played. | Yes (PI-3, PI-8). | coder |
| PI-M10 | Phase 2: **fire arrow fireballs.** `addFireBall()` is an empty "TODO" (`PitProjectile.as:127-134`). The art has fireball "tip" frames and a 16-frame "rotate" path that circles the arrow. | Fire arrow = long arrow with the fire frame, no fireballs, until designed. | owner |
| PI-M11 | Phase 2: **barrier.** The pickup case says only `// activate wand`; the upgrade is "restorable"; art `barrier` (4 frames). | Leave out until designed. Our `orbit` projectile spec could host it. | owner |
| PI-M12 | Phase 2: **hammer (mallet).** He starts with it and never loses it, but nothing uses it (no attack code); art `hammer`. | Leave out. | owner |
| PI-M13 | Phase 2: **feather.** Pickup and icon only; no code. | Leave out. | owner |
| PI-M14 | Phase 2: **flight.** Frames `fly-1`, `fly-2`, `flyShoot-1`, `flyShoot-2` and constants `FL_FLY_START/END` exist, but no code uses them. | No flight. | owner |
| PI-M15 | Phase 2: **hearts, strength levels, Sacred Treasures.** None exist in code. | None. | owner |
| PI-M16 | Phase 2: **what the Mushroom and Flower give in Classic.** By source, nothing beyond the extra hit (PI-S8), so the bow never improves in Classic. | Mushroom gives the long arrow (the draft's Modern rule), Flower gives the fire arrow (without fireballs). This deviates from source; flag it in the guide. | owner |
| PI-M17 | Phase 2: **hit response.** His own knockback and flicker code is commented out (`Pit.as:569-591`), leaving the generic `Character` response. | Use Classic Samus's hit response. | owner |
| PI-M18 | Phase 2: **death, jump sound, step sound, flagpole pose.** All commented out or missing (`Pit.as:251-260`: the jump plays no sound; `:547-554`: step sound commented; `:629-652`: death; `:653-679`: flagpole). | Generic death, `pit-jump`, no steps, the stand frame on the pole. | coder |
| PI-M19 | Phase 2: **unfinished state code.** The code asks for frames `jump`, `jumpShoot`, `upJump`, `upJumpShoot`, which the art doesn't have (it has `fall`, `fallShoot`), and loops walk-shoot at frame 3 of 4. Crouched head bumps depend on a state that is reset when he stands still or leaves the ground. | Use `fall` / `fallShoot` for the air, loop all 4 walk-shoot frames, and never bump bricks while Down is held. | coder |
| PI-M20 | Phase 2: **the class itself.** Its constructor body is commented out (no name, character number or timers) and it references `REPOSITION_BULLETS_DCT`, which only Samus declares. | Write it fresh from PI-S1 to PI-S14; nothing to port. | coder |

## Actual

We have no Pit, Dark Pit or bow Pit. `characters/registry.ts:12-16` lists 8 heroes and an unknown id falls back to Mario, as does `?char=` in `src/main.ts:178`. Current Samus (`characters/samus/index.ts:161-311`) has no crouch (`crouches: false`, `:175`): Down on the ground curls her into the ball at once (`:229-241`), Attack in the ball drops bombs, beams spawn at body top + 6 px (`:98-115`), and she walks with acceleration (`:14-33`). The shared player blocks walking while crouched and allows a crouch only on the ground (`entities/player.ts:174-181`). Current stays the default and must not change.

## How often

every time

## Notes

- **Sources.** Original paths are under `$S/orig/src/com/smbc/`, with line numbers after `tr '\r' '\n'` (copies in `$S/classic/pp-work/`).
  - Skin flags: `characters/Samus.as:281-287` (fields), `:437-441` (read on every skin change), `:1239-1279` (`skinSettingsWrite`, `skinSettingsRead`, defaults); the two skins `graphics/BmdInfo.as:1125-1127, 1145-1147`; text `data/SkinDescriptions.as:17`.
  - Walk lock and crouch-walk: `Samus.as:495-516`. Crouch pose: `:840-844`. Releasing Down: `:950-982`. Pressing Down: `:1094-1136`. Beam blocked: `:984-990`. Missile from Special: `:1032-1074`. Jump sound: `:532-552`. Steps: `:1086-1092`. Brick state: `:1394-1400`.
  - Shot heights: `projectiles/SamusShot.as:54-62, 176-220`; beam sounds `:129-175`.
  - Walk 1.25 px/f (185 clamped by `vxMax = 150`, `Samus.as:207, 407`; `main/AnimatedObject.as:257-260`), High Jump unobtainable (`Samus.as:81-89`), missiles from the crouch: fact-check B.
  - Upgrades and Lose Everything: `Samus.as:81-113`; `data/GameSettings.as:124, 221`; `characters/Character.as:2052-2067`.
  - Castle name: `managers/ScreenManager.as:404-411`; `text/GameTextMessages.as:7-9`.
  - Hitboxes: SWF `SamusMc` (sprite 85) and `PitMc` (sprite 195), `PitProjectileMc` (sprite 270), read with `$S/classic/billtools/hrect.py`.
  - Standalone Pit: `characters/Pit.as:53-69` (upgrades), `:121-135` (constants), `:193-219` (`setStats`), `:306-331` (movement), `:333-421` (state), `:480-505` (arrows), `:555-591` (crouch, damage stub), `:680-686` (bricks); `projectiles/PitProjectile.as:53-63, 102-183`; `data/DamageValue.as:51-55`. Fact-check B: the arrow is destroyed after breaking a brick, and the long arrow comes with the Mushroom only in Modern mode.
  - Unit and report: `$S/chars/missing-pit-vicviper.md` (Pit parts), `$S/chars/samus.md` section 3, `$S/chars/FINAL-REPORT.md` 4.4 and section 5, `$S/chars/verify/B.md`.
- **Implementation hints.**
  - Keep Current untouched: nothing in `samus/index.ts` or the Current path of `player.ts` changes. The only player change is the Samus report's optional `holdsStill` hook, which no Current hero sets.
  - Put the six rule changes where Classic Samus already decides them: Down (crouch, ball), the movement direction (walk lock, crouch-walk), the Attack handler (crouch block) and the shot spawn y (`feet − standShotHeight` for the standing state on the ground).
  - Track "crouched without moving" (PI-15) as one flag: set it when Down is pressed while standing still on the ground, clear it on the first frame he moves or leaves the ground.
  - The crouch pose decides the hitbox. Call `refitHitbox()` when the pose changes, in the air too.
- **Acceptance checks** (headless, `rules: 'classic'`).
  - Crouch-walk: Pit holds Down + Right on flat ground for 60 f → moved 75 ± 1 px, crouch pose all the time. Classic Samus → 0 px.
  - Walk lock: Pit holds Up + Right on the ground for 30 f → 0 px, facing unchanged. In the air, Up + Right moves him at 1.25 px/f.
  - Beam block: Pit holds Down and presses Attack on the ground and in the air → no shot. With missiles, Down + Special → one missile.
  - Shot heights: a standing beam's centre is 11 px above the feet (Classic Samus 22); a missile fired crouched in place is 12.5 px; after one crouch-walk step, 11 px; in the air, 15 px.
  - No ball: Pit presses Down twice on the ground, and Down in the air → never in the ball, no bombs ever spawned.
  - Gap: a corridor 1 tile (16 px) high → Pit crouch-walks through; Classic Samus standing does not.
  - Jump from the crouch with Down held → apex 87 ± 2 px (SA-C6), 12 × 15 hitbox the whole time.
  - Roster: with `rules: 'current'`, or with dev mode off, neither id is listed and `char=pit` falls back as today.
  - Current unchanged: the existing test suite and headless sims pass with no edits.
  - Phase 2 only: a short arrow disappears 50 ± 4 px from its spawn; a third Attack press with 2 arrows out does nothing; an arrow that breaks a brick is gone the next frame; a Goomba dies to 1 arrow, a Koopa to 2.
- **Confidence.** Source only; the original was not played with the Pit skin. The jump apex (87 px) is the Samus report's stepped simulation of the constants. Hitbox sizes come from the SWF. The "crouched without moving" detail (PI-15) and the ceiling behaviour (PI-M1) are inferred from the state code. Part B is unplayable code, so all of it is "what the draft would do".
- **Open questions.** PI-M1, PI-M7, PI-M8 and PI-M9 would be settled by a playtest of the original with the Pit skin. Meanwhile use the defaults given. Settled here: the unit's question "does a Pit-skinned Samus still receive morph-ball and bomb pickups?" has no case in Classic, because the Morph Ball is a starting upgrade and never a pickup.
- **Related reports.**
  - `2026-10-07-samus-classic-smbc-rules.md` (the base this variant copies, including the crouch).
  - `2026-10-07-dev-classic-smbc-rules-toggle.md` (the gate and the roster).
  - `2026-10-07-classic-power-states.md`, `2026-10-07-classic-enemy-hp-and-armour.md`, `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`.
  - `2026-10-07-protoman-build-classic-character.md` (PM-M8 and PI-M5 are the same castle-name question), `2026-10-07-vicviper-build-classic-character.md` (the other cut prototype from the same unit), `2026-10-07-classic-follow-ups.md` (FU-2).
  - Existing report on the inherited water rules: `2026-10-06-water-non-mario-heroes-stroke.md`.
