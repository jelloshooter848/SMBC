# 2-4: the up and down lifts travel into the top two rows; in castles the original wraps them 2 tiles below the top of the screen

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 2-4, lift shaft at columns 86 (rising) and 89 (falling), between columns 84 and 91. Also 5-4 (same columns) and the Lost Levels castles listed in Notes.
- **How to get there:** `?level=2-4&char=mario`, then go to the wall at column 81–83
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=2-4&char=mario` and go to the top of the wall at columns 80–83.
2. Watch the rising lift at column 86 and the falling lift at column 89 go round.
3. Optionally, ride the rising lift and stay on it.

## Expected

`Platform.as`, `ConstantRise` and `ConstantFall`: in a castle (`level.levNum == 4`), the rising lift resets to the bottom once its top passes `GLOB_STG_TOP + TILE_SIZE*2` (lines 149-157 and 282-288). The falling lift reappears at `GLOB_STG_TOP + TILE_SIZE*2` (lines 267-277). So in 2-4 the lifts vanish and appear 2 tiles (32 px at our scale) below the top of the screen, and a rider is dropped at that height. Outside castles they wrap at the screen edge.

## Actual

`build/src/game/entities/objects/lift.ts` (`update`, cases `'lift-up'` and `'lift-down'`, lines 80-87) always wraps at the screen edge. The rising lift goes on until it is fully above y 0 (`b.y + b.h < 0`, top at y -8), and the falling lift re-enters at y -8. In 2-4, both lifts scroll through the HUD rows 0–1, and the rising lift carries Mario 40 px higher than the original (its top reaches y -8 instead of y 32) before it wraps.

## How often

every time

## Notes

Found by reading code; this is not the lift-speed bug already filed (`2026-10-05-1-2-vertical-lifts-too-fast.md`: 110 Flash px/s = 0.92 px/frame in the original against our 1 px/frame, which also applies here). I could not play the original's 2-4 up to the lifts.
- Related to `2026-10-05-1-2-vertical-lifts-too-fast.md`: same lift types and the same code (`lift.ts`, `lift-up` / `lift-down`), but a different behaviour. Both could be fixed together.
- `levNum` is the level number within the world (`Level.as` line 372, `_levNum = _id.stage`), so the castle rule covers every x-4 level. Castles with `lift-up` / `lift-down` in our maps: 2-4 and 5-4 (`lift-up 86 6/14`, `lift-down 89 4/12`), and ll-6-4, ll-7-4 and ll-12-4. The XML for 2-4 and 5-4 shows these lifts as `ConstantRise` / `ConstantFall` with `width=3` on the normal layer.
- The tester also noted that our `len=3` lift is drawn 32 px wide but is solid for 24 px. The reviewer checked the original's art in `smbc3.swf` (`MovieClipInfo_PlatformMc`, frame `normal-3`): its hit box (`HRect`) is 48 Flash px = 24 px at our scale, the same as ours, so the solid width is right. Not filed.
- Source: `smb-w2/2026-10-05-2-4-castle-lift-wrap-height.md`. The reviewer corrected "32 px higher" to 40 px and added 5-4 and the Lost Levels castles.
- Reviewed: verified against `com/smbc/ground/Platform.as` (`initiate` `PT_CONSTANT_RISE` `resetPos`, `updateGround` `PT_CONSTANT_FALL` / `PT_CONSTANT_RISE`), `com/smbc/level/Level.as` (`_levNum`), `levelDataSmb.xml` (`<LEVEL ID="2-4">` and `"5-4"` x=86/89), and ours: `src/game/entities/objects/lift.ts`, `src/content/levels/world2/2-4.map`, `src/content/levels/world5/5-4.map`, the Lost Levels castle maps.
