# Classic SMBC: add Yoshi in two forms, a playable Classic-only hero (flutter jump, tongue, eggs aimed and thrown, ground pound) and an optional mount any Classic hero can ride (tongue, swallow and spit, lost when hit)

- **Severity:** feature request (new character and new optional rule, Classic mode only)
- **Build:** V0.4.56 (3955a1c8)
- **Where:** Classic mode (title → CLASSIC) and dev Classic starts; every level
- **How to get there:** `?dev=1&mode=classic&rules=classic&level=1-1&char=yoshi` for the hero (once built; today `char=yoshi` falls back to Mario). For the mount: Classic options → **Yoshi mount: On**, or the dev URL `&yoshi=1` (YM-1), with any hero
- **Character and power:** Yoshi (all power states); every Classic hero that may ride (YM-11)
- **Input:** keyboard and touch
- **Browser and device:** any

## Steps

1. Open Classic mode and look at the select screen's second row: there is no Yoshi.
2. Once built, pick **Yoshi** there. Hold Jump while falling: his legs kick and the fall stops (flutter). Press Down in the air: he curls, hangs, then drops straight down (ground pound). Press Attack: his tongue shoots out and catches a Goomba; press Down to swallow it and lay an egg. Hold Special: a cursor sweeps up and down; let go to throw the egg along it.
3. Separately, set **Yoshi mount: On** in Classic options and start 1-1 with Link. Bump the first power-up `?` block: an egg rises, wobbles and hatches Yoshi, who sits and waits. Jump onto his back. Attack now uses his tongue; Special still throws the boomerang. Touch a Goomba from the side: Link is thrown off, keeps his power, and Yoshi runs away.
4. Set **Yoshi mount: Off** (the default) and replay 1-1: the block gives its Mushroom and nothing differs from today.

## Expected

The spec below. Yoshi never appeared in SMBC 3.1.21, so there is no original source to match: every number is **invented from the source games' feel** (Super Mario World for the mount, Yoshi's Island for the hero), translated to SMB's scale and the Classic rules, and is marked **(tuning)** where it is a pure feel value. The two forms share one sprite set and one tongue.

Both forms live under the Classic rules model (`bug-reports/2026-10-07-dev-classic-smbc-rules-toggle.md`, TG-17 to TG-45 as adapted by the Classic mode): power states (`2026-10-07-classic-power-states.md`, PS-C), enemy HP and armour (`2026-10-07-classic-enemy-hp-and-armour.md`, HP-C), bricks and shots (`2026-10-07-classic-bricks-and-shots.md`, BR-C) and swimming (`2026-10-07-classic-swimming.md`, SW-C). **Neither form ever reaches the campaign**: a campaign file always plays `'current'`, and the Top Secret Area's egg keeps hatching its 1-up (`entities/objects/yoshi-egg.ts`, YM-D9).

**Part A (YO-1 to YO-30)** is the playable hero. **Part B (YM-1 to YM-30)** is the mount, the riskier design: section B1 lays out the options for how he appears, and the recommendation. Owner decisions are collected at the end (YO-D, YM-D).

### Part A: Yoshi, the playable hero (Yoshi's Island)

### A1. Character definition

**YO-1. Definition.** A new `CharacterDef` (`src/game/characters/character.ts`), `src/game/characters/yoshi/classic.ts` exporting `YOSHI_CLASSIC`:

| Field | Value |
|---|---|
| `id` / `name` / `hudName` | `yoshi` / `Yoshi` / `YOSHI` |
| `rules` | `'classic'` (a Classic-only extra, TG-41) |
| `damage` | `{ kind: 'powerup', states: CLASSIC_POWER_STATES }` |
| `stomps` | `true` (YO-17) |
| `crouches` | `true` (Down on the ground, YO-6) |
| `canBreakBricks` | `() => false`: his head bumps, never breaks (BR-C3) |
| `hitbox` | 12 × 24; crouched 12 × 16; ground pound 12 × 20 (YO-3) |
| `blockPowerUp` | `classicBlockPowerUp` (PS-C2) |
| `powerIcon` | `true` (PS-C26) |
| `hudAmmo` | eggs, always shown: `icon-egg ×NN` (YO-25) |
| `drop`, `blockDrop` | none (YO-14) |
| `portrait` | `{ sheet: 'yoshi', palette: 'yoshi', frame: 'stand' }` |
| `jumpSfx` | `yoshi-jump` (YO-29) |
| `guide`, `touchLabels` | YO-26, YO-27 |
| `drawLook`, `starMusicLeft`, `deathHop` | the Classic shared ones (`classicLook`, `CLASSIC_STAR_MUSIC_LEFT`; shared death, PS-C23) |

**YO-2. Roster.** Append `YOSHI_CLASSIC` to `CLASSIC_EXTRAS` (`characters/registry.ts`) after the built extras, so he shows on the select screen's second row in Classic mode and dev Classic starts only (TG-41 to TG-43). Never in `CHARACTERS`, `heroesToFind`, captives, the map or the training rooms.

**YO-3. Size.** No size change in any power state (as every non-plumber, PS-C1). Sprite cell 24 × 32, feet on the bottom row; the hitbox is 12 × 24 under the body, so the nose overhangs it by about 8 px in front (drawn, not solid). He fits every passage big Mario fits. Crouched 12 × 16 (fits 1-tile gaps, like a crouching big Mario).

### A2. Controls

**YO-4.**

| Input | Yoshi |
|---|---|
| Left / Right | Walk (inertia, YO-5). No run button. |
| Jump | Jump (YO-7). **Held while falling: flutter** (YO-8). |
| Down, on the ground | Crouch. **With an enemy in his mouth: swallow and lay an egg** (YO-19). |
| Down, in the air | **Ground pound** (YO-9). |
| Attack | **Tongue** forward (YO-15). With Up held: tongue up-forward at 45°. **With an enemy in his mouth: spit it** (YO-20). |
| Special | **Hold to aim an egg, release to throw** (YO-21). Nothing with no eggs. |
| Select | Nothing. |
| On a vine | Climb, as every hero; no tongue or eggs there. |

### A3. Movement and jumping

**YO-5. Walk (tuning).** The Classic plumbers' inertia model (`InertiaProfile`, ML-C4) with Mario's factors (`MARIO_CONSTANTS`: accel `0x000C7`, release 62767, brake 62344, skid 61816), but one cap: `maxWalk = maxRun = 0x01C00` (**1.75 px/f**), `canRun: false`. Between Mario's walk (1.4583) and run (2.5), since Attack is his tongue and he has no run button (Yoshi's Island has none either).

**YO-6. Crouch.** Down on the ground with nothing in the mouth: crouch pose, 12 × 16 box, no walking, as Classic Mario (`crouches: true`). Jumping from the crouch is a normal jump (no crouch-jump: Down in the air is the ground pound).

**YO-7. Jump (tuning).** The rise path (`MovementProfile.rise`, ML-C8): one tier `{ maxVx: Infinity, speed: 0x03400 (3.25 px/f), cap: 40 }`, `minLine: 16`, `gravity: 0x00355` (0.2083 px/f², Mario's), `maxFall: 0x04000` (4 px/f), `softCut: 52057` (Mario's), `stompBounce: 0x02800`, `jumpBuffer: false`, `turnInAir: false`, `airControl: 'full'`. Full hold: about **65 px** (4 tiles) apex, close to Mario's standing jump (about 69 px); a tap stops at the 16 px line.

**YO-8. Flutter jump (signature; tuning).** In the air, falling (vy > 0), with Jump held (pressed earlier or now), and the flutter not yet used since leaving the ground:

- gravity is off; each frame vy −= `0x00200` (0.125 px/f²) until vy reaches −`0x00800` (rising 0.5 px/f), then held there;
- it lasts at most **40 frames**; releasing Jump ends it at once; either way normal gravity resumes;
- **one flutter per jump** (re-armed on landing, on a spring or a stomp bounce); YO-D2 asks about Yoshi's Island's repeatable flutter;
- from a full jump it adds about 4 tiles of distance at 1.75 px/f; started at vy = 2 px/f it costs about 16 px of fall and wins back about 11 px;
- frames `flutter-0` / `flutter-1` alternate every 4 frames; sound `yoshi-flutter` loops while it lasts.

New optional profile field: `flutter?: { frames: number; lift: number; rise: number }` (frames 40, lift `0x00200`, rise `0x00800`), read on the rise path's gravity step only when set.

**YO-9. Ground pound (signature; tuning).** Down pressed in the air (also during a flutter, which it ends; not on a vine or a spring launch):

1. **Hang:** 12 frames, vx = vy = 0, frame `pound` (curled), sound `yoshi-pound-spin`.
2. **Drop:** vy = `0x06000` (6 px/f, past the normal fall cap), vx = 0, no control, hitbox 12 × 20.
3. **Land:** 8 frames of recovery (no control), sound `yoshi-pound`; with Reduce flashing off, a 2-frame 1 px screen shake (off with Reduce flashing).
4. During the drop his feet are a **melee hit**: `meleeDamage` = `{ kind: 'sword', amount: 800, pierce: 10, owner: p }` against enemies under him; after hitting an enemy he bounces up at `stompBounce` and the pound ends (he can pound again). Spinies do not hurt him during the drop. Bowser takes 800 and Yoshi bounces off.
5. Blocks under his feet are struck as melee (`meleeStrikesBlocks`, BR-C6): a plain brick breaks and he keeps falling through it; an item block bumps (its item rises above it, under Yoshi) and he lands on it.

Hits to kill (HP-C8, 800): Goomba to Paratroopa 1 (Paratroopa 900: 2), Buzzy Beetle and Bullet Bill 1 (pierce 10), Bowser fire 3, hammers 5, both 6.

### A4. Swimming

**YO-10.** Classic floor jumper (SW-C2, `floorJumpOnly`), with water numbers of his own (tuning): floor jump `0x03400` (3.25 px/f; profile `initial` one frame of water gravity less, `0x032E4`), water gravity `0x0011C` (0.0694 px/f²), sink cap `0x02155` (shared), walk 1.75 px/f, `surfaceTest: 'top'`, `surface` = his land gravity and fall cap. Apex about 76 px. **The flutter works under water** (same numbers); the ground pound drops at the sink cap instead of 6 px/f. No stomp under water (SW-C7). Tongue and eggs work as on land (SW-C5). YO-D6 asks whether he should stroke like the plumbers instead.

### A5. Power states

**YO-11. Lose Everything** (PS-C7): small dies; a hit while powered ends small.

**YO-12. Kit per state.**

| State | What it gives | Look |
|---|---|---|
| Small | Green eggs, **max 3**; starts with **3** eggs | green (`yoshi`) |
| Mushroom | One extra hit, **egg max 6**; eggs set to 3 if he has fewer | green; HUD Mushroom icon (PS-C26) |
| Fire Flower | Mushroom, plus **red eggs** (800 damage, pierce 6, YO-22) | **red Yoshi** (`yoshi-flower`) |
| Repeat Flower (PS-C6) | +3 eggs, capped at the max | |
| Star | 12 s, PS-C19; eggs cost nothing (PS-C18) | Star palettes (fallback: Mario's) |

**YO-13. What a hit removes.** The red eggs and the max of 6 (back to 3: eggs above 3 are lost, YO-D4). The count up to 3 is kept (PS-C8's "ammo never changes on a hit" holds for the part that fits). Hit response (tuning, Simon's row of PS-C10): push 1.25 px/f (`0x01400`) away from the source, up 2.5 px/f (`0x02800`), faces the source, locked until he lands, then 75 f invulnerable, 65 % opacity after landing. Anything in his mouth is dropped (gone). A hit during a ground pound cancels it.

**YO-14. No drops.** Like Mario, Luigi and Bill (PS-C15): nothing drops from enemies, bricks or coins. Eggs come only from swallowing (YO-19), the power-ups (YO-12) and the death reset (3 eggs, PS-C21).

### A6. Tongue, mouth and eggs

**YO-15. Tongue (tuning).** Attack (not while crouched, pounding, on a vine, or with something in his mouth):

- out **40 px** in 10 frames, held 2 frames, back in 10 frames (22 frames); a second tongue only after it is back; he can walk and jump meanwhile (not rooted);
- it starts at the mouth, 22 px ahead of the cell's left edge and 10 px below its top; with Up held it goes up-forward at 45° (28 px across, 28 px up);
- the tip is an 8 × 8 box; it stops at the first solid tile (no block strike);
- it catches the first **edible** enemy it touches (YO-16) and pulls it into his mouth; an inedible one stops the tip with no effect (sound `armour`, HP-C14);
- it also collects a coin, a power-up or a 1-up it touches (as Yoshi's Island's tongue does; YO-D5).

**YO-16. Edible table (shared with the mount, YM-14).**

| Enemy | Playable Yoshi | Mount |
|---|---|---|
| Goomba | into the mouth | swallowed at once |
| Koopa, Paratroopa (wings lost), Koopa shell, Buzzy Beetle and its shell | into the mouth | held as a shell (YM-15) |
| Spiny, Spiny egg | **inedible** (spiked; Yoshi's Island) | swallowed at once (Super Mario World) |
| Cheep Cheep (swimming, leaping) | into the mouth | swallowed at once |
| Blooper | into the mouth | (never: no mount in water, YM-8) |
| Lakitu | into the mouth; his cloud drifts off and fades | swallowed at once; same cloud |
| Hammer Bro, Piranha Plant, Bullet Bill, Podoboo, Bowser and fake Bowser, fire bars, flames, hammers | inedible | inedible |

Catching is an instant kill (as a stomp, HP-C7: no HP or armour test), scoring the enemy's stomp score (HP-C21) when it is swallowed or spat, not when caught.

**YO-17. Stomp.** He stomps as Classic Mario (HP-C7, HP-C22 extended to him: `stomps: true`). Spinies, Piranhas and Podoboos hurt as usual.

**YO-18. Mouth full.** Frame `full` (cheeks puffed). He moves and jumps as usual; the tongue and eggs are blocked until he swallows or spits. No time limit (Yoshi's Island has none).

**YO-19. Swallow and lay.** Down on the ground: 20 frames rooted (`lay`), then **+1 egg** (none if at the max; the score still counts), sound `yoshi-lay`. In the air, Down is the ground pound and keeps the enemy.

**YO-20. Spit.** Attack with a full mouth: the enemy flies out straight ahead at 3 px/f (`0x03000`, no gravity) from the mouth, tumbling (its own frame flipped upside down). It kills the first enemy it touches (600, pierce 10; Bowser takes 600) and is removed; it ends at solid ground or off screen. Breaks a brick it meets (BR-C9 `'end'`).

**YO-21. Aim and throw (signature; tuning).** Hold Special with at least one egg:

- a cursor (`aim-cursor`, drawn 56 px from the mouth) sweeps from **−10°** (just below level) to **+75°** and back, **64 frames each way**, starting at 0° going up; it mirrors when he turns;
- he can walk, jump and flutter while aiming (frame `aim` on the ground);
- **releasing Special throws** an egg along the cursor's line (frame `throw` for 12 frames), sound `yoshi-throw`; Down while aiming, a hit or a vine cancels with no throw;
- at most **2 eggs** on screen; a hold with 2 out does nothing until one ends.

Touch: holding the EGG button aims, letting go throws, so the gesture is one press (YO-D3 asks about Yoshi's Island's press-press style).

**YO-22. Eggs in flight.**

| Egg | Damage | Pierce | Speed | Flight |
|---|---|---|---|---|
| Green (small, Mushroom) | 400 | 0 | 4 px/f (`0x04000`) along the line, no gravity | bounces **once** off solid ground (reflects), ends at the second contact, after 120 frames, or off screen |
| Red (Flower) | 800 | 6 (armour piercing) | same | same |

`classicBlocks`: `{ ground: 'collide', afterBlock: 'end', strikesBlocks: true }`: a brick (125 HP) breaks and the egg ends; an item block bumps from any side (BR-C8). Hits to kill: green Goomba 1, Koopa 2, Paratroopa 3, Hammer Bro 2, Bowser fire 6, hammers 9; red Goomba to Paratroopa 1-2, Buzzy 1, Bowser 3 / 5 / 6. Eggs blocked by armour (green on a Buzzy) end with the `armour` sound (HP-C14). Eggs do not apply hit-stun (tuning).

### A7. Interactions

**YO-23.**

- **Bricks and blocks:** the head bumps (no break); eggs and the ground pound break bricks (YO-9, YO-22).
- **Pipes, vines, lifts, the flagpole, the axe:** as every hero. Flagpole pose `stand` hugging the pole is fine for a first build (art list).
- **Springs:** Mario's values (our spring table falls back to them, `entities/objects/spring.ts`); the flutter re-arms after a spring.
- **Bowser:** tongue inedible; eggs, spit enemies and the ground pound hurt him. His hammers and fire hurt Yoshi as usual.
- **Death:** the shared Classic death (PS-C23); reset to small with 3 eggs (PS-C21).
- **Co-op (dev only):** player 2's Yoshi is light blue (`yoshi-p2`). One Yoshi's tongue never catches the other player.
- **The mount:** a playable Yoshi never rides the mount and never gets eggs blocks (YM-5).

### A8. HUD, guide, touch, art, sound

**YO-24. Castle text and music.** The shared text and level music (as Bass and Pit; a per-hero rescue name is the Proto Man report's PM-M8).

**YO-25. HUD.** Name `YOSHI`; power icon (PS-C26); the egg counter in the tool slot at (96, 24): `icon-egg` then `×NN`, always shown; red when he has red eggs.

**YO-26. Guide** (`YOSHI_CLASSIC_GUIDE`, our style, read in upper case):
- tagline: `Flutter, lick and throw eggs.`
- move: `Walk. No run.`; jump: `Jump. Hold JUMP while falling to flutter.`
- down: `Crouch. In the air: ground pound. With a mouthful: swallow and lay an egg.`
- attack: `Tongue. Catches an enemy. Press again to spit it.`
- special: `Hold to aim an egg, let go to throw it.`
- power-ups: mushroom `One more hit. Carry 6 eggs.`; flower `Red eggs: stronger, and they pierce armour.`; star as every hero.
- demo poses: `stand`, `walk-0`, `flutter-0`, `tongue`, `throw`, `pound`.

**YO-27. Touch labels.** A `JUMP`; B `TONGUE` (or `SPIT` with a full mouth); C `EGG` (hidden with no eggs); Select hidden. Each label change is announced as touch labels already are.

**YO-28. Art (draft in `tools/mockups/classic/yoshi.ts`).** Sheet `yoshi`, 24 × 32 cells: `stand`, `walk-0..2`, `jump`, `flutter-0/1`, `pound`, `tongue`, `full`, `lay`, `aim`, `throw`, `hurt`, `sit`; 8 × 10 `egg-green`, `egg-red`; `aim-cursor` 7 × 7; `tongue-mid` 4 × 3; `tongue-tip` 5 × 5; `icon-egg` 8 × 8; `tear` 3 × 3. Palettes `yoshi`, `yoshi-flower`, `yoshi-p2`; star palettes fall back. Still to draw for the build: `crouch`, `climb-0/1`, `die`, `swim` (may reuse `jump`), `flag`. All original (shapes and outlines drawn for this project, nothing traced).

**YO-29. Sounds** (original MML, placeholders allowed): `yoshi-jump`, `yoshi-flutter` (short looping kicks), `yoshi-pound-spin`, `yoshi-pound`, `yoshi-tongue`, `yoshi-swallow`, `yoshi-lay`, `yoshi-throw`, `yoshi-egg-bounce`; the mount adds `yoshi-hatch` and `yoshi-cry` (YM-29). Until composed: `jump-small`, `bump`, `stomp`, `fireball`, `powerup-appear`.

**YO-30. Storyboard.** `tools/mockups/classic/storyboard.ts` renders `yoshi-sheet.png` (13 panels) and `yoshi-mount-sheet.png` (13 panels) through `render.mjs`; PNGs stay out of the repo.

### Part B: Yoshi, the mount (Super Mario World)

### B1. Should he appear at all, and where (the owner's decision)

Classic mode exists to play the original, and the original has no Yoshi. So **the mount is an owner decision, off by default**, and with it off nothing in any level changes: no tile, spawn, block content, score or timing (YM-2). The options:

| Option | How Yoshi appears | Level looks | Cost to the player | Data work | Risk |
|---|---|---|---|---|---|
| **M0. No mount** | never | unchanged | none | none | none; the playable Yoshi still exists |
| **M1. Egg blocks by rule (recommended)** | with **Yoshi mount: On**, the first power-up `?` block of each allowed area holds an egg while no Yoshi is in play (YM-5) | unchanged (every `?` block draws the same, `world/tile-render.ts`) | that block's Mushroom or Flower, once | none: computed at load | low; one rule, testable |
| M2. Hand-placed eggs | a table of chosen blocks per level, like `rules/classic-level-variants.ts` | unchanged | curated | a table for 32 + 52 areas | medium (curation, upkeep) |
| M3. Waiting at the start | Yoshi sits a few tiles right of each level's start | a sprite added | none | none | generous; makes him permanent |
| M4. Chosen on the select screen | "ride Yoshi" per hero: every life starts mounted | unchanged | none | none | the simplest to test; no find moment |

**Recommendation:** M0 as the default (`Yoshi mount: Off`), M1 when the owner turns it on, with Super Mario World's carry-over (YM-7): once found he stays with you across levels until lost. M4 is a cheap dev-only aid for testing (`&yoshi=ride`, YM-1).

### B2. The option

**YM-1. The switch.** A Classic options row **Yoshi mount: Off / On** (`settings.classicYoshi: boolean`, default **false**), under "Classic rules", hint "Off plays the original; On lets Yoshi eggs hatch from blocks". It applies only while the run's rules are `'classic'` (never `'current'`, never a campaign file). Dev: `&yoshi=1` turns it on for a dev Classic start, `&yoshi=ride` also starts every life mounted (M4, for tests); honoured only with dev mode on.

**YM-2. Off means untouched.** With the switch off (or rules `'current'`), no mount code runs: the level-load step and the block hook return before doing anything. A guard test plays 1-1 to 8-4's parity fixture with the switch off and compares it with today.

**YM-3. Who may ride.** Every Classic hero and Classic extra except **Sophia III** (a tank), **Vic Viper** (a ship) and **Yoshi** himself: a def opts out with a new optional `rides?: false`. For those heroes the egg blocks give their usual item (YM-5).

### B3. How he appears and how he is kept

**YM-4. Allowed areas.** Overworld, underground and athletic (sky, tree, mushroom) areas. **Not castles, water areas or bonus rooms** (the coin rooms under pipes and the vine cloud areas): Super Mario World keeps Yoshi out of castles, and this keeps every Bowser fight, the water rules (SW-C) and the bonus rooms as they are.

**YM-5. Egg blocks (M1).** On loading an allowed area with the switch on, the Classic level-load step (`ClassicRulesHooks.levelEdits`, TG-45) marks **the first `T.Q_POWERUP` block** (lowest x, then lowest y; hidden blocks and power-up bricks are skipped, so the look never changes) as the area's egg block (a world set of keys, like `world.brickHp`). When that block is struck (`classicStrikeBlock`), it holds an **egg** if all of these hold, else its usual Mushroom or Flower (PS-C2):

- the striking player may ride (YM-3) and is not riding;
- no Yoshi of any kind (ridden, waiting, fleeing, benched or carried) belongs to any player.

The egg is the existing `YoshiEgg` (rise 32 f, wobble 48 f, crack 16 f, four shell bits, `entities/objects/yoshi-egg.ts`); under Classic its `hatch` hands over to a new hook `classicRules().hatchYoshi(world, cx, feet)`, which lets out a waiting Yoshi (YM-6). The campaign path (`yoshiUnlocked`, the 1-up) is untouched.

**YM-6. Waiting Yoshi.** He sits (`sit`) where he hatched, facing the player; harmless, not hurt by enemies, carried by lifts; gone when 1 screen behind the camera or when the area unloads. Landing on his back (the rider's feet within his saddle box while falling) mounts (YM-10).

**YM-7. Carry-over (Super Mario World).** A ridden Yoshi stays with the rider through pipes and area changes within allowed areas, and into the next level at the flagpole. Entering a castle, water or bonus area while riding **benches** him: the rider goes on alone (the dismount is instant, no animation), and Yoshi comes back, ridden, at the start of the next allowed area of the run. Stored per player in the run state as `classicMount: 'riding' | 'benched' | null`; never in the campaign save.

**YM-8. How he is lost.** A hit (YM-17) and Yoshi runs off the screen or into a pit; a mid-air leap (YM-19) over a pit; the rider dying (lives lost reset it to `null`, PS-C21); leaving an area where he waits; Game Over. A lost Yoshi can be found again from the next egg block.

### B4. Riding

**YM-9. One mount profile (tuning).** While riding, the pair moves with **Classic Mario's profile** (`MARIO_CLASSIC_PROFILE`, ML-C3 to ML-C12: walk 1.4583 px/f, run 2.5 px/f, the plumbers' jump heights), without `crouchJump` and without the crouch; the rider's own profile returns on dismount. Every rider therefore jumps and runs the same on Yoshi (YM-D3). **Run is Attack held, as for Classic Mario; a press of Attack also licks** (Super Mario World's one button for both), so every rider can run on Yoshi.

**YM-10. The pair's body.** Hitbox **12 × 28** for every rider (fits 2-tile gaps like big Mario; 1-tile gaps need a dismount). The rider is drawn on the saddle, cut at the saddle line (YM-20). The rider's head decides block bumps: `canBreakBricks` and `headBumps` are the rider's (big Mario and Luigi break bricks on Yoshi, everyone else bumps, BR-C3).

**YM-11. Stomp.** Every rider stomps while riding (HP-C7 stomp), **Spinies included** (a new optional `stompsSpiky?: true` on the riding def, read where `world.ts` decides a stomp against `Enemy.stompable`). Piranhas, Podoboos, Bullet Bills from the front, fire and Bowser still hurt.

**YM-12. Controls while riding.**

| Input | While riding |
|---|---|
| Left / Right, Jump | Yoshi's movement (YM-9); one jump, no flutter (Super Mario World's Yoshi has none) |
| Attack | **Yoshi's tongue** (YO-15) for every rider; **spit** with a shell in the mouth (YM-15) |
| Special | **The rider's own Special**, unchanged (numbers, ammo, caps). If it does nothing in the rider's state, it fires the rider's **Attack shot** instead (YM-13) |
| Select | The rider's own Select (Link's bombs, Simon's and Ryu's Flower weapons, Bill's swap); Mega Man's Rush is not available |
| Down + Jump | **Get off** (YM-19) |
| Up at a vine | Nothing: get off first to climb |
| Down on a pipe | Both go in (YM-7) |

**YM-13. Each hero's attacks while riding** (the rule of YM-12 applied; melee weapons are put away because the rider's arms are busy holding on; shots leave from the rider's usual height above the pair's feet):

| Rider | Attack | Special while riding | Select |
|---|---|---|---|
| Mario, Luigi | tongue | **Flower: fireball** (2 on screen, ML-C19); small and Mushroom: nothing (YM-D5: Super Mario World allows no fireballs on Yoshi) | — |
| Link | tongue | boomerang (as on foot); sword and sword beam put away | bombs, as on foot |
| Samus | tongue | missiles once owned; **small, or no missiles: her beam** | — |
| Simon | tongue | his sub-weapon (Axe, hearts as usual); whip put away | Flower: Cross |
| Mega Man (and Bass, Proto Man) | tongue | Flower: Metal Blade; **small and Mushroom: the buster** (uncharged; no charge on Yoshi) | Rush not available |
| Bill | tongue | Flower: Machine Gun; **small and Mushroom: his Attack gun** | swap, as on foot |
| Ryu | tongue | Shuriken (ninpo as usual); sword put away | Flower: Windmill |
| Pit, Dark Pit | tongue | missiles once owned, else the beam | — |
| Other Classic extras | tongue | their Special, else their Attack shot; melee put away | as on foot |
| Sophia III, Vic Viper, Yoshi | cannot ride (YM-3) | | |

A per-hero table `MOUNT_SPECIAL` in `characters/classic/mount.ts` says, for each id, whether Special is the hero's own this frame or falls back to Attack.

**YM-14. Tongue.** Exactly YO-15 (40 px, 22 frames, Up for 45°), with the mount column of YO-16: Goombas, Spinies, Cheep Cheeps and Lakitu are **swallowed at once** (stomp score, sound `yoshi-swallow`); it also collects coins and items (YO-D5).

**YM-15. Shells in the mouth.** A Koopa, Paratroopa, Buzzy Beetle or shell is held (`full`). Attack **spits it as a kicked shell** from the mouth, in the facing direction (the Classic kicked shell: kills every enemy it touches, armoured ones and Bowser included, HP-C7; it can come back and hurt the pair as any shell can). Held more than **600 frames** (10 s, tuning) it is swallowed (stomp score). Down does nothing (no eggs for the mount). Red shells spit fire in Super Mario World: YM-D6.

**YM-16. Power-ups and Star while riding.** Items go to the rider (PS-C3, PS-C4 freezes; Mario grows on the saddle). Star: the pair is invincible and kills on contact (PS-C19).

### B5. Losing him, getting off

**YM-17. A hit while riding (the mount's protection).** Any damage that would hurt the rider instead:

1. **no power state is lost** (the rider's `onHurt` is not called);
2. the rider is thrown up off the saddle (vy −3 px/f, `0x03000`, tuning) and gets **120 frames** of invulnerability with the Classic 65 % look (PS-C13);
3. Yoshi runs off at **2 px/f** (`0x02000`, tuning) away from the source (frame `tongue` as an open-mouthed cry, a `tear`, sound `yoshi-cry`), turning at walls, harmless, falling into pits (lost), gone off screen (lost);
4. landing on his back before then remounts.

Pits, lava and the timer still kill (PS-C24), Yoshi with the rider.

**YM-18. Instant deaths are unchanged:** a crush, a pit, lava, time up.

**YM-19. Getting off.** Down + Jump on the ground: the rider hops up and off (the rider's own ground jump), Yoshi sits and waits (YM-6). **In the air it is a leap** (Super Mario World's jump off Yoshi): the rider gets a full ground jump of their own from the saddle, Yoshi drops (vy 0, falling with Mario's gravity) and, if he lands, sits and waits; over a pit he is lost.

### B6. Art and the rest

**YM-20. Drawing a rider.** The rider's own current frame (idle, jump, shoot, throw), **cut at the saddle line**: the top 11 rows of a 16 × 16 small plumber, the top 19 rows of a 16 × 32 hero, drawn 2 px left of Yoshi's cell with its bottom 17 px below the cell top, then Yoshi drawn over it (his head overlaps the rider's front). No new rider art is needed. Engine: an optional `SpriteSpec.under?: SpriteSpec & { cropH?: number }` drawn first by the player renderer.

**YM-21. Flagpole.** The rider hops off at the pole and slides as usual; Yoshi stands at its base (`sit`); at the bottom the rider gets back on and the pair walks to the castle. Scores unchanged.

**YM-22. Axe and Bowser.** Never reached on Yoshi (castles bench him, YM-7).

**YM-23. Springs, lifts, vines, cannons.** Springs launch the pair with the rider's spring values (the table is keyed by the rider's id; acceptable). Lifts carry him. Vines need a dismount (YM-12).

**YM-24. HUD.** No new element. Player 1's mount state is visible on screen; while benched, a small `yoshi` head icon (8 × 8, to draw) shows next to the power icon (YM-D8).

**YM-25. Touch labels.** While riding: B `TONGUE` (or `SPIT`), C = the rider's Special label (or their Attack label when YM-13 falls back to it). The A button keeps `JUMP`; the dismount is Down + Jump (also on touch).

**YM-26. Announcements.** New spoken lines (no auto-advance, nothing to dismiss): "Yoshi hatched", "Riding Yoshi", "Yoshi ran away", "Yoshi waits outside". Reduce flashing: the hit look is the 65 % opacity, no flashing.

**YM-27. Co-op (dev only).** Each egg block gives one Yoshi; a second rider needs a second egg. A rider can't be stomped or eaten by the other's Yoshi. A waiting Yoshi can be mounted by either player.

**YM-28. Score.** Swallowed enemies give their stomp score; spat shells give the shell-kick sequence (HP-C21). No points for hatching.

**YM-29. Sounds.** `yoshi-hatch` (the egg's burst; today it uses `bump`), `yoshi-cry` (running off), plus the tongue and swallow sounds of YO-29.

**YM-30. Engine work (both forms; sizes are estimates).**

| Work | Where | Size |
|---|---|---|
| Yoshi def, guide, touch labels, palettes, sheet | `characters/yoshi/classic.ts`, `guide.ts`, `content/sprites/yoshi.ts` | M |
| Flutter (`MovementProfile.flutter?`) | `profile.ts`, the rise path in `entities/player.ts` | S |
| Ground pound (hang, drop, melee feet) | Yoshi's `behaviour.update` + `meleeDamage`; a fall-cap override in his own scratch (as Classic Samus's crouch) | M |
| Tongue (shared): a short-lived projectile with a tip box that catches and returns | `characters/classic/yoshi-tongue.ts` | M |
| Mouth, swallow, lay, spit | Yoshi behaviour; spit = a `Projectile` spec with `amount` 600 | S |
| Aim cursor and eggs (bounce once, `classicBlocks`) | Yoshi weapons file | M |
| Mount entity (egg hatch, wait, flee, carry) | `rules/classic-yoshi.ts`; `hatchYoshi` and the egg-block set on `ClassicRulesHooks` | M |
| Riding as a def overlay: `ridingDef(base)` with Mario's profile, 12 × 28 box, stomps, `stompsSpiky`, input remap (Attack → tongue, Special fallback), `onHurt` → run off; `Player.def` swapped on mount/dismount, the base def kept on the player | `characters/classic/mount.ts`; a `Player.riding?` field | L |
| `SpriteSpec.under` (rider layer) | `character.ts`, the player renderer | S |
| Carry-over and benching in the run state | `GameState`, the World's area load | M |
| Options row, setting, dev URL | `scenes/original-game.ts`, `engine/save/settings.ts`, `dev-url.ts` | S |
| **Total** | playable Yoshi **M-L**; mount **L** (mostly the overlay and carry-over) | |

Rules discipline: the only shared-system changes are optional fields (`flutter`, `rides`, `stompsSpiky`, `SpriteSpec.under`) and one more `ClassicRulesHooks` member; nothing branches on `world.rules` twice; no non-classic file imports the new modules except `registry.ts`.

## Actual

There is no Yoshi in Classic mode. `CLASSIC_EXTRAS` in `src/game/characters/registry.ts` is empty, so `?char=yoshi` falls back to Mario. The only Yoshi code is the campaign's Top Secret Area egg (`T.Q_EGG`, `src/game/level/tiles.ts`; `src/game/entities/objects/yoshi-egg.ts`), which always hatches a 1-up (`yoshiUnlocked` returns false, `TODO(yoshi)`, docs/ROADMAP.md "Yoshi hatches from the Top Secret Area's egg"). No hero can ride anything; `Player.def` (`entities/player.ts:93`) is set once per life.

## How often

every time

## Notes

- **Sources.** No original source: SMBC 3.1.21 has no Yoshi. Feel references are Super Mario World (the mount: tongue, swallowing, shells held and spat, running away when hit, the jump off his back, no castles) and Yoshi's Island (the hero: flutter, eggs from swallowed enemies, the sweeping aim cursor, ground pound). Everything else is our Classic rules: PS-C (power states), HP-C (damage units, armour, stomps), BR-C (blocks), SW-C (water), TG-17 to TG-45 (rules model, roster, level-load hook).
- **Mockups.** `tools/mockups/classic/yoshi.ts` (draft sprites as text arrays, not registered), `tools/mockups/classic/storyboard.ts` and `render.mjs` (`node tools/mockups/classic/render.mjs <outDir> [port]`). Sheets: `yoshi-sheet.png`, `yoshi-mount-sheet.png`, kept outside the repo.
- **Implementation hints.**
  - Build the playable hero first: it exercises the tongue, mouth and art that the mount reuses, and it is self-contained (a Classic extra like Bass).
  - Flutter: on the rise path, after the release step, if `flutter` is set and the hero is falling with Jump held and the flutter unused, skip gravity and apply `lift` up to `rise`; count frames in the player's scratch. Clear "used" on landing, springs and stomp bounces.
  - Ground pound: Yoshi's own `behaviour.update` sets vy each frame during the drop (as Mega Man's slide sets vx); the shared fall cap clamps only when vy exceeds `maxFall`, so give the drop a scratch flag that the def's `hitbox` and an optional `fallCap?(p)` read, or keep vy under the cap by raising `maxFall` to 6 px/f and letting `rise` gravity bring a normal fall only to 4 px/f (coder's choice; the first avoids touching the profile).
  - Tongue: a `Projectile` subclass owned by the player, moving out and back relative to the mouth each frame; on contact with an edible enemy it calls `enemy.die()` without score and stores the enemy kind in the owner's scratch (`mouth`); the score is given on swallow or spit.
  - Mount overlay: keep the base def on the player (`p.riding = { base, since }`) and swap `p.def` to `ridingDef(base)`; every hook of the overlay delegates to `base` with a remapped `InputFrame` (Attack masked; Special mapped to Attack when `MOUNT_SPECIAL` says so). On dismount, death, a level end or a hit, swap back before anything else runs. Kit and power state live on the player, so they survive the swap.
  - Egg block: `levelEdits` records the key; `classicStrikeBlock` checks it before `world.bumpBlock` and, when the egg applies, spawns `YoshiEgg` itself instead of bumping the power-up (the block becomes used either way).
- **Acceptance checks** (headless, `rules: 'classic'`).
  - Roster: `yoshi` is in the Classic roster's second row only; with `rules: 'current'` or a campaign file, `char=yoshi` falls back as today.
  - Jump: full hold apex 65 ± 2 px; tap apex 16 ± 1 px. Walk: after 120 frames holding Right, vx = 1.75 px/f.
  - Flutter: from a full jump holding Jump throughout, airtime grows by 40 ± 1 frames; a second hold in the same jump does nothing; release ends it the same frame.
  - Ground pound: 12 frames with no movement, then 6 px/f down; a Goomba under him dies, a Buzzy dies (pierce), a brick under him breaks and he falls through.
  - Tongue: a Goomba 32 px ahead is caught (mouth full); a Bullet Bill is not; with a full mouth, Down on the ground → +1 egg after 20 frames; Attack → a spit enemy that kills a Koopa 48 px ahead.
  - Eggs: small max 3, Mushroom 6; a green egg kills a Goomba, two kill a Koopa, it is blocked by a Buzzy; red eggs kill a Buzzy in one; a hit while Flower with 6 eggs leaves 3.
  - Mount off (default): the parity fixture `tests/sim/current-parity.test.ts` and every Classic level start are byte-identical with the switch off; no `YoshiEgg` ever spawns in a Classic run.
  - Mount on: in 1-1 the first power-up `?` block gives an egg for Link; a second Yoshi never hatches while one is in play (the block gives its Flower); Sophia III and Yoshi get the power-up.
  - Riding: Link on Yoshi, Attack catches a Goomba (no sword hitbox spawned); Special throws a boomerang; small Samus's Special fires a beam; Mario small has nothing on Special.
  - Hit while riding as Fire Mario: power state stays `fire`, rider invulnerable 120 frames, Yoshi moves away at 2 px/f and despawns off screen; landing on him before that remounts.
  - Carry: finishing 1-1 riding starts 1-2 riding (an allowed area); 1-4 starts on foot with the mount benched; 2-1 starts riding again. Dying resets it.
  - Current unchanged: the existing suite passes with no edits.
- **Confidence.** Design only; nothing played. Every number is a tuning value chosen for feel at SMB scale; the riding rules are the biggest unknown and need a playtest with several heroes (Link and Simon lose their melee on Yoshi, which may feel bad).
- **Related reports.** `2026-10-07-classic-follow-ups.md` (NC-2; NC-8's Metal Slug tank shares the mount idea, so build the overlay generic: `ridingDef(base, mount)`), `2026-10-07-bass-build-classic-character.md` and `2026-10-07-pit-build-classic-character.md` (the format and the Classic-extra roster), the four shared Classic reports, `2026-10-07-dev-classic-smbc-rules-toggle.md`.

## Decisions for the owner

| ID | Question | Recommended | Alternatives |
|---|---|---|---|
| **YM-D1** | **Is there a mount in Classic mode at all?** Classic is meant to match the original, which has no Yoshi. | **Yes, as an option that is Off by default** (YM-1, YM-2): Off plays the original exactly. | No mount (M0; only the playable Yoshi); on by default |
| YM-D2 | How does he appear when On? | **M1: the first power-up `?` block of each allowed area holds an egg while no Yoshi is in play** (looks unchanged) | M2 hand-placed table; M3 waiting at each start; M4 picked on the select screen (dev aid only) |
| YM-D3 | Movement while riding | **Yoshi's own (Classic Mario's) profile for every rider** (YM-9) | each rider keeps their own movement |
| YM-D4 | Run while riding | **Attack held runs, a press licks** (Super Mario World), for every rider | no run on Yoshi |
| YM-D5 | Mario's and Luigi's fireball on Yoshi | **On Special** (parity with the other heroes' weapons) | none, as in Super Mario World |
| YM-D6 | Shell powers (Super Mario World: a red shell spits three fireballs) | **No powers**: every shell is spat as a kicked shell | red Koopa shells spit 3 fireballs (1000 each, pierce 0) |
| YM-D7 | Castles and water | **Yoshi waits outside (benched) and returns at the next allowed area** | lost on entry; allowed everywhere (then Bowser's fire and the swim rules need mount rules) |
| YM-D8 | Show a benched Yoshi on the HUD | **A small head icon** | nothing |
| YM-D9 | Use the mount for the campaign's Top Secret Area egg later | **Not now**: the campaign must not change; a separate campaign decision later (docs/ROADMAP.md) | reuse it in the same release behind a campaign unlock |
| YM-D10 | Melee heroes on Yoshi | **Melee put away** (tongue on Attack) | Attack keeps the hero's own attack and Special is the tongue |
| **YO-D1** | Is the playable Yoshi a Classic extra? | **Yes**: `CLASSIC_EXTRAS`, second select row (owner decision 2026-10-19 for the wishlist) | |
| YO-D2 | Flutter repeats | **Once per jump** | Yoshi's Island's repeatable flutter (each later one weaker) |
| YO-D3 | Aim input | **Hold Special to aim, release to throw** (one gesture, good on touch) | press to aim, press to throw (Yoshi's Island's default) |
| YO-D4 | Eggs above 3 on a hit | **Lost** (the max drops to 3) | kept until thrown (the max applies only to new eggs) |
| YO-D5 | Tongue collects coins and items | **Yes** | enemies only |
| YO-D6 | Swimming | **Classic floor jumper with the flutter** (SW-C2) | stroke like the plumbers |
| YO-D7 | Run | **None; a single 1.75 px/f cap** | Yoshi's Island's slow build-up to a faster run after a held second |
| YO-D8 | Drops | **None**; eggs only from swallowing and power-ups | 25 % enemy drops of an egg (as Link's bombs) |
| YO-D9 | Art and sounds | **The drafts in `tools/mockups/classic/yoshi.ts`**, original MML sounds to compose | owner-drawn sheet |
