# Bullet Bills fly at 1.25 px/frame; the original's fly at about 1.42 px/frame

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Bullet Bill, from blasters and from the flying-bill spawner. For example 5-1, the blaster at column 111, and 5-3 from column 0; also 7-1 (stacked blasters at columns 28, 56, 105 and 146).
- **How to get there:** `?level=5-1&char=mario&dev=1`, walk to column 104 and stand still
- **Character and power:** Mario, small (Dev assists: No damage, so the bullets pass through)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Walk to column 104 in 5-1 and wait for the blaster at column 111 to fire.
2. Time how long the Bullet Bill takes to fly 10 tiles (160 px).

## Expected

`com/smbc/enemies/BulletBill.as` line 35: `SPEED = 170` px/s, applied as `vx = ±SPEED` (lines 67 and 74). On the original's 32 px tiles that is 85 px/s at our 16 px scale, or 1.42 px per frame at 60 fps: 10 tiles in about 113 frames (1.9 s). The flying Bullet Bills of `BulletBillSpawner.as` use the same class and speed.

## Actual

`BULLET_SPEED = 0x01400` = 1.25 px per frame (`src/game/entities/enemies/bullet-bill.ts` line 8, used at line 26 and by the flying-bill spawner in `src/game/world/world.ts` line 748): 10 tiles in 128 frames (2.1 s). Ours is about 12% slower.

## How often

every time

## Notes

- Found by reading the code of both games only. The tester could not measure the original's speed reliably because Ruffle's frame rate varied, and did not time ours.
- 7-1 (smb-w7), what it means in play: a Bullet Bill flying right behind a walking Mario keeps pace with him in the original and falls behind in ours. The original's `BulletBill.SPEED = 170` is close to `MarioBase.MAX_WALK_SPEED = 175` (line 80), 1.42 vs 1.46 px/frame at our scale. Ours is 1.25 px/frame against Mario's `maxWalk = 0x01900` = 1.5625 px/frame (`src/game/characters/mario/profile.ts` line 15), so the bill drops back about 0.31 px/frame (19 px/s). The tester saw two bills stay roughly level with a walking Mario across three screenshots of the original's 7-1 (`gauntlet/shots/smb-w7/orig/024_m0.png` to `026_m2.png`, reviewer only; the reviewer could only confirm roughly, as the camera also moves). Ours by code and the tester's note. Source: `gauntlet/notes/smb-w7.md`, folded in during the smb-w7/w8 consolidation.
- Split by the reviewer from the Notes of `smb-w5/2026-10-05-5-1-blaster-fire-rate.md` (one bug per file). Related: `2026-10-05-blaster-fire-rate-too-slow.md`.
- Reviewed: verified against `com/smbc/enemies/BulletBill.as` (`SPEED` 170, constructor) and ours: `src/game/entities/enemies/bullet-bill.ts` (`BULLET_SPEED`), `src/game/world/world.ts` (`flyingBullets`).

Status: fixed — `BULLET_SPEED` is now 0x016ab = 1.42 px/frame (`BulletBill.SPEED` 170 px/s halved), used by blaster and flying bills alike.
