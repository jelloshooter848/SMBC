# Mega Man: the space station above 3-1 — shared brief (M1 campaign, M2 mini game, M3 art/music)
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, trailers, never commit node_modules, no CHANGELOG edits, ability names not
letters, announcer, reduce flashing). Base: `git merge claude/admiring-galileo-quy3ri` (11c96bc = v0.4.4).
Read docs/HEROES.md (captives, mini game contract, map hints, MiniGameMenuScene, Link's keep as the
reference for a hero-styled mini game) and docs/WORLD_MAP.md.

## Owner decisions
- Mega Man is found in a SPACE STATION reached from 3-1's coin heaven (3-1-sky, night theme).
- Entrance = a HIDDEN TELEPORTER: past the end of the cloud floor a coin trail leads to a hidden block;
  bumping it reveals a Mega Man-style teleport pad; stepping on it beams you up (Mega Man's beam-in
  streak) to the station. Deliberately different from Link's vine.
- Mini game = a short station STAGE + BOSS in NES Mega Man style, playing AS Mega Man, ending in a fight
  with "DARK MEGA MAN" (the brainwashing copy of himself) behind a boss gate with the classic filling
  life bar.
- Kit: buster + charge + slide at start (helmet kit), and one weapon capsule mid-stage that unlocks the
  Saw Disc (existing weapon — NO new weapon code; Mega Man's arsenal lives in src/game/characters/megaman/).
  The boss takes `weapon` and buster damage.

## Contracts
- Theme `station` (M3 registers it: src/game/level/schema.ts THEMES + themeMusic, tile palette
  `tiles-station` and `<tile>@station` frames in src/content/sprites/tiles.ts, SKY.station in
  src/game/world/tile-render.ts, enemyPalette/decorPalette defaults, themes.test.ts). Station tiles to
  restyle at least: ground, hard (block), brick, and the ones a platform stage uses (pipe pieces may
  stay). Until M3 merges, M1/M2 write their maps with `theme: castle` and switch to `station` when told.
- Sheet `station` in src/content/sprites/station.ts (exports `stationDef`, `stationPalettes`, registered
  in src/content/sprites/index.ts). Frames (16×16 unless noted): pad-0, pad-1 (16×8 teleport pad, glow),
  beam-0, beam-1, beam-2 (16×32 teleport streak), hopper-0, hopper-1, turret-0, turret-1, drone-0, drone-1,
  pellet (8×8 enemy shot), capsule-0, capsule-1 (weapon capsule), shutter (16×16 boss door tile piece),
  window (48×32 decor: stars + Earth), console (32×16 decor), girder (16×16 decor).
- Palette `megaman-dark` in src/content/sprites/megaman.ts (same index roles as `megaman`): dark/shadow
  armour, glowing red eyes area if possible within roles.
- Music (src/content/music/songs.ts): `mm-station` (stage loop, fast arpeggiated Mega Man-style lead,
  original), `mm-boss` (short tense loop). SFX (src/content/sfx/sfx.ts): `boss-fill` (one tick of the life
  bar filling, repeatable), `beam` (teleport), `capsule` (weapon get). Add to tests.
- Until M3 merges, code must not throw on missing frames/sfx (fall back to rects / silence; remove when told).
