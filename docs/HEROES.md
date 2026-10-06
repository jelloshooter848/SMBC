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

## Hero training (optional practice rooms)

Mario's tutorial is stage 1-0. Every other hero has an optional practice room (owner decision:
"tutorials other than Mario's can be optional"). Code: `src/game/tutorial/`.

- **The question.** The first time a hero other than Mario is picked on a file (entering a level
  from the map, the pick after a death, player two's pick), "<HERO> TRAINING?" asks YES / NO
  (`TrainingQuestionScene`, announced). YES plays the room, then the pick goes on exactly as it
  would have (the level starts, or the respawn); NO goes on at once. Either answer is recorded and
  saved at once, so each hero is asked once per file. Never asked outside campaign play, in an
  editor play-test, or for Mario. The hook is in `CharacterSelectScene` (`needsTraining`,
  `askTraining`), so every campaign pick follows it.
- **The save.** `SaveFile.tutorials?: string[]`: hero ids whose question was answered, each once,
  known ids only. It is optional (no format bump); validation adds the file's current
  `character` / `character2`, so players already using a hero are never interrupted.
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
  touched. Hit points stay topped up, so nothing in the room can end it.
- **Lessons** (`lessons.ts`). `Lesson { id, prompt, done(tracker), setup?(room) }` per hero in
  `LESSONS`; `LessonTracker` watches the player and world each frame (jumps and their height,
  ground speed and glide, attacks, shots by kind and direction, charge shots, slides, crouching,
  tool changes, wall cling and wall jumps, scratch flags like the morph ball, bombs, shield blocks,
  gap crossings, and how the dummy was hit). The tracker is reset when a lesson comes up, so each
  is done while its prompt shows. Prompts name abilities as the guide and touch buttons do (never
  button letters), at most 3 lines of 28 columns, one at a time in a box near the top, announced;
  each ticks off with a sound and GOOD!, and after the last READY! ends the room. MENU in the
  room: Continue / Skip training.

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
