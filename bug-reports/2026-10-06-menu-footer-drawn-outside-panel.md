# Map and pause sub-menus draw their status line and "BACK" hint below the panel, over the level

- **Severity:** cosmetic
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** the see-through menus over the world map and over a level (for example Options or Controls opened from the map menu or the pause menu)
- **How to get there:** From a save file: open the map menu (Start), choose Options → Controls; or pause in a level and open Options
- **Character and power:** any
- **Input:** keyboard and touch
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Open a sub-menu from the world map menu or the in-level pause menu.
2. Look below the menu panel.

## Expected

The status line and the blinking "BACK (X)" hint sit inside the menu's see-through panel.

## Actual

Both are drawn at the screen's bottom rows (`src/game/scenes/menu.ts` around lines 126-128: y 200 and 216), below the panel, over the map water or the level's ground tiles.

## How often

every time

## Notes

- Full-screen menus, such as from the title, look fine, because there is nothing behind the text.
- Found by the build review's smoke test of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: 084-087, touch/018, touch/023. Not committed (`check:assets` bans image files).

Status: fixed — see-through menus use their own layout (title y 32, rows from 52, status y 184, "BACK" y 198), all inside the 24-216 panel; full-screen menus keep y 200/216. Tests check every Options sub-menu over the map draws inside its panel.
