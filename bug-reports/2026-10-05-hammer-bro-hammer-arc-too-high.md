# Hammer Bros lob their hammers 3 to 5 tiles high; the original throws them in a low, flat arc

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 3-1, the Hammer Bros on the brick rows, columns 111-121 (one starts at column 113 on the row-9 bricks, one at column 116 on the ground)
- **How to get there:** `?level=3-1&char=mario`, run to column 104 (stand on the pipe at columns 103-104) and watch
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=3-1&char=mario` and go to column 104 (the pipe top before the Hammer Bros).
2. Stand still and watch the hammers for a few seconds (F1 shows the rows).

## Expected

As in the original: each hammer leaves from just above the Hammer Bro's head and flies in a low, flat
arc at a fixed horizontal speed. `com/smbc/projectiles/Hammer.as` lines 36-38: `xSpeed = 120`,
`jumpPwr = 200`, `gravity = 500` (original pixels, 32 per tile, per second). In our units that is
1.0 px/frame across and 1.67 px/frame up with 0.069 px/frame² gravity, so the hammer rises only
about 20 px (1.25 tiles) above where it is thrown before dropping.

## Actual

Our hammers are lobbed high: `src/game/entities/enemies/hammer-bro.ts` lines 106-107 give each
hammer vx 0.75-1.25 px/frame and vy -3.5 to -4.5 px/frame, with HAMMER gravity 0.125 px/frame²
(`projectile.ts` line 145). They rise 49-81 px (3-5 tiles). With the Hammer Bro on the row-9
bricks the hammers fly through rows 3-5, above the upper brick row (screenshot). In the original
(Ruffle, All Hammer Bros cheat, same 3-1 bricks) the hammers stayed about one tile above the
thrower's head.

## How often

every time

## Notes

- Evidence: playtested in both games and read in code. Original screenshot for the reviewer:
  `shots/smb-w3/orig/067_hb1.png` (hammers drawn as eggs by the SMB2 skin; the Hammer Bro shows
  as Birdo). To get a Hammer Bro on screen quickly in the slow emulator I used the original's
  All Hammer Bros cheat, which only swaps which enemy class spawns (`Level.as` line 899) and does
  not change `Hammer.as`.
- Our screenshot: not committed (the repo's `check:assets` bans image files) (three hammers at rows 3-5).
- Bowser's hammers (6-4, 7-4, 8-4 and the Lost Levels hammer Bowsers) have the same high arc in ours, but
  from a separate copy of the throw: `src/game/entities/enemies/bowser.ts` lines 116-117 give vx 0.625-1.37
  and vy -3.5 to -4.5 px/frame with the same `HAMMER` projectile. A fix only to `hammer-bro.ts` misses him.
  The original's Bowser throws the same `Hammer.as`. Seen in 6-4 by the smb-w6 tester; folded in from
  `review/smb-w6.md` during the smb-w7/w8 consolidation. `2026-10-05-bowser-hammers-in-volleys.md` notes
  this too.
- Reviewed: verified against `com/smbc/projectiles/Hammer.as` (`xSpeed` 120, `jumpPwr` 200, `gravity` 500, 32 px tiles: rise 40 px, 20 px at our scale) and ours: `src/game/entities/enemies/hammer-bro.ts` `throwHammer()` (vx 0.75-1.25, vy -3.5 to -4.5 px/frame) with `HAMMER.gravity` 0x00200 in `src/game/entities/projectiles/projectile.ts`. The screenshot HUD reads WORLD 1-1 because it was taken in a share-link copy of 3-1.

Status: fixed — the `HAMMER` spec now flies 1.0 px/frame across and 1.67 px/frame up under 0.069 px/frame² (`Hammer.as` `xSpeed` 120, `jumpPwr` 200, `gravity` 500), thrown from beside the head (`nx ± hWidth*.75`, `ny - height*1.2`), rising about 20 px; Bowser still passes his own vx/vy in `bowser.ts`, which the Bowser report's fix should drop to use the spec.
