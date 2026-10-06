# Hammer Bros throw in bursts of three every 2.2-3.2 s; the original throws one hammer at a time every 0.55-1.45 s

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every Hammer Bro. Seen in 3-1 (columns 113 and 116) and 5-2 (the Hammer Bro at column 45 on the staircase; also those at columns 81, 120 and 124)
- **How to get there:** `?level=3-1&char=mario`, go to column 104
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=3-1&char=mario`, go to column 104 (the pipe top before the Hammer Bros) and watch the two Hammer Bros for 10 s.
2. Count the hammers and the gaps between throws.

## Expected

`com/smbc/enemies/HammerBro.as` (lines 35-37, 184-188, 289-308): a throw timer of 300-1200 ms (`HAMMER_TMR_DUR_MIN/MAX`), then a 250 ms wind-up pose (`HAMMER_DEL_TMR`), then **one** hammer; the next timer starts only after that. So single hammers every 0.55-1.45 s.

## Actual

`src/game/entities/enemies/hammer-bro.ts` (lines 12-13, 88-98): throws come in volleys of three hammers 16 frames apart (`VOLLEY_SIZE`, `VOLLEY_GAP`), the first 12 frames after the volley starts, so a volley lasts 44 frames. Then `throwTimer` (`90 + rng.int(60)`, counted only while no volley is running) gives a 90-149 frame pause before the next volley. So bursts of 3 every 134-193 frames (2.2-3.2 s).

In 5-2, watched from column 39 (`?level=5-2&char=mario&dev=1`, No damage assist) for 9.6 s: 4 volleys about 2.4 s apart, each with three hammers in the air together and no hammers in between (frames 1 to 3, 9 to 11, 17 to 19 and 25 to 27 of the contact sheet (screenshot not committed: the repo's `check:assets` bans image files), 0.3 s between frames). The average rate is close to the original's, but the hammers come in clumps of three with long gaps, which changes how you dodge them.

In play the three hammers of a volley are in the air together (see the screenshot of the arc report, (screenshot not committed: the repo's `check:assets` bans image files), three hammers from one Hammer Bro).

## How often

every time

## Notes

- Evidence: code reading, plus a short playtest of both games (the original runs at roughly a fifth of real time in Ruffle, so I could not time it precisely there).
- Split by the reviewer from `smb-w3/2026-10-05-hammer-bro-throw-and-jump-timing.md`, which covered throwing and jumping together. The jump timing is `2026-10-05-hammer-bro-jumps-too-rarely.md`.
- The arc of each hammer is a separate report: `2026-10-05-hammer-bro-hammer-arc-too-high.md`.
- Also reported in 5-2 by smb-w5 (`smb-w5/2026-10-05-5-2-hammer-bro-volleys.md`): code reading for the original, playtest of ours. The smb-w5 tester could not reach a Hammer Bro in the original (Ruffle ran at about a sixth of real speed). Our screenshot from that report: (screenshot not committed: the repo's `check:assets` bans image files).
- Reviewed: verified against `com/smbc/enemies/HammerBro.as` (`HAMMER_TMR_DUR_MIN/MAX` 300/1200, `HAMMER_DEL_TMR` 250, `hammerTmrLsr`, `hammerDelTmrLsr`) and ours: `src/game/entities/enemies/hammer-bro.ts` (`VOLLEY_SIZE` 3, `VOLLEY_GAP` 16, `throwTimer`).

Status: fixed — Hammer Bros throw one hammer at a time: a 300-1200 ms (18-71 frame) timer, a 250 ms (15 frame) wind-up in the throw pose, then one hammer, then the next timer (`hammerTmrLsr`, `hammerDelTmrLsr`).
