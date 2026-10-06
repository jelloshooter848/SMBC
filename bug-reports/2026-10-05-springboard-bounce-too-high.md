# Springboard launches are wrong: the plain bounce goes 5.8 tiles (red) and 21 tiles (green) instead of 2.6, the boosted bounces differ, and holding jump from before landing gives the boost

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every springboard, red and green (level list in Notes). Seen with the red springboard in 5-2 (column 25, row 12) and 2-1 (column 188), and with the green one in ll-2-1 (column 114, row 10).
- **How to get there:** red: `?level=5-2&char=mario&dev=1`, climb the starting staircase, go down the far side and hop onto the springboard. Green: `?level=ll-2-1&char=mario`, cross the lifts at columns 107 and 121 to the mushroom at columns 112-115. The ll-2-1 tester used share-link copies of `ll-2-1.map` with only the start moved, to `114,7` (Mario drops onto the spring) or `114,0` (from the top of the screen).
- **Character and power:** Mario, small (5-2: Dev assists infinite lives and No damage)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

A. **Plain bounce, red:** in 5-2, hop onto the springboard at column 25 and do not press jump. Note how high Mario goes (F1 shows his y).

B. **Plain bounce, green:** in ll-2-1, drop or walk onto the green springboard at column 114 and do not touch jump. Watch Mario's y.

C. **Held jump:** in ll-2-1 (start `114,0`), hold jump before Mario lands on the green springboard and keep holding it without pressing again. Compare the launch speed with B. The same happens on red springs.

## Expected

The original has one launch routine for both colours, `com/smbc/ground/SpringRed.as` `springLaunch` (lines 61-81). At the end of the compression it sets `vy = -boostSpringPwr` if `Character.springBoost` is set, otherwise `vy = -defSpringPwr`:

- `defSpringPwr = 500` (line 19) for both colours. `SpringGreen.as` only raises `boostSpringPwr` (line 12: 2750 for Mario; other heroes get other values, lines 13-26), so **a green spring's plain bounce is the same as a red one's**.
- `boostSpringPwr = 1000` for red (line 20), 2750 for green.
- **When the boost applies:** `Character.pressJmpBtn()` (`com/smbc/characters/Character.as` lines 1256-1260) sets `springBoost = true` only while `onSpring`. `com/smbc/managers/ButtonManager.as` lines 226-233 call it only on the key-down edge (`if (jmpBtn) break;` first). `Character.as` lines 974-975 clear `springBoost` whenever Mario is not on a spring, and `springLaunch` clears it after use (line 70). So the player must press jump while the spring is compressed. A button that is already held when Mario lands gives the plain bounce.
- **The rise:** the launch does not start a jump rise (`Character.springLaunch` is empty for Mario, line 3067, and `setJumpRise` is only called from `MarioBase.jump`), so Mario rises under his normal `GRAVITY = 1500` px/s² (`com/smbc/characters/Mario.as` line 47). The launch speed does not depend on Mario's run speed. Mario's upward cap `vyMaxNgv = 4000` (`MarioBase.as` line 273) does not clip any of these.

At our scale (Flash px/s ÷ 2 ÷ 60 = our px per frame; gravity 1500 = 0.208 px/frame²):

| Spring | Input | Original launch | Original rise | Ours launch | Ours rise |
|---|---|---|---|---|---|
| red | plain | 500 → 4.17 px/f | 41.7 px = **2.6 tiles** | 1.15 × 4 = 4.6 px/f | measured 93 px = **5.8 tiles** |
| red | fresh press on the spring | 1000 → 8.33 px/f | 167 px = 10.4 tiles | 1.65 × 4 = 6.6 px/f | measured about 193 px = 12 tiles |
| green | plain | 500 → 4.17 px/f | 41.7 px = **2.6 tiles** | 2.3 × 4 = 9.2 px/f | 339 px = **21 tiles** (by code; seen leaving the top of the screen) |
| green | fresh press on the spring | 2750 → 22.9 px/f | 1260 px = 79 tiles | 3.3 × 4 = 13.2 px/f | 697 px = 44 tiles (by code) |

Playtested in the original:
- 5-2, column 25, red, no jump: Mario's head went from screen y 412 on the spring to 326 at the top of the bounce, 86 screen px = 43 game px = about 2.7 tiles (reviewer only: `shots/smb-w5/orig3/017_sh.png` to `orig3/023_sh.png`, 0.2 s wall time apart).
- Lost Levels 2-1, column 114, green, no jump: Mario rose about 2 tiles and came back down on screen. His top was at screen y 336 on the compressed spring and 264 at the top of the bounce, 72 screen px = 36 px at our scale = 2.25 tiles (reviewer only: `shots/ll-w2/orig/121_s3.png` to `126_rt.png`).

## Actual

`Spring.ride` (`src/game/entities/objects/spring.ts` lines 52-68) launches with `Player.launch(SPRING_BOOST = 1.15)` or `SPRING_BOOST_HELD = 1.65` for red, and `SPRING_GREEN_BOOST = 2.3` or `SPRING_GREEN_BOOST_HELD = 3.3` for green (lines 8-12). Three things differ from the original:

1. **The plain bounce rises under hold gravity.** `Player.launch` (`src/game/entities/player.ts` lines 433-444) multiplies the standing jump's initial speed (`0x04000` = 4 px/frame for a standing or walking Mario, `src/game/characters/mario/profile.ts` lines 19-20) by the boost and sets `launched`, which keeps the light held-jump gravity (`0x00200` = 0.125 px/frame²) until the apex whether or not jump is held (lines 219-221; the comment says it "floats to its apex like a held jump"). A running Mario gets the running tier (`0x05000`, line 21), so ours also launches 25% faster after a run; the original's launch is fixed.
2. **The green plain bounce uses a super-spring value.** `SPRING_GREEN_BOOST = 2.3` applies with no jump at all, so the green spring always throws Mario off the screen. In the original the green spring's plain bounce equals the red one's.
3. **Holding jump counts as a press.** `World` passes `input.held('jump')` to `Spring.ride` every frame (`src/game/world/world.ts` lines 549-551), and `ride` latches `this.held = true` if jump is down on any compression frame (`spring.ts` line 56). Holding jump through a jump onto a spring, as players usually do, always gives the boost.

Measured with F1:
- **A, 5-2 red, column 25:** no jump: Mario's top went from y 176 (on the spring) to y 83, 93 px = 5.8 tiles, more than twice the original's 2.7. Jump held: from y 180 to about y -13, about 193 px = 12 tiles, against 10.4 in the original. So the boosted bounce is only about twice the plain one, where the original's is about four times.
- **B, ll-2-1 green, column 114 (start 114,7, no input):** Mario stands on the plate at y 144. Two frames after the launch he is at y 116, then 99, 82 and 65 (about 8.5-9 px per frame), and he leaves the top of the screen about 0.3 s after the launch.
- **C, ll-2-1 green (start 114,0):** jump held all the way down from the top of the screen: launch at about 13 px/frame (y 144 → 117 → 91 → 66 → 41 over 2-frame steps), which is `SPRING_GREEN_BOOST_HELD` (13.2 px/frame). With no jump: about 8.5 px/frame (`SPRING_GREEN_BOOST`).

**Fix approach** (reviewer's suggestion): port `springLaunch` as one change in `Spring.ride` / `Player.launch`. Launch at a fixed 4.17 px/frame for both colours, or 8.33 (red) / 22.9 (green) px/frame only when jump was newly pressed (key-down edge) while Mario is on the spring. Let the rise use normal gravity (no `launched` hold gravity), and don't scale the launch by the jump tier.

## How often

every time

## Notes

- **Evidence:** the plain bounce was playtested in both games, for red (5-2) and for green (Lost Levels 2-1). The boosted bounces and the press rule in the original come from its code only: Ruffle ran too slowly to time a held-versus-pressed test.
- **Springboard levels** (normal layer of both XMLs, Mario-visible; our maps have the same springs at the same cells, 44 in all):
  - Red (`springRed` → our `spring`): SMB 2-1 (188), 3-1 (126), 5-2 (25), 6-3 (38, 116), 7-1 (151), 8-2 (44); Lost Levels ll-4-1 (74), ll-4-2 (56), ll-4-3 (26, 83), ll-8-2 (101), ll-8-3 (37, 141), ll-9-3 (66), ll-10-1 (179), ll-10-2 (16), ll-10-3 (156), ll-13-1 (14), ll-13-2 (164), ll-13-3 (129).
  - Green (`springGreen` → our `spring-green`): ll-2-1 (114, 162), ll-3-1 (160), ll-3-3 (85), ll-7-3 (21, 50, 73, 99, 137, 196, 233), ll-11-1 (129), ll-11-3 (66, 101, 135), ll-12-2 (131), ll-12-3 (21, 50, 73, 99, 137, 196, 233).
  - The red springs in ll-7-3, ll-8-1, ll-12-3 and the extra one in 6-3 (column 124) are `charHorz=Show` (Sophia-only helpers) and are rightly absent from our maps. The earlier version of this report listed ll-7-3, ll-8-1 and ll-12-3 as red-spring levels; the ll-w1/w2 reviewer corrected that.
- **Spring size:** in the original the springboard is a solid, 2-tile-tall block that squashes to about 1 tile as Mario rides it; ours is a 1-tile plate you can walk through. That is filed separately as `2026-10-05-springboard-not-solid-and-one-tile-tall.md`. It doesn't change the numbers here: both games launch from about the same spot (Mario's top at y 176 on a row-12 spring in 5-2, with the original's spring fully squashed in `orig3/017_sh.png`), and all rises above are measured from the launch spot.
- 2-1 (smb-w2), ours only: the springboard at column 188 gave a peak 87 px above the plate with no jump and about 190 px with jump held, consistent with the 5-2 numbers here (93 px and 193 px). Shots: `gauntlet/shots/smb-w2/ours/155_sp1.png` to `160_sp6.png`, `162_sq1.png` to `169_sq8.png` and `170_sl1.png` to `179_sl10.png`; in `178_sl9.png` Mario is at y -12 with jump held. The original's 2-1 spring was not reached. Folded in from `review/smb-w2.md` during the smb-w7/w8 consolidation.
- Sources: `smb-w5/2026-10-05-5-2-springboard-bounce-too-high.md` (sub-point A), `ll-w2/2026-10-05-ll-2-1-green-springboard-plain-bounce-too-high.md` (B) and `ll-w2/2026-10-05-springboard-held-jump-gives-boost.md` (C), merged by the ll-w1/w2 reviewer because all three come from the one routine (`SpringRed.springLaunch`) that `Spring.ride` and `Player.launch` replace, so one port fixes all of them. The reviewer added the conversion table, the jump-tier note and the corrected level list.
- **Please retest a long spring jump (ll-wC notes):** in ll-12-3, the jump from the green springboard at column 73 to the platform at columns 98-100 covers 25 tiles. In ours today it only works with a boosted bounce and right held from the launch: Mario's air speed is capped at 1.563 px/frame, and he lands at x 1561, about 7 px onto the platform. The plain bounce carries him only to about column 89. After this fix, the boosted green launch rises about 79 tiles instead of 44, so the jump should get easier. Please check that it can still be made. ll-7-3 has green springs at the same columns (21, 50, 73, 99, 137, 196, 233), so check its column 73 spring too.
- Reviewed: verified against `com/smbc/ground/SpringRed.as` (`defSpringPwr`, `boostSpringPwr`, `springLaunch`), `com/smbc/ground/SpringGreen.as`, `com/smbc/characters/Character.as` (`pressJmpBtn`, `springBoost` reset, `springLaunch`), `com/smbc/managers/ButtonManager.as` (jump key-down), `com/smbc/characters/Mario.as` (`GRAVITY`), `com/smbc/characters/base/MarioBase.as` (`jump`, `vyMaxNgv`), both level XMLs (`springRed` / `springGreen`), and ours: `src/game/entities/objects/spring.ts`, `src/game/entities/player.ts` (`launch`), `src/game/characters/mario/profile.ts`, `src/game/world/world.ts` (`ride` call, `springUnder`), the spring markers in `src/content/levels/`.

Status: fixed — springs now launch at a fixed defSpringPwr 4.17 px/f (both colours), or boostSpringPwr (red 8.33, green 22.9 px/f for Mario) only on a fresh jump press while on the spring, and the rise uses the hero's own gravity (Mario 0.208 px/f²) instead of hold-gravity; the ll-12-3 column 73 to 98 jump was rechecked and still makes it.
