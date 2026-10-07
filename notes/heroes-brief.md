# 0.5.0 "Free the heroes" — shared brief
Project: browser remake of Super Mario Bros. Crossover (TypeScript, Canvas 2D, Vite, pnpm), at
/home/user/SMBC. Original art and music only (text pixel arrays, MML); no binaries.
Base: `git merge claude/admiring-galileo-quy3ri` (commit 25ea9e0, which adds the mini game contract
in `src/game/minigames/`: types.ts, index.ts and a Luigi placeholder).
Setup: `ln -s /home/user/SMBC/node_modules node_modules`. NEVER commit node_modules (`git status`
before every commit). Never use browser port 4173; use the port your prompt names. Playwright:
require('/opt/node-tools/node_modules/playwright'), executablePath '/opt/pw-browsers/chromium'.
Don't edit CHANGELOG.md (the orchestrator writes it). Player-facing text names abilities (JUMP,
ATTACK, TALK…), never button letters. Write failing tests first. Checks before you report:
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Commit on your worktree branch with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g

## The feature (owner decisions)
- A new campaign save starts with **Mario only**. The other heroes show in character select as
  black silhouettes labelled "???": teased, not selectable (the cursor skips them).
- Story: Bowser has brainwashed the other heroes. Each is found somewhere in the campaign; talking
  to them starts a **mini game themed on their own game**. Passing frees them: they join the
  roster. A failed mini game can be retried any number of times; the player may also leave and
  come back later.
- First: **Luigi, in the 1-1 bonus room** (the underground coin room under the 1-1 pipe), on a
  ledge at the top right. His mini game is the **Mirror Race**: race brainwashed Luigi along a
  short SMB-style course to a flagpole; reach it first to free him.
- Unlocks are **per save file**. Locks apply **only in campaign mode** (`game.campaign !== null`);
  dev mode, `?level=`, custom and shared levels, editor playtests keep every hero.
- **Existing saves are locked too**: on load they keep Mario plus the hero(es) they last used
  (`character`, `character2`), nothing else.
- Later each mini game may be rebuilt to look and play like the hero's original game, so the
  unlock flow must only depend on the `MiniGameDef` contract (`src/game/minigames/types.ts`).

Report back: what you changed (files), the tests you added (names), anything you could not do or
decided on your own, and screenshot paths if you took any. Keep the report short.
