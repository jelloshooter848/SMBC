# Hero power-ups (0.4.33 design)

Every hero gets their own items from the power blocks: their own grow item in place of the mushroom,
and their own power items (beams, weapons, sub-weapons, spells, guns) in place of the fire flower, each placed by
design, block by block. The owner approved this design on Oct 8 with the decisions in section 12, and 0.4.33
builds it (campaign only).

**How to read this file**

- **Today** means the game before 0.4.33 (`main` at 0.4.32). **NEW** marks what this release adds or changes.
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
| 5. Co-op              | Paused (new two-player files are off). Notes for its return: a block's item belongs to whoever bumped it; a grab by the other player re-rolls it for them.   |
| 6. Classic play       | Outside the campaign everyone keeps the mushroom and the fire flower, as today.                                                                              |
| 7. Losing powers      | A hit takes what it takes today, per hero; a death wipes the played hero's found items (section 7). Each hero's kit is saved on its own.                     |
| 8. Training           | The training rework (0.4.34) shows each unlock with the real item, never where it is found (section 10).                                                     |
| 9. Art and sound      | Every new sprite and sound is original, in each hero's game style (section 11).                                                                              |

## 2. Words used

- **Grow item**: the hero's mushroom. A hero without it is **small** (section 2.1). Some grow items **stack**
  (Link's heart containers, Samus's energy tanks, Bill's medals): each copy adds more, up to a maximum.
- **Power item**: one entry of the hero's power list. A few stack too (Ryu's ninpo scroll).
- **Entry**: what one power block gives one hero, written in the level's `[hero-items]` section (section 3).
- **Default power**: what a power block with **no entry** for that hero gives (Lost Levels blocks in 0.4.33, custom
  and shared levels played in the campaign, any block the plan leaves blank).
- **Owned**: the hero already has the item (a stacking item counts as owned once it is at its maximum).
- **Refill / points**: what an owned item gives instead, defined per hero. Every item taken also scores 1000, as
  today.

### 2.1 Small, per hero

SMB's rule stays for every hero: **a small hero bumping any power block gets their grow item**, whatever the
block's entry. "Small" per hero:

| Hero         | Small means                               |
| ------------ | ----------------------------------------- |
| Mario, Luigi | power state `small`                       |
| Sophia III   | power state `small` (her Normal)          |
| Link         | no heart container (3 hearts)             |
| Mega Man     | no helmet                                 |
| Samus        | no energy tank (30 energy, no reserve)    |
| Simon        | no pot roast (NEW: a 10-point health bar) |
| Ryu          | no medicine (NEW: a 10-point health bar)  |
| Bill         | no medal (3 hits)                         |

Hit-point heroes whose grow item is **capacity** (Link, Samus, Simon, Ryu, Bill) never lose it to a hit (section 7),
so they are small only on a fresh start and after a death (decision 1). Mario, Luigi and Sophia III become small
again with hits, as today, and so does **Mega Man** (0.4.35, owner): his Helmet is a state, his mushroom, and a hit
knocks it off.

## 3. Power blocks and the `[hero-items]` section

### 3.1 Which blocks

A **power block** is any block whose content is `powerup` (`src/game/level/tiles.ts`): the `.map` legend chars
**`M`** (`Q_POWERUP`, a ? block), **`P`** (`BRICK_POWERUP`, a brick) and **`3`** (`HIDDEN_POWERUP`, a hidden block;
no SMB level uses one). Today `World.strikeBlock` spawns `p.def.blockPowerUp(p)` from them, which is each hero's
mushroom-or-flower choice.

The Top Secret Area's fixed blocks (World 2) follow the same idea: **`R`** (`Q_MUSHROOM`) is a grow-slot block (the hero's
grow item, then their next power item once it is owned, as below) and takes no entries; **`W`** (`Q_FLOWER`) gives the hero's entry, or their default
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
   **A grow-slot block** (entry `grow`, or `R`) works as SMB's does for a big Mario (0.4.35, owner: five helmets
   in a row): once the hero owns their grow item (a stacking one, heart containers, energy tanks, medals, at its
   maximum) it gives their **next power item they don't own**, in section 5's order, else their default power
   (its refill). It never gives an owned grow item again.
   It rises out of the block with SMB's `powerup-appear` (the block is SMB's) but in **the item's own sprite**.
3. It stays put on the block like the flower, so none is lost down a pit (decision 9). Only Mario and Luigi's
   Super Mushroom keeps SMB's slide.
4. **Taking it**: the item's own pickup sound, 1000 points, the effect. The first time a hero takes an item they
   do not own, its name shows for two seconds under the HUD and the announcer reads it with its one-line
   description ("Ice Beam: it freezes what it hits."). An owned item gives its refill or points and the hero's
   refill sound.
5. **Co-op** (paused in 0.4.33, new two-player files are off; a note for its return): if the other player touches
   it first, it is worked out again for **their** hero, from the same block's entry (small → their grow item), and
   its sprite changes in their hands. The rising sprite always shows the owner's item. In 0.4.33 an older
   two-player file's item is worked out for whoever takes it, from the same entry.

## 4. Default power and "owned again", all heroes

| Hero         | Grow item       | Default power (no entry) | An owned power item gives                         | An owned grow item gives          |
| ------------ | --------------- | ------------------------ | ------------------------------------------------- | --------------------------------- |
| Mario, Luigi | Super Mushroom  | Fire Flower              | 1000 points (SMB)                                 | 1000 points (SMB)                 |
| Link         | Heart Container | Bomb Bag                 | full hearts and magic, bombs topped up            | full hearts and magic             |
| Mega Man     | Helmet          | Saw Disc                 | full health and all weapon energy                 | full health and all weapon energy |
| Samus        | Energy Tank     | Missiles                 | full energy and 10 missiles                       | full energy (bar and tanks)       |
| Simon        | Pot Roast       | Chain Whip               | 10 hearts (sub-weapon ammo) and full health       | full health                       |
| Ryu          | Medicine        | Throwing Star            | full ninpo and full health                        | full health                       |
| Bill         | Medal           | Machine Gun (M)          | full health (his hits)                            | full health                       |
| Sophia III   | Power Capsule   | Crusher                  | missile ammo (12 triple, 4 homing) and full hover | a full hover bar                  |

Since 0.4.35 a block never gives an owned grow item (3.3: the next power item instead), so its column applies
only where a grow item still comes while owned (a grow item already out of its block when the hero grew).

The default power is each hero's **first** power item, so a blank block is a second chance at the start of the kit
and then a refill. Link starts with his Boomerang (decision 5), so his is the next item, the Bomb Bag. Sophia's is
the Crusher because a hit takes it (as Mario's flower).

## 5. The heroes

### 5.1 Mario and Luigi

- **Grow**: Super Mushroom (`mushroom`). **Power**: Fire Flower (`fire-flower`). **Default**: Fire Flower.
- **Placement**: SMB's exactly. Every SMB power block gives the mushroom when small and the flower when big, so
  their entries are all the default: no `mario=` or `luigi=` lines are needed anywhere.
- **Hit**: fire → small (with the assist "fire reverts to big": fire → big), big → small, small dies. Unchanged.
- **Later**: the feather and the Tanooki leaf (TBD, not in 0.4.33; decision 11). Their blocks will need `mario=` /
  `luigi=` entries; a block without one stays the Fire Flower.
- **Art and sound**: none new (the items sheet's `mushroom` and `flower-0/1`, sfx `powerup`).

### 5.2 Link

His kit is Zelda II's sidescroller (spells, thrusts) with Zelda's dungeon items.

- **Grow**: Heart Container (`heart-container`): one more heart (+2 hit points), full heal. Stacks: 3 hearts → 8
  (five containers, `MAX_HEARTS`). **Today** the mushroom also gives the white tunic; NEW: that is the Blue Ring.
- **Starting kit** (NEW): sword, shield, down-thrust and up-thrust, and the Boomerang on his belt (decision 5).
  **Today** Link starts with all five belt tools (boomerang, bombs and the three spells) and a full magic meter;
  in the campaign he now finds the bombs and spells. The magic meter shows once he has a spell.

| Item          | Id              | What it does (our code)                                                 | Owned again        |
| ------------- | --------------- | ----------------------------------------------------------------------- | ------------------ |
| Bomb Bag      | `bomb-bag`      | Bombs on the belt, with 4 bombs (carries 8; drops refill them)          | bombs to 8, refill |
| Shield Spell  | `shield-spell`  | The belt's Shield spell (8 magic: every other hit glances off for 10 s) | refill             |
| Jump Spell    | `jump-spell`    | The belt's Jump spell (8 magic: higher jumps for 10 s)                  | refill             |
| Blue Ring     | `blue-ring`     | Today's white tunic: every other hit glances off                        | refill             |
| Fire Spell    | `fire-spell`    | The belt's Fire spell (4 magic: the next swing fires a beam)            | refill             |
| Magical Sword | `magical-sword` | Today's red tunic: the sword fires a beam while hearts are full         | refill             |

- **Default**: Bomb Bag (the Boomerang is in his starting kit). **Drops** (bombs, magic jars, half hearts) as
  today, but bombs drop only once he has the Bomb Bag and magic jars only once he has a spell (NEW).
- **Hit**: half a heart (1 hit point); with the Blue Ring or the Shield spell every other hit glances off. Nothing
  is lost. Unchanged.
- **Flags**: the starting belt shrinks to the Boomerang (decision 5); the Blue Ring palette is today's white tunic
  (`link-white`).
- **Crossover** had the Magic Boomerang, Bow, Red Ring, Magical Sword, Bomb Bag and Quiver, never losing the bow,
  bombs and sword.

### 5.3 Mega Man

- **Grow**: Helmet (`helmet`): the charge shot and brick breaking, full health. Single. **Today** the helmet also
  gives the Rush Coil; NEW: Rush is its own item.
- **Starting kit**: the buster, the slide. E-tanks stay drops.
- **The buster** (0.4.35): SHOOT is always the buster, and charges with the helmet whatever weapon is in hand; it
  is no belt entry. The belt (WEAPON / USE WEAPON) lists only the weapons he has and Rush. The full charge shot is
  a big blast like the original Crossover's (its own 24x16 art, three times the buster's damage, on through what
  it defeats).

| Item           | Id               | What it does (our code)                                     | Owned again |
| -------------- | ---------------- | ----------------------------------------------------------- | ----------- |
| Saw Disc       | `saw-disc`       | 8-way blade that cuts bricks (2 energy)                     | refill      |
| Leaf Guard     | `leaf-guard`     | Circles him, swats shots, thrown on a second press (4)      | refill      |
| Rush Coil      | `rush-coil`      | The spring on the belt (3); NEW: no longer needs the helmet | refill      |
| Flame Wave     | `flame-wave`     | Runs along the floor, burns shells (3)                      | refill      |
| Homing Knuckle | `homing-knuckle` | Slow fist that seeks, three damage (4)                      | refill      |
| Bolt           | `bolt`           | A beam across the screen (5)                                | refill      |

- **Default**: Saw Disc. The belt order stays the code's (`WEAPONS`), with only the weapons he owns.
- **Hit** (0.4.35, owner: the helmet is his mushroom): with the Helmet, a hit knocks it off (and with it the charge
  shot and brick breaking) **and** costs its 4 of 28 health; without it, 4 of 28 health. His weapons and Rush stay.
  The cleanest of the choices: SMB's big → small, while his health bar still counts every hit (a helmet-only hit
  costing no health would make the helmet an extra life bar). Classic play keeps the original's (health only).
- **Drops** (0.4.35): weapon energy fills the weapon in hand, else the emptiest one he has; a weapon he hasn't found
  keeps a full tank for when he does; nothing to fill gives points (section 7's "drops").
- **Flags**: today weapons unlock in a fixed order (`scratch.weapons` is a count); NEW: each is its own flag.
- **Crossover** never lost any weapon (`NEVER_LOSE_UPGRADES` held all nine and Rush).

### 5.4 Samus

- **Grow**: Energy Tank (`energy-tank`): one more reserve tank, full energy. Stacks: up to **six tanks** (NES
  Metroid style, decision 6), shown as small boxes above her EN number. Her EN bar holds 30; each tank is a
  **10-energy reserve** that refills the bar when it runs out, so six tanks give 90 in all, today's maximum (two
  30-energy tanks): she stays as tough as today against SMB enemies (11 plain hits at most, 22 with the Varia Suit)
  and each grow block is still an upgrade until the sixth. **Today** the first mushroom gives the Varia Suit; NEW:
  Varia is a power item.
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
  Wave are both kept and WEAPON cycles beam, Ice, Wave and missiles (decision 7).
- **Drops**: missile packs drop only once she owns Missiles (decision 8; **today** they drop from the start, so
  missiles come at random).
- **Hit**: 8 energy (4 with the Varia Suit). Nothing is lost. Unchanged.
- **Later**: Screw Attack, High Jump Boots, Missile Tanks (not in our code; Crossover had them).
- **Crossover** never lost the missiles and morph ball; the Long Beam was its mushroom.

### 5.5 Simon

- **Grow**: Pot Roast (`pot-roast`): the health bar grows from 10 to 16 and fills. Single; owned again it fills
  the bar (the wall meat's own job). **NEW** (decision 4): small Simon has a 10-point bar (five hits); **today** he
  always has 16 and no grow item.
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
  fills. Single; owned again it fills the bar. **NEW** as for Simon (decision 4).
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
- **Drops**: **today** the rare `capsule` drop unlocks the next gun at random; NEW: it is a health pickup
  (decision 8).
- **Hit**: 1 hit. Nothing is lost. Unchanged (a death wipes his guns, as today; in Contra a death takes the gun).
- **Later**: Rapid Bullets (R) and Barrier (B) (not in our code).
- **Crossover** kept only the rapid-fire upgrades on death.

### 5.8 Sophia III

- **Grow**: Power Capsule (`power-capsule`, Blaster Master's P capsule): Normal → Hyper, the Hyper cannon and the
  hover. Owned again: a full hover bar (as today's mushroom).
- **Starting kit**: Normal cannon, driving, the nose-first drop, Jason on foot.

| Item           | Id               | What it does (our code)                                                           | Owned again  |
| -------------- | ---------------- | --------------------------------------------------------------------------------- | ------------ |
| Crusher        | `crusher`        | Hyper → Crusher: the Crusher cannon                                               | missile ammo |
| Wall Climb     | `wall-climb`     | Drives up walls (NEW: split from the Crusher, decision 10)                        | missile ammo |
| Ceiling Climb  | `ceiling-climb`  | Drives along ceilings (NEW: split from the Crusher)                               | missile ammo |
| Triple Missile | `triple-missile` | Three missiles through walls (9 to start, holds 60); **today** comes with Crusher | missile ammo |
| Homing Missile | `homing-missile` | Seeks enemies (3 to start, holds 20); **today** never given in the campaign       | missile ammo |

- **Default**: Crusher. Like Mario's flower, a small (Normal) Sophia gets the capsule first, then the Crusher.
- **Climbing** needs the Hyper hull or better plus the climb item. A Hyper Sophia bumping a Wall or Ceiling Climb
  block takes it and stays Hyper.
- **Hit**: Hyper or Crusher → Normal ("Lose Everything", SO-23; with the assist "fire reverts to big", Crusher →
  Hyper); a hit to Normal also takes both climbs; missiles and their ammo are kept; Normal dies.
- **Flags**: the Homing Missile is unobtainable in the campaign today (only her mini game's `TANK_KIT` has it).
  Blaster Master's Wall 1 / Wall 2 are split from the Crusher as Wall Climb and Ceiling Climb (decision 10). In
  classic play the flower still gives all three at once, as today.
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
  ones. There is no arrival kit (decision 2): a hero always starts with their basic kit the first time they are
  played, and every world's blocks hold their items, the earlier worlds included, so replaying those levels with
  them collects them.

### 6.2 New items per world

The grow item also comes at every world's first block and every castle.

| World | Link                     | Mega Man             | Samus               | Simon              | Ryu                          | Bill        | Sophia III                 |
| ----- | ------------------------ | -------------------- | ------------------- | ------------------ | ---------------------------- | ----------- | -------------------------- |
| 1     | Bomb Bag                 | Saw Disc, Leaf Guard | Long Beam, Missiles | Chain Whip, Dagger | Throwing Star, Ninpo Scroll  | Machine Gun | Crusher                    |
| 2     | Shield Spell, Jump Spell | Rush Coil            | Ice Beam            | Holy Water, Axe    | Windmill Star                | -           | Triple Missile, Wall Climb |
| 3     | Blue Ring                | Flame Wave           | -                   | Morning Star       | -                            | Laser       | -                          |
| 4     | Fire Spell               | Homing Knuckle       | Varia Suit          | Cross, Double Shot | Fire Wheel, Ninpo Scroll     | -           | Ceiling Climb              |
| 5     | Magical Sword            | -                    | -                   | Stopwatch          | -                            | Flame Gun   | Homing Missile             |
| 6     | -                        | Bolt                 | Wave Beam           | Triple Shot        | Jump and Slash, Ninpo Scroll | -           | -                          |
| 7     | -                        | -                    | -                   | -                  | -                            | Spread Gun  | -                          |
| 8     | -                        | -                    | -                   | -                  | -                            | -           | -                          |

### 6.3 Block by block

Mario and Luigi are left out: every block is their default (the Fire Flower). **Grow** is the hero's grow item.
_Italics_ are the hero's default power: no entry is written for it. Blocks are `level (x,y)`, `?` a ? block and
`brick` a power brick; "off path" blocks are in a bonus room or campaign side area.

**World 1**

| Block               | Link       | Mega Man | Samus      | Simon   | Ryu       | Bill | Sophia    |
| ------------------- | ---------- | -------- | ---------- | ------- | --------- | ---- | --------- |
| 1-1 (21,9) ?        | Grow       | Grow     | Grow       | Grow    | Grow      | Grow | _Crusher_ |
| 1-1 (78,9) ?        | _Bomb Bag_ | _Saw_    | Long Beam  | _Chain_ | _T. Star_ | _M_  | _Crusher_ |
| 1-1 (109,5) ?       | _Bomb Bag_ | Leaf     | _Missiles_ | Dagger  | _T. Star_ | _M_  | _Crusher_ |
| 1-2 (10,9) ?        | _Bomb Bag_ | _Saw_    | Long Beam  | _Chain_ | _T. Star_ | _M_  | _Crusher_ |
| 1-2 (69,8) brick    | _Bomb Bag_ | Leaf     | _Missiles_ | Dagger  | Scroll    | _M_  | _Crusher_ |
| 1-2 (150,8) brick   | _Bomb Bag_ | _Saw_    | Long Beam  | Dagger  | _T. Star_ | _M_  | _Crusher_ |
| 1-3 (59,10) ?       | _Bomb Bag_ | Leaf     | _Missiles_ | _Chain_ | _T. Star_ | _M_  | _Crusher_ |
| 1-4 (30,6) ? castle | Grow       | Grow     | Grow       | Grow    | Grow      | Grow | _Crusher_ |

**World 2** (Link's)

| Block               | Link         | Mega Man | Samus      | Simon      | Ryu       | Bill | Sophia     |
| ------------------- | ------------ | -------- | ---------- | ---------- | --------- | ---- | ---------- |
| 2-1 (16,9) brick    | Grow         | Grow     | Grow       | Grow       | Grow      | Grow | _Crusher_  |
| 2-1 (53,9) ?        | Shield Spell | Rush     | Ice Beam   | Holy Water | Windmill  | _M_  | _Crusher_  |
| 2-1 (125,5) brick   | Jump Spell   | _Saw_    | _Missiles_ | Axe        | _T. Star_ | _M_  | Triple M.  |
| 2-1 (172,5) brick   | Shield Spell | Rush     | Ice Beam   | Holy Water | Windmill  | _M_  | Wall Climb |
| 2-3 (102,5) ?       | Jump Spell   | Leaf     | Long Beam  | Axe        | _T. Star_ | _M_  | Triple M.  |
| 2-4 (23,3) ? castle | Grow         | Grow     | Grow       | Grow       | Grow      | Grow | _Crusher_  |

**World 3** (Mega Man's)

| Block                           | Link         | Mega Man | Samus      | Simon        | Ryu       | Bill | Sophia     |
| ------------------------------- | ------------ | -------- | ---------- | ------------ | --------- | ---- | ---------- |
| 3-1 (22,8) ?                    | Grow         | Grow     | Grow       | Grow         | Grow      | Grow | _Crusher_  |
| 3-1 (117,5) ?                   | Blue Ring    | Flame    | Ice Beam   | Morning Star | Windmill  | L    | Triple M.  |
| 3-1 (156,9) ?                   | Jump Spell   | Rush     | _Missiles_ | Holy Water   | _T. Star_ | _M_  | Wall Climb |
| 3-1-bonus (5,5) brick, off path | _Bomb Bag_   | Flame    | _Missiles_ | Axe          | Windmill  | L    | _Crusher_  |
| 3-2 (60,6) ?                    | Blue Ring    | _Saw_    | Long Beam  | Morning Star | _T. Star_ | _M_  | Triple M.  |
| 3-3 (49,3) ?                    | Shield Spell | Flame    | Ice Beam   | _Chain_      | Windmill  | L    | Wall Climb |
| 3-4 (43,9) ? castle             | Grow         | Grow     | Grow       | Grow         | Grow      | Grow | _Crusher_  |

**World 4** (Samus's)

| Block                            | Link         | Mega Man | Samus      | Simon        | Ryu        | Bill | Sophia        |
| -------------------------------- | ------------ | -------- | ---------- | ------------ | ---------- | ---- | ------------- |
| 4-1 (25,9) ?                     | Grow         | Grow     | Grow       | Grow         | Grow       | Grow | _Crusher_     |
| 4-1 (148,9) ?                    | Fire Spell   | Knuckle  | Varia Suit | Cross        | Fire Wheel | L    | Ceiling Climb |
| 4-1-bonus (13,9) brick, off path | _Bomb Bag_   | Leaf     | _Missiles_ | Dagger       | Scroll     | _M_  | Triple M.     |
| 4-2 (28,9) brick                 | Shield Spell | Knuckle  | Varia Suit | Double Shot  | Fire Wheel | L    | _Crusher_     |
| 4-2 (55,9) ?                     | Fire Spell   | Flame    | _Missiles_ | Cross        | _T. Star_  | _M_  | Triple M.     |
| 4-2 (120,5) brick                | Blue Ring    | Rush     | Ice Beam   | Morning Star | Windmill   | _M_  | Wall Climb    |
| 4-2 (161,9) brick                | Jump Spell   | Knuckle  | Varia Suit | Double Shot  | Fire Wheel | L    | Ceiling Climb |
| 4-2-cavern (38,8) ?, off path    | _Bomb Bag_   | _Saw_    | Varia Suit | Axe          | Fire Wheel | _M_  | _Crusher_     |
| 4-2-airship (55,7) ?, off path   | Fire Spell   | Knuckle  | _Missiles_ | Cross        | Fire Wheel | _M_  | _Crusher_     |
| 4-3 (43,2) ?                     | _Bomb Bag_   | Flame    | Long Beam  | Double Shot  | _T. Star_  | L    | Ceiling Climb |

The cavern is Samus's own side area (she is captive there, so it is for the others the first time); the airship
block is kept only if the run aboard is won or YES is taken (a NO restores the pre-boarding snapshot, as today).

**World 5** (Simon's)

| Block               | Link          | Mega Man | Samus      | Simon      | Ryu        | Bill | Sophia        |
| ------------------- | ------------- | -------- | ---------- | ---------- | ---------- | ---- | ------------- |
| 5-2 (34,5) brick    | Grow          | Grow     | Grow       | Grow       | Grow       | Grow | _Crusher_     |
| 5-2 (142,11) brick  | Magical Sword | Knuckle  | _Missiles_ | Stopwatch  | Fire Wheel | F    | Homing        |
| 5-2 (168,9) brick   | Fire Spell    | Rush     | Varia Suit | Holy Water | Windmill   | L    | Ceiling Climb |
| 5-3 (59,10) ?       | Magical Sword | Leaf     | Ice Beam   | Stopwatch  | _T. Star_  | F    | Homing        |
| 5-4 (23,3) ? castle | Grow          | Grow     | Grow       | Grow       | Grow       | Grow | _Crusher_     |

**World 6** (Ryu's)

| Block                             | Link          | Mega Man | Samus      | Simon       | Ryu            | Bill | Sophia        |
| --------------------------------- | ------------- | -------- | ---------- | ----------- | -------------- | ---- | ------------- |
| 6-1 (36,5) brick                  | Grow          | Grow     | Grow       | Grow        | Grow           | Grow | _Crusher_     |
| 6-1 (130,8) ?                     | Magical Sword | Bolt     | Wave Beam  | Triple Shot | Jump and Slash | F    | Wall Climb    |
| 6-2 (52,9) brick                  | Blue Ring     | Flame    | _Missiles_ | Cross       | Scroll         | L    | Homing        |
| 6-2-bonus2 (13,9) brick, off path | _Bomb Bag_    | Bolt     | Wave Beam  | Double Shot | Jump and Slash | F    | _Crusher_     |
| 6-3 (55,3) ?                      | Shield Spell  | Bolt     | Wave Beam  | Triple Shot | Jump and Slash | _M_  | Ceiling Climb |
| 6-4 (30,6) ? castle               | Grow          | Grow     | Grow       | Grow        | Grow           | Grow | _Crusher_     |

**World 7** (Bill's)

| Block             | Link          | Mega Man | Samus      | Simon       | Ryu            | Bill | Sophia     |
| ----------------- | ------------- | -------- | ---------- | ----------- | -------------- | ---- | ---------- |
| 7-1 (27,5) brick  | Grow          | Grow     | Grow       | Grow        | Grow           | Grow | _Crusher_  |
| 7-1 (151,2) brick | Magical Sword | Bolt     | Wave Beam  | Triple Shot | Jump and Slash | S    | Wall Climb |
| 7-3 (102,5) ?     | Fire Spell    | Knuckle  | _Missiles_ | Stopwatch   | Fire Wheel     | S    | Triple M.  |

**World 8** (Sophia III's)

| Block             | Link          | Mega Man | Samus      | Simon        | Ryu            | Bill | Sophia    |
| ----------------- | ------------- | -------- | ---------- | ------------ | -------------- | ---- | --------- |
| 8-2 (100,9) brick | Grow          | Grow     | Grow       | Grow         | Grow           | Grow | _Crusher_ |
| 8-3 (66,5) brick  | Magical Sword | Bolt     | Wave Beam  | Morning Star | Jump and Slash | S    | Homing    |
| 8-3 (116,5) brick | _Bomb Bag_    | Flame    | _Missiles_ | Triple Shot  | Scroll         | F    | Triple M. |

Copies per item (the "at least twice" rule): the counts are kept by a test (`src/game/items/placement.test.ts`)
and listed in the 0.4.33 notes. The Bomb Bag (Link's default) and Missiles (Samus's) come from every block without
an entry for them; Scrolls past the third are refills.

### 6.4 Not placed in 0.4.33

- **The Lost Levels** (Chapter 2) have no entries: every block gives the default power. A later pass places them.
- **Custom and shared levels** played in the campaign: defaults. In classic play: mushrooms and flowers.
- **1-0** (Mario's tutorial): Mario's own; the mushroom as today.

## 7. Losing powers

Each hero keeps today's rules for a hit (decision 7) and for a death (decision 1): a death wipes the played hero's
found items, back to their basic kit.

| Hero         | A hit takes                                                                                 | A death takes |
| ------------ | ------------------------------------------------------------------------------------------- | ------------- |
| Mario, Luigi | fire → small (assist: → big); big → small; small dies                                       | everything    |
| Sophia III   | Hyper or Crusher → Normal (assist: Crusher → Hyper); climbs too; missiles kept; Normal dies | everything    |
| Link         | 1 hit point (half a heart); with the Blue Ring or Shield spell every other hit glances off  | everything    |
| Mega Man     | the Helmet (charge shot, brick breaking) and 4 of 28 health; without it, 4 of 28 (0.4.35)   | everything    |
| Samus        | 8 energy, 4 with the Varia Suit                                                             | everything    |
| Simon        | 2 health                                                                                    | everything    |
| Ryu          | 2 health                                                                                    | everything    |
| Bill         | 1 hit                                                                                       | everything    |

**Notes:**

1. **A death wipes the played hero's kit** (`LevelScene`'s `died`: `s.kit = {}`; the Hammer Bro battle the
   same), as today (decision 1). Every world places every hero's items, so a replay finds them again (decision 2).
   Only the hero who died loses anything: the other heroes' saved kits stay.
2. **Each hero's kit is saved on its own** (decision 3, `heroKits`): switching heroes keeps the old hero's power,
   hit points and kit for their return, and the new hero comes back as they were left (their basic kit the first
   time).
3. **Nothing but a death ever takes a hit-point hero's items** (but Mega Man's Helmet, 0.4.35), so their "small" (grow first) only matters on a
   fresh start: fine, but worth knowing.
4. **Random unlocks today** that would bypass placement: Bill's `capsule` drop (next gun), Samus's missile packs
   (missiles before the Missiles item). Both fixed in the campaign (decision 8, sections 5.4 and 5.7).
5. **Unobtainable today**: Sophia III's Homing Missile in the campaign.
6. **Mixed bundles today**: Link's heart container brings the white tunic; Mega Man's helmet brings Rush; Sophia's
   first Crusher brings the triple missile and both climbs. This design splits each.

**Drops are always collectible** (owner decision, 0.4.35; `World.collectPickup`): every hero picks up every enemy
drop, even one they cannot use yet. Ammo or energy for a power not owned yet goes into a hidden reserve that is there
when they get it (Sophia III's missile ammo; Link's bombs; Ryu's ninpo; Mega Man's unfound weapons keep a full
tank); with nothing to fill (full, or no use to this hero) a drop gives 200 points. The 0.4.33 rules stand: Bill's
falcon capsule heals; Samus's missile packs only drop once she owns Missiles, but one that appears is collectible.

## 8. Per-hero item inventory

### 8.1 What changes

- **Each hero has their own inventory** of 12 slots (NEW; today one shared list). The panel (map menu Items, the
  ITEMS button) shows **player 1's hero's** inventory, titled with the hero's name, every item in that hero's art
  and words ("ENERGY TANK: ONE MORE RESERVE TANK. GIVEN AT THE NEXT LEVEL."). No sharing, nothing greyed out:
  everything in a hero's inventory works for that hero. Co-op is paused, so there is no player-2 inventory in
  0.4.33 (decision 12; a note for its return: SELECT on the panel would switch to player 2's hero).
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

| Field           | Meaning                                                                          | Missing                           |
| --------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| `heroInventory` | hero id → prize kinds won (`mushroom`, `flower`, `star`, `1up`), at most 12 each | migrated from `inventory` (below) |
| `heroItemsNext` | hero id → prizes held for that hero's next level (one per kind)                  | migrated from `itemsNext`         |
| `heroKits`      | hero id → power state, hit points and kit of a hero not being played             | `{}` (each hero fresh)            |

- **Prize kinds**: an inventory keeps SMB3's kinds and shows and gives them as the hero's own (`mushroom` → grow
  item, `flower` → default power), so nothing converts when a prize changes hands.
- **Migration** (decision 13): a file with the old `inventory` / `itemsNext` and no `heroInventory` gives them to
  **Mario**, whoever the file's hero is. The old fields are dropped on the next write.
- **Validation**: known hero ids only, prize kinds only, at most 12 each; held items one per kind.
- **Kits** (decisions 1 and 3): `heroKits` keeps each hero's power state, hit points and kit while another hero
  plays; the played hero's own stay in `powerState`, `hp` and `kit` as today. Today's tier keys convert to items in
  their old order when a file is read (Mega Man `weapons: 3` → Saw Disc, Leaf Guard, Flame Wave, and the helmet's
  Rush; Samus `beam: 2` → Long and Ice, `tanks` → reserve tanks; Simon `subs`, `whip`, `multi`; Ryu `arts`,
  `ninpoMax` → scrolls; Bill `guns`; Link's `tunic` → Blue Ring, `beam` → Magical Sword, and the five tools he
  has today kept; Sophia's Crusher keeps both climbs).
- **Dev mode**: Give items fills the current hero's dev list; it is still never saved.

## 9. Classic play

Outside the campaign (dev select, `?level=`, custom and shared levels, editor play-tests) every hero gets the SMB
mushroom and fire flower, drawn as today, and each hero's **today's** mapping stays as the classic mapping (today's
`onPowerUp` and `blockPowerUp`, kept as they are), as Crossover's classic mode kept its `classicGet*` lists. The
`[hero-items]` sections are ignored, the starting kits are today's (Link's full belt), and the random drops stay.
The mini games, the arena and the training room keep their own kits.

## 10. Training (the 0.4.34 rework)

The training work in progress (`src/game/tutorial/lessons.ts` on `claude/wip-0.4.32-training`) already marks a
lesson **(PREVIEW)** when the run lacks its kit and lends the kit in the room. The 0.4.34 rework, after this
release, adds hero items:

- **Each unlock lesson names its item**: its `unlocked` reads the hero's owned items (`owns(run, 'ice-beam')`)
  instead of tier counts (`k(run, 'beam') >= 2`), so Ice and Long Beam are separate lessons with separate checks.
- **The room gives it for real**: the practice room's `?` block holds the lesson's item. The hero bumps it, the
  item's own sprite rises, its pickup sound plays and its name shows, exactly as in a level; the lesson then
  starts. A preview lends the item this way too, and the room's snapshot gives it back afterwards, as today.
- **The chapter card** shows the items of its lessons in their pickup sprites, found ones in full colour, previews
  marked (PREVIEW). Previews never say where an item is found (decision 14).
- **The guide pages** ("How to play") list the hero's grow and power items with their sprites in place of today's
  mushroom and flower rows (campaign; classic keeps today's rows).

## 11. Art and sound budget

All original, in each hero's own game style, NES palettes. **Pickup sprites** are 16 × 16 (one or two frames),
drawn rising from the block, lying in the level, in the inventory panel and on the training cards (the same frame
everywhere). **Sounds** are one short pickup cue per item (about a second, so play is not held up), in the hero's
game's sound; one shared motif per hero with a different ending per item keeps the cost down.

| Hero         | New pickup sprites                                                                                                                      | New pickup sounds |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Mario, Luigi | none                                                                                                                                    | none              |
| Link         | `heart-container`, `bomb-bag`, `blue-ring`, `magical-sword`, `shield-spell`, `jump-spell`, `fire-spell` (spells: a glowing scroll each) | 7                 |
| Mega Man     | `helmet`, `saw-disc`, `leaf-guard`, `rush-coil`, `flame-wave`, `homing-knuckle`, `bolt` (weapons: a capsule in the weapon's colours)    | 7                 |
| Samus        | `energy-tank`, `missiles`, `long-beam`, `ice-beam`, `varia-suit`, `wave-beam` (item spheres)                                            | 6                 |
| Simon        | `pot-roast`, `chain-whip`, `morning-star`, `dagger`, `holy-water`, `axe`, `cross`, `double-shot`, `stopwatch`, `triple-shot`            | 10                |
| Ryu          | `medicine`, `throwing-star`, `ninpo-scroll`, `windmill`, `fire-wheel`, `jump-slash`                                                     | 6                 |
| Bill         | `medal`, `falcon-m`, `falcon-l`, `falcon-f`, `falcon-s`                                                                                 | 5                 |
| Sophia III   | `power-capsule`, `crusher`, `wall-climb`, `ceiling-climb`, `triple-missile`, `homing-missile`                                           | 6                 |
| **Total**    | **47 sprites**                                                                                                                          | **47 sounds**     |

Also:

- **HUD**: Samus's reserve tanks as small boxes above her EN number (decision 6).
- **HUD icons** (8 × 8, belt): Samus `icon-ice-beam` and `icon-wave-beam` (Ice and Wave are both on the belt);
  Simon's double / triple badges `icon-double`, `icon-triple` (Castlevania's II / III; optional). Every other belt
  icon exists.
- **Refill sounds**: reuse what each hero has (`boss-fill` for Mega Man, `sophia-pickup`, `pickup`, Mario's
  `powerup`). None new.
- **Hero sprites**: none new (the Blue Ring and Magical Sword use today's `link-white` and `link-red`; Varia, the
  weapon palettes, Simon's whips and Sophia's states all exist).
- **Inventory and bonus games**: no new art (the panel draws the pickup frames; SMB3's cards and reels stay).

## 12. Decisions (owner, Oct 8)

The owner's answers to the draft's fifteen open questions. The sections above already follow them.

1. **Death:** today's rule stays. A death wipes the hero's found power items; hits take what they take today.
2. **First play:** a hero always starts with their basic kit the first time they are played, even if they are
   freed in a late world. Their items are placed in every world's blocks, the earlier worlds included, so replaying
   those levels with them collects them. No arrival kit.
3. **Per-hero kits:** each hero's kit is saved separately (`heroKits`), so switching heroes no longer wipes it.
   With decision 1, a death still wipes that hero's found items.
4. **Simon and Ryu:** they start with a 10-point health bar, and their grow item (Pot Roast, Medicine) takes it
   to 16.
5. **Link:** he always starts with the Boomerang, as now, and finds his other items. His default power is
   therefore the next item, the Bomb Bag.
6. **Samus:** more Energy Tanks, NES Metroid style: up to six tanks, shown as small boxes above her EN number, each
   a reserve that refills the bar when it runs out. Chosen per-tank energy: **10** (the bar holds 30), so six tanks
   reach today's maximum of 90 and she stays as tough as today against SMB enemies.
7. **Samus's beams:** Ice and Wave are both kept and switched with WEAPON, not replaced.
8. **Random drops:** Bill's random falcon-capsule drop becomes a health pickup; Samus's missile-pack drops appear
   only once she owns Missiles.
9. **Pickups don't move:** every hero item stays put like the flower; none slides like the mushroom. The grow
   items count as items too; only Mario and Luigi's Super Mushroom keeps SMB's slide.
10. **Sophia's Crusher** is split into Crusher, Wall Climb and Ceiling Climb, as in Blaster Master. Both climbs are
    in her item list (5.8) and the placement plan (6).
11. **Feather and Tanooki leaf:** TBD; not in 0.4.33.
12. **Co-op:** new two-player files are paused (`file-select.ts`). The co-op rules above stay as notes for when
    co-op returns; there is no player-2 inventory in 0.4.33.
13. **Old saves:** the shared inventory moves to Mario.
14. **Training:** previews don't say where an item is found.
15. **Item names:** approved.
