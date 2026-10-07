# Classic SMBC rules for Simon: free air steering, one air jump, power-state kit, rooted whip that breaks bricks, 400 ms hit freeze, original sub-weapons

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=simon` (once the toggle exists; today `?dev=1&level=1-1&char=simon` shows the Current behaviour)
- **Character and power:** Simon, all power states (small, Mushroom, Fire Flower)
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=simon` (Current). Jump straight up and press right in the air: he does not move. Press jump again in the air: nothing happens. Walk under the first brick row and jump: his head breaks a brick. The HUD shows an HP bar and 5 hearts.
2. Open `?dev=1&rules=classic&level=1-1&char=simon` (Classic, once built). The HUD shows 10 hearts and no HP bar. C throws an Axe.
3. Jump straight up and press right in the air: he moves right at 1.25 px/f and stops dead when you let go. Press jump again in the air: he gets a second full jump. A third press does nothing until he lands.
4. Jump under a brick: it only bumps. Jump and whip a brick from the side: it breaks. Whip a Goomba with the Leather whip: it freezes for 24 frames and needs a second hit.
5. Get a Mushroom, then a Fire Flower. Press Select: a Cross flies about 110 px out, comes straight back and vanishes when it touches him. Touch a Goomba: he loses the Flower and the Mushroom together and is small again.

## Expected

Classic Simon plays like the original's **default** Simon: Classic power-up mode, When Hit = Lose Everything, default Customize Weapons choices (start weapon Axe, extra weapon Cross), Classic Special Input off, no cheats. The "Classic Simon" cheat (committed jump arc) is out of scope. Shared systems are specified in their own reports, linked below. This report gives Simon's own values.

Conversions: Flash px/s ÷ 120 = px/f; Flash px/s² ÷ 7200 = px/f²; Flash px ÷ 2 = px; ms ÷ 16.67 = frames. Hex values are in our velocity units (1/4096 px per frame, `vel()` in `src/engine/math/units.ts`).

### Controls

- **SI-C1 Control map.**

  | Input | Classic SMBC |
  |---|---|
  | Left / Right | Walk at 1.25 px/f, instant start and stop. Steers in the air (SI-C6). |
  | Down | Crouch on the ground. He stops dead and cannot walk. Attack and C work from the crouch (low whip, low throw). |
  | Jump | Jump on the ground. In the air, the one air jump (SI-C7). Does nothing on a vine. On a spring it is the spring boost (shared). |
  | Attack (X) | Whip (SI-C14 to SI-C17). Standing, crouching or in the air. Not on a vine. |
  | Up + Attack | Whip, the same as Attack. It does **not** throw (the original's "Classic Special Input" option is off by default). |
  | Special (C) | Uses the start weapon, the **Axe** by default (SI-C18 to SI-C26). With the dev `&kit=full`: the sub-weapon Select picked (SI-C26). |
  | Select | With the Fire Flower: uses the extra weapon, the **Cross** by default. Without the Flower: does nothing. No belt cycling, except with the dev `&kit=full` (SI-C26). |

  The tool belt, its HUD and Select cycling are absent in Classic.

- **SI-C2 Facing.** Simon turns only:
  - on the ground, to the held direction;
  - at a ground jump's take-off, to the held direction;
  - at an air jump, to the held direction;
  - while standing on a spring, and on leaving it, to the held direction;
  - when knocked back (he faces the thing that hit him, SI-C13).

  In the air he never turns otherwise. Holding back in mid-air moves him backwards while he still faces forwards, and the whip and thrown weapons go the way he faces.

### Movement

- **SI-C3 Walk.** Top speed 1.25 px/f (`0x01400`). It is reached on the first frame, and releasing the direction sets 0 on the next frame. Holding left and right together also sets 0. No run, no skid, no slide. Profile: `instantAccel: true`, `maxWalk = maxRun = 0x01400`, `canRun: false`.
- **SI-C4 Rooting.** On the ground, vx is 0 for the whole whip or throw (21 f, SI-C14 and SI-C18). In the air he still steers while whipping or throwing. If he lands during an air whip or throw, vx is 0 from the landing until it ends. While crouched, vx is 0.

### Jumping

- **SI-C5 Ground jump.**

  | Constant | Original | Ours (Classic) |
  |---|---|---|
  | Take-off speed | 565 px/s | 4.708 px/f (`0x04B55`) |
  | Our `initial` | — | **4.5 px/f (`0x04800`)**: the take-off minus one frame of gravity. The original adds gravity before it moves; ours moves first, so this gives the original's arc frame for frame |
  | Gravity, rising or falling, jump held or not | 1500 px/s² | 0.2083 px/f² (`0x00355`) |
  | Variable height | none (fixed arc) | `variableJump: false` |
  | Fall cap | 2000 px/s | 16.67 px/f (`0x10AAB`). Clamp at it (`maxFall = fallReset = 0x10AAB`), no SMB1 reset |
  | Coyote time | none | 0 f |
  | Apex | 565² / (2 · 1500) = 106 Flash px = 53.2 px continuous; 50.9 px stepped in the original's order | 50.9 px with `0x04800` (55.6 px if `0x04B55` were used unchanged) |

  A held direction at take-off sets vx to ±1.25 px/f. After that, air control (SI-C6) decides vx.

  The same rule holds for every launch of Simon's body in this report: the air jump (SI-C7), the water jumps (SI-C9)
  and the knockback hop (SI-C13). Projectiles need no change: our projectile code already adds gravity before it
  moves (`projectile.ts:244-246, 265-270`).

- **SI-C6 Air control (the default; "stops dead").** In the air, every frame:
  - right held alone: vx = +1.25 px/f;
  - left held alone: vx = −1.25 px/f;
  - neither or both: vx = 0 at once.

  There is no momentum and no drift. A wall on that side blocks the move. This applies to every airborne state: ground jump, air jump, walking off a ledge, spring launches of every colour, and falls. It does not apply during knockback (input is locked, SI-C13).

- **SI-C7 The mid-air second jump.**
  - Pressing jump in the air with the air jump ready sets vy = −4.708 px/f (`0x04B55`; ours −0x04800, SI-C5), the full ground take-off, whatever vy was (rising or falling fast). He faces the held direction. Air control continues as in SI-C6.
  - It cancels a whip or throw in progress. A throw cancelled before frame 14 throws nothing and costs nothing.
  - **Using it clears it** (`Simon.as` 794, `canDoubleJump = false`): exactly one air jump per spell in the air. A third press does nothing.
  - **Recharged** on every frame on the ground (641), at a ground jump's take-off (772), and on leaving a spring (694).
  - **Not recharged** by enemies (Simon cannot stomp; the stomp recharge in `bounce`, 854-858, needs the Everyone Can Stomp cheat), by vines, by head bumps or by knockback.
  - Walking off a ledge leaves it ready (it was set on the ground).
  - At level start, at a respawn and after a pipe or area change, if he is in the air it is **not** ready until he first lands (`firstCollisionCheck`, 1046-1050).
  - It works the same under water (SI-C9). It is not available on a vine, on a spring (jump boosts the spring there) or during knockback.
  - Used at the apex of a ground jump, the total height is about 102 px (two 50.9 px arcs, SI-C5).
  - Jump acts on the press only. A press in the air with no air jump left is ignored and is not buffered into a jump on landing (the original has no jump buffer; do not apply `JUMP_BUFFER_FRAMES` to Classic Simon).

- **SI-C8 Head bump.** Hitting a ceiling ends the rise at once (shared). Bricks only bump (SI-C27).

### Swimming

Shared rules: [2026-10-07-classic-swimming.md](2026-10-07-classic-swimming.md). Simon's values:

- **SI-C9** No stroke. Under water:
  - gravity 750 px/s² = 0.1042 px/f² (`0x001AB`);
  - sink cap 250 px/s = 2.083 px/f (`0x02155`, shared);
  - the ground jump and the air jump keep their 4.708 px/f take-off, so a floor jump rises about 104 px (our initial `0x049AB` = take-off minus one frame of water gravity, SI-C5), plus the one air jump;
  - walking on the floor stays 1.25 px/f (he is not a slow seabed walker);
  - air control as SI-C6;
  - the whip and sub-weapons work as on land.

### Health and power-ups

Shared rules: [2026-10-07-classic-power-states.md](2026-10-07-classic-power-states.md). Simon's values:

- **SI-C10 Kit per power state.** No size change: the hitbox stays as today in every state.

  | State | Whip | Shot cap | C (Special) | Select |
  |---|---|---|---|---|
  | Small | Leather: 200 damage, reach 36 px | 1 | Axe | nothing |
  | Mushroom | Morning Star: 275 damage, reach 36 px | 2 (Double) | Axe | nothing |
  | Fire Flower | Flame Whip: 400 damage, reach 51 px | 3 (Triple) | Axe | Cross |

- **SI-C11 Start, hits and death.**
  - A new game starts small with the Axe and **10 hearts** (max 99). No HP bar: the HUD shows the heart count.
  - A hit while powered (Mushroom or Flower) removes **both** tiers (Lose Everything): Leather whip, cap 1, no Select weapon. The Axe and the hearts are kept.
  - A hit while small kills.
  - On death, hearts reset to 10 (`Character.cleanUp`, 3109-3113). Hearts and the power state otherwise carry between levels.
- **SI-C12 Pickups and drops.**
  - A ? block gives a Mushroom when he has none, otherwise a Fire Flower (shared Classic rule). No pickup unlocks sub-weapons, lengthens the whip or fully heals; those Current rules are absent.
  - A Fire Flower collected while he already has the Flower also gives **+5 hearts**.
  - Small heart +1, big heart +5, capped at 99.
  - Kills drop hearts 25 % of the time (80 % small, 20 % big). Broken bricks drop at 6.25 % and coin-block hits at 12.5 % (Simon has `_canGetAmmoFromBricks` and `_canGetAmmoFromCoinBlocks`). No health drops.
  - During Star power, sub-weapons cost nothing and work at 0 hearts (`hasEnoughAmmo` returns true and `setAmmo` never lowers ammo while `starPwr`). Star length is shared (12 s).
- **SI-C13 Hit response (Simon's numbers).**
  - Knockback: vy −2.5 px/f (`0x02800`) and vx 1.25 px/f (`0x01400`) away from the source. With no source, he is pushed backwards from his facing. He turns to face the source. The hop is about 14 px (our initial `0x024AB`, SI-C5).
  - A whip or throw in progress is cancelled.
  - Input is locked, he takes no damage and he touches nothing until he lands. Grabbing a vine, a spring launch or a pit bounce also ends the lock.
  - After that: 1250 ms = 75 f of invulnerability, drawn at 65 % opacity (no blinking).

### Weapons and attacks

Damage values are the original's HP-scale numbers. Enemy HP, armour and piercing are in [2026-10-07-classic-enemy-hp-and-armour.md](2026-10-07-classic-enemy-hp-and-armour.md).

- **SI-C14 Whip timing.** Three animation steps of 115 ms (`attackAnimTmr`). The timer carries its remainder, so at 60 fps:

  | Frames from the press (press = 0) | Step | Lash |
  |---|---|---|
  | 0-6 | attackStart (whip hangs behind) | not live |
  | 7-13 | attack-2 (whip waves) | not live |
  | 14-20 | attackEnd (whip straight) | **live** |
  | 21 | ends: stand, crouch or jump pose | free to act |

  Wind-up 14 f, live 7 f, total 21 f. While a whip or throw runs, Attack and C do nothing. A jump (ground or air) cancels it.

- **SI-C15 Whip reach.** The hit box is measured from Simon's centre x and his feet y, mirrored when he faces left:

  | Whip | Standing | Crouching |
  |---|---|---|
  | Leather, Morning Star | x +7.5 to +36 px; y 24 to 17 px above the feet | x +7.5 to +36 px; y 15 to 8 px above the feet |
  | Flame Whip | x +7.5 to +51 px; same heights | x +7.5 to +51 px; same heights |

  A whip in the air uses the standing box. The crouch box is used only for a whip started crouching on the ground.

- **SI-C16 Whip damage.** Leather 200, Morning Star 275, Flame Whip 400. The whip hits every enemy in the box, once per swing each. It does not pierce armour. With the HP report's values:

  | Target (HP) | Leather | Morning Star | Flame Whip |
  |---|---|---|---|
  | Goomba (250) | 2 hits | 1 | 1 |
  | Koopa (600) | 3 | 3 | 2 |
  | Hammer Bro (800) | 4 | 3 | 2 |
  | Bowser (2400) | 12 | 9 | 6 |

- **SI-C17 The 400 ms hit freeze.**
  - Every whip or sub-weapon hit that damages an enemy freezes it for 400 ms = **24 f**. It does not move, animate or run its timers.
  - Another hit during the freeze restarts the 24 f if that leaves more time.
  - Not frozen: Bowser (and fake Bowsers) and Lakitu, which resist it. Armoured enemies the weapon cannot pierce take no damage and are not frozen either.
  - A hit-stunned enemy still hurts Simon on contact (HP-C18). Only an Ice-frozen enemy is harmless (HP-C17); Simon
    has no Ice.

  The shared hit-stun mechanism is in the enemy HP report.

- **SI-C18 Throw timing.**
  - C (or Select with the Flower) starts a throw only if the weapon is affordable and the shot cap allows it.
  - The throw uses the same three 115 ms steps. The weapon appears at **frame 14**, if the hearts and the cap still allow it then. The hearts are paid at that moment.
  - The throw ends at frame 21. He is rooted on the ground for all 21 f (SI-C4).
  - The Stopwatch has no throw animation: it acts on the press (SI-C25).
- **SI-C19 Shot cap.** 1 small, 2 with the Mushroom, 3 with the Flower. It counts all of this player's projectiles on screen: Axes, Crosses, Daggers, Holy Water bottles and flames. C and Select share it.
- **SI-C20 Spawn point.** Every thrown weapon starts 11 px ahead of Simon's centre and 25 px above his feet (15 px when crouching), moving the way he faces.
- **SI-C21 Axe.** 1 heart. Damage 350.

  | Constant | Original | Ours |
  |---|---|---|
  | vx | 250 px/s | 2.083 px/f (`0x02155`) |
  | vy at launch | −560 px/s | −4.667 px/f (`0x04AAB`) |
  | Gravity | 1500 px/s² | 0.2083 px/f² (`0x00355`) |
  | Fall cap | 900 px/s | 7.5 px/f (`0x07800`) |
  | Apex | 52.3 px above the hand continuous; 50 px stepped | 50 px: our projectile code already adds gravity before it moves (`projectile.ts:265-270`), so use `0x04AAB` unchanged |

  Our projectile code clamps every falling projectile at 4 px/f (`if (b.vy > 0x04000) b.vy = 0x04000`, `projectile.ts:246` and `:267`). The Classic Axe needs its own fall cap of 7.5 px/f (`0x07800`), so make the clamp a per-projectile value. Current keeps 4 px/f.

  It passes through solid ground and through enemies, hitting each enemy once while it overlaps. It has no lifetime: it is removed when it falls below the screen or leaves its side.

- **SI-C22 Cross.** **2 hearts**. Damage 300.
  - Flies straight out at 1.667 px/f (`0x01AAB`), with no gravity.
  - After 110 px past its spawn point it slows at 0.0972 px/f² (`0x0018E`): it stops after about 17 f and about 14 px more, then comes back. It accelerates the other way up to 1.667 px/f.
  - The return is a **straight horizontal line** at the height it was thrown. It does not home on Simon.
  - Touching the screen edge on the way out turns it back at once at full speed.
  - Only on the way back can it touch Simon. Touching him **catches** it (it vanishes, no refund).
  - If it misses him, it flies on and is removed when it leaves the screen.
  - It passes through solid ground and enemies, and can hit an enemy again on the way back.
- **SI-C23 Dagger.** 1 heart. Damage 300. Flies straight at 4.167 px/f (`0x042AB`), with no gravity.
  - The first enemy it damages removes it. An armoured enemy also removes it, without damage.
  - It ignores solid non-brick ground and is stopped only by bricks and ? blocks (SI-C28).
- **SI-C24 Holy Water.** 1 heart.
  - The bottle: vx 2.083 px/f (`0x02155`), vy −0.833 px/f (`0x00D55`), gravity 0.1667 px/f² (`0x002AB`). Damage 50. **Armour-piercing.**
  - On touching any ground, platform or block, it becomes a flame where it is. The flame does not move, does 200 damage, is still armour-piercing and passes through enemies.
  - The flame re-hits the same enemy every 400 ms (24 f). It lasts 9 animation frames of 130 ms = 1170 ms (about 70 f).
- **SI-C25 Stopwatch.** 5 hearts.
  - On the press, it freezes **every enemy and enemy projectile in the level** for 3000 ms = **180 f**, not only those on screen. Frozen objects do not move, animate or run timers. They still hurt on contact.
  - Bowser is frozen too; Lakitu is not.
  - Enemies that spawn after the press are not frozen.
  - The hearts are **always** spent, even with no enemy around.
  - It cannot be used again while a freeze runs.
- **SI-C26 Which sub-weapons Classic reaches.** With the default choices, C is always the Axe and Select (with the Flower) is always the Cross. No sub-weapon pickups exist in Classic (? blocks give only Mushrooms and Flowers; drops are hearts). Dagger, Holy Water and Stopwatch are still built to SI-C23 to SI-C25. The dev `&kit=full` (TG-44) is the only way to reach them: it gives the Fire Flower state, 99 hearts and all five sub-weapons; **Select** cycles which one C uses (Axe, Cross, Dagger, Holy Water, Stopwatch) instead of throwing the Cross. Keep the defaults as two constants (start weapon = Axe, extra weapon = Cross) for the Customize Weapons follow-up.

### Special abilities

- None beyond SI-C7. No stomp: landing on an enemy hurts him (unchanged, `stomps: false`). No stairs, slide, backflip or item crash.

### Interactions

Shared rules: [2026-10-07-classic-bricks-and-shots.md](2026-10-07-classic-bricks-and-shots.md). Simon's values:

- **SI-C27 Whip vs blocks; head.**
  - During the 7 live frames, a whip box that overlaps a brick **breaks it in one hit**, at any whip level.
  - A whip box that overlaps a ? block, a hidden-item brick or a multi-coin brick **bumps it from the side**, as a head hit would: it gives its item or coin.
  - Each block is struck once per swing.
  - His head **only bumps** bricks, in every power state (`canBreakBricks` false in Classic).
- **SI-C28 Sub-weapons vs ground and blocks.** A brick has 125 HP.
  - **Axe (350) and Cross (300):** pass through all solid ground. A brick they cross breaks and a ? block they cross is bumped, and they keep flying.
  - **Dagger (300):** passes through solid non-brick ground (floor, pipes, hard blocks). A brick stops it and breaks; a ? block stops it and is bumped.
  - **Holy Water:** the bottle bursts on any ground. If that is a brick, the burst hits it for 200, so the brick breaks (a ? block is bumped). The flame then ignores non-brick ground but still hits bricks it touches, every 24 f.
- **SI-C29 Springs.** On leaving a spring, a held direction sets vx ±1.25 px/f and his facing, and the air jump is recharged. On the spring, the held direction turns him. Launch speeds are shared (`SPRING_GREEN_BOOST.simon` already holds the original's green value). With SI-C6 he steers after every launch, green or red.
- **SI-C30 Vines.** No whip, throw or Select on a vine. Grabbing a vine ends a knockback lock. A vine does not recharge the air jump.
- **SI-C31 Two players.** Both players get Classic Simon if either picks him. The shot cap counts only that player's own projectiles. The Stopwatch is level-wide, so it freezes enemies for both players. While its freeze runs, neither player can start another.

### Feel

- **SI-C32** Taken together: instant start and stop, air steering that stops dead, a short 51 px hop with a second jump, and a heavy whip that roots him for 21 f, hits late (frame 14) and freezes what it hits. No setting should soften this in Classic (no ramp, no coyote time, no jump buffer).

## Actual

Current (stays the default, unchanged):

- Profile `src/game/characters/simon/index.ts` 15-34:
  - walk ramps from 0.0625 px/f (`minWalk 0x00100`) at +0.125 px/f² to 1.0 px/f (`0x01000`), and releasing decelerates at 0.25 px/f²;
  - jump 4.5 px/f (`0x04800`) at 0.156 px/f² (`0x00280`), played apex 67-68 px;
  - fall cap 4.5 px/f with a reset to 4.0;
  - `airControl: 'none'`, so the arc is committed and ledge momentum is kept.
- No air jump. `src/game/entities/player.ts` 200-204 allows jumps only on the ground or within the coyote frames. Facing follows vx (242-245).
- Health is a 16-HP bar at 2 HP per hit with 60 blinking frames (`index.ts` 36-42, 142-148, 252-263). He starts with no sub-weapon and 5 hearts.
- Mushrooms unlock the next sub-weapon and fully heal; Flowers lengthen the whip, then raise the shot cap (`index.ts` 220-238). All unlocked sub-weapons ride the belt, and Select cycles them (190; `toolbelt.ts` 28-32). Up+Attack throws (195).
- The whip: 18 f in all, 10 f wind-up, live from frame 10 to frame 15, reach 16/24/32 px from the body edge, 6 px tall (`index.ts` 41, 200-211; `weapons.ts` 105). He keeps walking during it (played). It deals `sword` 1 (`src/game/world/world.ts` 1264-1275), never touches blocks, and there is no hit freeze.
- His head breaks bricks: `canBreakBricks: () => true` (`index.ts` 151; `world.ts` 1105-1107).
- Sub-weapons (`weapons.ts` 28-102):
  - all cost 1 heart except the Stopwatch;
  - Dagger 5 px/f;
  - Axe 1.5 px/f forward, −5.5 px/f up (apex about 97 px);
  - Holy Water flame 60 f, one hit;
  - Cross 3 px/f, which homes back in 2-D after 30 f (`src/game/entities/projectiles/projectile.ts` 213-223);
  - Stopwatch: on-screen enemies only, refunded when none are on screen, frozen enemies are harmless (`index.ts` 111-121; `world.ts` 792-795, 1377).
- Swimming: the shared stroke (`player.ts` 16, 295-344).

## How often

every time

## Notes

**Sources (original, `$S/orig/src/com/smbc`, line numbers after `tr '\r' '\n'`; the same as `$S/chars/simonsrc/`):**

- SI-C1: `characters/Simon.as` 827-853 (whip), 860-878 (C), 880-890 (Select needs `FIRE_FLOWER`), 829 with `data/GameSettings.as` 112, 211 (Classic Special Input off); 125-126, 230-231 (Axe and Cross defaults).
- SI-C2: `Simon.as` 555-556, 575-576 (turn only `if (onGround)`), 775-784, 817-820, 680-700, 999.
- SI-C3, SI-C4: `Simon.as` 197, 432-436 (`WALK_SPEED` 150), 527-589 (`movePlayer`: `vx = 0` while `ST_ATTACK && onGround` or crouching, 533-536).
- SI-C5: `Simon.as` 420-438 (`jumpPwr` 565, `gravity` 1500, `vyMaxPsv` 2000), 759-785.
- SI-C6: `Simon.as` 531 (`onGround || !classicMode` branch), 578-581. Played in the original (`$S/chars/shots/simon/orig/026_ac0.png`-`028_ac2.png`).
- SI-C7: `Simon.as` 208, 641, 772, 786-794, 854-858, 694, 1046-1050; `level/Level.as` 1409. Played in the original (`020_dj1.png`-`025_dj6.png`). Fact-check `$S/chars/verify/C.md` rows 23-24: the stomp recharge needs a cheat, and line 794 also clears the air jump.
- SI-C9: `Simon.as` 424-429, 515-521; `characters/Character.as` 225, 994-1005.
- SI-C10 to SI-C12: `Simon.as` 83-87, 100-103, 214-215, 299-300, 342-359, 455-462, 892-898, 1086-1127; `Character.as` 1904-1946, 3109-3113; `managers/StatManager.as` 1351-1362; `data/RandomDropGenerator.as` 32-35, 50-57.
- SI-C13: `Simon.as` 209, 938-1006, 1020-1024, 1139-1144, 1319-1320; `Character.as` 144 (`TD_ALPHA` 0.65), 207.
- SI-C14, SI-C18: `Simon.as` 226, 493-514, 900-909, 1206-1253; `utils/GameLoopTimer.as` `update` (remainder carried).
- SI-C15: `Simon.as` 203-207, 702-717.
- SI-C16: `data/DamageValue.as` 72-79; `Simon.as` 724-733; `Character.as` 739-765 (one hit per overlap).
- SI-C17: `Simon.as` 233-234, 290-297; `projectiles/SimonProjectile.as` 60-63; `StatFxStop.as`; `enemies/Enemy.as` 176, 594-626 (pierce checked first); `enemies/Bowser.as` 95 (strength 7); `enemies/Lakitu.as` 67 (strength 10); `main/LevObj.as` 660-673; `level/Level.as` 1858 and 2033 (a stop halts updates, not collisions); `Character.as` 1510-1521 (contact has no stop check).
- SI-C19: `Simon.as` 1145-1160.
- SI-C20 to SI-C24: `SimonProjectile.as` 35-49, 70-142, 144-213, 243-257; `projectiles/Projectile.as` 39-45, 59-152; `data/AnimationTimers.as` 7.
- SI-C25: `Simon.as` 230-233, 446-454, 911-921; `LevObj.as` 195-218.
- SI-C27, SI-C28: `data/HitTester.as` 155-187; `ground/Brick.as` 174-192, 211-235; `Character.as` 344; `level/Level.as` 3781-3816 (ground is hit only when both sides list each other's type, so a projectile without `HT_GROUND_NON_BRICK` ignores solid ground).
- SI-C29: `Simon.as` 430-431, 680-700, 1314-1321.

**Where it lands (ours, `$S/main`):**

- New `src/game/characters/simon/classic.ts`, a `CharacterDef` with the Classic profile, power-state damage model and behaviour.
- New `src/game/characters/simon/classic-weapons.ts` for the five Classic projectile specs and the whip boxes.
- The registry picks it when `rules === 'classic'` (`src/game/characters/registry.ts`). `index.ts` and `weapons.ts` stay untouched.

**Implementation hints:**

- Air control (SI-C6). `Player.airMove` (`player.ts` 452-465) returns early when `dir === 0`, so `instantAccel` alone keeps vx on release. Add an optional profile field (for example `airStop: true`, "no direction in the air sets vx = 0"). It is undefined everywhere today, so Current is unchanged.
- Air jump (SI-C7). Add an optional profile field (for example `airJumps: 1`) and a per-player counter in `Player.update` (`player.ts` 200-228):
  - refill it on any frame on the ground and on a spring launch (`springLaunch`, 510-514);
  - zero it at spawn when airborne;
  - fire on `input.pressed('jump')` in the air, and also in `swim` (295-320) when the profile has no stroke.

  Doing it in the player keeps the jump on the same frame as movement. Simon's `behaviour.update` runs after movement and would lag a frame.
- Facing (SI-C2). Add an optional `turnInAir: false` around `player.ts` 242-245. The Mario/Luigi Classic report needs "no mid-air turn" too, so share the field.
- Rooting (SI-C4). In the Classic behaviour, set `p.body.vx = 0` while the whip or throw timer runs and `p.body.onGround`. Do it before movement, or through a `canWalk` hook. Today's behaviour runs after movement.
- Whip box (SI-C15). Build `activeMelee` from `p.centerX` and `p.feetY`, not from the body edge. Use `px(7.5)` = 1920 sub.
- Damage and hit freeze (SI-C16, SI-C17). Use the HP report's damage source with Simon's numbers. The freeze must not reuse `e.stunned` as it is today: `world.ts` 792-795 skips the update, but 1377 also makes stunned enemies harmless. Classic needs a freeze that skips update and animation and keeps contact damage, in the one place the HP report defines.
- Whip and weapons vs blocks (SI-C27, SI-C28). Use the bricks report's shared "weapon strikes block" call, with `canBreakBricks: () => false` for the head.
- Cross (SI-C22). Do not use `returns` and `steerTo` (`projectile.ts` 213-223). Give the Classic Cross its own update:
  - a straight run to x0 + 110 px;
  - deceleration at 0x0018E per frame;
  - a horizontal return capped at 0x01AAB;
  - catchable only after it turns.
- Stopwatch (SI-C25). Freeze `world.enemies` and enemy projectiles, regardless of the camera, for 180 f.
- Heart counts, the HUD and hearts at death go through the power-states report's Classic HUD.
- Keep everything behind `ctx.rules`, read at level start or respawn.

**Acceptance checks** (headless sims, `rules = 'classic'`, `char = simon`):

1. Walk: vx is ±0x01400 on the first held frame and 0 on the first released frame, on the ground and in the air.
2. Standing jump: the apex is 50-52 px above the start (constants `0x04800` and `0x00355`). Air jump at the apex: about 102 px. A third press does not change vy.
3. Walk off a ledge and press jump while falling: vy becomes −0x04800. Spawn in the air (pipe exit): a jump press before landing does nothing.
4. Jump straight up and hold right for 10 frames from the apex: x grows by 12.5 px. Release: x does not change on the next frame.
5. Whip on the ground while holding right: x does not change for 21 frames. The melee box exists only on frames 14-20, and spans centre +7.5 to +36 px (Flower: +51 px).
6. Leather whip on a Goomba: the first hit leaves it alive and frozen for exactly 24 frames, and the second hit kills it. Morning Star: 1 hit. A stopped (hit-stunned) Goomba still hurts Simon on contact.
7. Whip a brick from a jump: the brick breaks. Jump into the brick from below: it bumps and stays.
8. Throw the Axe: hearts 10 → 9 at frame 14, not at the press; the apex is about 50 px above the spawn point. Flower + Select: hearts −2; the Cross turns back after about 124 px and is removed on touching Simon.
9. Stopwatch (`&kit=full`, Select to the Stopwatch): hearts −5 with no enemies on screen, and an off-screen Goomba does not move for 180 frames.
10. Mushroom then Flower, then a hit: back to small with the Leather whip, cap 1, Select inert, Axe kept, hearts unchanged. A second hit kills. After death, hearts are 10.
11. Current unchanged: every existing test and headless sim passes with `rules = 'current'`, and `?dev=1&level=1-1&char=simon` measures walk 1.0 px/f and an apex of 67-68 px as today.

**Confidence:**

- Played in the original: the air jump (about double height), the default air steering (moves when held in the air, stops when released) and the 10 starting hearts.
- From source, exact: every constant, timing and rule above.
- Computed: apex heights (formula and our integrator), the Cross overshoot (about 14 px) and the frame counts from ms (115 ms steps at 7, 14 and 21 f; 400 ms = 24 f; 1170 ms ≈ 70 f).
- Played in ours: walk 1.0 px/f, apex 67-68 px, walking while whipping, throw costs. Not played in the original: whip vs bricks, the hit freeze, sub-weapon paths, the Stopwatch.

**Open questions** (a playtest of the original settles each; use the default meanwhile):

1. Does a stopped enemy (hit freeze or Stopwatch) still hurt Simon on contact? The source says yes: the freeze stops updates, not collisions, and `Character.hitEnemy` has no stop check. Default: yes.
2. The Dagger passes through solid non-brick ground by source (only `HT_BRICK` is hit-testable). FINAL-REPORT C4 lists only the Axe and Cross for Simon. Default: the Dagger passes through, as in SI-C23. Tell the bricks-report writer.
3. Does the Holy Water flame break bricks it touches after the burst? By source it keeps `HT_BRICK` and re-hits every 400 ms for 200 damage. Default: yes, as in SI-C28.
4. Should enemies that spawn during a Stopwatch freeze be frozen? By source, no (they missed the start event). Default: no.
5. The apex is 53.2 px by formula and 50.9 px stepped in the original's order, which `0x04800` reproduces in ours (SI-C5). Default: use `0x04800`; do not tune to a height.

**Out of scope here** (see `2026-10-07-classic-follow-ups.md`):

- the "Classic Simon" cheat;
- the Customize Weapons menu (other start and extra weapons);
- the 19 skins, including the Castlevania II hit flash and sounds;
- the level helpers the original shows for `poorBowserFighter` and `BadSwimmer` heroes (`Simon.as` 289; `Level.as` 126, 782-784).

**Related reports:**

- [2026-10-07-dev-classic-smbc-rules-toggle.md](2026-10-07-dev-classic-smbc-rules-toggle.md): the toggle, build order.
- [2026-10-07-classic-power-states.md](2026-10-07-classic-power-states.md), [2026-10-07-classic-enemy-hp-and-armour.md](2026-10-07-classic-enemy-hp-and-armour.md), [2026-10-07-classic-bricks-and-shots.md](2026-10-07-classic-bricks-and-shots.md), [2026-10-07-classic-swimming.md](2026-10-07-classic-swimming.md).
- `2026-10-06-simon-no-air-control-after-green-spring.md` (open). It is about Current: Simon cannot steer after a green spring. In Classic it cannot happen, because SI-C6 gives air control after every launch. The report stays open for Current and is not fixed by this work.
- `2026-10-06-water-non-mario-heroes-stroke.md` (open): Simon's stroke. Classic removes it for Simon (SI-C9).
- `2026-10-06-water-surface-air-physics.md` (open): water surface behaviour, which also affects Simon's water jumps.
