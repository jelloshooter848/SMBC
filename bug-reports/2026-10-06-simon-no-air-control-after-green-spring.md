# Simon can't steer after a green springboard launch, so the long green-spring gaps can't be crossed with him

- **Severity:** wrong behaviour
- **Build:** after commit 34dc636 (springboard port)
- **Where:** every green springboard used as a long jump: ll-7-3 and ll-12-3 (springs at columns 21, 50, 73, 99, 137, 196 and 233), also ll-2-1, ll-3-1, ll-3-3, ll-11-1, ll-11-3 and ll-12-2.
- **How to get there:** `?level=ll-12-3&char=simon`, reach the green springboard at column 73 (on the treetop at columns 71-74).
- **Character and power:** Simon, any
- **Input:** keyboard
- **Browser and device:** found by reading code (agent F, gauntlet round on the PR #27 reports); not playtested

## Steps

1. In ll-12-3 as Simon, land on the green springboard at column 73 and press jump while it squashes.
2. Hold right while he is in the air, aiming for the treetop at columns 98-100 (25 tiles away).

## Expected

Simon steers in the air until he lands, so he can reach the treetop.

- `com/smbc/characters/Simon.as` `springLaunch` (lines 1314-1321) sets `launchedFromGreenSpring = true` when the spring `is SpringGreen`.
- The static getter `Simon.classicMode` (lines 1336-1341) returns `false` while the player is a Simon with `launchedFromGreenSpring` and the game is in `GS_PLAY`.
- `Simon.movePlayer` (line 531) only applies left/right in the air when `!classicMode` (`if (onGround || (!classicMode))`), so after a green spring launch he gets full air control.
- `Simon.landOnGround` (lines 965-971) clears `launchedFromGreenSpring`, so the committed classic jump arc comes back on the next landing.

## Actual

`src/game/characters/simon/index.ts` line 28 sets `airControl: 'none'` ("the jump arc is committed at takeoff"), and nothing changes it after a spring launch. `Player.springLaunch` (`src/game/entities/player.ts`) only sets the launch speed and rise gravity. Simon keeps whatever horizontal speed he had when he landed on the spring (usually 0), so he goes straight up and comes back down on the spring or in the pit. The green-spring gaps in ll-7-3 and ll-12-3 can't be crossed with him.

## How often

every time (by code)

## Notes

- Fix idea: in `Player.springLaunch` (or Simon's behaviour hook), let a launch from a green spring switch Simon to air control until he next lands. `Spring.ride` knows `this.green` and can pass it on.
- The original also gives Simon `boostSpringPwr = 4250` on a green spring (`SpringGreen.as`), which `SPRING_GREEN_BOOST.simon` already uses.
- Not filed as a separate earlier report. Found while reviewing the springboard port (`2026-10-05-springboard-bounce-too-high.md`).
