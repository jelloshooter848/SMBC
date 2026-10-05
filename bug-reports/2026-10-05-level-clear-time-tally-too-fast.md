# Time-to-score tally runs about four times faster than the original

- **Severity:** wrong behaviour
- **Build:** V0.1.0-11B3C46 (playtested); the code involved is unchanged on 9623e8a
- **Where:** end of any level with a flagpole; seen at 1-1
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, any
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Finish the level with time left.

## Expected

As in the original: about 30 TIME units per second, roughly one unit every two frames, at 50 points per unit.

## Actual

2 units per frame, about 120 per second. 262 units took about 2.2 seconds.

## How often

every time

## Notes

Ours: the `countdown` phase in `src/game/world/world.ts` (`Math.min(this.time, 2)` per frame). The original's rate was measured by wall clock. Confirm the exact rate in the original's source before changing ours, starting with `managers/StatManager.as` and the level-clear code.

Reference: the original's source at https://github.com/JayPavlina/super-mario-bros-crossover (paths under `src/`), compared with a playthrough of the original 3.1.21 in the Ruffle emulator.

Status: fixed — the tally now takes one TIME unit every two frames (~30/s) for 50 points each, per StatManager.convertTimeToScore (TIME_PT_VAL = ScoreValue.TIME_REMAINING); castle clears do not tally in the original (EventManager.enterLevelExit only converts on flagpole levels), as ours already did.
