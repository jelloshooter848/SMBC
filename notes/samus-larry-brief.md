# 4-2 secrets batch: Samus's cavern + Larry Koopa (owner said GO) — shared brief
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, trailers, never commit node_modules, no CHANGELOG edits, ability names not
letters, announcer, reduce flashing, failing tests first). Base: `git merge claude/admiring-galileo-quy3ri`
(d3ad397 = v0.4.5). Read docs/HEROES.md (captives, MiniGameDef, MiniGameMenuScene, map hints, Link's keep and
Mega Man's Station Escape as references, WorldStart.extraEntities hook) and docs/WORLD_MAP.md (secret exits:
each exit opens only its own road; `exit: 'secret:<key>'` paths; teleport zones; `sheet:frame` decor).
Campaign variants of warp zones live in src/game/level/campaign.ts (1-2's `secret` warp shows ONE pipe).

## Owner decisions
- 4-2's two warp zones stop being warp zones IN THE CAMPAIGN (non-campaign play keeps the original warps).
  The owner wants all warp pipes gone eventually.
- UPPER zone (4-2-warp, the vine sky, pipes at 50/54/58): ONE pipe, no warp numbers, NO map road. It leads
  down into SAMUS'S AREA `4-2-cavern`: a Metroid-style cavern (blue rock, bubble doors, a Chozo-statue
  chamber) with `captive x y hero=samus`, and a way back into 4-2.
- Samus's mini game "ZEBES ESCAPE": play AS SAMUS (existing CharacterDef + kit: morph ball, bombs, missiles,
  beams — no new weapon code). A self-destruct countdown; climb vertical shafts, roll through morph-ball
  tunnels, bomb through walls, reach the ship before time runs out. Needs a camera that follows vertically
  (new engine work, minimal and generic).
- RIGHT zone (4-2.map warp at 208, pipe 214): in the campaign ONE pipe leading to LARRY KOOPA's airship
  cabin `4-2-airship` (SMB3 Koopaling with a magic wand; his stolen wand brainwashed the heroes — story).
  SMB3-style boss fight in the platformer engine: Larry hops around, fires wand blasts (rings that travel in
  a line toward Mario), retreats into his shell and slides; 3 stomps (fireballs/other heroes' attacks also
  work, SMB3-ish hit counts). Beating him:
  1. CRYSTAL BALL: Larry drops it; touching it ends the area. From then on the world map shows the
     silhouettes of EVERY not-yet-freed hero (by their hidden levels) even before those levels are cleared.
  2. A NEW MAP ROAD on World 4 (a secret exit of 4-2: `secret:larry`) to an SMB3 BONUS SPOT that ROTATES
     between Toad House (pick 1 of 3 chests), N-spade memory match (flip two at a time; two misses end it),
     and the spade slot game (stop three reels; one try). A wandering HAMMER BRO guards it on the map,
     SMB3-style; touching him starts a one-screen Hammer Bro battle; beating him reopens the bonus for
     another go (the bonus is one-shot until then).
  3. SMB3 ITEM INVENTORY unlocked: prizes (mushroom, fire flower, star, 1-up) are stored on the save file
     and used from the world map before entering a level (applied to the hero entering). Dev mode can unlock
     the inventory immediately (world-map dev menu toggle).
- Locks/captives/hints only in campaign; dev select/?level= play stays as is.

## Shared names (contract)
- Areas: `4-2-cavern` (C1), `4-2-airship` (L1). Campaign pipe targets: upper → `4-2-cavern <x> <y>`,
  right → `4-2-airship 2 12` (C1 wires the pipes; L1 owns 4-2-airship.map).
- Secret keys: `larry` (beat Larry → secrets += 'larry'); the bonus node's `unlock: 'larry'`.
- Save fields (L2): `inventory?: string[]` (item ids), `inventoryUnlocked?: boolean`, `bonusOpen?: boolean`
  (or similar; optional, no format bump). Dev toggle `devInventory`.
- Themes: `cavern` (S3), `airship` (L3). Until art lands use `castle`/`underground` and switch when told.
- Sheets: `zebes` (S3) — chozo-0/1 (32×32 statue), ship (64×32), bubble-door (16×48), zoomer-0/1, ripper-0/1,
  skree-0/1 (16×16 enemies), alarm-0/1 (16×16 wall light), escape-hud (if needed; else rects).
  `smb3` (L3) — larry-0/1 (16×24 stand/hop), larry-shell-0..3 (16×16), larry-hurt (16×24), wand-blast-0/1
  (16×16 ring), crystal-ball (16×16), chest-closed/chest-open (16×16), card-back, card-mushroom, card-flower,
  card-star, card-1up, card-coin10, card-coin20 (16×24), slot-mushroom-top/mid/bot, slot-flower-*,
  slot-star-* (32×16 reel thirds), hammer-bro-map-0/1 (16×16), node-toad-house, node-spade (16×16 map
  icons), item-mushroom, item-flower, item-star, item-1up (16×16 inventory icons), toad (reuse existing if
  present). Map icons may instead go in the existing `map` sheet if that's the convention — say so.
- Music: `zebes-escape` (urgent escape loop), `cavern` (Brinstar-mood ambient, original) (S3);
  `airship` (SMB3-airship-mood, original), `smb3-boss`, `toad-house`, `bonus-game` (L3).
- SFX: `alarm` (S3); `card-flip`, `slot-stop`, `bonus-win`, `item-use` (L3). Unknown ids must not throw
  until merged.
