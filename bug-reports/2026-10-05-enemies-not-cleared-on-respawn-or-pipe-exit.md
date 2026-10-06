# Nearby enemies are not cleared on a midpoint respawn (1-2: three Goombas around Mario), when coming out of a pipe, or when falling back from a sky area; the original removes enemies within 6 tiles

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:**
  - **Midpoint respawn:** 1-2, midpoint at column 97 (Goombas at columns 99, 100 and 102), and most other checkpoints (see Notes).
  - **Pipe exits:** every arrival through a pipe. For example 1-2 column 115 (back from 1-2-bonus; Goomba at column 113), ll-12-1 column 131 and ll-8-2 column 83 (a green Paratroopa stands on the pipe top). There are 16 cases in all; see Notes.
  - **Pit transfers (falling off a sky or coin-heaven area back into the level):** 9 of the 14 returns land near enemies. The worst is ll-11-1 column 114 (back from `ll-11-1-sky`), where Mario drops in among a green Koopa at 111 and Goombas at 113 and 114. See Notes.
- **How to get there:**
  - Respawn: `?level=1-2&char=mario`, play past column 97, then lose a life (for example in the pit at columns 120-121).
  - Pipe exit: `?level=1-2-bonus&char=mario`, then walk right into the exit pipe at column 13. Or use `?level=ll-12-1-bonus&char=mario` and its exit pipe at column 29.
  - Pit transfer: `?level=ll-11-1-sky&char=mario`, climb off the vine and run or fall off the end of the sky area. Mario drops back into ll-11-1 at column 114.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Start 1-2 and play past column 97, the midpoint.
2. Lose a life anywhere after it (the tester fell into the pit at columns 120-121).
3. Pick Mario on character select and watch the respawn at column 97.
4. Pipe exit: take the 1-2 bonus room's exit pipe and watch the arrival at column 115.
5. Pit transfer: fall off `ll-11-1-sky` and watch Mario land at ll-11-1 column 114.

## Expected

The original removes every enemy within 6 tiles horizontally of the player at both of these moments. The routine is `Level.destroyNearbyEnemies(leavePiranhas)` (`Level.as` lines 1676-1689). It destroys each `Enemy` with `|ao.x - player.x| < HW_ENEMY_REMOVAL_DIST`, where `HW_ENEMY_REMOVAL_DIST = TILE_SIZE*6` and `x` is the centre of the enemy's cell. Every enemy in the area is in `AO_DCT` from the moment the level is built (line 1252), so off-screen ones count too.

- **Midpoint restart:** `startAtHalfwayPoint()` (line 1663) calls `destroyNearbyEnemies()`, which removes Piranha Plants too. With the 1-2 midpoint at 97.5 tiles, the Goombas at 99, 100 and 102 are removed. The piranha in the pipe at 103 is exactly 6 tiles away, so it stays.
- **Pipe arrival:** when an area loads through a pipe, `changePlayerLoc()` (lines 1575-1607, called from level setup at line 1403 whenever `pExInt` is set) places the player at the transporter. For an up-exit it calls `player.exitPipeVert(pt)`; otherwise it puts him at `pt`. Either way it then calls `destroyNearbyEnemies(true)`. This keeps green and red Piranha Plants (`PiranhaRed` extends `PiranhaGreen`) and removes every other enemy within 6 tiles of the pipe's centre. In 1-2 that removes the Goomba at 113, two tiles left of the pipe at 115-116.
- **Pit transfer:** falling off an area with a `pitTransferStart` token (`Level.as` lines 1017-1027 → `Character.getPitTransfer`, which stores `[dest, -1]`, `Character.as` lines 3076-3080) loads the destination through `EventManager.levelTransfer(dest, -1)` (`Character.as` line 3004). The destination's `pitTransferEnd` token is a `PipeTransporter` with `pipeInt = -1` (`PipeTransporter.as` lines 73-78). Because `pExInt` is -1 (non-zero), level setup calls `changePlayerLoc()` (line 1402), which puts the player at the transporter and then calls `destroyNearbyEnemies(true)`, the same as a pipe arrival. Every `pitTransferEnd` on the normal layer has `shiftRight`, so the landing point is the right edge of its cell.

## Actual

- **Respawn:** Mario reappears at column 97 with all three Goombas present. On the first frame, one Goomba already overlaps him and two more are 1-3 tiles to the right, walking toward him. Without a power-up this is almost an instant second death.
- **Pipe exit:** there is no removal step at all. The `pipe-exit` start mode in `src/game/world/world.ts` (lines 189-195) only places and freezes the players, so every enemy the map puts near the pipe is there when Mario comes up.
- **Pit transfer:** the same. A fall below the screen in an area with a `pit` zone calls `this.transfer(pit.target, 'fall')` (`src/game/world/world.ts` lines 596-601), and the `fall` start mode only drops the players in from above the screen (line 180). The ll-wB tester saw Mario land among the Koopa at 111 and the Goombas at 113-114 in ll-11-1 (`gauntlet/notes/llwB/m17.png`, frame 3).

## How often

every time (respawn: 3 of 3; pit transfer: seen once in ll-11-1; pipe exit: from code and map data, not playtested)

## Notes

- PR #24 check: still applies on main 2225155 (campaign and ?level=). The respawn, pipe-exit and pit-transfer code (`src/game/world/world.ts`, the `died` handler in `src/game/scenes/level.ts`) has no enemy removal on main either; the SMB cases happen the same way in a level entered from the map, and the Lost Levels cases only through `?level=` and Dev mode.
- Respawn: playtested in ours. Original: found by reading the code (`com/smbc/level/Level.as`, `startAtHalfwayPoint` / `destroyNearbyEnemies`, `HW_ENEMY_REMOVAL_DIST`). The tester didn't die after the midpoint in the original.
- Our `World` constructor (`src/game/world/world.ts`) spawns everything up to the camera's right edge plus 16 px and has no removal step on either path.
- The first screenshot was taken with the Dev assists Infinite lives and No damage on, only so the respawn could be watched. The Goombas are there with or without assists.
- Screenshot: not committed (the repo's `check:assets` bans image files) (frame 107 after respawn, F1 overlay showing tile 97,12).
- **Also in the Lost Levels (folded in by the ll-w3 to ll-w5 review, from the maps and XML; not playtested):**
  - ll-6-2 has a red Koopa in the midpoint's own cell. `<LEVEL ID="6-2">` area `b` cell 114,12 is `halfwayPoint&&shiftRight()enemyKoopaRed&&HideOnDifficulties=easy`, so the Koopa is there on NORMAL. Ours has the `K` marker at 114,12 in `ll-6-2.map` and `checkpoint 114`, so Mario respawns on top of it. The original removes it.
  - A scan of our maps finds enemies within 6 tiles of the respawn point at most checkpoints, for example ll-1-1 (Goombas at 102 and 103), ll-1-3 (red Koopa at 100), ll-2-2 (green Koopa at 134), ll-4-2 (green Koopas at 109 and 110), ll-5-2 (Goombas at 101 and 102, row 8), ll-6-3 (red Koopa at 133), 3-1, 4-2, 4-3 and 7-3.
  - Whether each enemy is on screen at the respawn depends on our spawn margin.
- **Pipe arrivals with a non-Piranha enemy within 6 tiles** (folded in by the ll-w7 review). This is the reviewer's scan of every pipe link target and `pipe-exit` start in our maps (`session-scratchpad/llw7rev/pipescan.py`; distance measured from the centre of the 2-wide pipe). In each case the original removes the enemy:
  - SMB, back from the bonus room or water area: 1-2 at 115 (Goomba 113,12), 2-1 at 115 (Goombas 114,10 and 120,12), 3-1 at 67 (green Koopa 65,12), 4-2 at 131 (green Koopa 137,12), 5-2 at 115 (Hammer Bro 120,8), 6-2 at 115 (Buzzy Beetle 120,4), 7-1 at 115 (green Koopa 114,12), 8-1 at 115 (Goomba 111,12 and green Koopa 119,12). All of these were checked in `levelDataSmb.xml` (normal layer), where the same enemies sit next to the `pipeTransporterGlobalVertEnd` cell.
  - Lost Levels: ll-1-1 at 163 (red Koopa 161,12), ll-3-1 at 90 (green Koopa 93,12 and red Paratroopa 95,9), ll-4-2 at 179 (Hammer Bro 174,7), ll-8-4 at 47 (red Paratroopa 44,8), ll-10-1 at 147 (green Paratroopas 147,7 and 151,7), and the two worst cases:
    - **ll-12-1 at 131:** a green Paratroopa at 132,10, on the pipe top. XML `<LEVEL ID="12-1">` a 132,10 is `enemyWingedKoopaGreen`, with no difficulty filter.
    - **ll-8-2 at 83:** a green Paratroopa at 83,10, on the pipe top. XML 8-2 a 83,10 includes `enemyWingedKoopaGreen&&HideOnDifficulties=hard`, so it is there on NORMAL.
  - World 7 has no such case (ll-w7 tester).
  - Bonus rooms entered by a down pipe have no enemies near the landing point. The original runs the same removal there (`changePlayerLoc` without `exitPipeVert`).
- **Pit-transfer returns with a non-Piranha enemy within 6 tiles** (folded in by the ll-w6/w9/wB review from the ll-wB notes; reviewer's scan of every `pit` zone in our maps against the `pitTransferEnd` cell and the enemies on the normal layer of both XMLs, distance from the landing point to the enemy's x). The original removes each of these; ours keeps them all:
  - SMB: 2-1 at 162 (Goombas 162,12 and 163,12), 3-1 at 162 (Goomba 157,12, green Paratroopas 165,12 and 168,11), 5-2 at 130 (Buzzy Beetle 136,12), 6-2 at 162 (Buzzy Beetle 163,12).
  - Lost Levels: ll-2-1 at 146 (green Paratroopa 152,12), ll-3-1 at 146 (red Koopa 143,8), ll-11-1 at 114 (green Koopa 111,12, Goombas 113,12 and 114,12), ll-12-1 at 130 (green Paratroopa 132,10), ll-13-2 at 114 (green Koopa 109,8).
  - No enemies near the landing point: ll-4-1 (98), ll-5-1 (386), ll-8-3 (114), ll-9-3 (98), ll-10-1 (50).
  - Several of these are 5.5 tiles away, inside the original's 6-tile limit by half a tile. Ours lands Mario centred on the column, half a tile left of the original's landing point, because the converter ignores `shiftRight` (`2026-10-05-converter-ignores-shiftup-shiftright.md`). A fix should measure from the original's point, or these enemies can end up just outside the 6 tiles.
- **Related:** `2026-10-05-ll-5-3-checkpoint-respawn-falls-into-pit.md` covers the other half of `startAtHalfwayPoint`: the original puts the player's feet at the midpoint's own row (`hwPnt`), while ours always uses row 12. Both fixes go in the same respawn path. In ll-5-3 itself the enemy removal changes nothing (the nearest piranhas are 6.5 and 7.5 tiles away). `2026-10-05-pipe-exit-rises-above-pipe.md` covers the other pipe-exit difference. One shared helper (remove enemies within 6 tiles, optionally keeping Piranhas) fixes all three cases in this report.
- Sources: `smb-w1/2026-10-05-1-2-checkpoint-respawn-keeps-nearby-enemies.md` (this final was `2026-10-05-1-2-checkpoint-respawn-keeps-nearby-enemies.md` until the ll-w7 review widened it), and the pipe-exit note in `ll-w7/2026-10-05-pipe-exit-rises-above-pipe.md` (Notes) and `notes/ll-w7.md`.
- Reviewed: verified against `com/smbc/level/Level.as` (`startAtHalfwayPoint` calls `destroyNearbyEnemies()`; `changePlayerLoc` calls `destroyNearbyEnemies(true)`, line 1606; `HW_ENEMY_REMOVAL_DIST = TILE_SIZE*6`, `TILE_SIZE` 32; enemies added to `AO_DCT` at build, line 1252; the pit-transfer path through lines 1017-1027, 1402 and 1575-1607), `com/smbc/characters/Character.as` (lines 3004, 3076-3080), `com/smbc/pickups/PipeTransporter.as` (lines 73-78), `com/smbc/managers/EventManager.as` (`levelTransfer`), `com/smbc/enemies/PiranhaRed.as`, both level XMLs for the pipe cases listed, and ours at b8379f9: `src/game/scenes/level.ts` `died` handler (lines 133-142) respawns at `state.checkpoint` through `game.respawn` with no enemy-removal step; `src/game/world/world.ts` `pipe-exit` start mode (lines 189-195) and pit transfer (lines 596-601, `fall` start at line 180) have none either; every `pit` zone in `src/content/levels/`.

Status: fixed — a checkpoint restart removes every enemy within 6 tiles of the player, and pipe and pit arrivals remove those within 6 tiles of the transporter point except Piranha Plants (Level.destroyNearbyEnemies, HW_ENEMY_REMOVAL_DIST).
