# Credits text scrolls over the hero and the princess at the end of 8-4

- **Severity:** cosmetic
- **Build:** 0.2.2 candidate (commit 074bbe4)
- **Where:** 8-4-end, after the axe and the thanks text
- **How to get there:** `?dev=1&level=8-4-end&char=mario`, walk to the axe
- **Character and power:** Mario, small
- **Input:** keyboard
- **Browser and device:** headless Chromium (QA pass)

## Steps

1. Reach the axe in 8-4-end and let the ending play.
2. Wait for "YOUR QUEST IS OVER." and the credits roll.

## Expected

The credits roll behind the level, as in the original (ScreenManager credits layer), so the hero and
the princess stay drawn in front of the text.

## Actual

The credit lines scroll across the hero and princess sprites (QA frames q8-018 to q8-030).

## How often

every time

## Notes

Found in the 0.2.2 QA pass; the ending otherwise works (thanks, quest-over line, credits, fast-forward
with Start, back to the title).
