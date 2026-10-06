# ll-5-3: after a death past the midpoint, Mario respawns inside the mushroom stalk at column 154 and falls into the pit, every time, until the game is over

- **Severity:** blocks progress
- **Build:** V0.1.0-B8379F9
- **Where:** ll-5-3, column 154 (the midpoint). The mushroom platform's top is row 10 (columns 153-156). Below it there is only the non-solid stalk (columns 154-155) and the pit.
- **How to get there:** `?level=ll-5-3-bonus&char=mario&dev=1`, walk right through the room and into the pipe at column 29. You come out of the pipe at ll-5-3 column 147. In the real level you reach the room through the pipe at column 38 or 102: it is the only way past column 128, because the 5-3 loop sends you back from 128 to 64.
- **Character and power:** Mario, small. The Dev assist Inf. lives was on so several respawns could be watched. It does not change the bug: without it, each respawn costs a life.
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Come out of the bonus pipe at ll-5-3 column 147 (see above). Press F1.
2. Run-jump right onto the mushroom platform at columns 153-156 (top at row 10). Walk past column 154, which is the `checkpoint 154` zone.
3. Walk off the right side of the mushroom into the pit, and lose the life.
4. Press start on the character select.

## Expected

Mario reappears standing on the mushroom at column 154, with his feet on top of row 10.

The original stores the midpoint with its own height. `<LEVEL ID="5-3">` area `a` in `levelDataLostLevels.xml` has `halfwayPoint&&shiftRight` at column 154, **row 9**, directly above the `groundMushroom` top at (154,10). In `com/smbc/level/Level.as` (CR line endings), lines 1068-1072 set `hwPnt = new Point(currentX + TILE_SIZE/2, currentY + TILE_SIZE)` for a `shiftRight` midpoint, so the respawn point is the bottom of that cell, which is the top of the mushroom. `startAtHalfwayPoint()` (lines 1663-1672) puts the player's feet at `hwPnt.x`/`hwPnt.y`, then calls `destroyNearbyEnemies()`. `LOCKED_CP` is `False` for 5-3, so the normal difficulty uses the midpoint (`shouldStartAtCheckPoint`, line 1453).

## Actual

Mario reappears at x 2466 in row 12 (F1: `tile 154,12`), two rows below the mushroom's top row, with his feet on row 13. That is inside the stalk at columns 154-155, which is not solid. He drops into the pit at once and dies, with the timer still at 400. Each later respawn does the same.

With normal lives, the player loses every remaining life this way. Game over and CONTINUE then restart the world from ll-5-1 (`Game.continueGame` → `firstLevelOfWorld`, `src/game/scenes/game.ts`), so every death after this midpoint costs the whole world. With Inf. lives on, the player is stuck in the loop.

**Cause:** `src/game/scenes/level.ts` line 141 respawns every checkpoint at a fixed row:
`const start: LevelStart = cp ? { x: cp.x, y: 12, mode: 'stand' } : { mode: 'stand' };`
and `World` puts the feet at the bottom of that row (`src/game/world/world.ts` line 169, `feet = tileToSub(sy + 1)`, the top of row 13). The checkpoint zone has no row: the converter writes only `checkpoint ${x}` (`tools/levelgen/convert-smbc.mjs` line 583), so `ll-5-3.map` line 66 is `checkpoint 154`.

## How often

every time (3 respawns watched in a row; 2 separate runs)

## Notes

- PR #24 check: still applies on main 2225155 (`?level=` and Dev mode; the Lost Levels have no map pages, so there is no campaign path to them on main). The respawn row (`src/game/scenes/level.ts` line 148 on main), `continueGame` and `firstLevelOfWorld` are unchanged outside campaign mode.
- Ours: playtested. The original's side comes from reading its code and data. The ll-w5 tester could not watch it in Ruffle, because reaching the 5-3 midpoint there needs the whole loop-and-bonus route, which takes too long at Ruffle's speed.
- **Scan of every checkpoint (reviewer, all maps in `src/content/levels/` against both XMLs' normal layer).** Our game has 42 checkpoints (21 SMB in worlds 1-7, 21 Lost Levels in worlds 1-7). For 41 of them the original's `halfwayPoint` is on row 12, the same spot as our fixed row, and the column has solid ground on row 13. ll-5-3 is the only one whose midpoint is on a different row (row 9) and the only one with no ground under row 12. So the tester's scan is right, and there is no checkpoint where row 12 is on ground but in a different spot from the original's.
- The checkpoints our game rightly leaves out (`LOCKED_CP="True"`: castles, SMB world 8, Lost Levels 7-4 onwards) include several midpoints that are not on row 12: SMB 1-4, 3-4 and 6-4 at row 9 and 8-4 (area b) at row 10; Lost Levels ll-1-4 and ll-5-4 at row 8, ll-7-4, ll-10-4 and ll-12-4 at row 5, and ll-8-4 (area c) at row 6. The original uses them only on EASY or HARD or with the extra-checkpoints cheat (`Level.as` line 1455), so they don't matter now. They would if locked checkpoints are ever supported.
- **Fix:** store the midpoint's row in the map (for example `checkpoint 154 9`, from the XML cell) and respawn with the feet at the bottom of that row, as the original does. Dropping the player onto the first solid tile from the top of the column would also work for ll-5-3, but it is not what the original does.
- **Related:** `2026-10-05-enemies-not-cleared-on-respawn-or-pipe-exit.md` (formerly `…-1-2-checkpoint-respawn-keeps-nearby-enemies.md`) covers the other half of the original's `startAtHalfwayPoint` (`destroyNearbyEnemies`, 6 tiles). Both fixes go in the same respawn path (`level.ts` `died` handler and the `World` start). In ll-5-3 the enemy removal changes nothing: the nearest enemies, the piranhas in the pipes at columns 147 and 161, are 6.5 and 7.5 tiles from the respawn point, so the original keeps them too. Fixing the row alone is enough to unblock ll-5-3.
- **Related:** `2026-10-05-ll-9-1-death-skips-start-room.md` is in the same `died` handler (`level.ts` line 135): without a checkpoint, ours respawns in `this.level.parent ?? this.level.id`, which skips ll-9-1's start room.
- Screenshot: not committed (the repo's `check:assets` bans image files). It shows Mario just after the respawn, inside the stalk below the mushroom (F1 on, frame 65 after the respawn).
- Source: `ll-w5/2026-10-05-ll-5-3-checkpoint-respawn-falls-into-pit.md`. The reviewer checked the original's code and data, the scan, the game-over route and the converter, and added the scan of every checkpoint and the cross-reference.
- Reviewed: verified against `com/smbc/level/Level.as` (lines 315, 1068-1072, 1404-1405, 1453-1459, 1663-1687), `levelDataSmb.xml` and `levelDataLostLevels.xml` (every `halfwayPoint` and `LOCKED_CP`), and ours: `src/game/scenes/level.ts` (lines 133-143), `src/game/scenes/game.ts` (`gameOver`, `continueGame`, `firstLevelOfWorld`), `src/game/world/world.ts` (start placement, lines 165-200), `tools/levelgen/convert-smbc.mjs` (line 583), and every map's `checkpoint` line.
