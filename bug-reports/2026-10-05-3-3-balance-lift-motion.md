# 3-3 balance lifts move at a constant 1 px/frame and stop dead; the original accelerates them and lets them coast

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 3-3, balance lifts at columns 82/89 and 137/141; also 4-3 (seen on the pair at columns 49 and 56), and every other `lift-balance` pair
- **How to get there:** `?level=3-3&char=mario`, reach the mushroom at columns 77-79
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand on the left balance lift at column 82 for a second, then jump straight up.
2. Watch both lifts while Mario is in the air, and again after the rope snaps.

## Expected

`com/smbc/ground/Platform.as` lines 39-44 and 352-390: while you stand on a lift its speed grows by
200 px/s² (0.028 px/frame²) up to 275 px/s (2.3 px/frame); when you leave, it keeps moving and
slows down (×0.0006 per second, about ×0.88 per frame) until it is under 20 px/s. After the rope
snaps both fall with 500 px/s² (0.07 px/frame²) up to 350 px/s (2.9 px/frame) (lines 326-330).

## Actual

`src/game/entities/objects/balance-lift.ts` lines 7 and 56-61: the lift you stand on sinks at a
constant 1 px/frame from the first frame and stops the moment you jump; the other one rises at the
same rate. After the snap both fall with 0.125 px/frame² up to 4 px/frame (`lift.ts` lines 94-99).
In play the lifts moved 16 px per 16 frames with no build-up.

## How often

every time

## Notes

- Evidence: code reading and a playtest of ours. Not playtested in the original.
- 4-3 (smb-w4): the same constant-speed sinking in a share-link copy of 4-3 (HUD reads WORLD 1-1), Mario on the left lift of the pair at columns 49 and 56 (F1 column 50): `gauntlet/shots/smb-w4/ours/276_bal0.png` to `283_bal7.png`. The tester measured about 20 px/s. The reviewer read the frames: the lift's y goes 87, 97, 107, 117, 127, 137 at frames 70, 101, 131, 161, 190, 221, a steady 10 px per 30 frames (0.33 px/frame) with no build-up, then the rope snaps and both lifts drop (frames 251-281). That is slower than the 1 px/frame of `SINK_SPEED`; the F1 overlay shows Mario 'air' with vy 0.438 in most of these frames, so he may be losing contact with the sinking lift on some frames (not investigated). Ours only; the original's 4-3 lifts were not reached. Folded in from `review/smb-w4.md` during the smb-w7/w8 consolidation.
- Related: `2026-10-05-3-3-balance-lift-no-1000-points.md`.
- Reviewed: verified against `com/smbc/ground/Platform.as` (`ayPully` 200, `vyMaxPully` 275, `fyPully` 0.0006, `vyMinPully` 20, `ayPullyFall` 500, `vyMaxPullyFall` 350; `setCharOnPlat`, `updatePully`, `PT_FALLING`) and ours: `src/game/entities/objects/balance-lift.ts` (`SINK_SPEED` 1 px/frame, returns early when neither or both lifts are ridden) and `src/game/entities/objects/lift.ts` (`lift-balance` falling: +0.125 px/frame² up to 4 px/frame).
