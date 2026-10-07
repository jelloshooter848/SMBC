# World map feature: agent brief (read all of it before starting)

Project: browser remake of Super Mario Bros. Crossover (TypeScript strict + Canvas 2D, Vite, pnpm,
256×240 screen, 60 fps fixed step). We are adding a Super Mario World-style world map with save
files. The full plan is in /root/.claude/plans/can-we-create-the-jazzy-pretzel.md (top section
"Current step: Super Mario World-style world map + save files") — read that section.

Owner's decisions: clearing a level returns to the map (next node opens with a path animation);
3 save files with full state (map progress + lives, score, coins, heroes, power); a warp pipe
unlocks only its target world; game over → CONTINUE? YES returns to the map with progress kept
(fresh lives), NO → title. Only SMB1 worlds 1-8 get pages. Bonus nodes: one hidden slot per world,
revealed by a secret key later. Dev mode, `?level=`, custom/shared levels and editor playtests
bypass the map and never write save files.

## Shared contract (already committed at e0408cd; do not change it without saying so in your report)
- `src/game/map/types.ts`: MapTheme, MapNode, MapPath, WorldExit, MapActor, WorldMapPage, MapProgress.
- `src/content/worldmap/render.ts`: `mapSky(page)`, `drawMapTile(r, assets, page, ch, x, y, frame)`,
  `drawMapActor(r, assets, page, actor, frame)` — placeholder implementations (replaced by M3).
- `src/content/worldmap/index.ts`: `MAP_PAGES`, `mapPage(world)` — placeholder pages (replaced by M3).
The map engine only calls those functions/data, so engine (M2), art/pages (M3) and save files
(M1) can be built at the same time.

## Setup
1. In your worktree: `git merge --ff-only e0408cd`. Stop and report if it fails.
2. Symlinks (never commit): `ln -s /home/user/SMBC/node_modules node_modules`.
3. Read the existing code you build on (paths in your task).

## Rules
- Stay in your task's files; other agents work in parallel. Keep shared-file edits small and additive.
- Original art and music only, as text pixel arrays / MML; new frames go in the frame-list tests.
- Tests for everything you add (unit tests; scene sims with a real `Game` and stub deps like
  `tests/sim/death-continue.test.ts`; stub `globalThis.localStorage` like
  `src/engine/save/settings.test.ts`).
- Keyboard, gamepad and touch all go through the same input actions; use the announcer
  (`game.deps.announcer?.say`) for screen-reader text like the menus do.
- Browser checks only on your own port (4180-4199): `npx vite preview --port N` after `pnpm build`,
  Playwright from `/opt/node-tools/node_modules/playwright` (launch args ['--no-proxy-server']).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass. Prettier your files.
- Commit on your worktree branch (don't push), message ending with exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g
  ```

## Report (final message): under 40 lines
Commit sha; what you built; files; tests; screenshots paths if any; anything uncertain or any
contract change you needed.
