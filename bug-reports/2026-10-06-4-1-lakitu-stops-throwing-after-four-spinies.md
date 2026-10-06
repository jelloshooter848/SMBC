# Regression: Lakitu never throws again once four of his Spinies have walked off screen

- **Severity:** wrong behaviour
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** 4-1 from column 20 (also 6-1, 8-2 and every Lost Levels Lakitu)
- **How to get there:** `?level=4-1&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Walk to column 20 and stand still.
2. Let Lakitu throw. Don't kill the Spinies; let them walk off the left of the screen.
3. Keep watching after the fourth throw.

## Expected

As fixed in `2026-10-05-lakitu-throw-rate-and-spiny-cap.md`: Lakitu throws every 105 frames, keeps up to 4 of his own Spinies out, and throws again as soon as one is gone.

## Actual

The first four throws come on time, at frames 293, 398, 503 and 608. After the fourth, Lakitu never throws again. For 18 s there was no Spiny on screen, and Lakitu stayed crouched in his waiting pose.

## How often

every time

## Notes

- This is a regression from the fix in `2026-10-05-lakitu-throw-rate-and-spiny-cap.md` (status: fixed). That report's other parts still work: the 105-frame rate and the cap of 4.
- Cause, by code: `World.cull()` (`src/game/world/world.ts` around lines 949-958) splices off entities that pass the left edge (`despawnMargin`) without calling `destroy()` or setting `alive = false`. `Lakitu` keeps its own `spinies` list and drops entries with `filter((e) => e.alive)` (`src/game/entities/enemies/lakitu.ts` lines 127-133). A culled Spiny is still `alive`, so it counts against the cap forever. The original removes them (`Spiney.cleanUp`).
- The same cause breaks the flying Bullet Bills: `2026-10-06-5-3-flying-bullet-bills-stop-after-scrolling.md`. Calling `e.destroy()` (or setting `alive = false`) in `cull()` before splicing probably fixes both.
- Found by the build review of V0.3.0-DEV.8F4BF1A. Measured with paused stepping. Screenshot names in the review: `1054_lak_nothrow1`, `1055_lak_nothrow2` (frame 2021). Screenshots are not committed, because the repo's `check:assets` bans image files.
