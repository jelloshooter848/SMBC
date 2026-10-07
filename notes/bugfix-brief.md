# Bug-fix agent brief (read all of it before starting)

Project: browser remake of Super Mario Bros. Crossover (TypeScript + Canvas, Vite, pnpm). Testers
filed reports in `bug-reports/` comparing our 1-1 with the original Crossover 3.1.21. You fix the
reports assigned to you. Original art/music only; never commit binary files.

## Setup
1. `git merge --ff-only BASE_SHA` (branch `claude/admiring-galileo-quy3ri`). Stop and report if it fails.
2. Symlinks (never commit): `ln -s /home/user/SMBC/node_modules node_modules`; for level data
   `node -e "require('fs').symlinkSync('/home/user/SMBC/tools/levelgen/source','tools/levelgen/source')"`.
3. Read your reports in `bug-reports/`. The original ActionScript source is read-only at
   `/home/user/jaypavlina/super-mario-bros-crossover/src` (com/smbc/...). Every behaviour you
   implement must be checked against that source; cite file and constant/function in comments
   where the numbers come from, and in your report.

## Rules
- Reproduce each bug first with a failing test (unit or `tests/sim/*` with `runSim`), then fix.
- Stay in your scope; other agents edit `world.ts`, `level.ts` and scenes at the same time, so
  keep edits local and additive; don't reformat code you don't touch.
- Don't change level maps or the converter.
- At the end of each report file you fixed, append a line: `Status: fixed — <one sentence>`
  (the orchestrator adds the commit later). If a report turns out wrong, append
  `Status: not a bug — <evidence>` instead.
- Browser checks only on your own port (4180-4199) via `npx vite preview --port N` and Playwright
  from `/opt/node-tools/node_modules/playwright`; never port 4173.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass. Prettier your files.
- Commit on your worktree branch (don't push), message ending with exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g
  ```

## Report (final message) — keep it SHORT (under 40 lines)
Commit sha; per bug report: what changed and the original-source evidence (one or two lines);
files touched; tests added; anything uncertain. No long tables.
