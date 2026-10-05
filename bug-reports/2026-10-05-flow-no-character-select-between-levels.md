# No character select between levels (the original shows it before every new level)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** level-to-level transitions, for example 1-2 flagpole → 1-3 and 1-4 axe → 2-1, and warp pipes
- **How to get there:** `?level=1-2&char=mario`, finish the level
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Finish 1-2 at the flagpole, or finish 1-4 with the axe.
2. Watch what comes between the level and the next one.

## Expected

In the original's default game mode, ALL CHARACTERS (`GameSettings._campaignMode = CampaignModes.ALL_CHARACTERS`, also set in `setDefaults()`), each new level starts with the character select screen and then the black "WORLD x-y / lives" card. `Level.completeLevel()` calls `loadNewLevel(new LevelID(...))`. `ScreenManager.loadNewLevel()` sets `statMngr.newLev = true` and calls `createLevel()`, which adds `new CharacterSelect(...)` whenever `newLev` is set and the campaign mode is not `SINGLE_CHARACTER` or `SINGLE_CHARACTER_RANDOM`. After a pick, `selectedCharacterHandler()` shows the `InformativeBlackScreen` pre-level card. A warp to another level takes the same path (`EventManager.levelTransfer()` → `levelIDToLoad` → `loadNewLevel`).

## Actual

Our game goes straight from the end of a level to the "WORLD x-y" card, and then into the level. Character select appears only after losing a life. `exit` events call `game.goToLevel(next, ...)` (`src/game/scenes/level.ts:115`), which pushes only the `IntroScene` (`src/game/scenes/game.ts`, `goToLevel`). Warp pipes skip even the card; that is filed separately.

## How often

every time (1-2 → 1-3, 1-4 → 2-1 and 1-1 → 1-2 all went straight to the card)

## Notes

- Ours: playtested. Original: found by reading the code (`Level.as` `completeLevel` / `loadNewLevel`, `ScreenManager.as` `loadNewLevel` / `createLevel` / `selectedCharacterHandler`). In the original I saw character select after a death and after the level select's GO TO WORLD, which use the same `newLev` path. I did not finish a level in the original to watch it there.
- KNOWN.md lists only the "after losing a life" case.
- The owner may decide that showing character select only after a death is intended for this rebuild; if so, close this as not a bug.
- Related: `2026-10-05-1-2-warp-skips-world-card-and-hud.md`.
- Reviewed: verified against `com/smbc/data/GameSettings.as` (default campaign mode ALL_CHARACTERS), `com/smbc/data/CampaignModes.as`, `com/smbc/level/Level.as` (`completeLevel`, `loadNewLevel`), `com/smbc/managers/ScreenManager.as` (`loadNewLevel`, `createLevel`), and ours: `src/game/scenes/level.ts` (`exit` case), `src/game/scenes/game.ts` (`goToLevel`, `respawn`).
