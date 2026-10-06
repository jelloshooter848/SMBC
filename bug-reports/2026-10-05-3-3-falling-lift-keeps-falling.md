# 3-3's drop lift keeps falling, faster and faster, after Mario leaves it; in the original it only sinks while someone stands on it

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 3-3, the drop lift (`lift-fall`) at column 61, row 6
- **How to get there:** `?level=3-3&char=mario`, reach the tall mushroom at columns 55-58 (row 3); the lift is just right of it
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand on the mushroom at columns 55-58 and drop onto the lift at column 61.
2. After about half a second, jump off it to the right (mushroom at columns 65-67, row 7).
3. Look back at column 61.

## Expected

`com/smbc/ground/Platform.as`, type `StepFall`: the lift moves only inside `setCharOnPlat()`
(lines 399-404), `vy = fallSpeed` with `fallSpeed = 225` px/s (line 38), i.e. a steady 1.875 px/frame at our scale
**while a character stands on it**, and it stays put when nobody does (`updateGround` has no `StepFall` branch). You can step off, and the
lift waits where you left it.

## Actual

`src/game/entities/objects/lift.ts` line 126 sets `falling = true` on the first landing and lines
94-99 then accelerate it at 0.125 px/frame² up to 4 px/frame until it leaves the level, whether or
not anyone is on it. In play, 0.9 s after I jumped off, the lift was gone from columns 61-64
entirely (screenshot); Mario also lost his footing on it because it falls faster than he does.

## How often

every time

## Notes

- Evidence: code reading and a playtest of ours (shared copy of 3-3 starting at column 57). Not
  playtested in the original (Ruffle too slow to reach column 61 reliably).
- Our screenshot: not committed (the repo's `check:assets` bans image files).
- `lift-fall` is used 50 times across our maps, so other levels' drop lifts are affected too. In the SMB set the original's `StepFall` platforms (normal layer, not counting `charHorz=Show` helpers) are in 3-3, 6-3 (4) and 7-4 (2); ours has them as `lift-fall` in `6-3.map` and `7-4.map`. The rest are in Lost Levels maps.
- Reviewed: verified against `com/smbc/ground/Platform.as` (`fallSpeed` 225, `setCharOnPlat` `PT_STEP_FALL`, `updateGround`), `levelDataSmb.xml` (`<LEVEL ID="3-3">` `movingPlatform&&width=6&&type=StepFall` at x=61 y=6, shown on normal only), and ours: `src/game/entities/objects/lift.ts` (`carry`, `update` case `'lift-fall'`).

Status: fixed — `lift-fall` moves only while ridden, at fallSpeed 225 Flash px/s = 1.875 px/frame (Platform.as setCharOnPlat PT_STEP_FALL), and waits where the rider left it.
