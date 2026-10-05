# Bumping a Koopa or Spiny from below kills it; the original doesn't

- **Severity:** wrong behaviour
- **Build:** 41a9fb2 (code review, not playtested)
- **Where:** any level where a Koopa or Spiny walks over a brick or ? block
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** any character that can bump blocks
- **Input:** keyboard
- **Browser and device:** n/a (found reading the code)

## Steps

1. Wait for a Koopa (or a Spiny) to walk over a block.
2. Bump the block from below.

## Expected

As in the original:
- `KoopaGreen.gBounceHit` flips the Koopa up into its shell: `vy = -BOUNCE_AMT` (350), `BOUNCE_GRAVITY` 1500, then `enterShell()`. It doesn't die and scores nothing, since this override doesn't call `Enemy.gBounceHit`, which would pop the score.
- `Spiney.gBounceHit` only bounces the Spiny up (and reverses it when it is left of the block's middle). It doesn't die and scores nothing.

## Actual

Both are knocked out (the `bump` reaction is `kill`) and score their BELOW value, 100.

## How often

every time

## Notes

Ours: `BASIC_VULNERABILITY.bump` is `'kill'` for both, and `World.strikeBlock` scores `scoreFor('bump')`. Buzzy Beetles extend `KoopaGreen` in the original, so the same applies to them. Follow-up from the review of the kill-scoring fix (`2026-10-05-scoring-fireball-koopa-100.md`).
