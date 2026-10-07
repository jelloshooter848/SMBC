# Roadmap and ideas

This file lists what is planned next and the ideas we have agreed to keep for later. Versions are proposals:
the owner picks the version number at release time. When an idea is built, move it to CHANGELOG.md and delete it
here.

## The chapters

The game is released in three chapters. A chapter is "finished" when every level in it feels complete: its hidden
hero, their mini game, its look, and its part of the story. Later chapters stay **playable but unfinished** in the
meantime. Nothing is locked away because it isn't polished yet.

| Chapter                     | Levels                                  | Release              | What makes it finished                                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. The Mushroom Kingdom** | 1-0, then 1-1 through 8-4               | **0.5.0**            | All 8 hidden heroes (Luigi to Sophia III); every hero's level in their game's look; the mini games true to their games; the story from 1-0 to the 8-4 false ending and the road into the Lost Kingdom; World 2's Top Secret Area; Larry's airship; every mini game reimagined (the audit's rebuilds) |
| **2. The Lost Kingdom**     | Lost 1-1 through Lost 8-4, plus World 9 | **0.6.0** (proposed) | The Lost Kingdom story; Peach found at Lost 4-4 and playable; the main ending at Lost 8-4; the Koopaling airships side quest (the six wand pieces); the backward-warp traps; the warp hub's "???" pads                                                                                               |
| **3. The Far Lands**        | Lost A-1 through D-4                    | **0.7.0** (proposed) | Opened by the six wand pieces; the chase for Bowser's star tip; the true ending at D-4                                                                                                                                                                                                               |

When the whole game is finished, the owner may call it **1.0.0** (docs/RELEASING.md).

## Chapter 1: the path to 0.5.0

**Rule (owner):** everything planned that touches the Mushroom Kingdom (Chapter 1) ships before 0.5.0, including
every reimagining of its mini games.

**Order (owner):** 0.4.11 (Sophia) and 0.4.12 (hero tributes) ship in whichever order they are ready; the first
one out takes the next number. The Chapter 1 story (0.4.13) is built without waiting for Sophia; her lines are added
when she lands.

| Order | Release    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status                                                                                   |
| ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | **0.4.10** | **"Safety floor" dev assist** (deadly pits get an invisible floor at the pit's rim and lava turns solid, dev mode only) and **the Top Secret Area** (jump over 2-1's flagpole in the campaign to find a Moblin, "IT'S A SECRET TO EVERYBODY", who opens World 2's hidden spot: two Fire Flowers, a Yoshi egg that gives a 1-up until Yoshi exists, two Mushrooms)                                                                                                                                                                                                           | Built; browser QA, then the PR                                                           |
| 2     | **0.4.11** | **Sophia III**, the 8th hidden hero: a playable tank Jason can hop out of, found through 8-4's trap pipe (Jason looking for his frog Fred). Mini game "Underworld": tank cavern, Jason's overhead dungeon and its guardian, then the Plutonium Boss as a side-view tank fight (see idea 3 below)                                                                                                                                                                                                                                                                            | Art and character done (in review); mini game being finished; the 8-4 route after 0.4.10 |
| 3     | **0.4.12** | **Hero tributes.** **Level restyles:** each hero's level takes on their game's look in the campaign, coin heavens included (see below). **Mini game fidelity pass:** authentic HUDs (Link's B and A item boxes allowed as HUD art), each hero's own death, proper starts (Mega Man beams in, Samus materialises), Samus's "TIME BOMB SET" escape timer, Link's sword beam, mini-game-only authentic physics, Larry's cabin entered from the ceiling, lives and checkpoints, Dracula's real second form                                                                      | Restyle art in review; fidelity fixes being built                                        |
| 4     | **0.4.13** | **The Chapter 1 story** (see below): Toad as the map guide with riddle hints, a partner for each hero, the rewritten castle scenes with the fake Bowsers revealed, Peach's off-screen clues, the restyle remarks, Bowser's "NO MORE STAND-INS" in 8-4, the wand breaking, the false ending and the road into the Lost Kingdom                                                                                                                                                                                                                                               | Script drafted (docs/STORY.md)                                                           |
| 5     | **0.4.14** | **Mini game rebuilds, part 1** (from the fidelity audit): Luigi's race course rebuilt as a Lost Levels 1-1 (piranha plants, Koopas and Paratroopas, a poison mushroom, the end staircase); an **SMB3 status bar** for the airship, Larry's cabin and the bonus games; a **Toad House you walk into**, fixed N-Spade boards, and a chest after the Hammer Bro fight; **Mega Man**: two boss shutters, a Met enemy and a START weapon menu                                                                                                                                    | Planned                                                                                  |
| 6     | **0.4.15** | **Mini game rebuilds, part 2:** **Mega Man**'s stage rebuilt with ladders and vertical screens; **Link**: rooms rebuilt with 2-tile walls and 12×7 floors, and a Triforce ending; **Samus**: blue doors with room transitions, and a Tourian finale (Mother Brain, then the escape up the shaft)                                                                                                                                                                                                                                                                            | Planned                                                                                  |
| 7     | **0.4.16** | **Chapter 1 finishing pass.** Sophia's level variants (the Sophia-only tiles from the original, e.g. 4-4's drops, deferred from 0.4.11); the tile-by-tile check of SMB 1-1 to 8-4 against the owner's NES maps, fixing real differences; a full playthrough of 1-0 to 8-4 with every hero, on desktop and phone, fixing what it finds; the 8-4 credits marked as the end of Chapter 1                                                                                                                                                                                       | Planned                                                                                  |
| 8     | **0.5.0**  | **Chapter 1 release and the rebrand.** The project becomes **SMB Crossover REMIX** ("Super Mario Bros. Crossover: REMIX"): a nod to Jay Pavlina's original while saying it's a different project. A **stylized title screen** (an original logo with REMIX, livelier menu art and motion), "MADE BY JELLOSHOOTER848", and "BASED ON SUPER MARIO BROS. CROSSOVER BY EXPLODING RABBIT". The name changes everywhere (title screen, page title, README, release zip, credits). README and in-game notes for Chapter 1, final checks. The Lost Levels stay playable as they are | Planned (details to agree, see below)                                                    |

## After Chapter 1: what's already planned

Release numbers after 0.5.0 are proposals; the owner picks them.

### 0.5.1: Classic SMBC rules (right after 0.5.0, before any Lost Kingdom work)

The 19 reports from PR #51 (bug-reports/2026-10-07-_classic_.md and the per-hero reports): a dev-mode toggle that
plays the game like the original Crossover 3.1.21. It covers each hero's original physics and power states, enemy
HP and armour, bricks and shots, and swimming. Outside the toggle nothing changes. The new-character builds in
PR #51 (Sophia's spec is already used in 0.4.11; Bass, Proto Man, Pit, Vic Viper, the Warriors of Light, and the
candidate list) are not part of 0.5.1.

### Chapter 2: the Lost Kingdom (0.5.2 onward, released as 0.6.0)

| Order | What                                                                                                                                                                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **The Lost Kingdom story** (docs/STORY.md): Toad's card for each Lost world; the Lost castles' fake-Bowser reveals and their story pages; Peach's turnip clues; the Koopalings hunting the pieces; the main ending at Lost 8-4 (Bowser beaten, the princess safe, credits, then he escapes with the star tip); World 9's lines |
| 2     | **Peach, part 1: her build spec.** She is only a candidate in PR #51 (NC-1: SMB2 USA, pluck vegetables, pick up and throw enemies, float), so the spec is written first                                                                                                                                                        |
| 3     | **Peach, part 2: found and playable.** Her discovery at Lost 4-4 (the "Toad" who pulls off his cap), her hero kit, guide and training, and her own mini game in SMB2 style                                                                                                                                                     |
| 4     | **The Koopaling airships** (idea 1): six SMB3-style airships behind the six forward warp zones in Lost Worlds 1–8, one Koopaling each (Morton, Wendy, Iggy, Roy, Lemmy, Ludwig), each returning a wand piece. A side quest: all six open the Far Lands (Chapter 3)                                                             |
| 5     | **The backward-warp traps** (idea 2): LL 3-1's two and LL 8-1's backward warps lead to trap rooms with a big reward                                                                                                                                                                                                            |
| 6     | **The warp hub's "???" pads:** opened by the Koopalings; a boss rush, time trials, and a hero gallery and sound test                                                                                                                                                                                                           |
| 7     | **Chapter 2 finishing pass:** Lost Levels restyles or polish if wanted; a full playthrough of Lost 1-1 to 8-4 and World 9; then the 0.6.0 release                                                                                                                                                                              |

### Chapter 3: the Far Lands (0.6.x, released as 0.7.0)

| Order | What                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **The Far Lands opened by the six wand pieces** (campaign; classic play keeps the NES unlock rule)                                                           |
| 2     | **The chase for the star tip** through Lost A-1 to D-4, with its story lines                                                                                 |
| 3     | **The true ending at D-4:** the wand made whole, the rift sealed, Larry's wand returned (with a lock), the final credits ("THE END. ...FOR REAL THIS TIME.") |
| 4     | **Chapter 3 finishing pass**, then the 0.7.0 release. When the whole game is finished, the owner may call it 1.0.0                                           |

### Any time (not tied to a chapter)

- **New heroes** from PR #51's candidate list. Yoshi first: the Top Secret Area's egg will hatch him, as a rideable
  partner or a hero.

## Details of the planned work

### The rebrand: SMB Crossover REMIX (0.5.0)

- **Name:** the brand is **SMB Crossover REMIX**; the full name is "Super Mario Bros. Crossover: REMIX". It keeps the
  nod to the original fan game by Jay Pavlina (Exploding Rabbit) while making clear this is a separate project. A
  short form, "SMBC REMIX", is for tight spaces.
- **Repository:** the owner renames the GitHub repository before 0.5.0 (a name like
  `Super-Mario-Bros-Crossover-REMIX`, since GitHub names can't contain spaces or colons). The Pages build already
  takes its base path from the repository name (`VITE_BASE` in release.yml), so the site follows the rename. Check
  that the old address redirects. Until then the repository stays `SMBC` for testing.
- **Credits on the title screen:** "MADE BY JELLOSHOOTER848", and a line such as "BASED ON SUPER MARIO BROS.
  CROSSOVER BY EXPLODING RABBIT". The full credits roll and the README say the same, alongside the existing
  "unaffiliated fan project, original art and music" notice.
- **Stylized title screen (owner's pick, 2026-10-07): mockup A with mockup C's rift as the intro.**
  - **A:** a gold block "CROSSOVER" logo with a small "SMB" tag and a tilted red "REMIX" stamp, over a Mushroom
    Kingdom scene. Freed heroes stand on the ground in colour; unfound ones are "?" silhouettes, so the row doubles as
    a progress display. The menu, "CHAPTER 1", the version, "MADE BY JELLOSHOOTER848", the "BASED ON ... EXPLODING
    RABBIT" credit and "UNOFFICIAL FAN PROJECT" are all on screen.
  - **Intro, from C:** the wand's bolt tears a rift open, then the logo and the heroes drop out of it onto the field.
  - Built from the game's own sprites and font, with new gold/red font palettes; all art and music stay original.
  - **Kept for later:** mockup B (an SMB3 curtain stage with the heroes as the cast) and the rest of C (the rift with a
    shard of each hero's world) are saved for possible future major releases, such as a Chapter 2 or Chapter 3 title.
    The mockups and the scripts that draw them are backed up on the `claude/wip-orchestrator-notes` branch
    (`title-mockups/`).
- **Where the name changes:** title screen, `index.html` title and description, `package.json` description, README,
  release notes and the release zip's name, and the credits.

### Level restyles (campaign only, 0.4.12)

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
- Decided: the level keeps its look after the hero is freed (a souvenir of where they were found). On the first
  visit Toad remarks on it ("WHY DOES SEA SIDE LOOK SO DIFFERENT HERE?"), see docs/STORY.md 2.3b.
- Decided: the look's own music plays there for every hero. The coin heavens above these levels share the look;
  bonus rooms and water areas keep their own.

### A coherent story (0.4.13 for Chapter 1; the Lost Kingdom parts in Chapter 2)

One story runs from the start through 8-4, and explains why 8-4 leads on into the Lost Levels, where it ends.

**Owner decisions:**

- **Premise:** Princess Peach is in hiding. King Koopa stole Larry's magic wand and used it to pull heroes from other
  worlds into the Mushroom Kingdom and brainwash them, so they would hunt for Peach and he could kidnap her (his
  Koopas couldn't find her; the heroes don't think like Koopas). Mario's job is to find her first. Freeing a hero
  also cracks the wand further.
- **The wand runs through the whole story.** It breaks when Bowser falls at 8-4, and its pieces fall through a rift
  into the Lost Kingdom (the Lost Levels). Mario follows. The king keeps the star tip; the Koopalings take the six
  other pieces.
- **Two endings** (docs/STORY.md 2.15, 2.17, 2.18):
  - **Main ending at Lost 8-4:** Bowser is beaten, the princess is safe, credits roll, but he escapes with the star
    tip.
  - **Side quest:** the Koopaling airships (idea 1 below), one per piece. Optional.
  - **True ending:** all six pieces (campaign) open the way to the Far Lands, Lost A-D. At D-4 the wand is made
    whole, the rift is sealed and Larry gets his wand back whole, with a lock on it. A shorter final credits roll.
  - World 9 keeps the NES rule (a Lost 8-4 clear without warps); classic play keeps the NES rule for A-D.
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
- **The fake Bowsers are the wand's disguises,** and the player should be able to see it. Castles 1-4 to 7-4 (and
  Lost 1-4 to 7-4) hold minions the king dressed in his own shape:
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
  8-4, credits at 8-4 as a false ending, a main ending at Lost 8-4, six wand pieces held by the Koopalings that
  unlock the Far Lands and the true ending, reveal pages for the Lost castles' fakes too) are in docs/STORY.md
  section 3.

## Ideas for later

These are agreed ideas, not yet scheduled.

### 1. Koopaling airships in the Lost Levels warp zones (Chapter 2)

Larry Koopa, reached through 4-2's warp zone, was the first of SMB3's seven Koopalings. The other six are Morton,
Wendy, Iggy, Roy, Lemmy and Ludwig. Each one would get an airship reached through a Lost Levels warp zone, the same
way Larry's is reached in 4-2.

- **Story role (decided):** the airships are an optional side quest that **gates the Far Lands (Lost A-D)** in the
  campaign. Each returns one of the six wand pieces; all six open the way to A-D and the true ending (docs/STORY.md
  2.15). So they should be built **before or with the story batch**, with a dev / Unlock-all bypass for the gate.
- **Where:** the Lost Levels have 9 forward warp zones:
  - LL 1-2: three single-pipe warps, to worlds 2, 3 and 4;
  - LL 5-1: to world 6;
  - LL 5-2: two warps, to worlds 7 and 8;
  - LL A-2: to world B;
  - LL A-3: to world C;
  - LL B-4: to world D.

  Decided: the six in Lost worlds 1-8 (1-2's three, 5-1 and 5-2's two) lead to a Koopaling. Which warp gets which
  Koopaling is still to be decided. The A-D warps keep their NES behaviour.

- **Fights:** each Koopaling fights as in SMB3. For example:
  - Wendy throws candy rings;
  - Roy and Morton stomp and shake the ground;
  - Lemmy rides a ball;
  - Ludwig hops and fires blasts;
  - Iggy fires wand blasts.
- **Reward:** beating a Koopaling opens one of the warp hub's "???" pads, which ties this idea to the boss rush, time
  trials and gallery ideas below. It could also add an item to the SMB3 inventory.

### 2. The backward warps become a trap (Chapter 2)

Three Lost Levels warp zones send you back instead of forward. It was Nintendo's joke on players:

- LL 3-1 has two, both to world 1;
- LL 8-1 has one, to world 5.

Keep the joke, with a payoff:

- In the campaign, the backward pipe leads to a trap room instead, for example a Poison Mushroom "Toad House" or a
  reverse-gravity room.
- Getting through it gives a big reward.
- Failing it costs nothing: you go back out to the level.

### 3. Sophia III, the last original hero (0.4.11, Chapter 1)

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

### Bigger mini game rebuilds (from the fidelity audit; all in Chapter 1: 0.4.14 and 0.4.15)

- Luigi's race course rebuilt with Lost Levels pieces (piranha plants, Koopas, a poison mushroom, the end staircase).
- An SMB3 status bar for the airship, the cabin and the bonus games.
- Mega Man: two boss shutters, a Met enemy and a START weapon menu, then a stage with ladders and vertical screens.
- A Toad House you walk into, fixed N-Spade boards, and a chest after the Hammer Bro fight.
- Link: a Triforce ending, and rooms rebuilt with 2-tile walls and 12×7 floors.
- Samus: blue doors with room transitions, and a Tourian finale.

### Yoshi hatches from the Top Secret Area's egg (any time)

World 2's Top Secret Area (0.4.10) has a Yoshi egg block. Yoshi is not in the game yet, so its egg
always hatches a 1-up, as Super Mario World's does when Yoshi is already with you. Once Yoshi is
unlocked (a later release: a rideable partner or a hero), the egg hatches **Yoshi** instead. The
hook is ready: `yoshiUnlocked(world)` and `hatch()` in `src/game/entities/objects/yoshi-egg.ts`
(`TODO(yoshi)`): read the unlock from the save file there and let him out.

### Uses for the warp hub's "???" pads (Chapter 2)

The warp hub has three "???" pads. Once the Koopalings open them, they could hold:

- a boss rush of every mini game boss;
- time trials on levels you have cleared;
- a hero gallery and sound test.
