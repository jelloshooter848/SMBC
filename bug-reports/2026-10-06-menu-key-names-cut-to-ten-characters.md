# Options → Controls: long key names are cut off ("RIGHT SHIFT" shows as "RIGHT SHIF")

- **Severity:** cosmetic
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** Options → Controls, the Key Tools row (any row whose key name is longer than 10 characters)
- **How to get there:** From the title: Options → Controls
- **Character and power:** any
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Open Options → Controls.
2. Look at the Key Tools row, which defaults to Right Shift.

## Expected

The full key name, or a clear abbreviation such as "R SHIFT".

## Actual

"RIGHT SHIF". Menu values are cut to 10 characters (`src/game/scenes/menu.ts` around line 121: `it.value().toUpperCase().slice(0, 10)`).

## How often

every time

## Notes

- Other long names, such as some gamepad buttons or numpad keys, would be cut the same way.
- Found by the build review's smoke test of V0.3.0-DEV.8F4BF1A. Screenshot name in the review: 084. Not committed (`check:assets` bans image files).

Status: fixed — menu values are no longer cut to 10 characters: `fitMenuValue` shows the full name when it fits beside the row's label ("RIGHT SHIFT"), else shortens its words ("R SHIFT", "L CTRL", "NUM +", "PRT SC", "BTN 16"), and cuts only as a last resort, so no row overlaps its label or leaves the panel (tested with long key and pad names).
