# Sideways lifts move 3 tiles right of their spot at a constant 1 px/frame instead of swinging slowly around it

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every `lift-h` (the original's `WaveHorizontal` platform). Seen in 1-3 (columns 85 row 8, 93 row 9, 131 row 6), 3-3 (columns 31 row 4, 34, 93, 97, 102 and 132) and 5-3 (columns 84 row 8, 93 row 9, 131 row 6). The same lift type is at column 136, row 6, of 1-4, 3-4 and 5-4 (above Bowser's bridge).
- **How to get there:** `?level=3-3&char=mario`, climb to the mushroom at columns 22-27 (row 7) and watch the lift at column 31; or `?level=1-3&char=mario`, past the midpoint at column 66, to the lift at column 85
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open 3-3 and stand on the right end of the mushroom at columns 22-27, with F1 on.
2. Watch the lift at column 31 (row 4) for a few seconds, noting its left edge every 15 frames.

## Expected

In `com/smbc/ground/Platform.as` (`updateGround`, `PT_WAVE_HORIZONTAL`), the position is `x = centerX + sin(waveAngle) * hWaveRange`, with `hWaveRange = 60` px and `hWaveSpeed = 1.5` rad/s, and `centerX` is the lift's placed position (`initiate`). At our 16 px tiles, the lift swings ±30 px (±1.9 tiles, 60 px end to end) on both sides of its rest position. It eases in and out like a sine wave, peaks at 0.75 px per frame, and takes 2π/1.5 = 4.2 s (251 frames) per cycle.

Playtested in the original (3-3): the lift at column 31 moved with its left edge between about column 28.3 and column 32.0, so it also goes left of its column.

## Actual

Our lift moves in a straight line between its map column and 3 tiles (48 px) to the right of it, at a constant 1 px per frame, and turns around instantly at each end. A full cycle takes 96 frames (1.6 s), so it cycles about 2.6 times as often as the original and moves about twice as far per second on average.

Measured:
- 3-3, column 31 lift: the left edge went from x 496 (column 31.0) to x 544 (column 34.0) and back every 1.6 s; it never goes left of column 31.
- 1-3, column 85 lift (lift x taken from Mario's x on the lift minus 18): 1398 (frame 230), 1404 (frame 244), 1389 (frame 259), 1374 (frame 274), 1361 (frame 289), 1377 (frame 305), a range of 85.0 to 88.0 tiles.

5-3 by code: `5-3.map` lines 34, 35 and 37 (`lift-h 84 8 len=4 range=3`, `lift-h 93 9 ...`, `lift-h 131 6 ...`) and `5-4.map` line 52 (`lift-h 136 6 len=4 range=3`) use the same `range=3` and default speed, so these lifts also run from their map column to 3 tiles right of it and never go left of it, while the original's (XML `<LEVEL ID="5-3">` cells (84,8), (93,9), (131,6); `<LEVEL ID="5-4">` cell (136,6)) swing about 1.9 tiles either side.

In `src/game/entities/objects/lift.ts` (`update`, case `'lift-h'`, lines 63-70), `lift-h` moves on a triangle wave from `originX` to `originX + range`; the maps use `range=3` with the default `speed` 0x01000 (1 px/frame).

## How often

every time

## Notes

- Merged from `smb-w1/2026-10-05-1-3-horizontal-lifts-wrong-path-and-speed.md` (1-3 measurements, code reading) and `smb-w3/2026-10-05-3-3-horizontal-lifts-range-and-speed.md` (playtested in both games), and from `smb-w5/2026-10-05-5-3-horizontal-lift-motion.md` (5-3 and 5-4, code and level-file reading only: the smb-w5 tester could not reach these lifts in the original because of Ruffle's low speed, and the original's 5-4 does not load in Ruffle).
- Ours: playtested and measured in 1-3 and 3-3. Original: code and data reading, plus a playtest of 3-3 by the smb-w3 tester (original screenshots for the reviewer: `shots/smb-w3/orig/030_ol9.png`, lift at its left end, and `039_ol18.png`, right end; the reference is the mushroom at columns 22-27, whose right edge is at screen x 245). The 1-3 tester did not reach these lifts in the original.
- The converter gives every `WaveHorizontal` platform `range=3` (`tools/levelgen/convert-smbc.mjs`, `if (kind === 'lift-h') props.range = 3;`). `levelDataSmb.xml` has `WaveHorizontal` platforms on the normal layer in 1-3, 1-4, 2-4, 3-3, 3-4, 4-4, 5-3, 5-4, 6-3, 6-4 and 8-4, so every one of them is affected.
- 2-4 (smb-w2): the tester watched the swinging lift at column 136 in ours (`lift-h 136 6 len=4 range=3`, `2-4.map` line 43) move on a triangle path at 1 px/frame. The original has `movingPlatform&&width=4&&type=WaveHorizontal` at x=136 y=6, a sine swing of ±30 px (`hWaveRange` 60 Flash px) at 1.5 rad/s. No dedicated screenshot; the original's 2-4 was not played. Folded in from `review/smb-w2.md` during the smb-w7/w8 consolidation.
- The lift widths match the XML (width 6 half-tiles = 3 tiles in 1-3 and 3-3; width 4 in 5-3 and the castles).
- The 1-3 lift was tested with a share-link copy of 1-3 that started Mario on the lift (`start: 86,7`); the lift data is unchanged. The 3-3 test used a share-link copy starting near column 22.
- Not verified: exactly where the original's swing is centred relative to the map column. The Ruffle range above (left edge 28.3 to 32.0) is centred near column 30.1, not 31.0, which suggests the original's rest position is about a tile left of where ours places the left edge. Check this when fixing.
- Related: `2026-10-05-lifts-vertical-swinging-lifts-wrong-path-and-speed.md` (same cause, `lift-v`).
- Reviewed: verified against `com/smbc/ground/Platform.as` (`hWaveRange` 60, `hWaveSpeed` 1.5, `PT_WAVE_HORIZONTAL`), `levelDataSmb.xml` (`movingPlatform&&width=6&&type=WaveHorizontal` at 1-3 x=85 y=8, x=93 y=9, x=131 y=6; 3-3 x=31 y=4 and five more), the two original screenshots, and ours: `src/game/entities/objects/lift.ts`, `src/content/levels/world1/1-3.map`, `src/content/levels/world3/3-3.map`, `src/content/levels/world5/5-3.map`, `src/content/levels/world5/5-4.map`, `tools/levelgen/convert-smbc.mjs`; for 5-3 and 5-4 also `levelDataSmb.xml` (`<LEVEL ID="5-3">` x=84 y=8, x=93 y=9, x=131 y=6; `<LEVEL ID="5-4">` x=136 y=6).
