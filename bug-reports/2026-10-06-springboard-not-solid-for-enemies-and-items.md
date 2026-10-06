# Enemies and items pass through springboards; the original's treat a springboard as solid ground

- **Severity:** wrong behaviour
- **Build:** after commit 34dc636 (springboard port)
- **Where:** every springboard, red and green (44 in all; list in `2026-10-05-springboard-not-solid-and-one-tile-tall.md`). Most likely seen where a spring stands on open ground with walkers around it, for example 5-2 (column 25), 2-1 (column 188) and ll-4-3 (column 26).
- **How to get there:** `?level=5-2&char=mario`, and watch a Goomba or Koopa walk towards the springboard at column 25, or knock a mushroom out of a block so that it slides into a spring.
- **Character and power:** any
- **Input:** keyboard
- **Browser and device:** found by reading code (agent F, gauntlet round on the PR #27 reports); not playtested

## Steps

1. Let an enemy (Goomba, Koopa, shell) or a moving item (mushroom, star) reach a springboard from the side.
2. Let one fall onto a springboard from above.

## Expected

The springboard is ordinary solid ground for everything that isn't a hero:

- `com/smbc/ground/SpringRed.as` `SpringRed extends Ground`, with its two-tile hit box from `setColPoints` (lines 45-60).
- `com/smbc/main/AnimatedObject.as` `groundBelow` (line 443): `if (!(g is SpringRed) || !(this is Character)) onGround = true;`. A non-character that lands on a spring just stands on it. Only a `Character` gets `sprBounce` and `onSpring` (lines 463-474).
- A side hit goes through `AnimatedObject.hitGround` to the object's `groundOnSide`, which turns walkers around (`Enemy.groundOnSide`) and stops or reverses items.

## Actual

Since commit 34dc636 the springboard is a solid two-tile box for players only (`Spring.block`, called from `World` for each player). Enemies, shells and items move with the tile map alone (`moveX`/`moveY` in `src/game/entities/body.ts`). Nothing in `World` checks them against `Spring` entities, so they walk, slide and fall straight through springboards.

## How often

every time (by code)

## Notes

- Fix idea: give `Spring` a generic `blockBody(body)` (the side and top parts of `block`, without the ride) and call it for enemies and items in the world's entity loop. Alternatively mark the spring's own map cell as solid for non-player movement (it is always occupied: the spring squashes to one tile, never less), and handle the upper half in the entity check.
- Split out of `2026-10-05-springboard-not-solid-and-one-tile-tall.md`, which is partly fixed (player collision only).
