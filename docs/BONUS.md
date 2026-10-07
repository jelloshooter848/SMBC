# SMB3 bonus games and the item inventory (0.5.0)

Beating Larry Koopa (World 4-2's airship) opens a World 4 bonus spot and the item inventory.
The bonus spot plays one of three Super Mario Bros. 3 bonus games, rotating; their prizes go into
the inventory, which the world map uses before a level. Code: `src/game/bonus/` (public API in
`index.ts`). The bonus node, its road, the Hammer Bro and when the spot is open are the bonus
spot's (`src/game/map/bonus-spot.ts`, docs/WORLD_MAP.md "The bonus spot and its Hammer Bro").

## The save fields (`SaveFile`, optional, no format bump)

| Field               | Meaning                                                                    | Missing               |
| ------------------- | -------------------------------------------------------------------------- | --------------------- |
| `inventoryUnlocked` | Larry's crystal ball taken: the map's Items entry and ITEMS button appear  | off (on with `larry`) |
| `bonusOpen`         | the bonus spot can be played; closed once used, reopened by the Hammer Bro | open                  |
| `inventory`         | item ids won, in order: `mushroom`, `flower`, `star`, `1up`; at most 12    | `[]`                  |
| `bonusNext`         | the rotation: 0 Toad House, 1 N-spade, 2 spade game                        | 0                     |
| `devInventory`      | dev mode's map menu "Item inventory"                                       | off                   |
| `starNext`          | a Starman used from the map waits for the start of the next level          | off                   |

`Game.inventoryUnlocked` and `Game.bonusOpen` carry the first two (the bonus spot's); `Game.bonus`
carries the rest (same names; `BonusState` in `items.ts`). Validation keeps known item ids only (at
most 12) and each flag only when it is `true`. `openFile` loads them and `autosave` writes them;
outside campaign play `Game.bonus` is a fresh, empty state.

## The bonus spot

`src/game/bonus/spot.ts` registers `SMB3_BONUS` with the spot's `registerBonusGame` (the world map
imports it). The open node's hint line and the announcer name the next game in the rotation
(TOAD HOUSE, N-SPADE, SPADE GAME) and its map icon is `smb3:node-toad-house` or `smb3:node-spade`.
JUMP on it plays that game over the map. Once any choice was made (a chest opened, a card turned,
a reel stopped) the visit counts as used, even if the player then gives up: the rotation moves on
and the spot closes until its Hammer Bro is beaten ('used'). Giving up before any choice leaves it
open, with the same game next time ('left').

**The Hammer Bro's prize**: beating the Hammer Bro battle also gives an item (SMB3 does): a
mushroom, fire flower or star, weighted like a Toad House chest (`awardHammerPrize`), shown on the
battle's win card and stored like any bonus prize.

## Opening a bonus game elsewhere

- `openNextBonus(game, onDone)`: the next game in the rotation, advanced (and saved) once played.
- `openBonusGame(game, kind, onDone, { seed?, music? })`: one game of `kind` (`'toad-house'`,
  `'memory'`, `'slots'`) without touching the rotation. `seed` fixes the deal; `music` plays when it
  closes (default: the map page's music in campaign play).
- `nextBonusKind(save)` says which game comes next.
- The scene is pushed over the map and pops itself (with any menu over it). `onDone(result)` then
  runs once: `result.prizes` lists what was won, **already given and saved** (items in the
  inventory, lives and coins counted); `result.gaveUp` is true when the player chose Give up from
  its menu (prizes won before that are kept); `result.played` once any choice was made.

## The games

Each game opens with its title and rules said by the announcer, ignores input for 20 frames (the
press that opened it), and ends on a result card at the bottom of the screen, closed with OK.
START opens the menu (Continue / Give up, plus the dev assists in dev mode). Prompts name
abilities (OPEN, TURN, STOP, OK) with the bound key after them, never bare button letters; the
touch buttons say the same. Nothing flashes: cursors are steady frames, and the only motion is
the pointer's bob over the chests (still with reduce flashing) and the reels.

### Toad House

Toad and three chests on a wooden floor; Toad says "PICK A BOX. ITS CONTENTS WILL HELP YOU ON YOUR
WAY." Left / right move the pointer (announced "Box 2 of 3"), OPEN opens the chest. Its prize rises
out and goes into the inventory with a banner ("YOU GOT A MUSHROOM! / ADDED TO YOUR ITEMS (1)").
Chests are rolled from the seed as the house opens, each on its own: mushroom 50%, fire flower
35%, star 15% (`CHEST_WEIGHTS`). Music `toad-house`; sounds `powerup-appear` (the lid), `bonus-win`.

### N-spade (memory match)

18 cards face down in 3 rows of 6 on a green table: nine pairs, two each of mushroom, fire flower
and 1-up, one each of star, 10 coins and 20 coins (`MEMORY_PAIRS`), shuffled from the seed. The
arrows move a cursor (it wraps; the announcer says the row, card and what is face up there), TURN
turns a card. Two at a time: a matching pair stays up and wins its prize at once (items to the
inventory, a 1-up a life, coins added with 100 making a life); a miss shows both for 50 frames and
turns them back. Two misses end it (the second stays up), as does finding every pair. "MISSES
LEFT" shows at the top, the prizes won along the bottom. A fresh board each time (SMB3 kept the
board between visits; one game per visit here). Music `bonus-game`; sounds `card-flip`, `bonus-win`,
`bump`.

### Spade game (slots)

Three reels, the top, middle and bottom thirds of a mushroom, fire flower or star picture, scroll
past a window (4 px a frame; the middle reel the other way). STOP halts them one at a time, top
first, on the picture nearest the window's middle. A full picture wins lives: mushroom 2, flower 3,
star 5 (SMB3's 2-up, 3-up, 5-up); a mismatch wins nothing. One try. Each strip has eight pictures,
stars the rarest (`SLOT_STRIPS`); the reels start from the seed. Music `bonus-game`; sounds
`slot-stop`, `bonus-win`, `bump`.

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

Using an item applies it to **player 1's hero** now (the hero who will enter the next level; a
co-op file's player 2 gets none):

- **Mushroom / fire flower**: the hero's own `CharacterDef.behaviour.onPowerUp`, as touching one
  in a level does, run in a silent one-screen scratch world; power, hit points and kit are carried
  back into the run (Mario grows or gets fire power; Link a heart container and the white tunic, or
  the red tunic; Mega Man the helmet or the next weapon...). Its points are not kept. When it would
  change nothing (fire Mario, a hero at full strength) it is refused and kept: "MARIO IS AT FULL
  POWER. SAVE THE MUSHROOM FOR LATER."
- **Starman**: star power at the start of the next level (`starNext`; `LevelScene.enter` gives it
  through the hero's own `onPowerUp`, music included, and saves). Only one can wait at a time.
- **1-up**: a life (refused at 99).

A used item leaves the inventory and the file is saved; the panel says what happened and the next
press closes it (a refused use goes back to the list).

**Prizes when the inventory is full** (or not unlocked yet): the item is used at once on player 1's
hero instead (SMB3 lost it; this is kinder). If that use would do nothing, it is lost, and the
banner says so.

## Dev mode

- Map menu **Item inventory** (on / off, next to All heroes / Unlock all): unlocks the inventory
  at once while dev mode is on (the Items row appears in the open menu). It never writes
  `inventoryUnlocked`; with dev mode off it has no effect.
- Map menu **Give items**: one of each item, as room allows; saved.
- **Dev → Bonus games**: the three games from the dev menu; one game, then a card listing what it
  won, and back to the list. Nothing sticks: no file is written, the run and the bonus state are
  put back.
- Dev server: `?bonus=toad-house|memory|slots` (optionally `&seed=N`) plays one over the title
  (the scene is `window.__bonusGame`; the game is `window.__game` on the dev server).

## Tests

`src/game/bonus/rules.test.ts` (each game's rules from a seed, the weights, the rotation) and
`tests/sim/bonus.test.ts` (the save fields, the panel locked and unlocked, each item for Mario and
for Link, the star at the next level's start, the dev toggle and Give items, each game played
through the scene, prizes, a full inventory, Give up, the bonus spot's rotation and used / left,
the Hammer Bro prize, Dev → Bonus games); `tests/sim/larry.test.ts` checks the prize after a
won Hammer Bro battle.
