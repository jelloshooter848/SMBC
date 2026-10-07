# Warp Zone hub + Lost Levels campaign — shared brief (0.4.0)

Project: browser remake of Super Mario Bros. Crossover (TypeScript, Canvas, Vite, pnpm), original
art/music only (text pixel arrays, no binaries). Work in your git worktree; first
`git merge claude/admiring-galileo-quy3ri`. `ln -s /home/user/SMBC/node_modules node_modules` and
NEVER commit it (`git status` before every commit). Browser ports: never 4173; use the one your
prompt names. Playwright: require('/opt/node-tools/node_modules/playwright'), executablePath
'/opt/pw-browsers/chromium'. Don't edit CHANGELOG.md. Player-facing text names abilities, never
button letters (JUMP, BACK…), except the verbatim Lost Levels card. Checks before reporting:
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Commit trailers:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UbMx3tiRGB9FDcBjs6LN6g

## Owner decisions
- Campaign: the 1-2 warp zone no longer skips worlds. The room shows ONE pipe (no world numbers);
  taking it clears 1-2, records secret `bonus-1`, returns to the World 1 map and draws a new path
  to a warp spot (World 1's hidden bonus slot at (6,11)). Non-campaign play (dev select,
  ?level=, custom) keeps the classic three pipes.
- Warp spot → new **Warp Zone hub** page. Pads: Lost Levels (locked until SMB 8-4 is beaten =
  save `gameCleared`; hint "LOST LEVELS - BEAT 8-4 TO UNLOCK"), mystery pads "???" (locked,
  hint e.g. "??? - A FUTURE SECRET"), Return to World 1.
- Lost Levels: 13 new map pages (worlds 1-8, 9, A-D) with new layouts, existing themes/art; same
  rules as SMB (levels open in order, castle opens next world); World 9 and A-D per the existing
  NES rules (9 after a warpless ll-8-4; A-D after 8 games beaten).
- Keep as is (note as future secret hooks): SMB 4-2 warp zones (still skip worlds); Lost Levels
  warp zones incl. backward warps.
- New save files are one player; old 2P files still load.

## Map survey (facts)
Model keyed by numeric world 1-8: types.ts (MapTheme 8 values, WorldMapPage.world, WorldExit.toWorld,
MapProgress.worlds number[], position {world,node}), content/worldmap/index.ts (MAP_PAGES,
mapPage(w)), rules.ts (isWorldOpen W1 always open, isOpen, isExitOpen, clearLevel, warpTo,
nextStep, reveal ids "<world>:<id>" parseRevealId integer), save-files.ts (SAVE_MIGRATIONS = [],
v1, MAP_WORLDS = 8, migrateSave clamps worlds 1..8, clearedMainLevels /^[1-8]-[1-4]$/),
world-map.ts (header 24 px title + WORLD n; slide compares world numbers; Worlds menu lists
MAP_PAGES; enterLevelFromMap; node text is announcer-only), build.ts (bonus key `bonus-${w}`),
level.ts:110-118 (cross-world pipe → campaignWarpToMap), game.ts showEnding/afterCredits
(SMB 8-4 → gameCleared), showLostEnding (ll-8-4/9-4/13-4), progress.ts (lost.beaten, letters,
world9). `secrets` is saved but nothing sets it. LL files use world: 1..13 (collide with SMB).
