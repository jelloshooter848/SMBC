# Brief S1-shell: the CLASSIC MODE game mode (flow, no campaign features, dev starts)

Read `briefs/common.md` first (same folder). Base: `origin/main`. Your branch: `claude/classic-shell`.
Wip backup branch: `claude/classic-wip-shell`. Vite port: 5181.

A parallel builder (S1-core, branch `claude/classic-wip-core`) is adding the rules plumbing: `Rules` type,
`ctx.rules`, `heroFor`, `World.rules`, `game.roster`, a `game.runRules`-style field, the dev Level select
**Rules** row and `?rules=`. You must not build those. Where you need the Rules type, add EXACTLY the text from
common.md to `src/game/context.ts` (so the later merge is trivial), and set the run's rules through one small
call in your Classic start path (e.g. `this.runRules = settings.classicRules`) that the integrator will wire to
S1-core's API. You may `git fetch origin claude/classic-wip-core` to peek at its API and align names; do not
merge it.

## Goal
Title screen gets **CLASSIC** next to START GAME. It plays the original game: original order, looks, warps,
lives, 1-ups, time, score, continues, the original ending, and the Lost Levels by the existing NES unlock rules.
None of the campaign's additions appear.

## Scope
1. Title: a **Classic** entry right after "Start game". Selecting it opens a small CLASSIC submenu:
   - **Super Mario Bros.** → character select with EVERY hero unlocked (use `game.roster` if S1-core's API is
     present, else `deps.characters`; extras will appear on a second row once registered — implement the
     second-row layout per TG-41 now so it's ready) → WORLD 1-1.
   - **The Lost Levels** — shown only once unlocked by the existing progress flags (find them:
     `src/engine/save/progress.ts`, `recordLostGameBeaten`, game.ts ~260-390). Starts the Lost Levels.
   - **Options** (includes the new setting "Classic rules: Classic SMBC / Current", `settings.classicRules`,
     default 'classic'; add it to `defaultSettings()` so `merge()` keeps it; coerce bad values), **Back**.
   If the submenu would only have one playable entry, still show it (consistent). Keep hints free of level numbers.
2. Run flow (a `game.mode`-style flag, e.g. `game.classicRun = true`, cleared by every other start path):
   - `game.campaign` stays null (no save slot, never touch campaign save files, no backup cards).
   - Death → character select (as in the original), then retry the level/checkpoint. Game over → continue
     screen → character select → continue as the original (check what the engine's non-campaign path does
     today; keep it if it matches).
   - After 8-4: original ending ("THANK YOU <HERO>! YOUR QUEST IS OVER." + classic credits — find what exists,
     `world.ts` ~3360-3400, `scenes/credits.ts`; use the non-campaign credits, not campaign story credits), then
     the Lost Levels per the existing NES unlock rules.
   - Pause: **Continue / Options / Quit to title** only (plus Dev mode entry when dev mode is on, as today).
3. Campaign audit — the big one. Find EVERY campaign/story check (`storyOn`, `game.campaign`, `campaignOrder`,
   `campaignTheme`, `campaign-decor`, `campaign=true` props, partners, captives, hero items, keys/gates,
   tutorials/1-0/training offers, Kakariko, airships, inventory, fake-Bowser costumes/unmask, boss bars, Valley
   of Bowser, Bowser's Castle, hero sightings, map, story cards) and make sure a Classic run takes the
   non-campaign side of each. Write `tests/sim/classic-mode.test.ts` that starts a Classic run and asserts none
   of these appear (e.g. 1-1..8-4 level ids and order, no captive/partner entities, no boss bar, no campaign
   decor/theme, HUD labels are original, warp zones go where the original goes, 8-4 → ending → Lost Levels flag).
   Also a test that the Start game (campaign) path is unaffected.
4. Dev: the dev Level select gets a **Mode** row: "Free play" (today's devStart) / "Classic run" (your flow,
   with Classic death/continue rules). URL `?dev=1&mode=classic&level=..&char=..` (honoured only with dev on).
   S1-core adds a Rules row in the same menu — keep your edit to that file minimal (one row + start wiring)
   to ease the merge.
5. Accessibility: every new menu line announced; no button letters (extend checks in new test cases only).
6. CHANGELOG `## [Unreleased]` line(s).

## Out of scope
Rules plumbing (S1-core), any Classic hero behaviour.

## Done when
Full suite green, no existing test edited; play-through from the title: CLASSIC → pick Link → 1-1 → die → char
select → take the 1-2 warp zone → 4-1, pause menu correct; dev Mode row works; phone 393x852 touch works.
Screenshots of title, submenu, select, a level, pause into `shots/s1-shell/`. Report per common.md.
