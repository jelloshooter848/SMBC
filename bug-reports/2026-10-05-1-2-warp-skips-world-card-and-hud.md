# A warp pipe (1-2, 4-2) skips the WORLD card and the HUD keeps showing the old world

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9 (rechecked against main 2225155 after PR #24)
- **Where:** 1-2 warp zone, pipes at columns 178 (to 4-1), 182 (to 3-1) and 186 (to 2-1). Also 4-2: pipe at column 214 (to 5-1) and the vine area `4-2-warp` pipes at columns 50, 54 and 58 (to 8-1, 7-1 and 6-1); Lost Levels ll-3-1 (column 246, to ll-1-1), ll-5-1 (column 406, to ll-6-1), ll-8-1 (`ll-8-1-exit` column 22, to ll-5-1), ll-10-2 (column 214, to ll-11-1) and ll-11-4 (`ll-11-4-exit` column 22, to ll-13-1)
- **How to get there:** campaign: from a save file with 1-1 cleared, pick 1-2 on the World 1 map; or `?level=1-2&char=mario`. Then ride the rising lifts at column 156 onto the ceiling, walk right to column 187, drop in and stand on a warp pipe
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Reach the 1-2 warp zone over the ceiling.
2. Stand on pipe "4" (column 178) and press down.

## Expected

A warp starts a new level like finishing one: the original shows character select (in the default All Characters mode) and then the black "WORLD 4-1 / lives" card, and the HUD reads WORLD 4-1. In the original, `EventManager.levelTransfer()` sets `level.levelIDToLoad` for a pipe to another level. `Level` then calls `loadNewLevel()`, and `ScreenManager.loadNewLevel()` sets `statMngr.newLev = true` and calls `createLevel()`, which shows `CharacterSelect` and then the `InformativeBlackScreen` pre-level card.

## Actual

The pipe cuts straight into 4-1 with no card and no character select, and the HUD still says WORLD 1-2. The timer is correctly reset to 400.

On main 2225155 (by reading the code, not playtested) a player sees the same in both modes; a campaign warp does not go to the map:

- The pipe handler still calls `game.startLevel(target, start)` (`src/game/scenes/level.ts` line 108). Only `goToLevel()` updates `state.world` and `state.stage` (`src/game/scenes/game.ts` lines 421-422) and shows the `IntroScene`, and the HUD prints `state.world`-`state.stage` (`src/game/hud/hud.ts` line 32).
- **Campaign (save file and map):** just before that, the pipe calls `game.campaignWarp(target.world)` (`level.ts` line 105; game.ts lines 253-261). It opens the target world on the map (only that one), moves the hero's map position to that world's start and saves the file. Nothing of this shows during play. The player sees it the next time the map appears: after clearing 4-1 (the World 4 page), or after Quit to map or a game over (the World 4 start).
- **`?level=` and Dev mode:** unchanged.
- The Lost Levels warps listed under Where have no map pages on main, so they are reached only through `?level=` and Dev mode.

## How often

every time (2 of 2 warps: pipe "2" to 2-1 and pipe "4" to 4-1)

## Notes

- **Owner decision (2026-10-05), campaign mode:** route warps through the world map ("option B").
  - Taking a warp pipe ends the level and returns to the map.
  - The map slides to the target world, and that world draws in.
  - The player picks the level there, which then goes through character select and the WORLD card as usual.
  - This replaces the direct jump into the target level, and fixes the missing card, HUD update and character select in campaign mode.
  - The warp must also clear the old checkpoint (see `2026-10-05-1-2-warp-keeps-1-2-checkpoint.md`).
- **Owner decision (2026-10-05), direct mode:** this covers `?level=`, Dev mode, shared and custom levels, editor playtests, and every Lost Levels game until those worlds get map pages. Direct mode should behave as if there were no world map, which is the original's flow.
  - A warp goes to character select, then the WORLD card for the target level, then the target level, with the HUD showing the new world.
  - The old checkpoint is cleared, as in campaign mode.
- Ours: playtested. Original: found by reading the code (`EventManager.as` `levelTransfer`, `Level.as` `loadNewLevel`, `ScreenManager.as` `loadNewLevel` / `createLevel`). The warp zone layout and destinations (4-1, 3-1, 2-1) match `levelDataSmb.xml` (`pipeTransporterGlobalVert` `pTransDest` at x=178, 182 and 186).
- I tested this with a share-link copy of 1-2 that started on the ceiling, so the attached screenshot's HUD reads "WORLD 1-1": a share-link game starts with world 1-1 state. In a normal run, the HUD would keep reading "1-2" in 4-1, 3-1 or 2-1.
- Screenshot: not committed (the repo's `check:assets` bans image files) (4-1 start, straight after the pipe, HUD showing the old world).
- Character select: `2026-10-05-flow-no-character-select-between-levels.md` was moved to `final-superseded/` after PR #24, because in campaign mode a level picked on the map now always goes through character select (`enterLevelFromMap`, game.ts lines 169-194). A warp still skips character select in both modes, so that part is tracked here now. (At b8379f9 this note said the missing character select was the same issue as that report, and that this report still stood for the WORLD card and the HUD if the owner closed it.)
- PR #24 check: still applies on main 2225155 (campaign and `?level=`); Actual updated with main's line numbers and the campaign map side effect. Original b8379f9 references: `level.ts:106` (`startLevel`), `game.ts:213-214` (`state.world`/`state.stage`), `hud.ts:32`.
- Related: `2026-10-05-1-2-warp-keeps-1-2-checkpoint.md`.
- Also seen in 4-2 (smb-w4 tester, ours playtested): the pipe at column 214 to 5-1 and the vine-area pipe at column 58 to 6-1 both went straight into the new level with no WORLD card, and the HUD still read WORLD 4-2 (`shots/smb-w4/ours/543_w51.png`: 5-1 start, HUD "WORLD 4-2"). Same code path: `4-2.map` `pipe 214 10 down -> 5-1 2 12` and `4-2-warp.map` pipes 50/54/58 to 8-1/7-1/6-1, all handled by the `pipe` case in `level.ts`.
- Also seen in the Lost Levels (folded in by the ll-w3 to ll-w5 review; ours playtested, original not): ll-3-1, the backwards warp pipe at column 246 (`ll-3-1.map` line 55, `pipe 246 10 down -> ll-1-1 2 12`; also the exit area's pipe at 22, `ll-3-1-exit.map` line 35) went straight into ll-1-1 with no WORLD card, and the timer carried over (390) instead of restarting (ll-w3 notes). ll-5-1, the warp pipe at column 406 (`ll-5-1.map` line 64, `-> ll-6-1 2 12`) went straight into ll-6-1 with no WORLD card (ll-w5 notes).
- Also seen in ll-8-1 (folded in by the ll-w8 review; ours playtested from a test map starting at column 172, original not): the backward warp pipe in the warp-zone room (`ll-8-1-exit.map` line 35, `pipe 22 10 down -> ll-5-1 2 12`, after "WELCOME TO WARP ZONE!" and "5") went straight into ll-5-1 with no WORLD card, and the tester saw the HUD stay on 8-1 (ll-w8 notes, ll-8-1 section). The run started from a test map, so the HUD value is less certain than the missing card.
- Also seen in Worlds A and B (folded in by the ll-w6/w9/wB review; ours playtested, original not): ll-10-2's warp pipe "B" at column 214 (`ll-10-2.map` line 51, `pipe 214 10 down -> ll-11-1 2 12`) went into ll-11-1 with no WORLD card (ll-wA notes), and the single warp pipe in ll-11-4's exit area (`ll-11-4-exit.map` line 35, `pipe 22 10 down -> ll-13-1 2 12`) went into ll-13-1 the same way (ll-wB notes). Both match the original's XML destinations.
- Reviewed: verified against `com/smbc/managers/EventManager.as` (`levelTransfer`), `com/smbc/level/Level.as` (`levelIDToLoad` → `loadNewLevel`), `com/smbc/managers/ScreenManager.as` (`loadNewLevel`, `createLevel`, `selectedCharacterHandler`), `levelDataSmb.xml`, and ours: `src/game/scenes/level.ts`, `src/game/scenes/game.ts`, `src/game/hud/hud.ts`, `src/content/levels/world4/4-2.map`, `src/content/levels/world4/4-2-warp.map`.
