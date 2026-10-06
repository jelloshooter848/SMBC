# More than two blaster Bullet Bills can be out at once; the original allows two in the whole level

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every level with two or more blasters. Seen in 5-1, standing on the exit pipe at column 163, between the blasters at columns 159 and 170.
- **How to get there:** `?level=5-1-bonus&char=mario&dev=1`, walk right into the side pipe; you come out on top of the pipe at column 163 of 5-1 with both blasters on screen
- **Character and power:** Mario, small (Dev assists: infinite lives and No damage)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Load the 5-1 bonus room and take the side pipe out. You stand on the pipe at column 163.
2. Stand still for about 20 seconds and count the Bullet Bills on screen.

## Expected

At most two blaster Bullet Bills in the level at a time. `com/smbc/ground/Canon.as` keeps every live blaster Bullet Bill in the static (shared by all blasters) `BILL_DCT` (line 21) and only fires when `BILL_DCT.length < MAX_BULLET_BILLS` (2) (lines 25 and 52). A bill leaves the list when it is cleaned up (`com/smbc/enemies/BulletBill.as` `cleanUp`, lines 149-155). A shot that hits the limit is skipped and the blaster waits for its next 1.0-3.5 s timer.

## Actual

Each `BulletLauncher` (`src/game/entities/enemies/bullet-bill.ts` lines 43-76) fires on its own timer with no shared limit. In 18 s on the pipe there were three Bullet Bills on screen at once (frames 303 to 305 of the run, about 7.8 to 8.1 s in; screenshot). Two were flying right, away from column 159 (one had already passed Mario, who had No damage on), and one was flying left from column 170. Two at once was seen most of the time.

## How often

every time (3 at once seen once in 18 s; 2 at once most of the time)

## Notes

- Found by reading the original's code, and playtested in our game only. The tester could not reach column 163 in the original (Ruffle ran at about a sixth of real speed).
- 7-1 (smb-w7): three blaster Bullet Bills on screen at once near column 143 in ours, with Mario jumping past the blasters (share-link copy of 7-1, so the HUD reads WORLD 1-1): `gauntlet/shots/smb-w7/ours/181_shot.png` (reviewer checked: three bills). 7-1 has stacked blasters at columns 28, 56, 105 and 146. Source: `gauntlet/notes/smb-w7.md`, folded in during the smb-w7/w8 consolidation.
- Our screenshot: not committed (the repo's `check:assets` bans image files) (three bills at once).
- The tester wrote that two of the bills came from column 170 flying left and right. Our launcher always fires toward the nearest player (lines 65-69), and Mario at column 163 is left of column 170, so both right-facing bills in the screenshot came from column 159; the reviewer corrected this.
- The 5-3 flying Bullet Bills come from a separate spawner with its own one-at-a-time rule (`com/smbc/level/BulletBillSpawner.as`), see `2026-10-05-flying-bullet-bills-wrong-pattern.md`. Our flying-bill spawner counts every live `BulletBill` toward its own limit of two (`src/game/world/world.ts` lines 741-743), but the launchers do not.
- Related: `2026-10-05-blaster-fire-rate-too-slow.md`.
- Source: `smb-w5/2026-10-05-5-1-blaster-no-two-bullet-cap.md`.
- Reviewed: verified against `com/smbc/ground/Canon.as` (`BILL_DCT`, `MAX_BULLET_BILLS`, `shootTmrLsr`), `com/smbc/enemies/BulletBill.as` (`cleanUp`) and ours: `src/game/entities/enemies/bullet-bill.ts` (`BulletLauncher.update`).
