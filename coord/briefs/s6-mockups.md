# Brief S6: Vic Viper and Warriors of Light — design mockups only (no build, no PR)

Read `briefs/common.md` first (same folder) — project rules apply (original art only, no binaries in the repo).
Base: `origin/main`. Wip branch: `claude/classic-wip-mockups`. Vite port: 5183 (if you need one).

## Goal
Both characters were unfinished in the original SMBC 3.1.21. The owner must approve a design before anything is
built. Produce, for each: a design doc and a storyboard with screenshots, so the owner can say yes/no/change.

## Inputs
`bug-reports/2026-10-07-vicviper-build-classic-character.md` (VV-) and
`bug-reports/2026-10-07-warriors-of-light-build-classic-character.md` (WL-). Both list what the original source
has and the "design gaps the owner must fill". Read the original source to confirm (clone read-only, see common.md).
Look at how existing heroes are drawn (`src/content/sprites/**`, `src/game/characters/*/`) to match style,
palette format and sprite sizes.

## Deliverables
1. `docs/classic/VIC_VIPER.md` and `docs/classic/WARRIORS_OF_LIGHT.md` on your wip branch: for each, the
   proposed controls (ability names, not button letters), movement numbers, power states (small / Mushroom /
   Flower per the Classic power model in `bug-reports/2026-10-07-classic-power-states.md`), weapons, how it
   handles bricks, enemies, water, pipes, flagpole, Bowser, co-op; for every design gap in the report, a
   recommended answer + 1-2 alternatives, clearly marked as a DECISION FOR THE OWNER. Keep each doc readable
   (~2-4 pages).
2. Original pixel-art sprite drafts as text arrays in the repo's sprite format, in a non-shipped place (e.g.
   `docs/classic/mockups/*.ts` or a tools script) — not registered in the game.
3. A small Node/Playwright script (in `tools/` or your scratch area) that renders storyboard frames: the hero
   standing, running, jumping, attacking, each power state, in a 1-1-like scene, at the game's 256x240
   resolution scaled 3x. Save PNGs ONLY to
   `/tmp/claude-0/-home-user-SMBC/fe3819b1-d2bc-5400-a597-4f764d8c5f19/scratchpad/shots/s6-mockups/`, plus one
   contact sheet per character (`vicviper-sheet.png`, `warriors-sheet.png`).
4. Lint + typecheck pass if you added .ts files under the repo (or keep them out of the TS project).

## Report
Per common.md, plus a 10-line plain-language summary per character of the key decisions the owner must make.
