# Losing a life skips character select

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** any level; seen in 1-1 around columns 70-110
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Lose a life with lives remaining, for example by falling into the pit at column 86.

## Expected

As in the original Crossover, every death with lives left returns to the character select screen, so the player can switch heroes. Then the lives card shows and the player respawns at the checkpoint.

## Actual

The game goes straight to the "WORLD 1-1 / x N" card and respawns the same hero at the checkpoint.

## How often

every time

## Notes

Ours: the death branch in `src/game/scenes/level.ts` calls `game.goToLevel` directly. The checkpoint, score and coins should be kept, as they are now. Two-player mode needs a decision on who picks.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — a death with lives left now goes to character select for the player who died (current hero preselected, picked hero starts small), then the lives card and the checkpoint, keeping score, coins and level, as in the original's Level.reloadLevel → ScreenManager.createLevel (newLev) → CharacterSelect; dev-mode starts and editor playtests keep the instant respawn.
