# 3-4's Podoboos leap about two tiles higher than in the original and fall without a speed limit

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 3-4, Podoboos at columns 16, 26, 88, 97, 103 and 109 (first one at column 16, in the pit at columns 16-17)
- **How to get there:** `?level=3-4&char=mario`, run to column 11
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open 3-4 and run to column 11.
2. Watch the Podoboo at column 16 reach the top of its leap.

## Expected

`com/smbc/projectiles/LavaFireBall.as` lines 13-33: it rests just below the bottom of the screen
(`restingYPos = GLOB_STG_BOT + height*.5`, so its top edge is at the screen bottom), leaps with 700 px/s against 800 px/s² gravity (5.83 px/frame,
0.111 px/frame² at our scale) and falls at most 400 px/s (3.33 px/frame). That is a rise of 700²/(2×800) = 306 original px, about 153 px at our scale,
so the top of the fireball peaks around y 87 (row 5.4). It waits 750 ms the first time and
750-2000 ms between leaps (lines 13-14, 26, 89).

## Actual

`src/game/entities/enemies/podoboo.ts` lines 7-10: it leaps from row 13.25 (y 212, inside the screen) with
5.5 px/frame against 0.094 px/frame², a rise of 161 px, so the top of its leap is y 51 (row 3.2), about 36 px (2.2 tiles) higher than the original's.
Its fall speed has no cap (back to 5.5 px/frame at the bottom). It waits 60-149 frames
(1.0-2.5 s) between leaps. In play the column-16 Podoboo reached row 3, right under the row-2
ceiling (screenshot).

## How often

every time

## Notes

- Evidence: code reading and a playtest of ours. Not seen in the original (3-4 froze Ruffle on
  load).
- Our screenshot: not committed (the repo's `check:assets` bans image files).
- Reviewer's correction: the tester's report said "about three tiles higher" and "top of its leap around row 6". With the original's top edge starting at the screen bottom (y 240 at our scale) and rising 153 px, its peak is row 5.4, so the difference is about 2.2 tiles. The exact peak also depends on the original's frame-step integration, so treat it as ±0.3 tile.
- Other castles with Podoboos on the normal layer, matched by data between the XML and our maps by the later testers (same `podoboo.ts` code, not measured there): 6-4 at columns 27, 33 and 131 (smb-w6), 7-4 at 20 and 324 (smb-w7), 8-4 `8-4-end` at 23 (smb-w8; the 8-4 main area's Podoboos are easy/hard only). Folded in from `review/smb-w6.md` and the smb-w7/w8 notes during the smb-w7/w8 consolidation.
- Reviewed: verified against `com/smbc/projectiles/LavaFireBall.as` (`sy` 700, `gravity` 800, `vyMaxPsv` 400, `restingYPos`, `waitTmrDurMin/Max` 750/2000) and ours: `src/game/entities/enemies/podoboo.ts` (`JUMP_SPEED` 0x05800, `GRAVITY` 0x00180, `REST_MIN/MAX` 60/150, rest y = row × 16 + 20).

Status: fixed — Podoboos now rest with their top at the screen's bottom, leap at 700 px/s against 800 px/s² (peak top near y 85), fall at most 400 px/s, and wait 750 ms first and 750-2000 ms between leaps (LavaFireBall.as `sy`, `gravity`, `vyMaxPsv`, `restingYPos`, `waitTmrDurMin/Max`).
