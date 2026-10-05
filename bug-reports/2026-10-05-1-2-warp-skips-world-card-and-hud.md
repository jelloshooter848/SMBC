# A warp pipe (1-2, 4-2) skips the WORLD card and the HUD keeps showing the old world

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 1-2 warp zone, pipes at columns 178 (to 4-1), 182 (to 3-1) and 186 (to 2-1). Also 4-2: pipe at column 214 (to 5-1) and the vine area `4-2-warp` pipes at columns 50, 54 and 58 (to 8-1, 7-1 and 6-1)
- **How to get there:** `?level=1-2&char=mario`, ride the rising lifts at column 156 onto the ceiling, walk right to column 187, drop in and stand on a warp pipe
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Reach the 1-2 warp zone over the ceiling.
2. Stand on pipe "4" (column 178) and press down.

## Expected

A warp starts a new level like finishing one: the original shows character select (in the default All Characters mode) and then the black "WORLD 4-1 / lives" card, and the HUD reads WORLD 4-1. In the original, `EventManager.levelTransfer()` sets `level.levelIDToLoad` for a pipe to another level. `Level` then calls `loadNewLevel()`, and `ScreenManager.loadNewLevel()` sets `statMngr.newLev = true` and calls `createLevel()`, which shows `CharacterSelect` and then the `InformativeBlackScreen` pre-level card.

## Actual

The pipe cuts straight into 4-1 with no card and no character select, and the HUD still says WORLD 1-2. Our pipe handler calls `game.startLevel(target, start)` (`src/game/scenes/level.ts:106`). Only `goToLevel()` updates `state.world` and `state.stage` (`src/game/scenes/game.ts:213-214`) and shows the `IntroScene`, and the HUD prints `state.world`-`state.stage` (`src/game/hud/hud.ts:32`). The timer is correctly reset to 400.

## How often

every time (2 of 2 warps: pipe "2" to 2-1 and pipe "4" to 4-1)

## Notes

- Ours: playtested. Original: found by reading the code (`EventManager.as` `levelTransfer`, `Level.as` `loadNewLevel`, `ScreenManager.as` `loadNewLevel` / `createLevel`). The warp zone layout and destinations (4-1, 3-1, 2-1) match `levelDataSmb.xml` (`pipeTransporterGlobalVert` `pTransDest` at x=178, 182 and 186).
- I tested this with a share-link copy of 1-2 that started on the ceiling, so the attached screenshot's HUD reads "WORLD 1-1": a share-link game starts with world 1-1 state. In a normal run, the HUD would keep reading "1-2" in 4-1, 3-1 or 2-1.
- Screenshot: `2026-10-05-1-2-warp-skips-world-card-and-hud.png` (4-1 start, straight after the pipe, HUD showing the old world).
- The missing character select is the same issue as `2026-10-05-flow-no-character-select-between-levels.md`; if the owner closes that one as intended, this report still stands for the WORLD card and the HUD.
- Related: `2026-10-05-1-2-warp-keeps-1-2-checkpoint.md`.
- Also seen in 4-2 (smb-w4 tester, ours playtested): the pipe at column 214 to 5-1 and the vine-area pipe at column 58 to 6-1 both went straight into the new level with no WORLD card, and the HUD still read WORLD 4-2 (`shots/smb-w4/ours/543_w51.png`: 5-1 start, HUD "WORLD 4-2"). Same code path: `4-2.map` `pipe 214 10 down -> 5-1 2 12` and `4-2-warp.map` pipes 50/54/58 to 8-1/7-1/6-1, all handled by the `pipe` case in `level.ts`.
- Reviewed: verified against `com/smbc/managers/EventManager.as` (`levelTransfer`), `com/smbc/level/Level.as` (`levelIDToLoad` → `loadNewLevel`), `com/smbc/managers/ScreenManager.as` (`loadNewLevel`, `createLevel`, `selectedCharacterHandler`), `levelDataSmb.xml`, and ours: `src/game/scenes/level.ts`, `src/game/scenes/game.ts`, `src/game/hud/hud.ts`, `src/content/levels/world4/4-2.map`, `src/content/levels/world4/4-2-warp.map`.
