# ll-9-1: after a death (or a Continue) ours restarts in the flooded main area; the original restarts in the start room with the pipe

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** ll-9-1, any death (for example the pit at columns 32-37). The respawn lands at column 1, row 3 of `ll-9-1` instead of in `ll-9-1-start`. A death in the start room itself (for example to the red piranha in the pipe at column 23) also respawns in `ll-9-1`.
- **How to get there:** `?level=ll-9-1-start&char=mario`, climb the steps, go down the pipe at column 23, then lose a life in ll-9-1. (Quicker: `?level=ll-9-1&char=mario` and sink into the pit at column 32. The respawn rule is the same, because `ll-9-1` has no parent.)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Enter ll-9-1 (from `ll-9-1-start` through the pipe at column 23, or with `?level=ll-9-1`).
2. Swim to column 32 and let Mario sink into the pit.
3. On SELECT YOUR HERO, press Z.

## Expected

As in the original, the level restarts in its first area, the overworld start room (`ll-9-1-start`).

- **After a death.** `EventManager.dieDurTmrLsr` → `checkGameOver()` calls `level.reloadLevel()` while lives remain (`EventManager.as` lines 95-115). `Level.reloadLevel()` (`com/smbc/level/Level.as` lines 3426-3441) loads `LevelID.Create(_id.nameWithoutArea)`, which is area `a` (`LevelID.DEFAULT_AREA = "a"`, `com/smbc/data/LevelID.as` line 8). It only skips to area `b` when area `a` is an `INTRO`, and it only uses the midpoint area when `shouldStartAtCheckPoint` is true. 9-1 has `LOCKED_CP="True"`, so on normal there is no checkpoint (`shouldStartAtCheckPoint`, line 1453).
- **The data.** In `levelDataLostLevels.xml`, `<LEVEL ID="9-1" TIME="400" MAIN_AREA="b" HW_AREA="b" LOCKED_CP="True">` (line 426) has `<AREA ID="a" TYPE="normal">` (32 wide): the room with the steps and the pipe to area `b`. So after a death Mario climbs the steps and takes the pipe again. Playtested in Ruffle: picking 9-1 in the original's level select also starts in this room (`shots/ll-w9/orig/029_o91.png`).
- **After a Continue.** `StatManager.continueAfterDyingHandler` → `changeToFirstWorldLevel()` (`StatManager.as` lines 339-342 and 550-554) sets `new LevelID(world, 1)`, which is area `a` too.
- **Only 9-1 is affected.** It is the only level in either map set whose `MAIN_AREA` is not `a` while area `a` is a normal area. The others with `MAIN_AREA="b"` (SMB 1-2, 2-2, 4-2, 7-2; Lost Levels 1-2, 3-2, 5-2, 6-2, 10-2, 11-2) have an `intro` area `a`, which the original skips on a reload, and ours does too.

## Actual

`src/game/scenes/level.ts` line 135 respawns at `cp?.level ?? this.level.parent ?? this.level.id`. `ll-9-1` has no `parent`, and `ll-9-1-start` has `parent: ll-9-1`. So a death in either area respawns in `ll-9-1` at its start (1,3, `startMode: fall`): Mario appears high in the flooded area, to the right of the start room.

A Continue does the same. `Game.continueGame` (`src/game/scenes/game.ts` line 290) uses `firstLevelOfWorld` (lines 303-314), which returns `ll-9-1`, not `ll-9-1-start`. Only `Game.showEnding` (game.ts line 74) enters World 9 through `ll-9-1-start`.

## How often

every time

## Notes

- PR #24 check: still applies on main 2225155 (`?level=` and Dev mode; the Lost Levels have no map pages, so there is no campaign path to them on main). The `died` handler (`src/game/scenes/level.ts` line 142 on main) and `continueGame`/`firstLevelOfWorld` (`src/game/scenes/game.ts` lines 514-538) are unchanged outside campaign mode.
- Evidence: ours playtested (death in the pit at columns 32-37, then character select, then the respawn in the water area). The original was checked by reading its code and data. Its start room was seen in Ruffle, but the tester did not die in 9-1 there.
- **The timer is not affected.** Ours carries the running clock from the start room through the pipe (`ll-9-1-start.map` has `time: inherit`), and so does the original (seen in Ruffle: 366 before and after the pipe). After a death, `level.ts` sets `state.time = null`, so a respawn in `ll-9-1-start` would start at 400 (`startTime`, `src/game/world/world.ts` line 71). That matches the original.
- **Fix idea:** make the respawn and Continue target the level's entry area. The converter already knows it (`entryId()` in `tools/levelgen/convert-smbc.mjs`, lines 290-300, returns `ll-9-1-start` for 9-1), so it could be written into the maps (for example as the main area's entry) and used by both the `died` handler and `firstLevelOfWorld`.
- **Related:** `2026-10-05-ll-5-3-checkpoint-respawn-falls-into-pit.md` and `2026-10-05-enemies-not-cleared-on-respawn-or-pipe-exit.md` are about the same respawn path (`level.ts` `died` handler, lines 133-142). Those two are about where a checkpoint respawn puts the player and what it clears. This one is about which area a respawn without a checkpoint uses. They can be fixed together, but none of them depends on another.
- **Related:** `2026-10-05-lost-levels-progression-departs-from-nes-rules.md` (ll-w9's notes ask whether NES World 9 allows a Continue at all; that is an owner question and not part of this report).
- Screenshot: not committed (the repo's `check:assets` bans image files) (ours: after the death at column 32 and SELECT YOUR HERO, Mario is back in the flooded area at column 1).
- Source: `ll-w9/2026-10-05-ll-9-1-death-skips-start-room.md`. The reviewer traced the death path from `EventManager` and added the start-room death, the timer check and the cross-references.
- Reviewed: verified against `com/smbc/managers/EventManager.as` (lines 95-115), `com/smbc/level/Level.as` (lines 1453-1459, 3426-3441), `com/smbc/data/LevelID.as` (line 8, `Create`), `com/smbc/managers/StatManager.as` (lines 339-342, 550-554), `levelDataSmb.xml` and `levelDataLostLevels.xml` (every `MAIN_AREA`), and ours at b8379f9: `src/game/scenes/level.ts` (lines 122-142), `src/game/scenes/game.ts` (lines 66-75, 279-314), `src/game/world/world.ts` (line 71), `src/content/levels/lost/world9/ll-9-1.map` and `ll-9-1-start.map`, `tools/levelgen/convert-smbc.mjs` (`entryId`).
