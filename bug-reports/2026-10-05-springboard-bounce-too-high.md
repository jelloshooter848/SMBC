# Springboard bounce without the jump button goes 5.8 tiles high; the original's goes about 2.7 tiles

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every red springboard. Seen in 5-2, the springboard at column 25, row 12, and in 2-1, the springboard at column 188.
- **How to get there:** `?level=5-2&char=mario&dev=1`, climb the starting staircase, go down the far side and hop onto the springboard
- **Character and power:** Mario, small (Dev assists: infinite lives and No damage)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Hop onto the springboard at column 25 and do not press jump while it compresses.
2. Note how high Mario goes (F1 shows his y).
3. Repeat, this time pressing jump while it compresses.

## Expected

`com/smbc/ground/SpringRed.as` lines 19-20 and 61-80 (`springLaunch`): the spring launches Mario at `defSpringPwr = 500` px/s, or at `boostSpringPwr = 1000` px/s if jump was pressed while on the spring (`Character.pressJmpBtn` sets `springBoost`). The launch does not start a held jump, so Mario rises under his normal `GRAVITY = 1500` px/s² (`com/smbc/characters/Mario.as` line 47). On the original's 32 px tiles that is a rise of 500²/(2 × 1500) = 83 px = 2.6 tiles without jump and 1000²/(2 × 1500) = 333 px = 10.4 tiles with jump.

Playtested in the original (5-2, column 25): with no jump pressed, Mario's head went from screen y 412 on the spring to 326 at the top of the bounce, 86 screen px = 43 game px = about 2.7 tiles (reviewer only: `shots/smb-w5/orig3/017_sh.png` to `orig3/023_sh.png`, 0.2 s wall time apart).

## Actual

`Spring.ride` (`src/game/entities/objects/spring.ts` lines 52-68) calls `Player.launch` with `SPRING_BOOST = 1.15`, or `SPRING_BOOST_HELD = 1.65` with jump held (lines 8-9). `Player.launch` (`src/game/entities/player.ts` lines 433-444) multiplies the standing jump's initial speed by that boost and sets `launched`, which makes the whole rise use the lighter held-jump gravity whether or not jump is held (lines 219-221; the comment says it "floats to its apex like a held jump").

Measured with F1 at column 25:
- No jump: Mario's top went from y 176 (on the spring) to y 83, a rise of 93 px = 5.8 tiles, more than twice the original's 2.7 tiles.
- Jump held: from y 180 to about y -13, a rise of about 193 px = 12 tiles, against 10.4 in the original.

So the plain bounce is about twice as high as it should be, and the boosted bounce is only about twice the plain one (about four times in the original).

## How often

every time

## Notes

- Playtested in both games for the bounce without jump. The boosted bounce in the original comes from its code only.
- Other levels with a red springboard on the normal layer (`levelDataSmb.xml`, `levelDataLostLevels.xml`, `springRed`): 2-1, 3-1, 5-2, 6-3, 7-1, 8-2, and in The Lost Levels ll-4-1, ll-4-2, ll-4-3, ll-7-3, ll-8-1, ll-8-2, ll-8-3, ll-9-3, ll-10-1, ll-10-2, ll-10-3, ll-12-3, ll-13-1, ll-13-2 and ll-13-3. The converter maps them all to our `spring` (`tools/levelgen/convert-smbc.mjs`). Only 5-2 and 2-1 were played (2-1 in ours only).
- 2-1 (smb-w2), ours only: the springboard at column 188 gave a peak 87 px above the plate with no jump and about 190 px with jump held, consistent with the 5-2 numbers here (93 px and 193 px). Shots: `gauntlet/shots/smb-w2/ours/155_sp1.png` to `160_sp6.png`, `162_sq1.png` to `169_sq8.png` and `170_sl1.png` to `179_sl10.png`; in `178_sl9.png` Mario is at y -12 with jump held. The original's 2-1 spring was not reached (the tester died near column 83 twice). Folded in from `review/smb-w2.md` during the smb-w7/w8 consolidation.
- The original's spring graphic is 2 tiles tall and ours 1 tile, but Mario stands at the same height on both (y 176), so the tester did not file that.
- Source: `smb-w5/2026-10-05-5-2-springboard-bounce-too-high.md`. The reviewer added the cause in `Player.launch` and the level list.
- Reviewed: verified against `com/smbc/ground/SpringRed.as` (`defSpringPwr`, `boostSpringPwr`, `springLaunch`), `com/smbc/characters/Character.as` (`pressJmpBtn`), `com/smbc/characters/Mario.as` (`GRAVITY`), and ours: `src/game/entities/objects/spring.ts`, `src/game/entities/player.ts` (`launch`).
