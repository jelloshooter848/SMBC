# SMB3 bonus games and the item inventory (0.5.0)

Beating Larry Koopa (World 4-2's airship) opens a World 4 bonus spot and the item inventory.
The bonus spot plays one of three Super Mario Bros. 3 bonus games, rotating; their prizes go into
the inventory, which the world map uses before a level. Code: `src/game/bonus/` (public API in
`index.ts`). The bonus node, its road, the Hammer Bro and when the spot is open are the bonus
spot's (`src/game/map/bonus-spot.ts`, docs/WORLD_MAP.md "The bonus spot and its Hammer Bro").

World 2 has a bonus node of another kind: the **Top Secret Area** (0.4.10), a level behind its
node (`isBonusArea`) rather than a bonus game: five `?` blocks (fire flower x2, a Yoshi egg that
hatches a 1-up, mushroom x2), full on every visit, no rotation, no Hammer Bro and nothing saved. See
docs/WORLD_MAP.md "The Top Secret Area".

## The save fields (`SaveFile`, optional, no format bump)

| Field               | Meaning                                                                    | Missing               |
| ------------------- | -------------------------------------------------------------------------- | --------------------- |
| `inventoryUnlocked` | Larry's crystal ball taken: the map's Items entry and ITEMS button appear  | off (on with `larry`) |
| `bonusOpen`         | the bonus spot can be played; closed once used, reopened by the Hammer Bro | open                  |
| `bonusGuard`        | the used spot's Hammer Bro is out (after the next level entered)           | not out               |
| `inventory`         | item ids won, in order: `mushroom`, `flower`, `star`, `1up`; at most 12    | `[]`                  |
| `bonusNext`         | the rotation: 0 Toad House, 1 N-spade, 2 spade game                        | 0                     |
| `spadeBoard`        | the N-spade board in play (an index into `NSPADE_BOARDS`, 0.4.14)          | 0 (the first)         |
| `spadeTaken`        | its cards taken on earlier visits, whole pairs only (0.4.14)               | `[]`                  |
| `devInventory`      | dev mode's map menu "Item inventory"                                       | off                   |
| `itemsNext`         | items used from the map, waiting for the next level's start (one per kind) | `[]`                  |

`Game.inventoryUnlocked`, `Game.bonusOpen` and `Game.bonusGuard` carry the first three (the bonus spot's); `Game.bonus`
carries the rest (same names; `BonusState` in `items.ts`). Validation keeps known item ids only (at
most 12; `itemsNext`: mushroom, flower and star, each once, in that order) and each flag only when
it is `true`. `openFile` loads them and `autosave` writes them; outside campaign play `Game.bonus`
is a fresh, empty state. `Game.bonus.devItems` and `devNext` (dev mode's "Give items", given and
held) are never saved.

## The bonus spot

`src/game/bonus/spot.ts` registers `SMB3_BONUS` with the spot's `registerBonusGame` (the world map
imports it). The open node's hint line and the announcer name the next game in the rotation
(TOAD HOUSE, N-SPADE, SPADE GAME) and its map icon is `smb3:node-toad-house` or `smb3:node-spade`.
JUMP on it plays that game over the map. The **first choice** (a chest opened, a card turned, a
reel stopped) uses the visit at once, before any prize is given: the rotation moves on and the spot
closes (`Game.bonusUsed`, saved there), so reloading the page cannot replay it; prizes are saved as
they are won. The end then reports 'used' and goes back to the map (`bonusUsed` again changes
nothing). Giving up before any choice reports 'left': still open, the same game next time. The
spent spot has no guard until a level is entered from the map; then its Hammer Bro comes out, and
the spot reopens when he is beaten.

**The Hammer Bro's prize**: beating the Hammer Bro battle also gives an item (SMB3 does): a
mushroom, fire flower or star, weighted like a Toad House chest (`awardHammerPrize`), shown on the
battle's win card and stored like any bonus prize.

## Opening a bonus game elsewhere

- `openBonusGame(game, kind, onDone, { seed?, music? })`: one game of `kind` (`'toad-house'`,
  `'memory'`, `'slots'`) without touching the rotation. `seed` fixes the deal; `music` plays when it
  closes (default: the map page's music in campaign play).
- `nextBonusKind(save)` says which game comes next.
- The scene is pushed over the map and pops itself (with any menu over it). `onDone(result)` then
  runs once: `result.prizes` lists what was won, **already given and saved** (items in the
  inventory, lives and coins counted); `result.gaveUp` is true when the player chose Give up from
  its menu (prizes won before that are kept); `result.played` once any choice was made.
- `createBonusScene(game, kind, seed, onEnd, onPlayed?)`: the scene alone; `onPlayed` runs once at
  the first choice, before any prize (what the bonus spot uses).

## The games

Each game opens with its title and rules said by the announcer, ignores input for 20 frames (the
press that opened it), and ends on a result card at the bottom of the screen, closed with OK.
START opens the menu (Continue / Give up, plus the dev assists in dev mode) until the outcome is
decided: once the chest is open, the last reel stopped or the board over there is no menu, so
Give up can never drop a prize on its way (N-spade prizes are given as each pair is found). Prompts name
abilities (OPEN, TURN, STOP, OK) with the bound key after them, never bare button letters; the
touch buttons say the same. Nothing flashes: cursors are steady frames, and the only motion is
the pointer's bob over the chests (still with reduce flashing) and the reels.

### Toad House

A room you walk into (0.4.14, SMB3's): the hero walks in from the left on his own, Toad's line
"PICK A BOX. ITS CONTENTS WILL HELP YOU ON YOUR WAY." shows at the top, and three chests stand on
the wooden floor, Toad at the back on the right. The room is a real World (`toad-house.map`, one
screen, `toadHouseRoom()`), so every hero walks and jumps about it with his own moves (a sim per
hero and chest: `toad-house.test.ts`); nothing in it touches the run. Standing by a chest
(announced "Box 2. Open it?", the ATTACK button labelled OPEN), OPEN opens it: the other two are
gone at once (one pick). Its prize rises out and goes into the inventory with a banner ("YOU GOT A MUSHROOM! / ADDED TO YOUR ITEMS (1)"). In a round for fun (the arena, Dev → Mini games) nothing is kept: "YOU GOT A MUSHROOM! / (JUST FOR FUN)".
Chests are rolled from the seed as the house opens, each on its own: mushroom 50%, fire flower
35%, star 15% (`CHEST_WEIGHTS`). Music `toad-house`; sounds `powerup-appear` (the lid), `bonus-win`.

### N-spade (memory match)

18 cards face down in 3 rows of 6 on a green table: nine pairs, two each of mushroom, fire flower
and 1-up, one each of star, 10 coins and 20 coins (`MEMORY_PAIRS`). As in SMB3 the boards are a
fixed set dealt in turn, not a shuffle: `NSPADE_BOARDS` (rules.ts, eight layouts of our own), the
file's `spadeBoard`. A board stays as it was left: the pairs found stay gone on the next visit
(`spadeTaken`, saved with each pair's prize) until every pair on it is found; then the next board
comes (after the last, the first again). A round for fun plays the file's board and changes
nothing. The
arrows move a cursor (it wraps; the announcer says the row, card and what is face up there), TURN
turns a card. Two at a time: a matching pair stays up and wins its prize at once (items to the
inventory, a 1-up a life, coins added with 100 making a life); a miss shows both for 50 frames and
turns them back. Two misses end it (the second stays up), as does clearing the board. "MISSES
LEFT" shows at the top, the prizes won along the bottom. Music `bonus-game`; sounds `card-flip`, `bonus-win`,
`bump`.

### Spade game (slots)

Three reels, the top, middle and bottom thirds of a mushroom, fire flower or star picture, scroll
past a window (4 px a frame; the middle reel the other way). STOP halts them one at a time, top
first, on the picture nearest the window's middle. A full picture wins lives: mushroom 2, flower 3,
star 5 (SMB3's 2-up, 3-up, 5-up); a mismatch wins nothing. One try. Each strip has eight pictures,
stars the rarest (`SLOT_STRIPS`); the reels start from the seed. Music `bonus-game`; sounds
`slot-stop`, `bonus-win`, `bump`.

### The status bar

Every bonus game draws SMB3's status bar (`hud/smb3-status.ts`, as Larry's airship and the Hammer
Bro battle do) along the bottom 32 px: WORLD, the P-meter (empty here), coins, the hero's badge
and lives, the score and no clock, and the three end-card slots. The games keep their hints,
banners and result cards above it (`HINT_Y`, `STATUS_BAR_Y`).

### Art

The `smb3` sheet (`src/content/sprites/smb3.ts`): `chest-closed`, `chest-open`, `card-back`,
`card-<face>` (16×24), `slot-<picture>-top|mid|bot` (32×16), `item-<id>` (16×16, also the
inventory's icons), `node-toad-house` and `node-spade` (the map node). Toad is the items sheet's
`toad`.

## The item inventory

Once unlocked, the map menu has **Items** (second row, with the count) and the **ITEMS** button
(the special action; the touch button says ITEMS) opens the panel: SMB3's item box, a row of 12
slots over the bottom of the map, the selected item's name and what it does for player 1's hero
(the hero's own guide text). Left / right choose, **USE** uses it, **BACK** closes. Before the
inventory is unlocked there is no Items row, the button does nothing and `useInventoryItem`
refuses.

Using an item:

- **1-up**: a life at once (refused at 99).
- **Mushroom, fire flower, Starman**: held for the start of the next level (`itemsNext`) and given
  there to **player 1's hero who actually enters it**, after the character select (so picking
  another hero on the way keeps the item; a co-op file's player 2 gets none). One of each kind can
  wait (a second is refused and kept); the panel says "READY FOR THE START OF THE NEXT LEVEL!",
  each item's text ends "GIVEN AT THE NEXT LEVEL." and the waiting ones show as NEXT and their
  icons at the panel's top right.
- At the level's start (`applyHeldItems`, from `LevelScene.enter`; campaign levels only, not a
  stage tutorial) they go through the hero's own `CharacterDef.behaviour.onPowerUp`, as touching
  one in a level does: mushroom, then flower, then Starman (its music too). Mario grows or gets fire
  power; Link gains a heart container and the white tunic, or the red tunic; Mega Man the helmet or
  the next weapon... Their points are not kept. A mushroom or flower that would change nothing for
  that hero (tried first in a silent one-screen scratch world: fire Mario, a hero at full
  strength) goes back into the inventory, and the announcer says so (lost only if the inventory has
  filled up meanwhile). The run's power, hit points and kit are updated and the file saved at once.

A used item leaves the inventory and the file is saved; the panel says what happened and the next
press closes it (a refused use goes back to the list).

**Prizes when the inventory is full** (or not unlocked yet): the item is used as from the panel
instead (a 1-up at once, the others held for the next level; SMB3 lost it). If one of its kind is
already waiting, it is lost, and the banner says so.

## Dev mode

- Map menu **Item inventory** (on / off, next to All heroes / Unlock all): unlocks the inventory
  at once while dev mode is on (the Items row appears in the open menu). It never writes
  `inventoryUnlocked`; with dev mode off it has no effect.
- Map menu **Give items**: one of each item, as room allows, into a dev list that is **never
  saved** (`Game.bonus.devItems`). It turns Item inventory on; the dev items show after the file's
  own and can be used like them, only while dev mode and Item inventory are on. A used dev item
  waits in its own unsaved list (`devNext`; one per kind across both lists) and is given at the
  next level's start like the file's; one that would do nothing goes back to the dev list, never
  into the file's inventory. Dev mode or the toggle off: both dev lists are cleared. The file's
  items and the dev items together stay at 12: an item won pushes the last dev item out.
- **Dev → Bonus games**: the three games from the dev menu; one game, then a card listing what it
  won, and back to the list. Nothing sticks: no file is written, the run and the bonus state are
  put back.
- Dev server: `?bonus=toad-house|memory|slots` (optionally `&seed=N`) plays one over the title
  (the scene is `window.__bonusGame`; the game is `window.__game` on the dev server).

## Tests

`src/game/bonus/rules.test.ts` (each game's rules from a seed, the weights, the rotation) and
`tests/sim/bonus.test.ts` (the save fields, the panel locked and unlocked, each item for Mario and
for Link given at the next level's start, a mushroom used as Mario going to Link when Link is
picked, a useless one coming back, one per kind, every hero with a mushroom and a flower, the dev
toggle and unsaved Give items, each game played through the scene, prizes, a full inventory, no
Give up once decided, the bonus spot's rotation, used / left and a reload after the first choice,
the Hammer Bro prize, Dev → Bonus games); `tests/sim/larry.test.ts` checks the prize after a won
Hammer Bro battle.
