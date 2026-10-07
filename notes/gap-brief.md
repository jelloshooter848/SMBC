# Known-gap agent brief (read all of it before starting)

Project: browser remake of Super Mario Bros. Crossover (TypeScript + Canvas, Vite, pnpm), repo at
your worktree. PR jelloshooter848/SMBC#20 adds The Lost Levels; you close one of its known gaps.
Original art/music only, stored as text pixel arrays (`src/content/sprites/*.ts`); never commit
binary files.

## Setup
1. `git merge --ff-only 3a09872` (the branch `claude/admiring-galileo-quy3ri` is visible in your
   worktree's repo). Stop and report if that fails.
2. Symlinks (never commit them): `ln -s /home/user/SMBC/node_modules node_modules`, and for the
   level data run `node -e "require('fs').symlinkSync('/home/user/SMBC/tools/levelgen/source','tools/levelgen/source')"`
   (the shell guard rejects commands containing that word, so use node).
3. Original data: `tools/levelgen/source/levelDataSmb.xml` and `levelDataLostLevels.xml`
   (normal difficulty: tokens whose `HideOnDifficulties` contains `normal` are hidden). The
   original ActionScript game is read-only at `/home/user/jaypavlina/super-mario-bros-crossover`
   (e.g. `src/com/smbc/level/Level.as`, enemies under `src/com/smbc/enemies/`, themes in
   `src/com/explodingRabbit/cross/games/GameSuperMarioBros.as`). Base behaviour on it, and on NES
   knowledge where it is silent; say which you used.

## Regenerating maps
- SMB1: `for w in 1 2 3 4 5 6 7 8; do node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world$w $w-1 $w-2 $w-3 $w-4; done`
- Lost Levels: `for w in $(seq 1 13); do node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataLostLevels.xml src/content/levels/lost/world$w --prefix=ll- $w-1 $w-2 $w-3 $w-4; done`
- Run both after any converter change; review `git diff` of the maps and make sure only the
  changes your task intends appear. Commit the regenerated maps.

## Rules
- Stay in your task's scope. Other agents are changing the converter, `world.ts`, the editor and
  the level tests at the same time; keep your edits additive and local so merges are easy (new
  cases, new files, small focused changes). Don't reformat or reorder code you don't need to touch.
- Update existing tests whose expectations your change legitimately alters
  (`src/content/levels/levels.test.ts`, `src/content/levels/lost/lost-world*.test.ts`,
  `tests/sim/*`), and add new ones: unit/sim tests for the mechanic (small text-map levels like
  `tests/sim/lost-fixes.test.ts`), plus landmark checks on real levels.
- New art: original, in the existing text format, with the existing palette roles; add frames to
  the relevant frame-list tests (`validateDef`).
- Editor (`src/game/scenes/editor.ts`): add new entity types / themes so levels can use them.
- Don't run the browser smoke script on the shared port 4173. If you want a browser check, run
  `npx vite preview --port <a unique port 4180-4199>` and Playwright from
  `/opt/node-tools/node_modules/playwright` yourself.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must all pass. `pnpm exec prettier --write` your files.
- Commit on your worktree branch (don't push) with a message ending in exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g
  ```
  No model names anywhere else.

## Report (your final message)
Branch and commit; what you implemented and why (with the original-source evidence); every file
changed; map changes per level (SMB1 and Lost Levels); tests added/changed; anything you were
unsure of or left out. Don't claim something is checked unless you checked it.
