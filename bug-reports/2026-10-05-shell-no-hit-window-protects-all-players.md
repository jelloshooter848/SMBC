# The post-kick no-hit window protects every player, not just the kicker (addendum to the shell-bounce report)

- **Severity:** wrong behaviour
- **Build:** 34a77ba (code review against the original's source, not playtested)
- **Where:** any Koopa or Buzzy Beetle shell; matters in two-player mode
- **How to get there:** `?level=1-1&char=mario&char2=luigi`
- **Character and power:** two players, any
- **Input:** keyboard
- **Browser and device:** n/a (found reading the code)

## Steps

1. Stomp a Koopa so it becomes a shell.
2. Kick it with one player while the other player is touching it or falling onto it.

## Expected

This is the same bug as `2026-10-05-still-shell-landing-bounces.md`, with one correction to its suggested fix.

That report's notes say the 250 ms no-hit timer means the shell "doesn't hurt the kicker". In the original, the timer protects everyone. `Character.hitEnemy` skips every character while the shell's `NO_HIT_SHELL_TMR` is running, whoever kicked it. `KoopaGreen.stomp` also returns early for any stomper during that time. The timer starts on every kick, from the side or from above, because `kickShell` always starts it.

So the fix should be a timer on the shell that blocks stomps and contact damage from all players for 15 frames after any kick. A timer tied to the player who kicked it would be wrong.

## Actual

There is no no-hit window yet. The still-shell branch bounces the kicker instead, as described in `2026-10-05-still-shell-landing-bounces.md`.

## How often

every time

## Notes

Addendum to `2026-10-05-still-shell-landing-bounces.md` (not edited, per this folder's rules). Fix them together.
