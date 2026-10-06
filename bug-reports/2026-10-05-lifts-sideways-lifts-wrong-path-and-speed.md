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
- Not verified: exactly where the original's swing is centred relative to the map column. The Ruffle range above (left edge 28.3 to 32.0) is centred near column 30.1, not 31.0, which suggests the original's rest position is about a tile left of where ours places the left edge. Check this when fixing. **Answered by the ll-w1/w2 reviewer:** the original centres every lift on the centre of its map cell (`Level.as` lines 1205-1207 put the platform at `currentX + TILE_SIZE/2`, and the game-file `HRect` is centred on that point), so a width-6 lift at column 31 has its rest left edge at column 30.0 and swings between columns 28.1 and 31.9, which matches the Ruffle range. Ours anchors the left edge on the column, 16 px right of the original for width-6 lifts. Filed with the placement fix in `2026-10-05-converter-ignores-shiftup-shiftright.md`.
- Related: `2026-10-05-lifts-vertical-swinging-lifts-wrong-path-and-speed.md` (same cause, `lift-v`).
- Related: `2026-10-05-lifts-carry-player-through-walls.md` (ll-w4). Our lifts carry their rider through walls. Because our `lift-h` runs 48 px right of its column instead of ±30 px around the cell centre, some of them reach walls the original's lift never touches (ll-1-4 at 137, ll-2-1 at 107, SMB 8-4 at 70) or go much deeper into them (ll-11-4 at 66, ll-2-4 at 138, ll-5-4 at 202). The full table is in that report.
- **Blocks three castles (ll-wC review):** ll-12-4, ll-7-4 and ll-11-4 can only be crossed by dropping down a one-tile shaft onto a sideways lift that swings under it in the original. Ours never reaches left of its column, so Mario always falls into the lava. That is filed apart as `2026-10-05-ll-12-4-lava-lift-never-reaches-drop-shaft.md` (blocks progress), with a map test to add when this is fixed. The same final lists two jumps that get about 2 tiles longer in ours: ll-4-4 at 172 and ll-11-3 at 44.
- **ll-4-4 at 172 and ll-11-3 at 44: possible but harder (playtested by the ll-wD reviewer in ours, b8379f9).** Both jumps are about 2 tiles longer than in the original because our lift never goes left of its column.
  - **ll-4-4** (share-link copy of `ll-4-4.map` with only `start:` moved to `166,9`, the one-tile pillar; No damage on, only because Bowser's flames cross this jump, so success was judged by Mario standing on the lift). Technique: hold right+run for about 0.28 s on the pillar, then a full-height jump. Of 11 tries at different points in the lift's cycle, 5 landed on the lift (Mario `ground` at y 176, x 2762-2771). In the 6 misses Mario reached about x 2765 at the lift's height while the lift was further right, and fell into the lava. So the jump works only while the lift is near the left end of its 1.6 s cycle, and the player has to wait for that moment. In the original the gap is 3.1 tiles (`shiftRight` lift, left edge down to column 170.1) instead of 5.
  - **ll-11-3** (share-link copy of `ll-11-3.map` with only `start:` moved to `16,8`, the tree top at 16-20; No damage on). A standing start on the falling lift at 36 does not work: on our falling lift Mario alternates between airborne and grounded frames, so he speeds up slowly (one run: 1.0 px/frame after 24 frames, by which time the lift had dropped 2 tiles) and a jump press on an airborne frame is lost. The air speed of a jump that starts below running speed stayed capped at 1.56 px/frame in every try. What works is a chain of running jumps at full speed (2.56 px/frame): run along the tree, jump to the left balance lift at 27, jump again on the landing frame to the falling lift at 36, and jump again on the landing frame towards the lift at 44. The jump key has to be released and pressed again on the landing frame each time (a press on an airborne frame is lost). With the first two jumps fixed, 3 of 9 variants of the last jump (different press frames and hold lengths) landed on the lift; the others fell past it, and 2 of them landed on top of the ? block at 45,3 and ran off it. In the original the gap from the falling lift is 4.1 tiles (`shiftRight`, left edge down to 42.1) instead of 6.
  - Test maps and contact sheets: `gauntlet/llwDrev/` (`t44-166.url`, `t113-16.url`, `p44a.png`, `p44b.png`, `c3.png`, `dd.png`).
- PR #24 check: still applies on main 2225155. `git diff b8379f9 HEAD` is empty for `lift.ts`, `tools/levelgen/convert-smbc.mjs`, `src/game/entities/player.ts`, `mario/profile.ts` and every map in `src/content/levels/`.
- Reviewed: verified against `com/smbc/ground/Platform.as` (`hWaveRange` 60, `hWaveSpeed` 1.5, `PT_WAVE_HORIZONTAL`), `levelDataSmb.xml` (`movingPlatform&&width=6&&type=WaveHorizontal` at 1-3 x=85 y=8, x=93 y=9, x=131 y=6; 3-3 x=31 y=4 and five more), the two original screenshots, and ours: `src/game/entities/objects/lift.ts`, `src/content/levels/world1/1-3.map`, `src/content/levels/world3/3-3.map`, `src/content/levels/world5/5-3.map`, `src/content/levels/world5/5-4.map`, `tools/levelgen/convert-smbc.mjs`; for 5-3 and 5-4 also `levelDataSmb.xml` (`<LEVEL ID="5-3">` x=84 y=8, x=93 y=9, x=131 y=6; `<LEVEL ID="5-4">` x=136 y=6).

Status: fixed — `lift-h` now swings x = rest + sin(t·1.5/60)·30 px (Platform.as PT_WAVE_HORIZONTAL, hWaveRange 60, hWaveSpeed 1.5) around its placed spot, ignoring the maps' `range=3`; the rest position itself moves to the cell centre with agent A's converter anchoring.
