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

| kind              | Meaning                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| `start`           | The page's arrival node. May also carry the warp fields (see below).         |
| `level`, `castle` | Enter `level` with JUMP. A castle clear opens the page(s) its exits lead to. |
| `bonus`           | Hidden until `unlock` (a secret key) is found.                               |
| `warp`            | JUMP warps to another page (see below).                                      |

A node with `unlock: '<key>'` (any kind) is hidden, with its road, until the file has that secret
(`MapProgress.secrets`). Bonus nodes always need one.

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
registered page (the hub included, so the Worlds menu lists it), and still keeps `unlock`-hidden
nodes hidden until their secret is found.

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

- `MapProgress`: `cleared` (main level ids), `pages` (open page ids, `smb-1` always),
  `secrets`, `position: { page, node }`, `gameCleared`.
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
  marks the pipe with the secret. Taking it clears 1-2, records `bonus-1`, returns to the World 1
  map and draws in the road from 1-1 to World 1's warp spot (the old bonus slot at (6,11), now a
  warp node to `hub`, hidden by `unlock: 'bonus-1'`).
- Dev select, `?level=` and custom play keep the classic three numbered pipes.
- SMB 4-2's warp zones are unchanged (they still skip worlds); a `secret=` key on one is the hook
  for a future secret. Lost Levels warp zones (backward ones too) are unchanged.

## Adding a page (checklist)

1. Sketch it in its own file (Lost Levels: `src/content/worldmap/lost/llN.ts`), export a
   `WorldMapPage` with the id, group and label above, one `start` node, nodes on walkable tiles in
   rows 2-13, contiguous paths.
2. Add it to its list in play order (`LOST_PAGES` in `lost/index.ts`; the hub is `HUB_PAGE`).
3. Give castles their exits (with `requires` where the rules need one) and any warp nodes their
   `to`/`toNode`/`requires`/`label`/`hint`. Only Lost World 1 has a warp back to the hub.
4. Run `pnpm test`: `src/content/worldmap/pages.test.ts` checks every registered page (ids,
   labels, tiles, nodes, paths, warp targets, exits within the group).
