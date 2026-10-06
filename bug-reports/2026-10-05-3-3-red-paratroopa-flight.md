# Red Paratroopas bob higher and faster than in the original

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 3-3, red Paratroopa at column 114, row 7. The same entity is in 1-3 at columns 74 and 114 (row 7).
- **How to get there:** `?level=3-3&char=mario`, go to column ~105
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Reach column 105 in 3-3 and watch the red Paratroopa at column 114.

## Expected

`com/smbc/enemies/KoopaGreen.as` lines 65-66 and 352-356 (`FT_VERT`, used for `enemyWingedKoopaRed`): `ny = centerY +
sin(angle) * 85`, `angle += 1.5 * dt`. At our scale that is ±42.5 px around its spot, one cycle every 4.19 s
(251 frames), top speed 1.06 px/frame.

## Actual

`src/game/entities/enemies/koopa.ts` lines 23-24 and 272-279 (`PARA_AMPLITUDE` 48, `PARA_PERIOD` 192): ±48 px, one cycle every 192 frames
(3.2 s), top speed 1.57 px/frame. It cycles about 1.3 times as often, moves up to about 1.5 times as fast, and goes 5.5 px further each way.

## How often

every time

## Notes

- Evidence: code reading only. Small difference, but it changes the timing of the jump across
  the gap at columns 112-118.
- 1-3's two red Paratroopas (`enemyWingedKoopaRed` at x=74 and x=114, y=7, shown on normal) are `koopa-para-red` in our `1-3.map` and use the same code; the 1-3 tester did not compare their flight.
- Reviewed: verified against `com/smbc/enemies/KoopaGreen.as` (`waveSpeed` 1.5, `waveRange` 85, `checkState` `FT_VERT`), `levelDataSmb.xml` (3-3 and 1-3), and ours: `src/game/entities/enemies/koopa.ts` (`fly`), `src/content/levels/world3/3-3.map`, `src/content/levels/world1/1-3.map`.
