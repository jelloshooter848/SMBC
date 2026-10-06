# Balance lifts sit 16 px right of the original; at its low point the 3-3 left lift overlaps a mushroom

- **Severity:** cosmetic
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** 3-3 left balance lift (around column 82-84); probably every `balance` lift (for example 4-3)
- **How to get there:** `?level=3-3&char=mario`, play to column 79 (or use a copy of 3-3 with `start: 83,3`)
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Stand on the left balance lift in 3-3 until it reaches the bottom.
2. Look at where the plank sits against the mushroom top at column 84.

## Expected

As the original places every `Platform`, including `type=Pully` balance lifts: centred on its cell (`Level.as` lines 1205-1207, `currentX + TILE_SIZE/2`). So the 3-3 left lift spans x 1296-1344.

## Actual

Ours puts the lift's left edge on the cell (`BalanceLift`, `src/game/entities/objects/balance-lift.ts`), so the 3-3 left lift spans x 1312-1360, 16 px right. At its low point (y 176) it overlaps the mushroom top at column 84 by 16 px, and the plank is drawn over the mushroom.

## How often

every time

## Notes

- The converter fix in `2026-10-05-converter-ignores-shiftup-shiftright.md` centred sideways and vertical lifts but left balance lifts out.
- It doesn't block play: the balance lift motion and the 1000-point snap work (`2026-10-05-3-3-balance-lift-motion.md` and `2026-10-05-3-3-balance-lift-no-1000-points.md` verified).
- Found by the build review of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: `150_b0`, `182_bc13`. Not committed (`check:assets` bans image files).
