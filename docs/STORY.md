# Story script (0.4.23 draft)

Every story line the player will read, written out for the owner to review and edit before it is built.
**Chapter 1 (sections 2.1-2.14) is rewritten for 0.4.23** from the owner's notes of 2026-10-08 and is **waiting
for approval**. The game (0.4.21) still shows the old Chapter 1, whose text lives in `src/game/story/script.ts`; the
old script is in git history (this file at release v0.4.21). Until the new Chapter 1 is built, `script-doc.test.ts`
(which keeps this file and script.ts word for word the same) fails against it: that is expected. docs/STORY_SYSTEM.md
says how the story is wired in. **The Lost Kingdom parts (2.15 on) are Chapter 2**, not built yet, and unchanged
here.

**How to read this file**

- Text in code blocks is the exact text. It is written in the game's own form: UPPERCASE, only characters the
  bitmap font has (`A-Z 0-9 space - . ! ? , ' : ; % / + ( )`; no double quotes, no `…`, so `...` is used), and
  already wrapped to the box it shows in:
  - **Card** (a dialogue box: Toad, Bowser, heroes, partners, locals; `CardScene` with `panel`): at most **28
    columns** a line (`CARD_COLS` in `free-hero.ts` and `mario-1-0.ts`). The first line is the speaker, then a blank
    line, then at most four lines. A **caption** is a card without a speaker (the opening, a statue's words).
  - **Castle text** (`World.castleText`, centred under the score at the end of an X-4): at most **26 columns**, the
    `THANK YOU <HERO>!` line, a blank line and at most four lines. A castle has **at most two pages**.
  - **The note** (2.1 only): Peach's letter on a parchment, at most **26 columns** and 13 lines.
  - **Hint line** (the black strip at the bottom of the world map): at most **32 columns**.
- `<HERO>` is the name of the hero the player is using (in a castle the short HUD name, `MARIO`, `MEGA`, `SOPHIA`; in
  a card the full name, `MEGA MAN`, `SOPHIA III`). Every line is counted with the longest name in its place. In
  co-op it is player 1's hero. A speaker `<HERO>:` is the player's own hero talking.
- Lines never name a button, only abilities (`OK`, `JUMP`, `TALK`), as everywhere else in the game.
- **No text ever moves on by itself** (the one exception, the Classic WORLD card, is in `docs/ACCESSIBILITY.md`): every page waits for a press (NEW: today's story pages turn by themselves
  after a minute, and the 1-0 tease's after a few seconds; both timeouts go). `OK` turns the page, `BACK` closes
  the rest of that scene. Every scene can be skipped that way; whether it can be **replayed** is said with each one.
- Each scene says **Trigger** (when it plays), **Staging** (what is on screen) and **Code** (**NEW**: needs new
  code; **REPLACES**: a text swap in an existing place; **KEEP**: no change).

## 1. The story in short

### Premise

Princess Peach is missing. She left Toad a note: Bowser is up to something, and this time she won't wait to be
rescued; she has gone to find _old friends who can help, in a place where no Koopa would ever look_. Bowser has a
magic wand (stolen from his own son Larry, as the player learns in World 4). His spies read the note, and since
his Koopas can't find her, he casts a spell that pulls **eight heroes from other worlds** into the Mushroom Kingdom,
each with a piece of their homeland, and brainwashes them to hunt for her.

Mario's job is to find Peach first. On the way he frees the heroes, one per world; each freed hero tells him a
little more (Luigi: the brainwashing; Link: the sealed lands; Mega Man: freeing heroes overloads the wand; Samus:
the wand is Larry's; Simon and Ryu: Peach is a step ahead of everyone; Bill: the wand is nearly spent; Sophia III:
a hidden land under Bowser's castle). The wand's spell **seals the road out of each world**: it opens only when
that world's castle is cleared **and** its hero is freed, and every seal that breaks makes the wand misfire a little
worse in Bowser's hands. In castles 1-4 to 7-4 Bowser hides behind brainwashed creatures dressed in his shape;
their disguise always comes off. Peach never sits still: she sends the Koopas the wrong way (3-4), gets villagers
out ahead of them (5-4), and leaves a pulled-up turnip in World 8, but never lets on where she is.

At Bowser's Castle (after World 8, since 0.4.55) the real Bowser falls, the wand breaks, and its pieces fall through a rift into the Lost Kingdom. Toad works
out the note: the place no Koopa would ever look is the Lost Kingdom, so that is where Peach went, and now the
wand's pieces, the Koopalings and Bowser are heading straight for her (Chapter 2).

### Beat outline

| Part            | What happens                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New file        | Peach's castle: the princess is missing. Her handwritten note fills the screen. Toad and Mario set off.                                                                                                                                                                                                                                                                                 |
| 1-0             | The warm-up. At its end Bowser appears in person, shows off his wand, quotes the note, and casts the spell: eight heroes are pulled into the eight worlds, brainwashed.                                                                                                                                                                                                                 |
| World 1         | Toad: Bowser brought people from other universes to find Peach; where's Luigi? In 1-1 a brainwashed Luigi runs away; a villager saw him go down a pipe. Freed, Luigi explains the brainwashing.                                                                                                                                                                                         |
| Worlds 2-7      | Each world is its hero's homeland (Hyrule, 20XX, Zebes, Transylvania, a ninja village, the front). A local welcomes you on the start node; NPCs in the hero's level give the hints; the freed hero talks. Each castle's fake is unmasked. With the castle cleared and the hero freed, Bowser's wand misfires and the seal to the next world breaks.                                     |
| 4-2             | Larry Koopa, angry: the king took his wand and left him a spare. Beaten, he drops his crystal ball, which from then on shows on the map where each hero hides.                                                                                                                                                                                                                          |
| World 8         | The Underworld (Blaster Master) and Bowser's own land. The last hero is a tank; her pilot Jason is lost in 8-4 after his frog. A miner found a pulled-up turnip by the lava.                                                                                                                                                                                                            |
| Bowser's Castle | (0.4.55; 8-4 before) Bowser falls. The wand flies from his hand and breaks; its pieces fall through a crack in the world. Toad stands at the end. Credits, as a false ending (`...BUT THE STORY ISN'T OVER.`). Back on the VALLEY OF BOWSER map, Toad works out Peach's note: she is in the Lost Kingdom, and the road on to Lost World 1 draws in.                                     |
| Lost Kingdom    | Everything looks like home, only meaner. Clues that someone is hiding (more pulled-up turnips, a very tall Toad). The wand broke into six pieces and the star tip: each Koopaling but Larry (Morton, Wendy, Iggy, Roy, Lemmy, Ludwig) grabs a piece and flies off in an airship; the king keeps the star tip, the wand's heart.                                                         |
| Finding Peach   | **Later release.** Decided: at the end of Lost 4-4 (Toadstool Grove), the castle's "Toad" pulls off its cap: it's Peach, hiding among the Toads. She stops hiding and joins the team.                                                                                                                                                                                                   |
| Lost 8-4        | **The main ending.** Bowser has taped the star tip to a stick and calls it a wand. Beaten at Lost 8-4, he escapes over the Farewell Sea with the star tip, but the princess is safe and the heroes stay. Credits roll (`THE END. / ...OR IS IT?`). World 9 opens by the NES rule (a Lost 8-4 clear without warps).                                                                      |
| Airships        | **Optional side quest.** Six Koopaling airships, one behind each forward warp zone in Lost worlds 1-8 (Lost 1-2 three, 5-1 one, 5-2 two). Each returns one wand piece. Toad hints that the pieces matter: put the wand back together and we could follow the king.                                                                                                                      |
| Lost A to D-4   | **The true ending, unlocked by all six pieces** (campaign). The rebuilt wand opens the way to the Far Lands (A-D); chase Bowser to the Last Glacier for the star tip. At D-4 the wand is made whole, the rift is sealed and Larry gets his wand back whole, with a lock on it. A shorter final credits roll (`...FOR REAL THIS TIME.`). Classic play keeps the NES unlock rule for A-D. |

### Story beat tiers

- **Tier 1, mandatory scenes** (they always play, as story scenes; `BACK` still skips their pages): the opening
  note, Bowser's spell at the end of 1-0, Toad's World 1 scene, the eight world gates (Bowser's misfire and Toad),
  Larry in 4-2, the crystal ball, the 8-4 wand break and the rift (Toad working out the note), the Lost Kingdom
  reveal, Peach's discovery, Bowser back at Lost 8, and the main ending at Lost 8-4 (with his escape and the
  star-tip tease).
- **Optional:** the Koopaling airships and the six wand pieces they hold. The main story never needs them; all six
  unlock the Far Lands (A-D), whose chapter ends in the true ending at Lost D-4 (a mandatory scene once unlocked).
- **Everything else** (Luigi running off in 1-1, the welcomes, the freeing talks, the castle remarks and news, the
  gate reminders, the extras) plays **once per file**; the welcomes and the hint NPCs can be talked to again any
  time.

### Who is where

| World | The hero's homeland (look)      | Hero       | Hidden in                                      | Welcome on the start node | Hint NPCs, inside the hero's level                                   |
| ----- | ------------------------------- | ---------- | ---------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| 1     | The Mushroom Kingdom (SMB)      | Luigi      | 1-1's bonus room, top-right ledge              | (Toad's scene, 2.4)       | A villager, 1-1 column 55, by the bonus pipe (57)                    |
| 2     | Hyrule (Zelda II)               | Link       | 2-1 sky palace, past the coin heaven's end     | A healer                  | The old man, by 2-1's vine block (83); a fairy, at 2-1-sky's arrival |
| 3     | The year 20XX (Mega Man)        | Mega Man   | 3-1 space station, via a hidden teleporter     | A lab robot               | Dr. Light, by 3-1's vine block (131)                                 |
| 4     | Planet Zebes (Metroid)          | Samus      | 4-2 cavern, down the vine area's warp pipe     | A scientist               | The Chozo statue, by 4-2's vine block (64)                           |
| 5     | Transylvania (Castlevania)      | Simon      | 5-1 crypt, the key's locked door in 5-1-bonus  | A merchant                | The townsperson, in 5-1's coin room (0.4.52)                         |
| 6     | A ninja village (Ninja Gaiden)  | Ryu        | 6-2 dojo, through a trick wall in a pipe room  | The village elder         | Irene Lew, at 6-2's start                                            |
| 7     | The front (Contra)              | Bill       | 7-3 camp, falling through the exploding bridge | A sergeant                | Lance, at 7-3's start                                                |
| 8     | The Underworld (Blaster Master) | Sophia III | 8-1 garage, the key's blast door in 8-1-bonus  | A miner                   | Jason, in 8-1's coin room (0.4.54)                                   |

Plus one NPC that is not a hint for a hero: the **pipe keeper** in 1-2's warp zone (2.4), who says where its pipe
goes. Hint NPCs are partners: you walk up and talk with the **TALK button** (`TALK`, the statue `READ`; not up since 0.4.43), campaign only, and they
never leave. The map titles: World 1's page is MUSHROOM KINGDOM since 0.4.36 (it was GRASS LAND), World 2's HYRULE
since 0.4.24 (it was SEA SIDE), World 3's MEGA CITY since 0.4.26 (it was NIGHT HILLS), World 4's PLANET ZEBES since
0.4.27 (it was MUSHROOM WOODS), World 5's TRANSYLVANIA since 0.4.28 (it was SKY TREES), World 6's GALESBURG since
0.4.49 (DRAGON VALLEY from 0.4.29, at first SNOW NIGHT), World 7's GALUGA ISLAND since 0.4.30 (it was CANNON COAST) and World 8's BOWSER'S
UNDERWORLD since 0.4.31 (it was BOWSER'S LAND): every SMB world is themed now (see the open questions).

## 2. The scripts, in game order

### What changed from v0.4.21

From the owner's notes of 2026-10-08. The backbone stays: Bowser's stolen wand brainwashes heroes from other
worlds to find Peach; Peach left on her own and leaves clues; the fake Bowsers in 1-4 to 7-4; Larry's wand and the
4-2 airship; the rift at 8-4 into the Lost Kingdom (Chapter 2).

1. **A new file opens in the Mushroom Kingdom** (2.1): `PRINCESS PEACH IS MISSING! SHE LEFT THIS NOTE:`, then
   the note itself, drawn as a handwritten letter on parchment. Nothing about Larry's wand at the start.
2. **1-0 ends with Bowser in person** (2.2), no silhouette: he shows off his wand, quotes the note, and his spell
   pulls the eight heroes into their worlds, shown in the captive (brainwashed) look, half hidden. Toad's 1-0
   greeting shrinks to the warm-up.
3. **Toad on the World 1 map** (2.4): Bowser brought people from other universes; we must find Peach first; where's
   Luigi?
4. **1-1 opens with brainwashed Luigi running away** and Mario's line; a villager by the bonus pipe saw him go
   down it (2.4).
5. **Freeing a hero ends with the hero talking** (all eight, 2.4-2.11): Luigi explains the brainwashing first, and
   each one after reveals a bit more. Toad's map reactions to a freed hero are gone.
6. **The hints are in the hero's level**, from NPCs you can talk to again and again: a new villager (1-1), the old
   man moved to 2-1's vine and a new fairy in 2-1-sky, Dr. Light moved to 3-1's vine, the Chozo statue moved into
   4-2, Fred by 8-4's trap pipe; the townsperson, Irene, Lance and Jason stay. New too: the pipe keeper in 1-2's
   warp zone.
7. **The fake Bowsers always unmask** (2.3a): killed with weapons, the disguise bursts and the hero jumps over the
   creature to the axe; reaching the axe, the disguise bursts, the hero looks and says it's not Bowser, and pulls
   the axe. One remark per castle.
8. **The world gates** (2.3b): to leave World N you need N-4 cleared **and** World N's hero freed. Toad reminds you
   when the hero is missing. When both are done, Bowser's wand misfires (worse each time) and Toad says we are
   weakening his spells: the road to the next world opens. Written for 1→2 to 7→8; the 8-4 rift follows the same
   rule (2.12).
9. **Each world is its hero's homeland**, and its start node has a local who welcomes you on first arrival and can
   be talked to again there (2.3b, worlds 2-8).
10. **Removed:** Toad's world entries (their clues moved to the welcomes), the restyle remarks, the missed-hero
    cards and Toad's per-hero hint lines, the joined cards (the generic crack pages included), the all-freed
    cards, and Toad's fake-Bowser explanation after 1-4 (it is in the 1-4 castle now).
11. **Kept, rewired:** Larry and the crystal ball (it now shows each world's hider from arrival), the castle news
    (with Peach's clues), Bowser's 8-4 line, the wand break, the credits, and the rift scene (now also waiting for
    Sophia III).
12. **No text moves on by itself any more** (see How to read).

**What needs code** (the script-doc test fails until all of it is in): the opening cutscene and the note (2.1);
Bowser's spell scene, replacing the shadow tease (2.2); Luigi running in 1-1 (2.4); the hint NPCs that are new or
moved, and the after-freed line every hint NPC gets (2.4-2.11); the freeing talks, between the round and the freed
card (2.13); the two unmasking scenes and the hero's remark (2.3a); the world gate: the seal, the rule, the
reminder, Bowser's cutaway, the hint line (2.3b); the welcomes: a local on each start node and talking on the
node (2.3b); the crystal ball's new use (2.7); the rift waiting for Sophia III (2.12); and removing the page
timeouts. Text-only swaps: Toad's 1-0 greeting, Toad's World 1 scene (it takes the old World 1 entry's place),
the castle pages, Larry's crystal ball and crash cards, the rift pages.

#### Open questions for the owner (0.4.23 draft)

1. **Replays.** In this draft Bowser's spell replays with 1-0, and the welcomes and hint NPCs can be talked to
   again; the opening note and the freeing talks play once. Add a way to see those again (a Story pad in the Mini
   Game Arena, or Pause → Story so far on the map)?
2. **The map titles and art.** Answered by the owner's notes 5, 18 and 21: each world, its map page and every level
   in it, is themed after the hero freed there. World 2 came first (0.4.24): its page is HYRULE, a Zelda II
   overworld, and its levels wear Zelda II looks in campaign play. World 3 followed (0.4.26): its page is MEGA CITY
   (it was NIGHT HILLS), a Mega Man 2-style city map with Dr. Light's lab and Wily's skull fortress, and its levels
   wear Mega Man 2-style stage looks. World 4 came next (0.4.27): its page is PLANET ZEBES (it was MUSHROOM WOODS),
   a Metroid-style planet map with Samus's gunship by the start, a Chozo statue by 4-2 and Tourian's glass dome over
   4-4, and its levels wear Metroid-style looks (Zebes's surface, Brinstar, Norfair, Tourian). World 5 followed
   (0.4.28): its page is TRANSYLVANIA (it was SKY TREES), a Castlevania-style night map with a village, a graveyard,
   a dead forest, a moonlit lake, the clock tower by 5-3 and Dracula's castle on its crag under 5-4, and its levels
   wear Castlevania-style looks (the courtyard gate, the catacombs, the town, the storm, the underground lake, the
   clock tower; 5-4 keeps its castle hall). World 6 followed (0.4.29): its page is DRAGON VALLEY (GALESBURG since 0.4.49; it was SNOW
   NIGHT), a ninja game's night map under a full moon with the Hayabusa village and its dojo by the start, a bamboo
   forest, the night city's rooftops and neon by 6-2, snowy mountain passes and the demon temple, Jaquio's fortress,
   over 6-4, and its levels wear ninja-game looks (a moonlit bamboo field, the city's sewers, a night harbour, a
   snowy mountain pass, the demon temple; 6-2 keeps its night city and Ryu's dojo its own). World 7 followed
   (0.4.30): its page is GALUGA ISLAND (it was CANNON COAST), a jungle run-and-gun's island at night with a
   snowfield of pillboxes round 7-1, the enemy base's defense wall beside it, the jungle, cliffs and a waterfall
   over 7-3 with the river below, the energy zone's pylons and Red Falcon's alien lair over 7-4, and its levels wear
   Contra-style looks (the snowfield, the base's corridors, the jungle shore, the jungle river, the alien lair; 7-3
   keeps its jungle and Bill's camp and the waterfall climb their own). World 8 came last (0.4.31): its page is
   BOWSER'S UNDERWORLD (it was BOWSER'S LAND), Blaster Master's Underworld broken into Bowser's land: his castle
   and the lava sea stay at 8-4, and round them lie the Underworld's gnarled forest and stone ruins, cavern
   mouths, the radioactive pit Jason fell through by 8-1 and Sophia's garage below the castle, with mutants
   hopping and flitting about; its levels wear Blaster Master-style looks (8-1 the forest and stone ruins of the
   Underworld's first area, 8-2 the techno castle, 8-3 the frozen ruins of the ice area, the coin rooms Jason's
   on-foot dungeon seen from the side). 8-4 and 8-4-end are Bowser's real castle and Chapter 1's finale and
   keep SMB's castle (the ending, the credits, Peach and the false ending and rift as they were); its water room
   keeps SMB's water and Sophia's underworld areas under it their own look.
3. **World 8's gate.** The draft makes the road into the rift wait for Sophia III too (the same rule as every
   world; Toad's reminder after the credits). Or should the rift open on 8-4 alone, with Sophia III optional?
4. **The player's hero talks** (Mario in 1-1, `<HERO>:` in Luigi's and Link's talks, the castle remarks). All are
   written to fit any hero. All right to give the heroes a voice?
5. **Dr. Light** moves from 3-1's pipe room to 3-1's vine in this draft, so the hint can't be missed. Or keep him in
   the pipe room?
6. **The Lost Kingdom's fakes** (Chapter 2): should they get the jump-over and remark scenes too? They would need
   remark lines.
7. **The castle remark** plays the first time per castle per file, so replays stay quick. Or every clear?
8. **Files from before 0.4.23**: the draft keeps every world a file has already reached open (the seals only stand
   on roads not yet opened), and seeds the new scenes as seen where their trigger is already past. Agreed?
9. **Peach's "old friends"** could pay off when she is found at Lost 4-4 (2.16, Chapter 2), for example with a
   line that she came looking for the Toads of the old stories. Add it then?

### 2.1 A new file: the princess is missing

**Trigger:** NEW. A new save file in the campaign, before the World 1 map shows for the first time. Once per file.
**Replay:** none yet (open question 1).

**Staging:** **Mario's house** (0.4.36, owner note; it was Peach's castle courtyard): a small, cozy room in SMB
colours, original art. Cream wallpaper over a wood wainscot, a plank floor, Mario's bed with its red blanket, a
mushroom lamp on the nightstand, a picture of Peach's castle, Luigi's green cap on a peg, and a window on a blue
morning with a green hill. Mario stands by the lamp, music soft. The front door **bursts open** (a bang) and Toad runs
in waving a sheet of paper; Mario starts and turns to him, and Toad stops beside him. His first card shows in the box
at the top, named like every card (`TOAD:` on its first line, as the NPC cards are):

```text
TOAD:

MARIO!!! THANK GOODNESS
YOU'RE HERE! PRINCESS PEACH
IS MISSING... SHE LEFT
THIS NOTE:
```

Old:

```text
PRINCESS PEACH IS MISSING!
SHE LEFT THIS NOTE:
```

Then the screen dims and **the note** fills the middle of it: a sheet of parchment (cream, darker torn edges,
tilted a degree or two, a pink wax seal with a little crown at the foot). The words are in **brown ink with a
handwritten feel**: the bitmap font, each letter nudged up or down a pixel at random (a fixed pattern, so it never
shimmers), written out a line at a time as if being penned; `OK` shows the rest at once, then `OK` closes it. The
announcer reads the whole note.

```text
DEAR TOAD,

BOWSER IS UP TO SOMETHING.
THIS TIME I WON'T SIT AND
WAIT TO BE RESCUED.

I'VE GONE TO FIND OLD
FRIENDS WHO CAN HELP, IN A
PLACE WHERE NO KOOPA WOULD
EVER LOOK.

DON'T WORRY ABOUT ME!
                       - P
```

(The note sets up everything after it: she left on her own, she is active, not captured; "where no Koopa would
ever look" is what Bowser quotes in 1-0 and what Toad works out at the rift; the "old friends" are the Toads she
hides among in the Lost Kingdom, Chapter 2.)

Back in the room, Toad turns to Mario (his name is not said again: the first card said it):

```text
TOAD:

THE KOOPAS ARE ALREADY OUT
HUNTING FOR HER. WE HAVE TO
FIND HER FIRST!
```

```text
TOAD:

COME ON, THE ROAD STARTS
RIGHT OUTSIDE YOUR DOOR.
LET'S GO!
```

They run out of the door to the right; the screen fades to the World 1 map, Mario on 1-0.

**Code:** `story/opening.ts` (the room, the parchment drawing and the inked font), the house's furniture in
`content/sprites/house.ts`.

### 2.2 World 1-0: the warm-up, and Bowser in person

**Toad's greeting.** REPLACES `STORY_TOAD_PAGES` in `mario-1-0.ts` (the box at the top), now one page: the
opening said the rest. **Trigger:** as now, when 1-0 starts, before the first lesson.

```text
TOAD:

WE'LL SEARCH EVERY PIPE,
VINE AND HIDDEN BLOCK! BUT
FIRST, A WARM-UP. FOLLOW
THE TIPS UP TOP!
```

**Bowser's spell.** NEW, REPLACES the shadow tease (`ShadowTeaseScene`, `STORY_TEASE_PAGES`; classic play keeps the
tease as it is). **Trigger:** since 0.4.36 (owner note) **right after the flagpole**: Bowser interrupts once
Mario is down the pole, before the walk to the castle (it was a few steps before the flagpole), every time 1-0 is
played in the campaign; on **Pause → Skip tutorial** it plays before 1-0 closes if this file has never seen it.
**Replay:** play 1-0 again from its map node.

**Music:** Bowser has **his own theme** (0.4.36, owner note), new and original: a slow, foreboding loop in C minor
in the SMB sound (`bowser-spell`, `content/music/bowser-spell.ts`). It starts as the sky dims and stops when he
vanishes; then the level-clear walk goes on with its jingle.

**Staging:**

1. The music gives way to Bowser's theme and the sky dims. A column of wand sparkles drops onto the ground between
   Mario (down the pole) and the castle, and **Bowser appears in it, in full colour** (his own castle palette, no silhouette), facing Mario.
   Mario turns to face him. The pages show in the box at the top.
2. On the second page Bowser lifts **the wand** to show it off: a short rod with a gold star on the tip (a new
   held prop), the star twinkling.
3. After the fourth page, **the spell**: he raises the wand over his head, the star flares (a steady glow with
   reduce flashing), and eight sparks shoot off the top of the screen. Cut to a dark screen with **eight small
   framed windows** in two rows of four, labelled `1` to `8` in a corner. They open one after another (half a
   second each, a rising magic shimmer), each showing a strip of its world as it looks in this game (1 the Mushroom
   Kingdom's grass, 2 a Zelda II field, 3 a Mega Man factory, 4 Brinstar's rock, 5 a Castlevania crypt, 6 a
   Ninja Gaiden street, 7 a Contra jungle, 8 the Blaster Master Underworld), and a hero pulled down into it by a
   beam of sparks: Luigi, Link, Mega Man, Samus, Simon, Ryu, Bill, Sophia III, in order. Each hero is drawn in
   **the captive palette** (the brainwashed look they have in their levels) and **half hidden**: a dark vignette
   round the window and wand sparkles drifting over the hero, so the shape reads but not the details. No names
   on screen. `OK` (or `BACK`) skips to the last page.
4. Back in 1-0 for the last page. Bowser laughs and vanishes in a puff of sparkles (the fakes' "poof"), his theme
   stops, the sky clears, and Mario walks on into the castle (the level-clear jingle).

Said (the announcer, during the spell, as `WAND_BREAK_SAID` is): _Bowser raises the wand. Eight heroes from other
worlds are pulled into the eight worlds, under his spell._

```text
BOWSER:

BWA HA HA! SO YOU'RE
LOOKING FOR THE PRINCESS
TOO, MARIO?
```

```text
BOWSER:

LIKE MY NEW WAND? ONE WAVE
AND ANYONE DOES WHATEVER I
SAY!
```

```text
BOWSER:

AND I READ HER LITTLE NOTE.
'WHERE NO KOOPA WOULD EVER
LOOK.' HMPH!
```

```text
BOWSER:

WELL, IF MY KOOPAS CAN'T
FIND HER, THEN I'LL FIND
SOMEBODY WHO WILL!
```

_(The spell.)_

```text
BOWSER:

HEROES OF OTHER WORLDS,
YOU SERVE ME NOW! FIND ME
THAT PRINCESS! BWA HA HA!
```

**Code:** NEW (Bowser's appearance and wand prop, the eight-window spell; the hero sprites in the captive palette
already exist). 1-0 is always played as Mario, so his name is written in.

### 2.3 Toad on the map, and the rules every world shares

**Toad's box** stays as decided: a `CardScene` panel **at the top of the map**, and his map sprite walks in from the
left **only for major scenes**: his World 1 scene after 1-0 (2.4), every world gate (2.3b), the airship crash
(2.7) and the 8-4 rift (2.12). Routine lines (a gate reminder, the hub and arena extras) just show the box. Each
plays **once per file** (the saved list of seen story beats). When several are due at once: the major scene first,
then reminders, then extras.

**What Toad no longer says on the map:** a world entry, a missed hero, a hero joined, all heroes freed, a restyled
level. The hints are now in the levels (below) and the news of the world comes from its local (2.3b).

**Hint NPCs** (partners). Each hero's level has at least one NPC who says where the hero is and what to try, one
step clearer than a riddle (the old rule: Toad hinted, a partner says what to try; now there is only the partner).
They stand **before the way in**, campaign only, and never leave. Talked to again, they say the same pages (the
fairy excepted since 0.4.47: her riddle first, then one clearer page). Once their hero is freed, each says one new
page instead (NEW: a small "after" line, written with each NPC).

**An NPC in every level** (0.4.40, owner: "put an NPC in every level"). Every main level 1-1 to 8-4 now has someone
to talk to, from the world's own game: Toads, Zelda II folk, Dr. Light's robots, the Federation, Transylvania's
villagers, the ninja clan, soldiers of the front and the Underworld's miners and mutants. Each speaks for the world's
hero in two states, one to three cards each: while the hero is missing they plead and say where to look (by place,
never by level number); once the hero is freed they thank you, or tell an easter egg about the hero's own game, in
words only. Their lines are under each world's **Level NPCs**.

**A world's own hero** (NEW, 0.4.47, owner). Every NPC who speaks for a hero (the hint NPCs and the level NPCs; not
the pipe keeper, who speaks for no one, nor Fred, who is home before Sophia III can play) and every world's welcome
local has a third set: one or two short cards for when the hero talking to them IS the world's own hero (a Hyrule
villager seeing Link, a Mega City robot seeing Mega Man). Warm or funny, with easter eggs about the hero's own game
in words only. Which set plays: **own hero playing > hero still missing > hero freed.** In a level it is the hero of
the player who pressed TALK; on the map, either player's hero. An own hero who is not yet freed cannot happen in the
campaign (a captive hero can't be picked: `Game.heroLocked`); only the dev "All heroes" flag allows it, and then the
own set plays too, as the order says. The welcome's first arrival is a story beat, not a talk: it always plays the
welcome. They are written under each NPC as "As <HERO>".

**Freeing a hero** (2.13 has the shared parts): the hero's first card and challenge, the round, then (NEW) **the
freed hero talks**, a few pages in their own voice, before the freed card. These talks carry the story now; each
reveals a bit more.

**The map's shadows** stay: a level cleared with its hero still hidden shows the hero's shadow by its node. Its hint
line says nothing (0.4.35, owner: the shadow is the hint; Toad's per-hero lines are removed). After Larry's
crystal ball (2.7) the shadow shows from the first arrival in a world.

### 2.3a The fake Bowsers: the disguise always comes off

As in SMB1, the "Bowsers" at the end of castles 1-4 to 7-4 are not the king. In our story they are **creatures the
king brainwashed with the stolen wand and dressed in his own shape**, so he never has to face Mario himself until
8-4. Their true forms are already in the game (1-4 Goomba, 2-4 Koopa Troopa, 3-4 Buzzy Beetle, 4-4 Spiny, 5-4
Lakitu, 6-4 Blooper, 7-4 Hammer Bro). In the campaign only (classic play keeps the NES behaviour):

1. **A tell during the fight** (KEEP, as built): every 4 s or so the disguise flickers and the true creature shows
   through, with a soft wand sparkle (a steady outline with reduce flashing). The real Bowser in 8-4 never flickers.
2. **Beaten with weapons** (fireballs, hammers, any hero's attack that would kill him): NEW. On the killing hit he
   freezes, the disguise **bursts** in a puff of wand sparkles with a "poof", and the true creature drops onto the
   bridge, dazed (little stars over its head). Play holds for a short scene: the hero runs up, **jumps over the
   creature** and walks on to the axe (up a step in the way, never through a wall: 2-4's axe stands a step above
   the bridge); there he **turns to look at it** and the hero's remark shows, as in 3 (0.4.43: the line plays
   however the fake dies); the axe goes, the bridge falls, the creature falls with it.
3. **Reaching the axe** with the fake still standing: NEW. As the hero touches the axe, play holds and the disguise
   **bursts** anyway (the "poof"). The true creature blinks on the bridge. The hero **turns to look at it**, and the
   hero's remark shows (one card, written in each world's section). The hero turns back and pulls the axe; the
   bridge falls, the creature falls.
4. **Fallen** off the level (into the lava or a pit, 0.4.43): at the axe the hero looks back where it went and
   the remark shows the same way.
5. Then, every way, the walk to Toad (up and down steps, never through a wall) and **the castle's two pages** as now (page 1: Toad on the creature; page 2,
   2 s later in the same box: the news). Both are in each world's section.

6. **Villain costumes** (NEW, 0.4.47, owner, roadmap #31). In castles 2-4 to 7-4 the fake wears a cheap costume of
   that world's own villain over the king suit (Ganon, Dr. Wily's skull machine, Mother Brain, Dracula, the Masked
   Ninja, Red Falcon; World 1's Goomba keeps the plain king suit). It is a mask, a sheet or a box: his jaw, belly,
   claws and legs still show, and the tell's flicker still shows the true form through it (with reduce flashing, the
   steady outline goes over the costume). However he dies, the costume drops in a pile where he stood, behind the
   true form, and goes down with the bridge (with a fall into the lava, it goes down with him); the screen reader
   says what it was made of. The hero's remark becomes the costume's reveal; that world's own hero (Link, Mega Man,
   Samus, Ryu, Bill) says a line of their own instead. Toad's castle pages are unchanged. Each castle below has its
   costume and lines.
7. **The Bowser bar** (NEW, 0.4.47, owner, roadmap #30). Every Bowser, fake and real, in every castle (8-4 and the
   Lost Kingdom too) has a boss health bar while the fight is on: BOWSER and five notches, centred under the HUD. It
   comes up when he comes on screen, loses a notch for each hit (the notches a hit takes glow a moment: a blink, held
   steady with reduce flashing), and after a weapon kill shows empty for a moment, then goes. A kill by the axe or a
   fall takes it away at once. Campaign only: the original Crossover shows no boss health (its HUD has the score,
   coins, world and time; its Bowser only counts five hits), so classic play keeps it that way. The screen reader
   says it as it comes up ("Bowser's health: 5 of 5.") and on each hit ("Bowser: 4 of 5.").

In co-op the player nearer the axe is the one who jumps or looks; the other stands still. **Replay:** the unmasking
plays on every clear; the remark card plays the first time per castle per file (after that the hero just looks for
a moment and pulls the axe), so replays stay quick.

**8-4 is a fake too** (NEW, 0.4.54, owner: World 8 is pure Blaster Master; the real king waits in **Bowser's
Castle**, its own place after World 8, from 0.4.55). 8-4's fake, the eighth and last, wears the Plutonium Boss
costume over a **Piranha Plant**, with the tell, the puff, the jump-over and the remark like every other fake (its
lines are in 2.11). Classic play keeps 8-4's real king, and the game's end, exactly as before.

**The real king** (KEEP: no flicker and no puff) speaks as the hero first reaches **the last castle's** bridge
(campaign), in the prompt box before the fight. It follows the finale switch (`story/finale.ts`): it plays only
where the real king waits. Since 0.4.55 that is Bowser's Castle, as its bridge section begins (it is one room); in
0.4.54, while the last castle was still 8-4 (a fake), it played nowhere and files kept the beat for it:

```text
BOWSER: NO MORE STAND-INS,
<HERO>. THIS TIME IT'S
REALLY ME! BWA HA HA!
```

The last castle's first page then confirms it was real (2.12).

**The Lost Kingdom** (Chapter 2, unchanged) has its own fake Bowsers (Lost 1-4 to 7-4). The same tell and the same
always-reveal apply there, and their castles get a reveal page too: page 1 names the creature, page 2 is the story
line (2.15). The code gives them the same true forms as worlds 1-7 (`bowser-die-N` by world number, in
`bowser.ts`): Lost 1-4 Goomba, 2-4 Koopa, 3-4 Buzzy Beetle, 4-4 Spiny, 5-4 Lakitu, 6-4 Blooper, 7-4 Hammer Bro.
(Whether the new jump-over and remark scenes play there too is open question 6.)

From world 8 on the code's die frame is the king himself, so the later fakes have no true form today. DECIDED (owner,
Oct 7): **they get true forms too**, with the same tell and the same always-reveal. These are new die frames, one per
world:

| Where                                       | True form        |
| ------------------------------------------- | ---------------- |
| Lost 8 (the stand-ins before the real king) | Bullet Bill      |
| Lost 9                                      | Cheep Cheep      |
| Lost A-4                                    | Podoboo          |
| Lost B-4                                    | Red Paratroopa   |
| Lost C-4                                    | Piranha Plant    |
| Lost D (the stand-ins before the real king) | Green Paratroopa |

The creature picks are a first proposal; the owner can swap any of them. The real king at Lost 8-4 and D-4 never
reveals anything. A-4 to C-4 get two pages like the other fake castles: page 1 the reveal, page 2 the story line.

### 2.3b The world gates, and the welcomes

**The gate rule** (NEW, campaign only). To leave World N (1-7) the player needs **both** N-4 cleared **and** World
N's hero freed. Until then the road off the map's edge toward World N+1 is not drawn, and a **seal** stands across
it at the edge: a shimmering wall of wand sparkles. No warp skips a seal in the campaign (1-2's and 4-2's warp zones
are already rewired there). Classic play and Unlock all keep today's roads.

- **The reminder** (Toad's box, routine). **Trigger:** the first time the World N map shows with N-4 cleared and
  the hero not freed. Once per file. While the seal stands, the map's hint line on the N-4 node reads
  `SEALED - FREE <NAME> FIRST` (the hero's full name, so `SEALED - FREE SOPHIA III FIRST` at most: 30 columns).
  The reminder names the level where that world's hint NPC stands.
- **The gate scene** (major). **Trigger:** the first time the World N map shows with both done (after the castle,
  or after the hero is freed, whichever comes last). Once per file. **Staging:** the map dims and a framed cutaway
  opens over it: **Bowser's throne room** (dark castle stone, lava glow below, Bowser on his throne with the wand).
  Something goes wrong with the wand, worse each time (below); Bowser reacts in one to three pages. The cutaway
  closes; on the map the seal **cracks and shatters** with a glassy sound, and the road to World N+1 draws in. Then
  Toad walks in and says we must be weakening his spells and another world is open. The lines are in each world's
  section; Bowser's misfires escalate: a sputter (1), sparks that singe his eyebrows (2), a bolt that blasts his
  portrait (3), smoke he blames on Larry's spare (4), a crack in the wand (5), a blast that wrecks his throne (6),
  a wand he can barely hold, and his challenge (7).
- **8-4** follows the same rule: its road on to the VALLEY OF BOWSER waits for Sophia III (2.12; before 0.4.55
  that road was the rift).

**The welcomes** (NEW). Worlds 2-8 are each their hero's homeland, or a piece of it the spell dragged along, laid
over the old map. **Trigger:** the first arrival on World N's start node (N = 2-8), right after the walk in from
the gate. **Staging:** a local (a new map sprite, in the style of the hero's game) stands beside the start node and
speaks in the box at the top; no Toad walk-in. **Replay:** any time, standing on the start node: the hint line
reads `TALK TO THE <LOCAL>` (for example `TALK TO THE HEALER`) and `TALK` (the TALK button, as in a level, or JUMP; never up since 0.4.43) plays the welcome again; once the
world's hero is freed it plays the local's after-freed page instead (NEW, written under each welcome). Each
welcome names the hero, says who did it (the locals don't know who: "someone"), and says where the hero was last
seen. Some carry a clue that Toad's old world entries carried (World 4's airship, World 8's turnip).

### 2.4 World 1: the Mushroom Kingdom (Luigi)

**Toad's World 1 scene.** REPLACES World 1's entry (`WORLD_ENTRY['smb-1']`). **Trigger:** back on the World 1 map
after 1-0 (cleared or skipped), before the road to 1-1 draws in. A major scene: Toad walks in. Once per file. We
don't know about the brainwashing yet.

```text
TOAD:

MARIO, DID YOU SEE THAT?!
BOWSER USED MAGIC TO BRING
PEOPLE HERE FROM OTHER
UNIVERSES!
```

```text
TOAD:

AND HE WANTS THEM TO FIND
THE PRINCESS FOR HIM. WE
HAVE TO FIND HER FIRST!
```

```text
TOAD:

WHERE'S LUIGI? WE NEED TO
FIND HIM. WE COULD REALLY
USE HIS HELP FINDING
PEACH.
```

**1-1: Luigi runs.** NEW. **Trigger:** the first time 1-1 starts on the file while Luigi is not freed, once the
player stands free. Once per file. **Staging:** play holds. Brainwashed Luigi (the captive palette, a few wand
sparkles drifting off him) stands about eight columns ahead of Mario, his back turned. He looks over his shoulder,
sees Mario, flinches, and **runs off the right of the screen** at full speed (toward the pipe at column 57). A beat
later Mario's card shows; then play goes on. Said: _A brainwashed Luigi looks back and runs away._

```text
MARIO:

WAS THAT LUIGI? WHY DID HE
LOOK LIKE THAT? LET'S GO
FIND HIM!
```

(Mario is the only hero a file has before Luigi is freed, so his name is written in.)

**Hint NPC: a villager.** NEW partner (`villager`). A Mushroom Kingdom villager (a Toad-like sprite in a different
cap colour, so he is not our Toad) on the ground at **1-1 column 55**, right before the pipe at column 57 that
leads down to Luigi's bonus room. He rubs his head.

```text
VILLAGER:

OW, MY CAP! SOME GUY IN
GREEN JUST KNOCKED ME FLAT
AND JUMPED DOWN THIS PIPE!
```

```text
VILLAGER:

HIS EYES WERE ALL GLOWY. HE
DIDN'T EVEN SAY SORRY. BE
CAREFUL DOWN THERE!
```

After Luigi is freed:

```text
VILLAGER:

THAT WAS LUIGI? HE CAME BACK
AND SAID SORRY. NICE GUY,
WHEN HE'S NOT GLOWING.
```

As Luigi (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
VILLAGER:

YOU AGAIN! ...OH, YOU'RE
NOT GLOWING. YOU STILL OWE
ME A CAP, LUIGI. A GREEN
ONE. IT SUITS YOU.
```

**Luigi, captive:** KEEP (the shared first card, 2.13, then `I KNOW NO <HERO>... RACE ME TO THE FLAG`).

**Luigi, freed.** NEW. The first freed hero, so the first to explain what is going on. **Trigger:** the race won,
before the freed card.

```text
LUIGI:

OOF... MY HEAD...
<HERO>? IS THAT YOU?
```

```text
<HERO>:

LUIGI! ...YOU DID SNAP OUT
OF IT, DIDN'T YOU?
```

```text
LUIGI:

I THINK SO! IT WAS BOWSER.
HE'S GOT A MAGIC WAND, AND
HE'S BRAINWASHING PEOPLE
TO DO HIS BIDDING!
```

```text
LUIGI:

ALL HE WANTED FROM ME WAS
ONE THING: FIND THE
PRINCESS. AND I WASN'T THE
ONLY ONE HE ZAPPED.
```

```text
LUIGI:

THERE WERE OTHERS IN THAT
SPELL. HEROES FROM OTHER
WORLDS! WE HAVE TO FIND
THEM AND SAVE THEM TOO.
```

```text
LUIGI:

BUT WHERE COULD THEY BE?
...COUNT ME IN. LET'S GO!
```

**1-2: the pipe keeper.** NEW partner (`pipe-keeper`). Not a hint for a hero: the owner asked for someone to say
where the warp zone's pipe goes. An old villager with a wrench, at **1-2 column 174**, in the warp zone, just left
of its pipes (178-186; in the campaign only the middle one works, and it opens the road to the Warp Zone hub).

```text
PIPE KEEPER:

WELCOME TO THE WARP ZONE!
I KEEP THESE PIPES. THEY
USED TO GO TO OTHER PARTS
OF THE KINGDOM...
```

```text
PIPE KEEPER:

BUT SINCE THE KING'S BIG
SPELL, ONLY THE MIDDLE ONE
WORKS, AND IT GOES SOMEWHERE
STRANGE.
```

```text
PIPE KEEPER:

A PLACE BETWEEN WORLDS!
STRANGE FOLK PLAY STRANGE
GAMES THERE. HAVE A LOOK,
IF YOU DARE.
```

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Luigi: while he is under the spell they
plead and say where to look (by place, never by level number); once he is freed they say their found lines instead.

**1-2: a cave Toad.** NEW partner (`cave-toad`). A Toad in a yellow-spotted cap and a dark miner's
vest, hiding where the heroes drop into **1-2** (column 5), clear of the `?` blocks. He saw Luigi go, and sends you
back to the villager.

```text
CAVE TOAD:

PSST! IS IT SAFE? I SAW A
GUY IN GREEN UP ON THE
FIRST ROAD. GLOWING EYES.
HE DOVE DOWN A PIPE.
```

```text
CAVE TOAD:

A VILLAGER UP THERE GOT
KNOCKED FLAT. HE SAW WHICH
PIPE. PLEASE, GO FIND THAT
POOR GUY!
```

After Luigi is freed:

```text
CAVE TOAD:

LUIGI'S FREE? PHEW! LAST
TIME MARIO WENT MISSING,
LUIGI FOUND HIM. NOW HE
CAN HELP YOU FIND PEACH.
```

As Luigi (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
CAVE TOAD:

LUIGI! YOU'RE YOU AGAIN!
SORRY, I THOUGHT YOU WERE
MARIO. ...KIDDING! NOBODY
THINKS THAT. WELL, ONE GUY.
```

**1-3: a lookout.** NEW partner (`lookout`). A Toad in a pink-spotted cap and a green vest, on the ground
at **1-3's start** (column 8), under the treetops he watches the road from.

```text
LOOKOUT:

FROM THOSE TREETOPS I CAN
SEE THE WHOLE ROAD! JUST
NOT DOWN PIPES. NOBODY CAN
SEE DOWN PIPES.
```

```text
LOOKOUT:

THE FELLOW IN GREEN WENT
DOWN ONE ON THE FIRST ROAD,
BY THE VILLAGER. PLEASE,
GO BRING HIM BACK!
```

After Luigi is freed:

```text
LOOKOUT:

LUIGI'S FREE! I WATCHED HIM
CLEAR THREE TREES IN ONE
JUMP. DON'T TELL MARIO I
SAID THAT.
```

As Luigi (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
LOOKOUT:

LUIGI! I SAW YOU JUMP FROM
UP THERE. YOU JUMP HIGHER
THAN MARIO. EVERYBODY
KNOWS IT. NOBODY SAYS IT.
```

**1-4: a retainer.** NEW partner (`retainer`). One of the princess's retainers (an orange-spotted cap, a
royal blue vest) spying in the king's castle, at the foot of **1-4's entrance steps** (column 8). While Luigi is
missing he tells of the seal on the road out (2.3b); once he is freed, of the fake's height and the oldest joke in
the kingdom.

```text
RETAINER:

SHH! I SNUCK IN TO SPY ON
THE KING. BUT THE ROAD OUT
OF THIS LAND IS SEALED BY
HIS MAGIC.
```

```text
RETAINER:

IT WON'T OPEN TILL LUIGI IS
FREE. HE WENT DOWN A PIPE
ON THE FIRST ROAD. PLEASE,
GO BACK FOR HIM!
```

After Luigi is freed:

```text
RETAINER:

LUIGI'S FREE? THEN GO GET
THE KING! BETWEEN US, HE
LOOKS SHORTER THAN USUAL
TODAY.
```

```text
RETAINER:

AND IF THE PRINCESS ISN'T
IN THIS CASTLE... WELL.
THAT HAPPENS A LOT.
```

As Luigi (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
RETAINER:

LUIGI! THE PRINCESS IS IN
ANOTHER CASTLE. ...SORRY,
IT'S A HABIT. GOOD LUCK!
```

**Castle 1-4** (a Goomba). The hero's remark (2.3a, reaching the axe):

```text
<HERO>:

WAIT... THAT'S NOT BOWSER!
IT'S A GOOMBA IN A BOWSER
SUIT!
```

The castle's pages: REPLACES `CASTLE_PAGES['1-4']`. Page 1 also carries what Toad's old map card after 1-4 said
(that card is gone).

```text
THANK YOU <HERO>!

THAT GOOMBA WAS UNDER A
SPELL! THE KING DRESSED
IT UP AS HIMSELF.
```

Then, 2 s later (second page, same box):

```text
THE REAL KING HIDES BEHIND
STAND-INS. HE FLED EAST,
WAND AND ALL.
```

**The gate, World 1 to 2.** The reminder (Luigi not freed; hint line `SEALED - FREE LUIGI FIRST`):

```text
TOAD:

THE WAY ON IS SEALED BY
BOWSER'S MAGIC... AND WE
STILL HAVEN'T FOUND LUIGI!
```

```text
TOAD:

THAT VILLAGER JUST DOWN
THE ROAD SAW WHERE HE WENT.
LET'S GO BACK AND LOOK!
```

The gate scene. Bowser's cutaway: he is admiring the wand when its star **sputters**, a weak puff of grey smoke.

```text
BOWSER:

HUH? WHAT WAS THAT? MY WAND
JUST... SPUTTERED.
```

```text
BOWSER:

...PROBABLY NOTHING. KEEP
LOOKING FOR THAT PRINCESS!
```

The seal shatters, the road to World 2 draws in, and Toad walks in:

```text
TOAD:

WHOA! DID YOU SEE THAT? WE
MUST BE WEAKENING HIS
SPELLS!
```

```text
TOAD:

AND THE WAY TO ANOTHER
WORLD JUST OPENED UP.
LET'S GO!
```

### 2.5 World 2: Hyrule (Link)

**The welcome: a healer.** A townswoman in a Zelda II town's style (long dress, a basket), beside World 2's start
node. Hint line `TALK TO THE HEALER`.

```text
HEALER:

WELCOME TO HYRULE,
TRAVELER. OR WHAT'S LEFT OF
IT. A SPELL DRAGGED OUR
LAND HERE, SEA AND ALL.
```

```text
HEALER:

OUR HERO LINK HAS BEEN
BRAINWASHED BY SOMEONE.
PLEASE HELP!
```

```text
HEALER:

HE WAS LAST SEEN ON THE
GREAT FIELD. AN OLD MAN IN
A CAVE THERE KNOWS THINGS.
HE ALWAYS DOES.
```

```text
HEALER:

LET ME HEAL YOU BEFORE YOU
GO. ...OH. YOU'RE FINE.
NEVER MIND.
```

After Link is freed (NEW, after-freed: talking to the healer again plays this page instead):

```text
HEALER:

LINK IS HIMSELF AGAIN!
THANK YOU, TRAVELER. GO ON
EAST, AND STAY HEALTHY...
I'M STILL OUT OF PATIENTS.
```

As Link (NEW, 0.4.47: talking to the healer as the world's own hero, first of the three sets):

```text
HEALER:

LINK! YOU LOOK TERRIBLE.
SIT. LET ME... OH, YOU
HAVE A FAIRY IN A BOTTLE.
THAT'S CHEATING, DEAR.
```

**2-1: the sighting.** NEW (0.4.51, `story/sightings.ts`). **Trigger:** the first time 2-1 starts on the file
while Link is neither freed nor met and 2-1 is not cleared, once every player stands on the start screen (campaign
only, never while a player is Link). Once per file (`sighting:link`). **Staging:** play holds. Brainwashed Link (the
captive palette, wand sparkles drifting off him) stands on the field ahead of the hero, his back turned, and looks
back once. Wand sparkles burst from the grass beside him and a **vine grows right out of the ground**, no brick and
no block. He climbs it out of sight, then the vine crawls up after him and is gone, so the real vine is still to be
found. A beat later player 1's hero speaks (`<HERO>` is their full name); JUMP, ATTACK or MENU skips to the card.
Said: _A brainwashed Link makes a vine grow out of the ground and climbs it into the sky. The vine follows him up._

```text
<HERO>:

WAS THAT LINK? A VINE
GREW RIGHT OUT OF THE
GROUND, AND HE CLIMBED IT
INTO THE SKY!
```

**Hint NPC: the old man, moved to the vine.** MOVES (owner): from 2-1's start (column 8) to **beside the vine block
(column 83)**: he stands on the ground a column or two before it, in front of his cave doorway (the
`partners:cave` decor moves with him; where the ground there allows). His third page (the sky's second vine) moves
to the fairy below, so each NPC gives the step in front of it.

```text
OLD MAN:

IT'S DANGEROUS TO GO
ALONE! TAKE THIS.
```

_(A single coin pops out over him, as now.)_

```text
OLD MAN:

THE SILENT ONE WAITS ABOVE
THE CLOUDS. A BRICK RIGHT
UP THERE HIDES A VINE.
```

```text
OLD MAN:

ALSO, PAY ME FOR THE DOOR
REPAIR CHARGE. ...KIDDING.
THERE IS NO DOOR.
```

After Link is freed:

```text
OLD MAN:

THE SILENT ONE THANKED ME.
WELL, HE NODDED. SAME
THING.
```

As Link (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
OLD MAN:

LINK! I GAVE YOU A SWORD
ONCE. YOU STILL HAVE IT.
GOOD. NO REFUNDS.
```

**Hint NPC: a fairy in the clouds.** NEW partner (`fairy`, owner). A small Zelda-style fairy bobbing in the air by
**2-1-sky's arrival** (column 7, beside the vine the player climbs in on at column 4), so nobody rides past her.

REWRITTEN (0.4.47, owner: "too on the nose"): she speaks in a riddle. The gold is the coin trail along the cloud
floor; the middle isle is the middle of the three small clouds past it; the nothing is the hidden vine block over it;
the green road is the vine. The crystal ball (2.7) still pinpoints the spot.

```text
FAIRY:

THE SILENT ONE? HEE HEE!
I KNOW. BUT FAIRIES ONLY
SPEAK IN RIDDLES:
```

```text
FAIRY:

FOLLOW GOLD TILL GOLD IS
GONE. ON THE MIDDLE ISLE,
KNOCK UPON NOTHING, AND A
GREEN ROAD WILL ANSWER.
```

Talked to again on the same visit, while Link is still missing (NEW, 0.4.47: one clearer fallback, said on every
talk after the first):

```text
FAIRY:

STILL LOST? FINE! RIDE THE
CLOUDS PAST THE COINS. ON
THE MIDDLE CLOUD, JUMP UP
AND BUMP THE AIR. A VINE!
```

Old:

```text
FAIRY:

THE SILENT ONE'S TEMPLE
FLOATS HIGHER STILL!
```

Old:

```text
FAIRY:

RIDE THE CLOUDS TO WHERE
THE COINS RUN OUT. THEN
JUMP, AND BUMP THE EMPTY
AIR. A VINE WILL GROW.
```

After Link is freed:

```text
FAIRY:

YOU FOUND HIM! NOW GO ON,
SHOO. FAIRIES NEED NAPS.
```

As Link (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
FAIRY:

LINK! YOU NEVER VISIT. ONLY
WHEN YOU NEED HEALING. I
SEE HOW IT IS. ...HUG?
```

**Link, captive:** KEEP (`THE SHADOW... HOLDS ME...`, the Shadow Keep).

**Link, freed.** NEW. He says little, but what he says matters: Peach is free and running, and the spell dragged
whole lands here and sealed them.

```text
LINK:

...
```

```text
<HERO>:

ARE YOU OKAY?
```

```text
LINK:

...THANK YOU. THE SHADOW
SHOWED ME HER. A PRINCESS
IN PINK, RUNNING. NOT
CAUGHT. RUNNING.
```

```text
LINK:

THE KING'S SPELL DID NOT
TAKE ONLY ME. IT TORE MY
LAND FROM ITS PLACE AND
SET IT DOWN HERE.
```

```text
LINK:

EACH HERO'S LAND IS SEALED
WITH HIS MAGIC. FREE THEM,
AND THE SEALS WILL BREAK.
```

```text
LINK:

...I WILL COME WITH YOU.
```

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Link: while he is under the spell they
plead and say where to look (by place, never by level number); once he is freed they say their found lines instead.

**2-2: Error.** NEW partner (`error`). A townsman of Hyrule (a brown hood, a red-brown cloak), on the ground below the
steps to **2-2's flag** (2-2-exit, column 15), out of the lake. A name every Zelda II player knows.

```text
ERROR:

I AM ERROR.
```

```text
ERROR:

YOU SEEK THE SILENT ONE? HE
WAS LAST SEEN ON THE GREAT
FIELD. THE OLD MAN IN THE
CAVE THERE KNOWS MORE.
```

```text
ERROR:

PLEASE FIND HIM. MY FRIEND
BAGU IS WORRIED SICK.
```

After Link is freed:

```text
ERROR:

I AM STILL ERROR.
```

```text
ERROR:

THE SILENT ONE IS FREE?
THEN NOTHING HERE IS AN
ERROR. EXCEPT ME.
```

As Link (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
ERROR:

I AM ERROR. YOU ARE LINK.
AT LAST, SOMEONE WHO GETS
MY NAME RIGHT!
```

**2-3: the river man.** NEW partner (`river-man`). An old man in a green robe at **2-3's start** (column 5),
before the stone bridges he keeps. In Hyrule nobody crosses his bridge without a note from Bagu.

```text
RIVER MAN:

HALT! NOBODY CROSSES MY
BRIDGES WITHOUT A NOTE
FROM BAGU.
```

```text
RIVER MAN:

...THE SILENT ONE CROSSED
WITHOUT ONE. HE WAS ON THE
GREAT FIELD, STARING AT THE
CLOUDS. EYES ALL WRONG.
```

```text
RIVER MAN:

GO BACK AND FIND HIM. HE
NEEDS HELP MORE THAN MY
BRIDGES NEED NOTES.
```

After Link is freed:

```text
RIVER MAN:

HALT! NOBODY CROSSES
WITHOUT A NOTE FROM BAGU.
```

```text
RIVER MAN:

THE SILENT ONE WROTE YOU
ONE? IT SAYS '...'.
GOOD ENOUGH. GO ON.
```

As Link (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
RIVER MAN:

HALT! ...OH. LINK. YOU
NEVER CARRY A NOTE, DO
YOU? CROSS. CROSS. JUST
DON'T TELL BAGU.
```

**2-4: a wise man.** NEW partner (`wise-man`). An old man in a blue robe at the foot of **2-4's entrance steps**
(column 7), before the knight statues. Freed, Link earns you a town's spell, and it does not work here.

```text
WISE MAN:

THE ROAD OUT OF HYRULE IS
SEALED. ONLY THE SILENT
ONE'S FREEDOM CAN BREAK
THE SPELL.
```

```text
WISE MAN:

SEEK HIM ABOVE THE CLOUDS
OF THE GREAT FIELD. I WOULD
GO MYSELF, BUT I'M WISE.
I KNOW BETTER.
```

After Link is freed:

```text
WISE MAN:

THE SILENT ONE IS FREE! FOR
THIS, I TEACH YOU A SPELL.
IT TURNS YOUR FOES INTO
LITTLE BLOBS.
```

```text
WISE MAN:

...NOTHING? HM. IT WORKS
BETTER BACK HOME. YOU'RE
DOING FINE WITHOUT IT.
```

As Link (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
WISE MAN:

LINK. I TAUGHT YOU THE
SPELL OF LIFE ONCE. YOU
USED IT ON A BAT. TWICE.
...WE ALL LEARN.
```

**Castle 2-4** (a Koopa Troopa), in a villain costume (NEW, 0.4.47, owner; campaign only, art by CD47 in `content/sprites/costumes.ts`): Ganon: a blue rubber pig mask with painted tusks (the king's horns and red hair stick out of it), a purple bedsheet cape with a safety-pin clasp, and a garden fork tied to his back as the trident. Shed: the bedsheet in a heap with the fork across it, the mask face up. However he dies (weapons, the axe, a fall), the costume drops in a pile where he stood (with a fall it goes down with him), the true form shows, and the screen reader says: _The Ganon costume falls off in a heap: a pig mask, a bedsheet and a garden fork._ (with a fall: "goes down with it" instead of "falls off in a heap"). The hero's remark is the reveal (REPLACES the old remark):

```text
<HERO>:

...THAT WAS A KOOPA IN A
DRESS?!
```

With Link, the castle's own hero, playing (NEW, 0.4.47: instead of the line above):

```text
LINK:

GANON?! ...NO. GANON IS
TALLER. AND NOT A KOOPA.
```

Old:

```text
<HERO>:

ANOTHER FAKE! JUST A KOOPA
TROOPA WEARING THE KING'S
FACE.
```

The castle's pages (REPLACES `CASTLE_PAGES['2-4']`):

```text
THANK YOU <HERO>!

A KOOPA UNDER THE SPELL,
IN THE KING'S SHAPE AGAIN.
```

```text
THE KOOPAS SEARCHED EVERY
CAVE IN THIS LAND. NO
PRINCESS. JUST OLD MEN.
```

**The gate, World 2 to 3.** The reminder (hint line `SEALED - FREE LINK FIRST`):

```text
TOAD:

THE WAY ON IS STILL SEALED,
AND LINK IS STILL UNDER THE
SPELL. THE OLD MAN IN THE
FIELD CAVE KNOWS, I BET.
```

The gate scene. Bowser's cutaway: the wand **sparks** in his face and singes his eyebrows (two little puffs of smoke
over his eyes).

```text
BOWSER:

OW! MY EYEBROWS! THE WAND
JUST SPARKED AT ME!
```

```text
BOWSER:

WHO'S MESSING WITH MY
SPELLS? FIND THAT PRINCESS,
YOU FOOLS!
```

```text
TOAD:

ANOTHER SEAL, GONE! EVERY
HERO WE FREE TAKES A BITE
OUT OF HIS MAGIC.
```

```text
TOAD:

THE NEXT WORLD IS OPEN. I
CAN HEAR MACHINES HUMMING
OVER THERE...
```

#### Kakariko Village (0.4.41)

NEW (owner's approved design, release 1). World 2's hidden map spot, found through the Moblin's cave, is no longer one
room but a small walled village walked from above, as in A Link to the Past: **Kakariko Village**. The spot reads TOP
SECRET AREA until the village has been found, then KAKARIKO VILLAGE. JUMP on it walks straight in through the south
gate (no character select); SELECT (TOOLS; HERO on the touch pad) switches to the next freed hero there, and some
lines below change with who is walking the village. One house's door leads into the old Top Secret Area. The shop
opened in 0.4.42 (below), and Hobb the tanner gives the Wallet. Every card is read aloud and waits for OK; BACK skips
the rest.

**The guard** at the south gate says hello as the hero walks in, the first time:

```text
GUARD:

A VILLAGE NO MAP SHOWS.
FUNNY HOW YOU FOUND IT.
```

```text
GUARD:

WELCOME TO KAKARIKO.
WIPE YOUR BOOTS. MIND
THE HEN.
```

On a later visit:

```text
GUARD:

BACK AGAIN? THE HEN
MISSED YOU.
```

**The kid** on Gate Street chases the hen (she flutters off when walked into). To most heroes:

```text
KID:

I'M GONNA CATCH THAT HEN!
SHE'S FASTER THAN SHE
LOOKS.
```

To Samus:

```text
KID:

ARE YOU A ROBOT?
```

To Mega Man:

```text
KID:

ARE YOU A ROBOT?
...COOL.
```

**Hobb the tanner** (0.4.42, owner's addendum) stands on Gate Street. On the first visit, straight after the guard's
hello (or, on a file that found the village before 0.4.42, as the hero arrives next time), he gives the Wallet,
free. The Wallet changes hands, held up over the hero's head with a short fanfare, as the last card shows; BACK
skips his cards and it is given all the same. With it coins add up to 999 and there is no 1-up at 100.

```text
HOBB:

I'M HOBB. I MAKE WALLETS.
YOURS IS A POCKET! COINS
FALL OUT AT A HUNDRED.
```

```text
HOBB:

TAKE THIS ONE. IT HOLDS
999, AND IT NEVER SPILLS.
NO CHARGE. THE SHOP WILL
BE GLAD OF YOU.
```

```text
YOU GOT THE TRAVELER'S
WALLET!

COINS ADD UP TO 999 NOW
(NO MORE 1-UP AT 100).
SPEND THEM AT THE SHOP.
```

Later, talked to:

```text
HOBB:

HOW IS THE WALLET? I
DOUBLE-STITCHED THE
CORNERS. HEROES ARE
HARD ON CORNERS.
```

**The shop's sign** (READ):

```text
THE SHOP

OPEN. COINS ONLY.
```

**The shop** (0.4.42): the shopkeeper behind his counter, and display tables with the current hero's own stock
(docs/POWERUPS.md "Kakariko shop"). Standing at a table and pressing TALK shows a card with the item's name, what it
does and its price, then BUY? YES / NO. The shopkeeper, talked to across his counter:

```text
SHOPKEEPER:

COINS? I TAKE COINS.
MOSTLY COINS. ONLY COINS.
```

```text
SHOPKEEPER:

STAND AT A TABLE AND
PRESS TALK TO BUY.
```

When an item can't be bought, the buy card says why in the shopkeeper's words, in place of BUY? YES / NO. Too few
coins (`<PRICE>` is the item's):

```text
SHOPKEEPER:

YOU NEED <PRICE> COINS.
COME BACK RICHER!
```

An item owned (SOLD OUT on its table):

```text
SHOPKEEPER:

YOU ALREADY HAVE ONE
OF THOSE.
```

A refill already full, a grow item that stacks at its maximum, or lives at 99 (FULL):

```text
SHOPKEEPER:

YOU'RE ALREADY FULL UP.
```

A refill for a hero who has nothing it fills yet (no missiles, no sub-weapon; FULL on its table too):

```text
SHOPKEEPER:

NOTHING TO FILL YET!
FIND WHAT IT FILLS FIRST.
```

The 1-up a second time in a visit, without the Wallet (SOLD OUT):

```text
SHOPKEEPER:

ONE OF THOSE A VISIT,
FRIEND. COME BACK SOON!
```

A small hero's power item (GROW FIRST; `<ITEM>` is the hero's grow item, SUPER MUSHROOM, HEART CONTAINER...):

```text
SHOPKEEPER:

GROW A LITTLE FIRST.
TRY THE <ITEM>!
```

**The woman in the square:**

```text
WOMAN:

THE WEATHERVANE POINTS
WHEREVER THE WIND LIKES.
MOSTLY AT THE SHOP.
```

**The weathervane** in the square (READ):

```text
W... E... S...

THE N FELL OFF YEARS AGO.
```

**The well** (LOOK) echoes the hero's name back:

```text
YOU CALL DOWN THE WELL.

...<HERO>...
<HERO>...
```

**The fallen log** across the west path (LOOK), the hook for a later secret:

```text
SOMEONE SHOULD MOVE THIS.

SOMEDAY.
```

**The gardener** among his cabbages. To Link:

```text
GARDENER:

YOU AGAIN! KEEP THAT
SWORD AWAY FROM MY
BUSHES.
```

To everyone else:

```text
GARDENER:

NOTHING UNDER THESE
BUSHES. I CHECKED.
```

**The old man** in his house by the well tells of the hero switch. Its button is named TOOLS (on the touch pad, HERO,
the button's own name in the village):

```text
OLD MAN:

IF YOUR HERO CAN'T MANAGE
IT, PRESS TOOLS. SOMEONE
ELSE MIGHT.
```

```text
OLD MAN:

HERE IN THE VILLAGE, ANY
FRIEND YOU'VE FREED CAN
TAKE A WALK IN YOUR PLACE.
```

**The inn.** The barkeep, across his counter (the place is named in-world, never by level number):

```text
BARKEEP:

WORD IS THERE'S A BLOCK
HIGH OVER THE GREAT
FIELD'S LAST TOWER THAT
NOBODY'S EVER BUMPED...
```

```text
BARKEEP:

...WELL. ONE PERSON.
```

Two patrons:

```text
PATRON:

IF YOU FALL IN A PIT, YOU
DROP EVERYTHING YOU CARRY.
ASK ME HOW I KNOW.
```

```text
PATRON:

I CAME FOR ONE NIGHT.
THAT WAS THREE KINGDOMS
AGO.
```

**The inn's back room** (its own door on the inn's front), a nod to Zelda II's town (World 2 is Hyrule):

```text
STRANGER:

I AM ERROR.
```

**The healer**, World 2's healer from the map, who has a house here. She heals a hero who counts hit points in full,
for free:

```text
HEALER:

LET ME SEE THOSE
SCRAPES... THERE.
GOOD AS NEW.
```

To Mario or Luigi:

```text
HEALER:

YOU LOOK FINE TO ME.
TRY A MUSHROOM.
```

To Sophia III:

```text
HEALER:

I PATCH UP PEOPLE, DEAR,
NOT TANKS. TRY A WRENCH.
```

**The family** next door to her:

```text
MOTHER:

THE HEALER NEXT DOOR
PATCHES ANYONE UP. FREE!
SHE'S BORED, YOU SEE.
```

```text
CHILD:

MY BIG BROTHER CHASES THE
HEN ALL DAY. I THINK THE
HEN IS WINNING.
```

Notices (said too; no card; they go when the hero moves or a key is pressed): a locked door (the hook for a later
secret) `CLOSED. ASK AROUND.`; SELECT with nobody else freed `NO ONE ELSE HAS JOINED YOU YET.`; a purchase, the
item's name (`SUPER MUSHROOM!`).

### 2.6 World 3: the year 20XX (Mega Man)

**The welcome: a lab robot.** A small round helper robot in Mega Man's style (one antenna, a blinking light),
beside World 3's start node. Hint line `TALK TO THE LAB ROBOT`.

```text
LAB ROBOT:

BEEP! WELCOME TO THE YEAR
20XX. WELL, A CHUNK OF IT.
YOUR KINGDOM HAS ODD
PHYSICS.
```

```text
LAB ROBOT:

OUR HERO MEGA MAN HAS BEEN
REPROGRAMMED BY SOMEONE.
PLEASE HELP! BEEP!
```

```text
LAB ROBOT:

HIS LAST SIGNAL CAME FROM
THE RADIO MASTS. DR. LIGHT
IS OUT THERE, TRACKING IT.
```

After Mega Man is freed (NEW, after-freed: talking to the lab robot again plays this page instead):

```text
LAB ROBOT:

BEEP! MEGA MAN IS BACK
ONLINE! DR. LIGHT SAYS
THANK YOU. THE ROAD AHEAD
IS CLEAR. BEEP BOOP!
```

As Mega Man (NEW, 0.4.47: talking to the lab robot as the world's own hero, first of the three sets):

```text
LAB ROBOT:

BEEP! MEGA MAN! SCANNING...
ARM CANNON: ONLINE. HELMET:
SHINY. DR. LIGHT SAYS EAT
YOUR E-TANKS. BEEP BOOP!
```

**3-1: the sighting.** NEW (0.4.51, `story/sightings.ts`). **Trigger:** the first time 3-1 starts on the file
while Mega Man is neither freed nor met and 3-1 is not cleared, once every player stands on the start screen
(campaign only, never while a player is Mega Man). Once per file (`sighting:megaman`). **Staging:** play holds.
Brainwashed Mega Man stands by the radio masts, his back turned, and blinks. The rogue program shows: his helmet
flickers off and on (with reduce flashing: off once, held). He faces the hero, gathers, and **beams straight up** as
a teleport streak (the station pad's own beam, steady with reduce flashing). A beat later player 1's hero speaks;
JUMP, ATTACK or MENU skips to the card. Said: _A brainwashed Mega Man glitches, then beams up into the sky._

```text
<HERO>:

MEGA MAN? HE FLICKERED,
THEN BEAMED STRAIGHT UP
INTO THE NIGHT SKY!
```

**Hint NPC: Dr. Light, moved to the vine.** MOVES (suggested): from 3-1's pipe room (`3-1-bonus`, which many players
never enter) to **3-1's ground beside the vine block (column 131)**, at about column 128, so the hint cannot be
missed. His first page now points at the vine; the second is as before. (If the owner prefers the pipe room, page
1's last two lines go back to `IT COMES FROM ABOVE THE / SKY. HIGHER THAN COINS GO.`)

```text
DR. LIGHT:

AH, A VISITOR! MY BOY'S
SIGNAL COMES FROM ABOVE
THE SKY. A BLOCK UP THERE
HIDES A VINE. CLIMB IT!
```

```text
DR. LIGHT:

MY OLD TELEPORTER ANSWERS
TO A HIDDEN BLOCK. PAST
THE CLOUD COINS, KEEP
JUMPING. BUMP THE AIR!
```

After Mega Man is freed:

```text
DR. LIGHT:

THANK YOU FOR BRINGING MY
BOY BACK. TAKE GOOD CARE
OF EACH OTHER!
```

As Mega Man (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
DR. LIGHT:

ROCK! MY BOY! LET ME LOOK
AT YOU. NO DENTS. YOU'VE
BEEN SAVING YOUR E-TANKS.
```

**Mega Man, captive:** KEEP (`ERROR... ROGUE PROGRAM`, the dark copy).

**Mega Man, freed.** NEW. He logged the spell while it ran him: it all comes from one wand, and every broken spell
overloads it (the rule the gates show).

```text
MEGA MAN:

SYSTEMS... REBOOTING. ROGUE
PROGRAM DELETED. THANK YOU,
<HERO>!
```

```text
MEGA MAN:

I LOGGED THE SPELL WHILE IT
RAN ME. EVERY SPELL COMES
FROM ONE SOURCE: THE WAND.
```

```text
MEGA MAN:

WHEN YOU BREAK A SPELL, ITS
ENERGY SNAPS BACK INTO THE
WAND. IT'S OVERLOADING!
```

```text
MEGA MAN:

FREE THE OTHERS, AND IT
WILL KEEP SPARKING. LET'S
GO. I'M READY!
```

**Level NPCs** (0.4.40, owner: an NPC in every level). Dr. Light's helpers, and one off-duty guard, speak for
Mega Man: missing, they plead and say where to look (by place, never by level number); freed, their found lines.

**3-2: a prune bot.** NEW partner (`prune-bot`). The lab robot in green, at **3-2's start** (column 7), keeping the
robot forest trimmed.

```text
PRUNE BOT:

BZZT. TRIMMING TREES.
WOOD MAN GROWS THEM FASTER
THAN I CAN CUT THEM.
```

```text
PRUNE BOT:

MEGA MAN? HIS SIGNAL WENT
STRANGE. DR. LIGHT TRACKS
IT BY THE RADIO MASTS.
PLEASE, HELP HIM. BZZT.
```

After Mega Man is freed:

```text
PRUNE BOT:

MEGA MAN IS BACK ONLINE!
WOOD MAN'S LEAF SHIELD? IT'S
JUST LEAVES. I RAKE THEM UP
EVERY WEEK.
```

As Mega Man (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
PRUNE BOT:

BZZT! MEGA MAN! DO NOT
SHOOT ME. I AM ONLY A
PRUNE BOT. BZZT. WE ARE
FRIENDS NOW. BZZT?
```

**3-3: a weather bot.** NEW partner (`weather-bot`). The lab robot in yellow, at **3-3's start** (column 8), on
the steel deck under the cloud platforms. Its found lines are for every player who never beat Air Man.

```text
WEATHER BOT:

FORECAST: WINDY, WITH A
CHANCE OF FLYING TURTLES.
```

```text
WEATHER BOT:

ALSO: MEGA MAN, MISSING.
LAST SIGNAL: THE RADIO
MASTS. DR. LIGHT IS THERE.
PLEASE, BRING HIM HOME.
```

After Mega Man is freed:

```text
WEATHER BOT:

FORECAST: WINDY. CAUSE: AIR
MAN. MANY HEROES CANNOT
BEAT AIR MAN.
```

```text
WEATHER BOT:

MEGA MAN CAN. I CHECKED.
HAVE A NICE DAY.
```

As Mega Man (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
WEATHER BOT:

FORECAST: CLEAR SKIES,
NOW THAT MEGA MAN IS HERE.
CHANCE OF AIR MAN: 100%.
```

**3-4: Sniper Joe.** NEW partner (`sniper-joe`). The shielded guard of Mega Man's airship (`station` sheet,
`joe-guard`), on his break at the foot of **3-4's entrance steps** (column 8), shield up. Freed, Mega Man reminds him
how the old boss's fights always ended.

```text
SNIPER JOE:

HALT! ...OH. YOU'RE NOT THE
BLUE ONE. I'M ON MY BREAK.
THE SHIELD STAYS UP. HABIT.
```

```text
SNIPER JOE:

THE BLUE ONE? THE KING'S
SPELL GOT HIM. LAST SIGNAL:
UP OVER THE RADIO MASTS.
```

```text
SNIPER JOE:

GO GET HIM. WORK IS NO FUN
WITHOUT HIM. GO, BEFORE I
CLOCK BACK IN.
```

After Mega Man is freed:

```text
SNIPER JOE:

THE BLUE ONE'S FREE? GOOD.
HE ONCE BEAT EIGHT OF MY
BOSSES IN A ROW.
```

```text
SNIPER JOE:

THE BIG BOSS ALWAYS BEGGED
FOR MERCY AT THE END. ON HIS
KNEES. EVERY. TIME.
```

As Mega Man (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
SNIPER JOE:

HALT! ...IT'S THE BLUE ONE.
I'M ON MY BREAK. THE
SHIELD STAYS UP. NOTHING
PERSONAL.
```

**Castle 3-4** (a Buzzy Beetle), in a villain costume (NEW, 0.4.47, owner; campaign only, art by CD47 in `content/sprites/costumes.ts`): Dr. Wily's skull machine: a cardboard box worn as the skull (holes cut for his horns, a big W in red marker, painted teeth, a coat-hanger antenna) and a foil-covered hula hoop round his middle as the saucer rim. Shed: the box on its back, the hoop flat behind it. However he dies (weapons, the axe, a fall), the costume drops in a pile where he stood (with a fall it goes down with him), the true form shows, and the screen reader says: _The Dr. Wily costume falls off in a heap: a cardboard box skull, a foil hula hoop and a coat hanger._ (with a fall: "goes down with it" instead of "falls off in a heap"). The hero's remark is the reveal (REPLACES the old remark):

```text
<HERO>:

THE SKULL WAS A CARDBOARD
BOX... AND THE MAD
SCIENTIST, A BUZZY BEETLE!
```

With Mega Man, the castle's own hero, playing (NEW, 0.4.47: instead of the line above):

```text
MEGA MAN:

DR. WILY?! ...NO. HIS
SKULLS NEVER HAVE HORNS.
```

Old:

```text
<HERO>:

A BUZZY BEETLE?! SO THAT'S
WHY THE SHELL WAS SO SHINY.
```

The castle's pages (REPLACES `CASTLE_PAGES['3-4']`; page 2 KEEP, Peach's clue 1: she is out there, a step ahead,
and never says where):

```text
THANK YOU <HERO>!

A BUZZY BEETLE, UNDER THE
SPELL. STILL NOT THE KING.
```

```text
SOMEONE SLIPPED THE KOOPAS
A MAP SIGNED - P. IT LED
THEM STRAIGHT INTO A
SWAMP. HA!
```

**The gate, World 3 to 4.** The reminder (hint line `SEALED - FREE MEGA MAN FIRST`):

```text
TOAD:

STILL SEALED. MEGA MAN MUST
BE OUT THERE. DR. LIGHT IS
TRACKING HIS SIGNAL OUT BY
THE RADIO MASTS!
```

The gate scene. Bowser's cutaway: the wand **fires by itself**; a bolt blasts his own portrait off the wall behind
the throne.

```text
BOWSER:

WHAT NOW?! THE WAND FIRED
BY ITSELF! MY PORTRAIT! I
LOOKED SO GOOD IN THAT!
```

```text
BOWSER:

THOSE HEROES ARE SUPPOSED
TO WORK FOR ME! WHO KEEPS
LETTING THEM GO?!
```

```text
TOAD:

THAT SEAL CRACKED LIKE AN
EGG! HIS SPELLS ARE GETTING
WEAKER, ALL RIGHT.
```

```text
TOAD:

ANOTHER WORLD IS OPEN. IT
LOOKS LIKE... A PLANET?
CAREFUL, IT'S DARK IN THERE.
```

### 2.7 World 4: Planet Zebes (Samus, and Larry Koopa)

**The welcome: a scientist.** A researcher in a lab coat and goggles, beside World 4's start node. The last page
keeps the airship clue from Toad's old World 4 entry. Hint line `TALK TO THE SCIENTIST`.

```text
SCIENTIST:

WELCOME TO PLANET ZEBES...
OR A PIECE OF IT. OUR
WHOLE RESEARCH BASE CAME
ALONG FOR THE RIDE.
```

```text
SCIENTIST:

THE HUNTER WHO GUARDS US,
SAMUS, HAS BEEN BRAINWASHED
BY SOMEONE. PLEASE HELP!
```

```text
SCIENTIST:

HER LAST READING CAME FROM
DEEP IN THE CAVERNS. THERE'S
AN OLD BIRD STATUE DOWN
THERE.
```

```text
SCIENTIST:

ALSO, A KOOPA AIRSHIP KEEPS
CIRCLING OVER THE CAVERNS.
KEEP AN EYE ON THE SKY!
```

After Samus is freed (NEW, after-freed: talking to the scientist again plays this page instead):

```text
SCIENTIST:

SAMUS IS BACK ON PATROL.
OUR BASE IS SAFE AGAIN,
THANKS TO YOU. ONWARD! THE
NEXT WORLD NEEDS YOU MORE.
```

As Samus (NEW, 0.4.47: talking to the scientist as the world's own hero, first of the three sets):

```text
SCIENTIST:

SAMUS! WE LOGGED A NEW
RECORD FOR YOU: THREE
HOURS. THE TEAM BETS YOU
CAN DO IT IN ONE.
```

**4-2: the sighting.** NEW (0.4.52, `story/sightings.ts`; 4-2 is shown as 4-1 once World 4 is reordered).
**Trigger:** the first time 4-2 starts on the file while Samus is neither freed nor met and 4-2 is not cleared, once
every player has landed from the fall in and stands on the start screen (campaign only, never while a player is
Samus). Once per file (`sighting:samus`). **Staging:** play holds. Brainwashed Samus stands on the little ledge
between the first two pits, her back turned, and looks back once. She curls into the morph ball and lays a bomb
(it blinks; steady with reduce flashing); its burst (a ring, no flash) bounces her over the next pit, and she rolls
on out of sight, deeper into the caves. A beat later player 1's hero speaks; JUMP, ATTACK or MENU skips to the card.
Said: _A brainwashed Samus curls into a ball and bombs her way off into the caves._

```text
<HERO>:

SAMUS! SHE CURLED INTO A
BALL AND BOMBED HER WAY
DEEPER INTO THE CAVES.
```

**Hint NPC: the Chozo statue, moved into 4-2.** MOVES: from 4-1's pipe room (`4-1-bonus`) into **4-2 itself**, on
the floor of its Brinstar-look underground at about **column 61**, just before the vine block (64,5) that leads up
to the vine area and its one working pipe. Its card has no speaker (prompt `READ`).

```text
AN OLD BIRD STATUE. ITS
EYES GLOW. WORDS ARE CUT
INTO ITS BASE:
```

```text
THE HUNTER SLEEPS BELOW.
CLIMB THE VINE ABOVE TO
THE PIPE THAT NO LONGER
WARPS, AND GO DOWN.
```

After Samus is freed:

```text
THE STATUE'S EYES HAVE
GONE DARK. IT LOOKS...
PLEASED?
```

As Samus (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
THE STATUE KNOWS YOU. ITS
EYES GLOW WARM. ITS HANDS
ARE EMPTY: YOU TOOK THE
MORPH BALL LONG AGO.
```

**Samus, captive:** KEEP (the parasite, the countdown).

**Samus, freed.** NEW. Her visor scanned the wand: it is not even the king's. It is Larry's (whom the player may
meet on the airship at the end of 4-2, before or after this).

```text
SAMUS:

THE PARASITE IS GONE.
THANKS, <HERO>.
I OWE YOU ONE.
```

```text
SAMUS:

MY VISOR SCANNED THAT WAND
WHILE I WAS UNDER. IT'S NOT
EVEN THE KING'S.
```

```text
SAMUS:

IT'S REGISTERED TO ONE OF
HIS KIDS, LARRY KOOPA. THE
KING ROBBED HIS OWN SON.
```

```text
SAMUS:

A KOOPA WHO ROBS HIS OWN
FAMILY. I'VE HUNTED WORSE.
NOT MANY. LET'S MOVE.
```

#### 4-2: Larry Koopa

KEEP. The king stole Larry's wand; Larry fights with a cheap spare (his sprite holds one, and he fires rings), and
helps the hunt because the king promised it back once the princess is caught.

**The anchor scene** (NEW, 0.4.39, owner's v0.4.34 play-test notes; `world/anchor-scene.ts`). **Trigger:** the
first time on the file a player lands on the floor of 4-2's hidden right zone (the dead warp pipe). Play holds: the
ground shakes (gently, and not at all with reduce flashing; never a flash), the hero stops and looks up (a `!`), the
anchor slams down through the ceiling, smashes the pipe and knocks the hero back (unhurt). Larry yells down from his
airship:

```text
LARRY KOOPA:

AFTER MY WAND, ARE YOU?!
NOBODY TAKES MY WAND!
...NOBODY ELSE, ANYWAY.
STAY RIGHT THERE!
```

He climbs down the chain, sees the hero up close, panics (a `!`, his arms thrown up) and scurries back up (said:
`Larry Koopa climbs down the chain, sees you, panics and scurries back up!`). The hero, by name:

```text
MARIO:

LET'S GET HIM!
```

```text
LUIGI:

HE'S MORE SCARED THAN ME!
LET'S GET HIM!
```

```text
LINK:

...AFTER HIM!
```

```text
MEGA MAN:

A FLYING FORTRESS? JUST
LIKE DR. WILY'S. LET'S GO!
```

```text
SAMUS:

TARGET IS RUNNING.
MOVING TO INTERCEPT.
```

```text
SIMON:

FLEE, COWARD! A BELMONT
NEVER LOSES THE TRAIL.
```

```text
RYU:

HE CANNOT OUTRUN A NINJA.
```

```text
BILL:

BOGEY'S HEADING TOPSIDE.
LET'S TAKE HIM DOWN!
```

```text
SOPHIA III:

TARGET CLIMBING. SOPHIA
III, ENGAGE PURSUIT!
```

Then play goes on up the chain into the airship (the climb arrival on its bow). Every card waits for OK; JUMP (or
MENU) between the cards, or BACK on one, skips the whole scene straight up the chain (never BACK between them: a hero
may be tapping fire). A later visit (a NO or Give up aboard, then back
to the room) shows the plain crash and the chain to climb.

**Larry in his room** (`4-2-larry`, `scenes/airship.ts`). **Trigger:** the first time the hero rises out of the
room's pipe in a run (not again on TRY AGAIN). The fight starts when it closes.

```text
LARRY KOOPA:

HEY! THE KING TOOK MY
WAND, AND ALL I GOT WAS
THIS LOUSY SPARE!
```

```text
LARRY KOOPA:

HE SAYS I GET IT BACK
WHEN THE PRINCESS IS
CAUGHT. SO BUZZ OFF!
```

Once the file has seen the anchor scene (NEW, 0.4.39), Larry knows the hero, and his first page opens instead (the
second page is the same):

```text
LARRY KOOPA:

YOU AGAIN?! THE KING TOOK
MY WAND, AND ALL I GOT WAS
THIS LOUSY SPARE!
```

**Larry beaten**: his `BWAH!` stays. **The crystal ball** (REPLACES the second page of `STORY_CRYSTAL_BALL_PAGES`;
26 columns): every hero of worlds 1-3 is already free by now (the gates), so the ball's use changes: from now on
each world's hiding level shows its hero's shadow on the map **from the first arrival** in that world, not only
after the level is cleared (NEW).

```text
LARRY DROPPED HIS
CRYSTAL BALL! IT SEES
WHEREVER THE WAND'S SPELL
IS AT WORK...
```

```text
...SO FROM NOW ON, THE MAP
SHOWS WHERE EACH HERO
HIDES!
```

**After the airship crash** (World 4 map, right after the crash cutscene; a major scene). Page 1 KEEP; page 2
REPLACES.

```text
TOAD:

NICE LANDING! I MADE THE
WRECK INTO A BONUS SPOT.
WATCH OUT FOR HAMMER BROS.
```

```text
TOAD:

AND THAT CRYSTAL BALL WILL
SHOW US WHERE EVERY HERO
HIDES, IN EVERY WORLD WE
REACH. HANDY!
```

The bonus spot's texts (`TOAD'S BONUS HOUSE`, `BEAT THE HAMMER BRO TO REOPEN`, `THE HAMMER BROS ARE BEATEN!`,
the Toad House's `PICK A BOX...`) need no change.

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Samus: missing, they plead and say where
to look (by place, never by level number); freed, their found lines.

**4-1: a Federation trooper.** NEW partner (`trooper`, new art: a white helmet with a cyan visor, blue armour), at
**4-1's start** (column 10), on the planet's surface. Freed, the oldest surprise in Samus's story.

```text
TROOPER:

THE FEDERATION SENT ONE
HUNTER TO THIS PLANET.
JUST ONE: SAMUS. NOW EVEN
SHE'S GONE DARK.
```

```text
TROOPER:

LAST READING: DEEP IN THE
CAVERNS OF BRINSTAR. AN OLD
BIRD STATUE STANDS DOWN
THERE. PLEASE, FIND HER.
```

After Samus is freed:

```text
TROOPER:

SAMUS IS BACK ON PATROL!
HALF MY SQUAD THOUGHT SHE
WAS A MAN, TILL SHE TOOK
OFF HER HELMET.
```

```text
TROOPER:

THE OTHER HALF THINK SHE'S
A ROBOT. I DON'T ASK.
```

As Samus (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
TROOPER:

SAMUS! SALUTE! ...SORRY,
I SALUTE THE SUIT. THE
SUIT IS VERY SCARY.
```

**4-3: a researcher.** NEW partner (`researcher`). The base's scientist in a yellow heat suit, at **4-3's start**
(column 8), sweating in Norfair.

```text
RESEARCHER:

PHEW. I CAME TO STUDY
NORFAIR'S HEAT. NOW I'M
MOSTLY STUDYING SWEAT.
```

```text
RESEARCHER:

SAMUS COULD WALK THROUGH
THIS. BUT SHE'S LOST IN THE
CAVERNS OF BRINSTAR. PLEASE,
BRING HER BACK!
```

After Samus is freed:

```text
RESEARCHER:

SAMUS IS FREE! SHE SAYS
NORFAIR IS NICE THIS TIME
OF YEAR. SHE HAS A HEAT
SUIT. I HAVE A LAB COAT.
```

As Samus (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
RESEARCHER:

SAMUS! CAN I SEE THE
VARIA SUIT? FOR SCIENCE?
...NO TOUCHING. RIGHT. OF
COURSE.
```

**4-4: a baby Metroid.** NEW partner (`baby-metroid`, new art: a lime dome over three red nuclei). It floats and
bobs in **4-4's** low corridor past the first lava pits (column 21); its talking reach is the floor under it. It
can't talk, so its second card is a caption, like Fred's.

```text
BABY METROID:

CHIRP? CHIRP?
```

```text
IT DRIFTS BACK THE WAY YOU
CAME, TOWARD THE CAVERNS
OF BRINSTAR, THEN BACK TO
YOU. IT MISSES THE HUNTER.
```

After Samus is freed:

```text
BABY METROID:

CHIRP!
```

```text
IT THINKS THE HUNTER IS
ITS MOTHER. NOBODY HAS THE
HEART TO TELL IT.
```

As Samus (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
BABY METROID:

CHIRP! CHIRP! CHIRP!
```

```text
IT CLINGS TO YOUR HELMET
AND WILL NOT LET GO. IT IS
VERY HAPPY. YOU ARE VERY
STICKY NOW.
```

**Castle 4-4** (a Spiny), in a villain costume (NEW, 0.4.47, owner; campaign only, art by CD47 in `content/sprites/costumes.ts`): Mother Brain: a fishbowl upside down over his head, a pink swim cap with brain squiggles inside it, a lid ring round his neck and a garden hose into his shell: a brain in a jar on legs. Shed: the bowl on its side, the cap spilled, the hose coiled. However he dies (weapons, the axe, a fall), the costume drops in a pile where he stood (with a fall it goes down with him), the true form shows, and the screen reader says: _The Mother Brain costume falls off in a heap: a fishbowl, a swim cap and a garden hose._ (with a fall: "goes down with it" instead of "falls off in a heap"). The hero's remark is the reveal (REPLACES the old remark):

```text
<HERO>:

A BRAIN IN A JAR... IT WAS
A SPINY IN A FISHBOWL!
```

With Samus, the castle's own hero, playing (NEW, 0.4.47: instead of the line above):

```text
SAMUS:

MOTHER BRAIN. ...NEGATIVE.
SPINY IN A FISHBOWL.
MISSION CONTINUES.
```

Old:

```text
<HERO>:

A SPINY! NO WONDER THAT
SUIT LOOKED SO POINTY.
```

The castle's pages (REPLACES `CASTLE_PAGES['4-4']`; the old page 2, the wand fizzling, is what the gates show now):

```text
THANK YOU <HERO>!

A SPINY UNDER THE SPELL,
IN A KING SUIT. OUCH.
```

```text
LARRY IS TELLING EVERYONE
THE KING STOLE HIS WAND.
FOR ONCE, HE'S NOT LYING.
```

**The gate, World 4 to 5.** The reminder (hint line `SEALED - FREE SAMUS FIRST`):

```text
TOAD:

STILL SEALED! WE NEED THE
HUNTER. THAT BIRD STATUE
DOWN IN THE CAVERNS MUST
KNOW WHERE SHE IS.
```

The gate scene. Bowser's cutaway: the wand **smokes** and won't stop; he shakes it, glares at it, and blames his
son (which tells a player who skipped the airship whose wand it was).

```text
BOWSER:

THE WAND IS SMOKING! IT
WON'T STOP SMOKING!
```

```text
BOWSER:

LARRY! DID YOU SWAP MY
WAND FOR YOUR CHEAP SPARE?!
...WAIT. THIS IS THE GOOD
ONE.
```

```text
TOAD:

HALFWAY THERE! HIS WAND
MUST BE SMOKING BY NOW.
```

```text
TOAD:

THE NEXT WORLD IS OPEN...
BRR. I HEAR BATS. AND
ORGAN MUSIC.
```

### 2.8 World 5: Transylvania (Simon)

**The welcome: a merchant.** A hooded Simon's Quest merchant with a sack, beside World 5's start node. Hint line
`TALK TO THE MERCHANT`.

```text
MERCHANT:

WELCOME, STRANGER, TO
TRANSYLVANIA. A FOUL SPELL
CARRIED OUR WHOLE COUNTRY
HERE. EVEN THE NIGHTS.
```

```text
MERCHANT:

OUR HERO SIMON HAS BEEN
BRAINWASHED BY SOMEONE.
PLEASE HELP!
```

```text
MERCHANT:

HE WAS LAST SEEN IN THE
OLD CASTLE AT THE END OF
THE ROAD. A TOWNSPERSON
WAITS AT ITS GATE.
```

```text
MERCHANT:

WANT TO BUY A WHITE
CRYSTAL? ...NO? NOBODY
EVER DOES.
```

After Simon is freed (NEW, after-freed: talking to the merchant again plays this page instead):

```text
MERCHANT:

SIMON WALKS FREE AGAIN!
YOU HAVE MY THANKS. NOW,
ON YOUR WAY... AND STILL
NO WHITE CRYSTAL? SHAME.
```

As Simon (NEW, 0.4.47: talking to the merchant as the world's own hero, first of the three sets):

```text
MERCHANT:

SIMON! WELCOME HOME. A
LAUREL FOR THE ROAD? A
WHITE CRYSTAL? ...JUST
GARLIC? OF COURSE. ALWAYS.
```

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Simon: missing, they plead and say where
to look (by place, never by level number); freed, their found lines, which quote the night town's famous advice.

**5-1: the sighting.** NEW (0.4.52, `story/sightings.ts`). **Trigger:** the first time 5-1 starts on the file
while Simon is neither freed nor met and 5-1 is not cleared, once every player stands on the start screen
(campaign only, never while a player is Simon). Once per file (`sighting:simon`). **Staging:** play holds.
Brainwashed Simon stands in the courtyard facing the castle; a bat flutters down and he looks back over his
shoulder at the hero. He walks (never runs) to **the crypt gate**, a portcullis in the courtyard wall by the start,
which rises for him by the curse; he steps into the dark, and it drops behind him: CLANG (a little dust, no shake),
the padlock swinging. The bat flies off. A beat later player 1's hero speaks; JUMP, ATTACK or MENU skips to the card.
Said: _A brainwashed Simon looks back, walks to the crypt gate and goes through. It slams shut behind him._

```text
<HERO>:

SIMON! HE WALKED RIGHT
THROUGH THAT GATE, AND IT
SLAMMED SHUT BEHIND HIM.
```

**The crypt gate.** NEW (0.4.52, owner; `locked-gate`, entities/objects/keys.ts). The portcullis by 5-1's start
(column 12) is always shut while Simon is captive, and never in the way (it is in the background). In reach, the
TALK button reads OPEN (`OPEN (C)` with keys, `OPEN` on the touch button; said: _A locked gate. Press OPEN to try
it._). Pressing it plays this card once a visit, the player's hero speaking; after that the strip just reads LOCKED
and the button does nothing (said once on coming near: _Locked._). Once Simon is freed it is plain scenery: shut,
no padlock, no prompt. Classic play has no gate.

```text
<HERO>:

IT'S LOCKED... THERE
MUST BE ANOTHER WAY IN!
```

**Simon's way in: the key and the locked door** (NEW, 0.4.52, owner; entities/objects/keys.ts). The real way into
the crypt is 5-1's coin room (`5-1-bonus`, down the pipe at column 156). Its lone coin brick, right over the exit
pipe (column 14, row 7), is a **key box**: bumped from below like a ? block (any hero, small or big; standing on the
pipe top it is a plain jump) the key pops out (_A key pops out._) and lands on the pipe; the box is spent. In
reach the TALK button reads PICK UP (_A key. Press PICK UP to take it._); taken (_Got the key._), a key shows in the
HUD on the carrier's side. The **locked door** in the room's left wall (column 2) reads LOCKED without it
(_A locked door._); touched by the hero carrying the key it opens by itself: the padlock drops (no flash), the key
is used up (_The key turns. The door opens._). Then UP at the open door goes down into Simon's crypt
(`5-4-crypt`, its id kept, now an area of 5-1), whose doorway leads back out of 5-1's pipe at column 163. The key
lasts one visit: lost on death, on leaving the room or on a restart (the box is full and the door locked again);
in co-op there is one key, either player can carry it, and it goes back in its box if its carrier dies. Once Simon
is freed the door stands open for good and the brick keeps its coins. No save field: the freed list decides. The
old way in, riding 5-4's down lift past the bottom of its shaft into a dungeon, is gone: 5-4's lift is a plain lift
again (the dungeon, `5-4-dungeon`, is retired: no level leads to it).

**5-1: an old woman.** NEW partner (`old-woman`). World 2's healer in a deep purple shawl, at **5-1's start**
(column 7), by the courtyard gate.

```text
OLD WOMAN:

A STRANGER, AT THIS HOUR?
THE GATES ARE NO PLACE TO
LINGER AFTER DARK, DEARIE.
```

```text
OLD WOMAN:

CURSED AGAIN, POOR SIMON,
AND NOT EVEN BY DRACULA.
HE WENT INTO THE OLD CASTLE
AT THE END OF THE ROAD.
```

```text
OLD WOMAN:

PLEASE, BRING HIM HOME. HE
NEVER WIPES HIS BOOTS, BUT
HE'S OUR BOY.
```

After Simon is freed:

```text
OLD WOMAN:

SIMON IS FREE! NOW TAKE AN
OLD WOMAN'S ADVICE:
```

```text
OLD WOMAN:

GET A SILK BAG FROM THE
GRAVEYARD DUCK TO LIVE
LONGER.
```

```text
OLD WOMAN:

...WHAT? IT'S GOOD ADVICE.
```

As Simon (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
OLD WOMAN:

SIMON, DEARIE! WIPE YOUR
BOOTS. AND TAKE A ROAST.
YOU FIND THEM IN WALLS,
YOU KNOW. NOBODY ASKS WHY.
```

**5-2: a garlic seller.** NEW partner (`garlic-seller`). World 5's merchant in a green hood, his sack white with
garlic, at **5-2's start** (column 7), on the town street.

```text
GARLIC SELLER:

GARLIC! FRESH GARLIC! KEEPS
VAMPIRES AWAY! ...MOSTLY.
```

```text
GARLIC SELLER:

SIMON? THE CURSE TOOK HIM
TO THE OLD CASTLE AT THE
END OF THE ROAD. PLEASE,
GO! FIRST CLOVE IS FREE.
```

After Simon is freed:

```text
GARLIC SELLER:

SIMON CAME BY AND BOUGHT
GARLIC. HE ALWAYS BUYS
GARLIC. THEN HE DROPS IT
IN A GRAVEYARD. EVERY TIME.
```

As Simon (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
GARLIC SELLER:

SIMON! THE USUAL? ONE
CLOVE, FOR DROPPING IN A
GRAVEYARD? ON THE HOUSE.
```

**5-3: the clockmaker.** NEW partner (`clockmaker`). The night town's townsperson in a grey hood and a blue smock,
on **5-3's way out** (column 147), on the floor below the steps to the flag: the flying Bullet Bills cover the clock
tower up to column 126, so he waits past them, where stopping to talk is safe.

```text
CLOCKMAKER:

TICK, TOCK. THIS CLOCK HAS
STRUCK MIDNIGHT ALL WEEK.
A CURSED HOUR, IF YOU ASK
ME.
```

```text
CLOCKMAKER:

SIMON COULD BREAK IT. BUT
HE'S LOST IN THE OLD CASTLE
AT THE END OF THE ROAD.
PLEASE, BRING HIM BACK.
```

After Simon is freed:

```text
CLOCKMAKER:

THE MORNING SUN HAS
VANQUISHED THE HORRIBLE
NIGHT.
```

```text
CLOCKMAKER:

...OR IT WILL. THE CLOCK
STILL SAYS MIDNIGHT. BUT
SIMON'S FREE, SO I HAVE
HOPE.
```

As Simon (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
CLOCKMAKER:

SIMON! DAY AND NIGHT PASS
SO FAST WHEN YOU ARE HERE.
MY CLOCKS CANNOT KEEP UP.
```

**Hint NPC: the townsperson.** MOVES (0.4.52, owner): from the start of 5-4 to **5-1's coin room** (`5-1-bonus`,
column 8), between the key box and the locked door. He lost the key (option A; his old lift hints went with the
lift route).

```text
TOWNSPERSON:

WHAT A HORRIBLE NIGHT TO
LOSE A KEY. IT OPENS THAT
OLD DOOR. I DROPPED IT
SOMEWHERE IN THIS ROOM.
```

After Simon is freed:

```text
TOWNSPERSON:

THE DOOR IS OPEN FOR GOOD.
WHAT A WONDERFUL NIGHT TO
HAVE NO CURSE.
```

As Simon (NEW, 0.4.52: his own line, the old one went to the hall with the joke):

```text
TOWNSPERSON:

SIMON! YOUR OWN CRYPT, AND
I LOST ITS KEY. WHAT A
HORRIBLE NIGHT TO BE ME.
```

**5-4: a townsperson in the hall.** NEW id (0.4.52, `hall-townsperson`, the same figure): someone still stands on
5-4's safe floor at the start (an NPC in every level, 0.4.40), with only the night's joke and its thanks; the lift and
cracked-wall hints went with that old way in.

```text
TOWNSPERSON:

WHAT A HORRIBLE NIGHT TO
HAVE A CURSE.
```

After Simon is freed:

```text
TOWNSPERSON:

THE HUNTER IS FREE! WHAT A
WONDERFUL NIGHT TO HAVE NO
CURSE.
```

As Simon (the line the townsperson said at 5-4 since 0.4.47):

```text
TOWNSPERSON:

SIMON! A HORRIBLE NIGHT,
BUT YOU ARE HERE. I WILL
SAY NOTHING USEFUL, AS
IS OUR TRADITION.
```

**Simon, captive:** KEEP, with the stolen wand in his curse (already built):

```text
THE STOLEN WAND WOKE THE
CURSE DRACULA LEFT IN MY
BLOOD. NOW I AM HIS THRALL.

<HERO>... TAKE MY WHIP.
END HIM IN HIS CASTLE!
```

**Simon, freed.** NEW. Under the curse he hunted the princess himself, and learned she is no damsel: she warns
villages and lays false trails (it backs up castle 3-4's map and castle 5-4's empty village).

```text
SIMON:

THE CURSE IS LIFTED. MY
BLOOD RUNS CLEAN AGAIN. I
AM IN YOUR DEBT, <HERO>.
```

```text
SIMON:

UNDER THE CURSE, I HUNTED
YOUR PRINCESS. EVERY TRAIL
WENT COLD. EVERY ONE.
```

```text
SIMON:

SHE WARNS VILLAGES BEFORE
THE KOOPAS COME. SHE LAYS
FALSE TRACKS. NO HUNTER
COULD CATCH HER.
```

```text
SIMON:

YOUR PRINCESS IS NO DAMSEL.
BUT WE SHOULD FIND HER
BEFORE THE KING DOES. LEAD
ON.
```

**Castle 5-4** (a Lakitu), in a villain costume (NEW, 0.4.47, owner; campaign only, art by CD47 in `content/sprites/costumes.ts`): Dracula: a slicked dark wig with a widow's peak (his horns poke through), a tall red collar, a cheap blue satin cape with a red lining, two plastic fangs and a gold medallion. Shed: the cape flat, lining up, the wig in a heap, the fangs in front. However he dies (weapons, the axe, a fall), the costume drops in a pile where he stood (with a fall it goes down with him), the true form shows, and the screen reader says: _The Dracula costume falls off in a heap: a wig, a satin cape and plastic fangs._ (with a fall: "goes down with it" instead of "falls off in a heap"). The hero's remark is the reveal (REPLACES the old remark):

```text
<HERO>:

A VAMPIRE?! NO... JUST A
LAKITU WITH HAIR GEL.
```

No home line for Simon: he was freed inside 5-4 itself and never met its fake on a first clear (the remark plays once per file). Since 0.4.52 he is freed in 5-1, so he can meet it; his own line there is still to write (the shared one plays).

Old:

```text
<HERO>:

A LAKITU?! WITHOUT ITS
CLOUD IT LOOKS SO SMALL.
```

The castle's pages (REPLACES `CASTLE_PAGES['5-4']`; page 2 KEEP, Peach's clue 2):

```text
THANK YOU <HERO>!

A LAKITU, OF ALL THINGS!
UNDER THE SPELL LIKE THE
REST.
```

```text
THE KOOPAS STORMED OUR
VILLAGE, BUT IT WAS EMPTY.
SOMEONE GOT US ALL OUT
JUST BEFORE THEY CAME.
```

**The gate, World 5 to 6.** The reminder (hint line `SEALED - FREE SIMON FIRST`):

```text
TOAD:

STILL SEALED. THE VAMPIRE
HUNTER! A TOWNSPERSON IN
THE CATACOMBS LOST A KEY.
SOMETHING ABOUT A DOOR...
```

The gate scene. Bowser's cutaway: he turns the wand in his claws and finds **a crack** running up the rod, glowing.

```text
BOWSER:

IS THAT... A CRACK? THAT'S
A CRACK! WHO PUT A CRACK IN
MY WAND?!
```

```text
BOWSER:

...NOBODY TELL LARRY.
```

```text
TOAD:

FIVE SEALS DOWN! THEY BREAK
EASIER EVERY TIME. HE'S
RUNNING OUT OF MAGIC!
```

```text
TOAD:

THE NEXT WORLD IS OPEN. IT'S
SNOWING THERE, AND I SAW A
SHADOW ON A ROOFTOP...
```

### 2.9 World 6: a ninja village (Ryu)

**The welcome: the village elder.** An old ninja in a grey hood with a walking stick, beside World 6's start node.
Hint line `TALK TO THE ELDER`.

```text
ELDER:

WELCOME TO OUR NINJA
VILLAGE. A DARK SPELL
BROUGHT IT HERE, SNOW AND
ALL.
```

```text
ELDER:

OUR YOUNG MASTER RYU HAS
BEEN BRAINWASHED BY
SOMEONE. PLEASE HELP!
```

```text
ELDER:

HE WAS LAST SEEN IN THE
CITY STREETS AT NIGHT. AN
AMERICAN AGENT IS ON HIS
TRAIL.
```

```text
ELDER:

A NINJA IS SEEN ONLY IF HE
WISHES TO BE. DO NOT LOOK
FOR HIM. LOOK FOR WHAT
HIDES HIM.
```

After Ryu is freed (NEW, after-freed: talking to the elder again plays this page instead):

```text
ELDER:

MASTER RYU HAS RETURNED TO
HIMSELF. THE VILLAGE OWES
YOU A DEBT. GO NOW. THE
PATH AHEAD IS YOURS.
```

As Ryu (NEW, 0.4.47: talking to the elder as the world's own hero, first of the three sets):

```text
ELDER:

RYU. YOU RETURN, AS YOUR
FATHER DID. SIT, DRINK
TEA. ...NO? ALWAYS RUNNING
UP WALLS, THIS ONE.
```

**6-2 (shown 6-1): the sighting.** NEW (0.4.53, `story/sightings.ts`). **Trigger:** the first time 6-2 starts on
the file while Ryu is neither freed nor met and 6-2 is not cleared, once every player stands on the start screen
(campaign only, never while a player is Ryu). Once per file (`sighting:ryu`). **Staging:** play holds. Brainwashed Ryu
(the captive palette, wand sparkles drifting off him) **drops in spinning** from above the screen and lands crouched
on the street between the hero and Irene, facing the hero. He dashes left to the **start castle's wall** and presses
into it, and a panel there **spins him through**: the trick wall's own half turn, in the castle's brick, then back.
It is scene-only (drawn only while it turns, with no shuriken mark): at rest it is the castle's own wall, and nothing
in the level changes. A beat later player 1's hero speaks; JUMP, ATTACK or MENU skips to the card. Said: _A
brainwashed Ryu drops in front of you, dashes to the castle wall, and a panel spins him through it._

```text
<HERO>:

RYU? HE WENT RIGHT
THROUGH THAT WALL! IT
SPUN, AND HE WAS GONE.
```

**Hint NPC: Irene Lew.** KEEP, on the ground at the start of 6-2, before the first pipe (column 19), the pipe down
to the room with the trick wall.

```text
IRENE:

AGENT IRENE LEW, CIA.
I'M TRACKING A NINJA. HE
WENT DOWN THE FIRST PIPE
ON THIS ROAD...
```

```text
IRENE:

...AND NEVER CAME OUT.
NINJAS. THEY NEVER USE
THE DOOR. LEAN ON THE
LEFT WALL DOWN THERE.
```

After Ryu is freed:

```text
IRENE:

YOU FOUND HIM! HE THANKED
ME, THEN VANISHED. NINJAS.
```

As Ryu (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
IRENE:

RYU. YOU NEVER USE THE
DOOR, DO YOU? ...IT'S
GOOD TO SEE YOU.
```

**Ryu, captive:** KEEP (the Masked Ninja's curse; the Masked Ninja stays an original villain).

**Ryu, freed.** NEW. He saw the king's plan (no stand-ins left; he will fight in his own castle) and, once, the
princess (Peach clue: she is that good).

```text
RYU:

THE MASK IS BROKEN. MY
BLADE IS MY OWN AGAIN.
```

```text
RYU:

I SAW THE KING'S PLAN WHILE
I SERVED HIM. HIS STAND-INS
ARE NEARLY SPENT.
```

```text
RYU:

WHEN THE LAST ONE FALLS, HE
WILL HIDE IN HIS OWN
CASTLE AND FIGHT YOU
HIMSELF.
```

```text
RYU:

AND I SAW YOUR PRINCESS
ONCE, ON A ROOFTOP. SHE SAW
ME TOO, AND VANISHED.
LIKE A NINJA.
```

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Ryu: missing, they plead and say where to
look (by place, never by level number); freed, their found lines.

**6-1: a ninja.** NEW partner (`ninja`, new art: a charcoal hood and mask, a red sash). One of Ryu's clan, at
**6-1's start** (column 10), in the moonlit field. Freed, he remembers the duel Ryu's story opens with.

```text
NINJA:

...YOU SAW ME? THEN I AM
NO NINJA. HMPH.
```

```text
NINJA:

OUR MASTER RYU IS LOST TO
A SPELL. SEEK THE CITY
STREETS AT NIGHT, WHERE AN
AGENT TRACKS HIM. GO.
```

After Ryu is freed:

```text
NINJA:

MASTER RYU IS FREE. HIS
FATHER ONCE FOUGHT A DUEL
ON A FIELD LIKE THIS, UNDER
A MOON LIKE THIS.
```

```text
NINJA:

TWO LEAPS. ONE STRIKE. THE
GRASS STILL TALKS ABOUT IT.
```

As Ryu (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
NINJA:

MASTER RYU! ...YOU SAW
ME FIRST. I WILL TRAIN
HARDER. MUCH HARDER.
```

**6-3: a hermit.** NEW partner (`hermit`). World 6's elder in a red-brown robe, at **6-3's start** (column 8), at
the foot of the snowy pass. Freed, he warns of what every ninja on a cliff fears.

```text
HERMIT:

COLD, ISN'T IT? THE SPELL
BROUGHT OUR SNOW ALONG.
AND TOOK OUR NINJA.
```

```text
HERMIT:

SEEK RYU IN THE CITY
STREETS AT NIGHT. AN
AMERICAN AGENT IS ON HIS
TRAIL. GO, AND HURRY.
```

After Ryu is freed:

```text
HERMIT:

RYU IS FREE. GOOD. NOW, ON
THESE CLIFFS, A WARNING:
```

```text
HERMIT:

BEWARE THE BIRDS. EVERY
NINJA FEARS THE BIRDS.
THEY KNOW WHAT THEY DID.
```

As Ryu (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
HERMIT:

RYU. YOU CLIMB THESE
CLIFFS LIKE YOUR FATHER.
HE ALSO FELL OFF THEM.
BIRDS. ALWAYS THE BIRDS.
```

**6-4: a clan scout.** NEW partner (`clan-scout`). The ninja in forest green with a yellow sash, at the foot of
**6-4's entrance steps** (column 8). Freed, the temple rule every Ninja Gaiden player remembers.

```text
CLAN SCOUT:

THE WAY OUT OF THIS VALLEY
IS SEALED UNTIL MASTER RYU
IS FREE.
```

```text
CLAN SCOUT:

HE WAS LAST SEEN IN THE
CITY STREETS AT NIGHT. GO.
THE CLAN IS COUNTING ON
YOU.
```

After Ryu is freed:

```text
CLAN SCOUT:

MASTER RYU IS FREE. HEED
THIS: IN OUR LAST TEMPLE,
FALL TO THE DEMON AND YOU
START AGAIN FROM FAR BELOW.
```

```text
CLAN SCOUT:

HERE? I DON'T KNOW. DON'T
FALL.
```

As Ryu (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
CLAN SCOUT:

MASTER RYU! THE CLAN
SALUTES YOU. I ALSO
SALUTE. WITH BOTH HANDS.
I AM VERY EXCITED.
```

**Castle 6-4** (a Blooper), in a villain costume (NEW, 0.4.47, owner; campaign only, art by CD47 in `content/sprites/costumes.ts`): the Masked Ninja (a knock-off of the mini-game's rival): a crimson card mask with a painted scowl tied on with string, a mop head for the white mane (the handle still sticking out), a dark bathrobe with a crimson belt and a wooden toy sword. Shed: the mask face up, the mop in a tangle, the sword along the floor. However he dies (weapons, the axe, a fall), the costume drops in a pile where he stood (with a fall it goes down with him), the true form shows, and the screen reader says: _The Masked Ninja costume falls off in a heap: a paper mask, a mop head, a bathrobe and a toy sword._ (with a fall: "goes down with it" instead of "falls off in a heap"). The hero's remark is the reveal (REPLACES the old remark):

```text
<HERO>:

A BLOOPER IN A MOP AND A
PAPER MASK?! HOW IS IT
EVEN BREATHING?
```

With Ryu, the castle's own hero, playing (NEW, 0.4.47: instead of the line above):

```text
RYU:

A FAKE MASK, A FAKE BLADE.
AN INSULT TO MY RIVAL.
```

Old:

```text
<HERO>:

A BLOOPER?! IN A CASTLE?
HOW IS IT EVEN BREATHING?
```

The castle's pages (REPLACES `CASTLE_PAGES['6-4']`; page 2 KEEP):

```text
THANK YOU <HERO>!

A BLOOPER?! THE WAND'S
TRICKS ARE GETTING SILLY.
```

```text
THE KING SLEEPS WITH THE
WAND UNDER HIS PILLOW NOW.
HE KNOWS YOU'RE COMING.
```

**The gate, World 6 to 7.** The reminder (hint line `SEALED - FREE RYU FIRST`):

```text
TOAD:

STILL SEALED. WE NEED THE
NINJA. THAT AGENT IN THE
CITY STREETS WAS TRACKING
HIM!
```

The gate scene. Bowser's cutaway: the wand **bucks** in his hand and a blast blows the throne to pieces under him;
he lands on his shell.

```text
BOWSER:

WHOA! WHOA! THE WAND JUST
BLASTED MY THRONE TO BITS!
```

```text
BOWSER:

GRR! FINE! WHO NEEDS A
THRONE? KOOPAS! DOUBLE THE
GUARDS!
```

```text
TOAD:

SIX SEALS! I COULD HEAR
THAT ONE CRACK FROM HERE.
```

```text
TOAD:

THE NEXT WORLD IS OPEN. A
JUNGLE... AND EXPLOSIONS.
LOTS OF EXPLOSIONS.
```

### 2.10 World 7: the front (Bill)

**The welcome: a sergeant.** A soldier in a helmet with a radio on his back, beside World 7's start node. Hint line
`TALK TO THE SERGEANT`.

```text
SERGEANT:

WELCOME TO THE FRONT,
SOLDIER. SOME SPELL DROPPED
OUR WHOLE JUNGLE HERE,
ALIENS AND ALL.
```

```text
SERGEANT:

OUR BEST MAN, BILL, HAS
BEEN BRAINWASHED BY
SOMEONE. PLEASE HELP!
```

```text
SERGEANT:

HE WAS LAST SEEN IN THE
DEEP JUNGLE, BY THE BRIDGES.
HIS PARTNER LANCE IS
WAITING THERE. MOVE OUT!
```

After Bill is freed (NEW, after-freed: talking to the sergeant again plays this page instead):

```text
SERGEANT:

BILL'S BACK IN THE FIGHT!
GOOD WORK, SOLDIER. THE
WHOLE UNIT SALUTES YOU.
NOW MOVE OUT!
```

As Bill (NEW, 0.4.47: talking to the sergeant as the world's own hero, first of the three sets):

```text
SERGEANT:

BILL! AT EASE, SOLDIER.
YOU'RE OUT OF UNIFORM.
...NO SHIRT? AGAIN? FINE.
CARRY ON.
```

**7-3 (shown 7-1): the sighting.** NEW (0.4.53, `story/sightings.ts`). **Trigger:** the first time 7-3 starts on
the file while Bill is neither freed nor met and 7-3 is not cleared, once every player stands on the start screen
(campaign only, never while a player is Bill). Once per file (`sighting:bill`). **Staging:** play holds. Brainwashed
Bill lies prone on the stone blocks ahead, springs up and looks back at the hero (and Lance), then rolls off the edge
and catches the underside of the **first bridge**: he goes **hand over hand** under the girder while the camera eases
right with him, and out of view. Off screen he lets go: a falling whistle and a thud (never shown: the pit under that
bridge is deadly), then far ahead a boom. The camera comes back. A beat later player 1's hero speaks; JUMP, ATTACK or
MENU skips to the card. Said: _A brainwashed Bill swings hand over hand under the bridge and out of sight. He lets go;
far ahead, something explodes._

```text
<HERO>:

BILL! HE WENT HAND OVER
HAND UNDER THE BRIDGE...
THEN LET GO. THEN, BOOM!
```

**Hint NPC: Lance.** KEEP, in the jungle at the start of 7-3, well before the marked bridge at column 128.

```text
LANCE:

SEEN MY PARTNER? WE CAME
TO STOP AN ALIEN. NOW HE
WORKS FOR IT.
```

```text
LANCE:

LAST I SAW, HE WAS ON THE
BRIDGE BY THE RED LIGHT. IT
BLEW UP UNDER HIM. HE DIDN'T
RUN. HE NEVER RUNS.
```

After Bill is freed:

```text
LANCE:

THANKS FOR BRINGING MY
PARTNER BACK. I OWE YOU A
SPREAD GUN.
```

As Bill (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
LANCE:

BILL! ABOUT TIME, PARTNER.
RACE YOU TO THE BASE. LAST
ONE THERE BUYS THE SPREAD
GUNS.
```

**Bill, captive:** KEEP (Red Falcon, `KING KOOPA'S SPELL LET THE ALIEN TAKE MY MIND`, and the Jungle Assault
briefing).

**Bill, freed.** NEW. The soldier's report: the wand is about to go, and one world is left.

```text
BILL:

ALIEN'S OUT OF MY HEAD.
FEELS GOOD. THANKS,
<HERO>.
```

```text
BILL:

INTEL: THE KING'S WAND HAS
MORE CRACKS THAN MY OLD
HELMET. IT'S ABOUT TO GO.
```

```text
BILL:

ONE WORLD LEFT. ONE HERO
LEFT. THEN WE HIT THE
KING'S BASE. LOCK AND
LOAD!
```

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Bill: missing, they plead and say where
to look (by place, never by level number); freed, their found lines.

**7-1: a corporal.** NEW partner (`corporal`). World 7's sergeant in snow gear, on watch at **7-1's start** (column
5, left of where the camera would bring the Bill Blaster at 19 on screen and start it firing). Freed, Bill's famous secret, half remembered (it names no button: he forgets before he gets there).

```text
CORPORAL:

EYES UP! THE ALIEN BASE IS
DEAD AHEAD. SO ARE THE
ALIENS.
```

```text
CORPORAL:

WE LOST BILL TO SOME SPELL.
LAST SEEN IN THE DEEP
JUNGLE, BY THE BRIDGES.
BRING HIM BACK. PLEASE.
```

After Bill is freed:

```text
CORPORAL:

BILL'S BACK! HE TAUGHT ME A
SECRET CODE ONCE. UP, UP,
DOWN, DOWN... THEN I FORGOT
THE REST.
```

```text
CORPORAL:

SOMETHING ABOUT THIRTY
LIVES. I COULD USE THIRTY
LIVES.
```

As Bill (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
CORPORAL:

BILL! SIR! TEACH ME THE
CODE AGAIN? UP, UP, DOWN,
DOWN... AND THEN WHAT?
```

**7-2: a river scout.** NEW partner (`river-scout`). The sergeant in tan fatigues, on the bank below the steps to
**7-2's flag** (7-2-exit, column 15), out of the river. Freed, the rumour from the lands where Bill's game was
sold with robots in it.

```text
RIVER SCOUT:

YOU SWAM THAT RIVER? NICE.
THE ALIENS HATE WATER.
...PROBABLY.
```

```text
RIVER SCOUT:

BILL'S STILL OUT THERE,
UNDER THE SPELL. DEEP
JUNGLE, BY THE BRIDGES.
BRING HIM HOME, SOLDIER.
```

After Bill is freed:

```text
RIVER SCOUT:

BILL'S FREE! FUNNY THING:
IN SOME LANDS, THEY SAY
BILL AND LANCE ARE ROBOTS.
```

```text
RIVER SCOUT:

I'VE MET BILL. HE'S NOT A
ROBOT. ...PRETTY SURE.
```

As Bill (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
RIVER SCOUT:

BILL! YOU SWAM THAT RIVER
WITH ONLY YOUR HEAD UP,
LIKE ALWAYS. HOW DO YOU
SHOOT LIKE THAT?
```

**7-4: a medic.** NEW partner (`medic`). The sergeant in white with a red medical pack, at the foot of **7-4's
entrance steps** (column 8), in the alien lair.

```text
MEDIC:

STAY BACK! THIS PLACE IS
ALIVE. THE WALLS ARE
BREATHING.
```

```text
MEDIC:

AND THE ROAD OFF THIS
ISLAND IS SEALED TILL BILL'S
FREE. DEEP JUNGLE, BY THE
BRIDGES. HURRY, PLEASE!
```

After Bill is freed:

```text
MEDIC:

BILL'S FREE, AND HE NEVER
EVEN NEEDED ME. ONE HIT
AND HE'S DOWN, SURE. BUT HE
NEVER STAYS DOWN.
```

As Bill (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
MEDIC:

BILL! LET ME CHECK YOU.
ONE HIT, AND... NOPE. NO
MEDICINE FOR THAT. JUST
DUCK, OKAY?
```

**Castle 7-4** (a Hammer Bro), in a villain costume (NEW, 0.4.47, owner; campaign only, art by CD47 in `content/sprites/costumes.ts`): Red Falcon: a lumpy crimson rubber alien head too big for him, with a bony crest, mandibles and three eyes (two painted on, one the hole his real eye looks out of), and a white T-shirt with a red falcon printed on it. Shed: the head on its side, the T-shirt crumpled beside it. However he dies (weapons, the axe, a fall), the costume drops in a pile where he stood (with a fall it goes down with him), the true form shows, and the screen reader says: _The Red Falcon costume falls off in a heap: a rubber alien head and a souvenir T-shirt._ (with a fall: "goes down with it" instead of "falls off in a heap"). The hero's remark is the reveal (REPLACES the old remark). REWORDED (0.4.53, owner): fake #8 now waits at 8-4, so
Red Falcon is no longer "the last fake" (0.4.47 said `THE LAST FAKE... IN A` / `SOUVENIR T-SHIRT?! THE` / `REAL KING
MUST BE CLOSE.`); the souvenir T-shirt stays and the hint is softened:

```text
<HERO>:

ANOTHER FAKE... IN A
SOUVENIR T-SHIRT?! THE
REAL KING CAN'T BE FAR.
```

With Bill, the castle's own hero, playing (NEW, 0.4.47: instead of the line above, keeping its hint that the real
king is near; REWORDED 0.4.53, it said `LAST FAKE. THE REAL KING` / `MUST BE CLOSE.`):

```text
BILL:

I'VE SEEN THE REAL ALIEN.
IT DIDN'T WEAR A T-SHIRT.
ANOTHER FAKE. THE REAL
KING CAN'T BE FAR.
```

Old:

```text
<HERO>:

A HAMMER BRO! THE LAST
FAKE. THE REAL KING MUST
BE CLOSE.
```

The castle's pages (REPLACES `CASTLE_PAGES['7-4']`; the old page 2, the wand cracking, is the gates' now). REWORDED
(0.4.53, with the remark: page 1 said `SPELL. THAT WAS HIS LAST` / `STAND-IN!`, but fake #8 waits at 8-4):

```text
THANK YOU <HERO>!

A HAMMER BRO UNDER THE
SPELL. ANOTHER OF HIS
STAND-INS!
```

```text
THE KOOPAS ARE ALL RUNNING
HOME. THE KING CALLED THEM
BACK TO GUARD HIS CASTLE.
```

**The gate, World 7 to 8.** The reminder (hint line `SEALED - FREE BILL FIRST`):

```text
TOAD:

STILL SEALED. WE NEED THE
SOLDIER. HIS PARTNER LANCE
IS WAITING IN THE DEEP
JUNGLE, BY THE BRIDGES.
```

The gate scene. Bowser's cutaway: the wand **shakes wildly**, throwing sparks everywhere; Bowser holds it with both
claws and stands up, furious. His challenge leads to `NO MORE STAND-INS` at Bowser's Castle.

```text
BOWSER:

THE WAND IS SHAKING! I CAN
BARELY HOLD IT!
```

```text
BOWSER:

ENOUGH! IF YOU WANT
SOMETHING DONE RIGHT, DO
IT YOURSELF.
```

```text
BOWSER:

COME TO MY CASTLE,
<HERO>. I'LL BE WAITING!
BWA HA HA!
```

```text
TOAD:

THE LAST SEAL! THE ROAD
GOES STRAIGHT INTO
BOWSER'S OWN LAND.
```

```text
TOAD:

THIS IS IT, <HERO>!
LET'S FINISH THIS!
```

### 2.11 World 8: the Underworld (Sophia III)

**The welcome: a miner.** An old miner with a lamp on his helmet and a pickaxe, beside World 8's start node. It
carries Toad's old World 8 lines: the tank, her lost pilot, and Peach's clue 3 (the turnip). Hint line
`TALK TO THE MINER`.

```text
MINER:

WELCOME TO THE UNDERWORLD,
STRANGER. MUTANTS DOWN
BELOW, AND NOW A SPIKY KING
UPSTAIRS. LOVELY.
```

```text
MINER:

OUR HERO IS A TANK CALLED
SOPHIA. SOMEONE BRAINWASHED
HER, AND HER PILOT IS LOST.
PLEASE HELP!
```

```text
MINER:

THE TANK DROVE DOWN A HATCH
IN THE FOREST, AND THE
BOY'S FROG DOVE AFTER HER.
HE'S LOOKING FOR A WAY DOWN.
```

```text
MINER:

ODD THING... SOMEONE PULLED
UP A TURNIP RIGHT HERE. WHO
GROWS TURNIPS NEXT TO LAVA?
```

After Sophia III is freed (NEW, after-freed: talking to the miner again plays this page instead):

```text
MINER:

SOPHIA'S ROLLING AGAIN, AND
THE BOY'S BACK WITH HIS
FROG. THANK YOU, STRANGER!
MIND THE LAVA ON YOUR WAY.
```

As Sophia III (NEW, 0.4.47: talking to the miner as the world's own hero, first of the three sets):

```text
MINER:

SOPHIA! YOU ROLLED ALL THE
WAY HERE? MIND THE LAVA, IT
EATS TREADS. AND SAY HI TO
THE BOY AND HIS FROG.
```

(Peach clue 3. Nobody can explain it; it points at her SMB2 kit and the Lost Kingdom's turnips.)

**Level NPCs** (0.4.40, owner: an NPC in every level). Each speaks for Sophia III (and her lost pilot): missing,
they plead and say where to look (by place, never by level number); freed, their found lines. (0.4.54: their
hints now point at the hatch in the forest and the pipe down to Jason, not the king's castle: see "Sophia III's
way in" below.)

**8-1: the sighting.** NEW (0.4.54, `story/sightings.ts`). **Trigger:** the first time 8-1 starts on the file
while Sophia III is neither freed nor met and 8-1 is not cleared, once every player stands on the start screen
(campaign only, never while a player is Sophia III). Once per file (`sighting:sophia`). **Staging:** play holds.
Brainwashed Sophia III is parked by the start castle, cannon up; she turns to face the hero (a beep), then turns
back and drives off along the forest floor, the camera following her a little. She hover-hops over Fred, who sits
in her way; with wand sparkles the steel hatch in the ground slides open for her, and she drops in nose first. Fred
looks down the shaft and dives in after her, head first. The hatch slams shut: CLANG (a little dust, no shake).
The camera comes back. A beat later player 1's hero speaks; JUMP, ATTACK or MENU skips to the card. Said:
_A brainwashed Sophia the Third drives into a hatch in the ground. A frog dives after her, and the hatch slams
shut._

```text
<HERO>:

SOPHIA III AND THE FROG
WENT DOWN THAT HOLE, AND
IT SHUT. I CAN'T FOLLOW...
THERE MUST BE ANOTHER WAY.
```

**The hatch.** NEW (0.4.54, owner; `locked-hatch`, entities/objects/keys.ts). A riveted steel blast hatch with
hazard stripes, flush with the ground by 8-1's start (columns 13-14). It is **always shut and solid** in play (only
the sighting opens it): the ground under it is the map's own. Standing on it, the TALK button reads OPEN (said:
_A locked hatch. Press OPEN to try it._); pressing it plays the locked card once a visit, the player's hero
speaking (the same card as 5-1's crypt gate, 2.8); after that the strip just reads LOCKED (said once on coming near:
_Locked._). Once Sophia III is freed it is plain ground: no prompt. Classic play has no hatch.

**Sophia III's way in: the key and the blast door** (NEW, 0.4.54, owner; the 0.4.52 key and locked door, 2.8,
reused). The real way down is 8-1's coin room (`8-1-bonus`, down the pipe at column 104). Its 10-coin brick
(column 12, row 9, three tiles over the floor) is a **key box**: bumped from below (any hero, small or big) the key
drops out of its underside to the floor (_A key pops out._) and the box is spent; PICK UP takes it (_Got the
key._). The **locked blast door** in the back wall (column 4, the Underworld dungeon's own door) reads LOCKED
without it; touched by the hero carrying the key it opens by itself (_The key turns. The door opens._), and UP goes
down into Sophia III's garage (`8-4-garage`, its id kept, now an area of 8-1), dropping in through a shaft in its
roof; the garage's pipe leads back up out of 8-1's pipe at column 115. The key lasts one visit, and once Sophia III
is freed the door stands open for good and the brick keeps its coins, all as in 5-1-bonus. The old way in (8-4-end's
trap pipe, Jason's pool and Fred's flooded tunnel) is gone: the trap pipe is the original's again, and 8-4-jason
and 8-4-fred are retired (no level leads to them).

**8-1: a mutant.** NEW partner (`mutant`, new art: a lavender blob with one big eye and a fanged grin). A nice
mutant, mostly, at **8-1's start** (column 10), among the forest ruins. Once a boss in Sophia III's own caves.

```text
MUTANT:

GRBL! DON'T SHOOT! I'M A
NICE MUTANT. MOSTLY.
```

```text
MUTANT:

THE TANK WENT DOWN THAT
HATCH, AND THE BOY WENT
DOWN A PIPE TO FIND ANOTHER
WAY. HELP HIM. GRBL.
```

After Sophia III is freed:

```text
MUTANT:

GRBL! THE TANK IS ROLLING
AGAIN! SHE BLASTED ME ONCE,
BACK WHEN I WAS A BOSS.
```

```text
MUTANT:

NO HARD FEELINGS. I WAS A
VERY BAD BOSS.
```

As Sophia III (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
MUTANT:

GRBL! THE TANK! ...ARE YOU
STILL MAD? I'M SORRY I WAS
A BOSS. GRBL.
```

**8-2: an engineer.** NEW partner (`engineer`). World 8's miner in a white helmet with a cyan lamp and a blue
shirt, at **8-2's start** (column 6), before the techno castle's steps.

```text
ENGINEER:

CAREFUL. THESE MACHINES
BITE. EVERYTHING DOWN HERE
BITES.
```

```text
ENGINEER:

THE KING'S SPELL TOOK THE
TANK, SOPHIA. HER PILOT IS
BACK IN THE FOREST, DOWN A
PIPE. HELP THEM!
```

After Sophia III is freed:

```text
ENGINEER:

SOPHIA'S BACK! WHAT A
MACHINE. SHE HOVERS, SHE
CLIMBS WALLS, SHE DIVES.
```

```text
ENGINEER:

AND THE BOY? OUT OF THE
TANK, A SHORT FALL HURTS
HIM BAD. SO HE STAYS IN
THE TANK.
```

As Sophia III (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
ENGINEER:

SOPHIA! MAY I LOOK UNDER
YOUR HOOD? JUST A PEEK.
...THE CANNON SAYS NO.
UNDERSTOOD.
```

**8-3: an ice miner.** NEW partner (`ice-miner`). The miner in a pale blue helmet and a teal shirt, at **8-3's
start** (column 4, clear of the Bill Blaster at 18 the way 7-1's corporal is), in the frozen ruins. Freed, how Sophia III's story began.

```text
ICE MINER:

BRR! I CAME DOWN HERE FOR
GOLD. FOUND ICE. AND
MUTANTS.
```

```text
ICE MINER:

SAW A FROG DIVE DOWN A
HATCH IN THE FOREST. THE
BOY WENT DOWN A PIPE TO
FOLLOW. PLEASE, HELP HIM!
```

After Sophia III is freed:

```text
ICE MINER:

THE TANK IS FREE! AND THE
FROG? FRED? HE STARTED ALL
THIS, YOU KNOW.
```

```text
ICE MINER:

HOPPED IN A BOX OF STRANGE
GOO, GREW HUGE, JUMPED DOWN
A HOLE. THE BOY FOLLOWED
HIM AND FOUND A TANK.
```

As Sophia III (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
ICE MINER:

A TANK THAT CLIMBS WALLS,
ON MY ICE! SOPHIA, YOU
COULD DIG MORE GOLD THAN
ME. ...NOT THAT I'D ASK.
```

**8-4: a guard mutant.** NEW partner (`castle-mutant`). The mutant in green, the king's worst guard, on the floor
past **8-4's first lava** (column 14), before the piranha pipe. Fred and Jason (below) are at the castle's end; this
one stays when Fred has gone home.

```text
GUARD MUTANT:

GRBL. I GUARD THIS HALL.
I'M BAD AT IT. NOBODY GETS
PAST ME. ...EXCEPT YOU.
```

```text
GUARD MUTANT:

THE BOY AND HIS TANK? NOT
IN HERE. THEY WENT DOWN A
HATCH IN THE FOREST. GRBL.
```

After Sophia III is freed:

```text
GUARD MUTANT:

GRBL. TANK'S FREE, BOY'S
HAPPY, FROG'S HOME. I'M
STILL HERE.
```

```text
GUARD MUTANT:

GO GET THE KING. I WILL
GUARD THE HALL. BADLY.
```

As Sophia III (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
GUARD MUTANT:

GRBL. HALT, TANK! ...I
MEAN, GO AHEAD. I GUARD
BADLY. THE KING KNOWS.
```

**Hint NPC: Fred, by the trap pipe.** REMOVED (0.4.54): Fred no longer sits by 8-4-end's trap pipe. He dives down
8-1's hatch after Sophia III in her sighting, and rests beside her in the garage. His old pages:

Old:

```text
FRED:

RIBBIT.
```

Old:

```text
THE FROG LOOKS AT YOU,
THEN DOWN THE PIPE. THEN
AT YOU AGAIN.
```

**Hint NPC: Jason.** MOVES (0.4.54, owner: option A): from his secret area behind 8-4-end's trap pipe to **8-1's
coin room** (`8-1-bonus`, column 8), between the key box and the locked blast door. The hatch shut on his tank and
his frog, and he lost the key.

```text
JASON:

FRED! SOPHIA! THE HATCH
SHUT ON THEM! THIS DOOR
GOES DOWN THERE TOO, BUT I
LOST THE KEY IN HERE.
```

His old pages (the follow-Fred swim, gone with that route):

Old:

```text
JASON:

FRED! FRED, COME BACK!
...OH, HI. HAVE YOU SEEN
A FROG? GREEN, THIS BIG?
```

Old:

```text
JASON:

HE JUMPED IN THE WATER AND
SWAM DOWN A CRACK. LAST
TIME HE DID THAT, I FOUND
A TANK.
```

Old:

```text
JASON:

MY TANK, SOPHIA! SHE'S DOWN
THERE TOO. FOLLOW FRED,
PLEASE. I CAN'T SWIM.
```

After Sophia III is freed:

```text
JASON:

SOPHIA'S BACK, FRED'S BACK.
BEST DAY EVER! THANK YOU!
```

As Sophia III (NEW, 0.4.47: talking as the world's own hero, first of the three sets):

```text
JASON:

SOPHIA! YOU'RE DRIVING
YOURSELF NOW? WITHOUT ME?
...I'M SO PROUD. AND A
LITTLE JEALOUS.
```

**Castle 8-4** (the eighth fake, NEW, 0.4.54, owner; campaign only, art by CD53 in `content/sprites/costumes.ts`), in
a villain costume: the Plutonium Boss: a bunch of purple party balloons taped over his shell and the back of his
head (his spikes poking up over them), glow sticks taped across them, green ping-pong balls stuck on, a grey
cardboard visor over his brow with a big gold eye painted on (his own eye looks out of a hole: two eyes, and only
one blinks) and painted teeth, and a green rubber ball with a slit eye on a string round his neck. Breathing fire,
his jaw drops open under the painted teeth. Shed: the deflated balloons in a heap (one still full, bobbing on its
string), the visor flat on its back staring up, the glow sticks, the green ball rolled to the front. His true form
is a **Piranha Plant** knocked silly, out of its pipe and standing on its roots, jaws hanging open (the one SMB
enemy no other fake used). The screen reader says: _The Plutonium Boss costume falls off in a heap: purple party
balloons, glow sticks, a cardboard visor and a green ball._ The hero's remark (owner's pick, option 1):

```text
<HERO>:

ANOTHER FAKE?! A PIRANHA
PLANT IN PARTY BALLOONS.
THE REAL KING IS NEXT.
```

With Sophia III, the world's own hero, playing (freed in 8-1, so she can meet him; her terse machine voice):

```text
SOPHIA III:

SCAN: ZERO PLUTONIUM.
MUTANT: ONE PIRANHA PLANT.
REAL TARGET: DEAD AHEAD.
```

Toad's page at 8-4 (NEW, 0.4.55, CD53's draft): 8-4 is an ordinary fake castle since the ending moved to Bowser's
Castle (2.12), so Toad gives one page under the thanks, then it is back to the map, where World 8's road on leads
to the VALLEY OF BOWSER. (In 0.4.54, while 8-4 was still the last castle, he showed only the wand's page.)

```text
THANK YOU <HERO>!

A PIRANHA PLANT! THE KING
IS OUT OF STAND-INS NOW.
HIS CASTLE IS JUST AHEAD!
```

**Sophia III, captive:** KEEP (the shared first card, then the brainwashing speaking through her computer):

```text
SOPHIA III:

PILOT NOT FOUND. THE
PLUTONIUM BOSS HAS THE
WHEEL. <HERO>...
CLIMB IN. BLAST IT OUT!
```

**Sophia III, freed.** NEW. Her computer finds her pilot, then a tear in space under the king's own castle
(Bowser's Castle, reworded in 0.4.55) that the wand holds shut, and a land beyond it with no Koopas at all (which Toad puts together with the note at the rift).

```text
SOPHIA III:

SYSTEM REBOOT... PILOT
FOUND. HELLO, JASON.
```

```text
JASON:

SOPHIA! YOU'RE OKAY! AND
YOU... THANKS, <HERO>.
```

```text
SOPHIA III:

ALERT. SCAN SHOWS A TEAR
IN SPACE UNDER THE KING'S
OWN CASTLE. HIS WAND IS
HOLDING IT SHUT.
```

```text
SOPHIA III:

BEYOND IT: A LAND NO MAP
SHOWS. NO KOOPA SIGNALS
THERE. NONE.
```

```text
JASON:

WE'RE WITH YOU. CLIMB IN
ANY TIME!
```

### 2.12 Bowser's Castle: the real king falls, the wand breaks, the rift

**Where** (0.4.55). The campaign's **last castle** (`story/finale.ts` `FINALE`) is BOWSER'S CASTLE, the one node of
the VALLEY OF BOWSER page after World 8 (internal level `8-5`, never shown: the HUD, the intro card, the map and the
announcer all say BOWSER'S CASTLE). The real king waits on its bridge (fire and hammers, his Bowser bar), and his
own tune, `bowser-king`, starts as the bridge section begins; his boast (2.3a) plays there too. Everything below
happens at Bowser's Castle. Until 0.4.55 it all happened at 8-4; since then 8-4, the Plutonium Boss fake (2.11), is
an ordinary castle in the campaign: the hero's remark at the axe, the fake unmasked, Toad's NES line (BUT OUR
PRINCESS IS IN ANOTHER CASTLE!), back to the map, no credits. Classic play is unchanged: 8-4 is the end there.

**The scene** (KEEP, as built): the axe, the bridge falls, Bowser falls. As he drops, the wand spins up out of his
hand, cracks with a white flash (no flash with reduce flashing), and breaks into glowing pieces. A jagged,
shimmering crack opens in the air over the lava; the pieces swirl into it and it stays open, humming. The hero
walks on. Said: _The wand spins out of Bowser's hand and breaks! Its glowing pieces swirl into a crack in the air._

**Who stands at the end:** Toad (owner, Oct 13: no Peach here; she is found at Lost 4-4), at Bowser's Castle's end,
in the chamber past the axe. (8-4's Toad, at `8-4-end` column 57 in place of the princess, stays for its own end.)

**Toad's pages** (KEEP; 8-4's before 0.4.54, Bowser's Castle's since 0.4.55):

```text
THANK YOU <HERO>!

NO TRICK THIS TIME. THAT
WAS THE REAL KING!
```

Then, 2 s later (second page, same box):

```text
BOWSER FELL... AND THE
WAND BROKE! ITS PIECES
FELL THROUGH A CRACK IN
THE WORLD!
```

**The credits** (KEEP): they roll over it as a **false ending**; in the campaign the last credits page gets this
block after `THANKS FOR PLAYING / SUPER MARIO BROS. CROSSOVER / REMIX`:

```text
END OF CHAPTER 1

...BUT THE STORY
ISN'T OVER.
```

**World 8's gate** (0.4.55). The road on from 8-4 to the VALLEY OF BOWSER is an ordinary world gate: it needs 8-4
cleared **and** Sophia III freed. While she is captive a seal stands at the page's edge (not the crack: the rift is
no longer here) and Toad's reminder plays the first time the World 8 map shows with it. Hint line on 8-4:
`SEALED - FREE SOPHIA III FIRST`. Freeing her shatters the seal (no cutaway, no words) and the road draws in.

```text
TOAD:

THE WAY ON TO THE KING IS
SEALED BY HIS MAGIC... AND
WE STILL HAVEN'T FOUND
SOPHIA III!
```

```text
TOAD:

THE LAST SPELL! THE TANK IS
STILL UNDER IT, DOWN THAT
HATCH IN THE FOREST.
```

(Before 0.4.55 World 8's road went straight on to Lost World 1 and was the rift itself, held shut by her spell; a
build without the Valley still plays this reminder after the 8-4 credits, then the crack tears open on her release;
since 0.4.54 it speaks of the wand, not the king, as 8-4's king is a fake:)

```text
TOAD:

THE WAND IS BROKEN, BUT
THAT CRACK IS TOO SMALL TO
GO THROUGH. SOMETHING'S
HOLDING IT SHUT...
```

**The rift is the Valley's road on to the Lost Levels** (owner, Oct 13). It opens once Bowser's Castle is cleared,
or on a file that already beat the game before 0.4.55 (`gameCleared`: its castle stays open and uncleared, playable
any time). No hero gate: the Valley only opens once Sophia III is freed.

- **Toad works out the note** (a major scene: Toad walks in). **Trigger:** the first time the VALLEY OF BOWSER map
  shows after Bowser's Castle's credits (since 0.4.55; before, World 8's after 8-4's). The road on to Lost World 1
  draws in after it. REPLACES `riftPages` (pages 2-3 new;
  "sniffed" went with the old 1-0 tease, and the note's "old friends" is new).

```text
TOAD:

THAT CRACK LEADS TO THE
LOST KINGDOM! NOBODY GOES
THERE. NOBODY EVER LOOKS
THERE...
```

```text
TOAD:

...WAIT. WHERE NO KOOPA
WOULD EVER LOOK. THAT'S
WHERE SHE WENT, <HERO>!
```

```text
TOAD:

OLD FRIENDS, SHE WROTE...
WHO COULD SHE KNOW IN THE
LOST KINGDOM?
```

```text
TOAD:

BUT THE WAND'S PIECES FELL
IN THERE TOO, AND THE
KOOPALINGS WILL GO AFTER
THEM. LET'S HURRY!
```

### 2.13 Every hero: the captive card, the freed talk, the freed card

**The order when a hero is freed** (CHANGE, `free-hero.ts`): the captive's two cards → the rules card → the round →
pass: **the freed talk** (NEW, the hero's pages in each world's section, over the level with the hero still standing
there) → the hero leaves in a puff and the freed card shows, as now. `BACK` skips the rest of the talk. Fail and
quit are as now. **Replay:** the talk plays once (the hero leaves); see open question 1.

**The first card** (`captiveDialogue`, shared by every hero): KEEP.

```text
LUIGI:

...LUIGI SERVES
KING KOOPA...
...MUST FIND
THE PRINCESS...
```

(The name is the hero's; `SOPHIA III` fits.)

**The freed card** (`freedCard`): KEEP (`<HERO> IS FREE! / <HERO> JOINS YOUR TEAM. / PICK THE NEW HERO WHEN YOU
ENTER A LEVEL.`, with the freed hero's name). Toad no longer reacts on the map.

**The mini games' own lines** (the Shadow Keep's `LINK... WAKE UP...`, `THE SPELL BREAKS!`, `DRACULA IS
DEFEATED! / THE CURSE IS BROKEN.`, `THE MASKED NINJA FALLS!`, `SAMUS ESCAPED!`, `DARK MEGA MAN IS BEATEN!`, the
Ninja Gaiden cutscene, the Contra briefing): no change needed. They speak of a spell or a curse, which still fits.

**What the eight talks reveal, in order** (each builds on the one before; a player who frees them in world order
hears the story in this order, and the gates make that the only order):

| Hero       | Reveals                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Luigi      | Bowser has a wand and brainwashes people to find Peach; others from other worlds; save them     |
| Link       | Peach is free and running, not caught; the spell dragged whole lands here and sealed them       |
| Mega Man   | All the spells come from the one wand; each broken spell snaps back into it and overloads it    |
| Samus      | The wand is not the king's: it is his son Larry's                                               |
| Simon      | He hunted Peach himself: she warns villages and lays false trails; nobody can catch her         |
| Ryu        | The king's stand-ins are nearly spent; he will fight in his own castle; Peach seen on a rooftop |
| Bill       | The wand is about to go; one world, one hero left                                               |
| Sophia III | A tear in space under the castle, held shut by the wand; beyond it a land with no Koopas        |

### 2.14 Toad's map lines that stay, and what is removed

**The optional extras** (KEEP, first visit only, Toad's box):

The Warp Zone hub (`STARLIGHT CROSSING`; the pipe keeper in 1-2 points the way):

```text
TOAD:

A PLACE BETWEEN WORLDS!
THE WAND'S MAGIC MUST HAVE
WORN A PATH THROUGH HERE.
```

The Mini Game Arena:

```text
TOAD:

THE HEROES CAN RELIVE
THEIR TRIALS HERE. JUST
FOR FUN, THIS TIME.
```

**Removed from Chapter 1** (owner's notes 6 and 10; their text stays in git history, this file at v0.4.21). For the
build, by constant in `script.ts`:

- `STORY_TEASE_PAGES` (1-0's shadow tease in the campaign): replaced by Bowser's spell (2.2).
- `FAKES_PAGES` (Toad's map card after 1-4): folded into castle 1-4's first page.
- `RESTYLE_PAGES` (Toad's first-visit remarks on the restyled levels): gone. The looks themselves stay; the
  welcomes explain them (each world is a piece of the hero's homeland).
- `WORLD_ENTRY` for `smb-2` to `smb-8`, and `ENTRY_NEEDS`: gone; World 1's becomes Toad's World 1 scene (2.4). Their
  two clues moved to the welcomes (World 4's airship, World 8's turnip).
- `MISSED_PAGES` and `MISSED_HINT` (the missed-hero cards and Toad's per-hero hint lines): gone; a shadow's hint line
  is the generic one again.
- `JOINED_CRACK`, `JOINED_GENERIC`, `JOINED_PAGES` (Toad's reactions to a freed hero, the crack pages included):
  gone; Mega Man's talk carries the crack rule and the gates show it.
- `ALL_FREED_BEFORE`, `ALL_FREED_AFTER`: gone; Sophia III's talk and the rift close the chapter's hunt.

### 2.15 The Lost Kingdom

**Entering it** (first arrival on Lost World 1, Green Meadow): NEW cards.

```text
TOAD:

SO THIS IS THE LOST
KINGDOM. IT LOOKS LIKE
HOME... ONLY MEANER.
```

```text
TOAD:

WATCH OUT FOR POISON
MUSHROOMS. AND STRONG
WINDS. AND... WELL,
EVERYTHING, REALLY.
```

```text
TOAD:

THE WAND'S PIECES ARE OUT
HERE. SO IS THE PRINCESS.
LET'S FIND BOTH!
```

**The wand's pieces** (decided): it broke into **six pieces and the star tip**. Each Koopaling but Larry (the
wand's owner) grabs one piece and flies off with it in an airship: Morton, Wendy, Iggy, Roy, Lemmy and Ludwig. The
king keeps the star tip, the wand's heart.

- **The main story** needs no piece: it ends at Lost 8-4, when Bowser is beaten and escapes with the star tip
  (below).
- **The side quest:** six Koopaling airships (ROADMAP idea 1), one behind each forward warp zone in Lost worlds 1-8
  (Lost 1-2 three, Lost 5-1 one, Lost 5-2 two). Each airship beaten returns its Koopaling's piece. They are never
  needed to go on.
- **The true-ending chapter:** with all six pieces (campaign only), the rebuilt wand opens the way to the Far Lands,
  Lost worlds A-D, to chase Bowser for the star tip. At D-4 the wand is made whole (2.18). Classic play keeps the NES
  rule for A-D, and World 9 keeps the NES rule everywhere (it opens after a Lost 8-4 clear without warps).

**A piece won back** (NEW cards on the map, the first time it shows after an airship is beaten). The first piece:

```text
TOAD:

A PIECE OF THE WAND! PUT
ALL SIX BACK TOGETHER AND
WE COULD FOLLOW THE KING
ANYWHERE.
```

The sixth piece, before Lost 8-4 is cleared:

```text
TOAD:

THAT'S ALL SIX! THE WAND
IS ALMOST WHOLE. ONLY THE
STAR TIP IS MISSING.
```

The sixth piece, after Lost 8-4 (the road on to Lost World A then draws in):

```text
TOAD:

THAT'S ALL SIX! THE WAND
CAN OPEN THE WAY TO THE
FAR LANDS. AFTER HIM!
```

**Lost worlds 2-D: Toad's world entries** (one card each, first arrival; kept light). Lost 2 and 4 carry the
clues that Peach is near (she grows turnips and throws them, as in SMB2; the first turnip turned up in World 8,
where the miner found it);
Lost 3 brings in the Koopalings.

Lost 2, Twilight Vale:

```text
TOAD:

MORE PULLED-UP TURNIPS, ALL
OVER THIS VALE. WHO EATS
THAT MANY TURNIPS?
```

Lost 3, Frost Fields:

```text
TOAD:

AIRSHIPS OVERHEAD! THE
KOOPALINGS ARE HUNTING
THE WAND'S PIECES.
```

Lost 4, Toadstool Grove:

```text
TOAD:

A WHOLE VILLAGE OF TOADS!
MY COUSINS! ...HUH. ONE
OF THEM IS VERY TALL.
```

Lost 5, Cloud Canopy:

```text
TOAD:

THE PIECES GLOW AT NIGHT.
I SAW ONE UP IN THE
CLOUDS. AND A KOOPALING
JUMPING FOR IT.
```

Lost 6, Coral Bay:

```text
TOAD:

A PIECE OF THE WAND SANK
IN THIS BAY. THE FISH ARE
ACTING VERY STRANGE.
```

Lost 7, Bullet Bluffs:

```text
TOAD:

BULLETS EVERYWHERE. THE
KING IS GUARDING SOMETHING
UP AHEAD. SOMETHING SHINY.
```

Lost 8, Dark Citadel:

```text
TOAD:

BOWSER'S BACK! HE TAPED
THE STAR TIP TO A STICK
AND CALLS IT A WAND. GROSS.
```

Lost 9, Farewell Sea:

```text
TOAD:

THE FAREWELL SEA. THE KING
FLED OVER IT. I CAN'T
SWIM, SO... YOU FIRST.
```

Lost A to D are the true-ending chapter (only with all six pieces, in the campaign).

Lost A, Spore Forest:

```text
TOAD:

THE FAR LANDS. NOBODY HAS
EVER MAPPED THEM. THE
MUSHROOMS HERE DON'T EVEN
LIKE ME.
```

Lost B, Breaker Coast:

```text
TOAD:

THE WAVES HERE COULD KNOCK
A KOOPA OUT OF HIS SHELL.
STAY AWAY FROM THE EDGE!
```

Lost C, Starlit Ridge:

```text
TOAD:

THE STARS ARE SO CLOSE UP
HERE. THE RIFT MUST BE
NEAR. I CAN HEAR IT HUM.
```

Lost D, Last Glacier:

```text
TOAD:

THE LAST GLACIER. THE KING
IS HERE WITH THE STAR TIP.
THIS ENDS NOW!
```

**The Lost castles' news**: the Lost castles 1-4 to 7-4 and A-4 to C-4 say `BUT OUR PRINCESS IS IN ANOTHER
CASTLE!` too today (`World.updateBossClear`), so they get lines of their own. Lost 1-4 to 7-4 have a fake Bowser,
so, as in worlds 1-7, page 1 names its true form (2.3a) and page 2, 2 s later in the same box, is the story line.
A-4 to C-4 now have fakes too (2.3a, decided Oct 7), so they get the same two pages: the reveal, then the line below.

Lost 1-4 (a Goomba):

```text
THANK YOU <HERO>!

ANOTHER GOOMBA IN A KING
SUIT! THE STAR TIP STILL
HAS SOME MAGIC IN IT.
```

```text
A KOOPALING GRABBED A
PIECE OF THE WAND AND
FLEW OFF IN AN AIRSHIP!
```

Lost 2-4 (a Koopa):

```text
THANK YOU <HERO>!

A KOOPA IN THE KING'S
SHAPE. HE NEVER RUNS OUT
OF STAND-INS.
```

```text
SOMEONE LEFT US A BASKET
OF TURNIPS. THE NOTE SAYS:
EAT YOUR GREENS. - P
```

Lost 3-4 (a Buzzy Beetle):

```text
THANK YOU <HERO>!

A BUZZY BEETLE! DOWN HERE
EVEN THE FAKES ARE MEANER.
```

```text
THE KOOPALINGS ARE ALL
OVER THE KINGDOM. SIX OF
THEM, SIX PIECES.
```

Lost 4-4 (a Spiny; page 2 until Peach is built, then her discovery scene, 2.16, replaces it):

```text
THANK YOU <HERO>!

A SPINY AGAIN! STILL
PRICKLY, STILL A FAKE.
```

```text
A VERY TALL TOAD WAS JUST
HERE. SHE SAID TO TELL
YOU: SEE YOU SOON!
```

Lost 5-4 (a Lakitu):

```text
THANK YOU <HERO>!

A LAKITU IN A KING SUIT!
SO WHO'S UP THERE THROWING
THE SPINIES?
```

```text
THE KING WANTS HIS KIDS'
PIECES. HE WANTS HIS
WAND BACK. WELL, LARRY'S.
```

Lost 6-4 (a Blooper):

```text
THANK YOU <HERO>!

ANOTHER BLOOPER! IT LEFT
INK ALL OVER THE BRIDGE.
```

```text
THE FAKE KINGS KEEP
GETTING BETTER. THAT ONE
EVEN HAD THE EYEBROWS.
```

Lost 7-4 (a Hammer Bro):

```text
THANK YOU <HERO>!

A HAMMER BRO! HE KEPT HIS
HAMMERS UNDER THE SUIT.
```

```text
THE KING WENT TO HIS DARK
CITADEL, WITH THE STAR
TIP AND A ROLL OF TAPE.
```

Lost A-4:

```text
THANK YOU <HERO>!

NO KOOPA HAS EVER COME
THIS FAR. EXCEPT THE KING.
HE'S STILL AHEAD OF US.
```

Lost B-4:

```text
THANK YOU <HERO>!

THE STAR TIP IS THE
WAND'S HEART. WITHOUT IT,
THE RIFT CAN'T CLOSE.
```

Lost C-4:

```text
THANK YOU <HERO>!

ONE CASTLE LEFT. HE IS
WAITING ON THE GLACIER.
```

### 2.16 Peach (for a later release)

These scenes are **for the release that makes Peach playable**, not 0.4.13. Until then, the clues in 2.15 point
at her and the Lost 4-4 castle line above stands in.

**Where she is found** (decided): **Lost 4-4, Toadstool Grove.** The Toad at the end of the castle is Peach in a
Toad cap, hiding among the Toads. It is the fourth of thirteen Lost worlds: early, but after the player has
learned the Lost Kingdom, and the world's own name sets it up. Clues on World 8 and Lost 2 (turnips) and Lost 4 (a
very tall Toad).

**Her discovery scene** (castle end, NEW): the castle's thanks and the Spiny reveal page as usual, then the "Toad"
pulls off its cap, and the cards play in the box over the room.

```text
THANK YOU <HERO>!
```

```text
???:

SHH! NOT SO LOUD...
```

_(The tall Toad pulls off its cap. It's Peach.)_

```text
PEACH:

<HERO>! IT'S ME! I'VE
BEEN HIDING WITH THE
TOADS. NOBODY LOOKS TWICE
AT A MUSHROOM CAP.
```

```text
PEACH:

THEN THE WAND'S PIECES
FELL FROM THE SKY, AND
THE KOOPALINGS CAME WITH
THEM. MY HIDING IS OVER.
```

```text
PEACH:

I'VE LIVED ON TURNIPS FOR
WEEKS. I CAN THROW THEM,
TOO. LET'S GO GET THAT
WAND!
```

**She joins** (the freed card's form):

```text
PEACH JOINS YOUR TEAM!

PICK HER WHEN YOU ENTER
A LEVEL.
```

**Toad on the map** (the next time it shows):

```text
TOAD:

PRINCESS! YOU'RE SAFE!
...I KEPT YOUR NOTE, BY
THE WAY. IT'S FRAMED.
```

### 2.17 The main ending: Lost 8-4

Beating Bowser at Lost 8-4 **ends the main story**: the princess is safe and the heroes stay. But he escapes with
the star tip, so it isn't quite over.

**The scene** (NEW, stage directions): the axe, the bridge falls as now. Bowser doesn't reach the lava: the star tip
on his stick flashes gold and he blinks away in a puff of wand sparkles, like the fakes' but gold (no flash with
reduce flashing).

**The castle card**: REPLACES the Lost 8-4 card in `Game.showLostEnding` (decided: campaign only; outside the
campaign the NES card and tally stay). Two pages; page 1 has two versions, by whether Peach is in the game yet.

Old: _THANK YOU <HERO>! / YOUR QUEST IS OVER. / WE PRESENT YOU A NEW QUEST. / PUSH BUTTON B / TO SELECT A
WORLD_ (the NES wording, chosen by the owner on 2026-10-06; it stays in classic play).

With Peach (later release):

```text
THANK YOU <HERO>!

BOWSER IS BEATEN, AND THE
PRINCESS IS SAFE AT LAST!
```

Until then (0.4.13):

```text
THANK YOU <HERO>!

BOWSER IS BEATEN! THE
KINGDOM IS SAFE... FOR
NOW.
```

Then, 2 s later (second page, same box):

```text
BUT HE GOT AWAY OVER THE
FAREWELL SEA, WITH THE
WAND'S STAR TIP!
```

**The credits** (decided, NEW): the full roll, as at 8-4, in the campaign only. Its last page gets this closing
block instead of 8-4's `...BUT THE STORY ISN'T OVER.`:

```text
THE END.
...OR IS IT?
```

**Toad's epilogue** (Lost World 8 map, after the credits): NEW cards.

```text
TOAD:

THE HEROES CAN GO HOME
ANY TIME... BUT NOBODY
IS PACKING. I THINK THEY
LIKE IT HERE.
```

Until Peach is in the game:

```text
TOAD:

AND A VERY TALL TOAD SENT
WORD: THANK YOU. SHE'LL
COME HOME SOON.
```

With Peach (later release), she says it herself:

```text
PEACH:

THANK YOU, <HERO>. I CAN
STOP HIDING NOW. ...I'LL
MISS THE TURNIPS, THOUGH.
```

Then the tease, which points at the side quest (2.15):

```text
TOAD:

BUT THE KING STILL HAS THE
STAR TIP. IF WE PUT THE
WAND BACK TOGETHER, WE
COULD FOLLOW HIM...
```

If some pieces are still missing:

```text
TOAD:

THE KOOPALINGS HAVE THE
OTHER SIX PIECES. THEIR
AIRSHIPS HIDE PAST THE
WARP PIPES, LIKE LARRY'S.
```

If all six are already found (the road on to Lost World A then draws in):

```text
TOAD:

...AND WE HAVE ALL SIX
PIECES! THE WAND CAN OPEN
THE WAY. TO THE FAR LANDS!
```

**World 9** opens by the NES rule (a Lost 8-4 clear without warps); it is an extra, not part of either ending.
**Lost 9-4 ending**: REPLACES the `THANK YOU!` card (campaign only).

```text
THANK YOU <HERO>!

THE SEA IS CROSSED. THE
FAR LANDS LIE PAST IT,
BUT ONLY THE WAND CAN
OPEN THE WAY.
```

### 2.18 The true ending: Lost D-4

Only reached with all six pieces (2.15): the rebuilt wand opened the way to the Far Lands, and at the Last Glacier
the king is beaten for the star tip.

**The castle card**: REPLACES the D-4 card in `Game.showLostEnding` (campaign only). Two versions, by whether
Peach is in the game yet.

With Peach (later release):

```text
THANK YOU <HERO>!

THE WAND IS WHOLE AGAIN.
THE PRINCESS USED IT TO
SEAL THE RIFT FOR GOOD.
```

Until then (0.4.13):

```text
THANK YOU <HERO>!

THE WAND IS WHOLE AGAIN,
AND THE RIFT IS SEALED.
THE KINGDOM IS SAFE.
```

**The final credits** (decided, NEW): a **shorter roll** over it than at 8-4, in the campaign only: the first
credits page, the legal page and `THANKS FOR PLAYING`, then this closing block (the answer to Lost 8-4's
`...OR IS IT?`):

```text
THE END.
...FOR REAL THIS TIME.
```

**Toad's epilogue** (World D map, after the credits): NEW cards.

```text
TOAD:

LARRY GOT HIS WAND BACK,
WHOLE, AND A LOCK FOR IT.
THE KING HAS TO SAY SORRY
TO EVERY HERO. IN PERSON.
```

The last card:

```text
TOAD:

THANK YOU, <HERO>. FOR
EVERYTHING. NOW... WHO
WANTS CAKE?
```

## 3. The owner's decisions (review of 2026-10-07)

All fourteen questions are decided (twelve from the first draft, two settled afterwards). The story is not to be
rewritten: keep its shape, its jokes and its references to the heroes' games.

**Superseded for Chapter 1 by the owner's notes of 2026-10-08** (the 0.4.23 draft, "What changed from v0.4.21" in
section 2): 2 (the old man moves again, to 2-1's vine; every hint NPC now stands in the hero's own level), 3 (Toad
no longer hints at all; the NPCs are the only hints), 8 (freed heroes still weaken the wand, now shown by the world
gates and told by Mega Man; the castles no longer blame overuse), 10 (Toad walks in for his World 1 scene, the
gates, the crash and the rift; there are no routine world entries any more) and 11 (the per-hero hint lines are
removed). The note after the list (Bowser's tease, Toad's opening, Peach's three traces) is also replaced by the
new 1-0 and opening; the three traces stay (castles 3-4 and 5-4, and World 8's turnip, now told by the miner). The
rest stands, and Chapter 2 is unchanged.

1. **Which Lost world for Peach?** DECIDED: **Lost 4-4**, Toadstool Grove, disguised as a tall Toad (2.16). Lost 2-4
   is too early, right after the 8-4 reveal.
2. **Partners before or after their hero?** DECIDED: **before the way in** wherever practical. The old man moves to
   a cave mouth at 2-1's start, before the vine (2.5).
3. **How direct should partners be?** DECIDED: **one step clearer than Toad**: Toad hints, a partner says what to
   try. The old man, the Chozo statue, Irene and Lance were made a little clearer.
4. **Who stands at the end of 8-4?** DECIDED: **Toad** (campaign only), so nothing suggests Peach is found (2.12).
5. **The Lost 8-4 card**: DECIDED: **replace the NES wording in the campaign**; classic play keeps it (2.17).
6. **The 8-4 credits**: DECIDED: **keep them at 8-4** as a false ending with `...BUT THE STORY ISN'T OVER.`, roll
   them again at Lost 8-4, the main ending (`THE END. / ...OR IS IT?`), and add a **shorter final credits roll**
   after Lost D-4, the true ending (2.17, 2.18).
7. **The wand's pieces and the Koopalings**: DECIDED: **six pieces, one per Koopaling** (Morton, Wendy, Iggy, Roy,
   Lemmy, Ludwig; Larry owns the wand), plus the **star tip, which the king keeps** (2.15). See 13 for what the
   story needs of them.
8. **Freed heroes and the wand**: DECIDED: **both** weaken it. Every freed hero's spell snaps back into the wand
   (Toad's reactions, 2.14); the castles keep blaming overuse, so the story holds if a player frees nobody.
9. **Tone**: DECIDED: **keep all the jokes** and the references to the heroes' games; they fit the NES vibe.
10. **Toad's map box**: DECIDED: **at the top of the map**; Toad walks in **only for major scenes**, and routine
    lines just show the box (2.3).
11. **The missed-hero hint line**: DECIDED: **per-hero lines** (2.3 and each world).
12. **Larry's spare wand**: DECIDED: **keep the spare** (2.7).

Also from the review: Bowser's 1-0 tease now reveals what the heroes are for, and why ("they don't think like
Koopas"), so Toad's opening says less (2.1, 2.2); Peach leaves three traces before the Lost Kingdom without giving
away where she is (castles 3-4 and 5-4, Toad's World 8 entry); and a short tier list says which scenes are
mandatory (section 1, Story beat tiers).

Settled after the review (the two questions that were still open):

13. **Winning the pieces back.** DECIDED: **the six pieces unlock the Far Lands.** The main story ends at **Lost
    8-4**: Bowser is beaten, the princess is safe and credits roll, but he escapes with the star tip (2.17). The six
    Koopaling airships, one behind each forward warp zone in Lost worlds 1-8 (Lost 1-2 three, 5-1, 5-2 two), are an
    **optional side quest**; each returns one piece, and Toad hints that the pieces matter. **All six** (campaign
    only) open the way to Lost A-D, the **true-ending chapter**: at D-4 the wand is made whole, the rift is sealed
    and Larry gets his wand back whole, with a lock on it (2.18). World 9 keeps the NES rule (a Lost 8-4 clear
    without warps), and classic play keeps the NES rule for A-D (2.15).
14. **The Lost castles' fake Bowsers** (2.3a): DECIDED: **a reveal page too**, as in worlds 1-7. Lost 1-4 to 7-4 get
    two pages each, the reveal first (Goomba, Koopa, Buzzy Beetle, Spiny, Lakitu, Blooper, Hammer Bro, as in the
    code), then their story line. UPDATED Oct 7: the later fakes get true forms too (Lost 8 and D's stand-ins,
    Lost 9, A-4 to C-4; the table in 2.3a), so A-4 to C-4 get two pages as well. The real king never reveals.
