# Roadmap and ideas

This file lists what is planned next and the ideas we have agreed to keep for later. Versions are proposals:
the owner picks the version number at release time. When an idea is built, move it to CHANGELOG.md and delete it
here.

## Planned

| Order | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1     | **0.4.10: "Safety floor" dev assist** (deadly pits get an invisible floor at the pit's rim and lava turns solid, dev mode only) **and the Top Secret Area** (jump over 2-1's flagpole in the campaign to find a Moblin, "IT'S A SECRET TO EVERYBODY", who opens World 2's hidden spot: five ? blocks, with two Fire Flowers, a Yoshi egg that gives a 1-up until Yoshi exists, and two Mushrooms)                                                                                                                     | Being built                |
| 2     | **0.4.11: Sophia III**: build her as a new playable hero and make her unlockable in World 8 (see idea 3 below)                                                                                                                                                                                                                                                                                                                                                                                                        | Next, the owner's priority |
| 3     | **0.4.12: Level restyles**: each earlier hero's level takes on their game's look in the campaign (see below)                                                                                                                                                                                                                                                                                                                                                                                                          | Planned                    |
| 4     | **0.4.13: A coherent story** from 1-0 through 8-4 and on into the Lost Levels: a map guide, hint characters for each secret hero, castle messages rewritten (see below)                                                                                                                                                                                                                                                                                                                                               | Brainstorming              |
| 5     | **Mini game fidelity pass** (with 0.4.12), from the audit of the older mini games against the real NES games. Approved scope: authentic HUDs (Link's B and A item boxes are allowed as HUD art), each hero's own death, proper starts (Mega Man beams in, Samus materialises), Samus's "TIME BOMB SET" escape timer, Link's sword beam, authentic physics for the mini games only (the campaign kits stay as they are), Larry's cabin entered from the ceiling, lives and checkpoints, and Dracula's real second form | Being built                |
| 6     | **Classic SMBC rules** (the 19 reports from PR #51), plus an automated tile-by-tile check of our levels against the NES maps                                                                                                                                                                                                                                                                                                                                                                                          | After the restyles         |

### Level restyles (campaign only)

Each level keeps its layout, tiles and enemies exactly; only the look and music change. It uses the campaign-look
hook built for 7-3 (`campaignTheme:`, `campaignMusic:`, `[campaign-decor]` in the level's map).

| Level | Hero     | Look                   |
| ----- | -------- | ---------------------- |
| 2-1   | Link     | Zelda II               |
| 3-1   | Mega Man | Mega Man               |
| 4-2   | Samus    | Metroid                |
| 5-4   | Simon    | Castlevania            |
| 6-2   | Ryu      | Ninja Gaiden           |
| 7-3   | Bill     | Contra (done in 0.4.9) |

1-1 stays as it is, since Luigi is from Mario's own world. Three things to keep in mind:

- 2-1's restyle must keep its 0.4.10 secret: the hidden block high over the bricks before the last
  tower, the cloud path, the cave mouth past the castle and the Moblin's cave (docs/WORLD_MAP.md
  "The Top Secret Area").
- A theme drives some gameplay: a water theme turns on swimming, and a hero's own music only plays on the
  `overworld` theme. No restyle may use a water theme.
- Open question: once the hero is freed, does the level keep its look? The current lean is yes, because it marks
  where they were found.

### A coherent story (0.4.13)

One story runs from the start through 8-4, and explains why 8-4 leads on into the Lost Levels.

**Owner decisions:**

- **Premise:** Princess Peach is in hiding. King Koopa stole Larry's magic wand and used it to pull heroes from other
  worlds into the Mushroom Kingdom and brainwash them, so they would hunt for Peach and he could kidnap her (his
  Koopas couldn't find her; the heroes don't think like Koopas). Mario's job is to find her first. Freeing a hero
  also cracks the wand further.
- **The wand runs through the whole story.** It breaks when Bowser falls at 8-4, and its pieces fall through a rift
  into the Lost Kingdom (the Lost Levels). Mario follows. The Koopalings want the pieces too, which ties in idea 1
  below.
- **Peach is found in the Lost Levels**, at Lost 4-4 (Toadstool Grove), and leaves traces before that. She then becomes a **playable hero** who
  helps fight back.
  - **When:** a later release, after the story batch, once work on the Lost Levels starts.
  - **What exists:** PR #51 only lists her as a new-character candidate (`bug-reports/2026-10-07-classic-follow-ups.md`,
    NC-1: SMB2 USA, pluck vegetables, pick up and throw enemies, float). It has no full build spec, so she needs one
    written first.
- **Toad is the guide on the world map.** He's a typical helper, and players meet him in 1-0.
- **Toad's hints are part of the story, never obvious:**
  - When you enter a new world, Toad says who we're looking for. He describes the hero without naming them, and hints
    at the kind of place, for example "a hunter of the night… probably down in some dungeon".
  - When a hero's shadow shows up on the map (a hero you passed without freeing), he lightly says it feels like we
    missed something.
- **The fake Bowsers are the wand's disguises,** and the player should be able to see it. Castles 1-4 to 7-4 hold
  minions the king dressed in his own shape:
  - the disguise flickers during the fight;
  - it always bursts on defeat, revealing the true form;
  - each castle's Toad names the creature;
  - Toad explains the trick once after 1-4;
  - in 8-4 Bowser announces "NO MORE STAND-INS". See docs/STORY.md 2.3a.
- **The castle messages are rewritten.** "Our princess is in another castle" no longer fits, because Peach is hiding
  rather than captured. Each castle gets its own story beat.
- **Partner characters** for the other hidden heroes, like Jason for Sophia, who give clues about where to find them.
  Proposed partners:
  - Link: the old man in the cave;
  - Mega Man: Dr. Light;
  - Samus: a Chozo statue;
  - Simon: a Castlevania II townsperson;
  - Ryu: Irene Lew;
  - Bill: Lance.
- **Process:** first draft every line in a story document (docs/STORY.md) for the owner to review and edit, then
  build. The owner reviewed the draft on 2026-10-07; the decisions (partners before the way in, Toad at the end of
  8-4, credits at 8-4 as a false ending plus a short final roll, six wand pieces held by the Koopalings) are in
  docs/STORY.md section 3.

## Ideas for later

These are agreed ideas, not yet scheduled.

### 1. Koopaling airships in the Lost Levels warp zones

Larry Koopa, reached through 4-2's warp zone, was the first of SMB3's seven Koopalings. The other six are Morton,
Wendy, Iggy, Roy, Lemmy and Ludwig. Each one would get an airship reached through a Lost Levels warp zone, the same
way Larry's is reached in 4-2.

- **Where:** the Lost Levels have 9 forward warp zones:
  - LL 1-2: three single-pipe warps, to worlds 2, 3 and 4;
  - LL 5-1: to world 6;
  - LL 5-2: two warps, to worlds 7 and 8;
  - LL A-2: to world B;
  - LL A-3: to world C;
  - LL B-4: to world D.

  Six of these would lead to a Koopaling. Which warp gets which Koopaling is still to be decided. The rest keep
  their NES behaviour.

- **Fights:** each Koopaling fights as in SMB3. For example:
  - Wendy throws candy rings;
  - Roy and Morton stomp and shake the ground;
  - Lemmy rides a ball;
  - Ludwig hops and fires blasts;
  - Iggy fires wand blasts.
- **Reward:** beating a Koopaling opens one of the warp hub's "???" pads, which ties this idea to the boss rush, time
  trials and gallery ideas below. It could also add an item to the SMB3 inventory.

### 2. The backward warps become a trap

Three Lost Levels warp zones send you back instead of forward. It was Nintendo's joke on players:

- LL 3-1 has two, both to world 1;
- LL 8-1 has one, to world 5.

Keep the joke, with a payoff:

- In the campaign, the backward pipe leads to a trap room instead, for example a Poison Mushroom "Toad House" or a
  reverse-gravity room.
- Getting through it gives a big reward.
- Failing it costs nothing: you go back out to the level.

### 3. Sophia III, the last original hero (planned for 0.4.11)

The original Crossover's cast was Mario, Luigi, Link, Mega Man, Samus, Simon, Bill, Ryu and Sophia III. Sophia III,
the tank from Blaster Master, is the only one we haven't made. World 8 is also the only SMB world without a hidden
hero, so she would be hidden there.

- **A new playable hero:**
  - drives, hovers and fires the cannon;
  - Jason, the pilot, can climb out on foot to fit small gaps;
  - power-ups give hover fuel and cannon upgrades.
- **Hiding place (owner's design): Jason's trap pipe in 8-4.** In `8-4-end`, you come up the pipe from the water room
  at column 3. The next pipe, at column 10, normally sends you back to the start of 8-4's pipe maze
  (`pipe 10 11 down -> 8-4 19 10`). In the campaign only, that "trap" pipe leads instead to a hidden Underworld area:
  1. Jason, Sophia's pilot, is there looking for his pet frog Fred.
  2. You dive into the area's water and follow Fred, who swims down through a crack in the floor.
  3. The crack leads to Sophia III's garage in a Blaster Master-style cavern, where Sophia waits as the captive.

  It works as a misdirect: everyone walks past a pipe they've learned is a trap, so only players who explore find
  her. The way back returns to `8-4-end` for the Bowser fight.

- **Story:** Blaster Master's opening has Fred touch a radioactive chest and jump down a hole into the Underworld.
  Here, Bowser's spell reached Sophia through the Underworld's radiation.
- **Owner decisions:**
  - The villain is the **Plutonium Boss**, Blaster Master's real final boss.
  - The mini game uses both of Blaster Master's modes: Sophia in side view, then Jason on foot in an overhead dungeon
    (reusing Link's top-down kit), ending with the overhead boss fight.
  - In the main game, **Jason can hop out of the tank**.
- **Source spec:** `bug-reports/2026-10-07-sophia-build-classic-character.md` (from PR #51, FU-6) is a full build spec
  for her, taken from the original Crossover 3.1.21. It covers:
  - the wide tank (19 × 15.5 px), driving at 1.54 px/f;
  - with the Flower, she climbs walls and ceilings;
  - with the Mushroom, she hovers using an 8-cell bar;
  - a 3-level cannon that breaks bricks, plus Triple and Homing missiles;
  - thrust swimming, and her squat-then-constant-rise jump;
  - Sophia-only map tiles.

  In 3.1.21, Jason is only decoration. Our plan adds his on-foot hop-out, which goes beyond the original.

- **Mini game:** in Blaster Master's style, as true to the real game as possible.
- **Size:** this is the biggest of the three ideas, because it adds a full character kit as well as the usual
  hideout, mini game, art and music.

### Bigger mini game rebuilds (from the fidelity audit; later)

- Luigi's race course rebuilt with Lost Levels pieces (piranha plants, Koopas, a poison mushroom, the end staircase).
- An SMB3 status bar for the airship, the cabin and the bonus games.
- Mega Man: two boss shutters, a Met enemy and a START weapon menu, then a stage with ladders and vertical screens.
- A Toad House you walk into, fixed N-Spade boards, and a chest after the Hammer Bro fight.
- Link: a Triforce ending, and rooms rebuilt with 2-tile walls and 12×7 floors.
- Samus: blue doors with room transitions, and a Tourian finale.

### Yoshi hatches from the Top Secret Area's egg

World 2's Top Secret Area (0.4.10) has a Yoshi egg block. Yoshi is not in the game yet, so its egg
always hatches a 1-up, as Super Mario World's does when Yoshi is already with you. Once Yoshi is
unlocked (a later release: a rideable partner or a hero), the egg hatches **Yoshi** instead. The
hook is ready: `yoshiUnlocked(world)` and `hatch()` in `src/game/entities/objects/yoshi-egg.ts`
(`TODO(yoshi)`): read the unlock from the save file there and let him out.

### Uses for the warp hub's "???" pads

The warp hub has three "???" pads. Once the Koopalings open them, they could hold:

- a boss rush of every mini game boss;
- time trials on levels you have cleared;
- a hero gallery and sound test.
