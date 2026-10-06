# Regression: flying Bullet Bills stop for good if one is removed while the screen is scrolling

- **Severity:** wrong behaviour
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** 5-3 Bullet Bill zone from column 2 (also 6-3 and every Lost Levels flying-bill zone)
- **How to get there:** `?level=5-3&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Wait about 1.6 s for the first flying Bullet Bill.
2. As it leaves on the left, walk right for about 2 s, from column 2 to column 13.
3. Stand still inside the zone.

## Expected

As fixed in `2026-10-05-flying-bullet-bills-wrong-pattern.md`: one bill at a time, from the right edge at the player's height ±2 tiles. The next one comes 15 frames after the last is gone.

## Actual

No more bills come: none in the next ~1000 frames (16 s). Standing still from the start, the pattern is correct: 0 or 1 bills in 320 samples, and the next bill about 42 frames after the last left.

## How often

every time, if the screen is scrolling as a bill leaves; in normal play that's most of the time

## Notes

- This is a regression from the fix in `2026-10-05-flying-bullet-bills-wrong-pattern.md` (status: fixed).
- Cause, by code: `World.cull()` (`src/game/world/world.ts` around lines 949-958) splices off entities that pass the left edge (`despawnMargin`) without calling `destroy()` or setting `alive = false`. `BulletBill.update` checks `camera.x - 32` before `camera.follow`, while `cull()` runs after it. A bill that crosses in between is removed with `alive` still true, so `World.flyingBill` (world.ts around lines 904-917) is never cleared, and the spawner waits for it forever.
- Same root cause as `2026-10-06-4-1-lakitu-stops-throwing-after-four-spinies.md`, so one fix in `cull()` probably covers both.
- Found by the build review of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: `flybill_cull_sheet.png`, `2417_c53long` (frame 1230). Not committed (`check:assets` bans image files).

Status: fixed — `World.cull()` now calls `destroy()` on anything it drops off the left of the screen, so a bill culled while the screen scrolls is seen as gone and the spawner sends the next one 15 frames later. Test: tests/sim/enemy-ai-original.test.ts, "Culled off the left of the screen".
