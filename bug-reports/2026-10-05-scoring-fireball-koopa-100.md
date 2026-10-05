# Killing a Koopa with a fireball scores 100; the original gives 200

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** 1-1, the Koopa at about column 107
- **How to get there:** `?level=1-1&char=mario&kit=full`, or take the fire flower from the ? block at column 78 while big
- **Character and power:** Mario, fire
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Shoot the Koopa with a fireball.

## Expected

As in the original (`data/ScoreValue.as`: `KOOPA_ATTACK = 200`, `KOOPA_STAR = 200`): 200 points.

## Actual

The "100" popup appears.

## How often

every time

## Notes

Ours: Koopas fall back to the default `scoreValue = 100` in `src/game/entities/enemies/enemy.ts`. Worth checking the other `*_ATTACK` and `*_STAR` values in the original's `ScoreValue.as` against ours at the same time.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — enemies now score per kill kind from ScoreValue.as (Koopa fireball/star 200, paratroopa stomp 400, Bowser hit-point kill 5000, etc.) via Enemy.scores/scoreFor and src/game/rules/score.ts.
