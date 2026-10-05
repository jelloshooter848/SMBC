# A bumped Koopa's shell keeps sliding away from the block (addendum to the bump report)

- **Severity:** wrong behaviour
- **Build:** 34a77ba (code review against the original's source and the SMB1 disassembly, not playtested)
- **Where:** any level where a Koopa or Buzzy Beetle walks over a brick or ? block
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** any character that can bump blocks
- **Input:** keyboard
- **Browser and device:** n/a (found reading the code)

## Steps

1. Wait for a Koopa (green or red) or a Buzzy Beetle to walk over a block.
2. Bump the block from below.

## Expected

This is the same bug as `2026-10-05-bump-koopa-spiny-dies.md` and adds three details for the fix.

- **The shell slides; it does not stop.** In the original's `KoopaGreen.gBounceHit`, `vx` is set to `defaultWalkSpeed`, pointing away from the middle of the block: it is negated when the Koopa is left of `g.hMidX`. `bounced = true` makes `enterShell()` keep that speed instead of zeroing it. So the shell pops up at walking speed, heading away from the block. It is still a shell, so touching it kicks it (`KoopaGreen.hitCharacter` calls `kickShell`). The shell timers start, so it comes back out later. Red Koopas and Buzzy Beetles extend `KoopaGreen` and behave the same.
- **The NES agrees, so this is not an NES-or-Crossover choice.** In SMB1 (labels `HandleEToBGCollision`, `ChkToStunEnemies` in the disassembly at https://gist.github.com/1wErt3r/4048722), only Goombas are killed by a bump. Koopas, Buzzy Beetles and Spinies are stunned: a Koopa goes into its shell and hops away from the player. Following the original Crossover still differs from the NES in two small ways. The NES gives 100 points for the bump, where the Crossover gives none. The NES stuns a bumped Spiny, where the Crossover only bounces it.
- **One test asserts the old behaviour.** The test "a block bumped under an enemy scores the BELOW value (Koopa 100, Bullet Bill 200)" in `tests/sim/scoring.test.ts` expects 100 for a bumped Koopa. That case needs to change to 0 with the Koopa alive in its shell. The Bullet Bill case is unaffected.

## Actual

The Koopa dies and scores 100, as described in `2026-10-05-bump-koopa-spiny-dies.md`.

## How often

every time

## Notes

Addendum to `2026-10-05-bump-koopa-spiny-dies.md` (not edited, per this folder's rules). Fix them together.
The speed this report describes is what the code sets. Whether the shell later slows down was not checked in play.
