# Warriors of Light (Classic mode): design proposal

Status: **approved and built** with the Recommended answer for every decision below (Classic mode, the last hero
of the select screen's second row; `src/game/characters/warriors/classic.ts`, art in
`src/content/sprites/warriors.ts`, tests in `tests/sim/classic-warriors.test.ts`). Built answers: M1 staff swing and
Down + ATTACK Cure; M2 no MP, one Cure charge a level, shown on the HUD's third row as `W.MAGE CURE 1` / `CURE 0`
only while the White Mage is small (it is hidden powered up) and announced "Cure ready" / "Cure used"; M3 Special +
one direction switches class in place (holding CLASS never walks), remembered across deaths, shown on the select
portrait; M4 no stun; M5 outfits only; M9 spells strip bricks; M11 the draft art; M12 no hand pointer; M13 menu
"Warriors of Light", HUD `WARRIOR`, Toad says "THANK YOU WARRIOR!"; M14 14 px wide; M15 the 130 px underwater jump
kept. Bolt is drawn only below the HUD's rows. The text below is the proposal as approved.

Original status: proposal for owner approval. Source report:
`bug-reports/2026-10-07-warriors-of-light-build-classic-character.md` (IDs `WL-`). Draft art and the storyboard
renderer: `tools/mockups/classic/` on branch `claude/classic-wip-mockups` (not in the game). Render with
`node tools/mockups/classic/render.mjs <outDir>` (PNG output must stay outside the repo).

The Warriors of Light were cut from the original SMBC 3.1.21: the class is in the SWF but nothing ever creates
it. I re-read the original source: walk 200 px/s, jump 630 px/s, gravity 1400 px/s², `BRICK_NONE`, the Fire
Flower outfit offset (423 px), damage Fighter 300 / Thief 50 / Fire 400 / Ice 400 / Bolt 600 all match the
report, and `WhiteMage.as` really only sets its sprite row (no attack). Anything not coded is a new design and is
marked **DECISION FOR THE OWNER**.

The hero appears only in Classic mode (and dev Classic runs), never in the campaign.

## 1. At a glance

One select-screen slot, four jobs that share a body and movement: **Fighter** (strong sword), **Thief** (weak,
fast-feeling dagger), **Black Mage** (three spells), **White Mage** (new: staff and Cure). No stomp, no head bump:
blocks open only with swings and spells.

| Ability (player text)       | Fighter                                                                         | Thief            | Black Mage           | White Mage                 |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------- | -------------------- | -------------------------- |
| ATTACK                      | sword swing, 300                                                                | dagger swing, 50 | Fire                 | staff swing, 100 (**new**) |
| Up + ATTACK                 | –                                                                               | –                | Bolt                 | –                          |
| Down + ATTACK               | –                                                                               | –                | Ice (also crouching) | Cure (**new**)             |
| JUMP                        | fixed jump; on the ground it cancels a swing or wind-up                         | same             | same                 | same                       |
| CLASS (Special + direction) | Up Fighter, Right Black Mage, Down Thief, Left White Mage (**coded, disabled**) | same             | same                 | same                       |
| Down                        | crouch                                                                          | same             | same                 | same                       |

Actions start only when idle (presses during an action are ignored), work on the ground or in the air, and root
the hero in place while on the ground.

## 2. Movement

| Number             | Value                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Walk               | 1.667 px/f, instant start and stop, full air control, no run                          |
| Jump               | launch 5.25 px/f (ours 5.0556 with our move-then-gravity order), gravity 0.1944 px/f² |
| Jump height / time | 68.3 px, apex frame 26, lands frame 53; no variable height                            |
| Water              | gravity 0.1042 px/f²; a floor jump rises about 130 px; no stroke                      |
| Hitbox             | 14 × 26 standing, 14 × 15 crouching (SWF), same in every state and job                |
| Springs            | red 500 / 1000 Flash, green boost 1000 (needs a `warriors` spring entry)              |

## 3. Power states (Classic power model)

| State       | Effect                                                             | Look (draft)                    |
| ----------- | ------------------------------------------------------------------ | ------------------------------- |
| Small       | dies to any hit                                                    | base outfit; same size as big   |
| Mushroom    | one extra hit; no kit change                                       | base outfit + HUD Mushroom icon |
| Fire Flower | new outfit only (coded): Knight, Ninja, Black Wizard, White Wizard | palette swap per job            |

A hit while powered drops to small and back to the base outfit; the job is kept. A job switch keeps the power
state, invulnerability and Star.

## 4. Weapons

- **Swing** (Fighter, Thief, White Mage): 30 frames, 15 × 25 px box in front, live the whole swing, each target
  once. Breaks plain bricks and bumps ? blocks. Armoured enemies ignore it. Fighter: Goomba 1 hit, Koopa 2,
  Bowser 8 / 12 / 15. Thief: Goomba 5, Koopa 12.
- **Spells** (Black Mage): 30-frame wind-up, then an 18-frame cast pose (48 frames rooted). Free, no MP.
  All pierce enemies, ignore ground, and break every brick they touch.
  - Fire: 3.75 px/f forward, 400.
  - Ice: one 48 × 48 burst 50 px ahead, 400, 22 frames.
  - Bolt: a 27 px column the full screen height, 50 px ahead, 600, 27 frames.

## 5. How it handles the world

| Thing                        | Behaviour                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Bricks / ? blocks from below | solid ceiling, no bump; hidden blocks never revealed. Coins and items come from swings and spells     |
| Enemies                      | landing on them hurts (no stomp)                                                                      |
| Water                        | walks and jumps with water gravity; attacks and spells work                                           |
| Pipes, vines, flagpole, lava | shared, as every hero; vines: climb, no attacks                                                       |
| Bowser                       | swords and spells (Bolt is the best tool: 4 / 6 / 8 hits), or the axe; Toad says "THANK YOU WARRIOR!" |
| Co-op                        | each player has their own job                                                                         |

## 6. Decisions for the owner

Each item: **Recommended** first, then alternatives. Items marked (coder) can be settled by the builder.

- **M1 What the White Mage does. DECISION FOR THE OWNER.**
  Recommended: ATTACK = staff swing (shared swing, 100 damage); Down + ATTACK = **Cure**: Black Mage timing, and
  when it lands a small hero regains the Mushroom (only while small, only with a charge).
  Alt A: Cure only, no attack (closest to the code). Alt B: Cure also gives a nearby co-op partner (48 px) the
  Mushroom.
- **M2 MP. DECISION FOR THE OWNER.** Recommended: no MP. Black Mage spells stay free (as coded). Cure uses **one
  charge**, refilled at each level start and after a death; HUD shows `W.MAGE C1` / `C0`.
  Alt: an 8-point MP meter (Fire 1, Ice 2, Bolt 3, Cure 4), refilled each level.
- **M3 Choosing a job. DECISION FOR THE OWNER.** Recommended: enable the written switch: Special + exactly one
  direction, any time the hero is idle, in place, no cooldown, short flash (respects Reduce flashing) and a
  sound; job remembered across deaths and levels; starts as Fighter; the select portrait shows the remembered
  job. Alt A: four separate select-screen slots, no switching. Alt B: switching only at level start.
- **M4 Thief stun. DECISION FOR THE OWNER.** Recommended: no stun (as coded). Alt: a 24-frame hit-stun so the
  weak Thief has a reason to be picked.
- **M5 Fire Flower outfits. DECISION FOR THE OWNER.** Recommended: art only (as coded). Alt: small upgrades
  (Knight sword 400, Ninja 100, Black Wizard spells +100, White Wizard 2 Cure charges).
- **M9 Spells stripping bricks. DECISION FOR THE OWNER.** Recommended: keep (Ice clears up to 3 × 3 bricks, Bolt a
  full column). Alt: spells bump ? blocks but leave plain bricks.
- **M11 Art. DECISION FOR THE OWNER.** Recommended: the draft in `tools/mockups/classic/warriors.ts`: one original
  body with four heads and outfits (plumed helmet, hood and bandana, wide-brim hat with glowing eyes, pointed
  zigzag hood), not copies of the FF1 sprites. Alt: one figure in four palettes only (cheaper, less readable).
- **M12 FF hand pointer. DECISION FOR THE OWNER.** Recommended: leave out (unreachable, and spells ignore it). Alt:
  none sensible.
- **M13 Names. DECISION FOR THE OWNER.** Recommended: menu "Warriors of Light", HUD `WARRIOR`, job on the HUD's
  third row. Alt: HUD shows the job name instead (`FIGHTER`, `B.MAGE`...).
- **M14 Hitbox width. DECISION FOR THE OWNER.** Recommended: 14 px (SWF). Alt: 12 px to match the roster.
- **M15 The 130 px underwater jump. DECISION FOR THE OWNER.** Recommended: keep (as coded, like the other
  non-Mario Classic heroes). Alt: cap it at the land height.
- Coder items: M6 fall cap 10 px/f, M7 swing box live all 30 frames, M8 a hit ends any action (a wind-up casts
  nothing), M10 placeholder sounds.

And the big one: **should this hero ship at all?** The comparison report suggested skipping both cut prototypes.
The Warriors need much less engine work than Vic Viper (a rooted flag, the shared `bumpsBlocks: false`, a per-tile
brick check for spells), but the art is large (4 jobs × 2 outfits).

## 7. Storyboard

Frames (256 × 240 at 3×) and `warriors-sheet.png` are written by the renderer: the four-job line-up, walking,
the fixed jump arc under blocks (no bump), Fighter swing on a Goomba, Thief breaking a brick, the Black Mage
wind-up, Fire through a pipe, Bolt full-height, Ice burst, White Mage staff, Cure, the four Fire Flower outfits,
and the class-switch directions.

## 8. Draft sprite list

In `tools/mockups/classic/warriors.ts` (16 × 32 cells, swing and cast 32 × 32): per job stand, walk × 2, jump,
crouch, swing × 2 (raised, slash), wind-up, cast = 36 frames, recoloured by 8 palettes (4 base, 4 Fire Flower).
Spells: Fire × 2, Ice burst × 2 (48 × 48), Bolt segment (tiled), Cure sparkle × 2. Still to draw if approved:
hurt, die and a 4-frame walk.
