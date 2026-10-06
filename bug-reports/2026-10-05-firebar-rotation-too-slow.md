# Fire bars take 4.27 s per turn; the original's take 3.40 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every fire bar. Seen in 1-4 (columns 30, 49, 60, 67, 76, 84 and 88), 3-4 (first one at column 19, row 11) and 5-4 (the long bar at column 23, row 7). The levels with fire bars are listed in `2026-10-05-firebar-rotation-direction-reversed.md`.
- **How to get there:** `?level=3-4&char=mario`, walk to column 9 (or `?level=1-4&char=mario`, walk to column 22)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Walk to column 9 in 3-4 and time one full turn of the fire bar at column 19 (or the bar at column 30 in 1-4).

## Expected

`com/smbc/projectiles/FireBar.as` line 20: `ROTATE_SPEED = 106` degrees per second, with the comment "game: three rotations 10 seconds", applied as `rotation += ±ROTATE_SPEED*dt` with `dt` in seconds. One turn takes 360 / 106 = 3.40 s, 204 frames at 60 fps (1.77° per frame).

## Actual

`src/game/entities/enemies/firebar.ts` line 34 advances `angle` by 1 of 256 steps per frame (1.41° per frame). One turn takes 256 frames, 4.27 s. A turn takes about 25% longer than the original's, and the angular speed is about 20% lower, which makes the gaps to run through longer. Frame-stepped captures match: in 1-4, 40 frames moved the column 30 bar about 56°; in 3-4 the turn rate seen matches 256 frames; in 5-4 (`?level=5-4&char=mario&dev=1`, from column 14) the long bar at column 23 took about 2.0 to 2.25 s for half a turn (straight up to straight down), which fits 4.27 s per turn.

## How often

every time

## Notes

- Merged from `smb-w1/2026-10-05-firebar-rotation-too-slow.md` (1-4) and `smb-w3/2026-10-05-3-4-firebar-rotation-speed.md` (3-4). The two reports gave "25% slower" and "20% slower"; both are right for different measures (time per turn vs. angular speed), stated above.
- Ours: playtested in 1-4 and 3-4. Original: code reading only; 1-4 and 3-4 froze on load in Ruffle.
- The long fire bars (`len=12`) use the same code.
- Also reported in 5-4 by smb-w5 (`smb-w5/2026-10-05-5-4-firebar-speed.md`): ours playtested, the original by code only (its 5-4 does not load in Ruffle).
- The bars were also watched turning in our 2-4 (smb-w2, `gauntlet/shots/smb-w2/ours/445_fb1.png` to `450_fb6.png`), 4-4 (smb-w4, `gauntlet/shots/smb-w4/ours/318_fb0.png` to `320_fb2.png`), 7-4 and 8-4 (smb-w7, smb-w8 notes), but their speed was not timed there. Folded in from `review/smb-w2.md` and `review/smb-w4.md` during the smb-w7/w8 consolidation.
- Related: `2026-10-05-firebar-rotation-direction-reversed.md`.
- Reviewed: verified against `com/smbc/projectiles/FireBar.as` (`ROTATE_SPEED` 106, `rotate`) and ours: `src/game/entities/enemies/firebar.ts` (`update`, `angle` 0..255).
