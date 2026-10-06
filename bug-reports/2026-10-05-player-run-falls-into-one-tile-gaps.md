# Mario running at full speed drops into one-tile gaps (ll-7-1, 4-4 and many more); the original carries a running player across

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every one-tile gap in a walking surface. Seen at ll-7-1, gaps in the ground at columns 58 and 67 (rows 13-14), and at SMB 4-4, the top path's gaps at columns 24, 26, 28, 30, 32 and 34 (rows 6-9). Other levels are listed in Notes.
- **How to get there:** `?level=ll-7-1&char=mario&dev=1`, then play to column 59. For a quick test the tester used a copy of ll-7-1 with only the start moved to column 59, row 12 (the HUD then says WORLD 1-1). For 4-4: `?level=4-4&char=mario` and run right along the top of the wall at columns 18-35.
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stand on the ground at ll-7-1 column 59 and press F1.
2. Hold Right + Run (X) without jumping. By column 63 the overlay shows `vx 2.563`, which is full running speed.
3. Keep holding as Mario reaches the gap at column 67.

## Expected

Mario runs across a one-tile gap at running speed and stays at ground level, as in the original.

- **Playtested in the original:** Lost Levels 7-1 on NORMAL, small Mario, with Invincible and Bouncy Pits on. Holding Right + Run from column 60, he crossed the gap at column 67 at ground level without a jump (`shots/ll-w7/orig/s10.png`, frames 2-4). He had also run over the gaps at 58 and 67 earlier in the same run (`s5.png`). In another run he started from a standstill one tile before the gap at 58 and fell in, so whether he crosses depends on speed.
- **The original's rule.** After `checkCollisions()`, `Level.as` lines 1888-1889 call `checkCrossSmallGap(player)` on the first frame the player has left the ground (`!player.onGround && player.lastOnGround`), but only if `player.canCrossSmallGaps` is set. `checkCrossSmallGap` (lines 2230-2272) looks one tile left and one tile right of the player's column. If both hold ground (not a `Platform`) whose top is exactly at the player's feet, it calls `player.groundBelow()` on the right-hand tile, so he keeps running at the same height.
- **The speed rule.** `MarioBase.as` (lines 501-532) sets `canCrossSmallGaps` while Mario is on the ground and only in the fastest run-animation band: |vx| > `RUN_TMR_2_MIN_VX` = 220 Flash px/s (`MAX_WALK_SPEED` = 175, `MAX_RUN_SPEED` = 300). Flash tiles are 32 px and ours are 16 px, so 220 Flash px/s is 110 of our px/s, or 1.83 px per frame at 60 fps. Our walk cap is 1.5625 px/frame and our full run is 2.5625. So in the original a walking Mario drops in and a running one crosses.
- The rule only covers gaps exactly one tile wide with ground at the same height on both sides. It does not apply over lifts.

## Actual

Mario drops into the gap and dies (with Inf. lives on, he respawns). The debug overlay frame by frame:

- `x 1068 ... vx 2.563 ground` (over column 66)
- `x 1076 tile 67,12 vx 0.000 vy 1.125 air`: his feet have sunk below the top of column 68, so he hits its side and stops
- `x 1076 y 207`, `y 252`... (falling)

In 4-4 a full-speed run along the top path (2.36-2.56 px/frame) drops Mario into the gap at column 24 and down to the lower path (screenshot not committed, overlay `tile 24,7`, `vx 0.000`).

**Cause.** In `src/game/entities/player.ts` (lines 232-235) each frame runs `moveX` and then `moveY`. On the ground, `moveY` probes down by `Math.max(velToSub(b.vy), 1)`, which is 1 subpixel (1/256 px). Small Mario's hitbox is 12 px wide (`src/game/characters/mario/index.ts` line 155), and the gap is 16 px wide. So for about 4 px of travel (hitbox left edge from 16c to 16c + 4 for a gap at column c), no part of the hitbox is over ground:

1. On the first frame over the gap, the probe finds nothing. Mario sinks 1 subpixel and becomes airborne.
2. On the next frame, `moveX` (`src/game/entities/body.ts` line 34) checks the rows `tileAt(b.y)` to `tileAt(b.y + b.h - 1)`. These now include the ground row, so the far side of the gap counts as a wall.
3. `moveX` snaps x to 16(c+1) − 12 = 16c + 4 (1076 for c = 67, as in the overlay) and sets `vx = 0`, so he falls.

The reviewer ran a copy of that `moveX`/`moveY` order (`session-scratchpad/llw7rev/gapsim.mjs`, gap at column 67). He falls in at every one of 48 sub-tile starting positions for vx 1.5625, 2.5625 and even 4.0 px/frame. So in ours no speed crosses a one-tile gap without a jump. The fix is to port the original's rule (speed threshold, ground on both sides at the same height, no sinking), not a general step-up.

## How often

every time (3 of 3 runs in ll-7-1)

## Notes

- Dev assists in ours: No damage and Inf. lives (a pit still kills).
- **Other one-tile gaps.** These come from a reviewer scan of our maps at b8379f9 (`session-scratchpad/llw7rev/gapscan.py`, output `gapscan.out`). The scan finds a one-tile hole in a surface with solid tiles on both sides at the same row and headroom above. Row 13 (the ground) unless noted; L means lava below.
  - SMB: 1-3 (64), 2-3 (7), 4-3 (15), 5-3 (64), 6-1 (136; 129 at row 8), 6-2 (141, 143; 152 at row 10), 6-3 (96), 7-3 (7), 8-1 (46, 48, 51, 54, 57, 169, 171, 174, 176, 179, 197, 201), 8-2 (15, 36, 45, 50, 52, 56, 63, 138); castle lava gaps in 7-4 (165, 169, 229, 233 at row 6).
  - Lost Levels: ll-1-1 (77 at row 5), ll-1-2 (163 at row 10), ll-1-2-under (48), ll-3-2 (170 at row 9), ll-3-4 (73, 137, 176, 246, and 73/137 at rows 5, 8 and 11), ll-4-1 (166, 180), ll-4-2 (57, 129, 142, 171), ll-5-2 (53, 56, 96), ll-5-3 (27 and 91 at row 10), ll-6-1 (143), ll-7-1 (58, 67), ll-8-2 (87, 164, 166), ll-10-1 (184), ll-10-2 (159 at row 10), ll-11-1 (103, 105, 123), ll-13-1 (166, 175); lava gaps in ll-1-4, ll-2-4, ll-4-4, ll-5-4, ll-6-4, ll-7-4, ll-8-4-end2, ll-10-4, ll-11-4 and ll-12-4.
  - Non-fatal gaps (Mario drops to a lower floor): 1-1 (181 at row 11), 1-2 (40 and 45 at row 7), 3-3 (68, 72 at row 7), 4-2 (29 at row 9), 4-4 (row 6: every other column from 24 to 34 and from 88 to 98, plus 169 and 233), 5-1 (148 at row 9), and several Lost Levels castles.
  - The reviewer checked a sample against the original's XML (normal layer, row 13 empty with ground on both sides): 8-1 (all 12 columns), 8-2 (all 8), 1-3 (64), 4-3 (15), 6-1 (136), ll-4-2 (57, 129, 142, 171), ll-7-1 (58, 67) and 4-4 (24-34, rows 6-9). All match.
- In the original, `canCrossSmallGaps` is set per character. `MarioBase` ties it to run speed for Mario and Luigi, `MegaManBase` sets it to true (line 345) and switches it (lines 1028, 1109), and Sophia sets it to false (line 383). This report covers Mario only.
- Sources: `ll-w7/2026-10-05-ll-7-1-falls-into-one-tile-gaps.md` (playtested in both games) and the smb-w4 notes (4-4 top path, `shots/smb-w4/ours/236_shot.png`; not filed then because the original wasn't checked). The reviewer found the original's rule in its source and the exact cause in ours, and added 4-4 and the level scan.
- Screenshots: not committed (the repo's `check:assets` bans image files) (ll-7-1, Mario in the gap at column 67) and `…-2.png` (4-4, Mario in the gap at column 24). The HUD in the first reads WORLD 1-1 because it is the tester's test-map copy.
- Reviewed: verified against `com/smbc/level/Level.as` (lines 1887-1891, `checkCrossSmallGap` 2230-2272), `com/smbc/characters/base/MarioBase.as` (lines 80-93, 501-532, 726-733), `levelDataLostLevels.xml` 7-1 area a and `levelDataSmb.xml` 4-4/8-1/8-2 area a, and ours at b8379f9: `src/game/entities/body.ts` (`moveX`, `moveY`), `src/game/entities/player.ts` (lines 232-243), `src/game/characters/mario/index.ts` and `profile.ts`, `src/game/level/tiles.ts`.

Status: fixed — Mario and Luigi running on the ground faster than RUN_TMR_2_MIN_VX (220 Flash px/s = 1.83 px/f) now stay at ground level over one-tile gaps with ground at the same height on both sides (Level.checkCrossSmallGap, MarioBase canCrossSmallGaps); walking still drops in.
