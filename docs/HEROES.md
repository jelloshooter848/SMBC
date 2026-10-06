# Freeing the heroes (campaign, 0.5.0)

Bowser has brainwashed the heroes of other worlds. A new campaign file starts with **Mario
only**; every other hero is a captive somewhere in the campaign, and talking to one starts a mini
game themed on that hero's own game. Passing it frees the hero, who joins the file's roster.

## Freed heroes (`SaveFile.freed`)

- Save format v3 (`src/game/save/save-files.ts`): `freed: string[]`, CharacterDef ids, Mario
  always first. `newSave(slot, 'mario')` gives `['mario']` (a file made with other heroes frees
  them too). Validation keeps known ids only, each once, and always Mario; a value that is not
  an array falls back to Mario plus the file's heroes.
- Migration v2 → v3 (`migrateV2toV3`): older files are locked too. They keep Mario plus the
  hero(es) they last used (`character`, `character2`), deduped, with nulls and unknown ids dropped.
- `Game.freed` carries the list for the open file (`openFile` loads it, `autosave` writes it).
  `Game.heroLocked(def)` is true only in campaign mode (`game.campaign !== null`) for a hero not
  in the list. Dev starts, `?level=`, custom and shared levels and editor play-tests keep
  every hero. `Game.freeHero(id)` adds a hero and saves at once.
- A file whose current hero is locked (hand-edited) falls back to Mario when it opens.
- Dev mode's map menu **All heroes** (`SaveFile.devAllHeroes`, missing = off) makes `heroLocked` false for every hero while dev mode is on; it never writes `freed`, and turning it off restores the real roster (a player on a locked hero goes back to Mario).

### Character select

Locked heroes are drawn as black silhouettes with a grey rim (the `~silhouette` and `~rim`
palette effects) and `???` under them. Left/right skip them, and the screen and the announcer say
how many heroes are still to be found. Every pick follows the same rules: entering a level from
the map, the pick after a death, warps, and both players' picks on a two-player file.

### Palette effects

`PaletteBook.fx` (`src/engine/gfx/palette.ts`) recolours a whole palette when a sheet is asked
for with `<palette>~<fx>` (for example `assets.sheet('mario', 'luigi~silhouette')`). The effect
runs on the palette of the active colour mode, so colour-blind modes and asset-pack palette
overrides still apply. Effects chain left to right (`luigi~brainwashed~silhouette`), and an
unknown effect is an error. The effects are `silhouette`, `rim`, `brainwashed` and
`brainwashed-glow` (`src/content/sprites/palette-fx.ts`). A pack image that replaces a sheet does
not replace its `~fx` variants (`applyPack`): they stay the built-in art recoloured, so a pack
can't unhide a locked hero.

## The captive entity

```
[entities]
captive 13 6 hero=luigi
```

- `x y`: the tile the hero's feet stand in, so the hero stands on the tile below it.
- `hero`: a CharacterDef id that has a mini game (`miniGameFor`).
- It draws the hero's own idle sprite (its `sprite()` and sheet) in a dark purple trance with a
  slow one-pixel sway. A lighter pulse is added unless reduce flashing is on. It has no
  collision and never despawns.
- It spawns only in campaign play (`World.captives`, set by LevelScene), and only while that hero
  is not freed on the file.
- **Talking:** a player on the ground within 1.5 tiles (24 px, same floor) sees `TALK` with an
  up arrow above it, and the announcer says "Luigi. Up to talk." each time a player comes into
  reach. Pressing **up** talks (`World.checkTalk` raises a `talk` event). Up was
  picked because every control scheme has it, including the touch d-pad, so no face button
  changes its label or meaning. Heroes that also use up on the ground (Samus and Bill aim up)
  just talk as well while in reach. It does nothing on a vine.

Luigi waits in the 1-1 bonus room on a hard-block ledge at the top right (row 7, columns
12-14), 48 px above the top of the coin bricks. From the bricks a running or walking jump reaches
it for every hero but Ryu, who climbs walls instead (`tests/sim/heroes.test.ts` scripts Mario there).

Link waits beside the temple doorway of the 2-1 sky ruins (`2-1-sky2`, column 30 on the cloud floor; TALK shows against the sky there), reached by the hidden vine block (`7` in maps) over the middle cloud platform past the end of the 2-1 coin heaven; the drop at the ruins' right end lands in 2-1 at column 162 like the coin heaven's (`tests/sim/heroes-link-sky.test.ts`, `tests/sim/sky-ruins.test.ts`).

## The map hint (`src/game/map/captives.ts`)

The world map hints at levels that still hide a hero, in three stages (campaign play only, read
from the file's `cleared` and `freed`):

1. **Before the level's node is cleared:** nothing.
2. **Cleared, the hero not freed yet:** the hero's idle sprite as a faint silhouette peeking from
   behind the node (drawn before the dot, so the dot hides part of it). Its colour is the page's
   ground shade lifted a little toward the ground colour (`<palette>~shade-<theme>`, `mapShadeFx`
   in `palette-fx.ts`), so it is just barely visible. Every 6 seconds it shimmers faintly toward
   the trance's lilac for half a second (`~shade-<theme>-glow`); never with reduce flashing.
   Standing on the node, the announcer adds "Someone is hiding in this level." to the node's name
   and the hint line shows `SOMEONE IS HIDING IN THIS LEVEL`. Nothing says where in the level.
3. **Freed:** the hero stands beside the node in full colour, facing it, with a small idle hop.
   A hero freed some other way (a file started with that hero) shows here too, once the node is
   open.

Where heroes hide is found from the level data alone (`hiddenHeroes()`): every `captive` entity
of every bundled level, through its level's `parent` chain to the main level, to the map node
that names it (`rules.findLevelNode`). So a new captive gets its hint with nothing else to write.
The hero stands on the right of the node unless a road leaves it to the right (then the left);
a node can choose with `heroSpot: 'left' | 'right'` (`MapNode`). Dev mode's "All heroes" never
shows a trophy (it does not touch `freed`), and "Unlock all" shows no silhouette (it opens nodes
without clearing them). Toad's greeting in 1-0 tells the player where heroes hide (pipes, vines,
hidden blocks) and to look closely at the map for a level hiding someone missed.

## The unlock flow (`src/game/scenes/free-hero.ts`)

Every step is a scene pushed over the paused level, so the level's clock and world stand still:

1. Dialogue cards in a box over the level. The hero says "...LUIGI SERVES KING KOOPA..." and then
   the challenge (per hero in `DIALOGUE`, with a generic line built from the title, wrapped to
   the box). The challenge names the hero of the player who talked (player 2's in co-op). OK, B
   or MENU goes on; the box shows OK once it takes input, and each card is announced with "OK to
   continue."
2. A rules card: `MiniGameDef.title` and `rules`. It waits for OK; it never starts the round by
   itself.
3. One round: `def.create(game, done)` is pushed.
   - `pass`: the "LUIGI IS FREE!" card. The hero is added to `freed` and saved at once, and
     the captive leaves in a puff. Then back to the level.
   - `fail`: TRY AGAIN? YES starts a fresh round (a new `create`), NO goes back with the captive
     still there.
   - `quit`: back to the level.
4. Back: the level resumes exactly as left, with its music restarted. The press that closed the
   last card does not make the hero jump. The run's GameState is restored after each round, so
   a mini game cannot change lives, power or score.

## The `MiniGameDef` contract (`src/game/minigames/types.ts`)

```ts
interface MiniGameDef {
  hero: string; // the CharacterDef id it frees
  title: string; // rules card and announcer, e.g. 'MIRROR RACE'
  rules: string[]; // rules card lines: ability names, never button letters, at most 26 columns
  create(game: Game, done: (result: 'pass' | 'fail' | 'quit') => void): Scene;
}
```

- `create` builds one round as a scene. The flow pushes it and pops it (along with any scenes
  the round pushed itself) when `done` is called. `done` must be called exactly once.
- The round owns its music, touch labels and its own menu (Continue / Give up → `done('quit')`).
- Register it in `MINIGAMES` (`src/game/minigames/index.ts`). The flow looks it up only through
  `miniGameFor(hero)`, so a mini game folder can be replaced, for example by one in the hero's
  own game style, without touching the flow.

## Adding a captive (checklist)

1. A `MiniGameDef` for the hero in `src/game/minigames/<hero>/`, registered in `MINIGAMES`.
2. Optionally, the hero's own challenge lines in `DIALOGUE` (`free-hero.ts`).
3. `captive x y hero=<id>` in a campaign level's `[entities]`, on a spot the player can reach.
   Prove it with a sim.
4. Check the map hint on its node's page: the silhouette and trophy must not cover a road or
   decoration (set the node's `heroSpot`, or move the decoration). No other wiring is needed.

## Link's mini game: the Shadow Keep (`src/game/minigames/link/`)

A small dungeon in the style of the first Zelda game, the spell's prison in Link's mind. You play
Link (overhead, four-way walking on a half-tile grid, three hearts taken in halves). He starts
with only his sword: a stab hits the whole tile in front of him plus 4 px to each side (and 6 px
back into his own tile), is out for 12 of its 14 frames, and wins ties: a monster the blade
touches is knocked back and does no touch damage that frame, so monsters coming in at an angle
meet the blade (owner feedback: "attacking with the sword is flawed"). Items, Zelda style: an
item box labelled ITEM beside the SWORD box on the HUD; SPECIAL uses the item in it, SELECT
switches items; touch labels SWORD, the item's name (BOOMERANG / BOMB, hidden while it can't be
used), ITEM (with two items) and MENU. Walking into a chest opens it; Link holds the prize up for
a moment while the room waits, with a banner and announcement saying how to use it (`item-get`).

Eleven rooms, in order: the start (the wake-up line), bats, the cellar (a chest with the
**boomerang**: flies five tiles along Link's facing and back, one out at a time, stuns monsters
for three seconds, the keeper for half a second; brings back hearts, keys and bombs it touches),
a push-block room (one loose block onto a plate opens the shutter; if it gets stuck, leaving and
coming back puts it back), skeleton knights (two hits each; the key appears when they are gone),
a locked door into a room whose shutters open when every monster is gone (a **heart container**
appears there too: three hearts become four, all refilled), the armory (a chest with **bombs**:
four, up to eight, refills dropped by monsters; set one down in front, it blows after 1.5 s,
2 damage to monsters and half a heart to Link within a tile and a half, and opens **cracked
walls**; statues point at the cracked west wall), behind it the secret shrine (a chest with the
**shield**: from then on it stops rocks from the front while not stabbing; spells it can't),
rock-spitters with a floor switch behind water (it opens the way on and shows a heart refill), the
keeper (drifts across the top, glows, then fans three spells at Link; eight hits, a bomb counts
two; its name shows between it and Link; its spells vanish when it falls) and the shining exit.
The cellar and the shrine are side rooms; only the shrine is hidden. Exit reached: `pass`; no
hearts left: `fail` after the death spin; menu Give up: `quit`. Hearts, keys and items live in the
keep, never in `game.state`. Music `dungeon` and `keeper`; sounds `secret` (also a wall breaking
open), `sword-stab`, `door-open`, `key-get`, `item-get`, `boomerang`, `bomb-fuse`, `bomb-blast`,
`select`. Dev mode's assists apply: **No damage** (`invulnerable`) keeps Link's hearts against
monsters, rocks, spells and his own bombs (he is still knocked back), read each time he is hurt,
so switching it mid-round counts at once; **slow motion** slows the whole loop, the keep
included; the others have nothing to act on here.
Dev: `?minigame=link` (the scene is `window.__miniGame`; `world.warpTo(roomId, x, y)` jumps,
`world.grant('bomb')` gives an item, a pickup kind or `shield`).

Difficulty (a "cautious human" sim, `human-sim.test.ts`: the bot's plan seen through a 15-frame
reaction delay, monster positions misjudged by up to 4 px, pauses and early swings; `KEEP_SIM=30
pnpm vitest run human-sim` prints the report): before v2 it escaped 40% of 30 seeds (70% at a
12-frame reaction, 27% at 18), mostly falling to the keeper; with v2 about 95-100%, losing about
two of four hearts to the keeper, which got two more hit points to keep it a fight.

### The top-down kit (`src/game/topdown/`)

Reusable for later top-down mini games; it knows no particular game.

- `room.ts`: rooms as 11 strings of 16 characters (legend in the file: walls, blocks, water,
  doors `O`/`L`/`X` on the border, spawns such as `b` `n` `r` `P` `o` `_` `k`). Room options:
  `shutters` and `reveal` conditions (`clear`, `plates`, `switches`, `torches`), `music`, `hint`,
  `dark`. `buildDungeon` checks that every door meets a doorway that lines up in the next room.
  North and south doorways are two cells holding one 16-px door in the middle (its jambs are solid).
- `world.ts`: `TopDownWorld` (seeded `Rng`, deterministic): tile collision per mover (hero,
  walkers, flyers, shots, blocks), doors and keys (a key opens both sides of a locked door),
  shutters that close once the hero has stepped in, room memory (conditions met stay met,
  cleared rooms stay empty, a solved block stays put, an unsolved one resets), room slides and
  events for the game to turn into sounds and announcements. The update order is documented there.
- `hero.ts`, `entity.ts`, `enemies.ts`: the hero (corner rounding into gaps, `swordReach`, a
  `shield` flag, the throw and hold-up poses, `-ns` frames without the shield), enemies with
  knockback, stuns (`stunFor` lets a boss shorten them), invulnerability and drops (bat, knight,
  spitter), shots, pickups (`heart`, `key`, `heart-container`, `refill`, `shield`, ammo, items),
  chests (`c`, contents in the room's `chests`), push blocks, switches, torches. A game adds its
  own spawn kinds (the keeper) through `spawners`.
- `items.ts`: `TdItem` (label, icon, optional ammo, `ready`, `use`), the `Inventory` (owned items,
  the slot, SELECT cycling, ammo caps), and the kit's boomerang and bombs with the `Explosion`
  entity (`world.blast` hurts monsters and the hero in a radius and opens cracked walls).
  Cracked walls (`C`) are a tile kind: inside a room a wall cell, on the border a doorway (door
  kind `cracked`, opened on both sides by a blast); `wall-cracked` / `wall-hole` frames.
  `world.grant(what)` gives anything; `noDamage` (a world option) keeps the hero's hearts.
- `render.ts`, `hud.ts`, `frames.ts`: tiles drawn for the north wall are flipped for the south
  and rotated for the sides (`withSideFrames` derives `-side` and the doorway halves `-l`/`-r`
  when the sheet is registered); the Zelda-style HUD (map, keys and ammo, item boxes, life).
- `bot.ts`: a breadth-first-search player driven by a per-room plan (a list of steps, or a
  function of the world for rooms passed twice): fights (stunning with a boomerang it owns),
  pushes, opens chests, bombs walls. `CautiousBot` wraps it as a cautious first-time player for
  difficulty tuning.

## Hero training (optional practice rooms)

Mario's tutorial is stage 1-0. Every other hero has an optional practice room (owner decision:
"tutorials other than Mario's can be optional"). Code: `src/game/tutorial/`.

- **The question.** The first time a hero other than Mario is picked on a file (entering a level
  from the map, the pick after a death, player two's pick), "<HERO> TRAINING?" asks YES / NO
  (`TrainingQuestionScene`, announced). YES plays the room, then the pick goes on exactly as it
  would have (the level starts, or the respawn); NO goes on at once. Either answer is recorded and
  saved at once, so each hero is asked once per file. Never asked outside campaign play, in an
  editor play-test, for Mario, or for a hero the file has not freed (one picked through dev mode's
  "All heroes" keeps its real question for when it is freed). The hook is in
  `CharacterSelectScene` (`needsTraining`, `askTraining`), so every campaign pick follows it. After
  the room the map's music comes back (`HeroPick.music`) for player two's pick.
- **The save.** `SaveFile.tutorials?: string[]`: hero ids whose question was answered, each once,
  known ids only. It is optional (no format bump); validation (and `openFile`) adds the file's
  current `character` / `character2` when freed, so players already using a hero are never
  interrupted.
  `Game.tutorials` carries it, `Game.answerTraining(id)` records and saves.
- **Pause → Training.** In a campaign level the pause menu offers Training (one entry per hero
  in co-op, Mario excluded). The room plays over the paused level; afterwards the pause menu
  closes and the level goes on as it was left (its clock stood still, its music restarts).
- **The room.** `src/content/levels/practice.map`, one locked screen loaded with `?raw` (kept out
  of the level library and the dev select): a floor, a step up to a high ledge, a brick row with a
  ? block, a target dummy (`dummy x y` in the map; `TargetDummy` never moves or hurts, pops after
  three hits and comes back), a gap (falling in puts the hero back at the start) and a tall wall to
  cling to. It runs in a World of its own with a fresh GameState for the hero and its full kit
  (`devKit`: Mega Man's helmet, Samus's missiles, Simon's sub-weapons...), and the run's GameState
  is snapshotted and restored around it (as the mini games do), so lives, score and power are never
  touched. Hit points stay topped up, so nothing in the room can end it. The HUD shows TRAINING
  where WORLD and TIME go, and no score or coins (`drawHud`'s `place` option).
- **Lessons** (`lessons.ts`). `TrainingLesson { id, prompt, done(tracker), setup?(room) }` per hero in
  `LESSONS`; `MoveStats` watches the player and world each frame (jumps and their height,
  ground speed and glide, attacks, shots by kind and direction, charge shots, slides, crouching,
  tool changes, wall cling and wall jumps, scratch flags like the morph ball, bombs, shield blocks,
  gap crossings, and how the dummy was hit). The tracker is reset when a lesson comes up, so each
  is done while its prompt shows. Prompts name abilities as the guide and touch buttons do (never
  button letters); a button's ability is written `[SHOOT:attack]` and shown through `abilityHint`
  ("SHOOT (X)" with keys or a pad, "SHOOT" on touch), falling back to the bare names when that
  would not fit 3 lines of 25 columns (`promptText`). They come one at a time in a centred box
  under the HUD (`drawRoomBox`: the stage tutorials' `drawPromptBox` from `stage-prompts.ts`,
  24 px margins, with a green tick), announced; each ticks off with a sound and GOOD!, and after
  the last READY! ends the room. MENU in the room: Continue / Skip training. Walking, jumping and
  the basic attack never tick a move lesson (tested per hero): Luigi's stop counts only from a run,
  Bill's aim counts once per shot (a Spread fan is one direction) and needs two aimed directions.

| Hero     | Lessons                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| Luigi    | high jump, slippery stop, fireball (the lesson gives fire power)                            |
| Link     | sword, down-thrust, up-thrust, shield blocks the dummy's shot, boomerang (USE TOOL / TOOLS) |
| Mega Man | buster, slide, charge shot, special weapon (WEAPON, USE WEAPON)                             |
| Samus    | beam, aim up, morph ball, bomb, missile                                                     |
| Simon    | whip, crouch whip, sub-weapon (THROW), the committed jump over the gap                      |
| Ryu      | sword slash, wall cling, wall jump, ninpo (CAST)                                            |
| Bill     | shoot, 8-way aim (three directions), prone, jump and shoot                                  |

To add a hero's training: a list in `LESSONS` (3-5 lessons, tested by
`src/game/tutorial/lessons.test.ts`) and a scripted run in `tests/sim/training-room.test.ts`.
