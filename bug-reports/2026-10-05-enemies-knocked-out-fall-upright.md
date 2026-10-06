# Knocked-out enemies fall upright, drift sideways in water, and are thrown up too fast

- **Severity:** cosmetic
- **Build:** V0.1.0-B8379F9
- **Where:** every level; any enemy killed by a fireball, star, kicked shell or block bump (not a stomp). The sideways drift is in every water area, for example ll-11-2 (World B-2's water area, Cheep Cheeps and Bloopers around columns 34-60).
- **How to get there:**
  - Upright corpse and launch speed: `?level=1-1&char=mario`, then take the fire flower from the ? block at column 78 while big, or the star from the brick at column 101.
  - Water drift: `?level=ll-11-2&char=mario&dev=1`, or the ll-wB tester's water test map (in Notes): a star in a small box at column 4 and two Goombas at columns 22 and 26.
- **Character and power:** Mario, fire or star
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Get fire power or a star in 1-1.
2. Kill a Goomba with a fireball, or run into it with the star.
3. Watch the defeated Goomba pop up and fall off the screen.
4. Water: load the water test map, swim up into the star block at column 4 and take the star. Walk right and touch the Goombas at about columns 17-20. Watch the knocked-out Goomba (about 6 frames per screenshot).

## Expected

In the original, `com/smbc/enemies/Enemy.as` `die()` (lines 321-399) does three things to a knocked-out enemy:

1. **Upside down.** It sets `scaleY = -1` (line 390), so the enemy turns over while it pops up and falls. In the 1-1 comparison playthrough of the original, Goombas killed by the star "flip upside-down and fall through the floor".
2. **No sideways speed in water.** `if (level.waterLevel) vx = 0;` (lines 381-382). Only out of water does it use `vx = ±DIE_BOOST_X` (100 Flash px/s, line 124), away from the player. `Level.as` sets `waterLevel = true` for every area whose `TYPE` is `water` (lines 440-444), which includes 11-2 area b. So in water the enemy pops up and sinks straight down where it was hit.
3. **A small hop.** `vy = -DIE_BOOST_Y` (200 Flash px/s, lines 125 and 391), and `defyGrav = false`, so the enemy's own gravity pulls it down.

In our units (Flash px / 2, then / 60 per frame):

| | Original | Ours |
|---|---|---|
| Upward launch | 200 / 2 / 60 = **1.67 px/frame** | **3 px/frame** (`-0x03000`) |
| Sideways, on land | 100 / 2 / 60 = **0.83 px/frame** | **1 px/frame** (`0x01000`) |
| Sideways, in water | **0** | **1 px/frame** |
| Gravity | the enemy's own: Goomba 1400 Flash px/s² = **0.19 px/frame²** (`Goomba.as` line 56); green Koopa `enemyGravDef` 1300 = 0.18 (`KoopaGreen.as` line 162, `Enemy.as` line 108); default 500 = 0.07 (`AnimatedObject.as` line 35) | **0.25 px/frame²** (`0x00400`) for every corpse |

For a Goomba, that is a peak of about 7 px above the death point in the original (200² / (2 × 1400) = 14.3 Flash px) against 18 px in ours (3² / (2 × 0.25)).

## Actual

The enemy pops up and falls, but:

1. **It stays upright.**
   - `Enemy.flipOut` in `src/game/entities/enemies/enemy.ts` (line 154, documented as "Knocked off the screen upside down") spawns a `Corpse` with `flipV = true` and `mirrorY = this.corpseFlipY`.
   - `Corpse.render` in `src/game/entities/effects/effects.ts` (lines 186-200) only draws upside down when the sprite sheet has a `<frame>-flip` frame, and no sprite in `src/content/sprites` defines one.
   - `corpseFlipY` defaults to `false` and is only set by the hanging Piranha Plant (`src/game/entities/enemies/piranha.ts`).
   - So every other corpse is drawn upright, although `Renderer.sprite` already supports `flipY` (`src/engine/gfx/renderer.ts`).
2. **In water it moves sideways at 1 px per frame** (away from the hit) on its way down, the same as on land. In the ll-wB tester's run, the Goomba hit at column 17 drifted right together with Mario for about half a tile before it dropped out through the floor. `flipOut` always passes `src.dirX` to `Corpse`, and the `Corpse` constructor sets `this.body.vx = dirX * 0x01000` (effects.ts line 176) with no check for water. `flipOut` is the only place that creates a `Corpse`.
3. **It is thrown up at 3 px per frame with 0.25 px/frame² gravity** (effects.ts lines 177 and 181), so it rises more than twice as high as in the original.

## How often

every time

## Notes

- Point 1: found by the smb-w5 reviewer reading the code, and confirmed by the orchestrator in both codebases. Not seen in our game: a quick 1-1 attempt failed because `&kit=full` does not give Mario fire power.
- Point 2: ours playtested by the ll-wB tester (Dev assist No damage on, so the Goombas could not hurt Mario before he got the star). The original: code only; the tester could not get a kill underwater in Ruffle. It affects every Lost Levels and SMB water area.
- Point 3: from the ll-wB tester's note, checked by the reviewer in both codebases. Not compared in play.
- **Fix:** all three are in `Corpse` and `Enemy.flipOut`.
  - Draw with the renderer's `flipY` when no `-flip` frame exists. Take care with the hanging Piranha Plant, which already uses `mirrorY`.
  - Pass a zero sideways speed when the area is a water area (ours tests that with `isWaterTheme(level.theme)`, `src/game/world/world.ts` line 201).
  - Use the original's launch (1.67 px/frame up, 0.83 px/frame sideways) and, ideally, the gravity of the enemy that died.
- Water test map (`gauntlet/notes/llwB/tw.map`):

```
theme: water
start: 4,12
[tiles]  rows 8-12:
.#######........................
.#.....#........................
.#..*..#........................
.#.....#........................
.#..............................
[entities]
goomba 22 12
goomba 26 12
```

- Sources: the smb-w5 reviewer's finding (point 1), and `ll-wB/2026-10-05-water-knocked-out-enemies-drift-sideways.md` (point 2, plus the launch-speed note that became point 3). Merged by the ll-w6/w9/wB review, which widened the title.
- Reviewed: verified against `com/smbc/enemies/Enemy.as` (`die`, lines 108-109, 124-125, 321-399), `com/smbc/enemies/Goomba.as` (line 56), `com/smbc/enemies/KoopaGreen.as` (line 162), `com/smbc/main/AnimatedObject.as` (lines 35, 255-285), `com/smbc/level/Level.as` (lines 440-444), and ours at b8379f9: `src/game/entities/enemies/enemy.ts` (`flipOut`, `corpseFlipY`), `src/game/entities/effects/effects.ts` (`Corpse`, lines 158-201), `src/game/entities/enemies/piranha.ts`, `src/engine/gfx/renderer.ts`, `src/engine/math/units.ts`.
