# Landing on a still shell bounces the player; the original doesn't

- **Severity:** wrong behaviour
- **Build:** 41a9fb2 (code review, not playtested)
- **Where:** 1-1, the Koopa at about column 107 (any Koopa or Buzzy Beetle shell)
- **How to get there:** `?level=1-1&char=mario`
- **Character and power:** Mario, any
- **Input:** keyboard
- **Browser and device:** n/a (found reading the code)

## Steps

1. Stomp a Koopa so it becomes a shell.
2. Jump and land on the still shell.

## Expected

As in the original: the shell is kicked and the player is not bounced. `Character.hitEnemy` does nothing for a Koopa whose state is `shell` or whose `NO_HIT_SHELL_TMR` is running, so there is no `bounce()`. `KoopaGreen.kickShell` starts `NO_HIT_SHELL_TMR` (250 ms). While it runs, the kicked shell can't be stomped (`KoopaGreen.stomp` returns early) and doesn't hurt the player, who falls through it.

## Actual

The kick scores correctly, but the player also gets a stomp bounce (`p.stompBounce()` in the still-shell branch of `World.playerVsEnemy`).

## How often

every time

## Notes

Ours keeps the bounce because there is no no-hit window. Without the bounce, the falling player would touch the moving shell on the next frame and stop it or be hurt. A proper fix: give `Koopa` a 15-frame (250 ms) no-hit timer, started in `kick()`, during which the shell can't be stomped and doesn't hurt the kicker; then drop the bounce. Follow-up from the review of the shell-kick scoring fix (`2026-10-05-scoring-shell-kick-after-stomp.md`).

Status: fixed — every kick now starts a 15-frame (NO_HIT_SHELL_TMR, 250 ms) no-hit window on the shell during which no player is hurt by it or can stomp it, and landing on a still shell kicks it without a bounce (vertical speed untouched, as in Character.hitEnemy).
