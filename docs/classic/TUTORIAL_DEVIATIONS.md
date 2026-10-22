# Classic Tutorials: where our words differ from the original's

Classic mode's Tutorials boxes (O-15 / G-042, `src/game/tutorial/original-tutorials.ts`) use the
words of the original's `managers/TutorialManager.as` (SMBC 3.1.21, MIT). The owner's rule: copy
exactly what the original had, except

- **(a)** a key or button name becomes the ability or the hero's own button name (`JMP_BTN` →
  JUMP, `SPC_BTN` → the hero's special button, such as BOOMERANG; "arrow keys" → "the
  directions"), with the real key in brackets on keyboard and pad;
- **(b)** an obvious typo is fixed ("Suvival", "Mega man", "Press SPC place", a double space, a
  stray space after "Hover:");
- **(c)** a sentence that is false in our game changes by the least, checked against our kit code.

Kept as in the original, for the owner to decide: "If the game runs slowly, try changing music
consoles or turn the music off."

`tests/sim/classic-tutorials.test.ts` holds the original's words for every box and fails if any
box differs from them other than by (a), (b) or a deviation listed here.

## (c) Deviations

| Box                    | Original (TutorialManager.as)                                                                                                                   | Ours                                                                                                                                | Why the original is false here                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| firstCharacterStart p3 | "Note that Mario and Luigi are the only characters that can jump on enemies."                                                                   | The same; with Yoshi in the select: "Mario, Luigi and Yoshi are the only characters…"                                               | Yoshi stomps (`characters/yoshi/classic.ts:391` `stomps: true`). He is an unreleased Expansion hero, so players see the original sentence.                                                   |
| firstCharacterStart p4 | "In the pause menu, you can save or load a game and change several options."                                                                    | "In the pause menu, you can change several options."                                                                                | Our pause menu has no save or load (`scenes/pause.ts:37-90`). Continue resumes a run by itself.                                                                                              |
| bassStart              | "Press SEL or SPC to cycle through weapons when you have them."                                                                                 | "Press WATER to use his weapon when you have it." (the Flower weapon's button)                                                      | Bass has one Flower weapon and nothing to cycle. SPECIAL fires it, and TOOLS swaps it with the buster (`characters/megaman/classic.ts:401-412`, `:777-787`).                                 |
| billStart              | "He cannot collect a mushroom and will be killed in one hit."                                                                                   | "He will be killed in one hit without a mushroom."                                                                                  | Our Bill takes the Mushroom, which gives him the Machine Gun, and a hit then takes it away instead of killing him (`characters/bill/classic.ts:301-308`, `characters/classic/power.ts:260`). |
| linkStart p2           | "Press SEL to switch subweapons if you have more than one."                                                                                     | "Press BOMB (or BOW) to use his subweapon when he has one."                                                                         | He owns one subweapon, bombs or the bow, and TOOLS uses it. Nothing switches (`characters/link/classic.ts:385-387`).                                                                         |
| linkBlueRing           | "The blue ring prevents Link from getting damaged by his bombs."                                                                                | "The blue ring makes Link's sword stronger."                                                                                        | His bombs never hurt him (`characters/link/classic-weapons.ts:435`). The Blue Ring (the Mushroom state) raises the sword from 200 to 275 (`characters/link/classic.ts:110`).                 |
| linkBow                | "Press SPC to shoot an arrow across the screen."                                                                                                | "Press BOW to shoot an arrow…"                                                                                                      | (a) and (c): the bow is on TOOLS, not SPECIAL (`characters/link/classic.ts:385-387`).                                                                                                        |
| linkBomb               | "Press SPC place a bomb. … Bombs damage Link if he does not have a mushroom."                                                                   | "Press BOMB to place a bomb. … Bombs do not damage Link."                                                                           | Bombs are on TOOLS (`characters/link/classic.ts:385-387`) and never hurt him (`characters/link/classic-weapons.ts:435`).                                                                     |
| megamanStart p1        | "Press SEL or SPC to cycle through weapons when you have them."                                                                                 | "Press BLADE to use his weapon when you have it." (the Flower weapon's button)                                                      | One Flower weapon, fired with SPECIAL. TOOLS calls Rush (tap) or swaps the buttons (hold) (`characters/megaman/classic.ts:401-446`).                                                         |
| megamanStart p2        | "Press SEL or SPC to switch to Rush Coil."                                                                                                      | "Tap RUSH to call Rush Coil."                                                                                                       | A tap of TOOLS calls Rush (`characters/megaman/classic.ts:389-399`, `:446`).                                                                                                                 |
| ryuStart p2            | "Press SPC or UP and ATK to throw special weapons when you have enough ammo."                                                                   | "Press SHURIKEN (his art's button) to throw special weapons…"; with the Jump Slash as his art, "…to use the jump slash in the air…" | Only SPECIAL uses his art. UP and ATTACK just slashes (`characters/ryu/classic.ts:407`). The Jump Slash is not thrown.                                                                       |
| simonStart             | "Press SPC or UP and ATK to use subweapons if you have enough ammo."                                                                            | "Press AXE (his sub-weapon's button) to use subweapons…"                                                                            | Only SPECIAL throws his sub-weapon (`characters/simon/classic.ts:333`, `:457`).                                                                                                              |
| sophiaStart            | "Sophia can use special weapons with SPC or DWN and ATK when you have them. Press SEL to switch between them."                                  | "Sophia can use special weapons with MISSILE when you have them."                                                                   | SPECIAL fires the missile and DOWN and ATTACK does not (`characters/sophia/classic.ts:189`). She owns one missile in Classic play (`:127`), so there is nothing to switch (`:183`).          |
| sophiaHomingMissile    | "Press SPC or DWN and ATK to fire a homing missile when enemies are on screen. If you have multiple weapons, press SEL to switch between them." | "Press HOMING to fire a homing missile."                                                                                            | SPECIAL only (`characters/sophia/classic.ts:189`). It fires with no enemy on screen too (`:88-110`). One missile only (`:127`).                                                              |

## Changed by owner decision

**sophiaWallClimb** p1: the original's "Hold down while approaching a cliff to climb down it."
now reads "Hold down and the direction toward the cliff to climb down it." Down alone never takes
the tank over the edge. Down and the direction toward the cliff does (`characters/sophia/drive.ts:704`),
and the touch pad's even eight-way zones for the tank make that diagonal easy to hold.

## Removed by owner decision

The first start's last page (`firstCharacterStart` p5, the gamepad page) keeps only its first
sentence, "Also, playing with a gamepad is highly recommended." The owner removed the two that
point outside the game:

- "See the Exploding Rabbit website for info on setting that up."
- "If you have questions about the game, feel free to ask them in the Super Mario Bros. Crossover
  forum."

Boxes kept word for word that were questioned:

- **megamanChargeKick:** "Press DOWN and JUMP to damage enemies while sliding." This is true: the Flower turns the kick on (`characters/megaman/classic.ts:624`).
- **ryuStart p1** ("press back… press down") and **sophiaWallClimb**'s gaps sentence: both are true of our Ryu and Sophia (`characters/sophia/drive.ts:504-509`, `:697-699`). Its cliff sentence changed by owner decision (above).

## Boxes left out

The original lists these, but our Classic kits never give their pickups:

| Box                      | Original                                               | Why it is left out                                                   |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| BILL_RAPID_1             | "Rapid: Rapid slightly increases Bill's firing speed…" | No Rapid pickup in our Classic kit (PS-C5).                          |
| MEGA_MAN_ENERGY_BALANCER | "Energy Balancer: When you pick up weapon energy…"     | No Energy Balancer pickup.                                           |
| SAMUS_MORPH_BALL         | "Morph Ball: Press down while crouching…"              | Our Samus has the morph ball from the start (her start box says so). |
| SAMUS_VARIA_SUIT         | "Varia Suit: The varia suit protects Samus…"           | Never given in Classic (SA-C16: the Varia colours only).             |

Also left out: Samus's ammo box (`Samus` + `Ammo`). Its trigger is commented out in the original
too (Samus.as 639-644), so it never showed there either.
