# Kicking a shell by landing on it scores 200; the original gives 500

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** 1-1, the Koopa at about column 107
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, big
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Stomp the Koopa so it becomes a shell.
2. Land on the still shell to kick it.

## Expected

As in the original (`data/ScoreValue.as`): a kick right after the stomp scores 500 (`KICK_SHELL_AFTER_STOMP`). The original also has `KICK_SHELL_NORMAL` 400, `KICK_SHELL_WHILE_LEGS_ARE_OUT` 500 and `KICK_SHELL_RIGHT_BEFORE_WALK` 1000.

## Actual

The "200" popup appears. Landing on a still shell goes through the stomp combo path. Only a kick from the side scores 400.

## How often

every time

## Notes

Ours: the stomp branch and the shell-kick branch next to each other in `src/game/world/world.ts`. Check the original's kick code for when each value applies.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — still shells (resting or legs out) are kicked, never stomped, and score as KoopaGreen.kickShell does: 1000 in the last 250 ms, 500 with legs out, 500 before landing after a stomp, else 400; shell timers now 3800/900/250 ms.
