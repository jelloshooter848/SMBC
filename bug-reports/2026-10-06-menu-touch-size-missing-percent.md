# Options → Controls: the Touch size value has no "%" sign

- **Severity:** cosmetic
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** Options → Controls → Touch size
- **How to get there:** From the title: Options → Controls
- **Character and power:** any
- **Input:** keyboard and touch
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Open Options → Controls.
2. Look at the Touch size row, and change the value.

## Expected

The value reads "100%", "110%" and so on, as `pct()` returns.

## Actual

It reads "TOUCH SIZE 100" or "110" with no percent sign. The bitmap font has no % glyph, so the character is dropped. Other percentage settings that use `pct()`, such as the audio volumes, probably have the same problem.

## How often

every time

## Notes

- Fix ideas: add a % glyph to the font, or show the value another way, such as "x1.1".
- Found by the build review's smoke test of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: 082, touch/016. Not committed (`check:assets` bans image files).

Status: fixed — the bitmap font has an original 8x8 "%" glyph (two 2x2 dots and a 2px slash) and `fontText` keeps "%", so Touch size and the Master, Music and Sound volumes read "100%"; font tests cover the glyph, and a test checks every character the Options menus draw has a glyph (which also changed the remap status "=" to ":").
