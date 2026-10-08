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
| `src/game/level/campaign.ts`                                                          | Campaign-only level variants (the 1-2 warp zone's one pipe, 2-1's cave)             | engine (H0)                                          |
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
| `arena`                                      | `arena`             | `ARENA`                                              |
| `ll-1` .. `ll-8`, `ll-9`, `ll-10` .. `ll-13` | `ll`                | `LOST 1` .. `LOST 8`, `LOST 9`, `LOST A` .. `LOST D` |

- `label` (at most 10 chars, `A-Z 0-9 space`) shows at the header's top right; `title` (at most 20) at its top left. The announcer reads the label in title case ("Lost A") and the title.
- **Order within a group is the registry order** (`MAP_PAGES`): it sets slide directions and
  the Worlds menu order. Put `LOST_PAGES` in play order: 1-8, 9, A-D.
- Pages of one group are joined by world exits (a slide). The one road between groups is SMB
  World 8's castle exit to Lost World 1 (0.4.7: the Lost Levels are the story's extension), a
  slide too; Lost World 1's start walks back along it. Other groups are joined only by warp nodes
  (a fade). A start node's "walk back" road leads to the page whose open exit arrives there.
- The Worlds menu lists the open pages of the story (the SMB worlds, then the Lost Levels worlds,
  one list since 0.4.7) plus the hub when open; on the hub it lists the hub first, then the open
  pages of every group.

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

| kind              | Meaning                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `start`           | The page's arrival node. May also carry the warp fields or a `level` (below).                                                    |
| `level`, `castle` | Enter `level` with JUMP. A castle clear opens the page(s) its exits lead to.                                                     |
| `bonus`           | Hidden until `unlock` (a secret key) is found. JUMP plays the bonus game (with a `level`: enters it, World 2's Top Secret Area). |
| `warp`            | JUMP warps to another page (see below).                                                                                          |
| `game`            | A Mini Game Arena pad (`game`: its arena game id). JUMP plays one round.                                                         |

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
{ id: 'bonus-1', kind: 'warp', x: 5, y: 11, // World 1's warp spot
  to: 'hub',                // target page id (must be registered)
  toNode?: 'start',         // arrival node there (default: its start node); the hub's centre
                            // warps back with toNode: 'bonus-1' (portals pair 1:1)
  oneWay?: true,            // optional: exempt from the 1:1 pairing
  requires?: 'gameCleared', // MapCondition; absent = always works (the spot has none)
  label?: 'WARP ZONE',      // hint line while open (default: the target page's title)
  hint?: '??? - A FUTURE SECRET', // hint line while locked (needed with `requires`)
  unlock?: 'bonus-1' }      // optional: hidden until this secret is found
```

- **Portals pair 1:1**: a warp X on page P lands on Q's `toNode` (or start), which must be a warp
  back to P whose `toNode` is X (`pages.test.ts`). A one-way portal sets `oneWay: true`; none do
  yet. Pads that never work (`requires: 'never'`) are exempt.
- A warp node is shown and walkable whenever a road to it is open (like any node), even locked.
- While the hero stands on it, the **hint line** (a black strip at the bottom of the map) shows
  `label` when it works, `hint` when locked; the announcer says it ("Warp, Mini Game Arena" /
  "??? - A Future Secret, locked"). Keep both at most 32 chars.
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

| Value            | Holds when                                                                      |
| ---------------- | ------------------------------------------------------------------------------- |
| `'gameCleared'`  | SMB 8-4 beaten on this file (`SaveFile.gameCleared`, `MapProgress.gameCleared`) |
| `'secret:<key>'` | The file has found secret `<key>`                                               |
| `'never'`        | Never: a future secret ("??? - A FUTURE SECRET")                                |

0.4.7 removed the Lost Levels' NES unlock conditions `'ll9'` (World 9: all 32 of Lost 1-1 to 8-4
cleared) and `'llLetters'` (World A: Lost 8-4 beaten), with `LOST_NINE_LEVELS` and the exit hint's
`{n}` count (`conditionCount`): in the campaign the Lost worlds now open in order (below).

Developer mode's **Unlock all** treats every condition as met **except `'never'`**, opens every
registered page (the hub included, so the Worlds menu lists it), and shows warp nodes hidden only
by their `unlock` key (World 1's warp spot) with their roads. Bonus nodes, and keyed warps that
have `requires: 'never'`, stay hidden until their secret is found. It writes nothing to the file: a warp
that works only through Unlock all travels without opening its page (`rules.warpRecords`).

## The Mini Game Arena (0.4.7)

The Warp Zone hub's first pad (east, `warp-arena`; the Lost Levels' pad until 0.4.7) leads to the
`arena` page, open as soon as the hub is reachable (no `requires`). The arena
(`src/content/worldmap/arena.ts`) is a stadium: the hero arrives on the Return pad in the middle of
the field (its start, a warp back to `warp-arena`, paired 1:1), and the game pads stand around it.

- **Pads** (`kind: 'game'`, id `pad-<game>`) are not written in the page: `src/game/arena` lists the
  games from the registries (MINIGAMES, Larry's airship, the bonus games, 1-0, the heroes with
  training lessons) and lays the page out with `installArenaGames` when it loads, so the arena
  grows by itself. Slots (22), in fill order: three rows three tiles apart (rows 9, 6 and 12),
  pads two tiles apart in a row: the middle row out from the Return pad to both touchlines, the
  far row out from (7,6) (the Return pad's road goes up to it), then the near row at even
  columns, its road coming down the left touchline from (1,9) and turning in at (1,12); full, it
  closes back up to (15,9). A hero up to 32 px tall stands on each pad, so no road reaches a pad
  from above and no hero covers another pad or a road (`arena.test.ts`). 17 games use 17 slots.
- Every pad and road of the arena is walkable as soon as the page is open (`rules.pathFromDone`:
  roads leaving a `game` node count as walked on an open page). Whether a game is **found** is the
  arena's own rule (docs/HEROES.md "Met heroes and the Mini Game Arena"); a dark pad shows the
  hero's silhouette and `?`, its hint line says what to find (`??? - FIND THIS HERO FIRST`, `??? - FREE THIS HERO FIRST` for a training room) and JUMP
  bumps. On a found pad the hint line names the game, the touch JUMP says PLAY, and the announcer
  says "Mirror Race, Luigi. Jump to play, for fun."
- A round is played over the map and nothing is saved (docs/HEROES.md); Larry's airship asks for
  a hero first (character select over the map; Back returns to the pad). Arriving and walking save
  the hero's place as on any page. The Worlds menu lists the arena on the hub and on the arena.
- **Art**: theme `arena` (a night match: `map-arena` palette, sky `ARENA_NIGHT`) and music `arena`.
  The sketch (`SKETCH_ARENA`): bunting `w` on the sky (row 2), crowds `M`/`N` alternating with
  banners `E` (rows 3-4), the barrier wall `B` (row 5), the walkable chequered pitch `F` (rows
  6-13, every pad and road on it) and a crowd again (row 14). Actors: the `scoreboard` at (104,40),
  `light-tower`s at (0,64) and (240,64), and fans' flags in the stands. Pads (`drawArenaPad`) are
  items-sheet frames: `map-arena-game` (a trophy on a red pad: mini games, the airship, bonus
  games), `map-arena-tutorial` (a signpost on a blue pad: 1-0 and training) and
  `map-arena-locked` (the dark `?`). What stands at a pad (the hero's portrait, a black silhouette
  until found; Larry; the bonus game's icon) stands on the bare pad (`<frame>-plate`), feet on
  its plate (`ARENA_FEET`, 13 px below the tile's top), centred and fully in view; the emblem
  shows only on a pad nobody stands on.

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
- **One exception** (0.4.10): the Moblin in 2-1's hidden cave both clears 2-1 and finds `bonus-2`,
  opening both roads ("The Top Secret Area" below).
- Today 1-2's campaign pipe is a secret exit (below), and so is Larry Koopa's crystal ball in
  4-2's airship (`secret:larry`, the road to World 4's bonus spot; "The bonus spot and its Hammer
  Bro" below). SMB 4-2's two warp zones are no warps in campaign play (0.5.0): each leads into an
  area of 4-2 (below) and is no exit at all (no `target.secret`, no road). The vine area's shows
  one ordinary pipe, down into Samus's cavern; the right one shows a dead pipe until Larry's anchor
  crashes down on it, and its chain climbs up onto his airship deck, whose stern pipe leads to his
  room, where the crystal ball is the exit. The Lost Levels' warp zones
  (`Game.campaignWarpToMap`) still warp as in the original and clear nothing. The map's secret-exit look
  (`map/secret-exits.ts`) only marks levels that have another way out; it reads the level data as
  it is, so 4-2 keeps its look (in the campaign its other way out is Larry's `secret:larry` road).

## World exits and the Lost Levels as the story's extension (0.4.7)

```ts
exits: [{ from: '8-4', to: 'll-1', side: 'right', points, requires?: MapCondition, hint?: '...' }]
```

- An exit opens when its `from` node (a castle) is cleared **and** its `requires` holds (no exit
  has one today). A castle clear (`rules.clearLevel`) opens the target page of every exit whose
  condition holds.
- Exits lead to pages of the same group, except SMB World 8's road on to Lost World 1.
- `hint` (optional): the hint line while the hero stands on `from` and the exit is locked; the
  announcer adds it to the node's name (`rules.exitHint`). At most 32 chars. None has one today.

**The Lost Levels are the story's extension** (owner decision for 0.4.7; before, a hub pad opened
them after SMB 8-4 and they unlocked by the NES rules):

- **SMB 8-4**: the castle's "Your quest is over.", the credits, then the clear is recorded (the
  file's `gameCleared` set), saved, and the **World 8 map** follows (before: the title). World
  8's castle (its gate opens east) has the exit `8-4 → ll-1`, so the road off the right edge
  draws in there, and Lost World 1's start with its first road waits in Lost 1's share of the
  reveal. Walking it slides to Lost World 1, arriving on its start (on the road's row); walking
  left off that start goes back to World 8's castle. Lost World 1 has no warp node back to the
  hub any more (its road replaced it), and the hub has no Lost Levels pad (its first pad is the
  Mini Game Arena's).
- **In order**: every Lost castle's exit opens the next page in play order, `ll-1 → … → ll-8 →
ll-9 → ll-10 (A) → ll-11 → ll-12 → ll-13 (D)`, off the right edge, with no condition. World 9
  opens with Lost 8-4's clear whatever warp zones were taken (the NES needed a warpless run of
  1-1 to 8-4), World A with 9-4's (the NES opened A-D after eight games beaten, from World 8).
  World 8's pad to A and A's pipe back are gone; no Lost page has a warp node.
- **The endings** (campaign, `Game.showLostEnding`): Lost 8-4 shows the NES card ("THANK YOU
  <HERO>! YOUR QUEST IS OVER. WE PRESENT YOU A NEW QUEST. …") and goes back to the World 8 map,
  where World 9's road draws in; 9-4 its "THANK YOU!" card, then the World 9 map with A's road;
  **D-4 is the final ending**: its card, the credits, then the World D map. The clear is saved as
  the card shows. Outside the campaign (dev select, `?level=`) the Lost Levels keep the NES
  rules (games-beaten tally, World 9 after a warpless run, A-D after eight games, the global
  progress store); the campaign never touches that store.
- **Warp zones** stay as on the NES (backward ones too): a warp pipe opens only its target page
  and the map moves there; it clears nothing (`Game.campaignWarpToMap`).
- **Old files** (no format change): every page a file had stays open, every clear kept.
  `rules.openMetExits(progress)` opens the page of every cleared castle's exit that is not open
  yet (not only exits whose `requires` came to hold) and returns the ids to draw in;
  `Game.showMap` calls it every time the map is shown. So a file that beat SMB 8-4 gets Lost
  World 1 and the road, drawn in on World 8 the first time it is shown; a file that beat Lost 8-4
  with warps gets World 9; one that had World 9 (32 clears) or A (World 8's pad) keeps them (A
  without 9-4 stays reachable through the Worlds menu). A hero saved on a node that is gone stands
  on its page's start (`save-files.ts placedNode`): Lost 1's `hub` and A's `warp-ll-8` → start,
  World 8's `warp-ll-10` → its castle `ll-8-4`. Stale reveal ids of gone nodes are dropped when
  their page is shown.
- Every condition reads the save file alone (campaign rules; the global NES progress store in
  `src/engine/save/progress.ts` is only for non-campaign play).

## The Chapter 2 gate (pre-release, 0.4.20)

Until Chapter 2 (the Lost Kingdom, docs/ROADMAP.md) ships, the campaign plays exactly as before up
to the Lost Kingdom's map pages (8-4's credits, Toad's rift pages, the road onto Lost World 1, the
Worlds menu), but **no Lost Kingdom level can be entered**. JUMP on such a node shows a card over
the map instead (read out; OK, MENU or BACK closes it):

```
THE PATH IS BLOCKED!
A STRANGE FORCE SEALS THE
WAY INTO THE LOST KINGDOM.
COME BACK IN CHAPTER 2!
```

The hero stays on the node and can walk, open the menu, save and quit. Nothing is written to the
file by being blocked.

- **One constant:** `CHAPTER_GATE` in `src/game/map/rules.ts`. Set it to `false` (or delete it,
  `rules.chapterGated` and its two callers) when Chapter 2 is released.
- **What is gated** (`rules.chapterGated(levelId, open)`): every `ll-` level (Lost 1-1 to 8-4,
  World 9, A-D, their sub-areas) and any level on a page of the `ll` group. Larry's airship
  (`4-2-airship`, `4-2-larry`) is Chapter 1 and stays open. The six Koopaling airships (Chapter 2
  side quest, not built yet) will sit behind Lost warp zones, so they are behind the gate too.
- **Where:** the map's level entry (`WorldMapScene.updateIdle`, the one place the map starts a
  level) checks `Game.chapterBlocked` before character select. As a backstop, `Game.goToLevel`
  and `Game.startLevel` send a campaign start into gated content back to the map with the card (no
  SMB level warps into the Lost Kingdom; a Lost warp pipe ends on the map, `campaignWarpToMap`;
  deaths and continues only restart a level already entered). A file saved on a Lost page opens
  on that page and is blocked on entry.
- **Not gated:** anything outside the campaign (`Game.campaign` null): the dev level select,
  `?level=`, custom and shared levels, play-tests, the Mini Game Arena.
- **Dev lift:** the map menu's **Chapter 2 gate: closed / open** row (dev mode only, after "Unlock
  all") sets the file's `SaveFile.devGateOpen` (optional, `true` or missing/false). It counts only
  while dev mode is on (`Game.chapterGateOpen`), like "Unlock all" and "All heroes"; it is kept per
  file so a test file can stay open across sessions. Campaign sims that play the Lost Kingdom open
  it this way (tests/sim/lost-campaign.test.ts).

## Progress, reveals and saves

- `MapProgress`: `cleared` (main level ids beaten through their **normal** exit, `1-0` included
  once the tutorial is cleared), `pages` (open page ids, `smb-1` always), `secrets` (keys found,
  secret exits included), `position: { page, node }`, `gameCleared`.
- Reveal ids are page-qualified: `'<page>:<id>'` (`'hub:start>warp-arena'`, `'smb-1:1-4>smb-2'`); an
  exit's id is `'<from>><to page>'`. Each page draws in only its own when shown.
- `rules.findSecret(progress, key)` records a secret and returns what it reveals;
  `rules.warpTo(progress, page)` opens a page (warp pipes, warp nodes).
- Save files are **version 2**. The v1 → v2 migration (`migrateV1toV2`) turns `worlds: [n]` into
  `pages: ['smb-n']`, `position.world` into `position.page`, and converts `lastNode` keys and
  `pendingReveal` ids. Loading keeps only registered page ids. Any later change to the stored
  format appends a migration (docs/RELEASING.md).

## Campaign warp zones (`level/campaign.ts`)

`Game.startLevel` plays a campaign variant of a level while a save file is played from the map
(`campaignLevel`); dev select, `?level=`, custom and shared levels keep the level as it is. A
warp zone (`warp x w worlds=..`) may carry one of two campaign keys, and then shows **one pipe**:
the middle pipe of the zone stays, the others are taken out of the room (their pipe tiles and
pipe zones), and the world numbers go (but a climb zone's, below).

| Key                             | The one pipe                                                                                                                      | Text                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `secret=<key>`                  | Records `<key>` as a secret exit and returns to the map (`target.secret` → `Game.campaignSecret`)                                 | stays                 |
| `goto=<level>,<x>,<y>[,<exit>]` | Leads into `<level>` at (x, y) like any pipe (`exit` as a pipe's `exit=`); no secret, no map road                                 | goes                  |
| `goto=…,climb`                  | Dead (solid, no pipe zone; its world number stays) until the anchor smashes it; the anchor's chain then climbs to `<level>`       | stays until the smash |
| `until=<secret>` (with `climb`) | With `<secret>` on the file: no pipe at all, the room sealed (ceiling gap closed, left wall to the top, the camera stopped at it) | goes                  |

A `goto` with exit `climb` shows **no working pipe**: the other pipes of the room go, and the
middle one stands dead (solid, no pipe zone); its world number and the welcome text stay, drawn
through the zone's `labelAt`, until a player stands on the room's floor. Then an anchor crashes
down on it (an `anchor-drop` entity): the pipe is smashed, the number and text go, and the anchor
rests on the floor with its chain (climbed like a vine) rising off the top of the screen through
the hole it broke above. Climbing off its top arrives in `<level>` up a chain at column x,
landing on the first solid tile in column x + 1 below row y. With `until=<secret>` and that
secret on the file the room is sealed instead: no pipe, the ceiling gap closed, the zone's left
wall raised to the top of the screen and a `scrollStop` there (unless the level has one), so
nobody can drop in or get stuck on top (docs/HEROES.md "The anchor's drop").

`goto` is meant for an area of the same level (same world and stage, `parent` leading back), so
the clock carries over (`carryTime`) and nothing on the map changes. A `goto` whose level is not
in the library (yet) leaves the warp zone as it is, so a branch can name an area another branch
adds. Owner decision (0.5.0): all warp pipes go eventually.

- **4-2 vine area** (`4-2-warp`, pipes 50/54/58): `goto=4-2-cavern,2,0`. Pipe 54 drops the
  player into Samus's cavern (docs/HEROES.md), whose side pipe brings them up out of 4-2's pipe
  at column 72, the first pipe past the vine block.
- **4-2 right zone** (`4-2.map`, warp at 208, pipe 214): `goto=4-2-airship,2,3,climb until=larry`,
  Larry Koopa's anchor crashing onto the pipe at column 214, its chain up to the bow of his
  airship deck (whose stern pipe leads into his room `4-2-larry`; docs/HEROES.md). Larry's road
  (`secret:larry`) is granted by beating him, not by the chain; the first time, World 4's map
  plays the airship's crash before drawing it in. After that the room is sealed.

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
- SMB 4-2's warp zones lead into areas of 4-2 in campaign play (`goto`, above). Lost Levels warp
  zones (backward ones too) are unchanged.

## The bonus spot and its Hammer Bro (World 4, 0.5.0)

World 4's bonus slot `bonus-4` (2,13) is an SMB3 bonus spot: `kind: 'bonus'`, `unlock: 'larry'`,
`guard: 'hammer-bro'`, its road from 4-2 tagged `exit: 'secret:larry'` (`world4.ts`).

- **Found** with Larry Koopa's crystal ball in 4-2's airship (docs/HEROES.md): a secret exit of
  4-2 that draws in only this road. 4-2's flagpole never opens it. The first time, the map's
  airship-crash cutscene plays first (`map/airship-crash.ts`): the ship crashes on this spot and
  Toad hammers the wreck into the node, which shows from then on; the road then draws in.
- **The bonus** (`map/bonus-spot.ts`): standing on the open node the hint line shows the bonus
  game's name (`BonusGame.label`) and JUMP (ENTER) calls `Game.openBonus({ page, node })`, which
  pushes the bonus game's scene over the map. The scene calls `done('used')` once a round was
  played (the bonus closes: `Game.bonusOpen = false`, saved at once) or `done('left')` (backed out,
  still open); either way the map comes back with the hero on the node. The bonus games register
  with `registerBonusGame({ label, icon, create })` (`icon`: the node's `sheet:frame`, e.g.
  `smb3:node-toad-house`; it must name an existing frame). The SMB3 bonus games
  (Toad House, N-spade, spade game, in rotation) are registered (docs/BONUS.md); with none, a
  placeholder card ("THE BONUS GAMES ARE COMING SOON!") stands in and counts as used.
- **Used**: the node shows a spent dot and JUMP on it bumps. Right after it is used there is no
  guard yet: the hint line says `COME BACK AFTER YOUR NEXT LEVEL` and the hero walks the road back
  freely (`Game.bonusGuard` false).
- **The Hammer Bro comes out** once a level is entered from the map (any level, whatever the
  result: clear, death or quit to map; `Game.enterLevelFromMap` sets `Game.bonusGuard`, saved).
  From then on the node's hint line says `BEAT THE HAMMER BRO TO REOPEN` and a **Hammer Bro**
  (`map/hammer-bro.ts`, `MapGuard`) stands on the road: on the road tile farthest from the hero,
  then he wanders tile by tile (1 px/f, standing 50-100 frames between steps) along the road
  between 4-2 (never on its node) and the bonus node. He never steps onto the hero's tile or the
  road the hero is walking (`MapGuard.update(blocked)`). While the hero stands on that road's node
  (the spent bonus node, e.g. back there through the Worlds menu) he stays away, so the way back is
  never blocked; he comes out as soon as the hero arrives at any other node. Drawn with the SMB3
  map frames `smb3:hammer-bro-map-0/1` (16×16, facing left). For the first 45 frames after the map
  shows or he comes out he stands still (`GUARD_GRACE_FRAMES`); it never delays a battle.
- **Walking into him** (opt-in: only the hero walking into him on the road, at once, even right
  after the map shows, so the hero cannot slip past him; he never walks into the hero) starts the
  **Hammer Bro battle** (`scenes/hammer-battle.ts`, `Game.startHammerBattle`): one locked screen
  (`content/levels/hammer-battle.map`, outside the level library: floor, two brick rows at the
  SMB1 heights) with two SMB1 Hammer Bros, no clock, the run's hero, power, lives and score. The
  hero's map place stays the node it last stood on. Start pauses (Quit to map leaves it undecided).
  - **Win** (both Hammer Bros gone, then a second): their hammers vanish, the `castle-clear`
    jingle, the card "THE HAMMER BROS ARE BEATEN! / THE BONUS IS OPEN AGAIN." with the item they
    leave (SMB3 style: a mushroom, fire flower or star into the inventory, docs/BONUS.md), then
    `Game.hammerBattleWon`: `bonusOpen = true`, `bonusGuard = false`, back to the map (saved). He
    comes back after the next level once the bonus is used again.
  - **Lose** (the hero falls): `Game.hammerBattleLost`: a life lost as in SMB3, power back to the
    start as after any death, back to the map with the Hammer Bro still there; no lives left is
    GAME OVER (the campaign's continue).
- **Save** (optional fields, no format change): `bonusOpen?: boolean` (missing: open),
  `bonusGuard?: boolean` (the Hammer Bro is out; kept only while the bonus is used; missing: not
  out yet, so an older file's comes out after its next level) and `inventoryUnlocked?: boolean`
  (missing: off, but on for a file with the secret `larry`).
- Campaign only (the map is). Dev "Unlock all" does not show it (bonus nodes need their key).

## The Top Secret Area (World 2, 0.4.10)

Owner design, after Super Mario World's "Top Secret Area". Campaign only.

**The way in: over 2-1's flagpole.** A hero who gets past 2-1's flagpole **without touching it**
(jumping over it) can walk on past the castle into a cave mouth at the level's end (columns
220-223, `decor 220 12 kind=items:cave-mouth campaign=true`), whose `pipe 224 11 right -> 2-1-cave
1 12 campaign` (a right-hand pipe zone at the level's right edge: walking into the mouth enters it)
leads into the Moblin's cave. Touching the pole still ends the level the normal way (and the pole
can be touched from the far side too, by walking back left into it).

- **Who could jump the pole in v0.4.9**: measured from the top of the last tower (columns 190-191,
  its top on row 3, nine tiles left of the pole at 200, ball on row 2), with every running or
  walking jump off its edge: **only Luigi** (small and big). Mario fell 5 px short; everyone else
  further (Simon's committed jump carries him 58 px).
- **The hidden block** (so every hero can, once they think to look): a `path` zone, `path 192 3 7
block=184,0 campaign`. In the campaign a hidden block (tile `9`, T.HIDDEN_PATH, invisible and
  bumpable only from below, like every hidden block) sits on row 0 over column 184: high above the
  bricks (185-186, row 9), up and **left** of 2-1's hidden coin block (186,5), the one the way up
  the tower uses. Standing on that coin block, a hero who walks back off its left edge and jumps
  up-left bumps it; every hero can (each at his own moment, `tests/sim/top-secret.test.ts`), and
  the springboard (188) takes him back up to the tower. Ordinary play never touches it: a probe
  test drives every hero, small and big, from the ground, the bricks, the coin block and the tower
  top, heading right (or standing, or jumping back left off the bricks or the tower), jumping at
  many moments, short and long, with and without the springboard's high bounce (about 480 runs a
  hero): nothing bumps it. (0.4.10's review: a first spot over the tower itself was bumped by
  ordinary springboard approaches, which cut the hero's jump at the pole.) It turns into a used
  block and lays a **cloud path**: seven
  cloud blocks (T.CLOUD_BLOCK) on row 3, columns 192-198, level with the tower top, one every
  `PATH_STEP_FRAMES` (6) with a pop (`World.layPath`; the announcer says "A path of clouds
  appears."). The path stops a tile short of the pole's column. Every hero runs along it and jumps
  off its far end clear over the ball, Simon included (a running jump from its last tile), small
  and big; `tests/sim/top-secret.test.ts` drives each one. A single block could not do it: a jump
  off a block near the tower still has to carry the hero 135 px past the pole above row 2.
- Outside the campaign 2-1 is v0.4.9's tile for tile (`tests/sim/fixtures/2-1-v0.4.9.map`): no
  hidden block, no path, no cave mouth, no way in.

**The Moblin's cave** (`2-1-cave`, an area of 2-1: parent `2-1`, the clock carries on): one locked
screen, dark rock (the `underground` theme), two fires (`cave-fire`, entities/objects/moblin.ts) and
between them a friendly **Moblin** (`moblin 9 12 secret=bonus-2 next=2-2-intro`, Zelda-style, original
art, 24x32, about big Mario's height: a pig-faced brute with heavy jowls, a pale snout with two
nostrils and a thick spear; `items:moblin-0/1` breathing, `items:moblin-surprised`; a `moblin` with
no `secret=` is left out, so no empty secret is ever recorded). When a player on the ground comes
within 56 px he jumps with surprise, everyone stops, and his cards play over the cave (a box at the
top, each read out, OK = JUMP to go on): `...!` / `YOU FOUND ME?!` / `I'LL SHOW YOU A SECRET PATH...
AS LONG AS YOU DON'T TELL ANYONE.` / `IT'S A SECRET TO EVERYBODY.` (the `secret` jingle). Then:

- **Campaign** (`Game.campaignTopSecret`): **2-1 counts as cleared** (`clearLevel`: its normal road
  to 2-2) **and** the secret `bonus-2` is found (`secretExit`: the road to the bonus node). This is
  the one exit that opens both (owner decision); the map draws both roads in, like the 1-2 warp
  spot's (`pendingReveal` `smb-2:2-1>2-2`, `smb-2:2-2`, `smb-2:2-1>bonus-2`, `smb-2:bonus-2`), and
  2-1 reads "World 2-1, cleared, secret exit found". 2-1 shows the secret-exit dot from the start:
  `map/secret-exits.ts` counts an area entity with a `secret` prop (the Moblin) as a way out.
- Elsewhere (level select, `?level=2-1-cave`) play goes on to `next` (2-2); a play-test ends.

**The map node**: World 2's reserved bonus slot `bonus-2` at (8,4) (`world2.ts`), still `kind:
'bonus'`, `unlock: 'bonus-2'`, now with `level: '2-top-secret'` and `label: 'TOP SECRET AREA'`. A bonus
node with a `level` is a **bonus area** (`map/bonus-spot.ts isBonusArea`): hidden until its key like
any bonus node (also with dev Unlock all), then always open: no bonus game, no `bonusOpen`, no Hammer
Bro. Its icon is `items:map-node-tsa` (the green bonus dot with a gold sparkle), the hint line and
the announcer say "TOP SECRET AREA" ("Top Secret Area, open"), the touch JUMP says ENTER, and JUMP
enters its level through character select, like a level node, every time. Nothing is ever cleared
there and no save field is added.

**The Top Secret Area** (`2-top-secret.map`, header `bonus: true`: `LevelData.bonus`, a fill-up
spot: no clock, no WORLD card; it is entered straight from character select, the announcer says
"Top Secret Area."; its HUD shows the area's name, `TOP SECRET` / `AREA`, where WORLD 2-1 would
be, and no TIME, HudOptions.area; on its light sky every HUD text has a dark outline, `LIGHT_SKIES`
and HudOptions.outline): one locked screen in the `smw-secret` theme, five `?` blocks in a row on row 9,
columns 6-10:

| Block      | Tile (map char)  | Gives                                                             |
| ---------- | ---------------- | ----------------------------------------------------------------- |
| 6, 7       | `W` T.Q_FLOWER   | a fire flower, whatever the power (each hero takes it as its own) |
| 8 (centre) | `Y` T.Q_EGG      | a Yoshi egg (`entities/objects/yoshi-egg.ts`)                     |
| 9, 10      | `R` T.Q_MUSHROOM | a mushroom, whatever the power                                    |

The egg rises out of its block (32 frames), sits on it wobbling (48 frames, `items:yoshi-egg-l/r`,
quickening), cracks (16 frames, `yoshi-egg-crack`) and bursts in four bits of shell; then `hatch()`
lets out what it holds. Yoshi is not in the game yet, so a **1-up hops out** (as in Super Mario World
when Yoshi is already with you; `PowerUp.hopOut`). The hook for a later release:
`yoshiUnlocked(world)` (always false today, a `TODO(yoshi)`) and `hatch` (docs/ROADMAP.md).

The blocks are full again on every visit (each visit is a new World from the map's tiles). Its pipe
(`pipe 13 11 down -> map 0 0`, `MAP_EXIT`: a pipe target that is no level) goes back to the map: in
the campaign `Game.returnToMap()` with the hero still on `bonus-2` and nothing cleared; elsewhere a
play-test ends or the title follows. Co-op: both players come along; each block gives its item to
whoever takes it.

**Art** (all original, `src/content/sprites/top-secret.ts`): the `smw-secret` theme (tile palette
`tiles-smw-secret`, grass-topped dirt `tree-top@smw-secret` over `ground@smw-secret`, `used@smw-secret`;
sky `#f8ecc0`; decor palette `decor-smw` with `smw-hill-big` (the big sparkly hill), `smw-hill-small`
and `smw-bush`; music `top-secret`, an 8-bar G-major loop in `songs.ts`), and on the items sheet the
Yoshi egg frames, `egg-shell`, the Moblin, `cave-fire-0/1` (flickering slower with reduce flashing),
`cave-mouth` and `map-node-tsa`. The hills' sparkles never twinkle.

**Toad** speaks on the map since 0.4.13 ("Story system" below), but has no line for this node
yet. A suggested one: "SOMETHING TELLS ME THIS SPOT WAS MEANT TO STAY A SECRET..."

## Hidden paths and campaign pipes (level zones, 0.4.10)

```
path x y w block=bx,by [one-way] [campaign]
ledge x y w campaign
pipe x y dir -> level x y [exit=dir] [campaign]
pipe x y down -> map 0 0
```

- **`path`**: the `w` tiles from (x, y) rightward appear one by one as cloud blocks, left to right,
  once the hidden path block at (bx, by) (tile `9`, T.HIDDEN_PATH, content `path`) is bumped
  (`World.layPath`, one every `PATH_STEP_FRAMES`, only on open air; a tile with a player in it waits
  for him). `campaign`: the zone sleeps (no block, no path) outside campaign play; the campaign
  variant wakes it and puts the hidden block in at (bx, by). 2-1's (above). Several `path` zones
  may name the same block: all are laid, in map order, with one announcement. `one-way`: its tiles
  are laid as one-way cloud ledges (T.CLOUD_LEDGE) instead of cloud blocks (0.4.12: 2-1's two steps
  back up to the bricks, laid before the path, so a hero dropped on the ground by the bump climbs
  back up; a jump from under them passes through).
- **`ledge`** (0.4.12): the `w` tiles from (x, y) rightward become one-way cloud ledges
  (T.CLOUD_LEDGE: stood on from above, passed through from below and from the sides) in campaign
  play only; `campaign` is required and the classic level is untouched. 2-1's ledge against its
  last tower (188-189, row 8, a row over the bricks) is Simon's way up: his committed jump lands
  on it off the bricks or coming down from the springboard (whose launch rises through it), and
  from it he reaches the hidden coin block's top, and from there the tower top. It is too low for
  any hero to reach the hidden block from it. Ordinary flagpole runs end exactly as before
  (`tests/sim/top-secret.test.ts` replays every hero's whole way to the secret from the ground).
- **A `campaign` pipe** sleeps outside campaign play (no way in; a zone only, so the level's tiles
  are the same either way); the campaign variant wakes it. 2-1's way into the cave. A woken pipe
  on the same mouth as a live one (same column, row and direction) takes its place, the live
  zone going (0.4.18): 8-4-end's trap pipe at column 10 (`pipe 10 11 down -> 8-4 19 10 exit=up`)
  has a `pipe 10 11 down -> 8-4-jason 1 10 exit=up campaign` on top of it, so in the campaign it
  leads to Jason's secret area (Sophia III's route, docs/HEROES.md) and everywhere else it is the
  trap pipe exactly as before.
- **`-> map`** (`MAP_EXIT`): a pipe back to the world map (the Top Secret Area's). Nothing is
  cleared; it is no exit of a level for the map's secret-exit look.

## Swimming in any theme (`swim: true`, 0.4.18)

A map header `swim: true` (`LevelData.swim`) makes the player swim from the first row of wave
tiles (`w`) down, as a water theme does (`isSwimLevel` in schema.ts: a water theme, or this
header), whatever the theme: Fred's flooded tunnel under 8-4 (`8-4-fred`) swims in the
Underworld's look. Its water is drawn as a murky fill behind everything from the wave row down
(`FLOODED` in world/tile-render.ts, per theme; the Underworld's teal), since the theme's sky is no
water colour. Enemies hop as in a water level, and the Safety floor treats it as one. Only `true`
is allowed; the header is written back by `serializeTextMap`.

## Teleport pads (level zone, 0.5.0)

Hidden areas can be joined by Mega Man style teleport pads as well as pipes, vines, pits,
descent shafts and trick walls (below). A pad
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

## Descent shafts (level zone, 0.4.7)

A down lift can carry the player into a hidden area below (5-4's shaft into Simon's dungeon):

```
descent x w -> level x y [campaign]
```

- A player standing on a `lift-down` whose column lies within `[x, x + w)` rides it on past the
  screen bottom (the lift does not wrap while ridden; `Lift.descent`) and, once out of sight
  below, the level moves to `target` like a pit, dropping in from above (a `fall` arrival; the
  clock carries over within a stage). Falling into the shaft without the lift, or jumping off
  it, still kills: only a rider carried below the bottom this frame is taken down.
- Its lifts bear a faint bone-grey skull on the middle plank: the only hint.
- `campaign`: the zone sleeps (no descent, no skull) outside campaign play; the campaign variant
  (`level/campaign.ts`) wakes it. Like a warp zone's `goto`, it leads into an area of the same
  level: no secret, no map road, no clear.
- 5-4: `descent 84 8 -> 5-4-dungeon 13 0 campaign` (the open shaft, columns 84-91; its down
  lifts run in column 89). While a descent zone is live, a fire bar whose tip would sweep one of
  its down lifts loses balls until it clears the lift widened by a tile each side, the widest
  hero's overhang (`World.descentBarLen`): 5-4's at (92, 10) is 3 long in the campaign, 6
  elsewhere, so a rider whose body overlaps the lift at all, even hanging off either end, rides
  down unhurt (tests: every hero at offsets across the lift, over 16 bar phases).
- Every rider counts: two co-op players on the lift both go down (the check is the geometry,
  feet on the lift's top, not `Lift.rider`, which holds only the last body carried).
- **Co-op fall arrivals** (any `fall` arrival: a level's fall start, a pit, a descent, a pipe
  with `exit=fall`): player 2 drops in 20 px right of player 1 when that drop is clear, else at
  the nearest clear offset (16, 12 right, 20, 16, 12 left, then closer; `World.fallSpot`): inside
  the level, no solid tile in its columns above the row player 1 lands on, outside every fire
  bar's sweep. So the dungeon's and crypt's arrivals stay in their open shafts (16 px right), and
  5-4 at 99 from the crypt lands 12 px right, clear of the bar at (103, 11).
- **The straight drop** (every `fall` arrival, 0.4.8): each hero drops straight down his start
  column; left and right do nothing until his head is below row 2 (`FALL_IN_STEER_Y`, the
  ceiling row under the HUD) or he lands. Steering from the first frame (left still held from
  walking back onto 6-2's pipe at 19) used to drift him over a bonus room's left wall and land
  him on its top, above the room. `tests/sim/fall-arrival.test.ts` drops every hero into every
  fall arrival steering each way.

## Trick walls (level zone, 0.4.8)

A ninja trick wall (a karakuri revolving panel) can flip the player through a wall into a hidden
area (6-2's first bonus room into Ryu's dojo):

```
trick x y h -> level x y [exit=up] [campaign]
```

- The panel is the `h` tiles from (x, y) down in column x, written `N` in maps (`T.TRICK`: solid,
  drawn as the theme's brick, with no block behaviour, so no bump or blast breaks it). The room
  lies on the open side of its bottom tile. Its middle tile (the lower of two) is the marked one
  (`TrickWall.markRow`).
- **Pushing into it** for `TRICK_PUSH_FRAMES` (60, about a second) without letting go spins it:
  holding toward it with the body against its face and the body's middle within its rows. That
  is plain walking for every hero; jumping into it counts, Ryu clinging to it counts (his cling is
  holding toward the wall) and Samus rolling into it in her morph ball counts. Letting go, a short
  push, or going down or out in co-op starts the count over (`World.checkTricks`,
  `TrickWall.pushedBy`).
- The spin (`World.trickSpin`, `entities/objects/trick-wall.ts`): everyone freezes, the others
  hidden as for a pipe; the panel makes a half turn over `TRICK_SPIN_FRAMES` (24) with the
  `panel-spin` sound; the pusher is hidden as it turns edge-on, and `TRICK_HOLD_FRAMES` (12) later,
  the panel still showing its far face, the level moves to `target` like a pipe transfer (`pipe`
  event, the clock carries over within a stage): a `spin` arrival, or with `exit=up` rising out
  of the pipe at the target. Only the panel turns: no flashing.
- **The frames** (the `ninja` sheet; `spinFrame`): from the brick side `trick-wall-0` (exactly
  `brick@underground`) → `-1` → `-2` (edge-on) → `-3` → `trick-wall-back` (the flat wooden dojo
  side), each frame filling its tile, stacked down the panel. A panel at rest shows its own room's
  face (the brick; the wooden back in the `dojo` theme): leaving a room it turns from that face to
  the far one (from the dojo: back → 3 → 2 → 1 → 0), arriving the other way round, so it settles
  on the room's face and never snaps.
- A `spin` arrival (also a level `startMode`): the start tile is beside the target's own panel;
  the panel there turns, and the players appear as it turns edge-on (player 2 20 px further into
  the room, both facing into it) and move once it is shut. Holding on in the same direction walks
  away from the panel, so nobody spins straight back.
- A live panel is marked: its marked tile is `ninja:trick-wall-cracked` (the brick with a faint
  crack) with `ninja:shuriken-mark` stuck in it about 5 px in from its left edge and 3 px down
  (mirrored for a panel whose room is on its left); a brief glint every two seconds, never with
  reduce flashing. Without the sheet: a dark seam round the panel and a grey star.
- `campaign`: the zone sleeps outside campaign play, and the room is exactly as it was: its panel
  is the map's plain bricks (which bombs break as ever), with no mark and no spin. The campaign
  variant (`level/campaign.ts`) wakes it, turns the panel's tiles to `N` and lays a coin arrow
  pointing at its marked row (`trickArrow`: tip two tiles out, a shaft of three, a coin above and
  below; only on open air). Like a descent, it leads into an area of the same level: no secret, no
  map road, no clear.
- 6-2: `6-2-bonus` has `trick 0 10 3 -> 6-2-dojo 14 12 campaign` (its left wall, rows 10-12);
  `6-2-dojo` has `trick 15 10 3 -> 6-2 35 10 exit=up` (always awake): the way out rises out of the
  pipe at 35 in 6-2, where the bonus room's own pipe leads, so the panel is one way and the bonus
  room (and its coins) is entered again only down the pipe at 19.

## Exploding bridges and ranged pits (level entity and zone, 0.4.9)

7-3's way into Bill Rizer's jungle camp (campaign only, docs/HEROES.md):

```
[entities]
bridge-blast x y w=N campaign=true
[zones]
pit x -> level x y [w=N] [campaign]
```

- **Campaign-only entities**: any spawn with `campaign=true` sleeps outside campaign play (World
  leaves it out of its spawns); the campaign variant (`level/campaign.ts`) drops the mark, so it
  spawns. Nothing else of the level changes for it.
- **`bridge-blast`** (`entities/objects/bridge-blast.ts`) marks the N bridge tiles (`-`) from
  (x, y) rightward. At rest: the `contra` sheet's `blast-bridge-0/1` over its girders (the red
  light blinking about once a second; steady with reduce flashing), or without the sheet a post
  with a blinking red lamp on the tile before its left end. The campaign variant also lays a coin
  arrow pointing down at its marked end (`blastArrow`: a shaft of two, then a head of five, three
  and one, tip two tiles above the girders over its third segment; open air only).
- **The chain**: a hero standing on an intact segment sets it off, from the end it came on at
  (the end of the half it stands on, whichever way it faces). It chases a ghost (`blastTimes`): a
  hero with the slowest active hero's movement (the one whose ghost takes longest to cross) sets
  off from that end at the moment of the step, as fast as the hero who stepped on (else from
  rest), speeds up by its run (or walk) acceleration to its top speed and holds it; each segment
  blows the first frame the ghost is `BLAST_LEAD` (28) px past its far end. From rest that is
  Mario's first blast 39 frames after the step and then one about every 6.2 frames (his top
  speed), Simon's 48 and every 16; a hero already at full tilt gets no wind-up. Each segment
  flashes for `BLAST_FLASH` (16) frames first (a steady orange glow with reduce flashing), then
  its tile turns to air with a 32x32 boom (`contra:boom-0..3`, else the items sheet's blast) and
  the `bridge-boom` sound (else `explosion`). The booms hurt nobody. So a hero who runs flat out
  from rest on the post just about outruns it, every hero, small or big, with 16-18 px between its
  heels and the gap at every blast (tests: 8-25 px; QA of 0.4.9 found the first pacing, 0.8 of
  top speed after a fixed 36 frames, left 40-80 px by the far pillar); one who walks (Mario,
  Luigi), stops or takes a hit's knockback falls through. The bridge is whole again on any new
  visit (a respawn, a re-entry: World copies the map's tiles).
- **Ranged pits**: `w=N` limits a pit to columns x..x+N-1 (else, as before, every column from x
  on); `campaign` makes it sleep outside campaign play like a descent (a fall there kills). 7-3
  has `pit 128 -> 7-3-camp 2 0 w=15 campaign` under the bridge, whose gap is walled to the bottom
  by the pillars at 127 and 143, so only a fall through the blown bridge reaches it; every other
  fall in 7-3 still kills. A pit takes every player along (co-op fall arrival: `World.fallSpot`).

## Campaign looks (`LevelData.campaignLook`, 0.4.9)

A level can look different in campaign play only: the same tiles, zones, entities and collision
in another theme, music and decor (7-3 as a Contra jungle stage; since 0.4.12 the hero tributes:
2-1 as a Zelda II field `zelda2`, 3-1 as a Mega Man night stage `megaman-stage`, 4-2 as Metroid's
Brinstar `brinstar`, 5-4 as a Castlevania hall `castlevania`, 6-2 as a Ninja Gaiden city street
`ninja-city`, each with its own music; 1-1 stays as it is). The coin heavens above them (2-1-sky,
2-1-sky2, 3-1-sky, 6-2-sky) share the look; bonus rooms, water areas and the other areas keep
their own. A look stays after the hero is freed, and its music plays for every hero (a hero's own
overworld tune, `levelMusic` in `scenes/level.ts`, plays only in a plain `overworld` area). No
look is a water theme, and every rule that keys off the theme (`isWaterTheme`, `isCastleTheme`,
`hasSolidFloors`, `enemyPalette`) answers as for the classic level
(`src/content/levels/campaign-looks.test.ts`). In the map:

```
campaignTheme: contra-jungle
campaignMusic: contra-jungle
...
[campaign-decor]
canopy-hang 0 0
cloud-2 3 3
palm 1 12
```

- The headers and the section are parsed into `campaignLook: { theme, music?, decor? }` and
  written back by `serializeTextMap`. `campaignMusic` or `[campaign-decor]` without
  `campaignTheme` is a parse error.
- `applyLook` (`level/campaign.ts`), called by `campaignLevel`: the theme replaces the level's,
  `[campaign-decor]` (if given) replaces `[decor]`, and the music replaces the level's once that
  song is registered. A look whose theme is not registered yet (`isTheme`) is left out entirely,
  so a level can name its look before its art lands; nothing throws.
- Outside the campaign (level select, `?level=`, the editor) the level is exactly its own. For
  7-3 a test holds it to v0.4.8 tile for tile and in look (`tests/sim/fixtures/7-3-v0.4.8.map`).
- A reskin's checklist: the theme (and its music) registered as for any theme; the two headers
  and the decor in the level's map; a test like `tests/sim/bill-camp.test.ts` "outside the
  campaign".

## Hero variants (`[variant <hero>]`, Chapter 1 finishing pass)

A level can change for a hero: a map's `[variant <hero>]` section lists the extra tiles and
spawns that hero gets (laid when any player is that hero; campaign only, or in all play when
marked `classic`). `level/variants.ts`, applied in `Game.levelScene` after the campaign variant.
Sophia III's variants and the format are in docs/HEROES.md, "Her level variants".

## Story system (0.4.13)

In the campaign (`storyOn`, src/game/story/beats.ts) Toad is the map's guide: when a page shows,
his due story scenes (map/toad-guide.ts `dueScenes`) play in the map's `story` mode, in a box at
the top of the map, before the page's reveal draws in; for the major ones (World 1's entry after
1-0, the fake Bowsers, the airship crash, the 8-4 rift) his map sprite walks in from the left.
Each plays once per file (the save file's optional `story` list). The whole system (beats,
partners, castle pages, the fake Bowsers, 8-4's hand-off to Lost World 1, adding a beat) is in
docs/STORY_SYSTEM.md.

## Adding a page (checklist)

1. Sketch it in its own file (Lost Levels: `src/content/worldmap/lost/llN.ts`), export a
   `WorldMapPage` with the id, group and label above, one `start` node, nodes on walkable tiles in
   rows 2-13, contiguous paths.
2. Add it to its list in play order (`LOST_PAGES` in `lost/index.ts`; the hub is `HUB_PAGE`).
3. Give castles their exits (with `requires` where the rules need one) and any warp nodes their
   `to`/`toNode`/`requires`/`label`/`hint`. No Lost Levels page has a warp node (0.4.7).
4. Run `pnpm test`: `src/content/worldmap/pages.test.ts` checks every registered page (ids,
   labels, tiles, nodes, paths, warp targets, exits within the group but World 8's road on).
