# After a warp (1-2, 4-2), losing a life sends you back to the old level's midpoint

- **Severity:** blocks progress
- **Build:** V0.1.0-B8379F9 (rechecked against main 2225155 after PR #24)
- **Where:** 1-2 warp zone (pipes at columns 178, 182 and 186, to 4-1, 3-1 and 2-1); midpoint at column 97. Also 4-2: warp pipe at column 214 (to 5-1); midpoint at column 98
- **How to get there:** campaign: from a save file with 1-1 cleared, pick 1-2 on the World 1 map; or `?level=1-2&char=mario`. Then pass column 97, ride the rising lifts at column 156 onto the ceiling, walk right to column 187 and drop into the warp zone
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Play 1-2 past the midpoint at column 97. You always pass it on the way to the warp zone at column 176.
2. Enter any warp pipe, for example pipe "4" at column 178, and arrive in 4-1.
3. Lose a life in 4-1 before its own midpoint (I touched the Piranha Plant at the first pipe).
4. Pick Mario on character select.
5. Campaign only: pause and choose Quit to map (or lose every life and choose CONTINUE? YES).

## Expected

The warp starts a new level and the old midpoint is forgotten. Losing a life in 4-1 restarts 4-1, from its start or from its own midpoint. In the original, `EventManager.levelTransfer()` handles a pipe whose destination is another level: it sets `statMngr.passedHw = false` and then `level.levelIDToLoad = LevelID.Create(newArea)`.

## Actual

On main 2225155 (by reading the code, not playtested) the old checkpoint is still kept after a warp in both modes. The `pipe` case calls `game.startLevel(target, start)` (`src/game/scenes/level.ts` line 108) and never clears `state.checkpoint`. It is cleared only by the `exit` event (`level.ts` line 112), by `returnToMap` (`src/game/scenes/game.ts` line 225) and when a level is entered from the map (`enterLevelFromMap`, game.ts line 173). The `died` handler still respawns at the checkpoint (`level.ts` lines 141-150).

- **`?level=` and Dev mode:** unchanged. The card says WORLD 1-2 and the game restarts in 1-2 at the old midpoint, so the warp is lost.
- **Campaign (save file and map):** the death in 4-1 also gives the WORLD 1-2 card and a restart at 1-2 column 97. But the warp itself now calls `game.campaignWarp(4)` (`level.ts` line 105; game.ts lines 253-261), which opens World 4 on the map, moves the hero's map position to World 4's start and saves the file. So in campaign mode the warp is not lost: Pause > Quit to map, or a game over and CONTINUE? YES (`gameOver`, game.ts line 502), both go through `returnToMap`, which clears the checkpoint and shows the World 4 page, where 4-1 can be picked. A player who just plays on is still sent back into 1-2.

## How often

every time (1 of 1 run through the full warp; the code path has no other branch)

## Notes

- **Owner decision (2026-10-05):** do what the original does. A warp clears the old level's checkpoint, so dying in 4-1 after a warp restarts 4-1, never 1-2. This applies in every mode. In campaign mode, warps will also go through the map (see the owner's decision in `2026-10-05-1-2-warp-skips-world-card-and-hud.md`), so the checkpoint must be cleared there too.
- PR #24 check: partly changed on main 2225155. The stale checkpoint is kept in both modes; in campaign mode the warp's world stays open on the map (see Actual). The severity "blocks progress" holds for `?level=` and Dev mode; in campaign mode the player can recover through the map, so the owner may want to lower it there.
- Original b8379f9 Actual: "The card says WORLD 1-2 and the game restarts in 1-2 at the old midpoint, so the warp is lost. Our `died` handler respawns at `state.checkpoint` when it is set (`src/game/scenes/level.ts:133-141`). A pipe transfer calls `game.startLevel(target, start)` (`level.ts:106`) and never clears `state.checkpoint`, which is cleared only by the `exit` event (`level.ts:110`)." There was no campaign mode then.
- Ours: playtested. Original: found by reading the code (`com/smbc/managers/EventManager.as`, `levelTransfer`).
- To reach the warp zone quickly, I loaded a copy of 1-2 through a `#level=` share link, with the start on the ceiling at column 162 and an extra `checkpoint 164` zone. The level id was still `1-2`. Everything after that was the real game: pipe "4" went to the real 4-1, I died to the 4-1 Piranha Plant, and the next card was "WORLD 1-2" and the game put me back in the real 1-2. With the real midpoint (column 97), you land at column 97.
- Infinite lives was on, and No damage was off for the death.
- Severity: the warp (three worlds of progress) is lost on any death before the destination's own midpoint; reaching 4-1's midpoint replaces the stale checkpoint (`level.ts:85-86`). The pipe handler already sets `game.state.warped = true` for a cross-level pipe (`level.ts:103`) but does not clear the checkpoint there.
- Related: `2026-10-05-1-2-warp-skips-world-card-and-hud.md`.
- Also seen in 4-2 (smb-w4 tester, ours playtested): after passing the 4-2 midpoint (column 98) and warping through the pipe at column 214 to 5-1, a time-up death in 5-1 put Mario back in 4-2 at column 98 (`shots/smb-w4/ours/548_shot.png`, `549_shot.png`, HUD WORLD 4-2, tile 98). The 4-2 vine-area pipes (columns 50, 54 and 58 of `4-2-warp`, to 8-1, 7-1 and 6-1) are reached before the 4-2 midpoint, so a stale checkpoint is not set on that route. Same code path: `4-2.map` `pipe 214 10 down -> 5-1 2 12`.
- Reviewed: verified against `com/smbc/managers/EventManager.as` (`levelTransfer`: `passedHw = false`, `levelIDToLoad`) and ours: `src/game/scenes/level.ts` (`pipe`, `exit`, `checkpoint` and `died` cases), `src/content/levels/world4/4-2.map` (checkpoint 98, pipe 214).

Status: fixed — a pipe into another world or stage clears the checkpoint (and the carried clock) in every mode, as EventManager.levelTransfer sets passedHw = false, so a death after a warp restarts the target level.
