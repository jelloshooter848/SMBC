# Classic SMBC enemy rules: hit points, numeric damage, armour, hit-stun and Bowser's three forms

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=<id>` (once the toggle exists; today `?dev=1&level=1-1&char=<id>` shows the Current behaviour)
- **Character and power:** all heroes (Mario, Luigi, Link, Samus, Simon, Mega Man, Bill, Ryu), all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=megaman` (Current). Shoot the first Goomba (column 22): one shot kills it.
2. Open `?dev=1&level=1-4&char=link` (Current). Reach Bowser and stab him: he dies on the 5th hit.
3. Open `?dev=1&rules=classic&level=1-1&char=megaman` (Classic, once built). Shoot the same Goomba: it dies on the
   **3rd** shot, and only the 3rd shot scores (100). Shoot the Koopa near column 107: it pulls into its shell on the
   **4th** shot and dies on the **6th**.
4. Open `?dev=1&rules=classic&level=1-1&char=link`. Stab the Goomba: it freezes in place for 24 frames and dies on the
   2nd stab. Walk into it while it is stopped: Link is hurt (HP-C18).
5. Open `?dev=1&rules=classic&level=ll-4-1&char=samus` and reach the Buzzy Beetle in the water area. Shoot it with the
   beam: the shot ends with the bullet-proof sound and the Beetle is unhurt. Fire a missile: it takes damage.
6. Open `?dev=1&rules=classic&level=1-4&char=link` with `&kit=full` (or reach the Flower). Bowser now needs 6 stabs
   with the Magic Sword (2400 HP). As Mario in Classic he still takes 5 fireballs.

## Expected

All of this is one shared system. It runs only while `world.rules === 'classic'`. Units: frames at 60 fps; ms ÷ 16.67
= frames. Damage and HP are in the original's own units (a Goomba has 250); they are pure counters and need no
conversion. "The original" is SMBC 3.1.21 with default settings (Attack Strength Normal, no cheats).

### Where it lives

- **HP-C1 One door.** `Enemy.hit` (`entities/enemies/enemy.ts:86-125`) is the only door for damage to enemies (TG-24).
  Its first line becomes `if (world.rules === 'classic') return classicHit(this, src, world);`. The table and logic
  live in a new `src/game/rules/classic-enemies.ts`. Keep the Classic HP counter in its own field (for example
  `classicHp`), apart from `Enemy.hp`, which Current Bowser uses (`bowser.ts:105`).
- **HP-C2 The damage source.** `DamageSource` (`rules/damage.ts:34-42`) gets these optional fields. Only Classic code
  sets or reads them:
  - `amount`: the damage in the original's units (table HP-C9). Current keeps sending 1-5.
  - `pierce?: number`: armour-pierce strength. 0 when absent.
  - `stopFrames?: number`: the hit-stun this hit applies (HP-C16).
  - `flashFrames?: number`, `invulnFrames?: number`, `freezeFrames?: number` (HP-C16).
  - `instant?: true`: the kill-anything sources (HP-C7). They bypass HP and armour.
  - The melee source is fixed at `{ kind: 'sword', amount: 1 }` today (`world.ts:1269`). Classic defs supply theirs
    through the optional `CharacterBehaviour.meleeDamage?(p, e)` hook (TG-24).

### Enemy hit points

- **HP-C3 HP table.** Every enemy our levels use, with the original's values (`HealthValue.as:5-30`):

  | Enemy (ours) | Original class | HP | Armoured | Hit-stun immune | Ice-freeze immune |
  |---|---|---|---|---|---|
  | Goomba | `Goomba` | 250 | no | no | no |
  | Koopa, green and red (`koopa-green`, `koopa-red`) | `KoopaGreen`, `KoopaRed` | 600 | no | no | no |
  | Paratroopa, green and red (`koopa-para-*`) | `KoopaGreen` / `KoopaRed` in the fly state | 900 | no | no | no |
  | Buzzy Beetle (`buzzy`) | `Beetle` (extends `KoopaGreen`) | 600 | **yes** | no | no |
  | Spiny and Spiny egg | `Spiney` (extends `Goomba`) | 350 | **no** | no | no |
  | Bullet Bill | `BulletBill` | 400 | **yes** | no | no |
  | Lakitu | `Lakitu` | 800 | no | **yes** | **yes** |
  | Hammer Bro | `HammerBro` | 800 | no | no | no |
  | Piranha Plant, up and down (`piranha`, `piranha-down`) | `PiranhaGreen`, `PiranhaRed` | 275 | no | no | no |
  | Cheep Cheep, swimming (`cheep-grey`, `cheep-red`) | `CheepSlow`, `CheepFast` | 300 | no | no | no |
  | Cheep Cheep, leaping (bridge levels) | `CheepFlying` | 200 | no | no | no |
  | Blooper | `Bloopa` | 600 | no | no | no |
  | Bowser, fire only (`attack=fire`, the default) | `Bowser` | 2400 | no | **yes** | **yes** |
  | Bowser, hammers only (`attack=hammer`) | `Bowser` | 3600 | no | **yes** | **yes** |
  | Bowser, fire and hammers (`attack=both`) | `Bowser` | 4400 | no | **yes** | **yes** |
  | Bowser, any form, while the hero is Mario or Luigi | `Bowser` | 5000 (5 × 1000) | no | **yes** | **yes** |
  | Fake Bowser (`fake=1`) | `BowserFake` (extends `Bowser`) | same as the real one of that form (3600 for our three `attack=hammer` fakes) | no | **yes** | **yes** |
  | Podoboo, fire bars, Bowser's flames, hammers | projectiles | cannot be hurt (as today) | — | — | — |
  | Brick | `Brick` | 125 (see `2026-10-07-classic-bricks-and-shots.md`, BR-C) | — | — | — |

  Not in our levels, listed so the table is complete: Spike Top 600 (armoured), Barrel 400 (armoured), Crab 600 (not
  armoured: its armour line is commented out, `Crab.as:34`), Fly 350, Icicle 25. `HealthValue.BOWSER_FAKE` (3600) is
  never read; a fake Bowser takes its form's value.
- **HP-C4 Bowser's form.** Pick his HP when he spawns (`Bowser.overwriteInitialStats`, `Bowser.as:181-201`):
  - if the hero is Mario or Luigi: 5000, whatever the form;
  - else `attack=fire`: 2400; `attack=hammer`: 3600; `attack=both`: 4400.
  - Our level files already carry the original's Normal-difficulty forms: fire in 1-4 to 5-4 and ll-1-4 to ll-5-4;
    hammer in 6-4, 7-4, ll-6-4, ll-7-4, ll-10-4, ll-11-4, ll-12-4, ll-13-4 (real and fake), ll-9-3 (fake) and the
    ll-8-4 fake; both in 8-4 and the real ll-8-4 Bowser. No level data changes.
  - Two players: use player 1's hero at the moment Bowser spawns (see Open questions).
- **HP-C5 The damage rule.** Each hit that gets through: `hp -= floor(amount × 1.0)` (`Enemy.takeDamage`,
  `Enemy.as:571-579`; Attack Strength Normal is ×1, `AttackStrength.as`, `GameSettings.as:131`). The enemy dies when
  `hp <= 0`. Damage is never carried over and never restored: an enemy keeps its lost HP while it walks, hides in a
  shell, comes out again, or leaves and re-enters the screen. A respawned enemy starts full.
- **HP-C6 Koopas and Buzzy Beetles change state with HP** (`KoopaGreen.takeDamage`, `KoopaGreen.as:133-146`). After a
  hit that does not kill:
  - HP ≤ 200 while flying or walking: it pulls into its shell, exactly as after a stomp (shell timers, legs, wake-up).
    No points.
  - Otherwise, a flying Paratroopa with HP ≤ 600 loses its wings and walks. No points.
  - A shell made this way is the same shell: any hero kicks it by touching it, as today. It does **not** heal: when it
    walks out it keeps its HP, so the next hit of 200 or less sends it back in, and enough damage kills it.
  - A stomp on a Koopa (Mario and Luigi only) does not change its HP (`KoopaGreen.stomp`, `:237-249`).
  - Example, Link's first sword (200) against a Paratroopa (900): 700 still flying, 500 walking, 300 walking,
    100 shell, dead on the 5th stab.

### Instant kills (kept)

- **HP-C7** These kill outright, ignore HP and armour, and score as listed in HP-C21:
  - **Stomp** (Mario and Luigi only, HP-C22): Goomba, Bullet Bill, Lakitu, Hammer Bro, Cheep and Blooper (when
    stompable) die; Koopas and Buzzy Beetles go into the shell; Paratroopas lose their wings. As today.
  - **Star** touch: kills every enemy, **including Bowser** (`Enemy.hitCharacter`, `Enemy.as:784-794`; `Bowser` does not
    override it). Bowser scores `BOWSER_STAR` = 5000. Current Bowser is star-immune (`bowser.ts:115`); Classic changes
    that.
  - **Kicked shell**: kills every enemy it touches (`KoopaGreen.hitEnemy` calls `enemy.die()`, `KoopaGreen.as:439-494`),
    armoured ones and Bowser included, with the shell-kick sequence score. Current Bowser is shell-immune
    (`bowser.ts:116`); Classic changes that.
  - **Block bumped from below**: kills what stands on it (`Enemy.gBounceHit`, `:580-585`), except Koopas, Beetles and
    Spinies, which pop up as today.
  - **Samus's Screw Attack**: damage `int.MAX/4` with pierce 10 (`DamageValue.as:64`, `Samus.as:321, 560-569`), so it kills
    anything it touches except Bowser, who is skipped (touching him still hurts her).
  - **Mario's fireball** is not special-cased: it is 1000 damage, so it kills every unarmoured enemy in one hit
    (Paratroopa 900, Hammer Bro 800) and takes Bowser in 5. Against armour it is blocked (HP-C13).

### Damage per weapon

- **HP-C8 Hits to kill by damage value** (HP-C5; armoured enemies only when the weapon pierces):

  | Enemy | HP | 100 | 125 | 150 | 200 | 225 | 275 | 300 | 350 | 400 | 800 | 1000 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Goomba | 250 | 3 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 1 |
  | Piranha Plant | 275 | 3 | 3 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 1 |
  | Cheep, swimming | 300 | 3 | 3 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 |
  | Cheep, leaping | 200 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
  | Spiny | 350 | 4 | 3 | 3 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 |
  | Bullet Bill (armoured) | 400 | 4 | 4 | 3 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1 |
  | Koopa, Buzzy Beetle (armoured), Blooper | 600 | 6 | 5 | 4 | 3 | 3 | 3 | 2 | 2 | 2 | 1 | 1 |
  | Hammer Bro, Lakitu | 800 | 8 | 7 | 6 | 4 | 4 | 3 | 3 | 3 | 2 | 1 | 1 |
  | Paratroopa | 900 | 9 | 8 | 6 | 5 | 4 | 4 | 3 | 3 | 3 | 2 | 1 |
  | Bowser, fire | 2400 | 24 | 20 | 16 | 12 | 11 | 9 | 8 | 7 | 6 | 3 | — |
  | Bowser, hammers | 3600 | 36 | 29 | 24 | 18 | 16 | 14 | 12 | 11 | 9 | 5 | — |
  | Bowser, both | 4400 | 44 | 36 | 30 | 22 | 20 | 16 | 15 | 13 | 11 | 6 | — |
  | Bowser vs Mario / Luigi | 5000 | — | — | — | — | — | — | — | — | — | — | 5 |

- **HP-C9 Weapon damage per hero** (`DamageValue.as:12-79`). The hero reports own the rest of each weapon (speed,
  reach, timing, caps). "Default kit" is what the original's default Customize Weapons choices give in Classic.

  | Hero | Weapon | Damage | Pierce strength | In the default kit | Hero report |
  |---|---|---|---|---|---|
  | Mario, Luigi | Fireball | 1000 | 0 | Flower | `2026-10-07-mario-luigi-classic-smbc-rules.md` |
  | Link | Sword: small / Mushroom / Flower (Magic Sword) | 200 / 275 / 400 | 0 | yes | `2026-10-07-link-classic-smbc-rules.md` |
  | Link | Up- and down-thrust | as the sword | 0 | yes | same |
  | Link | Sword beam (Flower, Red Ring) | 200 | 0 | Flower | same |
  | Link | Bomb blast | 800 | 10 | Mushroom (Classic weapon) | same |
  | Link | Boomerang | 0 (stun only) | 10 | yes | same |
  | Link | Arrow | 350 | 0 | no (option) | same |
  | Samus | Short and Long Beam | 150 | 0 | yes / Mushroom | `2026-10-07-samus-classic-smbc-rules.md` |
  | Samus | Wave Beam | 225 | 0 | Flower | same |
  | Samus | Ice Beam | 125 | 0 | no (option) | same |
  | Samus | Missile | 400 | 10 | Mushroom | same |
  | Samus | Morph-ball bomb | 400 | 0 | yes | same |
  | Samus | Screw Attack | kills (HP-C7) | 10 | Flower | same |
  | Simon | Whip: Leather / Morning Star / Flame Whip | 200 / 275 / 400 | 0 | yes | `2026-10-07-simon-classic-smbc-rules.md` |
  | Simon | Axe / Cross | 350 / 300 | 0 | Axe at start, Cross on Select with the Flower | same |
  | Simon | Dagger | 300 | 0 | no (option) | same |
  | Simon | Holy Water: bottle / flame | 50 / 200 | 6 | no (option) | same |
  | Mega Man | Mega Buster | 100 | 0 | yes | `2026-10-07-megaman-classic-smbc-rules.md` |
  | Mega Man | Weak / full Charge Shot | 200 / 300 | 0 | Mushroom | same |
  | Mega Man | Metal Blade | 150 | 0 | Flower | same |
  | Bill | Rifle | 100 | 0 | yes | `2026-10-07-bill-classic-smbc-rules.md` |
  | Bill | Machine Gun | 125 | 0 | Mushroom | same |
  | Bill | Spread (per bullet) | 125 | 0 | Flower | same |
  | Bill | Flare / Laser | 200 / 100 | 6 / 0 | no (option) | same |
  | Ryu | Sword | 400 | 0 | yes | `2026-10-07-ryu-classic-smbc-rules.md` |
  | Ryu | Jump Slash | 800 | 0 | no (option) | same |
  | Ryu | Shuriken / Windmill Shuriken | 300 / 300 | 0 / 6 | Shuriken at start, Windmill on Select with the Flower | same |
  | Ryu | Fire Wheel / Fire Dragon Ball | 400 / 400 | 0 / 6 | no (option) | same |

  Every "no (option)" weapon is still built; it is reached only through the dev `&kit=full` (TG-44).

- **HP-C10 Attack Strength** stays at its default, Normal (×1.0). Classic has no setting for it (More Settings is out of
  scope, `2026-10-07-classic-follow-ups.md`). Put the multiplier in one constant (`CLASSIC_ATTACK_MULT = 1`) so the
  follow-up can expose ×0.66 / ×0.75 / ×1.75 / ×3.
- **HP-C11 Samus's hit makes the enemy invulnerable for 150 ms (9 f)** (`Samus.as:239, 300`; `StatFxInvulnerable`).
  During those 9 frames **no** attack from anyone damages that enemy (`Enemy.checkAttackProps`, `Enemy.as:596-597`).
  Her bombs do not apply it (`SamusBomb.as:46`).

### Armour

- **HP-C12 Who is armoured.** Armour strength 5 (`PIERCE_STR_ARMORED`, `LevObj.as:89`) on **Buzzy Beetle**
  (`Beetle.as:24`), **Bullet Bill** (`BulletBill.as:54`), Spike Top (`SpikeTop.as:24`) and Barrel (`Barrel.as:22`).
  **Spiny and Crab are not armoured** (`Spiney.as` and `Crab.as` add none). No other enemy is.
- **HP-C13 What pierces.** A hit gets through armour when its pierce strength is ≥ 5
  (`LevObj.isSusceptibleToProperty`, `LevObj.as:660-673`):
  - **Pierce 10:** Samus's missiles (`SamusShot.as:127`) and Screw Attack (`Samus.as:321`); Link's bombs
    (`LinkProjectile.as:97`) and boomerang (`LinkBoomerang.as:52`).
  - **Pierce 6** (`PIERCE_STR_ARMOR_PIERCING`): Bill's Flare (`BillBullet.as:229`), Ryu's Windmill Shuriken and Fire
    Dragon Ball (`RyuProjectile.as:131, 156`), Simon's Holy Water (`SimonProjectile.as:122`).
  - **Pierce 0 (blocked):** everything else. That includes Mario's fireball, every sword, whip and slash, every beam
    (Short, Long, Wave, Ice), Samus's bombs, the Mega Buster and both Charge Shots, Metal Blade, all of Bill's guns
    except the Flare, the Shuriken, the Fire Wheel, the Axe, the Cross, the Dagger and the arrows.
  - The instant kills of HP-C7 (stomp, Star, shell, bump, Screw Attack) do not test armour.
- **HP-C14 A blocked hit** (`Enemy.checkAttackProps` returns false, `Enemy.as:622-623`; `Projectile.confirmedHit`,
  `Projectile.as:135-151`):
  - no damage, no hit-stun, no flash, no score;
  - Ice Beam is the exception: its freeze is applied **before** the armour test (`Enemy.as:598-608`), so it freezes a
    Buzzy Beetle or Bullet Bill (HP-C17) without damage;
  - what the weapon does and sounds like:

    | Weapon | What happens to the weapon | Sound |
    |---|---|---|
    | Mario's fireball | explodes on the spot (`MarioFireBall.as:110-117`) | the block-bump sound (`bump`) |
    | Link's sword, up- and down-thrust | the swing goes on; a down-thrust still bounces him, an up-thrust still stops his rise (`Link.as:1143-1164`) | armour clink (`SFX_LINK_HIT_ENEMY_ARMOR`) |
    | Link's sword beam, arrow | removed (the beam shows its 4-way burst) (`LinkProjectile.as:237-255`) | armour clink |
    | Samus's beams | the shot ends (`SamusShot.as:261-284`) | "bullet-proof" (`SFX_SAMUS_BULLET_PROOF`) |
    | Samus's bomb | the blast goes on, no effect | none |
    | Simon's whip | the swing goes on, no effect | none (his armour sound is commented out, `Simon.as:751-756`) |
    | Simon's Axe, Cross | keep flying | none |
    | Simon's Dagger | removed | none |
    | Mega Buster, Metal Blade | **deflected**: vx reversed, vy −2.9167 px/f (350 px/s, `MegaManProjectile.as:103, 852-877`), and it can no longer hit anything | deflect (`SFX_MEGA_MAN_DEFLECT`) |
    | Mega Man's Charge Shots | removed | deflect |
    | Bill's bullets | the bullet bursts (`BillBullet.as:561-565`) | none |
    | Ryu's sword | the swing goes on | armour (`SFX_RYU_ATTACK_ARMOR`, `Ryu.as:1120-1125`) |
    | Ryu's Shuriken, Fire Wheel | removed | armour (`RyuProjectile.as:357-362`) |

  - Sounds: add **one** new sfx of our own, `armour` (a short high metallic tick). Use it for Link's clink, Samus's
    bullet-proof sound, Mega Man's deflect and Ryu's armour sound. Mario's fireball uses the existing `bump`. Simon,
    Samus's bomb and Bill play nothing.

### Hit-stun and freeze

- **HP-C15 Which enemies resist.** A hit-stun or freeze applies only if the hit got through armour (HP-C13), and only
  to an enemy that does not resist it:
  - **Lakitu** resists hit-stun, boomerang stun and Ice freeze (`Lakitu.as:67-68`).
  - **Bowser and fake Bowser** resist them all (`Bowser.as:95-96`). Only Simon's Stopwatch (strength 7) stops Bowser; see
    the Simon report.
  - Everyone else (Hammer Bros and Piranha Plants included) takes them.
- **HP-C16 Per weapon.** "Stop" means the enemy does not move, animate or run its timers (`StatFxStop`). A new stop
  replaces a running one only if it leaves more time (`StatFxStop.checkIfReplaceWithSameType`).

  | Source | Stop | Other effect | Source file |
  |---|---|---|---|
  | Mario's fireball | none | none | `MarioFireBall.as` |
  | Link: sword, thrusts, beam, arrow, bomb | **400 ms = 24 f** | flashes for 24 f | `Link.as:325-336`, `LinkProjectile.as:57-60` |
  | Link: boomerang | **3000 ms = 180 f**, but the enemy keeps animating | 0 damage; pierce 10, so it stops armoured enemies too | `LinkBoomerang.as:51-52` |
  | Samus: beams, missiles, Screw Attack | **150 ms = 9 f** | flashes 9 f; invulnerable 9 f (HP-C11) | `Samus.as:296-305`, `SamusShot.as:75-78` |
  | Samus: bomb | **9 f** | flashes 9 f; no invulnerability | `SamusBomb.as:41-46` |
  | Samus: Ice Beam (option) | freeze, 6000 ms = **360 f** | see HP-C17 | `SamusShot.as:158`, `Samus.as:237` |
  | Simon: whip and every sub-weapon | **400 ms = 24 f** | none (the flash is only for a Castlevania II skin) | `Simon.as:284-296`, `SimonProjectile.as:60-63` |
  | Mega Man: every weapon | none | the enemy blinks invisible for 40 ms = **2 f** | `MegaManBase.as:352-359` |
  | Bill: every gun | none | none | `BillBullet.as` |
  | Ryu: sword, Jump Slash, every ninpo | none | flashes for 400 ms = **24 f**; it keeps moving | `Ryu.as:298-305`, `RyuProjectile.as:77-80` |

- **HP-C17 Freeze (Ice Beam, option only).** The Ice hit that freezes does **no damage**, armoured or not
  (`Enemy.as:604-608` returns before damage). On Lakitu and Bowser, which resist freezing, it deals its 125 as usual.
  The enemy stops for 360 f and flashes for the last 1250 ms (75 f). It no
  longer touches players at all (`StatFxFreeze` removes its character hit test), and an invisible one-tile block sits
  on its top, so players can stand on it. The next hit from Samus thaws it and then deals its damage as usual
  (`PR_UNFREEZE_AGG`, `Samus.as:301`; `Enemy.as:599-603`). Another Ice shot on a frozen enemy thaws it and deals 125.
  Melee cannot reach a frozen enemy (the attack test needs the same character hit test). Not in the
  default kit; build it, reached through `&kit=full` (TG-44, SA-C11).
- **HP-C18 A stopped enemy still hurts.** Contact with a hit-stunned or boomerang-stunned enemy hurts the player as
  usual. The original's only skip is for a legacy `Enemy.stunned` flag that nothing sets (`HitTester.as:127`,
  `Enemy.as:110`), and `Character.hitEnemy` has no check (`Character.as:1510-1522`). In Classic, the Current skip
  `if (e.stunned > 0) return;` (`world.ts:1377`) does not apply to hit-stun or boomerang stun. Only a frozen enemy
  (HP-C17) is harmless.
- **HP-C19 Stun does not kill.** The Current "a second freezing hit shatters it" and "any later hit kills a stunned
  enemy" (`enemy.ts:111-119`) do not exist in Classic. A stunned or frozen enemy takes normal damage from each hit.
- **HP-C20 Ryu's Windmill re-hits.** It hits an enemy again only after leaving and re-entering it, and never twice
  within 250 ms (15 f) on enemies with a separate attack box (`Enemy.as:97-99, 162-163`; `RyuProjectile.as:322-345`).
  Detail in the Ryu report.

### Score

- **HP-C21 A multi-hit kill scores the same as a one-hit kill.** Only the killing hit scores, once, with the enemy's
  ATTACK value (`Enemy.takeDamage`, `Enemy.as:571-579`). Hits that don't kill score nothing, and nor does a Koopa
  pulled into its shell by damage or a Paratroopa losing its wings. The values do not change: they are our
  `ENEMY_SCORES` (`rules/score.ts:17-34`), which already mirror `ScoreValue.as`. Stomp, Star, bump and shell scores are
  as today; a Star kill of Bowser scores 5000. Our `scoreKill` (`world.ts:688-691`) already scores an HP kill once.

### Stomping and landing on enemies

- **HP-C22 Only Mario and Luigi stomp.** Confirmed from source: `Character._canStomp` is false by default
  (`Character.as:338`) and is set true only by `MarioBase` (`MarioBase.as:278, 371`) and `Mario.bounce`
  (`Mario.as:125`). `Enemy.stomp` returns at once when `!player.canStomp` (`Enemy.as:220`), and `canStomp` is true for
  anyone else only with the Everyone Can Stomp cheat (`Character.as:3247-3256`). Mario and Luigi cannot stomp under
  water (`canStompUnderWater = false`, `MarioBase.as:279`; see the Mario and Luigi report). Our defs already match:
  `stomps: true` only for Mario and Luigi (`mario/index.ts:159`, `luigi/index.ts:22`).
- **HP-C23 Another hero who lands on an enemy takes a hit** (`Character.hitEnemy`, `Character.as:1510-1522`), with
  these exceptions, in this order:
  1. with a Star, the enemy dies (HP-C7);
  2. a still Koopa or Buzzy shell, or a shell in its post-kick no-hit window, is not a hit: a still shell is kicked
     (as today, `world.ts:1378`);
  3. Link's down-thrust attacks the enemy instead (sword damage, then he bounces; `Link.as:1106-1111`);
  4. Ryu's Jump Slash attacks the enemy instead (800; `Ryu.as:705-711`);
  5. Samus's Screw Attack kills it (not Bowser; `Samus.as:560-569`);
  6. Mega Man's Charge Kick slide attacks it (350; not in the default kit, `MegaManBase.as:1698-1704`).

  Otherwise the hero takes damage, from above exactly as from the side. The power-states report (PS-C) defines what
  the hit does.

### Feel

- **HP-C24** Classic enemies are tough: a Mega Man or Bill rifle needs 3 shots for a Goomba and 6 for a Koopa, and the
  Magic Sword needs 6 stabs for the fire Bowser. Link's and Simon's hits freeze the enemy for a beat, Samus's for a
  flicker. Armour is absolute: the wrong weapon simply does nothing. Do not soften any of it in Classic.

## Actual

Current (stays the default, unchanged):

- Damage is a reaction table, not HP. `BASIC_VULNERABILITY` (`rules/damage.ts:44-58`) makes almost every damage kind
  `'kill'`; `Enemy.hit` (`entities/enemies/enemy.ts:86-125`) applies it. Every enemy has `hp = 1` (`enemy.ts:42`).
- Bowser has `hp = 5` for every hero and form, takes `'hp'` from fireball, buster, sword, bomb and weapon, and is immune
  to the Star and to shells (`bowser.ts:105-122`).
- Armour is partial: Buzzy Beetles ignore only the fireball (`koopa.ts:93-95`); Bullet Bills ignore the fireball,
  boomerang and ice (`bullet-bill.ts:34`). Every sword, beam, bullet and buster kills both.
- No hit-stun. The boomerang and ice give a 180-frame `'stun'` (`STUN_FRAMES`, `damage.ts:61`); a second freezing hit or
  any later hit kills (`enemy.ts:111-119`), and a stunned enemy is harmless to touch (`world.ts:1377`).
- Melee always sends `{ kind: 'sword', amount: 1 }` (`world.ts:1264-1276`). Shots use their spec's kind and amount
  (`world.ts:1389-1437`).
- Stomping is already Mario and Luigi only (`stomps`, `characters/character.ts:111`); other heroes landing on an enemy
  are hurt (`world.ts:1343-1387`). That part matches.

## How often

every time

## Notes

- **Sources.**
  - Original: `com/smbc/data/HealthValue.as:5-30`, `DamageValue.as:10-92`; `enemies/Enemy.as` (`stomp` 218-307, `die`
    321-398, `confirmedHitProj` 556-570, `takeDamage` 571-579, `gBounceHit` 580-585, `hitByAttack` 586-593,
    `checkAttackProps` 594-660, `hitCharacter` 784-794); `main/LevObj.as:89-90, 660-673`;
    `explodingRabbit/cross/gameplay/statusEffects/StatusProperty.as:39-41` (pierce is tested first);
    `StatFxStop.as`, `StatFxFlash.as`, `StatFxInvulnerable.as`, `StatFxFreeze.as`, `StatFxTransparent.as`;
    `projectiles/Projectile.as:135-151`; `enemies/KoopaGreen.as:43-44, 113-146, 237-280, 398-494`;
    `enemies/Bowser.as:95-102, 181-201`; `enemies/BowserFake.as`; `enemies/Lakitu.as:67-69`; the armour lines in
    `Beetle.as:24`, `BulletBill.as:54`, `SpikeTop.as:24`, `Barrel.as:22`; `characters/Character.as:338, 739-767,
    1510-1522, 3247-3256`; `data/HitTester.as:122-137`; `enums/AttackStrength.as`; `data/GameSettings.as:131, 240`;
    Bowser forms per level from `assets/documents/levelDataSmb.xml` and `levelDataLostLevels.xml` (Normal difficulty).
  - Ours: `src/game/rules/damage.ts:34-61`, `src/game/entities/enemies/enemy.ts:42, 86-125`,
    `src/game/entities/enemies/bowser.ts:105-122`, `koopa.ts:93-99, 140`, `bullet-bill.ts:34`, `piranha.ts:64-77`,
    `src/game/world/world.ts:601, 688-691, 1264-1276, 1343-1387, 1389-1437`, `src/game/rules/score.ts:17-34`.
- **Implementation hints.**
  - `src/game/rules/classic-enemies.ts`: `CLASSIC_HP` keyed by enemy kind (plus Koopa wings, Cheep `flying`, Bowser
    `attack`), `ARMOURED = { buzzy, 'bullet-bill' }` at strength 5, `STOP_IMMUNE = { lakitu, bowser }`, and
    `classicHit(enemy, src, world): Reaction`. It returns the existing reactions so `scoreKill` keeps working:
    `'kill'`/`'flip'` on death, `'hp'` on a hit that lands, `'shell'` when HP-C6 shells it, and a new `'blocked'` for
    HP-C14 (treated like `'immune'` by callers, but the weapon gets the blocked behaviour).
  - Hit-stun: give `Enemy` a `stopFrames` counter (the world skips `update()` while it is above 0, as it does for
    `stunned`, but contact still hurts) and a `flashFrames` counter for drawing. Keep Current's `stunned` as it is.
  - Each Classic weapon spec carries `amount`, `pierce`, `stopFrames` and `onBlocked: 'burst' | 'deflect' | 'continue'
    | 'remove'` plus a blocked sfx. Melee sources come from `meleeDamage`.
  - Bowser: compute HP once in `classicHit` on the first hit, from `world.players[0].def.id` and `attack`.
- **Acceptance checks** (headless, `rules: 'classic'` in `WorldStart`, TG-14):
  - Mega Buster vs Goomba: 3 hits, 100 points on the 3rd only. Vs Koopa: shell after the 4th, dead on the 6th.
  - Link sword levels vs Paratroopa: 5 / 4 / 3 stabs; it walks after losing 300 HP or more.
  - Samus beam vs Buzzy Beetle: HP unchanged after 10 hits; one missile takes it to 200 and shells it; a second kills it.
  - Bill rifle vs Bullet Bill: no effect. Ryu Windmill vs Bullet Bill: 2 passes kill it.
  - Mario fireballs vs fire Bowser in 1-4: dead on the 5th. Link Magic Sword vs the same Bowser: 6. Simon Flame Whip vs
    8-4 Bowser (4400): 11.
  - Star touch kills Bowser (5000 points). A kicked shell kills a Hammer Bro and Bowser.
  - Link sword on a Goomba: its x does not change for 24 frames after the hit; touching it in that window hurts Link.
    The same on Lakitu: Lakitu keeps moving.
  - Mega Buster on a Buzzy Beetle: the shot's vx flips sign and vy is −0x02EAB on the next frame.
  - Current: run the existing suites unchanged (`?dev=1` without `rules`); Bowser still dies to 5 hits of anything.
- **Confidence.** All of it is from source. None of it was played in the original (Ruffle is too slow). The hit counts
  are computed. The blocked-hit sounds are named from the code; their sound is not heard.
- **Open questions.**
  1. Two players with different heroes: Bowser's HP is chosen once, from player 1's hero (default). The original is
     one player only.
  2. Star and kicked shell against Bowser: source says both kill him. It was not played. Default: build it as the
     source says.
  3. Hit-stun on an enemy in mid-air (a leaping Cheep, a hopping Paratroopa): the stop also stops its gravity, so it
     hangs in place for 24 f. Default: do that.
  4. The new `armour` sfx is ours; the four heroes' original sounds differ. Default: one shared sound.
- **Related reports.** `2026-10-07-dev-classic-smbc-rules-toggle.md` (TG-24 puts this behind `Enemy.hit`),
  `2026-10-07-classic-power-states.md` (what a hit does to the hero; drops on kills),
  `2026-10-07-classic-bricks-and-shots.md` (brick HP 125 and which shots reach enemies through ground), every hero
  report listed in HP-C9, `2026-10-07-classic-follow-ups.md` (Attack Strength and the other More Settings). Existing
  open reports that touch the same enemies: `2026-10-05-scoring-fireball-koopa-100.md`,
  `2026-10-05-bump-koopa-spiny-dies.md`, `2026-10-05-shell-no-hit-window-protects-all-players.md`.
