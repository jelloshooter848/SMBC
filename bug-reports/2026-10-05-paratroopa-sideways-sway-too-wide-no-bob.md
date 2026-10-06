# Sideways-flying green Paratroopas sway ±56 px and never move up or down; the original sways ±42.5 px and drifts ±8 px vertically

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every sideways-flying green Paratroopa (our `koopa-para-green-h`, the original's `enemyWingedKoopaHorizontalGreen`). Playtested in ll-3-1 at column 156, row 9 (over the pit at columns 154-157, just before the green springboard at 160) and watched in 7-3 at column 137, row 7 (also 153, row 9). Also ll-3-3 at column 25, row 3, and the other levels listed in Notes
- **How to get there:** `?level=ll-3-1&char=mario&dev=1`, then go to column 150 and wait. Or `?level=7-3&char=mario`, cross the bridges to about column 128 (after the midpoint at 114) and watch the Paratroopa around column 137
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=ll-3-1&char=mario&dev=1` and press F1. Go to column 150 (F1: `tile 150,12`, x 2402) and stand still.
2. Watch the green Paratroopa over the pit at columns 154-157 for about 5 seconds.
3. Optionally, repeat in 7-3 from column 128 with the Paratroopa at column 137.

## Expected

`com/smbc/enemies/KoopaGreen.as`, fly type `FT_HORZ` (Flash px on 32 px tiles; our px = half):

- **Sideways:** `nx = centerX + sin(waveAngle) * waveRange` with `waveRange = 85` and `waveSpeed = 1.5`
  rad/s (lines 65-66 and 357-361). That is ±85 Flash px = ±42.5 px (about ±2.7 tiles, 85 px end to end),
  one cycle every 2π / 1.5 = 4.19 s (251 frames), and 85 × 1.5 / 2 / 60 = 1.06 px/frame at the centre.
  It starts at its map spot moving right.
- **Up and down:** it also drifts between `y - TILE_SIZE/2` and `y + TILE_SIZE/2` at
  `HORZ_FLY_VERT_MOVEMENT_SPEED = 25` Flash px/s (lines 53, 176-183 and 366-369), i.e. ±8 px at
  0.21 px/frame, turning at each end (about 77 frames per 16 px leg, a full bob every 2.56 s). It starts
  moving up (line 183). `defyGrav = true` (line 93), so nothing else changes its height.

## Actual

`src/game/entities/enemies/koopa.ts` lines 27-28 (`GLIDE_AMPLITUDE = 56` px, `GLIDE_PERIOD = 256` frames)
and lines 261-268 (`fly()`, `glide` branch): `homeX + sin(t * 2π / 256) * 56` and `b.vy = 0`. So it
sways ±56 px (3.5 tiles, 112 px end to end) with a 256-frame cycle, and its height never changes. It
reaches about 13.5 px further each way (about 30% wider) and flies a little faster at the centre
(56 × 2π / 256 = 1.37 vs 1.06 px/frame).

Measured in ll-3-1 (40 screenshots 125 ms apart): the sprite's left edge went from screen x 384 to 620
at 2× scale, about 111 px of game space end to end by the tester's estimate (the code gives 112 px;
the original's swing is 85 px). Half a cycle took about 2.1 s, which matches the 256-frame period. The
sprite stayed at screen y 348-365 in all 40 shots, so there was no bob. In ll-3-1 the extra reach matters
because the Paratroopa patrols the pit at columns 154-157, right before the springboard.

## How often

every time

## Notes

- Evidence: ours playtested in ll-3-1 (measured, test copy of ll-3-1 with only the start moved to
  150,12; real level steps above) and watched in 7-3 (test copy with the start moved to 128,9): it holds
  one height while it sways about 3.5 tiles each side of its column. The original was found by reading
  code: the ll-w3 tester could not reach column 156 of the original's 3-1 in Ruffle, and the smb-w7
  tester played 7-3 only to about column 16.
- Not the same as `2026-10-05-3-3-red-paratroopa-flight.md` (red vertical flyers, `FT_VERT`) or
  `2026-10-05-8-1-green-paratroopa-hops-low-and-short.md` (hopping green ones, `FT_JUMP`). All three are
  in `Koopa.fly()`, but each branch has its own constants.
- Levels with `enemyWingedKoopaHorizontalGreen` on the normal layer (our `koopa-para-green-h`, same
  places): SMB 7-3 (columns 137 and 153) only. Lost Levels: ll-2-1, ll-2-3, ll-3-1 (156,9), ll-3-3 (25,3),
  ll-4-2, ll-5-3, ll-6-2, ll-6-3, ll-7-2, ll-7-3, ll-8-3, ll-8-4 (`ll-8-4-end2`), ll-9-1, ll-10-3,
  ll-11-1, ll-11-2, ll-11-3, ll-12-1, ll-12-2, ll-12-3 and ll-13-1.
- Screenshot: not committed (the repo's `check:assets` bans image files) (ours, ll-3-1 test copy, Mario at
  column 150 with the Paratroopa mid-swing over the pit; the HUD reads WORLD 1-1 because share-link
  copies start with world 1-1 state).
- Merged from `smb-w7/2026-10-05-7-3-gliding-paratroopa-sway.md` (7-3; this final was
  `2026-10-05-7-3-gliding-paratroopa-sway.md` until the ll-w3 to ll-w5 review renamed it) and
  `ll-w3/2026-10-05-ll-3-1-green-paratroopa-sway-too-wide-no-bob.md` (ll-3-1 measurements, ll-3-3).
  Reviewers added the arithmetic, the start directions and the level list.
- Reviewed: verified against `com/smbc/enemies/KoopaGreen.as` (constants at lines 53 and 65-66,
  constructor lines 176-183, `checkState` lines 357-369), `levelDataSmb.xml` (7-3) and
  `levelDataLostLevels.xml` (3-1 cell 156,9; 3-3 cell 25,3), and ours: `src/game/entities/enemies/koopa.ts`
  (`GLIDE_AMPLITUDE`, `GLIDE_PERIOD`, `fly`), `src/content/levels/world7/7-3.map` lines 33-34,
  `src/content/levels/lost/world3/ll-3-1.map` line 44, `ll-3-3.map` line 35.
