# Respawning at the 1-2 midpoint puts Mario among three Goombas (the original clears nearby enemies)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 1-2, midpoint at column 97 (Goombas at columns 99, 100 and 102)
- **How to get there:** `?level=1-2&char=mario`, play past column 97, then lose a life (for example in the pit at columns 120-121)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Start 1-2 and play past column 97, the midpoint.
2. Lose a life anywhere after it (I fell into the pit at columns 120-121).
3. Pick Mario on character select and watch the respawn at column 97.

## Expected

On a midpoint restart, the original removes every enemy within 6 tiles horizontally of the player. In `Level.as`, `startAtHalfwayPoint()` calls `destroyNearbyEnemies()`, which destroys each `Enemy` with `|ao.x - player.x| < HW_ENEMY_REMOVAL_DIST`, and `HW_ENEMY_REMOVAL_DIST = TILE_SIZE*6`. With the midpoint at 97.5 tiles, the Goombas at 99, 100 and 102 are removed. The piranha in the pipe at 103 is exactly 6 tiles away, so it stays.

## Actual

Mario reappears at column 97 with all three Goombas present. On the first frame, one Goomba is already overlapping him and two more are 1-3 tiles to the right, walking toward him. Without a power-up this is almost an instant second death.

## How often

every time (3 of 3 respawns)

## Notes

- Ours: playtested. Original: found by reading the code (`com/smbc/level/Level.as`, `startAtHalfwayPoint` / `destroyNearbyEnemies`, `HW_ENEMY_REMOVAL_DIST`). I did not die after the midpoint in the original.
- This is probably general to every level with a midpoint. 1-2 is where it bites hardest, because three Goombas sit right next to the midpoint. Our `World` constructor (`src/game/world/world.ts`) spawns everything up to the camera's right edge plus 16 px and has no removal step.
- The first screenshot was taken with the Dev assists Infinite lives and No damage on, only so the respawn could be watched. The Goombas are there with or without assists.
- Screenshot: `2026-10-05-1-2-checkpoint-respawn-keeps-nearby-enemies.png` (frame 107 after respawn, F1 overlay showing tile 97,12).
- Reviewed: verified against `com/smbc/level/Level.as` (`startAtHalfwayPoint` calls `destroyNearbyEnemies()`; `HW_ENEMY_REMOVAL_DIST = TILE_SIZE*6`, `TILE_SIZE` 32) and ours at b8379f9: `src/game/scenes/level.ts` `died` handler (lines 133-142) respawns at `state.checkpoint` through `game.respawn`, with no enemy-removal step.
