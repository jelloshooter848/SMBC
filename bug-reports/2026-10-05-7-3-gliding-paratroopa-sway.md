# 7-3: the sideways-flying green Paratroopas sway ±56 px with no bob; the original sways ±42.5 px and drifts ±8 px up and down

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 7-3, the sideways-flying green Paratroopas at column 137 (row 7) and column 153 (row 9). The same enemy is in 21 Lost Levels levels (list in Notes)
- **How to get there:** `?level=7-3&char=mario`, cross the bridges to column ~128 (after the midpoint at 114)
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=7-3&char=mario` and get to column ~128 (the bridge after the midpoint at 114).
2. Watch the green Paratroopa that flies back and forth around column 137.

## Expected

These are `enemyWingedKoopaHorizontalGreen` in `levelDataSmb.xml` (7-3, columns 137 and 153).
`com/smbc/enemies/KoopaGreen.as` (Flash px on 32 px tiles; our px = half):

- **Sideways:** `nx = centerX + sin(waveAngle) * waveRange` with `waveRange = 85` and `waveSpeed = 1.5`
  rad/s (lines 65-66 and 359-361). That is ±85 Flash px = ±42.5 px (about ±2.7 tiles), one cycle every
  2π / 1.5 = 4.19 s (251 frames), and 85 × 1.5 / 2 / 60 = 1.06 px/frame at the centre. It starts at its
  map spot moving right.
- **Up and down:** it also drifts between `y - TILE_SIZE/2` and `y + TILE_SIZE/2` at
  `HORZ_FLY_VERT_MOVEMENT_SPEED = 25` Flash px/s (lines 53, 181-183 and 366-369), i.e. ±8 px at
  0.21 px/frame, turning at each end (about 77 frames per 16 px leg). It starts moving up (line 183).
  `defyGrav = true` (line 93), so nothing else changes its height.

## Actual

`build/src/game/entities/enemies/koopa.ts` lines 27-28 and 261-268 (`fly()`, `glide` branch):
`homeX + sin(t * 2π / 256) * 56`, so ±56 px (3.5 tiles) with a 256-frame cycle, and `b.vy = 0`: its
height never changes. It reaches about 13.5 px further each way (about 30% wider) and flies a little
faster at the centre (56 × 2π / 256 = 1.37 vs 1.06 px/frame).

## How often

every time

## Notes

- Evidence: found by reading code. In ours the tester watched it from column 128 (test copy of 7-3 with
  only the start moved to 128,9; real level steps above): it holds one height while it sways about 3.5
  tiles each side of column 137. The original's 7-3 was played only to about column 16 (Ruffle too slow).
- Not the same as `2026-10-05-3-3-red-paratroopa-flight.md` (red vertical flyers, `FT_VERT`) or
  `2026-10-05-8-1-green-paratroopa-hops-low-and-short.md` (hopping green ones, `FT_JUMP`). All three are
  in `Koopa.fly()`, but each branch has its own constants.
- Levels with `enemyWingedKoopaHorizontalGreen` on the normal layer (our `koopa-para-green-h`, same
  places): SMB 7-3 (2) only. Lost Levels: ll-2-1, ll-2-3, ll-3-1, ll-3-3, ll-4-2, ll-5-3, ll-6-2, ll-6-3,
  ll-7-2, ll-7-3, ll-8-3, ll-8-4 (`ll-8-4-end2`), ll-9-1, ll-10-3, ll-11-1, ll-11-2, ll-11-3, ll-12-1,
  ll-12-2, ll-12-3 and ll-13-1.
- Source: `smb-w7/2026-10-05-7-3-gliding-paratroopa-sway.md`. The reviewer added the arithmetic, the
  start directions and the level list.
- Reviewed: verified against `com/smbc/enemies/KoopaGreen.as` (constructor, `setStats`, `checkState`),
  `levelDataSmb.xml` / `levelDataLostLevels.xml`, and ours: `src/game/entities/enemies/koopa.ts`
  (`GLIDE_AMPLITUDE`, `GLIDE_PERIOD`, `fly`), `src/content/levels/world7/7-3.map` lines 33-34.
