# Lava kills the moment the player touches its surface and plays the hop-up death; in the original lava is only scenery and the player dies like in a pit

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every lava tile in both map sets (list in Notes). Measured in ll-13-4 at the lava pit at columns 11-15 (row 13). The case where it matters most is the vertical swinging lift (`lift-v`) in `ll-13-4-end` at column 69, and the one in `ll-4-4` at column 61.
- **How to get there:** `?level=ll-13-4&char=mario`, walk right off the ground at column 10 into the lava at columns 11-15. Quicker: the level editor share link of `ll-13-4.map` with only `start:` moved to `13,9` (Mario drops straight into the lava).
- **Character and power:** Mario, small (Dev assists: Inf. lives on, No damage OFF)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open ll-13-4 (or the test map above) and press F1.
2. Fall into the lava at columns 11-15.
3. Watch Mario's `y` in the overlay.

## Expected

As in the original, lava is drawn but does nothing. The player keeps falling through it and dies as in a pit, once he has dropped off the bottom of the screen, with no hop:

- The lava tokens are scenery. `wavesLava` and `colorRed` match none of the ground, block, pipe, enemy, platform or other branches in `com/smbc/level/Level.as`, so they reach the last branch (lines 1171-1174), `new Scenery(itemText)`. `com/smbc/graphics/Scenery.as` puts them on the back layer (`BACK_LAYER_DCT.addItem(FL_WAVES_LAVA)`, line 135; `FL_COLOR_RED`, line 136). No character, ground or level code refers to lava. The only lava class is `LavaFireBall` (the Podoboo).
- Death comes from the pit check in `com/smbc/characters/Character.as` (lines 2990-3001): `if (ny - height >= GLOB_STG_BOT)` (the top of the character is below the bottom of the screen; `GLOB_STG_BOT` is the screen height, `Level.as` line 98) → `_fellInPit = true; die()` → `initiatePitDeath()` (line 2338), which only starts the die timer. There is no hop. That is the same as a bottomless pit, and the same as the NES, where castle lava is a pit.

The difference matters most for lifts that pass through the lava. In `ll-13-4-end` the XML has `movingPlatform&&shiftRight&&width=4&&type=WaveVertical` at 69,10 (`<LEVEL ID="13-4">`, area d). `com/smbc/ground/Platform.as` moves it as `y = centerY + sin(waveAngle) * waveRange` with `waveRange = 150` Flash px and `waveSpeed = 1` rad/s (lines 56-57, 306-313), with `centerY` = its spawn y (line 186). That is ±4.7 tiles around row 10, from row 5.3 down to row 14.7, one cycle every 6.3 s. The lift's top is below the lava surface (row 13) whenever `sin` > 0.64, about 1.75 s of every cycle. A rider is then drawn inside the lava, but his top stays above the screen bottom, so the original never kills him and he can ride the lift all the way round.

## Actual

`LAVA` is a `hazard` tile (`src/game/level/tiles.ts` line 72), and `World.collisions` (`src/game/world/world.ts` lines 893-905) calls `kill(p)` as soon as any part of the player's box overlaps a lava tile. `updateDeath` (lines 1123-1130) then freezes him for 30 frames and throws him up at `vy = -0x04000` (4 px/frame) before he falls.

Measured (screenshot (screenshot not committed: the repo's `check:assets` bans image files), the test map, so the HUD reads WORLD 1-1): Mario dies at y = 193, with his feet 1 px into the lava at row 13 (column 13). He hangs on the lava surface for 30 frames, hops up to y = 144 (row 9, 3 tiles above the lava), then falls off the screen. In the original he would drop straight through and die only after leaving the bottom of the screen.

Consequences:

- Every lava death looks like an enemy-hit death (a frozen pause, then the hop) instead of a fall.
- A rider of the `ll-13-4-end` lift at column 69, or of `ll-4-4` at column 61, dies as soon as his feet reach row 13. Today our `lift-v` also takes the wrong path (it only sinks, from row 10 to row 16; filed as `2026-10-05-lifts-vertical-swinging-lifts-wrong-path-and-speed.md`). Played with No damage OFF (test map with the start at 70,9, above the lift): Mario came down onto the lift while it was inside the lava at row 13, and died on contact. Even after that path is fixed to the original's ±4.7-tile swing, the lowest 1.7 tiles of the swing would still kill the rider in ours, while the original lets him ride through.

## How often

every time

## Notes

- PR #24 check: still applies on main 2225155. `git diff b8379f9 HEAD` is empty for `src/game/level/tiles.ts`, `src/game/world/world.ts`, `src/game/entities/objects/lift.ts`, `tools/levelgen/convert-smbc.mjs` and every map in `src/content/levels/`.
- **Severity (reviewer):** "wrong behaviour". It does not block a required route. The D-4 lift section is passable in ours: the reviewer jumped from the pit floor at columns 64-67 onto the rising `ll-13-4-end` lift, landing near the top of its path (row 10), and jumped from there onto the wall top at column 72 (row 6), without touching the lava (No damage on only against the Hammer Bro's hammers). With the lift path fixed, a rider can still get off before the lift dips into the lava, so the lava rule makes that lift harder, not impossible.
- **Separate rule from the lift reports.** The path is `2026-10-05-lifts-vertical-swinging-lifts-wrong-path-and-speed.md` (this final adds the D-4 lift there). `2026-10-05-ll-12-4-lava-lift-never-reaches-drop-shaft.md` is a sideways-lift path bug: Mario misses the lift and falls into lava, which kills him in both games (in the original after he leaves the screen), so this rule does not change that report.
- **Our lava is one row of tiles.** The converter turns `wavesLava` into `~` (`convert-smbc.mjs` lines 364-365) and drops `colorRed`, the red fill drawn below it (`IGNORED`, line 236), so in ours the cells below the surface are air. A reviewer scan found no solid tile below any lava tile in any of our maps. Our lava cells match the XML's normal-difficulty `wavesLava` cells in every level below, except five cells where the XML puts `groundNormal&&WideCharacter=Hide` (ground for Mario) in the same cell (ll-2-4 25, ll-10-4 98, ll-11-4 63 and 69, `ll-13-4-end` 87). Ours keeps the ground there, which is correct.
- **Lava areas (surface row 13 unless noted; columns):**
  - SMB: 1-4 and 6-4 (row 12: 13-14; row 13: 26-28, 32-34, 128-140); 2-4 and 5-4 (16-31, 109-110, 113-114, 128-140); 3-4 (46-47, 87-89, 96-98, 102-104, 108-110, 128-140); 4-4 (7-8, 11-12, 153-154, 156-159, 217-218, 220-223, 288-300); 7-4 (16-26, 164-166, 168-170, 228-230, 232-234, 320-332); 8-4 (6-10, 66-74, 155-157, 231-234, 295-298); 8-4-end (21-25, 32-44).
  - Lost Levels: ll-1-4 (21-23, 26-28, 31-33, 96-99, 103, 107, 128-140); ll-2-4 (24, 57-62, 72, 81, 85, 90, 96-98, 104-107, 111, 116-119, 123-124, 128-140); ll-3-4 (8-10, 19-22, 28-30, 83-86, 92-94, 284-286, 289-291, 294-306); ll-4-4 (48-63, 91-94, 126-127, 143, 160-162, 167-184, 187-189, 192-204); ll-5-4 (row 12: 4, 7-9; row 13: 16-23, 26-30, 36-38, 50-52, 54-55, 57-58, 67-81, 87-92, 94-96, 98-103, 125-148, 162-167, 173, 181, 192-204); ll-6-4 (5-15, 39-40, 66, 103-104, 130, 170-189, 196, 234-253, 260, 291-303, 320-332); ll-7-4 and ll-12-4 (29-33, 91, 95, 99, 176-199, 203-207, 224-236); ll-8-4 (7-14, 32-36, 41-46, 49-50, 53-66, 69-73); ll-8-4-end2 (5-10, 37-45, 47, 50-52, 69-74, 101-109, 111, 114-116, 192-198, 200); ll-8-4-end3 (64-69, 74-78, 112-124); ll-9-3 (row 12: 112-145, 188-201; row 13: 80-84); ll-10-4 (15-16, 20-22, 26-28, 32-34, 39-40, 57-63, 88-90, 92-94, 96-97, 99-103, 105-109, 111, 148-154, 160-172); ll-11-4 (4, 6, 8-16, 18, 21, 36-42, 64-68, 198, 200-206, 224-236); ll-13-4 (11-15, 32-36, 41-46, 49-50, 53-71, 74); `ll-13-4-end` (68-71, 88, 96-108).
- **Where a lift in the original passes through the lava graphics** (XML, normal layer, by code; not playtested in the original):
  - Vertical swinging lifts (`WaveVertical`), whose top goes down to row 14.7: `ll-13-4-end` 69,10 (over lava 68-71) and ll-4-4 61,10 (normal difficulty only, over lava 48-63). The rider survives in the original and dies in ours.
  - Falling lifts (`StepFall`) over lava: SMB 7-4 18,7 and 22,8; ll-4-4 92,6; ll-5-4 18,10, 70,11 and 77,11; ll-8-4 area e (`ll-8-4-end3`) 67,11; ll-13-4 64,9. In the original a rider stays on until his top passes the screen bottom. For small Mario that is when the lift's top is 3 rows below the lava surface, about 0.43 s later at `fallSpeed` 225 Flash px/s (`Platform.as` line 38). In ours he dies when the lift's top passes the surface.
  - Constantly falling lifts (`ConstantFall`, which wrap to the top of the screen): ll-6-4 at 188 and 252 (rows 5 and 13). Same as the falling lifts, about 0.87 s at `ySpeed` 110 Flash px/s.
  - Sideways lifts at the lava surface (`WaveHorizontal` at row 13): SMB 8-4 70; ll-6-4 182, 246 and 297; ll-7-4 and ll-12-4 31; ll-8-4 area d 41 and 105. Their top is level with the lava surface, so a standing rider is not inside the lava in either game.
- **Jump arcs:** no ground lies below a lava surface, so a jump arc can only dip into the lava graphics and come back out when it starts from one of the lifts above while that lift is below the surface. In the original that is possible; in ours the rider is already dead.
- With the No damage assist ON, lava does not kill in ours (the hazard check skips `assist.invulnerable`). Mario then rode the 13-4 lift down to y = 249, below the bottom of the level, and back up without dying (tester, `gauntlet/notes/llwD/m4.png`).
- Evidence: ours playtested (tester, plus the reviewer's D-4 lift run). The original was checked by reading its code (`Level.as`, `Scenery.as`, `Character.as`, `Platform.as`) and data. The tester did not ride the D-4 lift in the original: Ruffle ran far too slowly to get from D-4 area a to area d. D-4 area a did load in Ruffle, and the tester played it to the pipe at column 103.
- Source: `ll-wD/2026-10-05-lava-kills-on-touch-with-death-hop.md`. The reviewer fixed the vertical-lift report's name (the tester cited its pre-merge name `1-3-vertical-lift-wrong-path-and-speed`), added `shiftRight` to the D-4 lift's XML cell, the time the lift spends in the lava, the corrected `centerY` line (186, not 192), the converter's one-row lava, the lava and lift lists, the D-4 playtest and the severity reasoning.
- Reviewed: verified against `com/smbc/level/Level.as` (item branches, lines 98 and 1171-1174), `com/smbc/graphics/Scenery.as` (lines 135-136), `com/smbc/characters/Character.as` (lines 2338, 2990-3001), `com/smbc/ground/Platform.as` (`waveRange`, `waveSpeed`, `fallSpeed`, `ySpeed`, `updateGround`), `levelDataSmb.xml` and `levelDataLostLevels.xml` (every `wavesLava` and `movingPlatform` cell in the lava levels), and ours: `src/game/level/tiles.ts`, `src/game/world/world.ts` (`collisions`, `kill`, `updateDeath`), `src/game/entities/objects/lift.ts`, `tools/levelgen/convert-smbc.mjs`, every map in `src/content/levels/`.
