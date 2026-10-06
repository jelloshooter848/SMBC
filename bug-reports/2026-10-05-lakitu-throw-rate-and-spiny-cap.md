# Lakitu throws Spinies less often and stops at 3 (the original throws every 1.75 s, up to 4 per Lakitu)

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 4-1, columns 19–208, and 6-1, columns 21–170 (seen standing at column 12) (any Lakitu; also 8-2)
- **How to get there:** `?level=4-1&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=4-1&char=mario`, walk right until Lakitu arrives, then stand still.
2. Count the time between throws and the number of Spinies alive at once.

## Expected

The original's Lakitu runs a fixed cycle: after each throw it waits 1500 ms (`hideTmrDur`, Lakitu.as
line 36), shows its "hide" pose, waits another 250 ms (`throwTmrDur`, line 34) and throws: one Spiny every
1.75 s, the first one 1.75 s after it appears (`setStats` starts `hideTmr`, line 117; `hideTmrLsr` and
`throwTmrLsr`, lines 275–290). Both timers are `CustomTimer`s in milliseconds. It keeps throwing until
**its own** Spinies reach `maxSpinyDifficulty`, which is 4 on NORMAL (lines 245–258; 2 on EASY, 6 on HARD).
Only Spinies it threw count (`SPINEY_DCT`; a Spiny removes itself in `Spiney.cleanUp`, and
`enemyCleanUpHandler`, lines 337–342). At the cap it enters the "wait" state and throws again the moment
one is gone (`setState("wait")`, line 288; `checkState`, lines 260–261).

## Actual

Ours throws the first egg 90 frames (1.5 s) after it appears, then waits a random 110–189 frames
(1.83–3.15 s) between throws. When 3 or more Spinies are alive anywhere in the level (`MAX_SPINIES = 3`,
counting every `Spiny` entity, not just this Lakitu's), it skips that throw and only tries again after
another 110–189 frames. Code: `src/game/entities/enemies/lakitu.ts` lines 9–12 and 61–73
(`Lakitu.update`). So the original keeps about one more Spiny on the ground and refills it faster.

## How often

every time

## Notes

- Found by reading code (both games); ours checked by watching 4-1 (`ours/009_lak1.png` … `014_lak6.png`).
- Timing in Ruffle could not be measured: the original's timers run on wall-clock time while movement runs
  on capped game time, and the emulator ran several times slower than real time, so throws bunched up in
  pairs. The original screenshot `orig/keep/110_lst9.png` (reviewer only) shows four Spinies out at once,
  which matches the cap of 4.
- 6-1 (smb-w6), playtested in both games. Ours (Dev assist No damage): standing at column 12 for 12 s and
  counting eggs in the air plus Spinies on the ground every 2 s gave 1, 1, 2, 3, 3, 3, never more than 3
  (`shots/smb-w6/ours/020_lk1.png` … `025_lk6.png`). Original (Ruffle, cheats Invincible and Infinite lives,
  standing at about column 25): `shots/smb-w6/orig/037_o61s.png` (reviewer only) shows **four Spinies on screen
  at once**, two beside Lakitu and two falling. That is playtest evidence for the cap of 4, a second sighting
  after the 4-1 one above. The throw interval was not timed there either (Ruffle ran several
  times slower than real time).
- Screenshot: not committed (the repo's `check:assets` bans image files) (6-1, Mario at column 12, three Spinies out, the
  most ours allows).
- Merged from `smb-w4/2026-10-05-lakitu-throw-rate-and-spiny-cap.md` (4-1) and
  `smb-w6/2026-10-05-6-1-lakitu-spiny-limit-and-throw-rate.md` (6-1).
- Reviewed: verified against `com/smbc/enemies/Lakitu.as`, `com/smbc/enemies/Spiney.as` (`cleanUp`), `com/explodingRabbit/utils/CustomTimer.as` (ms `flash.utils.Timer`), and ours: `src/game/entities/enemies/lakitu.ts`, `src/engine/rng.ts` (`int(n)` is 0…n-1)

Status: fixed — Lakitu runs the original cycle (1500 ms `hideTmr`, 250 ms `throwTmr` in the hide pose, then a throw: one Spiny per 1.75 s) and keeps up to four of its own Spinies (`maxSpinyDifficulty` NORMAL), throwing at once when one is gone (`wait` state).
