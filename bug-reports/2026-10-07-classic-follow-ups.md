# Classic SMBC follow-ups for later: the other gameplay skins, the Random slot, the original's options and a skin system

- **Severity:** feature request (Classic SMBC rules, dev mode only)
- **Build:** V0.4.5 (d3ad397); compared against SMBC 3.1.21 at 8f4bf1a, character code unchanged since
- **Where:** Dev menu → Rules: Classic SMBC; every level; character select; options
- **How to get there:** `?dev=1&rules=classic&level=1-1&char=<id>` (once the toggle exists; today `?dev=1&level=1-1&char=<id>` shows the Current behaviour)
- **Character and power:** all heroes, all power states
- **Input:** keyboard
- **Browser and device:** any

## Steps

1. Open the character select with `?dev=1`.
2. Compare it with the original's 2 × 6 grid: Mario, Luigi, Link, Samus, Simon, Change Map Skin / Mega Man, **Bass**, Bill, Ryu, **Sophia III**, **? (Random)**.
3. Note that we have no Bass, no Sophia III, no Random slot and no skin picker.

## Expected

This report is a **parking lot**, not a request to build now. The missing characters have their own build reports:
`2026-10-07-bass-build-classic-character.md`, `2026-10-07-sophia-build-classic-character.md`,
`2026-10-07-protoman-build-classic-character.md`, `2026-10-07-pit-build-classic-character.md`,
`2026-10-07-vicviper-build-classic-character.md` and `2026-10-07-warriors-of-light-build-classic-character.md`.
Rows FU-1, FU-2, FU-5 and FU-6 below summarise them for ordering only; the build reports are the spec. The owner first wants to try the 8 existing heroes under
Classic rules (the toggle report and the 11 shared and hero reports it indexes). Build these only if the owner asks. Each item
stays behind the same Classic toggle unless the owner later promotes it.

Suggested order, smallest first (sizes are estimates):

| ID | Item | What the original has | What our engine would need | Size (estimate) |
|---|---|---|---|---|
| FU-1 | **Proto Man** as a Classic Mega Man variant | 6 Mega Man skins (Proto Man and Break Man, NES/SNES/GB). He always charges; the buster cap is 2 shots until the Mushroom, then 3; knockback is doubled (1.33 px/f); shots come out about 3.5 px lower on the ground. **No shield.** | A palette variant of Classic Mega Man and 3 flags | Small |
| FU-2 | **Pit** as a Classic Samus variant | Samus skins 6 (Pit) and 11 (Dark Pit). No morph ball or bombs; he can walk and jump while crouched; no beam from the crouch (missiles still fire); no walking while aiming up; standing shots 11 px lower | A Samus crouch (already in Classic Samus), a crouch-walk, an aim-up walk lock and a no-ball flag | Small |
| FU-3 | The other **gameplay skins** as variants | Mega Man: Cut Man, Ice Man, Fire Man, Rock, Rokko Chan, Francesca, Doropie. Link: Princess Zelda. Ryu: Haggle Man. Bass: Quick Man (needs FU-5). Mario and Luigi: SMB2, Toad, Peach, SML2, Space and SMW skins let **small** Mario or Luigi crouch. Full rules: section 5 of the comparison report | Mostly flags on the Classic definitions; art is optional (a palette swap is enough to test) | Small each |
| FU-4 | **Random** slot on the select screen | "?" picks a random enabled hero; Special also picks a random skin | One extra slot | Small |
| FU-5 | **Bass** (playable in 3.1.21) | A Mega Man 10 variant. He rapid-fires a 7-way buster every 75 ms (4.83 px/f, 50 damage, no charge, shot cap 3, or 4 with the Mushroom), and holding fire on the ground roots him. Walk 1.375 px/f; jump about 53 px; **double jump**; **dash** (= slide, 2.5 px/f) and **dash jump** that keeps 2.5 px/f. Same 9 weapons as Mega Man (Classic default: Water Shield). No Rush. Power states as Mega Man | A new `CharacterDef` and sprite sheet with aim frames, an air jump, a slide jump that keeps slide speed, held 7-way auto-fire and a rooted-while-firing state | Medium |
| FU-6 | **Sophia III** (playable in 3.1.21; Jason is cosmetic) | A wide tank, 19 × 15.5 px. She drives at 1.54 px/f and climbs walls and ceilings (Flower). Hover with an 8-cell bar (Mushroom). A 3-level cannon (100/200/300, breaks bricks, armour-immune), plus Triple and Homing missiles. She swims freely with thrust. Her jump squats about 4 f, rises at a constant 3.33 px/f for 41 px, then coasts. She can't stomp. The level data has Sophia-only tiles (`WideCharacter`) | Surface-relative movement and hitboxes; per-hero map tiles (our converter drops `WideCharacter`, `charHorz`, `charVert` and `BadSwimmer`); wide-body collision; hover; thrust swimming; homing projectiles; rotated sprites | Large |
| FU-7 | The original's **options** | Game Mode (All Characters, Single Character, Single Random, Survival). Powerup Mode **Modern**. Customize Weapons (11 per-hero choices; Classic uses the defaults, and every other choice is reachable in dev only through `&kit=full`, TG-44). More Settings (Lives, Attack Strength, When Hit, Item Drop Rate, Piranhas, Replace Goombas, Enemy Speed). Cheats that change heroes (Everyone Can Stomp, All Weapons Pierce, Infinite Ammo, Always Break Bricks, Water Mode, Bouncy Pits, Classic Samus, Classic Simon) | Menu rows that switch rules the Classic reports already add | Medium in total |
| FU-8 | A full **skin system** | 173 character skins (each a sprite sheet, music set and source-game label) and 17 map skin sets | An art project; only worth it if the owner wants it | Large |


Lowest priority: Vic Viper and the Final Fantasy Warriors of Light. Both are cut prototypes in 3.1.21 (Vic Viper's
power-ups were never implemented, and the White Mage has no attack), so their build reports list the design the owner
must supply before they can be built.

### New characters beyond the original roster (owner's wishlist; build reports to follow)

These heroes were never in SMBC 3.1.21. The owner ranked them on 2026-10-07. Each will get its own build report,
in the same format as the `*-build-classic-character.md` reports and behind the same dev-mode toggle, in a later
batch. **Nothing here is ready to build yet.**

| Rank | Character | Source game | Signature mechanics to spec |
|---|---|---|---|
| NC-1 | Princess Peach | Super Mario Bros. 2 (USA) | pluck vegetables, pick up and throw enemies, float |
| NC-2 | Yoshi, in two forms | Super Mario World; Yoshi's Island | **mount:** any hero can ride him, with tongue, swallow and spit, and he is lost when hit; **playable:** flutter jump, egg aim and throw, ground pound |
| NC-3 | Sir Arthur | Ghosts 'n Goblins | armour as the Mushroom state (a hit leaves him in his boxers), thrown lance, dagger, torch and axe, committed jumps |
| NC-4 | Scrooge McDuck | DuckTales | cane pogo in place of a stomp (bounces on enemies and spikes, breaks blocks), golf swing |
| NC-5 | Toad | Super Mario Bros. 2 (USA) | fast pluck and carry; may share Peach's carry system |
| NC-6 | Master Higgins | Adventure Island | stone axe arcs, skateboard, an energy meter refilled by fruit |
| NC-7 | Bub | Bubble Bobble | bubbles that trap enemies, bubble riding |
| NC-8 | to consider: Donkey Kong, Bowser, Battletoads, Solid Snake, Sonic, Marco Rossi | Donkey Kong Country; Super Mario Bros.; Battletoads; Metal Gear; Sonic the Hedgehog (Genesis and Master System); Metal Slug | ground slap and roll; a large fire-breathing body (needs the wide-body support in Sophia's report); smash hits and dashes; stealth needs a design pass first; momentum running, spin jump that attacks, spin dash, rings as protection (scatter on a hit), and a camera that keeps up with his top speed; Marco: pistol, knife at close range and grenades, weapon crates in place of power-ups (Heavy Machine Gun, Shotgun, Rocket, Flame Shot, each with ammo), dies in one hit, and an optional rideable SV-001 tank (it shares the mount idea with Yoshi) |

## Actual

We have 8 heroes, no Random slot, no skins, no Bass or Sophia, and only dev-mode Assists as options
(`src/game/characters/registry.ts`, `src/game/scenes/character-select.ts`, `src/game/scenes/options.ts`).

## How often

every time

## Notes

- **Sources:** the character comparison (sections 4 and 5, C12-C14), from the units `missing-bass-protoman.md`,
  `missing-sophia-jason.md`, `missing-pit-vicviper.md`, `missing-final-fantasy.md` and `skins-and-roster.md`. They
  were fact-checked against the original's source (`com/smbc/characters/Bass.as`, `Sophia.as`, `base/MegaManBase.as`,
  `Samus.as`, `graphics/BmdInfo.as`, `data/SkinDescriptions.as`, `CharacterSelectBox.as`, `GameSettings.as`, `Cheats.as`).
- **Confidence:** source only. The original was not played for these characters.
- **Related reports:** `2026-10-07-dev-classic-smbc-rules-toggle.md` (the toggle and the index of every report), and the six `*-build-classic-character.md` reports.
