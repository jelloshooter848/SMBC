# Common rules for every Classic-mode builder and reviewer

Repo: jelloshooter848/SMBC, "Super Mario Bros. Crossover: REMIX" (TypeScript strict, Canvas 2D, Vite, pnpm).
Spec: `bug-reports/2026-10-07-*.md` (19 reports). The umbrella report is
`bug-reports/2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-1..TG-45): read it first. It was written for a
dev-only toggle; this project instead adds a CLASSIC MODE game mode, so where TG items talk about the dev
menu Rules row / `settings.rules`, follow the "Rules model" below instead. Everything else in the reports
(heroFor, CLASSIC_CHARACTERS, World.rules, one-branch-per-shared-system, parity fixture, guard tests) holds.

Original game source (read-only, for checking constants): `git clone --depth 1
https://github.com/JayPavlina/super-mario-bros-crossover /tmp/<you>/smbc-orig` (clone outside the repo).

## Rules model (the contract all builders share)

- `src/game/context.ts` exports `export type Rules = 'current' | 'classic';`, `GameContext` gets an OPTIONAL
  `rules?: Rules`, and `export function rulesOf(ctx: { rules?: Rules }): Rules { return ctx.rules ?? 'current'; }`.
- Classic rules only ever apply in a non-campaign run. A campaign file (`game.campaign !== null`) ALWAYS plays
  `'current'`. There is exactly one place that decides the live rules (a `Game` method), and it returns
  `'current'` whenever a campaign file is open.
- Classic mode run (title → CLASSIC): rules = `settings.classicRules` (`Rules`, default `'classic'`; Options
  switch "Classic rules: Classic SMBC / Current", shown in the Classic mode's options).
- Dev starts (dev Level select, `?dev=1&level=`): a Rules choice (Current / Classic SMBC) and a Mode choice
  (Free play = today's dev start / Classic run = Classic mode flow). URL: `?dev=1&mode=classic&rules=classic&level=1-1&char=link`.
  `rules=`/`mode=` are honoured only with dev mode on.
- `GameState.character` always holds the Current/roster def; only the World resolves `heroFor(def, rules)`.
- Classic-only extra heroes (Bass, Proto Man, Pit, …) appear only in Classic mode (and dev Classic runs), never
  in the campaign, never in `heroesToFind`/captives/map.

## HARD RULE: the campaign must not change
- With `rules === 'current'` the game must behave exactly as today. No existing test may be edited to pass.
  New tests go in new files (or new `it` cases in new files).
- Prefer optional fields on `MovementProfile`/`SwimProfile`/`CharacterDef`/projectile specs that only Classic
  defs set, over `if (classic)` branches. Each shared system branches on `world.rules` in exactly one place.
- No file outside `classic*.ts`, `characters/classic/`, `rules/classic-*.ts` imports a classic module
  (except `registry.ts`, which builds `CLASSIC_CHARACTERS`).
- The parity fixture `tests/sim/current-parity.test.ts` must stay green after your work.

## Project rules
- Original art and music only: pixel art as text arrays, music as MML, in the repo's own formats. No ripped
  sprites/music/logos, no binary image/audio files in the repo (CI rejects them; `pnpm check:assets`).
- Player text: name abilities (JUMP, ATTACK, TALK…), never raw button letters (input-aware key hints OK);
  every new text is announced to the screen reader; text never auto-advances without a press; every scene is
  skippable; no level numbers in hints. Respect Reduce flashing everywhere.
- Do NOT bump package.json version; do NOT add a dated CHANGELOG section. Add your lines under
  `## [Unreleased]` in CHANGELOG.md only (create that heading at the top if missing).
- Never commit node_modules. Run `pnpm install --frozen-lockfile` in your worktree first.

## How to work
1. Work in your own git worktree. Create your branch from the base named in your brief.
2. BACKUP: after every meaningful step, commit and `git push -u origin HEAD:<your wip branch>` (force-push
   to your own wip branch is fine). The container can restart at any time; the wip branch is the only copy.
   On network failure retry push up to 4 times (2s, 4s, 8s, 16s).
3. As you go: `pnpm lint`, `pnpm typecheck`, targeted `pnpm vitest run <files>`. Use `set -o pipefail` when
   piping test output. At the end of your slice run the FULL suite once: `set -o pipefail; pnpm test 2>&1 | tail -40`
   (~9,500 tests, several minutes; the machine has 4 CPUs shared with other agents, so don't run it repeatedly).
4. Play it: start Vite on YOUR port only (`pnpm vite --port <port> --strictPort`, in background), drive it with
   Playwright (Chromium is preinstalled; PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers; never `playwright install`;
   if needed use executablePath '/opt/pw-browsers/chromium'). Check desktop (keyboard) and phone 393x852 (touch).
   Save screenshots (PNG) to `/tmp/claude-0/-home-user-SMBC/fe3819b1-d2bc-5400-a597-4f764d8c5f19/scratchpad/shots/<slice>/`
   — NEVER into the repo.
5. Before finishing: stop Vite and every background process you started. Final commit pushed to the wip branch.
6. Commit messages end with:
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01YMP4eLPU2jaf7cnow8ebEb
   Do not put model names anywhere else in the repo.
7. Don't open PRs. Don't push to main or to any branch other than your own wip/slice branches.

## Report format (your final message)
- Branch + final commit SHA (pushed).
- What you built, mapped to requirement IDs (done / partial / skipped and why).
- Files changed (short list).
- Tests added; targeted results; FULL suite result line (pass/fail counts). Lint + typecheck result.
- What you played and saw (desktop + phone), with screenshot paths.
- Known gaps, risks, open questions for the owner. Keep it under ~60 lines.
