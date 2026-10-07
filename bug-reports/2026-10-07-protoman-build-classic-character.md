# Classic SMBC: add Proto Man and Break Man as Classic Mega Man variants (charge from the start, 2-shot buster while small, double knockback, lower shots)

- **Severity:** feature request (new character, Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=protoman` or `&char=breakman` (once the toggle exists; today `?dev=1&level=1-1&char=megaman` shows the Current behaviour, and `char=protoman` falls back to Mario)
- **Character and power:** Proto Man and Break Man, all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=1-1&char=megaman`. This is Current Mega Man: a 28-HP bar, a charge only with the helmet, 3 buster shots.
2. Once built, open `?dev=1&rules=classic&level=1-1&char=megaman`. Classic Mega Man starts small and can't charge until he takes a Mushroom.
3. Open `?dev=1&rules=classic&level=1-1&char=protoman`. Without a Mushroom, hold Attack for 1.5 s and let go: a full charge shot comes out. Tap Attack quickly: never more than 2 buster shots are on screen.
4. Take a Mushroom and get hit by a Goomba. Proto Man is pushed back about 36 px; Classic Mega Man is pushed back about 18 px.
5. Open the same link with `&char=breakman`. The rules are the same; there is no whistle when he is picked.
6. Set Dev menu → Rules back to Current. Neither hero is on the character select any more.

## Expected

The Classic SMBC spec. Proto Man and Break Man are **Classic Mega Man with four rule changes** (PM-9, PM-11, PM-12, PM-13) and their own look and sound. Every value not listed here is Classic Mega Man's, as specified in `2026-10-07-megaman-classic-smbc-rules.md`. Where this report restates a Classic Mega Man value for the coder's convenience and the Mega Man report gives a different number, the Mega Man report wins: both cite the same source lines.

They use the Classic shared systems: power states (`2026-10-07-classic-power-states.md`), enemy HP and armour (`2026-10-07-classic-enemy-hp-and-armour.md`), bricks and shots (`2026-10-07-classic-bricks-and-shots.md`) and swimming (`2026-10-07-classic-swimming.md`). They appear only while dev mode is on and Rules is Classic SMBC (the TG requirements in `2026-10-07-dev-classic-smbc-rules-toggle.md`).

### 1. Status in 3.1.21

- **Skin only.** Proto Man is not a character in 3.1.21. `ProtoMan.as` is an unused 24-line stub, his `CharacterInfo` row is commented out, and his own six graphics sets are commented out.
- He ships as **six Mega Man skins**: Proto Man NES / SNES / GB (skins 3, 4, 5) and Break Man NES / SNES / GB (skins 8, 9, 19). All six are in `MegaManBase.PROTO_MAN_SKIN = [3, 4, 5, 8, 9, 19]` and get the same rules. The skin menu text is "Can always charge buster, only 2 shots without a mushroom, double knockback".
- **Fidelity.** Every rule is in source and is small. Only the art, music and whistle are missing. There is **no shield** anywhere in the source (see PM-M1).

### 2. Character definition

**PM-1. Two definitions from one factory.** Add two `CharacterDef`s (`src/game/characters/character.ts:103-147`), built by the Classic Mega Man definition with variant options. Every field not in this table is copied from Classic Mega Man.

| Field | Proto Man | Break Man |
|---|---|---|
| `id` | `protoman` | `breakman` |
| `name` | `Proto Man` | `Break Man` |
| `hudName` | `PROTO` | `BREAK` |
| `movement` | Classic Mega Man's profile, unchanged | same |
| `damage` | Classic Mega Man's power-state model, with the knockback of PM-9 | same |
| `stomps`, `crouches` | `false`, `false` | same |
| `canBreakBricks` | Classic Mega Man's (head bumps only; shots break bricks) | same |
| `hitbox` | Classic Mega Man's function | same |
| `sprite` | Classic Mega Man's function, with palette prefix `protoman` | prefix `breakman` |
| `blockPowerUp`, `drop`, `tools`, `meter`, `devKit` | Classic Mega Man's | same |
| `jumpSfx` | Classic Mega Man's | same |
| `portrait` | `{ sheet: 'megaman', palette: 'protoman', frame: 'idle' }` | `palette: 'breakman'` |
| `guide` | `PROTOMAN_CLASSIC_GUIDE` (PM-20) | the same guide with the name changed |
| `rules` | `'classic'` (TG-41: a Classic-only hero) | same |
| Variant options (new) | `chargeWithoutMushroom: true`, `busterCapSmall: 2`, `knockbackVx: 0x01555`, `shotPadGround: 9.5 px`, `shotPadAir: 15.5 px`, `pickJingle: 'protoman-whistle'` | the same, with `pickJingle: null` |

Classic Mega Man itself uses the defaults: `chargeWithoutMushroom: false`, `busterCapSmall: 3`, `knockbackVx: 0x00AAB`, `shotPadGround: 13 px`, `shotPadAir: 17 px`, `pickJingle: null`.

**PM-2. Roster and select-screen slot.** Register both in `CLASSIC_EXTRAS` (TG-41) at Proto Man's place in its order (Bass, Sophia III, **Proto Man, Break Man**, Pit, Vic Viper, Warriors of Light), so they show on the select screen's second row only while dev mode is on and Rules is Classic SMBC. `?char=protoman` and `?char=breakman` then work through TG-41's roster; otherwise the unknown id falls back exactly as today. Locking, saves and rooms follow TG-42 and TG-43.

**PM-3. Hitbox.** Use Classic Mega Man's hitbox function unchanged. The original Proto skins share Mega Man's animation timeline, so they share its hit rectangles. From the SWF (`MegaManMc`, sprite 169): standing 13.5 × 24 px, jumping 13.5 × 27.5 px, sliding 13.5 × 15 px. Classic Mega Man uses 12 × 22 px standing and 12 × 15 px sliding in every power state (MM-C4), so Proto Man and Break Man do too.

**PM-4. Per-player rules.** The four rule changes belong to the hero, not to the game. In 2-player, a Proto Man next to a Mega Man keeps his own cap, charge, knockback and shot height. (The original keeps `skinProtoMan` in a static variable, which works only because it has one player.)

### 3. Controls

**PM-5.** Controls are Classic Mega Man's (MM-C1 to MM-C3: step nudge, slide, slide-jump, Select tap for Rush, Select hold for the button swap). Only these rows change:

| Input | Classic Mega Man | Classic Proto Man / Break Man |
|---|---|---|
| Attack (tap) | Mega Buster, 3 on screen | Mega Buster, **2 on screen while small**, 3 with a Mushroom (PM-12) |
| Attack (hold) | charges only with the Mushroom | charges **in every power state** (PM-11) |
| Special while swapped (MM-C3) | fires the buster, and charges with the Mushroom | fires the buster, and charges in every power state |

### 4. Movement and jumping

**PM-6.** Every movement and jump constant is Classic Mega Man's (MM-C2, MM-C4 to MM-C12). For reference (`MegaManBase.as:236-261, 461-499`):

| Constant | Flash | Ours | Fixed point |
|---|---|---|---|
| Walk (instant) | 165 px/s | 1.375 px/f | `0x01600` |
| Starting step | 4 px, then 100 ms hold | 2 px, then 6 f | |
| Jump take-off | 650 px/s | 5.417 px/f; our `initial` 5.208 px/f (one frame of gravity less, MM-C10) | `0x056AB`; initial `0x05355` |
| Gravity | 1500 px/s² | 0.2083 px/f² | `0x00355` |
| Max fall | 700 px/s | 5.833 px/f | `0x05D55` |
| Full jump apex | – | 67.7 px, 4.2 tiles (stepped, MM-C10) | |
| Jump release | `vy × 1e-6^dt` while rising | `vy × 0.794` per frame while rising | |
| Slide | 300 px/s for 125 px | 2.5 px/f for 62.5 px (25 f) | `0x02800` |
| Air control | full, instant | full, instant; no direction held sets vx = 0 (MM-C4 `airStop`) | |

### 5. Swimming

**PM-7.** Classic Mega Man's water rules (MM-C13): no stroke; he walks on the floor and jumps from it. Water gravity 500 → 0.0694 px/f² (`0x0011C`), water jump 560 → 4.667 px/f (`0x04AAB`; our initial `0x0498E`, MM-C13), sink cap 250 → 2.083 px/f (`0x02155`). The slide works in water at the same speed and distance. See `2026-10-07-classic-swimming.md`.

### 6. Health and power states

**PM-8. Power states.** As Classic Mega Man (MM-C14 to MM-C16), with When Hit = Lose Everything:

| State | What it gives Proto Man / Break Man | What a hit does |
|---|---|---|
| Small | Mega Buster with a **2-shot cap**, charge (PM-11), Rush Coil | dies |
| Mushroom | One extra hit. Buster cap **3**. The Charge Shot upgrade is granted too, but changes nothing because he already charges. | drops to small: the cap goes back to 2; a charge in progress is dropped (MM-C16), but he can charge again at once |
| Fire Flower | Mushroom, plus the Classic weapon (Metal Blade by default) with 40 energy units | drops straight to small (Flower and Mushroom both lost) |
| Star | 12 s invincibility, shared rules | |

**PM-9 (rule change 1). Double knockback.** On a survivable hit he is pushed backwards (opposite to the way he faces) at **160 px/s = 1.333 px/f (`0x01555`)** for **450 ms = 27 f**, with `vy = 0` at the start of the knockback. That is about **36 px** (estimate, constant speed). Input is locked for those 27 f. Then 1250 ms = **75 f** of flicker. That makes 102 f of invulnerability in all, the same as Mega Man. Classic Mega Man uses 80 px/s = 0.6667 px/f (`0x00AAB`) for the same 27 f (about 18 px; MM-C16). Everything else about the hit is MM-C16. Source: `MegaManBase.as:276-279, 2403-2418`.

### 7. Weapons

**PM-10. Damage and terrain: unchanged.** The same numbers and rules as Classic Mega Man (MM-C19 to MM-C27):

| Shot | Damage | Speed | Ground | Bricks |
|---|---|---|---|---|
| Mega Buster | 100 | 450 → 3.75 px/f | passes through solid ground | hits bricks: 2 shots break a 125-HP brick; bumps ? blocks from the side |
| Weak charge shot | 200, ends on any hit | 3.75 px/f | passes through | breaks a brick and ends |
| Full charge shot | 300, passes on through an enemy it kills | 3.75 px/f | passes through | breaks a brick and keeps going |
| Classic weapon (Metal Blade default) | as Classic Mega Man | | | |
| The other 8 Robot Master weapons | as Classic Mega Man (MM-C22 to MM-C26): all built, reached only through `&kit=full` (MM-C21, TG-44); a Select tap cycles them, then Rush, and Special fires the selected one | | | |

Hits to kill, at Normal attack strength: Goomba 3 buster shots, Koopa 6, Hammer Bro 8, Bowser 24 / 36 / 44 (2400 / 3600 / 4400 HP). See `2026-10-07-classic-enemy-hp-and-armour.md` and `2026-10-07-classic-bricks-and-shots.md`.

**PM-11 (rule change 2). Charge without the Mushroom.** Holding the buster button charges in every power state: MM-C20 applies without its "Mushroom only" condition. The timing is Classic Mega Man's (`MegaManBase.as:244-247, 1766-1793, 2317-2349`):

| Held for | Stage | Release fires |
|---|---|---|
| 0 to 550 ms (0-32 f) | none (the tap already fired a normal shot) | nothing more |
| 550 ms (33 f) | charge starts: sound and first outline | nothing more until 800 ms |
| 800 ms (48 f) to 1449 ms | outline 2, then weak charge from 1100 ms (66 f) | weak charge shot, 200 |
| 1450 ms (87 f) on | full charge | full charge shot, 300 |

Other weapons charge only as for Classic Mega Man (Pharaoh Shot balloon, Magma Bazooka). Everything else in MM-C20 holds: charge shots ignore the cap; a hit, the button swap or a vine drops a charge in progress. Losing the Mushroom does not take away the ability to charge. Source: `MegaManBase.as:579-592` (`skinProtoMan` in `canChargeWeapon`).

**PM-12 (rule change 3). Buster cap.** In MM-C19's cap, replace 3 by **2** while he has no Mushroom; with a Mushroom (or the Flower) it stays **3**. The count is MM-C19's: his projectiles on screen, not counting Water Shield drops and Pharaoh shots or balloons. No buster shot fires while a full charge shot is still on screen, as for Mega Man. Source: `MegaManBase.as:1551-1569`, cap constant `:166`.

**PM-13 (rule change 4). Lower shots.** Every shot that the Mega Man report spawns "like the buster" (MM-C19: the buster, both charge shots, and the weapons that say "spawns like the buster") spawns lower. In the original these are all the shots placed by `MegaManProjectile.setDir`: buster, charge shots, Hard Knuckle, Pharaoh Shot, Flame Blast and Magma Bazooka. Shots the Mega Man report spawns elsewhere (Screw Crusher, Water Shield, Metal Blade) are unchanged.

| | Classic Mega Man | Proto Man / Break Man |
|---|---|---|
| Shot height above the feet, on the ground | 26 Flash px = 13 px | **19 Flash px = 9.5 px** (3.5 px lower) |
| Shot height above the feet, in the air | 34 Flash px = 17 px | **31 Flash px = 15.5 px** (1.5 px lower) |
| Horizontal offset from his centre | 38 Flash px = 19 px | unchanged |

Source: `MegaManProjectile.as:89-93, 757-794`; `MegaManBase.as:2302-2307`. Measure the same point MM-C19 measures. (The stub `ProtoMan.as:16-17` has 20 / 31; those constants are unused. The live values are 19 / 31.)

### 8. Special abilities

**PM-14. No shield.** The original has no Proto Shield (PM-M1 asks the owner whether to add one). Slide, Rush Coil and the Select button-swap are Classic Mega Man's.

### 9. Interactions

**PM-15.** As Classic Mega Man: head bumps bounce bricks and never break them; shots break and bump bricks; no stomp; fire bars hurt him (only the Fire Man skin was immune); pipes, vines, springs, flagpole and Bowser use the shared code. Red springs give everyone 500 (1000 boosted); green springs give the Mega Man family 3000. Our spring tables are keyed by hero id and fall back to Mario's 2750 and gravity 1500 (`spring.ts:24-49, 119-121`), so add `protoman` and `breakman` to `SPRING_GREEN_BOOST` (`flash(3000)`) and `SPRING_RISE_GRAVITY` (`flashAccel(1500)`), as BA-14 does for Bass.

### 10. Level data needs

None. Proto Man uses no character-specific tiles.

### 11. Sprites and sound

**PM-16. Palettes (minimum to test).** Add palette swaps of our `megaman` sheet (`src/content/sprites/megaman.ts:17-40`; roles: 0 outline, 1 light armour, 2 dark armour, 3 skin, 4 white, 5 glow):

| Palette | Suggested colours |
|---|---|
| `protoman` | `NES.black, NES.lightGray, NES.redBright, NES.skin, NES.white, NES.yellow` |
| `breakman` | `NES.black, NES.darkGray, NES.redDark, NES.skin, NES.white, NES.yellow` |
| `protoman-charge-0..2`, `breakman-charge-0..2` | the Mega Man charge cycle with index 2 kept red / dark red |
| `protoman-star-*`, `breakman-star-*` | fall back to the Mega Man star palettes (`content/sprites/index.ts:95-111`) |
| weapon suit colours | if Classic Mega Man recolours the suit per weapon, reuse those palettes |

**PM-17. Frames.** Use the same frame names as Classic Mega Man's sheet (16 × 32 px cells today: `idle`, `idle-blink`, `walk-0..2`, `jump`, `shoot`, `walk-shoot-0..2`, `jump-shoot`, `slide`, `hurt`, `death-orb`, `teleport-0`, `climb-0`, `climb-1`, `charge-0`, plus any the Mega Man report adds). When Proto art exists, add `throw` and `jump-throw` (16 × 32): the original's Proto skins use them instead of `shoot` / `jump-shoot` whenever a weapon is thrown (Metal Blade, Pharaoh Shot, Screw Crusher, Super Arm, Hard Knuckle) and while carrying a Super Arm block (`MegaManBase.as:771-786, 1060-1132, 1883-1905`). Until then, fall back to `shoot` / `jump-shoot`.

**PM-18. Whistle.** When Proto Man is picked on the character select, play a short whistle jingle (`protoman-whistle`) instead of Mega Man's pick sound. Break Man plays Mega Man's pick sound. In the original only skins named "Proto Man" whistle (`MegaManBase.as:2627-2643`, called from `SoundManager.as:1023-1027`); the Break Man skins are named "Break Man" (`BmdInfo.as:916, 920, 960`). The jingle must be our own composition (PM-M3).

**PM-19. Castle text.** Keep our shared castle text (`world.ts:2000-2001`), as Classic Mega Man and Bass do. The original replaces "our princess" with the skin's third name, "Roll" for all six Proto and Break Man skins (`BmdInfo.as:896-960`, `ScreenManager.as:404-411`, `GameTextMessages.as:7-9`); PM-M8 asks the owner whether to add per-hero names.

### 12. Guide text

**PM-20.** Add `PROTOMAN_CLASSIC_GUIDE` by copying the Classic Mega Man guide and changing these rows (our guide style: short sentences, read in upper case):

- tagline: `Mega Man's rival. Charges from the start.`
- `attack`: `Fire the buster. Two shots at a time, three with a Mushroom.`
- `attack (hold)`: `Charge, even without a Mushroom. Let go for a bigger shot.`
- `mushroom`: `One extra hit and a third buster shot.`
- tip: `Hits knock you back twice as far as Mega Man. Mind the pits.`

Break Man uses the same guide with "Break Man" where the name appears.

### 13. Build steps

1. Make Classic Mega Man (`src/game/characters/megaman/classic.ts`, which exports `MEGAMAN_CLASSIC`) come from a factory, `classicMegaMan(variant)`, whose defaults give `MEGAMAN_CLASSIC` exactly. Move its rule constants (charge gate, small cap, knockback, shot heights, pick sound) into the variant options of PM-1.
2. Add `src/game/characters/protoman/classic.ts` exporting `PROTOMAN_CLASSIC` and `BREAKMAN_CLASSIC`, and `src/game/characters/protoman/guide.ts` with `PROTOMAN_CLASSIC_GUIDE`.
3. Add the palettes of PM-16 to `src/content/sprites/megaman.ts` and the fallbacks to `src/content/sprites/index.ts`.
4. Add the `protoman-whistle` jingle to `src/content/sfx/sfx.ts` (placeholder allowed, PM-M3) and play it from the pick in `src/game/scenes/character-select.ts`.
5. Only if the owner accepts PM-M8: add an optional `rescueName` to `CharacterDef` and use it in the castle text at `src/game/world/world.ts:2000-2001` (`BUT ${rescueName ?? 'OUR PRINCESS'} IS IN`).
6. Add both to `CLASSIC_EXTRAS` in `src/game/characters/registry.ts` (TG-41), and their spring entries to `src/game/entities/objects/spring.ts` (PM-15). The roster, the second select row and `?char=` come from TG-41 to TG-43.
7. Add the tests in Notes → Acceptance checks.

### Missing information to fill in

| ID | Gap | Suggested default | Decides |
|---|---|---|---|
| PM-M1 | **The shield.** The original never had one: no code, frame label or setting mentions a Proto Shield; the only shield is the Water Shield weapon. Adding one would be new design, not Classic. | **Don't add it to Classic.** Classic means "as the original played", and the original's Proto Man is shield-less. If the owner wants a shield, add it later as a separate option, using the existing `behaviour.blocks` hook (`character.ts:50-51`): it would block enemy projectiles that hit his front while he is airborne and not firing, as in Mega Man 9 and 10. | owner |
| PM-M2 | Proto Man and Break Man art: visor helmet, scarf, `throw` and `jump-throw` poses. The original sheets (`megaMan_003/004/005/008/009/019.png`) are not ours to use. | Palette swaps of our Mega Man sheet (PM-16) until the art is drawn. | owner |
| PM-M3 | The whistle jingle (about 2 s). The original uses Capcom's tunes from Mega Man 9, 7 and 4 GB depending on the skin's console. | Compose an original short whistle in MML. Until then, play Mega Man's pick sound. | owner |
| PM-M4 | Music sets. Proto Man skins use Mega Man 5 / 7 / 4 GB music, Break Man skins Mega Man 3 / 7 / 4 GB. Ours has no per-hero music set for Mega Man. | Keep the level music, as for Classic Mega Man. | owner |
| PM-M5 | One slot or two on the select screen. Break Man differs only in looks and the whistle. | Two adjacent slots (PM-2). | owner |
| PM-M6 | Whether friction acts on the knockback. The source sets `vx` once and runs a 450 ms timer; the 36 px distance assumes constant speed. | Constant 1.333 px/f for 27 f, then the Classic Mega Man stop. | coder |
| PM-M7 | Releasing a charge between 550 and 800 ms fires nothing extra (the first outline shows, but no weak shot). It may be an oversight in the original. | Keep it as in source (PM-11), same as Classic Mega Man. | owner |
| PM-M8 | **Per-hero castle names.** The original's castle text names the skin's rescue target ("Roll" for Proto and Break Man; "Dr. Light" for Mega Man; "Dr. Wily" for Bass, BA-M13). | Keep our shared text for every hero, so the Mega Man family stays consistent. If wanted, add it once for all heroes with an optional `rescueName`. | owner |

## Actual

We have no Proto Man or Break Man. `characters/registry.ts:12-16` lists 8 heroes and an unknown id falls back to Mario, as does `?char=` in `src/main.ts:178`. Current Mega Man (`characters/megaman/index.ts:218-367`) has a 28-HP bar, charges only with the helmet (`:291-299`), always allows 3 buster shots (`:283, 289`), fires at body top + 8 px (`:119-126`) and uses knockback `{ vx 0.5, vy 1.5 }` with 60 invulnerability frames (`:223-229, 355-365`). Current stays the default and must not change.

## How often

every time

## Notes

- **Sources.** Original paths are under `$S/orig/src/com/smbc/`, with line numbers after `tr '\r' '\n'` (copies in `$S/classic/pp-work/`).
  - Proto skin list and name: `characters/base/MegaManBase.as:66-67`; `checkSkinProtoMan` `:2644-2650`; set on every skin change `:771`.
  - Charge without the Mushroom (PM-11): `MegaManBase.as:579-592`; charge stages `:244-247, 2317-2349`; release `:1766-1793`.
  - Buster cap (PM-12): `MegaManBase.as:166, 1551-1569`. Fact-check A corrects the unit: only Proto/Break get 3 shots with a Mushroom; Cut Man and Fire Man stay at 2.
  - Knockback (PM-9): `MegaManBase.as:274-279, 2389-2423`; invulnerability `:260-261`.
  - Shot heights (PM-13): `projectiles/MegaManProjectile.as:89-95, 757-794`; `MegaManBase.as:2302-2307`.
  - Throw frames (PM-17): `MegaManBase.as:771-786, 1060-1132, 1883-1905, 2741-2758`.
  - Whistle (PM-18): `MegaManBase.as:2627-2643`; `managers/SoundManager.as:1023-1027`. Fact-check A: Break Man has no whistle.
  - Skins: `graphics/BmdInfo.as:894-904` (Proto Man 3, 4, 5), `:914-920` (Break Man 8, 9), `:958-960` (Break Man 19); commented standalone sets `:991-1015`; skin numbers `characters/MegaMan.as:98-114`; text `data/SkinDescriptions.as:10`.
  - Stub: `characters/ProtoMan.as:1-24`; roster row commented `data/CharacterInfo.as:46-47`.
  - Lose Everything default: fact-check A (`GameSettings.as:221`, `Character.as:2052-2067`).
  - Hitboxes: SWF `MegaManMc` (sprite 169) `HRect` children, read with `$S/classic/billtools/hrect.py`.
  - Unit and report: `$S/chars/missing-bass-protoman.md` (Proto parts), `$S/chars/FINAL-REPORT.md` 4.3 and section 5, `$S/chars/verify/A.md`.
- **Implementation hints.**
  - Keep Current untouched: nothing in `megaman/index.ts` changes. All work is in the Classic silo (`megaman/classic.ts`, `protoman/classic.ts`).
  - The four rules are variant options read where Classic Mega Man already decides them: the charge gate (where Classic Mega Man checks the Charge Shot upgrade), the cap check before spawning a buster shot, the knockback speed in its hurt handler, and the spawn y in its fire function (`feet − shotPadGround` or `feet − shotPadAir`).
  - 9.5 and 15.5 px are half pixels. In fixed point they are `0x9800` and `0xF800` below the feet; use `px(9.5)` only if `px()` keeps fractions.
  - Keep the variant on the definition, not in a module-level variable, so two players can differ (PM-4).
- **Acceptance checks** (headless, `rules: 'classic'`).
  - Charge: small Proto Man holds Attack 87 f and releases → one full charge shot (300 damage). The same with Classic Mega Man → no charge shot. Holding 48-86 f → a weak shot (200).
  - Cap: small Proto Man presses Attack on 6 consecutive frames → 2 buster shots alive. With a Mushroom → 3.
  - Knockback: a Mushroom Proto Man touches a Goomba on flat ground → after 27 f he has moved 36 ± 1 px backwards; Classic Mega Man 18 ± 1 px. Invulnerable for 102 f in both.
  - Shot height: on the ground the first buster shot's centre is 9.5 px above the feet (Classic Mega Man 13); in the air 15.5 (17).
  - A hit at Mushroom → small: the cap returns to 2 and the charge still works.
  - Picking Proto Man queues `protoman-whistle`; picking Break Man does not.
  - Roster: with `rules: 'current'`, or with dev mode off, neither id is listed and `char=protoman` falls back as today.
  - Current unchanged: the existing test suite and headless sims pass with no edits.
- **Confidence.** Source only; the original was not played and no Proto skin was tested in it. The knockback distance (36 px) is an estimate from the constants; the jump apex (67.7 px) is MM-C10's stepped simulation. The hitbox sizes come from the SWF. Everything else is read directly from source.
- **Open questions.** PM-M6 and PM-M7 above. A playtest of the original with a Proto skin would confirm the knockback distance and the 550-800 ms charge gap. Meanwhile use the defaults given.
- **Related reports.**
  - `2026-10-07-megaman-classic-smbc-rules.md` (the base this variant copies).
  - `2026-10-07-dev-classic-smbc-rules-toggle.md` (the gate and the roster).
  - `2026-10-07-classic-power-states.md`, `2026-10-07-classic-enemy-hp-and-armour.md`, `2026-10-07-classic-bricks-and-shots.md`, `2026-10-07-classic-swimming.md`.
  - `2026-10-07-bass-build-classic-character.md` (first in the `CLASSIC_EXTRAS` order; BA-M13 is the same castle-name question as PM-M8), `2026-10-07-classic-follow-ups.md` (FU-1, FU-3 for the other Mega Man gameplay skins).
  - Existing reports that also touch the inherited slide and water rules: `2026-10-06-megaman-slide-crosses-one-tile-gaps.md`, `2026-10-06-water-non-mario-heroes-stroke.md`.
