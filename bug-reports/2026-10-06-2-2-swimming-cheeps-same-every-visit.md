# Swimming Cheep Cheeps' random colours and positions are the same on every visit

- **Severity:** wrong behaviour
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** 2-2 and 7-2 (every water level with swimming Cheep Cheeps)
- **How to get there:** `?level=2-2&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Load 2-2 and note which Cheep Cheeps are red and where each one starts.
2. Reload 2-2, or play it again, and compare.

## Expected

As fixed in `2026-10-05-water-swimming-cheep-setup-and-motion.md`: each swimming Cheep Cheep is red or grey 50/50, swims straight or on a ±1-tile wave, and starts up to ±2 tiles from its map spot, with a new mix on every visit.

## Actual

The randomness works, but two loads of 2-2 gave an identical school: the same colours, the same wave or straight fish, the same start positions. 7-2 is also the same on every visit, and it uses the same seed as 2-2.

## How often

every time

## Notes

- This is what's left of `2026-10-05-water-swimming-cheep-setup-and-motion.md` (status: fixed).
- Cause, by code: `src/game/world/world.ts` around line 208 seeds the world RNG with `new Rng(level.id.length * 7919 + 1)`. `placeSwimmer` runs at level load, so the result depends only on the length of the level id. Every level whose id has the same length shares a seed (2-2 and 7-2, for example), and share-link copies match the real level.
- A fix could seed from a run-time value, such as the clock or a counter kept in the game state, or seed only the swimmer setup that way. Check first whether anything else relies on the world RNG being repeatable, such as replays or tests.
- Found by the build review of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: `060_share` vs `064_share`, `061_fishA` vs `065_fishB`. Not committed (`check:assets` bans image files).

Status: fixed — the world RNG now takes `WorldStart.seed`, and a world built in play without one gets a fresh run-time seed (Math.random mixed with a visit counter), so every visit to 2-2 or 7-2 gets a new school. Nothing else relied on it being repeatable (there are no replays; share links carry only the map). `runSim` passes the old fixed per-level seed by default, or its own `seed` option, so the headless sims stay deterministic. Tests: tests/sim/water-enemies.test.ts, "a new school on every visit".
