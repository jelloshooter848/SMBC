# Brief D1: wishlist-hero design reports + mockups (DESIGN ONLY, no game build, no PR)

Read `briefs/common.md` first (same folder) — project rules apply: original art only (text arrays), no binaries in
the repo, ability names not button letters, every new text announced, Reduce flashing respected.
Use `[skip ci]` on every commit (these are wip-only branches). Do NOT run the full test suite.

## Context
The owner's wishlist (bug-reports/2026-10-07-classic-follow-ups.md, "New characters beyond the original roster",
NC-1..NC-8). Owner decision 2026-10-19: these heroes are **Classic-only extras** (like Bass): they live in
`CLASSIC_EXTRAS`, appear only in Classic mode's select second row (and dev Classic starts), never in the campaign.
They play under the Classic SMBC rules: power states small / Mushroom / Flower with Lose Everything
(bug-reports/2026-10-07-classic-power-states.md), Classic enemy HP and armour, bricks and shots, swimming
(classic-enemy-hp-and-armour.md, classic-bricks-and-shots.md, classic-swimming.md). Study how the existing build
reports are written — `bug-reports/2026-10-07-bass-build-classic-character.md` and
`2026-10-07-pit-build-classic-character.md` are the models (requirement IDs, Steps / Expected / Actual / Notes,
open questions marked for the owner, acceptance checks, implementation hints pointing at our real code:
`characters/classic/power.ts`, `rules/hooks.ts`, `registry.ts` CLASSIC_EXTRAS, the Classic Mega Man / Samus
factories, optional profile fields like `rise`, `softCut`, `airStop`, `rooted`, `autoScroll`, `flies`).
These heroes were never in SMBC, so there is no original source to match: base each on its source game's feel
(from your knowledge of the game), translated to SMB's scale and the Classic power model. Flag every invented
number as a tuning value.

## Deliverables (per hero)
1. `bug-reports/2026-10-19-<id>-build-classic-character.md` in the house format, with an ID prefix (e.g. PE- for
   Peach), covering: identity/roster, controls (ability names), movement & jump numbers, power states (what the
   Mushroom and Flower give), attacks/weapons with damage in the Classic units, bricks/blocks, enemies/armour,
   water, pipes/vines/springs/flagpole/axe/Bowser, co-op (dev only), HUD, guide + touch labels, art list (poses),
   sounds, engine work needed (new optional fields/hooks) with a size estimate, tests/acceptance checks, and a
   table of DECISIONS FOR THE OWNER each with a recommended answer + alternatives.
2. Original sprite drafts as text arrays in `tools/mockups/classic/<id>.ts` (not registered in the game), reusing
   the storyboard renderer from `origin/claude/classic-wip-mockups` (`tools/mockups/classic/render.mjs`,
   `storyboard.ts`, `storyboard.html` — fetch that branch and copy those tools in).
3. A storyboard contact sheet `<id>-sheet.png` (256x240 frames at 3x, ~10-13 captioned panels: stand, walk, jump,
   each attack, each power state, the signature mechanic, water, a hit) saved ONLY to
   `/tmp/claude-0/-home-user-SMBC/fe3819b1-d2bc-5400-a597-4f764d8c5f19/scratchpad/shots/wishlist/`.
4. Lint + typecheck pass for any .ts you add.

## Report
Per common.md (branch, SHA, files), plus for each hero a 6-8 line plain-language summary of the design and the
key owner decisions. Under 50 lines.
