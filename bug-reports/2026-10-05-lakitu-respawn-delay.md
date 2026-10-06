# A defeated Lakitu comes back after 7 s; the original waits about 16 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** 4-1, columns 19–208, and 6-1, columns 21–170 (any Lakitu zone; also 8-2)
- **How to get there:** `?level=4-1&char=mario`
- **Character and power:** Mario, any
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=4-1&char=mario` and walk right until Lakitu arrives.
2. Defeat Lakitu (stomp him from the top of a pipe, or with a fireball).
3. Stay inside the zone and time how long until a new Lakitu flies in.

## Expected

On NORMAL the original waits `spawnDelTmrDur = 40 * 397` ms = 15.88 s before sending the next Lakitu
(LakituSpawner.as line 14 and lines 28–41: 48 × 397 ms = 19.1 s on EASY, 16 × 397 ms = 6.4 s on HARD). The
timer is a millisecond `CustomTimer`, and 397 ms is one unit of the HUD's TIME (`StatManager.TIME_LEFT_INT = 397`), so the delay is 40 TIME units. It starts once the dead Lakitu
has been cleaned up (removed from `ENEMY_DCT` in `Lakitu.cleanUp`, after its death fall) and only while the
player is inside the zone, and the new Lakitu is only sent if the player is still inside the zone when the
timer ends (lines 47–62).

## Actual

Ours sends the next Lakitu `RESPAWN_FRAMES = 420` frames (7.0 s) after the previous one was defeated: the
counter is set when a Lakitu is sent and only counts down while no Lakitu is alive, and a stomped or shot
Lakitu is destroyed at once and replaced by a corpse (`src/game/entities/enemies/lakitu.ts` line 12 and
lines 119–125, `LakituZone.update`; `Enemy.flipOut` in `src/game/entities/enemies/enemy.ts`). That is less
than half the original's breathing room after a Lakitu kill.

## How often

every time (by code)

## Notes

- Found by reading code in both games. Neither tester (smb-w4 in 4-1, smb-w6 in 6-1) managed a Lakitu kill in
  the original (small Mario, and the original runs very slowly in Ruffle), so the 15.9 s is from the source and
  the 7 s from ours, not timed.
- Merged from `smb-w4/2026-10-05-lakitu-respawn-delay.md` (4-1) and the respawn half of
  `smb-w6/2026-10-05-6-1-lakitu-arrives-early-and-returns-fast.md` (6-1; its arrival half is in
  `2026-10-05-4-1-lakitu-appears-before-start-column.md`). Both cite the same constants.
- Reviewed: verified against `com/smbc/level/LakituSpawner.as`, `com/smbc/level/EnemySpawner.as`, `com/smbc/enemies/Lakitu.as` (`cleanUp`), `com/smbc/managers/StatManager.as` (`TIME_LEFT_INT`), `com/explodingRabbit/utils/CustomTimer.as`, and ours: `src/game/entities/enemies/lakitu.ts`, `src/game/entities/enemies/enemy.ts`
