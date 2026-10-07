# Lost Levels world agent brief (read all of it before starting)

Project: browser remake of Super Mario Bros. Crossover (TypeScript + Canvas, Vite, pnpm). You
convert The Lost Levels maps for the worlds named in your task, check them against the original
data, and write tests. Original art/music only; never commit binary files.

## Setup (in your worktree)
1. Your worktree may be behind. Run `git log --oneline -1`; if HEAD is not `bdcac64`, run
   `git merge --ff-only bdcac64` (the branch `claude/admiring-galileo-quy3ri` is visible in your
   worktree's repo). Stop and report if that fails.
2. `ln -s /home/user/SMBC/node_modules node_modules` and
   `ln -s /home/user/SMBC/tools/levelgen/source tools/levelgen/source`. Never commit them.
3. Read `tools/levelgen/convert-smbc.mjs`, `src/game/level/tiles.ts` (legend), `src/game/level/textmap.ts`
   (map format), `src/content/levels/levels.test.ts` and `tests/sim/world8.test.ts` /
   `tests/sim/world4.test.ts` (test patterns), `src/content/levels/index.ts`.

## Convert
`node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataLostLevels.xml src/content/levels/lost/worldN --prefix=ll- N-1 N-2 N-3 N-4`
(one call per world N; worlds A–D are stored as 10–13). Read every line it prints. "(helper)" skips
are tokens only shown for other heroes in the original and are correct to skip.

Original data: `tools/levelgen/source/levelDataLostLevels.xml` (LEVEL → AREA → MAP, 15 rows × W
columns row-major, cells `0` or tokens joined by `()`, `name&&Key=Value`; we play **normal**
difficulty: tokens whose `HideOnDifficulties` contains `normal` are hidden). The original
ActionScript game is at `/home/user/jaypavlina/super-mario-bros-crossover` (read-only) if you need
to know what a token means. NES Lost Levels knowledge is useful for sanity checks, but the XML is
the source of truth.

## Check every generated area against the XML
- width, theme/music (Lost Levels output never uses night/snow), start mode, time/parent;
- every entity type and count (goomba g, koopa k/K, paratroopas, hammer-bro h, hammer-bro-chase n,
  buzzy z, spring s, spring-green y, piranha, piranha-down, blooper, cheeps, podoboo, firebar,
  lakitu, bowser, axe, lifts, balance) vs the visible tokens in the XML; poison blocks 4/5/6;
  upside-down pipe rims D/G;
- every pipe/vine/pit/warp/loop zone target resolves to a generated file and a sensible
  position; `exit next=` chain (ll-N-4 → ll-(N+1)-1 or its intro, ll-8-4 → end, ll-9-4 → end,
  ll-13-4 → end); warp zones (in the Lost Levels each warp pipe is in its own area, and some warp
  backwards, e.g. 3-1 → 1-1);
- mazes/loops (checkpoint lists), Lakitu ends, bullet/cheep zones, water levels, coin heavens.

## Rules
- **Do not change shared code**: not the converter, engine, tiles, sprites, other tests or other
  worlds' maps. If the converter or engine gets something wrong (missing token, wrong target,
  wrong placement, a mechanic that doesn't exist), report it with evidence: level/area, XML
  column,row, the exact token text, what we generate and what it should be. Keep going with
  everything else. The orchestrator fixes shared code centrally and will tell you to regenerate.
- Your files only: `src/content/levels/lost/worldN/*.map`, `src/content/levels/lost/lost-worldN.test.ts`
  (one per world), `tests/sim/lost-worldN.test.ts` (one per world).
- Landmark tests (`lost-worldN.test.ts`): per level, width, theme, key entities with positions,
  zone targets, exit chain — values you verified against the XML, not just copied from output.
- Sim tests (`tests/sim/lost-worldN.test.ts`): every area of the world loads and runs 600 frames
  as Mario with no exception; plus one targeted sim per notable feature you find (a maze
  route, a warp pipe destination, a green spring launch, a poison block hurting, an upside-down
  piranha, a chasing Hammer Bro, a Lakitu end...).
- Don't run the browser smoke script (shared port). Run `pnpm lint && pnpm typecheck && pnpm test`
  (all must pass) and `pnpm exec prettier --write` on your files.
- Commit on your worktree branch (do not push), message ending with exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g
  ```
  No model names anywhere else.

## Report (your final message)
Branch and commit; per level a short table (areas, width, theme, entity counts by type, zones);
the tests you wrote; **every converter/engine problem** with evidence; anything you were unsure of.
Don't claim something is checked unless you checked it.
