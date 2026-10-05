# After Bowser in 8-4, ours cuts to a black "PRINCESS IS SAFE / FINAL SCORE" card; the original shows "Your quest is over." in the castle, then rolls the credits

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 8-4, the last room (`8-4-end`): the axe at column 45 and the princess at column 57 (exit marker at column 56)
- **How to get there:** `?level=8-4-end&char=mario&dev=1`, run to the bridge and jump over Bowser onto the axe. In the real level: 8-4, take pipe 81, pipe 163, then pipe 239 or 303 into the water area, and its exit pipe.
- **Character and power:** Mario, small (Dev assists: infinite lives and No damage, used to get past Bowser)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=8-4-end&char=mario&dev=1`, cross to the bridge and touch the axe.
2. Let the bridge fall and Mario walk to the princess. Wait without pressing anything.

## Expected

As in the original (`com/smbc/managers/ScreenManager.as`):

1. When the player has reached the exit and stopped, the camera settles and "Thank you Mario!" appears in
   the castle room (`Level.as` lines 2840-2848 call `displayThankYouText`, `ScreenManager.as` line 358).
2. 1.5 s later (`ADD_TXT_TMR_DUR` = 1500, line 62), because this is the map set's last world
   (`level.worldNum != worldCount` check at line 399; `LevelData.as` lines 79-80 set `_worldCount = 8` for
   SMB), the second line is "Your quest is over." (`GameTextMessages.QUEST_IS_OVER`, line 420) instead of
   the "another castle" text.
3. 2.5 s after that (`START_MOVE_CREDITS_TMR_DUR` = 2500, line 77), the credits music starts (line 435)
   and the two lines, then the credits text and its closing lines, scroll up the screen at
   `CREDITS_SPEED = 40` Flash px/s, 20 px/s at our scale (lines 430-535).
4. When the closing lines reach the middle of the screen, a 6.5 s timer starts (`RESTART_GAME_TMR_DUR`,
   lines 75 and 505-515). When it ends the game records the win (`beatGame`, line 546) and returns to the
   title (`ScreenManager.restartGame`, lines 274-288).

## Actual

- In the castle room, "THANK YOU MARIO!" appears (`build/src/game/world/world.ts` line 1438). For the last
  castle, ours leaves the room 1.5 s later (line 1440, `next === 'end' ? 120`) with no second line.
- `Game.showEnding` (`build/src/game/scenes/game.ts` lines 65-99) then clears the screen to black. It shows
  "THANK YOU MARIO! / THE PRINCESS IS SAFE / AND THE KINGDOM IS FREE. / FINAL SCORE 0005000 / PRESS
  START", and then goes to the title (line 96).
- There is no "Your quest is over." and no credits roll. The ending card is text the original never shows.

Screenshot: `2026-10-05-8-4-ending-no-quest-over-or-credits.png` (the black ending card).

## How often

every time

## Notes

- Evidence: from reading the original's code, and playtested in our game. The original's 8-4 loaded in
  Ruffle for the tester (no freeze), but could not be played to the axe at about 1/7 speed with one life
  left.
- Context only, not part of this bug: in the original, `beatGame` calls `StatManager.beatGameHandler`
  (line 506), which records the win and shows message boxes that unlock cheats (for example "All ground
  is bricks" for the SMB map set, line 516) before going to the title (lines 532-536 and 560-563). Our
  game has no cheat system, so there is nothing to unlock.
- Context: a player can speed the credits up 10× in the original (`fastForwardCredits`,
  `CREDITS_SPEED_FAST`), which also cuts the 6.5 s wait to a quarter.
- Remaining time: neither game turns the remaining time into score after a castle. The original only
  calls `convertTimeToScore` when the level has a flagpole (`EventManager.enterLevelExit`, lines
  260-263), so our final score not including the time is correct.
- The 5000 points from the axe on the score card is the already filed
  `2026-10-05-bowser-axe-awards-5000-points.md`.
- Lost Levels, not checked here: for map sets other than SMB, `_worldCount` is the highest world number in
  the XML (`LevelData.as` lines 72-78), so the original shows "Your quest is over." only after D-4
  (ll-13-4). Ours also runs `showEnding` after ll-8-4 (`ll-8-4-end3.map` has `exit 136 next=end`). The
  Lost Levels testers should compare that flow.
- Source: `smb-w8/2026-10-05-8-4-ending-no-quest-over-or-credits.md`. The reviewer moved the cheat
  unlocks to Notes (we have no cheat system), corrected when the 6.5 s timer starts (when the closing
  lines reach mid-screen, not after the credits have passed), and added the credits speed.
- Reviewed: verified against `com/smbc/managers/ScreenManager.as`, `com/smbc/managers/StatManager.as`
  (`beatGameHandler`), `com/smbc/managers/EventManager.as` (`beatGame`, `enterLevelExit`),
  `com/smbc/level/LevelData.as` (`_worldCount`), `com/smbc/level/Level.as` (lines 2840-2848),
  `GameTextMessages.as`, and ours: `src/game/world/world.ts` (castle text), `src/game/scenes/game.ts`
  (`showEnding`), `src/content/levels/world8/8-4-end.map` (`exit 56 next=end`).
