# After a warp (1-2, 4-2), losing a life sends you back to the old level's midpoint

- **Severity:** blocks progress
- **Build:** V0.1.0-B8379F9
- **Where:** 1-2 warp zone (pipes at columns 178, 182 and 186, to 4-1, 3-1 and 2-1); midpoint at column 97. Also 4-2: warp pipe at column 214 (to 5-1); midpoint at column 98
- **How to get there:** `?level=1-2&char=mario`, pass column 97, ride the rising lifts at column 156 onto the ceiling, walk right to column 187 and drop into the warp zone
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Play 1-2 past the midpoint at column 97. You always pass it on the way to the warp zone at column 176.
2. Enter any warp pipe, for example pipe "4" at column 178, and arrive in 4-1.
3. Lose a life in 4-1 before its own midpoint (I touched the Piranha Plant at the first pipe).
4. Pick Mario on character select.

## Expected

The warp starts a new level and the old midpoint is forgotten. Losing a life in 4-1 restarts 4-1, from its start or from its own midpoint. In the original, `EventManager.levelTransfer()` handles a pipe whose destination is another level: it sets `statMngr.passedHw = false` and then `level.levelIDToLoad = LevelID.Create(newArea)`.

## Actual

The card says WORLD 1-2 and the game restarts in 1-2 at the old midpoint, so the warp is lost. Our `died` handler respawns at `state.checkpoint` when it is set (`src/game/scenes/level.ts:133-141`). A pipe transfer calls `game.startLevel(target, start)` (`level.ts:106`) and never clears `state.checkpoint`, which is cleared only by the `exit` event (`level.ts:110`).

## How often

every time (1 of 1 run through the full warp; the code path has no other branch)

## Notes

- Ours: playtested. Original: found by reading the code (`com/smbc/managers/EventManager.as`, `levelTransfer`).
- To reach the warp zone quickly, I loaded a copy of 1-2 through a `#level=` share link, with the start on the ceiling at column 162 and an extra `checkpoint 164` zone. The level id was still `1-2`. Everything after that was the real game: pipe "4" went to the real 4-1, I died to the 4-1 Piranha Plant, and the next card was "WORLD 1-2" and the game put me back in the real 1-2. With the real midpoint (column 97), you land at column 97.
- Infinite lives was on, and No damage was off for the death.
- Severity: the warp (three worlds of progress) is lost on any death before the destination's own midpoint; reaching 4-1's midpoint replaces the stale checkpoint (`level.ts:85-86`). The pipe handler already sets `game.state.warped = true` for a cross-level pipe (`level.ts:103`) but does not clear the checkpoint there.
- Related: `2026-10-05-1-2-warp-skips-world-card-and-hud.md`.
- Also seen in 4-2 (smb-w4 tester, ours playtested): after passing the 4-2 midpoint (column 98) and warping through the pipe at column 214 to 5-1, a time-up death in 5-1 put Mario back in 4-2 at column 98 (`shots/smb-w4/ours/548_shot.png`, `549_shot.png`, HUD WORLD 4-2, tile 98). The 4-2 vine-area pipes (columns 50, 54 and 58 of `4-2-warp`, to 8-1, 7-1 and 6-1) are reached before the 4-2 midpoint, so a stale checkpoint is not set on that route. Same code path: `4-2.map` `pipe 214 10 down -> 5-1 2 12`.
- Reviewed: verified against `com/smbc/managers/EventManager.as` (`levelTransfer`: `passedHw = false`, `levelIDToLoad`) and ours: `src/game/scenes/level.ts` (`pipe`, `exit`, `checkpoint` and `died` cases), `src/content/levels/world4/4-2.map` (checkpoint 98, pipe 214).
