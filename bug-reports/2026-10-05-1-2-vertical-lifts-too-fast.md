# 1-2 elevator lifts move about 9% faster than in the original

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 1-2, falling lifts at column 141 and rising lifts at column 156; also seen in 2-4 (rising lifts at column 86, falling lifts at column 89)
- **How to get there:** `?level=1-2&char=mario`, go to the staircase at columns 133-137
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand on the top step at column 137 and press F1.
2. Watch the falling lift at column 141 and note its screen y every few frames.

## Expected

The original moves these lifts at `ySpeed = 110` px/s (`com/smbc/ground/Platform.as`, types `ConstantFall` and `ConstantRise`). At the original's 32 px tiles, that is 55 px/s at our 16 px scale, or 0.917 px per frame at 60 fps.

## Actual

Our lifts move 1 px per frame, which is 60 px/s at 16 px tiles: `lift-up` / `lift-down` use the default `speed` 0x01000 in `src/game/entities/objects/lift.ts`. I measured 17 px in 17 frames (frames 585 to 602). A full screen-height cycle is 240 frames instead of about 262.

## How often

every time

## Notes

- Ours: playtested and measured. Original: found by reading the code (`Platform.as`: `ySpeed`, `updateGround()`). The lift positions and widths match the XML (`movingPlatform` width 6 at x=141 and x=156, rows 7/13 and 5/13).
- The difference is small, but it changes the timing of the lift jumps in 1-2.
- Other levels use the same lift types on the normal layer (`levelDataSmb.xml`): `ConstantFall` in 2-4, 4-2, 5-2, 5-4 and 6-2, and `ConstantRise` in 2-4, 4-2 and 5-4. The converter maps them to `lift-down` / `lift-up` without a speed (`tools/levelgen/convert-smbc.mjs`, `LIFTS` table), so they all use the 1 px/frame default.
- 2-4 (smb-w2): the lifts in the shaft at columns 86 (`lift-up`) and 89 (`lift-down`) also move at 1 px/frame in ours. Shots: `gauntlet/shots/smb-w2/ours/455_lf1.png` to `460_lf6.png`. The original side is code reading only. Folded in from `review/smb-w2.md` during the smb-w7/w8 consolidation.
- Related: `2026-10-05-2-4-castle-lift-wrap-height.md` (same lift types, where they wrap in castles).
- Reviewed: verified against `com/smbc/ground/Platform.as` (`ySpeed = 110`, `updateGround` `PT_CONSTANT_FALL` / `PT_CONSTANT_RISE`), `levelDataSmb.xml`, and ours: `src/game/entities/objects/lift.ts` (`lift-up` / `lift-down`, default `speed` 0x01000 = 1 px/frame) and `src/content/levels/world1/1-2.map`, `src/content/levels/world2/2-4.map` (lines 38-41).

Status: fixed — `lift-up` / `lift-down` move at ySpeed 110 Flash px/s = 0.917 px/frame (Platform.as PT_CONSTANT_RISE / PT_CONSTANT_FALL) instead of 1 px/frame.
