# Hero power-ups (0.4.34 design draft)

Every hero gets their own items from the power blocks: their own grow item in place of the mushroom,
and their own power items (beams, weapons, sub-weapons, spells, guns) in place of the fire flower, each placed by
design, block by block. This file is the design for the owner to approve **before anything is built**; nothing
here exists in the game yet. It ends with the open questions (section 12).

**How to read this file**

- **Today** means the game as it is on `main` (0.4.31). **NEW** marks what this release adds or changes.
- Item names are written as the game shows them; item ids (`ice-beam`) are what `.map` files and save files use.
- Each hero's section (section 5) is self-contained: grow item, starting kit, power items, default power, what a
  hit takes, what is odd today, and what Crossover did.
- The placement plan (section 6) is a first pass. Every block and every entry in it can be changed; the rules in
  sections 2-4 are what the owner approves.
- Mario and Luigi are written once (they share their rules and items).

## 1. The idea in short

| Owner decision        | What it means in the game                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Grow slot          | Each hero has one **grow item**, always the mushroom's equal: the take-a-hit / get-bigger item. Mario and Luigi's is the mushroom.                           |
| 2. Power slot         | Each hero has a list of distinct **power items**, each with its own name, sprite, effect and pickup sound. No tiers, no mapping between heroes.              |
| 3. Placed, not random | Each power block in a level has a fixed **entry** per hero saying what it gives that hero, the same on every playthrough. SMB's rule stays: small gets grow. |
| 4. Per-hero inventory | Each hero has their own SMB3 item inventory. Prizes go to the hero being played.                                                                             |
| 5. Co-op              | A block's item belongs to whoever bumped it; if the other player grabs it, it becomes the grabber's entry for that block.                                    |
| 6. Classic play       | Outside the campaign everyone keeps the mushroom and the fire flower, as today.                                                                              |
| 7. Losing powers      | A hit takes what it takes today, per hero (section 7).                                                                                                       |
| 8. Training           | A later release shows each unlock with the real item (section 10).                                                                                           |
| 9. Art and sound      | Every new sprite and sound is original, in each hero's game style (section 11).                                                                              |

## 2. Words used

- **Grow item**: the hero's mushroom. A hero without it is **small** (section 2.1). Some grow items **stack**
  (Link's heart containers, Samus's energy tanks, Bill's medals): each copy adds more, up to a maximum.
- **Power item**: one entry of the hero's power list. A few stack too (Ryu's ninpo scroll).
- **Entry**: what one power block gives one hero, written in the level's `[hero-items]` section (section 3).
- **Default power**: what a power block with **no entry** for that hero gives (Lost Levels blocks in 0.4.34, custom
  and shared levels played in the campaign, any block the plan leaves blank).
- **Owned**: the hero already has the item (a stacking item counts as owned once it is at its maximum).
- **Refill / points**: what an owned item gives instead, defined per hero. Every item taken also scores 1000, as
  today.

### 2.1 Small, per hero

SMB's rule stays for every hero: **a small hero bumping any power block gets their grow item**, whatever the
block's entry. "Small" per hero:

| Hero         | Small means                                        |
| ------------ | -------------------------------------------------- |
| Mario, Luigi | power state `small`                                |
| Sophia III   | power state `small` (her Normal)                   |
| Link         | no heart container (3 hearts)                      |
| Mega Man     | no helmet                                          |
| Samus        | no energy tank (30 energy)                         |
| Simon        | no pot roast (NEW: a 10-point health bar, see 5.5) |
| Ryu          | no medicine (NEW: a 10-point health bar, see 5.6)  |
| Bill         | no medal (3 hits)                                  |

Hit-point heroes never lose their grow item to a hit (section 7), so they are small only on a fresh start (and after
a death, depending on open question Q1). Mario, Luigi and Sophia III become small again with hits, as today.

## 3. Power blocks and the `[hero-items]` section

### 3.1 Which blocks

A **power block** is any block whose content is `powerup` (`src/game/level/tiles.ts`): the `.map` legend chars
**`M`** (`Q_POWERUP`, a ? block), **`P`** (`BRICK_POWERUP`, a brick) and **`3`** (`HIDDEN_POWERUP`, a hidden block;
no SMB level uses one). Today `World.strikeBlock` spawns `p.def.blockPowerUp(p)` from them, which is each hero's
mushroom-or-flower choice.

The Top Secret Area's fixed blocks (World 2) follow the same idea: **`R`** (`Q_MUSHROOM`) always gives the hero's
grow item (refill when owned) and takes no entries; **`W`** (`Q_FLOWER`) gives the hero's entry, or their default
power. `U`, `*`, `S`, `L`, `4`-`6` (1-ups, stars, poison) are unchanged.

### 3.2 The format (NEW)

A new section in the level's own `.map` file, keyed by the block's tile position (the same `x y` as entities and
zones). One line per block; a hero not named on a line gets their default power from that block.

```
[hero-items]
;; x y   hero=item ...   (a hero not named gets their default power)
21 9    link=heart-container megaman=helmet samus=energy-tank simon=pot-roast ryu=medicine bill=medal
78 9    samus=long-beam
109 5   link=bomb-bag megaman=leaf-guard simon=dagger
```

- **Keys** are `CharacterDef` ids (`link`, `megaman`, `samus`, `simon`, `ryu`, `bill`, `sophia`; `mario` and `luigi`
  are accepted for the later Mario powers). **Values** are that hero's item ids (section 5), or `grow` for the
  hero's grow item.
- **Checked when the map is parsed** (`MapParseError` with the line, as other sections): the tile at `x y` must be a
  power block (`M`, `P`, `3` or `W`) once the campaign look and any hero variant are laid; each hero once per line;
  each item must be in that hero's list.
- **Sub-areas** (bonus rooms, the airship, the cavern) carry their own section in their own file.
- **Campaign only**: classic play ignores the section (section 9). The editor keeps it when saving (round trip).
- A test keeps the placement honest (section 6.1): every power item of every hero is placed at least twice in
  Worlds 1-8.

### 3.3 How a block gives its item (NEW)

1. A player strikes the block (a head bump, Link's sword, Samus's bombs and missiles, a saw disc: whatever opens
   it today). That player is the block's **owner**. A block opened with no player behind it belongs to player 1.
2. The item is worked out for the owner's hero: small → grow item; else the block's entry, or the default power.
   It rises out of the block with SMB's `powerup-appear` (the block is SMB's) but in **the item's own sprite**.
3. It moves as the mushroom (slides) or the flower (stays) does today: grow items and stacking items slide, the
   rest stay put. (Open question Q9.)
4. **Taking it**: the item's own pickup sound, 1000 points, the effect. The first time a hero takes an item they
   do not own, its name shows for two seconds under the HUD and the announcer reads it with its one-line
   description ("Ice Beam: it freezes what it hits."). An owned item gives its refill or points and the hero's
   refill sound.
5. **Co-op**: if the other player touches it first, it is worked out again for **their** hero, from the same block's
   entry (small → their grow item), and its sprite changes in their hands. The rising sprite always shows the
   owner's item.

## 4. Default power and "owned again", all heroes

| Hero         | Grow item       | Default power (no entry) | An owned power item gives                         | An owned grow item gives          |
| ------------ | --------------- | ------------------------ | ------------------------------------------------- | --------------------------------- |
| Mario, Luigi | Super Mushroom  | Fire Flower              | 1000 points (SMB)                                 | 1000 points (SMB)                 |
| Link         | Heart Container | Boomerang                | full hearts and magic, bombs topped up            | full hearts and magic             |
| Mega Man     | Helmet          | Saw Disc                 | full health and all weapon energy                 | full health and all weapon energy |
| Samus        | Energy Tank     | Missiles                 | full energy and 10 missiles                       | full energy                       |
| Simon        | Pot Roast       | Chain Whip               | 10 hearts (sub-weapon ammo) and full health       | full health                       |
| Ryu          | Medicine        | Throwing Star            | full ninpo and full health                        | full health                       |
| Bill         | Medal           | Machine Gun (M)          | full health (his hits)                            | full health                       |
| Sophia III   | Power Capsule   | Crusher                  | missile ammo (12 triple, 4 homing) and full hover | a full hover bar                  |

The default power is each hero's **first** power item, so a blank block is a second chance at the start of the kit
and then a refill. Sophia's is the Crusher because a hit takes it (as Mario's flower).

## 5. The heroes

### 5.1 Mario and Luigi

- **Grow**: Super Mushroom (`mushroom`). **Power**: Fire Flower (`fire-flower`). **Default**: Fire Flower.
- **Placement**: SMB's exactly. Every SMB power block gives the mushroom when small and the flower when big, so
  their entries are all the default: no `mario=` or `luigi=` lines are needed anywhere.
- **Hit**: fire → small (with the assist "fire reverts to big": fire → big), big → small, small dies. Unchanged.
- **Later**: the feather and the Tanooki leaf join the power list (open question Q11). Their blocks then need
  `mario=` / `luigi=` entries; a block without one stays the Fire Flower.
- **Art and sound**: none new (the items sheet's `mushroom` and `flower-0/1`, sfx `powerup`).

### 5.2 Link

His kit is Zelda II's sidescroller (spells, thrusts) with Zelda's dungeon items.

- **Grow**: Heart Container (`heart-container`): one more heart (+2 hit points), full heal. Stacks: 3 hearts → 8
  (five containers, `MAX_HEARTS`). **Today** the mushroom also gives the white tunic; NEW: that is the Blue Ring.
- **Starting kit** (NEW): sword, shield, down-thrust and up-thrust. **Today** Link starts with all five belt tools
  (boomerang, bombs and the three spells) and a full magic meter; under this design they are found. The magic
  meter shows once he has a spell.

| Item          | Id              | What it does (our code)                                                 | Owned again        |
| ------------- | --------------- | ----------------------------------------------------------------------- | ------------------ |
| Boomerang     | `boomerang`     | The belt's boomerang: stuns, fetches coins and items                    | refill             |
| Bomb Bag      | `bomb-bag`      | Bombs on the belt, with 4 bombs (carries 8; drops refill them)          | bombs to 8, refill |
| Shield Spell  | `shield-spell`  | The belt's Shield spell (8 magic: every other hit glances off for 10 s) | refill             |
| Jump Spell    | `jump-spell`    | The belt's Jump spell (8 magic: higher jumps for 10 s)                  | refill             |
| Blue Ring     | `blue-ring`     | Today's white tunic: every other hit glances off                        | refill             |
| Fire Spell    | `fire-spell`    | The belt's Fire spell (4 magic: the next swing fires a beam)            | refill             |
| Magical Sword | `magical-sword` | Today's red tunic: the sword fires a beam while hearts are full         | refill             |

- **Default**: Boomerang. **Drops** (bombs, magic jars, half hearts) as today, but bombs drop only once he has
  the Bomb Bag (NEW).
- **Hit**: half a heart (1 hit point); with the Blue Ring or the Shield spell every other hit glances off. Nothing
  is lost. Unchanged.
- **Flags**: the starting belt shrinks (open question Q5); the Blue Ring palette is today's white tunic (`link-white`).
- **Crossover** had the Magic Boomerang, Bow, Red Ring, Magical Sword, Bomb Bag and Quiver, never losing the bow,
  bombs and sword.

### 5.3 Mega Man

- **Grow**: Helmet (`helmet`): the charge shot and brick breaking, full health. Single. **Today** the helmet also
  gives the Rush Coil; NEW: Rush is its own item.
- **Starting kit**: the buster, the slide. E-tanks stay drops.

| Item           | Id               | What it does (our code)                                     | Owned again |
| -------------- | ---------------- | ----------------------------------------------------------- | ----------- |
| Saw Disc       | `saw-disc`       | 8-way blade that cuts bricks (2 energy)                     | refill      |
| Leaf Guard     | `leaf-guard`     | Circles him, swats shots, thrown on a second press (4)      | refill      |
| Rush Coil      | `rush-coil`      | The spring on the belt (3); NEW: no longer needs the helmet | refill      |
| Flame Wave     | `flame-wave`     | Runs along the floor, burns shells (3)                      | refill      |
| Homing Knuckle | `homing-knuckle` | Slow fist that seeks, three damage (4)                      | refill      |
| Bolt           | `bolt`           | A beam across the screen (5)                                | refill      |

- **Default**: Saw Disc. The belt order stays the code's (`WEAPONS`), with only the weapons he owns.
- **Hit**: 4 of 28 health. Nothing is lost. Unchanged.
- **Flags**: today weapons unlock in a fixed order (`scratch.weapons` is a count); NEW: each is its own flag.
- **Crossover** never lost any weapon (`NEVER_LOSE_UPGRADES` held all nine and Rush).

### 5.4 Samus

- **Grow**: Energy Tank (`energy-tank`): +30 energy, full energy. Stacks: 30 → 90 (two tanks, `MAX_TANKS`; open
  question Q6 asks for more). **Today** the first mushroom gives the Varia Suit; NEW: Varia is a power item.
- **Starting kit**: the Power Beam (short range), aiming up, the Morph Ball and its bombs (as today).

| Item       | Id           | What it does (our code)                                                      | Owned again          |
| ---------- | ------------ | ---------------------------------------------------------------------------- | -------------------- |
| Missiles   | `missiles`   | The missile launcher with 10 missiles (holds 30): three damage, opens bricks | +10 missiles, refill |
| Long Beam  | `long-beam`  | Full range for every beam                                                    | refill               |
| Ice Beam   | `ice-beam`   | Freezes what it hits; a second shot shatters                                 | refill               |
| Varia Suit | `varia-suit` | Half damage                                                                  | refill               |
| Wave Beam  | `wave-beam`  | Snakes through walls and enemies                                             | refill               |

- **Default**: Missiles.
- **Beams as items** (NEW): today the beam is a tier (`scratch.beam` 0-3: Power, Long, Ice, Wave), so Ice brings
  full range and Wave drops the freeze. As items: the Long Beam gives range to whichever beam is in use; Ice and
  Wave are both kept and WEAPON cycles beam, Ice, Wave and missiles. Open question Q7 offers Metroid's rule instead
  (Ice and Wave replace each other).
- **Drops**: missile packs drop only once she has Missiles (**today** they drop from the start, so missiles come at
  random).
- **Hit**: 8 energy (4 with the Varia Suit). Nothing is lost. Unchanged.
- **Later**: Screw Attack, High Jump Boots, Missile Tanks (not in our code; Crossover had them).
- **Crossover** never lost the missiles and morph ball; the Long Beam was its mushroom.

### 5.5 Simon

- **Grow**: Pot Roast (`pot-roast`): the health bar grows from 10 to 16 and fills. Single; owned again it fills
  the bar (the wall meat's own job). **NEW**: small Simon has a 10-point bar (five hits); **today** he always has
  16 and no grow item (open question Q4).
- **Starting kit**: the leather whip, 5 hearts.

| Item         | Id             | What it does (our code)                               | Owned again        |
| ------------ | -------------- | ----------------------------------------------------- | ------------------ |
| Chain Whip   | `chain-whip`   | Whip reach 24 px                                      | +10 hearts, health |
| Dagger       | `dagger`       | Sub-weapon: fast and straight (1 heart)               | +10 hearts, health |
| Holy Water   | `holy-water`   | Sub-weapon: a flame on the floor (1 heart)            | +10 hearts, health |
| Axe          | `axe`          | Sub-weapon: lobbed high over walls (1 heart)          | +10 hearts, health |
| Morning Star | `morning-star` | Whip reach 32 px (the longest, whichever whip he had) | +10 hearts, health |
| Cross        | `cross`        | Sub-weapon: spins out and back (1 heart)              | +10 hearts, health |
| Double Shot  | `double-shot`  | Two sub-weapons on screen                             | +10 hearts, health |
| Stopwatch    | `stopwatch`    | Sub-weapon: freezes the screen (5 hearts)             | +10 hearts, health |
| Triple Shot  | `triple-shot`  | Three sub-weapons on screen (whichever shot he had)   | +10 hearts, health |

- **Default**: Chain Whip. Whip and shot items are individual: he uses the best he owns, so a Morning Star found
  before the Chain Whip is simply the Morning Star.
- **Hit**: 2 of his health. Nothing is lost. Unchanged.
- **Flags**: today the whip and shots are tiers (`whip` 0-2, `multi` 1-3) and sub-weapons a count (`subs`); NEW:
  one flag each. The HUD shows no double / triple badge today (Castlevania's II / III; section 11 lists it).
- **Crossover** started with the dagger and never lost a sub-weapon or the double / triple shot.

### 5.6 Ryu

- **Grow**: Medicine (`medicine`, Ninja Gaiden's restorative medicine): the health bar grows from 10 to 16 and
  fills. Single; owned again it fills the bar. **NEW** as for Simon (open question Q4).
- **Starting kit**: the Dragon Sword, wall cling and wall jump, a 40-point ninpo meter (it shows once he has an art).

| Item           | Id              | What it does (our code)                             | Owned again      |
| -------------- | --------------- | --------------------------------------------------- | ---------------- |
| Throwing Star  | `throwing-star` | Art: straight and fast (3 ninpo)                    | ninpo and health |
| Ninpo Scroll   | `ninpo-scroll`  | Ninpo maximum +20 and full (stacks: 40 → 99, three) | ninpo and health |
| Windmill Star  | `windmill`      | Art: cuts through and comes back (5)                | ninpo and health |
| Fire Wheel     | `fire-wheel`    | Art: flames circle him (5)                          | ninpo and health |
| Jump and Slash | `jump-slash`    | Art: a somersault that cuts (5)                     | ninpo and health |

- **Default**: Throwing Star. **Today** the mushroom gives the next art and the flower the bigger meter.
- **Hit**: 2 of his health. Nothing is lost. Unchanged.
- **Crossover** started with the shuriken and had the Scroll (a bigger meter) and a sword extension (not in our code).

### 5.7 Bill

- **Grow**: Medal (`medal`, Contra's lives badge): one more hit, full health. Stacks: 3 hits → 5 (two medals).
- **Starting kit**: the rifle, 8-way aim, prone.

| Item        | Id            | What it does (our code)             | Owned again |
| ----------- | ------------- | ----------------------------------- | ----------- |
| Machine Gun | `machine-gun` | Falcon **M**: hold to keep firing   | full health |
| Laser       | `laser`       | Falcon **L**: one beam that pierces | full health |
| Flame Gun   | `flame-gun`   | Falcon **F**: a slow heavy fireball | full health |
| Spread Gun  | `spread-gun`  | Falcon **S**: five shots in a fan   | full health |

- **Default**: Machine Gun. A new gun becomes the selected one, as today.
- **Drops**: **today** the rare `capsule` drop unlocks the next gun at random; NEW: it is a health pickup (open
  question Q8).
- **Hit**: 1 hit. Nothing is lost. Unchanged (in Contra a death takes the gun; see Q1).
- **Later**: Rapid Bullets (R) and Barrier (B) (not in our code).
- **Crossover** kept only the rapid-fire upgrades on death.

### 5.8 Sophia III

- **Grow**: Power Capsule (`power-capsule`, Blaster Master's P capsule): Normal → Hyper, the Hyper cannon and the
  hover. Owned again: a full hover bar (as today's mushroom).
- **Starting kit**: Normal cannon, driving, the nose-first drop, Jason on foot.

| Item           | Id               | What it does (our code)                                                           | Owned again  |
| -------------- | ---------------- | --------------------------------------------------------------------------------- | ------------ |
| Crusher        | `crusher`        | Hyper → Crusher: the Crusher cannon, wall and ceiling climbing                    | missile ammo |
| Triple Missile | `triple-missile` | Three missiles through walls (9 to start, holds 60); **today** comes with Crusher | missile ammo |
| Homing Missile | `homing-missile` | Seeks enemies (3 to start, holds 20); **today** never given in the campaign       | missile ammo |

- **Default**: Crusher. Like Mario's flower, a small (Normal) Sophia gets the capsule first, then the Crusher.
- **Hit**: Hyper or Crusher → Normal ("Lose Everything", SO-23; with the assist "fire reverts to big", Crusher →
  Hyper); missiles and their ammo are kept; Normal dies. Unchanged.
- **Flags**: the Homing Missile is unobtainable in the campaign today (only her mini game's `TANK_KIT` has it).
  Blaster Master's separate Wall 1 / Wall 2 could split from the Crusher (open question Q10).
- **Crossover** had Hover, Crusher, Wall Climb and Ceiling Climb, never losing the missiles.

## 6. First-pass placement plan (SMB Worlds 1-8)

### 6.1 The rules of the plan

- **48 power blocks** in Worlds 1-8 (`M` and `P`; no SMB level has a `3`), plus Mario's 1-0 (his only, no entries).
  2-2, 4-4, 5-1, 7-2, 7-4, 8-1 and 8-4 have none.
- **Each world brings one or two new items per hero**, in roughly their own game's order; Worlds 7 and 8 are mostly
  second chances.
- **Grow blocks**: each world's first block and each castle's block give the grow item to the hit-point heroes,
  so a small hero arriving loses nothing that matters, and a castle tops them up before Bowser (owned: refill).
  Mario, Luigi and Sophia III take their default there (a small one gets the grow item anyway).
- **Second chances**: every power item is placed at least twice, so one taken as a grow item by a small hero (or
  missed) comes again.
- **Freed late**: a hero is freed in their own world (Luigi 1-1, Link 2-1, Mega Man 3-1, Samus 4-2, Simon 5-4,
  Ryu 6-2, Bill 7-3, Sophia III 8-4), so on the first pass they meet only their own world's blocks and later
  ones. Open question Q2 proposes an **arrival kit**: the items placed for them in the earlier worlds.

### 6.2 New items per world

The grow item also comes at every world's first block and every castle.

| World | Link                     | Mega Man             | Samus               | Simon              | Ryu                          | Bill        | Sophia III     |
| ----- | ------------------------ | -------------------- | ------------------- | ------------------ | ---------------------------- | ----------- | -------------- |
| 1     | Boomerang, Bomb Bag      | Saw Disc, Leaf Guard | Long Beam, Missiles | Chain Whip, Dagger | Throwing Star, Ninpo Scroll  | Machine Gun | Crusher        |
| 2     | Shield Spell, Jump Spell | Rush Coil            | Ice Beam            | Holy Water, Axe    | Windmill Star                | -           | Triple Missile |
| 3     | Blue Ring                | Flame Wave           | -                   | Morning Star       | -                            | Laser       | -              |
| 4     | Fire Spell               | Homing Knuckle       | Varia Suit          | Cross, Double Shot | Fire Wheel, Ninpo Scroll     | -           | -              |
| 5     | Magical Sword            | -                    | -                   | Stopwatch          | -                            | Flame Gun   | Homing Missile |
| 6     | -                        | Bolt                 | Wave Beam           | Triple Shot        | Jump and Slash, Ninpo Scroll | -           | -              |
| 7     | -                        | -                    | -                   | -                  | -                            | Spread Gun  | -              |
| 8     | -                        | -                    | -                   | -                  | -                            | -           | -              |

### 6.3 Block by block

Mario and Luigi are left out: every block is their default (the Fire Flower). **Grow** is the hero's grow item.
_Italics_ are the hero's default power: no entry is written for it. Blocks are `level (x,y)`, `?` a ? block and
`brick` a power brick; "off path" blocks are in a bonus room or campaign side area.

**World 1**

| Block               | Link        | Mega Man | Samus      | Simon   | Ryu       | Bill | Sophia    |
| ------------------- | ----------- | -------- | ---------- | ------- | --------- | ---- | --------- |
| 1-1 (21,9) ?        | Grow        | Grow     | Grow       | Grow    | Grow      | Grow | _Crusher_ |
| 1-1 (78,9) ?        | _Boomerang_ | _Saw_    | Long Beam  | _Chain_ | _T. Star_ | _M_  | _Crusher_ |
| 1-1 (109,5) ?       | Bomb Bag    | Leaf     | _Missiles_ | Dagger  | _T. Star_ | _M_  | _Crusher_ |
| 1-2 (10,9) ?        | _Boomerang_ | _Saw_    | Long Beam  | _Chain_ | _T. Star_ | _M_  | _Crusher_ |
| 1-2 (69,8) brick    | Bomb Bag    | Leaf     | _Missiles_ | Dagger  | Scroll    | _M_  | _Crusher_ |
| 1-2 (150,8) brick   | _Boomerang_ | _Saw_    | Long Beam  | Dagger  | _T. Star_ | _M_  | _Crusher_ |
| 1-3 (59,10) ?       | Bomb Bag    | Leaf     | _Missiles_ | _Chain_ | _T. Star_ | _M_  | _Crusher_ |
| 1-4 (30,6) ? castle | Grow        | Grow     | Grow       | Grow    | Grow      | Grow | _Crusher_ |

**World 2** (Link's)

| Block               | Link         | Mega Man | Samus      | Simon      | Ryu       | Bill | Sophia    |
| ------------------- | ------------ | -------- | ---------- | ---------- | --------- | ---- | --------- |
| 2-1 (16,9) brick    | Grow         | Grow     | Grow       | Grow       | Grow      | Grow | _Crusher_ |
| 2-1 (53,9) ?        | Shield Spell | Rush     | Ice Beam   | Holy Water | Windmill  | _M_  | _Crusher_ |
| 2-1 (125,5) brick   | Jump Spell   | _Saw_    | _Missiles_ | Axe        | _T. Star_ | _M_  | Triple M. |
| 2-1 (172,5) brick   | Shield Spell | Rush     | Ice Beam   | Holy Water | Windmill  | _M_  | _Crusher_ |
| 2-3 (102,5) ?       | Jump Spell   | Leaf     | Long Beam  | Axe        | _T. Star_ | _M_  | Triple M. |
| 2-4 (23,3) ? castle | Grow         | Grow     | Grow       | Grow       | Grow      | Grow | _Crusher_ |

**World 3** (Mega Man's)

| Block                           | Link         | Mega Man | Samus      | Simon        | Ryu       | Bill | Sophia    |
| ------------------------------- | ------------ | -------- | ---------- | ------------ | --------- | ---- | --------- |
| 3-1 (22,8) ?                    | Grow         | Grow     | Grow       | Grow         | Grow      | Grow | _Crusher_ |
| 3-1 (117,5) ?                   | Blue Ring    | Flame    | Ice Beam   | Morning Star | Windmill  | L    | Triple M. |
| 3-1 (156,9) ?                   | Jump Spell   | Rush     | _Missiles_ | Holy Water   | _T. Star_ | _M_  | _Crusher_ |
| 3-1-bonus (5,5) brick, off path | Bomb Bag     | Flame    | _Missiles_ | Axe          | Windmill  | L    | _Crusher_ |
| 3-2 (60,6) ?                    | Blue Ring    | _Saw_    | Long Beam  | Morning Star | _T. Star_ | _M_  | Triple M. |
| 3-3 (49,3) ?                    | Shield Spell | Flame    | Ice Beam   | _Chain_      | Windmill  | L    | _Crusher_ |
| 3-4 (43,9) ? castle             | Grow         | Grow     | Grow       | Grow         | Grow      | Grow | _Crusher_ |

**World 4** (Samus's)

| Block                            | Link         | Mega Man | Samus      | Simon        | Ryu        | Bill | Sophia    |
| -------------------------------- | ------------ | -------- | ---------- | ------------ | ---------- | ---- | --------- |
| 4-1 (25,9) ?                     | Grow         | Grow     | Grow       | Grow         | Grow       | Grow | _Crusher_ |
| 4-1 (148,9) ?                    | Fire Spell   | Knuckle  | Varia Suit | Cross        | Fire Wheel | L    | _Crusher_ |
| 4-1-bonus (13,9) brick, off path | Bomb Bag     | Leaf     | _Missiles_ | Dagger       | Scroll     | _M_  | Triple M. |
| 4-2 (28,9) brick                 | Shield Spell | Knuckle  | Varia Suit | Double Shot  | Fire Wheel | L    | _Crusher_ |
| 4-2 (55,9) ?                     | Fire Spell   | Flame    | _Missiles_ | Cross        | _T. Star_  | _M_  | Triple M. |
| 4-2 (120,5) brick                | Blue Ring    | Rush     | Ice Beam   | Morning Star | Windmill   | _M_  | _Crusher_ |
| 4-2 (161,9) brick                | Jump Spell   | Knuckle  | Varia Suit | Double Shot  | Fire Wheel | L    | _Crusher_ |
| 4-2-cavern (38,8) ?, off path    | Bomb Bag     | _Saw_    | Varia Suit | Axe          | Fire Wheel | _M_  | _Crusher_ |
| 4-2-airship (55,7) ?, off path   | Fire Spell   | Knuckle  | _Missiles_ | Cross        | Fire Wheel | _M_  | _Crusher_ |
| 4-3 (43,2) ?                     | _Boomerang_  | Flame    | Long Beam  | Double Shot  | _T. Star_  | L    | _Crusher_ |

The cavern is Samus's own side area (she is captive there, so it is for the others the first time); the airship
block is kept only if the run aboard is won or YES is taken (a NO restores the pre-boarding snapshot, as today).

**World 5** (Simon's)

| Block               | Link          | Mega Man | Samus      | Simon      | Ryu        | Bill | Sophia    |
| ------------------- | ------------- | -------- | ---------- | ---------- | ---------- | ---- | --------- |
| 5-2 (34,5) brick    | Grow          | Grow     | Grow       | Grow       | Grow       | Grow | _Crusher_ |
| 5-2 (142,11) brick  | Magical Sword | Knuckle  | _Missiles_ | Stopwatch  | Fire Wheel | F    | Homing    |
| 5-2 (168,9) brick   | Fire Spell    | Rush     | Varia Suit | Holy Water | Windmill   | L    | _Crusher_ |
| 5-3 (59,10) ?       | Magical Sword | Leaf     | Ice Beam   | Stopwatch  | _T. Star_  | F    | Homing    |
| 5-4 (23,3) ? castle | Grow          | Grow     | Grow       | Grow       | Grow       | Grow | _Crusher_ |

**World 6** (Ryu's)

| Block                             | Link          | Mega Man | Samus      | Simon       | Ryu            | Bill | Sophia    |
| --------------------------------- | ------------- | -------- | ---------- | ----------- | -------------- | ---- | --------- |
| 6-1 (36,5) brick                  | Grow          | Grow     | Grow       | Grow        | Grow           | Grow | _Crusher_ |
| 6-1 (130,8) ?                     | Magical Sword | Bolt     | Wave Beam  | Triple Shot | Jump and Slash | F    | _Crusher_ |
| 6-2 (52,9) brick                  | Blue Ring     | Flame    | _Missiles_ | Cross       | Scroll         | L    | Homing    |
| 6-2-bonus2 (13,9) brick, off path | Bomb Bag      | Bolt     | Wave Beam  | Double Shot | Jump and Slash | F    | _Crusher_ |
| 6-3 (55,3) ?                      | Shield Spell  | Bolt     | Wave Beam  | Triple Shot | Jump and Slash | _M_  | _Crusher_ |
| 6-4 (30,6) ? castle               | Grow          | Grow     | Grow       | Grow        | Grow           | Grow | _Crusher_ |

**World 7** (Bill's)

| Block             | Link          | Mega Man | Samus      | Simon       | Ryu            | Bill | Sophia    |
| ----------------- | ------------- | -------- | ---------- | ----------- | -------------- | ---- | --------- |
| 7-1 (27,5) brick  | Grow          | Grow     | Grow       | Grow        | Grow           | Grow | _Crusher_ |
| 7-1 (151,2) brick | Magical Sword | Bolt     | Wave Beam  | Triple Shot | Jump and Slash | S    | _Crusher_ |
| 7-3 (102,5) ?     | Fire Spell    | Knuckle  | _Missiles_ | Stopwatch   | Fire Wheel     | S    | Triple M. |

**World 8** (Sophia III's)

| Block             | Link          | Mega Man | Samus      | Simon        | Ryu            | Bill | Sophia    |
| ----------------- | ------------- | -------- | ---------- | ------------ | -------------- | ---- | --------- |
| 8-2 (100,9) brick | Grow          | Grow     | Grow       | Grow         | Grow           | Grow | _Crusher_ |
| 8-3 (66,5) brick  | Magical Sword | Bolt     | Wave Beam  | Morning Star | Jump and Slash | S    | Homing    |
| 8-3 (116,5) brick | Bomb Bag      | Flame    | _Missiles_ | Triple Shot  | Scroll         | F    | Triple M. |

Copies per item (the "at least twice" rule): Link 4-8 each, Mega Man 5-7, Samus 5-6 (Missiles is also her
default), Simon 3-4 (Chain Whip also by default), Ryu: Windmill 7, Fire Wheel 7, Jump and Slash 5, Scroll 4 (three
count, the fourth is a refill), Bill: Laser 9, Flame Gun 5, Spread Gun 3, Sophia: Triple 8, Homing 4.

### 6.4 Not placed in 0.4.34

- **The Lost Levels** (Chapter 2) have no entries: every block gives the default power. A later pass places them.
- **Custom and shared levels** played in the campaign: defaults. In classic play: mushrooms and flowers.
- **1-0** (Mario's tutorial): Mario's own; the mushroom as today.

## 7. Losing powers

Each hero keeps today's rules for a hit (decision 7). For reference, and for what the owner should look at:

| Hero         | A hit takes                                                                                | A death takes (today) |
| ------------ | ------------------------------------------------------------------------------------------ | --------------------- |
| Mario, Luigi | fire → small (assist: → big); big → small; small dies                                      | everything            |
| Sophia III   | Hyper or Crusher → Normal (assist: Crusher → Hyper); missiles kept; Normal dies            | everything            |
| Link         | 1 hit point (half a heart); with the Blue Ring or Shield spell every other hit glances off | everything            |
| Mega Man     | 4 of 28 health                                                                             | everything            |
| Samus        | 8 energy, 4 with the Varia Suit                                                            | everything            |
| Simon        | 2 health                                                                                   | everything            |
| Ryu          | 2 health                                                                                   | everything            |
| Bill         | 1 hit                                                                                      | everything            |

**Flagged for the owner:**

1. **A death wipes the whole kit**, every hero (`LevelScene`'s `died`: `s.kit = {}`; the Hammer Bro battle the
   same). With kits placed across eight worlds, a Mega Man who dies in 6-1 keeps none of his weapons and finds only
   what Worlds 6-8 still place. Crossover never took weapons, sub-weapons or arts away. See Q1.
2. **Switching heroes wipes the kit** (`Game.setHero` gives the new hero `kit = {}`), so going back to a hero
   finds them bare. Per-hero inventories (decision 4) suggest per-hero kits too. See Q3.
3. **Nothing but a death ever takes a hit-point hero's items**, so their "small" (grow first) only matters on a
   fresh start: fine, but worth knowing.
4. **Random unlocks today** that would bypass placement: Bill's `capsule` drop (next gun), Samus's missile packs
   (missiles before the Missiles item). See 5.4 and Q8.
5. **Unobtainable today**: Sophia III's Homing Missile in the campaign.
6. **Mixed bundles today**: Link's heart container brings the white tunic; Mega Man's helmet brings Rush; Sophia's
   first Crusher brings the triple missile. This design splits each.

## 8. Per-hero item inventory

### 8.1 What changes

- **Each hero has their own inventory** of 12 slots (NEW; today one shared list). The panel (map menu Items, the
  ITEMS button) shows **player 1's hero's** inventory, titled with the hero's name, every item in that hero's art
  and words ("ENERGY TANK: +30 ENERGY. GIVEN AT THE NEXT LEVEL."). No sharing, nothing greyed out: everything in a
  hero's inventory works for that hero. In co-op, SELECT on the panel switches to player 2's hero (Q12).
- **Items an inventory holds**: the hero's grow item, their default power, Starman and the 1-up. The prize kinds
  stay SMB3's (`mushroom`, `flower`, `star`, `1up`) and become the hero's own when won: **mushroom → grow item**,
  **flower → default power**. Starman and the 1-up stay as they are for everyone.
- **Using one** works as today (held for the start of the next level, `itemsNext`), but the held item now belongs
  to its hero: it is given only when **that hero** enters a level, and waits (shown as NEXT in their panel) while
  another hero plays. A use that would change nothing goes back, as today (`powerUpChanges`).
- `inventoryUnlocked` (Larry's crystal ball) stays file-wide: it unlocks every hero's inventory.

### 8.2 Prizes go to the hero being played

| Prize source                    | Goes to                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Toad House chest                | player 1's hero (the one walking the room); the chest shows that hero's item |
| N-spade pair (item)             | player 1's hero; 1-ups and coins stay file-wide, as today                    |
| Spade game (slots)              | lives only, file-wide (no items)                                             |
| Hammer Bro chest                | player 1's hero (the hero who fought)                                        |
| Inventory full, or not unlocked | used at once for that hero, as today (held for their next level)             |

The N-spade cards and the slot pictures keep SMB3's mushroom, flower and star (they are SMB3's games); the banner
names the hero's own item ("YOU GOT AN ENERGY TANK! ADDED TO SAMUS'S ITEMS (2)").

### 8.3 Save fields and migration

New optional fields, no format bump (as the bonus fields did):

| Field           | Meaning                                                        | Missing                           |
| --------------- | -------------------------------------------------------------- | --------------------------------- |
| `heroInventory` | hero id → item ids won, in order, at most 12 each              | migrated from `inventory` (below) |
| `heroItemsNext` | hero id → items held for that hero's next level (one per kind) | migrated from `itemsNext`         |

- **Migration**: a file with the old `inventory` / `itemsNext` and no `heroInventory` gives them to the file's
  **main hero**, `SaveFile.character` (player 1's hero, the one on the file card), converting `mushroom` to that
  hero's grow item and `flower` to their default power. A main hero that is not freed (a hand-edited file) falls
  back to Mario. The old fields are dropped on the next write. Q13 offers Mario always instead.
- **Validation**: known hero ids only, each hero's own item ids only, at most 12 each; held items one per kind.
- **Kits** (only if Q1 / Q3 are taken): `heroKits`, hero id → power state, hit points and kit, so each hero's found
  items stay with them. Today's tier keys convert to items in their old order (Mega Man `weapons: 3` → Saw Disc,
  Leaf Guard, Flame Wave; Samus `beam: 2` → Long and Ice; Simon `subs`, `whip`, `multi`; Ryu `arts`, `ninpoMax` →
  scrolls; Bill `guns`; Link's `tunic` → Blue Ring, `beam` → Magical Sword, and the five tools he has today kept).
- **Dev mode**: Give items fills the current hero's dev list; it is still never saved.

## 9. Classic play

Outside the campaign (dev select, `?level=`, custom and shared levels, editor play-tests) every hero gets the SMB
mushroom and fire flower, drawn as today, and each hero's **today's** mapping stays as the classic mapping (today's
`onPowerUp` and `blockPowerUp`, kept as they are), as Crossover's classic mode kept its `classicGet*` lists. The
`[hero-items]` sections are ignored, the starting kits are today's (Link's full belt), and the random drops stay.
The mini games, the arena and the training room keep their own kits.

## 10. Training (a later release)

The 0.4.32 training (`src/game/tutorial/lessons.ts`) already marks a lesson **(PREVIEW)** when the run lacks its
kit and lends the kit in the room. With hero items:

- **Each unlock lesson names its item**: its `unlocked` reads the hero's owned items (`owns(run, 'ice-beam')`)
  instead of tier counts (`k(run, 'beam') >= 2`), so Ice and Long Beam are separate lessons with separate checks.
- **The room gives it for real**: the practice room's `?` block holds the lesson's item. The hero bumps it, the
  item's own sprite rises, its pickup sound plays and its name shows, exactly as in a level; the lesson then
  starts. A preview lends the item this way too, and the room's snapshot gives it back afterwards, as today.
- **The chapter card** shows the items of its lessons in their pickup sprites, found ones in full colour, previews
  marked (PREVIEW) (optionally "FOUND IN WORLD 4", from the placement; Q14).
- **The guide pages** ("How to play") list the hero's grow and power items with their sprites in place of today's
  mushroom and flower rows (campaign; classic keeps today's rows).

## 11. Art and sound budget

All original, in each hero's own game style, NES palettes. **Pickup sprites** are 16 × 16 (one or two frames),
drawn rising from the block, lying in the level, in the inventory panel and on the training cards (the same frame
everywhere). **Sounds** are one short pickup cue per item (about a second, so play is not held up), in the hero's
game's sound; one shared motif per hero with a different ending per item keeps the cost down.

| Hero         | New pickup sprites                                                                                                                                   | New pickup sounds |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Mario, Luigi | none                                                                                                                                                 | none              |
| Link         | `heart-container`, `boomerang`, `bomb-bag`, `blue-ring`, `magical-sword`, `shield-spell`, `jump-spell`, `fire-spell` (spells: a glowing scroll each) | 8                 |
| Mega Man     | `helmet`, `saw-disc`, `leaf-guard`, `rush-coil`, `flame-wave`, `homing-knuckle`, `bolt` (weapons: a capsule in the weapon's colours)                 | 7                 |
| Samus        | `energy-tank`, `missiles`, `long-beam`, `ice-beam`, `varia-suit`, `wave-beam` (item spheres)                                                         | 6                 |
| Simon        | `pot-roast`, `chain-whip`, `morning-star`, `dagger`, `holy-water`, `axe`, `cross`, `double-shot`, `stopwatch`, `triple-shot`                         | 10                |
| Ryu          | `medicine`, `throwing-star`, `ninpo-scroll`, `windmill`, `fire-wheel`, `jump-slash`                                                                  | 6                 |
| Bill         | `medal`, `falcon-m`, `falcon-l`, `falcon-f`, `falcon-s`                                                                                              | 5                 |
| Sophia III   | `power-capsule`, `crusher`, `triple-missile`, `homing-missile`                                                                                       | 4                 |
| **Total**    | **46 sprites**                                                                                                                                       | **46 sounds**     |

Also:

- **HUD icons** (8 × 8, belt): Samus `icon-ice-beam` and `icon-wave-beam` (if Ice and Wave are on the belt, Q7);
  Simon's double / triple badges `icon-double`, `icon-triple` (Castlevania's II / III; optional). Every other belt
  icon exists.
- **Refill sounds**: reuse what each hero has (`boss-fill` for Mega Man, `sophia-pickup`, `pickup`, Mario's
  `powerup`). None new.
- **Hero sprites**: none new (the Blue Ring and Magical Sword use today's `link-white` and `link-red`; Varia, the
  weapon palettes, Simon's whips and Sophia's states all exist).
- **Inventory and bonus games**: no new art (the panel draws the pickup frames; SMB3's cards and reels stay).

## 12. Open questions for the owner

The rest of this file calls them Q1 to Q15. Each recommendation is what the doc assumes until answered.

1. **Death.** Today a death wipes every hero's whole kit. Recommended: a death takes what a hit can take plus a
   grow item that hits can take (Mario, Luigi and Sophia III restart small / Normal, as SMB); every **power item**
   found stays with the hero (Crossover's never-lose), and hit-point heroes keep their grow items too. Or keep
   today's wipe (found items come back from the blocks ahead, or by replaying a level).
2. **Arrival kit.** A hero freed in World N has missed Worlds 1 to N-1. Recommended: they join with the items placed
   for them there (Link: Boomerang, Bomb Bag, two heart containers; Mega Man: Helmet, Saw Disc, Leaf Guard, Rush
   Coil; Samus: two tanks, Long Beam, Missiles, Ice Beam; Simon: Pot Roast, Chain Whip, Dagger, Holy Water, Axe,
   Morning Star, Cross, Double Shot; Ryu: Medicine, Throwing Star, two Ninpo Scrolls, Windmill Star, Fire Wheel;
   Bill: two medals, Machine Gun, Laser, Flame Gun; Sophia III: Triple and Homing Missiles). Or they start bare
   and replay earlier worlds for them.
3. **Per-hero kits.** Today switching heroes wipes the kit. Recommended: each hero's kit is saved with them
   (`heroKits`), so switching back finds them as they were.
4. **Simon and Ryu's grow items.** Neither has a grow item today. Proposed: a 10-point bar while small, the Pot
   Roast / Medicine grows it to today's 16. This makes a fresh Simon or Ryu weaker than today (5 hits, not 8).
   Or keep 16 and make the grow item a full heal only (then they are never small).
5. **Link's starting belt.** Today Link starts with all five tools; under this design he finds them. Keep, or start
   him with the Boomerang?
6. **Samus's tanks.** Two tanks (90 energy) as today, or more (Metroid had six)? More tanks would turn more grow
   blocks from refills into upgrades.
7. **Ice and Wave.** Both kept and switched with WEAPON (proposed), or Metroid's rule (the newer replaces the older)?
8. **Random drops.** Bill's capsule drop becomes a health pickup and Samus's missile packs drop only with Missiles:
   agreed?
9. **Moving items.** Grow and stacking items slide like the mushroom; the rest stay like the flower. Or every hero
   item stays put, so none is lost down a pit?
10. **Sophia III's walls.** Keep the Crusher as one item (cannon and wall and ceiling climbing), or split it into
    Crusher, Wall Climb and Ceiling Climb as Blaster Master did (a hit would still take all three)?
11. **Mario's later powers.** Feather and Tanooki leaf: in which release, and do they take SMB's flower blocks in the
    later worlds, or new blocks?
12. **Co-op inventory.** Player 2's hero's inventory on the same panel (SELECT switches), or not reachable from the
    map in co-op?
13. **Migration.** The shared inventory goes to the file's current hero (proposed), or always to Mario?
14. **Spoilers.** Should the training's preview say where an item is found ("FOUND IN WORLD 4")?
15. **Names.** The item names above (Blue Ring and Magical Sword for today's tunics, Medal, Medicine, Power Capsule)
    are proposals; any to change?
