# No fireworks after the flagpole when the time ends in 1, 3 or 6 (the original fires that many, 500 points each)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every flagpole level in both map sets (64 flagpole areas in our maps: 24 SMB, 40 Lost Levels). Seen at ll-7-1 (flagpole column 202, castle door column 208) and ll-7-3 (flagpole column 315, door column 322).
- **How to get there:** `?level=ll-7-1&char=mario&dev=1` and play to the flagpole at column 202. For a quick test the tester used a copy of ll-7-1 with only the start moved to column 193, row 4 (on the bricks before the flag); the HUD then says WORLD 1-1.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open ll-7-1 and press F1.
2. Touch the flagpole at column 202 when the HUD TIME ends in 1, 3 or 6 (the tester's run read 386).
3. Watch the time tally and the castle until the next level loads.

## Expected

When the time on the HUD at the moment Mario touches the flag ends in 1, 3 or 6, the original sets off that many fireworks over the castle, each worth 500 points:

- **The digit is taken at the flag touch.** `EventManager.touchedFlagPole()` calls `StatManager.touchFlag()` (`StatManager.as` line 409), which stores the HUD text (`TopScreenText.timeRemaining`, the `TIME_DISP_TFC` text) as `timeLeftBeatLevel` and stops the timer.
- **The fireworks start when the tally ends.** The time-to-score tally (`convertTimeToScore`, started from `EventManager.enterLevelExit` on flagpole levels only) runs down to 0. Then `timeScoreConverterTmrLsr` (lines 447-451) takes the last character of `timeLeftBeatLevel`. If it is `"1"`, `"3"` or `"6"`, it sets `level.fireworksRemaining = int(lastTimeDigit)` and calls `level.raiseFlag()`.
- **The fireworks and the castle flag start together.** `Level.raiseFlag()` (lines 3528-3550) starts the castle flag rising and, in the same call, picks `FireworkLocations.FW_6_ARR`, `FW_3_ARR` or `FW_1_ARR` and calls `launchNextFirework()` (line 3497).
- **One firework at a time, 400 ms each, 500 points each.** Each `Firework` (`com/smbc/projectiles/Firework.as`) adds `ScoreValue.FIREWORK` points when it is created (`ScoreValue.as` line 114: `FIREWORK = 500`) and plays the cannon sound. It removes itself after 400 ms (`NEXT_FIREWORK_TMR`), and its `cleanUp()` launches the next one. So the totals are +500, +1500 or +3000.
- **The level ends 1 s after the last firework.** When none are left, `launchNextFirework` starts `WIN_END_TMR_FIREWORKS_DUR` = 1000 ms. Without fireworks, `raiseFlag` uses `WIN_END_TMR_NORMAL_DUR` = 2000 ms. In both cases the level also waits for the win-music timer. From the end of the tally: 6 fireworks take 2.4 s + 1.0 s = 3.4 s, 3 take 2.2 s, 1 takes 1.4 s, and none takes 2.0 s.
- **Positions** (`FireworkLocations.as`, in tiles, x from the castle flag's x and y from a point 1 tile above the castle flag's starting height): (-1, -4), (-3, -1), (+3, -3), (+3, 0), (0, -3), (-3, -1). Three fireworks use the first three positions and one uses the first. On x-3 levels every position moves 1 tile right (`if (levNum == 3) xPos += TILE_SIZE`).

With 386 left, that is 6 fireworks and +3000 points.

## Actual

No fireworks appear and no points are added. The tally ends, the castle flag rises and the next level loads (ll-7-2). With the flag touched at 386, the score was exactly 100 (flag) + 386 × 50 = 19400. ll-7-3 behaved the same way, also finished at 386 with a score of 19400.

The end-of-level sequence in `src/game/world/world.ts` has no firework step and doesn't keep the time from the flag touch. `startClear` (line 1269) scores the flag only. `updateClear` goes `'countdown'` (line 1344), then `'flag'` (line 1360: `Decoration.raiseFlag()` on its first frame, then the exit event after 90 frames), then `'done'`. The `firework` sound effect exists in `src/content/sfx/sfx.ts` (line 52), but no game code uses it.

## How often

every time (2 of 2 flag finishes ending in 6)

## Notes

- PR #24 check: still applies on main 2225155 (campaign and ?level=). The flag clear sequence in `src/game/world/world.ts` is unchanged; in campaign mode the tally is followed by the world map instead of the next level.
- Ours: playtested at ll-7-1 and ll-7-3. Original: found by reading the code. The tester couldn't reach a flagpole with a 1, 3 or 6 timer in Ruffle, which ran about 5 times slower than real time.
- Dev assist No damage was on in ours. The flagpole score bands and the tally speed are already filed and fixed (KNOWN.md). This report is only about the missing fireworks.
- When this is fixed, ours needs to remember the HUD time at `startClear`, because `this.time` has counted down to 0 by the end of the tally.
- The tester's report quoted line 448 as `if (lastTimeDigit == "1" || "3" || "6")`, which would always be true. The real line compares each digit: `lastTimeDigit == "1" || lastTimeDigit == "3" || lastTimeDigit == "6"`.
- With the original's Infinite Time cheat on, `convertTimeToScore` skips the tally and calls `raiseFlag()` straight away, so there are no fireworks.
- Flagpole areas in our maps (`!` flag shaft plus an `exit` zone): SMB 1-1, 1-2-exit, 1-3, 2-1, 2-2-exit, 2-3, 3-1, 3-2, 3-3, 4-1, 4-2-exit, 4-3, 5-1, 5-2, 5-3, 6-1, 6-2, 6-3, 7-1, 7-2-exit, 7-3, 8-1, 8-2, 8-3. Lost Levels: x-1 to x-3 of worlds 1-13 (the x-2 flag is in `-exit` areas for ll-1-2, ll-3-2, ll-5-2, ll-6-2, ll-10-2 and ll-11-2, and in `ll-8-2-warp` for ll-8-2), plus ll-9-4.
- Seen again (folded in by the ll-w6/w9/wB review, ours only): the flags of ll-10-1, ll-10-2 (`ll-10-2-exit`) and ll-10-3 (ll-wA notes), and ll-11-2 (`ll-11-2-exit`, ll-wB notes). These were sightings with no timing; they add no new evidence beyond the levels.
- Source: `ll-w7/2026-10-05-ll-7-1-no-fireworks-at-flagpole.md`. The reviewer made it a general report, checked the digit test, count, points, timing and positions in the original's source, and corrected the line-448 quote.
- Reviewed: verified against `com/smbc/managers/StatManager.as` (`touchFlag`, `convertTimeToScore`, `timeScoreConverterTmrLsr` lines 409-460), `com/smbc/managers/EventManager.as` (`enterLevelExit`, `touchedFlagPole`), `com/smbc/graphics/TopScreenText.as` (`timeRemaining`), `com/smbc/level/Level.as` (`raiseFlag`, `launchNextFirework`, `WIN_END_TMR_*`, `fireworkPivotY` lines 571 and 1043), `com/smbc/projectiles/Firework.as`, `com/smbc/data/FireworkLocations.as`, `com/smbc/data/ScoreValue.as`, and ours at b8379f9: `src/game/world/world.ts` (`startClear`, `updateClear`), `src/content/sfx/sfx.ts`.

Status: fixed — the HUD time is kept at the touch and, when it ends in 1, 3 or 6, that many fireworks (new original art, 500 points each, 400 ms apart, at FireworkLocations over the castle flag, +1 tile on x-3) follow the tally and the level ends 1 s after the last (StatManager.timeScoreConverterTmrLsr, Level.raiseFlag/launchNextFirework); the castle flag now also visibly rises.
