# Flying Bullet Bills (5-3) come from both sides at random heights, two at a time; the original sends one at a time from the right at the player's height

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 5-3, the whole `bullets` zone (columns 0 to 125); easiest to see standing at the start, column 2. The same code runs in every level with a `bullets` zone (see Notes).
- **How to get there:** `?level=5-3&char=mario&dev=1`, then stand still at the start
- **Character and power:** Mario, small (Dev assists: infinite lives and No damage)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open 5-3 and stand still at column 2.
2. Watch the Bullet Bills for about 15 seconds.

## Expected

The original's spawner (`com/smbc/level/BulletBillSpawner.as`):
- keeps only one flying Bullet Bill at a time (`curBulBill`), and starts the next one 250 ms (`DEL_DEFAULT`, line 17) after the last one is gone (`bulletBillDestroyed`, lines 85-93, called from `BulletBill.cleanUp`);
- always spawns it just off the right edge of the screen, flying left (lines 57 and 64: `xPos = level.locStgRht + BULLET_BILL_WIDTH/2`, `new BulletBill(xPos, yPos, false, ...)`);
- puts it at the player's own height plus or minus up to 2 tiles (line 58: `yPos = getNearestGrid(player.ny) + yNum*TILE_SIZE`, with `yNum` evenly from -2 to 2, lines 46-56), kept at least 3 tiles below the top of the screen and 1 tile above the bottom (lines 59-62).

Playtested in the original: standing at the start, every Bullet Bill came from the right at Mario's own height (ground level and the row above it), one at a time, and the first one killed him about 8 s of game time in (reviewer only: `shots/smb-w5/orig/221_sh.png` to `orig/244_sh.png`, and again `orig/247_q2.png` to `orig/255_q3.png`).

## Actual

Our spawner, `World.flyingBullets` (`src/game/world/world.ts` lines 732-750):
- restarts its timer every 90 to 179 frames (line 740) and spawns a new bill whenever fewer than two Bullet Bills are alive (lines 741-743), whether or not the last one is gone;
- spawns one in four from the left edge, flying right (line 744);
- picks a random row from 3 to 11 (line 745), wherever the player is.

Standing at column 2 for 16 s: most bills flew across rows 4 to 8, high above Mario, several came from the left, and two were on screen together several times. None of them came at Mario's height, so standing still was safe, unlike the original.

## How often

every time

## Notes

- Playtested in both games. Our screenshot: not committed (the repo's `check:assets` bans image files) (contact sheet, 0.4 s between frames).
- Levels with a `bullets` zone in our maps, which match the original's `bulletBillStart` tokens on the normal layer: 5-3, 6-3, ll-4-3, ll-5-3, ll-11-3 and ll-12-2. Only 5-3 was played.
- Our limit of two counts every live `BulletBill`, including blaster bills; the original's spawner counts only its own one bill.
- The flight speed is a separate report: `2026-10-05-bullet-bill-too-slow.md`.
- Source: `smb-w5/2026-10-05-5-3-flying-bullet-bills.md`.
- Reviewed: verified against `com/smbc/level/BulletBillSpawner.as` (`DEL_DEFAULT`, `respawnTmrHandler`, `bulletBillDestroyed`), `com/smbc/enemies/BulletBill.as` (`cleanUp`), `levelDataSmb.xml` (`<LEVEL ID="5-3">` `bulletBillStart` at column 0, `bulletBillEnd` at 126) and ours: `src/game/world/world.ts` (`flyingBullets`), `src/content/levels/world5/5-3.map` (`bullets 0 126`).
