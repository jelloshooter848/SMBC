# Fire bars turn the opposite way from the original in every castle (the converter swaps fireBarLeft and fireBarRight), and start pointing right instead of straight up

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every fire bar. Seen in 1-4 (columns 30, 49, 60, 67, 76, 84 and 88) and 3-4 (columns 19, 24 and 29 at row 11; 54 and 64 at rows 5 and 11; 80 at rows 5 and 11) and 5-4 (all 11: columns 23 (long), 43, 49, 55 at rows 5 and 13, 61, 67, 73, 82, 92 and 103). The full list of affected levels is in Notes.
- **How to get there:** `?level=3-4&char=mario`, walk to column 9 and watch the fire bar at column 19, row 11 (or `?level=1-4&char=mario`, walk to column 22 and watch the bar at column 30, row 10)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=3-4&char=mario` and walk right to column 9.
2. Watch the fire bar at column 19, row 11 for a second, or take a few frames about 10 frames apart.

## Expected

In `com/smbc/projectiles/FireBar.as` (lines 39-47 and 158-164), a label containing "Left" sets `clockwise = false`, and `rotate()` then does `rotation += -ROTATE_SPEED*dt`. Flash's `rotation` is in degrees with positive meaning clockwise on screen, so a falling `rotation` turns the bar **counter-clockwise**. A "Right" label sets `clockwise = true` and turns it **clockwise**. (The `scaleX = -1` on Left bars only mirrors the sprite; Flash applies rotation after scale, so it does not change the direction of turn.)

So all seven 1-4 bars (`fireBarLeft`) and the six `fireBarLeft` bars of 3-4 (19,11; 24,11; 29,11; 54,5; 64,5; 80,11) turn counter-clockwise, and the three `fireBarRight` bars of 3-4 (54,11; 64,11; 80,5) turn clockwise (`levelDataSmb.xml`, normal layer). In 5-4 the `fireBarLongRight` at (23,7) and the `fireBarRight` bars at (43,13), (55,13), (92,10) and (103,11) turn clockwise, and the `fireBarLeft` bars at (49,9), (55,5), (61,9), (67,13), (73,9) and (82,6) turn counter-clockwise.

**Start angle.** Every bar, Left or Right, starts pointing straight up. Nothing sets an initial `rotation` (it starts at 0; `FireBar.as` and `Level.as` line 1099, `new FireBar(itemText)`), and in the bar's movie clip (`com.smbc.data.MovieClipInfo_FireBarMc`, sprite 259 in `scratchpad/flash/smbc3.swf`) the fireballs are placed straight above the pivot: x = 0 and y = 0, -16, … -80 in frame `6`, and y = 0 to -176 in frame `12` (the long bar). Mirroring a Left bar with `scaleX = -1` leaves an upward bar pointing up.

## Actual

Every bar turns the other way. The converter maps `fireBarLeft` to our `firebar` and `fireBarRight` to `firebar-ccw` (`tools/levelgen/convert-smbc.mjs` lines 223-224; lines 613-615 do the same for `fireBarLongLeft` / `fireBarLongRight`). `World` gives `firebar` `dir = +1` and `firebar-ccw` `dir = -1` (`src/game/world/world.ts` lines 331-333), and `Firebar.update()` adds `dir` to `angle` each frame with x = cos, y = sin on a y-down screen (`src/game/entities/enemies/firebar.ts` lines 30 and 34), so `firebar` turns clockwise.

Every bar also starts pointing right: `angle` starts at 0 (`firebar.ts` line 11), which with x = cos is straight right. Each bar is created at that angle when its column comes within 16 px of the screen's right edge (`World.spawnPending`, `src/game/world/world.ts` lines 271-280, `SPAWN_MARGIN_PX`).

In play: the 3-4 bar at column 19 went right → down → left (clockwise) in four frames 250 ms apart; the 1-4 bar at column 30 went from pointing left-up to almost straight up in four frames 10 frames apart (clockwise). In 5-4 the long bar at column 23 (`firebar-ccw`) starts pointing right and turns counter-clockwise: up-right, straight up, up-left, left, down-left, down (`2026-10-05-firebar-rotation-direction-reversed-2.png`, 0.25 s between frames); the original's turns clockwise from straight up.

## How often

every time

## Notes

- Merged from `smb-w1/2026-10-05-firebar-rotation-direction-reversed.md` (1-4, and a castle-by-castle check of the mapping) and `smb-w3/2026-10-05-3-4-firebars-rotate-wrong-way.md` (3-4).
- Ours: playtested in 1-4 and 3-4. Original: code and data reading only; 1-4 and 3-4 froze on load in Ruffle (`TypeError: Error #1009` in `addedToStage`).
- Every fire bar on the normal layer, original type → our entity (counts checked against our maps; every level uses the same swapped mapping):
  - SMB: 1-4 (7 Left), 2-4 (5 Left, 1 Right), 3-4 (6 Left, 3 Right), 4-4 (9 Right), 5-4 (6 Left, 4 Right, 1 LongRight), 6-4 (8 Left, 3 Right), 7-4 (2 Right), 8-4 (2 Left, 3 Right, in our `8-4-water.map`).
  - Lost Levels: ll-1-4 (4 Left, 5 Right), ll-2-4 (4 Left, 3 Right), ll-3-4 (4 Left, 2 Right), ll-4-4 (4 Left, 3 Right, 2 LongRight; the XML has one more Right as a wide-character alternate), ll-5-4 (7 Left, 5 Right, 1 LongRight), ll-6-4 (2 Left, 10 Right), ll-7-2 (2 Left, 1 Right), ll-7-3 (1 Left, 2 Right), ll-7-4 (6 Left, 1 Right), ll-8-4 (1 Left, 8 Right, 2 LongRight, across its sub-areas), ll-10-4 (1 Left, 3 Right, 1 LongRight), ll-11-2 (1 LongRight), ll-11-4 (6 Left, 1 Right), ll-12-3 (1 Left, 2 Right), ll-12-4 (7 Left, 1 Right), ll-13-4 (2 Left, 2 Right, 1 LongLeft, across its sub-areas).
- The likely fix is to swap the two names in the converter's table (and the long-bar case) and regenerate the maps, or to swap the meaning of `dir`; not both.
- The smb-w1 notes said 8-4's five fire bars are missing from our `8-4.map`. They are in `8-4-water.map` (the original's 8-4 area `b`), so nothing is missing.
- Our screenshot: `2026-10-05-firebar-rotation-direction-reversed.png` (3-4, four frames 250 ms apart).
- Also reported in 5-4 by smb-w5 (`smb-w5/2026-10-05-5-4-firebar-direction.md`): ours playtested, the original by code and data only (its 5-4 hung twice in Ruffle with `TypeError: Error #1009 ... addedToStage`). Our 5-4 screenshot from that report: `2026-10-05-firebar-rotation-direction-reversed-2.png`.
- More playtest sightings in ours (the original's castles were not played; folded in from the review logs during the smb-w7/w8 consolidation):
  - 2-4 (smb-w2): the `fireBarLeft` bars at columns 49, 55, 61, 73 and 82 (our `firebar`) turn clockwise, and the `fireBarRight` bar at column 92 (our `firebar-ccw`) turns counter-clockwise. Shots `gauntlet/shots/smb-w2/ours/445_fb1.png` to `450_fb6.png` (reviewer checked: the column-49 bar goes down → left → up). Source: `review/smb-w2.md`.
  - 4-4 (smb-w4): all nine bars are `fireBarRight` (53,6; 60,9; 117,6; 124,9; 180,6; 187,10; 244,6; 251,10; 290,10) and all nine are `firebar-ccw` in our `4-4.map` (lines 32-41). The bar at column 290 turns counter-clockwise (up → up-left) in a share-link copy of 4-4 near Bowser (HUD reads WORLD 1-1): `gauntlet/shots/smb-w4/ours/318_fb0.png` to `320_fb2.png`. Source: `review/smb-w4.md`.
  - 7-4 (columns 167 and 231, both Right) and the 8-4 water area: the smb-w7 and smb-w8 testers saw the same reversed direction (`gauntlet/notes/smb-w7.md`, `gauntlet/notes/smb-w8.md`; no shots cited).
- The smb-w5 tester also said the Left bars start pointing left in the original because of `scaleX = -1`. That is not right: the bar art points up, not right, so mirroring it changes nothing and every original bar starts pointing up (see Expected). Ours starts every bar pointing right, a quarter turn off for Left and Right bars alike. The reviewer checked this in the SWF and added it here rather than as a separate report, since the fix touches the same code. In our 0-255 angle (y down), straight up is 192.
- Not verified: when the original's bars start turning (at level load or when they come near the screen). That decides which angle a bar shows when you reach it, so the angle on arrival may differ by more than the quarter turn.
- Speed is a separate report: `2026-10-05-firebar-rotation-too-slow.md`.
- The NES agrees with the original Crossover, so this is not an NES-versus-Crossover choice. In the SMB1 disassembly (https://gist.github.com/1wErt3r/4048722), 1-4's enemy data (`E_CastleArea1`) mostly uses fire bar type `$1d`. `FirebarSpinDirData` gives that type a nonzero direction, which takes the branch the disassembly labels `SpinCounterClockwise`.
- Reviewed: verified against `com/smbc/projectiles/FireBar.as` (`clockwise`, `rotate`, no initial rotation), the placements in sprite 259 of `smbc3.swf` (`MovieClipInfo_FireBarMc`), `levelDataSmb.xml` and `levelDataLostLevels.xml` (every `fireBar*` token not hidden on normal), and ours: `tools/levelgen/convert-smbc.mjs`, `src/game/world/world.ts`, `src/game/entities/enemies/firebar.ts`, and every `.map` with a `firebar` line.
