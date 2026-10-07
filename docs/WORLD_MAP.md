# World map pages, the Warp Zone hub and the Lost Levels (contract, 0.4.0)

The world map is a set of **pages** (one screen each, 16×15 tiles of 16 px) joined by roads and
warps. This file is the contract between the map engine, the page content and the save files.
Read it before adding or changing a page.

## Files and owners

| File                                                                                  | What                                                                                | Owner                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/game/map/types.ts`                                                               | The types below                                                                     | engine (H0); change only by agreement                |
| `src/game/map/rules.ts`                                                               | Open/locked rules, clears, warps, conditions, d-pad steps                           | engine (H0)                                          |
| `src/game/scenes/world-map.ts`                                                        | Drawing, walking, slides, fades, warp jumps, the hint line, the Worlds menu         | engine (H0)                                          |
| `src/game/save/save-files.ts`                                                         | Save format v2 (`pages`, `position.page`), migration from v1                        | engine (H0)                                          |
| `src/game/level/campaign.ts`                                                          | Campaign-only level variants (the 1-2 warp zone's one pipe)                         | engine (H0)                                          |
| `src/content/worldmap/index.ts`                                                       | The page registry (`MAP_PAGES`, `mapPage`, `pagesInGroup`, `levelPage`, `isPageId`) | engine (H0)                                          |
| `src/content/worldmap/world1.ts` .. `world8.ts`                                       | The 8 SMB pages                                                                     | SMB (unchanged in 0.4.0 but for World 1's warp spot) |
| `src/content/worldmap/hub.ts` (`HUB_PAGE`)                                            | The Warp Zone hub page                                                              | **hub art agent**                                    |
| theme additions in `types.ts` (`MapTheme`), `render.ts`, `src/content/sprites/map.ts` | A new hub theme                                                                     | **hub art agent** (one `MapTheme` line)              |
| `src/content/worldmap/lost/` (`LOST_PAGES`, one file per page)                        | The 13 Lost Levels pages                                                            | **Lost Levels pages agent**                          |
| Lost Levels campaign play (`game.ts` Lost Levels endings, `level.ts` hooks)           | Playing `ll-*` levels from the map                                                  | **Lost Levels campaign agent**                       |

The registry spreads `HUB_PAGE` and `LOST_PAGES` from their own files, so the hub and Lost Levels
agents never need to edit `index.ts`.

## Page ids, groups and labels

Every page has a string id (`PageId`), saved in files, never renamed:

| Ids                                          | Group (`PageGroup`) | Header `label`                                       |
| -------------------------------------------- | ------------------- | ---------------------------------------------------- |
| `smb-1` .. `smb-8`                           | `smb`               | `WORLD 1` .. `WORLD 8`                               |
| `hub`                                        | `hub`               | `WARP ZONE`                                          |
| `ll-1` .. `ll-8`, `ll-9`, `ll-10` .. `ll-13` | `ll`                | `LOST 1` .. `LOST 8`, `LOST 9`, `LOST A` .. `LOST D` |

- `label` (at most 10 chars, `A-Z 0-9 space`) shows at the header's top right; `title` (at most 20) at its top left. The announcer reads the label in title case ("Lost A") and the title.
- **Order within a group is the registry order** (`MAP_PAGES`): it sets slide directions and
  the Worlds menu order. Put `LOST_PAGES` in play order: 1-8, 9, A-D.
- Pages of one group are joined by world exits (a slide). Different groups are joined only by
  warp nodes (a fade); a start node's "walk back" road works only within its group.
- The Worlds menu lists the open pages of the current group plus the hub when open; on the hub
  it lists the open pages of every group.

## `WorldMapPage`

```ts
{
  id: 'll-1', group: 'll', label: 'LOST 1', title: 'GREEN MEADOW',
  theme: 'grass', music: 'map',
  tiles: autoShore(SKETCH),   // 15 rows × 16 legend chars (render.ts); rows 0-1 plain sky '.'
  nodes, paths, exits, actors,
}
```

- Exactly one node of kind `'start'` (where the page is entered by an exit or by a warp without
  `toNode`).
- Nodes sit on walkable tiles, rows 2-13 (row 14 is under the hint line).
- `paths` run tile by tile between two nodes, both ends included; `pages.test.ts` checks every
  registered page for this.
- Level nodes: `{ id, kind: 'level' | 'castle', level: 'll-1-2', x, y }`. `level` is the **main**
  level id (sub-areas count for it through their `parent`). Lost Levels ids are `ll-W-S` with W
  1..13 (`ll-10-1` is World A-1). The engine finds a level's page **by lookup**
  (`levelPage` / `rules.findLevelNode`), never by parsing the number.

## Nodes

| kind              | Meaning                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `start`           | The page's arrival node. May also carry the warp fields or a `level` (below). |
| `level`, `castle` | Enter `level` with JUMP. A castle clear opens the page(s) its exits lead to.  |
| `bonus`           | Hidden until `unlock` (a secret key) is found. JUMP plays the bonus game.     |
| `warp`            | JUMP warps to another page (see below).                                       |

A node with `unlock: '<key>'` (any kind) is hidden, with its road, until the file has that secret
(`MapProgress.secrets`). Bonus nodes always need one.

A level node whose level hides a captive hero shows the map hint beside it (docs/HEROES.md "The
map hint"): on its right, or its left when a road leaves to the right; `heroSpot: 'left' |
'right'` picks the side. Keep that side's tile free of decorations.

### World 1's start is a level: Mario's tutorial 1-0 (0.5.0)

- **A start node may carry `level`**: it stays the page's arrival node (id `start`), JUMP on it
  enters the level, and its roads count as walked only once that level is cleared
  (`rules.pathFromDone`). Only World 1's does: `level: '1-0'` (`world1.ts`), so a new file stands
  on 1-0 with 1-1 locked, and clearing 1-0 (or **Pause → Skip tutorial**, `Game.skipTutorial`)
  draws in `smb-1:start>1-1` and `smb-1:1-1`. The hero stays on `start`.
- The map treats it as a level node: header `WORLD 1-0`, the open/cleared node look, the
  announcer's "World 1-0, open".
- Entering it skips character select: the stage is played as Mario (`StageTutorial.hero`).
- **Old files** (no format change): a file that has cleared anything counts `1-0` as cleared on
  load (`save-files.ts withTutorial`), so 1-1 stays open. Their `position` / `lastNode` `start`
  is 1-0's node now, so nothing is remapped; a file with no clears standing past World 1's start
  (1-1 was open on a new file before 0.5.0) goes back to `start`.
- The stage itself, its lessons and the story: `src/game/tutorial/` (`stage-prompts.ts` is the
  reusable lesson/prompt part, `stage-tutorial.ts` the director, `mario-1-0.ts` the content) and
  `src/content/levels/world1/1-0.map`, `1-0-pipe.map`.

### Warp nodes

```ts
{ id: 'warp-lost', kind: 'warp', x: 13, y: 8,
  to: 'll-1',               // target page id (must be registered)
  toNode?: 'hub',           // arrival node there (default: its start node)
  oneWay?: true,            // optional: exempt from the 1:1 pairing
  requires?: 'gameCleared', // MapCondition; absent = always works
  label?: 'LOST LEVELS',    // hint line while open (default: the target page's title)
  hint?: 'LOST LEVELS - BEAT 8-4 TO UNLOCK', // hint line while locked (needed with `requires`)
  unlock?: 'bonus-1' }      // optional: hidden until this secret is found
```

- **Portals pair 1:1**: a warp X on page P lands on Q's `toNode` (or start), which must be a warp
  back to P whose `toNode` is X (`pages.test.ts`). A one-way portal sets `oneWay: true`; none do
  yet. Pads that never work (`requires: 'never'`) are exempt.
- A warp node is shown and walkable whenever a road to it is open (like any node), even locked.
- While the hero stands on it, the **hint line** (a black strip at the bottom of the map) shows
  `label` when it works, `hint` when locked; the announcer says it ("Warp, Lost Levels" /
  "Lost Levels - Beat 8-4 To Unlock, locked"). Keep both at most 32 chars.
- JUMP on an open warp: the target page opens (`progress.pages`), the map **fades** there, the
  hero lands on `toNode`, and the file is saved. JUMP on a locked one: the bump sound, nothing
  else.
- **A start node may carry `to`** (and `toNode`, `requires`, `label`, `hint`): it stays the
  page's arrival node, arriving there never warps, and JUMP on it warps. The hub's centre is
  one: arriving from World 1 lands on it, and it warps back to World 1's warp spot.
- Roads leaving a warp node count as walked while the warp works (`requires` holds).
- `rules.isWarpNode(n)` says whether JUMP on a node warps; `isWarpOpen` whether it works now;
  `warpText` gives the hint line.

### Conditions (`MapCondition`)

| Value            | Holds when                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `'gameCleared'`  | SMB 8-4 beaten on this file (`SaveFile.gameCleared`, `MapProgress.gameCleared`)             |
| `'secret:<key>'` | The file has found secret `<key>`                                                           |
| `'ll9'`          | The file has cleared all 32 Lost Levels main levels `ll-1-1`..`ll-8-4` (`LOST_NINE_LEVELS`) |
| `'llLetters'`    | The file has cleared Lost 8-4 (`ll-8-4`)                                                    |
| `'never'`        | Never: a future secret ("??? - A FUTURE SECRET")                                            |

Developer mode's **Unlock all** treats every condition as met **except `'never'`**, opens every
registered page (the hub included, so the Worlds menu lists it), and shows warp nodes hidden only
by their `unlock` key (World 1's warp spot) with their roads. Bonus nodes, and keyed warps that
have `requires: 'never'`, stay hidden until their secret is found. It writes nothing to the file: a warp
that works only through Unlock all travels without opening its page (`rules.warpRecords`).

## Secret exits: each exit opens its own road (0.5.0)

Super Mario World style (owner decision, 2026-10-06): a level with more than one ending opens a
different road with each, and **no ending opens every road leaving its level**.

- Every road (`MapPath`) leaving a node with a `level` belongs to one exit of that level
  (`rules.pathExit`): `exit: 'normal'` or `exit: 'secret:<key>'`. Without an explicit `exit` it is
  derived: `'secret:<key>'` when the road's `to` node is hidden by `unlock: '<key>'`, else
  `'normal'`. Only set `exit` when the derived one is wrong (none do yet).
- A **normal** road opens when the level is cleared (its flagpole or castle: `clearLevel`, which
  adds it to `cleared`). A **secret** road opens when its key is found while its level is
  reached (open): `rules.secretExit(progress, level, key)` records the key and puts the hero on
  the level's node, and does **not** add the level to `cleared`. A secret road also needs its `to`
  node's key, as before, so the normal exit never shows it.
- World exits (`WorldExit`, castle to next page) are always the castle's normal exit.
- Roads leaving a start node (World 1's 1-0 included) or a warp node are unaffected.
- **Map look**: a level beaten only through a secret exit is not cleared: it keeps the open
  look of its kind (a secret-exit level's pink dot, `map-node-secret`), its secret road shows
  where it went, and the announcer says "World 1-2, open, secret exit found"
  (`rules.secretExitTaken`; "..., cleared, secret exit found" once both are beaten). The
  file's level counter (`clearedMainLevels`, n/32) counts normal clears only, and a hidden
  hero's silhouette (map/captives.ts) still waits for the normal clear.
- **Old files**: nothing changes in the format. A file that cleared 1-2 through its pipe before
  0.5.0 has both `1-2` in `cleared` and `bonus-1` in `secrets`, so it keeps both roads; nothing
  re-locks.
- Today 1-2's campaign pipe is a secret exit (below), and so is Larry Koopa's crystal ball in
  4-2's airship (`secret:larry`, the road to World 4's bonus spot; "The bonus spot and its Hammer
  Bro" below). Every other warp pipe (SMB 4-2, the
  Lost Levels' warp zones, `workingWarps` / `warpsOpened`) still warps as in the original and
  clears nothing; the map's secret-exit look (`map/secret-exits.ts`) only marks levels that
  have another way out.

## World exits and the Lost Levels unlocks

```ts
exits: [{ from: 'll-8-4', to: 'll-9', side: 'right', points, requires?: 'll9',
           hint?: 'WORLD 9 - CLEAR 1-1 TO 8-4 {n}' }]
```

- An exit opens when its `from` node (a castle) is cleared **and** its `requires` holds. A
  castle clear (`rules.clearLevel`) opens the target page of every exit whose condition holds.
- Exits only lead to pages of the same group.
- `hint` (optional): the hint line while the hero stands on `from` and the exit is locked;
  `{n}` is filled in with the condition's count (`rules.conditionCount`: `'ll9'` → `31/32`). At
  most 32 chars once filled in. The announcer adds it to the node's name (`rules.exitHint`).
- Lost Levels pages unlock like SMB: levels open in order along the roads, a castle exit opens
  the next page. World 9: exit `ll-8-4 → ll-9` with `requires: 'll9'`. Worlds A-D: the warp node
  `warp-ll-10` on World 8, off the castle, with `requires: 'llLetters'` (A-D can open without
  World 9); then castle exits `ll-10 → ll-11 → ll-12 → ll-13`. Only World 1 has a warp node
  `hub` back to the Warp Zone (paired with the hub's Lost Levels pad); World A's pipe
  `warp-ll-8` leads back to World 8's pad. Worlds 2-9 and B-D have no other portals.
- Every condition reads the save file alone (campaign rules, owner decision for 0.4.0; the
  global NES progress store in `src/engine/save/progress.ts` is only for non-campaign play).
- A condition can come true after its castle was cleared (World 9 when the 32nd of Lost 1-1 to
  8-4 is cleared, wherever it is). `rules.openMetExits(progress)` opens those pages and returns the ids to
  draw in; `Game.showMap` calls it every time the map is shown, so nothing else is needed.

## Progress, reveals and saves

- `MapProgress`: `cleared` (main level ids beaten through their **normal** exit, `1-0` included
  once the tutorial is cleared), `pages` (open page ids, `smb-1` always), `secrets` (keys found,
  secret exits included), `position: { page, node }`, `gameCleared`.
- Reveal ids are page-qualified: `'<page>:<id>'` (`'hub:start>warp-lost'`, `'smb-1:1-4>smb-2'`); an
  exit's id is `'<from>><to page>'`. Each page draws in only its own when shown.
- `rules.findSecret(progress, key)` records a secret and returns what it reveals;
  `rules.warpTo(progress, page)` opens a page (warp pipes, warp nodes).
- Save files are **version 2**. The v1 → v2 migration (`migrateV1toV2`) turns `worlds: [n]` into
  `pages: ['smb-n']`, `position.world` into `position.page`, and converts `lastNode` keys and
  `pendingReveal` ids. Loading keeps only registered page ids. Any later change to the stored
  format appends a migration (docs/RELEASING.md).

## The 1-2 secret (campaign only)

- `1-2.map`'s warp zone carries `secret=bonus-1`. In campaign play (`Game.startLevel` with a file
  open) `level/campaign.ts` keeps only the middle pipe, unlabelled, removes the other two, and
  marks the pipe with the secret. Taking it is 1-2's secret exit (`Game.campaignSecret` →
  `rules.secretExit`, 0.5.0): it records `bonus-1` **without clearing 1-2**, returns to the World 1
  map and draws in only the road from 1-2 to World 1's warp spot; the road to 1-3 opens when 1-2 is
  beaten at its flagpole (before 0.5.0 the pipe also cleared 1-2). The warp spot is the old bonus slot, now at (5,11), a
  warp node to `hub`, hidden by `unlock: 'bonus-1'`. Until 0.4.0 the road came from 1-1: loading
  renames a pending reveal of the old road id `smb-1:1-1>bonus-1` (save-files.ts).
- Dev select, `?level=` and custom play keep the classic three numbered pipes.
- SMB 4-2's warp zones are unchanged (they still skip worlds); a `secret=` key on one is the hook
  for a future secret. Lost Levels warp zones (backward ones too) are unchanged.

## The bonus spot and its Hammer Bro (World 4, 0.5.0)

World 4's bonus slot `bonus-4` (2,13) is an SMB3 bonus spot: `kind: 'bonus'`, `unlock: 'larry'`,
`guard: 'hammer-bro'`, its road from 4-2 tagged `exit: 'secret:larry'` (`world4.ts`).

- **Found** with Larry Koopa's crystal ball in 4-2's airship (docs/HEROES.md): a secret exit of
  4-2 that draws in only this road. 4-2's flagpole never opens it.
- **The bonus** (`map/bonus-spot.ts`): standing on the open node the hint line shows the bonus
  game's name (`BonusGame.label`) and JUMP (ENTER) calls `Game.openBonus({ page, node })`, which
  pushes the bonus game's scene over the map. The scene calls `done('used')` once a round was
  played (the bonus closes: `Game.bonusOpen = false`, saved at once) or `done('left')` (backed out,
  still open); either way the map comes back with the hero on the node. The bonus games register
  with `registerBonusGame({ label, icon, create })` (`icon`: the node's `sheet:frame`, e.g.
  `smb3:node-toad-house`; it must name an existing frame). Until they do, a
  placeholder card ("THE BONUS GAMES ARE COMING SOON!") stands in and counts as used.
- **Used**: the node shows a spent dot, its hint line says `BEAT THE HAMMER BRO TO REOPEN`, JUMP
  bumps, and a **Hammer Bro** (`map/hammer-bro.ts`, `MapGuard`) comes out on the road: on the road
  tile farthest from the hero, then he wanders tile by tile (1 px/f, standing 50-100 frames
  between steps) along the road between 4-2 (never on its node) and the bonus node. Drawn with the
  SMB3 map frames `smb3:hammer-bro-map-0/1` (16×16, facing left).
- **Touching him** (the hero walking into him on the road, or him walking into the hero waiting on
  the bonus node; not in the first 45 frames after the map shows) starts the **Hammer Bro battle**
  (`scenes/hammer-battle.ts`, `Game.startHammerBattle`): one locked screen (`content/levels/
hammer-battle.map`, outside the level library: floor, two brick rows at the SMB1 heights) with
  two SMB1 Hammer Bros, no clock, the run's hero, power, lives and score. The hero's map place
  stays the node it last stood on. Start pauses (Quit to map leaves it undecided).
  - **Win** (both Hammer Bros gone, then a second): their hammers vanish, the `castle-clear`
    jingle, the card "THE HAMMER BROS ARE BEATEN! / THE BONUS IS OPEN AGAIN.", then
    `Game.hammerBattleWon`: `bonusOpen = true`, back to the map (saved). He comes back the next
    time the bonus is used.
  - **Lose** (the hero falls): `Game.hammerBattleLost`: a life lost as in SMB3, power back to the
    start as after any death, back to the map with the Hammer Bro still there; no lives left is
    GAME OVER (the campaign's continue).
- **Save** (optional fields, no format change): `bonusOpen?: boolean` (missing: open) and
  `inventoryUnlocked?: boolean` (missing: off, but on for a file with the secret `larry`).
- Campaign only (the map is). Dev "Unlock all" does not show it (bonus nodes need their key).

## Teleport pads (level zone, 0.5.0)

Hidden areas can be joined by Mega Man style teleport pads as well as pipes, vines and pits. A pad
is a `[zones]` line (`src/game/entities/objects/teleporter.ts`):

```
teleport x y -> level x y [exit=beam|fall] [block=bx,by]
```

- The pad lies on the floor of tile (x, y), 16×8 (`station:pad-0/1`).
- **Standing on it** (on the ground, the body's centre over it) beams the player up: everyone
  freezes, the rider is hidden, a `station:beam-*` streak gathers and rises off the screen (sfx
  `beam`), then the level moves to `target` exactly like a pipe transfer (`pipe` event; the clock
  carries over within a stage). Touch was picked over a button: Mega Man's teleporters work on
  touch, and nothing has to be shown or learned. A pad never fires for a player who has not been
  off it first, so arriving on one never sends you straight back.
- `exit=beam` (default): the target starts in `beam` mode (also a level `startMode`): each
  player's streak drops from above onto the start tile, then the hero appears. `exit=fall`: drops
  in from the top like a pit (the space station's pads back to 3-1 use it, landing where the coin
  heaven's drop does).
- `block=bx,by`: the pad is hidden in that hidden teleporter block (tile `8`,
  `T.HIDDEN_TELEPORTER`, content `teleporter`) until the block is bumped; it then rises out of the
  floor with the power-up sound.
- Pads count as ways out for the map's secret-exit look (`map/secret-exits.ts`) like pipes and
  vines; the 3-1 pads stay within 3-1, so nothing changes there.

## Adding a page (checklist)

1. Sketch it in its own file (Lost Levels: `src/content/worldmap/lost/llN.ts`), export a
   `WorldMapPage` with the id, group and label above, one `start` node, nodes on walkable tiles in
   rows 2-13, contiguous paths.
2. Add it to its list in play order (`LOST_PAGES` in `lost/index.ts`; the hub is `HUB_PAGE`).
3. Give castles their exits (with `requires` where the rules need one) and any warp nodes their
   `to`/`toNode`/`requires`/`label`/`hint`. Only Lost World 1 has a warp back to the hub.
4. Run `pnpm test`: `src/content/worldmap/pages.test.ts` checks every registered page (ids,
   labels, tiles, nodes, paths, warp targets, exits within the group).
