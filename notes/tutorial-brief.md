# Tutorials batch — shared brief
Project: browser remake of Super Mario Bros. Crossover (TypeScript, Canvas 2D, Vite, pnpm) at
/home/user/SMBC. Original art and music only (text pixel arrays, MML); no binaries.
Base: `git merge claude/admiring-galileo-quy3ri` (main b25ac1f = v0.4.2: hero unlocks, captive
Luigi in 1-1-bonus, Mirror Race; see docs/HEROES.md, docs/WORLD_MAP.md).
Setup: `ln -s /home/user/SMBC/node_modules node_modules`. NEVER commit node_modules (`git status`
before every commit). Browser: only the port your prompt names, never 4173. Playwright:
require('/opt/node-tools/node_modules/playwright'), executablePath '/opt/pw-browsers/chromium'.
Don't edit CHANGELOG.md. Player-facing text names abilities (JUMP, RUN, ATTACK, SHOOT, …; reuse
`abilityHint` in src/game/scenes/hints.ts and the hero's touch labels / guide wording), never button
letters. Announce new on-screen text via the announcer like other scenes. Respect reduce-flashing.
Write failing tests first. Checks before reporting: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
Commit on your worktree branch with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g

## The batch (owner decisions)
1. T1 — Dev "All heroes" toggle on the world map's dev menu (next to "Unlock all").
2. T2 — Mario's tutorial stage `1-0`: World 1's map start spot becomes a stage; 1-1 opens only
   after 1-0 is cleared. General game tutorial + start of the story. Required on new files.
3. T3 — Optional practice rooms for every other hero: the first time a hero is picked on a save
   file, a popup asks "<HERO> TRAINING? YES / NO". Per save file. Replayable from pause.
Three agents work in parallel; small overlaps (save-files.ts, game.ts, character-select.ts,
world-map.ts) are expected — keep your edits additive and local so merges stay easy.

Report back: files changed, tests added (names), decisions you made on your own, anything not done,
screenshot paths. Short.
