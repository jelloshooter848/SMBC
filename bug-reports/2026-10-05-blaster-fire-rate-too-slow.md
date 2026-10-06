# Bullet Bill blasters fire every 2.5-4.5 s; the original fires every 1.0-3.5 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every blaster. Seen in 5-1 at column 111 (also the blasters at columns 159 and 170).
- **How to get there:** `?level=5-1&char=mario&dev=1`, walk to column 104 and stand still
- **Character and power:** Mario, small (Dev assists: infinite lives and No damage, so the bullets pass through)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open 5-1 and walk to column 104, 7 tiles left of the blaster at column 111.
2. Stand still and note when each Bullet Bill leaves the barrel.

## Expected

`com/smbc/ground/Canon.as` lines 23-24 and 42-46, 92-93: each blaster waits a random `SHOOT_TMR_DUR_MIN` 1000 to `SHOOT_TMR_DUR_MAX` 3500 ms, both before its first shot and after every attempt, so a shot every 1.0 to 3.5 s (2.25 s on average). (It skips a shot while the player is within 2 tiles of it or while two blaster Bullet Bills are already out; see Notes.)

Playtested in the original: standing about 5 tiles left of the same blaster, 13 shots in about 23 s of game time (HUD timer 233 to 175, at 397 ms per unit). The gaps were about 1.4 to 2.7 s, mostly 1.4 to 1.9 s.

## Actual

`BulletLauncher.update` (`src/game/entities/enemies/bullet-bill.ts` lines 58-73) restarts its timer at `FIRE_MIN + rng.int(FIRE_SPREAD)` = 150 to 269 frames (2.5 to 4.5 s, 3.5 s on average; lines 9-10 and 60). The first shot comes after a fixed `60 + (column × 37) % 90` frames (line 55) counted from the level start, because every launcher is created when the level loads (`src/game/world/world.ts` line 230). For the blaster at column 111 that is 117 frames.

Measured at column 104: shots left the barrel at about 2.3 s, 5.6 s and 8.9 s of game time, gaps of 3.3 s and 3.2 s. In 12 s we got 3 shots; the original gets about 6 to 7. On average ours fires about two-thirds as often (one shot per 3.5 s against one per 2.25 s), and its shortest gap (2.5 s) is longer than most of the original's gaps.

## How often

every time

## Notes

- Playtested in both games. Original screenshots of the measurement (reviewer only): `shots/smb-w5/orig/069_ds.png` to `orig/138_ds.png`.
- The original's two-bullet limit is a separate report: `2026-10-05-blaster-no-two-bullet-limit.md`. The Bullet Bill flight speed is also a separate report: `2026-10-05-bullet-bill-too-slow.md` (split out of this report's Notes by the reviewer).
- Both games hold fire while the player is close: the original within 2 tiles of the blaster's centre (`STOP_SHOOT_DIST`, line 27), ours within 32 px (`bullet-bill.ts` line 68).
- Source: `smb-w5/2026-10-05-5-1-blaster-fire-rate.md`. The tester's title said "about half as often"; the reviewer replaced it with the timer ranges, which give about two-thirds on average.
- Reviewed: verified against `com/smbc/ground/Canon.as` (`SHOOT_TMR_DUR_MIN/MAX`, `initiate`, `shootTmrLsr`) and ours: `src/game/entities/enemies/bullet-bill.ts` (`FIRE_MIN`, `FIRE_SPREAD`, `BulletLauncher`), `src/game/world/world.ts` (launcher creation).
