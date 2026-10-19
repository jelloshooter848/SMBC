# Vic Viper (Classic mode): design proposal

Status: **approved and built** with the Recommended answer for every decision below (Classic mode, the
second row of the select screen; `src/game/characters/vicviper/classic.ts`, art in `src/content/sprites/vicviper.ts`,
tests in `tests/sim/classic-vicviper.test.ts`). Co-op does not apply to Classic mode (one player); dev free-play co-op
keeps M14's Recommended rule. Built differences: M11's top edge is the bottom of the HUD's rows (the ship, its
Options and Shield never enter them, so no ceiling can be flown over); M12 follows the original instead (no crush
code exists there: a pinned ship is pushed up, down or past the wall, and only squashed with no free place); the
How to play demo shows the ship with no power-ups. The text below is the proposal as approved.

Original status: proposal for owner approval. Source report:
`bug-reports/2026-10-07-vicviper-build-classic-character.md` (IDs `VV-`). Draft art and the storyboard renderer:
`tools/mockups/classic/` on branch `claude/classic-wip-mockups` (not in the game). Render with
`node tools/mockups/classic/render.mjs <outDir>` (PNG output must stay outside the repo).

Vic Viper was cut from the original SMBC 3.1.21: the class code exists but was never compiled or played. I re-read
`VicViper.as` and `VicViperProjectile.as` in the original source: speeds (200 / 100 Flash px/s), the bullet (600
px/s, damage 200), `BRICK_NONE`, mid-air pipes and the six bar slots match the report. Anything "coded" below
is what that code would do; anything else is a new design and is marked **DECISION FOR THE OWNER**.

Vic Viper appears only in Classic mode (and dev Classic runs), never in the campaign.

## 1. At a glance

A starfighter in a walking world. The screen scrolls right by itself and carries the ship. It flies freely in
8 directions, shoots to the right, cannot stomp or bump blocks, and grows stronger through a Gradius-style power
bar.

| Ability (player text)                     | What it does                                      | Source       |
| ----------------------------------------- | ------------------------------------------------- | ------------ |
| Move (all directions)                     | Fly at a fixed speed, no gravity, no acceleration | coded        |
| SHOOT (Attack)                            | One bullet to the right per press                 | coded        |
| POWER (Jump, and Special)                 | Take the power-up lit on the bar                  | **new** (M1) |
| Down over a pipe / Right into a side pipe | Enter it, even in mid-air                         | coded        |
| Select                                    | nothing                                           | coded        |

## 2. Movement

| Number                     | Value                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| Fly speed                  | 1.667 px/f each axis (diagonal about 2.36, not normalised)               |
| Auto-scroll                | 0.833 px/f; the camera ignores the ship while it runs                    |
| On-screen speed            | right +1.667, idle 0, left −2.5 (left adds the scroll speed back, coded) |
| Gravity, jump, run, crouch | none                                                                     |
| Hitbox                     | 15 × 10 px in every state (from the SWF)                                 |
| Facing                     | always right; poses neutral / nose-up / nose-down from Up / Down held    |

Auto-scroll starts at every spawn and area entry, pauses inside pipes, stops for good at the map end or the
Bowser scroll stop, and pauses during the flagpole, the axe sequence and every freeze. Every SMB1 level fits its
timer at this speed (tightest: 8-1, about 37 s spare).

## 3. Power states (Classic power model)

| State       | Effect                        | Look (draft)                 |
| ----------- | ----------------------------- | ---------------------------- |
| Small       | dies to any hit               | red fins and stripe          |
| Mushroom    | one extra hit; no size change | **blue** trim (M10)          |
| Fire Flower | nothing extra in the code     | **gold** trim, cosmetic (M3) |

A hit while powered drops straight to small (Lose Everything). **The power bar and every power-up taken from it
are kept on a hit; death clears all of them.** Star: the shared 12 s Star.

## 4. Weapons and the power bar

- **Bullet (coded):** 5 px/f right, damage 200 (Goomba 2 shots, Koopa 3, Bowser 12/18/22), no cap, no fire-rate
  limit. Flies through ground and pipes; the first brick or ? block it meets breaks or bumps and the bullet is
  spent; armoured enemies take nothing.
- **Bar (coded counting):** six slots SPEED, MISSILE, DOUBLE, LASER, OPTION, ? (shield), drawn on the HUD's
  third row as 16 × 8 cells with the lit slot's name beside it. Each capsule moves the light one available slot
  right; maxed slots show blank and are skipped.
- **The six power-ups were never written.** Proposed in M4 to M9 below.

## 5. How it handles the world

| Thing                        | Behaviour                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Bricks / ? blocks from below | solid ceiling, no bump (coded); hidden blocks stay hidden. Shoot them instead                                                                  |
| Enemies                      | any contact hurts (no stomp)                                                                                                                   |
| Water                        | flies the same; the shared 2.083 px/f sink cap clips only fast downward flight                                                                 |
| Pipes                        | Down on a pipe top or Right into a side pipe, in mid-air too                                                                                   |
| Pits                         | only kill if the ship flies below the screen bottom                                                                                            |
| Springs                      | a solid block, no launch                                                                                                                       |
| Flagpole                     | shared slide and walk-off with the neutral pose and flame; can always reach the top                                                            |
| Bowser                       | scroll stops with the axe in view; shoot him or fly over him to the axe; the shared axe sequence lowers the ship; Toad says "THANK YOU VIPER!" |
| Co-op                        | see M14                                                                                                                                        |

## 6. Decisions for the owner

Each item: **Recommended** first, then alternatives. Items marked (coder) can be settled by the builder.

- **M1 How a power-up is spent. DECISION FOR THE OWNER.**
  Recommended: POWER on Jump and on Special (same as NES Gradius: A = power, B = shoot). Spending gives the lit
  slot's next level, empties the bar, plays a sound; nothing lit = nothing happens.
  Alt A: auto-spend (each capsule immediately gives its slot, no choosing). Alt B: Select spends (keeps Jump free).
- **M2 Past the last slot. DECISION FOR THE OWNER.**
  Recommended: wrap to SPEED (Gradius); if every slot is maxed, a capsule gives 1000 points.
  Alt: the coded bug-for-bug reset (bar clears, the next capsule skips a slot).
- **M3 Where capsules come from. DECISION FOR THE OWNER.**
  Recommended: the first power-up block gives the Mushroom; every later one gives a **red capsule** in place of
  the Fire Flower (still counts as the Flower: small → Mushroom, Mushroom → Fire Flower state, plus one bar step).
  Enemies also drop a capsule at the shared 25 % rate. Alt A: blocks only, no drops. Alt B: drops only; blocks
  stay Mushroom / Flower with no bar step (the coded result: the bar barely fills).
- **M4 Speed Up. DECISION FOR THE OWNER.** Recommended: 5 levels, +0.333 px/f each (1.667 to 3.333); long flame
  from level 1. Alt: 3 levels of +0.5.
- **M5 Missile. DECISION FOR THE OWNER.** Recommended: one ground missile per SHOOT press, flies down-forward then
  runs along the floor, damage 400, **hurts armoured enemies** (the ship's only answer to Buzzy Beetles). Alt:
  leave it out and let armoured enemies be dodged.
- **M6 Double / M7 Laser. DECISION FOR THE OWNER.** Recommended: Double adds a 45° up shot (level 2 adds a rear
  shot); Laser replaces the bullet with a piercing 16 px bolt, 8 px/f, max 2 on screen (level 2: 32 px, 300
  damage); taking one removes the other (Gradius). Alt: allow both at once.
- **M8 Option. DECISION FOR THE OWNER.** Recommended: up to 4 orbs trailing the ship's past screen path, no
  hitbox, each copying every shot. Alt: cap at 2 (fewer sprites, easier to read on a phone).
- **M9 Shield. DECISION FOR THE OWNER.** Recommended: NES-style front barrier, two pieces, 4 hits each, blocks
  enemy shots and contact in front only. Alt: a full-body force field that absorbs 3 hits from any side.
- **M10 Showing the Mushroom. DECISION FOR THE OWNER.** Recommended: blue trim (storyboard frame 6) and a
  48-frame flash on change. Alt: a small HUD icon only, ship unchanged.
- **M11 Right and top screen edges. DECISION FOR THE OWNER.** Recommended: clamp the ship 3 px inside the right
  edge and below the HUD; no bottom clamp. Alt: let it leave the right edge (it dies off-screen when the scroll
  stops).
- **M12 Crushed by the scroll (coder; owner confirms).** Recommended: pushed into a wall by the left edge with no
  free space = death (SMB3 auto-scroll rule). Alt: push the ship out vertically and never kill.
- **M13 Left faster than right. DECISION FOR THE OWNER.** Recommended: keep as coded (−2.5 vs +1.667 on screen).
  Alt: symmetric 1.667 on screen.
- **M14 Two players. DECISION FOR THE OWNER.** Recommended: auto-scroll runs while any live ship is in the level,
  carries only ships; a walking partner is pushed by the left edge. Alt: Vic Viper is single-player only (hidden
  for player 2).
- **M16 Vines. DECISION FOR THE OWNER.** Recommended: cannot grab vines; sky areas are skipped. Alt: Up on a
  grown vine starts the vine transfer.
- **M18 Blue capsule. DECISION FOR THE OWNER.** Recommended: leave out. Alt: 1 capsule in 8 is blue and clears
  every non-boss enemy on screen (respecting Reduce flashing).
- **M19 Art. DECISION FOR THE OWNER.** Recommended: the draft in `tools/mockups/classic/vicviper.ts`, an original
  arrowhead ship (one needle nose, bubble canopy, dorsal and ventral fins), not the two-prong Konami silhouette.
  Alt: a stubbier, rounder ship that reads better at phone size.
- **M21 Music. DECISION FOR THE OWNER.** Recommended: the level's own music. Alt: a new original MML theme.
- **M23 Flagpole score / M24 HUD name. DECISION FOR THE OWNER.** Recommended: shared scoring (it can always
  reach 5000); HUD name `VIPER`. Alt: cap the flagpole at 2000 for the ship; HUD `V.VIPER`.
- Coder items: M15 flagpole and axe poses (neutral pose + flame), M17 springs (solid, no launch), M20
  placeholder sounds, M22 option/missile/shield hitbox estimates.

And the big one: **should this hero ship at all?** The comparison report suggested skipping both cut prototypes.
Vic Viper needs the most new engine work of any Classic hero (flight mode, auto-scroll camera, power bar HUD).

## 7. Storyboard

Frames (256 × 240 at 3×) and `vicviper-sheet.png` are written by the renderer: idle with auto-scroll, flying
right, nose-up under blocks (no bump), shooting through a pipe into a brick, small / Mushroom / Flower trims, the
bar lighting MISSILE, a spent kit (Speed Up, 2 Options, ground Missile), Laser with the Shield, mid-air pipe
entry, and the death burst.

## 8. Draft sprite list

In `tools/mockups/classic/vicviper.ts` (32 × 16 ship cell): neutral × 2, nose-up × 2, nose-down × 2, jet flame
× 4, long flame × 4, bullet (front, rear), laser, missile (dive, run), Option × 2, Shield top / bottom with worn
frames, red capsule × 2, explosion × 4, 16 × 16 portrait. Three palettes: small (red), Mushroom (blue), Flower
(gold).
