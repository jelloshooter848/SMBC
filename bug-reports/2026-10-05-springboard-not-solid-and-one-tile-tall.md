# Springboards are a 1-tile plate you can walk through; the original's are a solid block 2 tiles tall

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every springboard, red and green (44 in all; list in Notes). Seen in ll-3-1 (green, column 160, row 12), ll-4-3 (red, column 26, row 12) and ll-4-1 (red, column 74, row 11).
- **How to get there:** `?level=ll-4-3&char=mario`, jump the gap at columns 16-23 and land on the mushroom platform at column 24 or 25. Or `?level=ll-3-1&char=mario&dev=1` and go to column 158. The testers used share-link copies of the real maps with only `start:` moved (`24,12` in ll-4-3, `66,12` in ll-4-1; `158,12` in ll-3-1, where the green Paratroopa at column 156 was also removed).
- **Character and power:** Mario, small (ll-3-1: Dev assists infinite lives and No damage)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. In ll-4-3, stand on the mushroom platform at column 24, row 12, left of the springboard at column 26 (or in ll-3-1, stand on the ground at column 158).
2. Hold right only. Do not jump.
3. Watch Mario reach the springboard.

## Expected

The springboard is solid ground about 2 tiles tall. Walking into it stops Mario at its side, and he has to jump onto it from above. It squashes to about 1 tile as he rides it, then launches him.

- **Solid:** `com/smbc/ground/SpringRed.as` line 16, `SpringRed extends Ground` (`SpringGreen extends SpringRed`). A side hit on any visible `Ground` goes through `AnimatedObject.hitGround` (`com/smbc/main/AnimatedObject.as` lines 392-418) to `Character.groundOnSide`, which stops Mario (`vx = 0`) and pushes him out. A hit from below goes to `groundAbove` (Mario bumps his head). Only a hit from above is special: `AnimatedObject.groundBelow` (lines 441-478) starts the bounce for a character (`sprBounce`, `onSpring`).
- **2 tiles tall, squashing:** `SpringRed.setColPoints()` (lines 45-60) builds the hit box from the clip: `hBot` = the bottom of the spring's map cell, `hTop = hBot - height`, `hLft = x`, `hRht = x + width`. `sprBounce()` calls it again on every frame Mario rides, so the top follows the squashing animation. The clip's mask in the game file (`MovieClipInfo_SpringRedMc` and `_SpringGreenMc`, the `SkinMask` child) spans y -34 to 32 Flash px from the top of the map cell, so the spring can fill its own cell and the one above. In play, the idle spring is drawn 62-64 Flash px (2 tiles) tall in three graphics sets, and about 1 tile when fully squashed (reviewer only: 5-2 `shots/smb-w5/orig3/016_p14.png` idle, `017_sh.png` squashed; ll-4-3 `shots/ll-w4/orig/051_b6.png`; ll-2-1 `shots/ll-w2/orig/126_rt.png`). The exact height comes from the graphics set's art, so it may vary a little between sets.
- **The tile above:** `com/smbc/level/Level.as` lines 1227-1234 (and 3118-3124 when an area is re-armed) add a `DummyGround` at `currentY - TILE_SIZE`, the cell above the spring, because the spring fills that cell too. The `DummyGround` itself is **not** solid: it is invisible (`alpha = 0`), has `stopHit = true` and no hit-test types (`com/smbc/ground/DummyGround.as` lines 9-13), and `Level.groundHT` skips any ground with `stopHit` (lines 3799 and 3830). It only marks the cell as occupied in the tile grid (`GroundNestedColumnDictionary.getGroundAt`), which other code reads for neighbours: corner rounding against blocks beside that cell (`HitTester.as` lines 337-365), small-gap squeezing (`Level.as` lines 2201-2217), ground art borders (`SimpleGround.as` lines 101-108) and Sophia's climbing. The solid 2-tile body is the spring's own hit box.

Playtested in the original's 4-3 (Ruffle, with the Invincible and Infinite Lives cheats, which don't change collisions): after landing on the platform left of the spring, Mario held right for about 6 s of real time and stayed pressed against the spring's left side (reviewer only: `shots/ll-w4/orig/051_b6.png` and `052_b7.png`, about 4 s apart, Mario in the same place).

## Actual

Mario walks straight through the springboard, overlapping its sprite. He doesn't stop and doesn't bounce.

- **ll-4-3, column 26:** with F1, x goes 389 → 398 → 413 → 431 → 450 at y 192 on the platform. The springboard covers x 416-432. The next frame shows y 225, falling at column 29: Mario walked off the right end of the platform into the pit.
- **ll-3-1, column 160:** Mario walked from x 2557 (tile 159,12) to x 2575 (tile 160,12) and kept going, through the springboard at x 2560-2576.
- **ll-4-1, column 74:** the spring sits on a one-block step at the edge of the water pit (spring at row 11, block at row 12). Small Mario jumping up beside the spring lands on the block, inside the spring's box, and then walks through the spring into the pit with no bounce. Repro on the test map (start `66,12`): hold right for 900 ms, right+jump for 300 ms, right for 200 ms, then hold right. Mario stands at x 1178-1197, y 176 (tile 74, row 11) overlapping the spring, then falls in at column 76. In the original the spring stands about 2 tiles tall on top of that block, and Mario can only get on it by landing on top.

Cause: `Spring` (`src/game/entities/objects/spring.ts`) is a 16 × 16 entity in its map cell (constructor line 29: `super(px(tx * 16), px(ty * 16), 16, 16)`) with no tile collision. The only code that touches it is `World.springUnder` (`src/game/world/world.ts` lines 693-708), which reacts only to a player coming down onto the plate (`b.vy > 0` and `prevBottom <= s.y + 4`). Nothing else interacts with springs, so a sideways approach never touches one, and enemies and items pass through as well. Nothing is placed in the cell above the spring either (the converter maps `springRed` / `springGreen` to the `s` / `y` grid markers, `tools/levelgen/convert-smbc.mjs` lines 197-211).

Consequences:
- You can walk or run through a springboard, and off a platform behind it.
- You only need a 1-tile hop to get onto one (original: about 2 tiles).
- You can't bump your head on one from below.

**Fix note:** make the spring block from the sides and below with an idle height of about 2 tiles (its own cell and the one above), squashing to about 1 tile while ridden. Keep the launch spot where it is now, about 1 tile above the spring's base: `2026-10-05-springboard-bounce-too-high.md` measures every bounce from that spot, and the original's fully squashed spring puts Mario at the same height as ours (Mario's top at y 176 on a row-12 spring in 5-2).

## How often

every time

## Notes

- **Evidence:** ours playtested in ll-4-3, ll-4-1 and ll-3-1. The original playtested in 4-3 (side collision), plus the code above, the art mask in the game file and screenshots of the idle and squashed spring in three levels. The ll-3-1 tester could not reach column 160 in the original (two runs ended in pits before column 50).
- **Springboard levels** (normal layer, Mario-visible; same cells in our maps): red: SMB 2-1 (188), 3-1 (126), 5-2 (25), 6-3 (38, 116), 7-1 (151), 8-2 (44); ll-4-1 (74), ll-4-2 (56), ll-4-3 (26, 83), ll-8-2 (101), ll-8-3 (37, 141), ll-9-3 (66), ll-10-1 (179), ll-10-2 (16), ll-10-3 (156), ll-13-1 (14), ll-13-2 (164), ll-13-3 (129). Green: ll-2-1 (114, 162), ll-3-1 (160), ll-3-3 (85), ll-7-3 (21, 50, 73, 99, 137, 196, 233), ll-11-1 (129), ll-11-3 (66, 101, 135), ll-12-2 (131), ll-12-3 (21, 50, 73, 99, 137, 196, 233). Where a spring sits on a 1-tile pillar between gaps (ll-4-2 column 56) it can't be reached from the side.
- The ll-w2 tester noticed in the original's ll-2-1 that the green spring was taller than ours (about 1.75 tiles in that graphics set), so Mario had to hop onto it from the mushroom.
- Screenshots (ours): (screenshot not committed: the repo's `check:assets` bans image files) (ll-3-1 test map, F1 x 2575, tile 160,12: Mario past the springboard; the HUD says WORLD 1-1 because it is a share-link copy) and (screenshot not committed: the repo's `check:assets` bans image files) (ll-4-3 test map, six frames 200 ms apart: Mario walks through the spring and off the platform).
- Sources, merged: `ll-w3/2026-10-05-ll-3-1-springboard-one-tile-and-walk-through.md` (size and walk-through, ll-3-1), `ll-w4/2026-10-05-springboard-not-solid-from-the-side.md` (side collision, ll-4-3 and ll-4-1, with the original playtested), and the ll-w2 tester's finding that the original adds an invisible tile above every spring (`Level.as` 1227-1234, reported to the coordinator, no separate report). The reviewer checked that `DummyGround` is not solid itself (above), measured the clip mask in the game file, and added the level list and the fix note.
- **Seen again (ll-wC notes, ours):** in ll-12-3 Mario walked through the green springboard at column 99.
- Reviewed: verified against `com/smbc/ground/SpringRed.as` (`setColPoints`, `sprBounce`), `com/smbc/ground/DummyGround.as`, `com/smbc/main/AnimatedObject.as` (`hitGround`, `groundBelow`), `com/smbc/characters/Character.as` (`groundBelow`, `groundOnSide`), `com/smbc/level/Level.as` (spring spawn 1227-1234 and 3118-3124, `groundHT`), `com/smbc/utils/GroundNestedColumnDictionary.as`, `com/smbc/data/HitTester.as` (corner rounding), the original's `SpringRedMc` / `SpringGreenMc` mask in `smbc3.swf`, both level XMLs, and ours: `src/game/entities/objects/spring.ts`, `src/game/world/world.ts` (`springUnder`), `tools/levelgen/convert-smbc.mjs`, the spring markers in `src/content/levels/`.
