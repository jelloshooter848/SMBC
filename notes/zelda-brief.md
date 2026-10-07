# Link's mini game: "Escape the Shadow Keep" (a Zelda-style top-down dungeon) — shared brief
Project conventions: read /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, commit trailers, never commit node_modules, no CHANGELOG edits, ability
names not button letters, announcer, reduce flashing). Mini game contract: src/game/minigames/types.ts
(`MiniGameDef { hero, title, rules, create(game, done) }`, `done('pass'|'fail'|'quit')` exactly once,
own menu Continue / Give up). Reference implementation: src/game/minigames/luigi/ (race.ts, its menu,
touch labels, music handling, tests). Unlock flow: src/game/scenes/free-hero.ts (not yours to change).
Docs: docs/HEROES.md.

## Owner decisions
- Link's mini game is a **top-down dungeon in the style of the first Zelda game** (overhead view,
  four-way movement, rooms you walk between, puzzles and monsters), not a side-scroller.
- **You play as Link**, trying to escape the brainwashing: the dungeon is the spell's prison in his
  mind. Reach the end (beat the keeper, take the exit) to break the spell and free him.
- All art and music are original, drawn in the style of an NES Zelda game (palette limits, 16×16
  tiles, a Zelda-like HUD with hearts and keys and a small map), never copied.
- The engine is the existing one (256×240, scenes, renderer, sprite sheets as text pixel arrays,
  palettes, MML audio, input, touch labels). The top-down code is a **reusable kit** so later
  top-down mini games can use it.

## Shape of the dungeon (Z1 builds it, small but real)
6–8 rooms on a grid, each room one screen: 16×11 tiles of 16 px in the play area (y 64–240) under
a 64-px HUD (hearts, key count, sword icon, a 4×4 minimap with the current room). Moving through a
doorway slides the view to the next room (Zelda style). Content, in roughly this order:
1. Start room with a short intro line ("LINK... WAKE UP... THE SPELL HOLDS YOU HERE").
2. A room of bats (fly erratically) — learn the sword.
3. A push-block puzzle: push the one loose block to open the shutter door.
4. Skeleton knights (walk, turn, take 2 hits) guarding a key.
5. A locked door (uses the key); a room where the shutters open only after every monster is gone.
6. A rock-spitter room (fire rocks in straight lines; the shield blocks them from the front while
   standing still, like Zelda) with a floor switch puzzle (stand-on switch opens a door, or two
   torches/statues to light).
7. The keeper: a boss room (a shadow-spell creature, original design) with a simple pattern and
   several hits; a heart container style refill before it.
8. The exit: a shining doorway → `done('pass')`.
Link: 3 hearts (half-heart damage), sword stab in the facing direction (Zelda 1 style), shield
blocks frontal projectiles while not attacking, knockback and invulnerability flicker on hit.
Hearts drop from monsters sometimes. Falling to 0 hearts → `done('fail')` after a short death
spin. The menu button opens Continue / Give up.

## Art contract (frame names; Z2 owns the real art in src/content/sprites/dungeon.ts)
Sheet `dungeon` (16×16 unless noted), palette `dungeon` (+ `dungeon-dark` for the boss room if wanted):
floor, floor-alt, wall, wall-top, wall-corner, door-open, door-locked, door-shut, block, statue,
stairs, switch-up, switch-down, torch-0, torch-1, torch-off, chest, exit-0, exit-1, water,
key (8×16), heart (8×8), heart-half (8×8), heart-empty (8×8), heart-pickup (8×8), sword-icon (8×16).
Doors are drawn for the north edge; render rotates/flips for the other sides (or name extra
frames `door-*-side` if rotation looks wrong — tell the other agent).
Sheet `link-td` (16×16), palettes `link-td` and `link-td-hurt-0/1`: down-0, down-1, up-0, up-1,
side-0, side-1 (facing right; flipped for left), attack-down, attack-up, attack-side, and the
sword blades `sword-v` (8×16, pointing up; flipped vertically for down) and `sword-h` (16×8,
pointing right).
Sheet `dungeon-enemies`, palette `dungeon-enemies`: bat-0, bat-1, knight-down-0, knight-down-1,
knight-up-0, knight-up-1, knight-side-0, knight-side-1, spitter-down-0, spitter-down-1,
spitter-side-0, spitter-side-1, rock (8×8), keeper-0, keeper-1, keeper-hit (32×32), spell-0,
spell-1 (8×8, the keeper's shot), poof-0, poof-1, poof-2.
Register sheets and palettes in src/content/sprites/index.ts (SPRITES + defaults).
Music (Z2): `dungeon` (Zelda-dungeon mood, original MML in src/content/music/songs.ts, looping) and
`keeper` (boss loop), plus sfx `secret` (a puzzle-solved chime), `sword-stab`, `door-open`,
`key-get` in the sfx module the game already uses; add them to the music/sfx tests.

## Until Z2 merges
Z1 renders with these names. If a frame is missing, Z1 may add a stub `src/content/sprites/dungeon.ts`
with the full frame list as simple flat placeholders that pass validation; Z2's file replaces it
wholesale at merge (same path, same exports: `dungeonDef`, `dungeonPalettes`, `linkTdDef`,
`linkTdPalettes`, `dungeonEnemiesDef`, `dungeonEnemiesPalettes`). Z2 keeps exactly those export names.
