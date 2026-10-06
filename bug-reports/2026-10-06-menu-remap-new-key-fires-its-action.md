# Controls remapping: the key you just bound also triggers its new action

- **Severity:** wrong behaviour
- **Build:** V0.3.0-DEV.8F4BF1A (main 8f4bf1a)
- **Where:** Options → Controls (keyboard remapping)
- **How to get there:** From the title: Options → Controls
- **Character and power:** any
- **Input:** keyboard
- **Browser and device:** headless Chromium on Linux (cloud container, scripted through Playwright)

## Steps

1. Go to Options → Controls, select Key Jump and press the OK key.
2. Press A to bind Jump to A.
3. Then press Down to move to the next row.
4. In another try, select Key Attack and bind it to V.

## Expected

The pressed key is bound and capture ends. The key doesn't count as a press of its new action until it's released and pressed again.

## Actual

- Binding Jump to A: the row shows A, but "PRESS A KEY (ESC CANCELS)" stays up. The still-held A now means OK, so it reopens capture on the same row. The next key, Down, is captured too: Jump ends up bound to the Down arrow, and the key hint reads "OK ↓".
- Binding Attack to V: the Controls menu closes at once, because V now means BACK.
- The only way out is Enter → Reset keys.

## How often

every time

## Notes

- This is not new in 0.3.0: the capture code is the same at v0.2.0.
- Cause, by code: `InputManager.beginFrame` (`src/engine/input/input-manager.ts`, around lines 121-140) gives the players an empty action set while capturing. On the next frame, the key that is still held reads as a fresh press of the action it was just bound to.
- Fix idea: after a capture, ignore that key until it has been released.
- Gamepad remapping wasn't tested; it may have the same problem.
- Found by the build review's smoke test of V0.3.0-DEV.8F4BF1A. Screenshot names in the review: 084-089. Not committed (`check:assets` bans image files).
