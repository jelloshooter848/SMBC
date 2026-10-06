# Green Paratroopas hop about 1.5 tiles high and 0.9 tiles forward; the original's hop about 2 tiles high and 1.25 tiles forward

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 8-1, the green Paratroopas at columns 161, 172 and 177. The same enemy is in 8-2 (columns 19, 22, 57, 66, 69, 92, 95, 139, 170, 172, 175, 203), 8-3 (30, 93) and 8-4 (150, 152, 166, 168), and in every other level with hopping green Paratroopas (list in Notes).
- **How to get there:** `?level=8-1&char=mario&dev=1` and run to column 154. For a faster test the tester loaded a copy of the real 8-1 map with only `start:` changed to `154,12` (share link in `gauntlet/notes/w8-81-154.url`).
- **Character and power:** Mario, small (no assists needed for this check)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open 8-1 and go to column 154 (F1 shows the column). Stand still.
2. Watch the Paratroopa that starts at column 161 as it hops towards you. Take a screenshot every 2 frames (33 ms).

## Expected

As in the original. In `com/smbc/enemies/KoopaGreen.as` an `enemyWingedKoopaGreen` has fly type `FT_JUMP`
(lines 83-88). Each time it lands it jumps again with `vy = -ySpeed` (line 378), where `ySpeed = 400`
(line 161) and `gravity = enemyGravDef` = 1300 (line 162; `Enemy.as` line 108). It walks at
`ENEMY_WALK_SPEED_NORMAL` = 65 (line 159; `Enemy.as` line 59). Movement is `ny += vy*dt` and
`vy += gravity*dt` (`AnimatedObject.as` `updateLoc` and `gravityPull`). The original uses 32 px per tile and
ours 16, so its values halve. In our units that is a take-off of 3.33 px/frame, gravity of 0.181 px/frame² and a
walk of 0.54 px/frame, which gives:

- hop height 3.33² / (2 × 0.181) = 30.8 px (1.9 tiles)
- time in the air 2 × 3.33 / 0.181 = 37 frames (0.62 s)
- distance per hop 37 × 0.54 = 20 px (1.25 tiles)

## Actual

`build/src/game/entities/enemies/koopa.ts` line 25 sets `PARA_HOP = 0x03800` (3.5 px/frame), used at
line 284, and the hop uses the normal enemy gravity `ENTITY_GRAVITY = 0x00400` (0.25 px/frame²,
`build/src/game/entities/entity.ts` line 20) and walk speed `walkSpeed = 0x00800` (0.5 px/frame,
`enemy.ts` line 49). That works out to 24.5 px high, 28 frames in the air and 14 px forward. Measured in
our game (45 screenshots 33 ms apart, `gauntlet/shots/smb-w8/ours/013_pk1.png` to `057_pk45.png`):

- hop height 24 px (1.5 tiles): the shell top goes from y 446 to y 398 on the 2x screenshot
- a landing every 14 screenshots, which is 28 frames (0.47 s)
- 14 px (0.9 tiles) forward per hop, at 0.5 px/frame

Our Paratroopas hop about 20% lower and 25% quicker, and cover 30% less ground per hop. That changes where
you can run under them and when to jump on them. This is noticeable in 8-1 and 8-2, where they guard the
gaps.

## How often

every time

## Notes

- Evidence: playtested in both games and read in code. In the original the tester watched the
  Paratroopas at the start of 8-2 (columns 19 and 22) in Ruffle (screenshots
  `gauntlet/shots/smb-w8/orig/115_oq1.png` to `164_oq50.png`, for the reviewer only). The shell's lowest
  point when landing was about y 469 and its highest about y 398 on the original's 512-pixel-wide screen
  (32 px per tile). That is a rise of about 66-71 original pixels (2.1-2.2 tiles), and about 45-50
  original pixels (1.4-1.5 tiles) forward between landings. This roughly matches the code values above.
  The sampling was coarse, because Ruffle ran at about 1/7 speed; only positions, not times, were taken
  from it.
- The walking speed is close (0.5 vs 0.54 px/frame). Mainly the hop height and air time differ.
- Not the same bug as `2026-10-05-3-3-red-paratroopa-flight.md` (red flyers that bob up and down) or
  `2026-10-05-paratroopa-sideways-sway-too-wide-no-bob.md` (sideways flyers; formerly `7-3-gliding-paratroopa-sway`).
- Levels with `enemyWingedKoopaGreen` on the normal layer (`levelDataSmb.xml`, `levelDataLostLevels.xml`):
  SMB 2-1, 3-1, 3-2, 5-1, 5-2, 6-2, 7-1, 7-3, 8-1, 8-2, 8-3 and 8-4; Lost Levels ll-1-1, ll-1-2, ll-2-1,
  ll-2-2, ll-2-3, ll-5-1, ll-6-1, ll-7-1, ll-7-2, ll-8-1, ll-8-2, ll-8-4, ll-9-1, ll-9-4, ll-10-1, ll-11-1,
  ll-11-2, ll-12-1, ll-13-1, ll-13-2, ll-13-3 and ll-13-4.
- Source: `smb-w8/2026-10-05-8-1-green-paratroopa-hops-low-and-short.md`. The reviewer added the
  `build/` paths, our walk-speed constant and the level list.
- Reviewed: verified against `com/smbc/enemies/KoopaGreen.as` (constructor, `setStats`, `checkState`),
  `com/smbc/enemies/Enemy.as` (`ENEMY_WALK_SPEED_NORMAL`, `enemyGravDef`), `com/smbc/main/AnimatedObject.as`
  (`updateLoc`, `gravityPull`), both level XMLs, and ours: `src/game/entities/enemies/koopa.ts`
  (`PARA_HOP`, `fly`), `src/game/entities/enemies/enemy.ts` (`walkSpeed`, `patrol`),
  `src/game/entities/entity.ts` (`ENTITY_GRAVITY`), `src/content/levels/world8/8-1.map` lines 39-41.

Status: fixed — hopping green Paratroopas now take off at 3.33 px/f and fall at 0.181 px/f² capped at 6.67 px/f (KoopaGreen FT_JUMP ySpeed 400, enemyGravDef 1300, enemyVYMaxPsvDef 800): 31 px high, 37 frames and about 18 px forward per hop (walk speed left at 0.5 px/f).
