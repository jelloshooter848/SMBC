# Vertical swinging lifts (1-3, 5-3) only travel down from their spot at a constant 1 px/frame instead of swinging slowly above and below it

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every `lift-v` (the original's `WaveVertical` platform). Seen in 1-3, the lift at column 56 (map row 9), between the platforms at columns 50-53 and 59-63; and 5-3, the lift at column 55 (map row 10), between the tree tops at columns 50-53 and 59-63; and 4-3, the lift at column 137 (map row 9). Other levels are listed in Notes.
- **How to get there:** `?level=1-3&char=mario`, go to the mushroom platform at columns 50-53; or `?level=5-3&char=mario&dev=1`, go right to column 50 and watch the lift at column 55
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand at column 51 on the low platform in 1-3 and press F1 (or reach the tree top at columns 50-53 in 5-3).
2. Watch the lift at columns 56-58 (5-3: column 55) for about 4 seconds.

## Expected

The XML has `movingPlatform&&width=6&&type=WaveVertical` at x=56, y=9 (`<LEVEL ID="1-3">`) and `movingPlatform&&shiftRight&&shiftUp&&width=4&&type=WaveVertical` at x=55, y=10 (`<LEVEL ID="5-3">`; `shiftUp` raises it half a tile, `Level.as` lines 1254-1257, so its centre is at row 9.5). In `Platform.as` (`PT_WAVE_VERTICAL`, lines 306-313), `y = centerY + sin(waveAngle) * waveRange`, with `waveRange = 150` px and `waveSpeed = 1` rad/s (lines 56-57). At our 16 px tiles, the lift moves ±75 px (±4.7 tiles) around its spot as a smooth sine: in 1-3 from about row 4.3 to about row 13.7, in 5-3 from about row 4.8 to about row 14.2. Both stay on screen. One cycle takes 2π s = 6.3 s (377 frames). At the top the 1-3 lift is level with the coins and the high platform at columns 60-63 (rows 4-5).

## Actual

Both maps give the lift `range=6` (`1-3.map`: `lift-v 56 9 len=6 range=6`; `5-3.map` line 32: `lift-v 55 10 len=4 range=6`), and `lift-v` in `src/game/entities/objects/lift.ts` (`update`, case `'lift-v'`, lines 72-78) moves on a triangle wave from `originY` down to `originY + range` and back, at a constant 1 px per frame. One cycle takes 192 frames (3.2 s), about twice as fast as the original, with no easing. It never rises above its map row.

- 1-3: our lift only moves down from row 9; its top reaches y = 240, the very bottom of the screen and level, then comes back up to row 9. Measured top y: 192 (frame 239), 240 (frame 287), 193 (frame 335), 145 (frame 383). It cannot carry Mario up toward the high platform. At its low point it sits at the bottom edge of the pit.
- 5-3: our lift moves from row 10 down to row 16, so it never rises above row 10, about 5 rows lower than the original's top. At the bottom its surface is at y = 256, below the bottom edge of the screen (row 15). By code, a small Mario riding it would be carried out of sight with his top at y = 240, and only escapes the fall-death check (`toPx(p.body.y) > SCREEN_H + 8`, `src/game/world/world.ts` line 597) by 8 px. Seen in play: on two runs the lift was at about row 12.3 and row 11.3 when it came into view, and it never appeared above row 10.

## How often

every time

## Notes

- 1-3: ours playtested and measured; original found by reading the code (`Platform.as`) and data (XML). The smb-w1 tester reached column 35 of 1-3 in the original before falling and did not reach this lift.
- 5-3: found by reading the original's code and both level files, plus a partial look in our game. The smb-w5 tester could not get Mario onto the lift (the jump from the tree at columns 35-39 up to columns 40-46 kept failing) and could not reach it in the original because of Ruffle's low speed.
- 4-3 (smb-w4): riding our lift to its low point does kill the player. The smb-w4 tester rode the lift at column 137 in a share-link copy of 4-3 with only the start moved (so the HUD reads WORLD 1-1). The lift sank to the bottom of the screen, Mario dropped below it and died: `gauntlet/shots/smb-w4/ours/304_lr0.png` to `312_lr8.png` (Mario y 197 at frame 68, 214 at frame 176 while riding, 394 at frame 212 after falling). The lifts at columns 59 and 63 also dip to the bottom of the screen in ours. In the original the row-9 lift swings about ±75 px, between rows ~4.3 and ~13.7. Ours playtested; the original by code and data only.
- The converter gives every `WaveVertical` platform `range=6` (`tools/levelgen/convert-smbc.mjs` line 541, `if (kind === 'lift-v') props.range = 6;`). `levelDataSmb.xml` also has `WaveVertical` platforms on the normal layer in 4-3 (columns 59 row 11 and 63 row 9, both `shiftUp`, and 137 row 9, all width 6; ours `lift-v 59 11`, `lift-v 63 9`, `lift-v 137 9`, all `range=6`) and 6-3 (columns 28 row 9 and 59 row 8, width 4; ours `lift-v 28 9`, `lift-v 59 8`). 4-3 is confirmed in play (above); 6-3 uses the same code.
- Merged from `smb-w1/2026-10-05-1-3-vertical-lift-wrong-path-and-speed.md` (1-3, playtested in ours) and `smb-w5/2026-10-05-5-3-vertical-lift-motion.md` (5-3). Renamed by the smb-w5 reviewer from `2026-10-05-1-3-vertical-lift-wrong-path-and-speed.md` because it now covers more than 1-3.
- 4-3 evidence folded in from the smb-w4 review log (`review/smb-w4.md`, source `gauntlet/notes/smb-w4.md`) during the smb-w7/w8 consolidation.
- Related: `2026-10-05-lifts-sideways-lifts-wrong-path-and-speed.md` (same cause, `lift-h`).
- Placement (added by the ll-w1/w2 reviewer): besides the path, these lifts sit off horizontally. The original centres a lift on its cell; ours anchors its left edge there, so the 1-3 (width 6) lift is 16 px right of the original and the 5-3 one (width 4, `shiftRight`) is in the right column but 8 px low because `shiftUp` is ignored. See `2026-10-05-converter-ignores-shiftup-shiftright.md`.
- **Lost Levels (ll-wD).** Our Lost Levels maps have four `lift-v` lines, all `range=6`: ll-4-4 61,10, ll-11-3 56,8, ll-12-2 160,10 and `ll-13-4-end` 69,10.
  - **D-4 (`ll-13-4-end` 69,10, XML `movingPlatform&&shiftRight&&width=4&&type=WaveVertical`, `<LEVEL ID="13-4">` area d).** The ll-wD tester saw it only go down, from row 10 to row 16, into the lava and below the screen. With No damage on, Mario rode it down to y = 249, below the level, and back up alive (`gauntlet/notes/llwD/m4.png`). With No damage off, the lava kills him as soon as his feet reach row 13 (`2026-10-05-lava-kills-on-touch-with-death-hop.md`). In the original it swings between rows 5.3 and 14.7.
  - **D-4 is passable in ours, but harder (ll-wD reviewer, playtested).** This lift is the way up to the wall at column 72, whose top is at row 6. The original's lift rises to row 5.3, so a rider can step across. Ours tops out at row 10, so Mario has to jump 4 rows up from the lift at its highest point. On a share-link copy of `ll-13-4-end.map` with only `start:` moved to `66,12` (No damage on, only against the Hammer Bro's hammers), Mario jumped from the pit floor onto the rising lift, then pressed jump again two frames after landing, holding right. His feet peaked at y 92, 4 px above the wall top (y 96), and he landed at 73,5. On the first try the press fell on a frame where Mario was airborne above the lift, which had started down, so no jump came out and he walked off into the lava.
- PR #24 check: still applies on main 2225155. `git diff b8379f9 HEAD` is empty for `lift.ts`, `world.ts`, `mario/index.ts`, `tools/levelgen/convert-smbc.mjs` and every map in `src/content/levels/`.
- Reviewed: verified against `com/smbc/ground/Platform.as` (`waveRange` 150, `waveSpeed` 1, `PT_WAVE_VERTICAL`), `com/smbc/level/Level.as` (`shiftUp`), `levelDataSmb.xml` (`<LEVEL ID="1-3">` x=56 y=9; `<LEVEL ID="5-3">` x=55 y=10), and ours: `src/game/entities/objects/lift.ts`, `src/content/levels/world1/1-3.map`, `src/content/levels/world5/5-3.map`, `src/content/levels/world4/4-3.map`, `src/content/levels/world6/6-3.map`, `src/game/world/world.ts` (fall-death check), `src/game/characters/mario/index.ts` (small hitbox 16 px), `tools/levelgen/convert-smbc.mjs`.

Status: fixed — `lift-v` now swings y = rest + sin(t/60)·75 px (Platform.as PT_WAVE_VERTICAL, waveRange 150, waveSpeed 1), above and below its spot, ignoring the maps' `range=6`; the `shiftUp` half-tile placement is agent A's converter fix.
