# Bug reports

Drop one Markdown file per bug in this folder. Copy [`TEMPLATE.md`](TEMPLATE.md) to start.

## Naming

`YYYY-MM-DD-<area>-<short-slug>.md`, for example
`2026-10-05-ll-8-4-bowser-falls-through-floor.md` or `2026-10-05-menu-options-back-skips-page.md`.
`<area>` is a level id (`1-2`, `ll-8-4`, `ll-10-1` for Lost Levels A-1) or a part of the game
(`menu`, `editor`, `coop`, `audio`, `touch`, `link`, `megaman`, …).

One bug per file. Never edit another tester's report; if you see the same bug, add your own file
and mention the other one.

## What makes a report useful

- **How to get there.** The fastest way is a URL: `?level=<id>&char=<hero>` starts a level
  directly (`&kit=full` gives a hero every tool; `?dev=1` unlocks Dev mode with its level select
  and assists). Otherwise the menu path.
- **Where in the level.** Press **F1** for the debug overlay: it shows tile columns. "Column 137,
  standing on the pipe" beats "near the end".
- **Build.** The version string at the bottom right of the title screen (for example
  `V0.1.0-3A09872`), or the commit you tested.
- **Steps, expected, actual, how often** (every time / sometimes / once).

Level ids: SMB1 levels are `1-1` … `8-4` (sub-areas add `-bonus`, `-sky`, `-water`, …); The Lost
Levels are `ll-1-1` … `ll-13-4` (worlds 10–13 are A–D).

## Screenshots

Optional. Put PNGs of this game next to the report with the same base name
(`…-bowser-falls-through-floor.png`), under 1 MB each. No images from other games.

## Delivery

Commit your files under `bug-reports/` on your own branch and push it, then pass the branch name
on (or open a pull request titled `Bug reports: <area>` against `main`). Each bug is reviewed,
reproduced and either fixed or answered; the outcome is added to the end of the report as
`Status: fixed in <commit>` or `Status: not a bug — <reason>`.
