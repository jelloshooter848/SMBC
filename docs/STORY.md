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
- **No text ever moves on by itself**: every page waits for a press (NEW: today's story pages turn by themselves
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

At 8-4 the real Bowser falls, the wand breaks, and its pieces fall through a rift into the Lost Kingdom. Toad works
out the note: the place no Koopa would ever look is the Lost Kingdom, so that is where Peach went, and now the
wand's pieces, the Koopalings and Bowser are heading straight for her (Chapter 2).

### Beat outline

| Part          | What happens                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New file      | Peach's castle: the princess is missing. Her handwritten note fills the screen. Toad and Mario set off.                                                                                                                                                                                                                                                                                 |
| 1-0           | The warm-up. At its end Bowser appears in person, shows off his wand, quotes the note, and casts the spell: eight heroes are pulled into the eight worlds, brainwashed.                                                                                                                                                                                                                 |
| World 1       | Toad: Bowser brought people from other universes to find Peach; where's Luigi? In 1-1 a brainwashed Luigi runs away; a villager saw him go down a pipe. Freed, Luigi explains the brainwashing.                                                                                                                                                                                         |
| Worlds 2-7    | Each world is its hero's homeland (Hyrule, 20XX, Zebes, Transylvania, a ninja village, the front). A local welcomes you on the start node; NPCs in the hero's level give the hints; the freed hero talks. Each castle's fake is unmasked. With the castle cleared and the hero freed, Bowser's wand misfires and the seal to the next world breaks.                                     |
| 4-2           | Larry Koopa, angry: the king took his wand and left him a spare. Beaten, he drops his crystal ball, which from then on shows on the map where each hero hides.                                                                                                                                                                                                                          |
| World 8       | The Underworld (Blaster Master) and Bowser's own land. The last hero is a tank; her pilot Jason is lost in 8-4 after his frog. A miner found a pulled-up turnip by the lava.                                                                                                                                                                                                            |
| 8-4           | Bowser falls. The wand flies from his hand and breaks; its pieces fall through a crack in the world. Toad stands at the end. Credits, as a false ending (`...BUT THE STORY ISN'T OVER.`). Back on the World 8 map, with Sophia III freed, Toad works out Peach's note: she is in the Lost Kingdom, and the road on to Lost World 1 draws in.                                            |
| Lost Kingdom  | Everything looks like home, only meaner. Clues that someone is hiding (more pulled-up turnips, a very tall Toad). The wand broke into six pieces and the star tip: each Koopaling but Larry (Morton, Wendy, Iggy, Roy, Lemmy, Ludwig) grabs a piece and flies off in an airship; the king keeps the star tip, the wand's heart.                                                         |
| Finding Peach | **Later release.** Decided: at the end of Lost 4-4 (Toadstool Grove), the castle's "Toad" pulls off its cap: it's Peach, hiding among the Toads. She stops hiding and joins the team.                                                                                                                                                                                                   |
| Lost 8-4      | **The main ending.** Bowser has taped the star tip to a stick and calls it a wand. Beaten at Lost 8-4, he escapes over the Farewell Sea with the star tip, but the princess is safe and the heroes stay. Credits roll (`THE END. / ...OR IS IT?`). World 9 opens by the NES rule (a Lost 8-4 clear without warps).                                                                      |
| Airships      | **Optional side quest.** Six Koopaling airships, one behind each forward warp zone in Lost worlds 1-8 (Lost 1-2 three, 5-1 one, 5-2 two). Each returns one wand piece. Toad hints that the pieces matter: put the wand back together and we could follow the king.                                                                                                                      |
| Lost A to D-4 | **The true ending, unlocked by all six pieces** (campaign). The rebuilt wand opens the way to the Far Lands (A-D); chase Bowser to the Last Glacier for the star tip. At D-4 the wand is made whole, the rift is sealed and Larry gets his wand back whole, with a lock on it. A shorter final credits roll (`...FOR REAL THIS TIME.`). Classic play keeps the NES unlock rule for A-D. |

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

| World | The hero's homeland (look)      | Hero       | Hidden in                                       | Welcome on the start node | Hint NPCs, inside the hero's level                                   |
| ----- | ------------------------------- | ---------- | ----------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| 1     | The Mushroom Kingdom (SMB)      | Luigi      | 1-1's bonus room, top-right ledge               | (Toad's scene, 2.4)       | A villager, 1-1 column 55, by the bonus pipe (57)                    |
| 2     | Hyrule (Zelda II)               | Link       | 2-1 sky palace, past the coin heaven's end      | A healer                  | The old man, by 2-1's vine block (83); a fairy, at 2-1-sky's arrival |
| 3     | The year 20XX (Mega Man)        | Mega Man   | 3-1 space station, via a hidden teleporter      | A lab robot               | Dr. Light, by 3-1's vine block (131)                                 |
| 4     | Planet Zebes (Metroid)          | Samus      | 4-2 cavern, down the vine area's warp pipe      | A scientist               | The Chozo statue, by 4-2's vine block (64)                           |
| 5     | Transylvania (Castlevania)      | Simon      | 5-4 crypt, riding the lift down past its end    | A merchant                | The townsperson, at 5-4's entrance                                   |
| 6     | A ninja village (Ninja Gaiden)  | Ryu        | 6-2 dojo, through a trick wall in a pipe room   | The village elder         | Irene Lew, at 6-2's start                                            |
| 7     | The front (Contra)              | Bill       | 7-3 camp, falling through the exploding bridge  | A sergeant                | Lance, at 7-3's start                                                |
| 8     | The Underworld (Blaster Master) | Sophia III | 8-4 garage, after Fred down 8-4-end's trap pipe | A miner                   | Fred the frog, by 8-4-end's trap pipe (10); Jason, behind it         |

Plus one NPC that is not a hint for a hero: the **pipe keeper** in 1-2's warp zone (2.4), who says where its pipe
goes. Hint NPCs are partners: you walk up and talk with **up** (`TALK`, the statue `READ`), campaign only, and they
never leave. The map titles: World 1's page is MUSHROOM KINGDOM since 0.4.36 (it was GRASS LAND), World 2's HYRULE
since 0.4.24 (it was SEA SIDE), World 3's MEGA CITY since 0.4.26 (it was NIGHT HILLS), World 4's PLANET ZEBES since
0.4.27 (it was MUSHROOM WOODS), World 5's TRANSYLVANIA since 0.4.28 (it was SKY TREES), World 6's DRAGON VALLEY since
0.4.29 (it was SNOW NIGHT), World 7's GALUGA ISLAND since 0.4.30 (it was CANNON COAST) and World 8's BOWSER'S
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
   clock tower; 5-4 keeps its castle hall). World 6 followed (0.4.29): its page is DRAGON VALLEY (it was SNOW
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
They stand **before the way in**, campaign only, and never leave. Talked to again, they say the same pages. Once
their hero is freed, each says one new page instead (NEW: a small "after" line, written with each NPC).

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
   creature** and lands at the axe; the axe goes, the bridge falls, the creature falls with it. No text.
3. **Reaching the axe** with the fake still standing: NEW. As the hero touches the axe, play holds and the disguise
   **bursts** anyway (the "poof"). The true creature blinks on the bridge. The hero **turns to look at it**, and the
   hero's remark shows (one card, written in each world's section). The hero turns back and pulls the axe; the
   bridge falls, the creature falls.
4. Then, either way, the walk to Toad and **the castle's two pages** as now (page 1: Toad on the creature; page 2,
   2 s later in the same box: the news). Both are in each world's section.

In co-op the player nearer the axe is the one who jumps or looks; the other stands still. **Replay:** the unmasking
plays on every clear; the remark card plays the first time per castle per file (after that the hero just looks for
a moment and pulls the axe), so replays stay quick.

**8-4 is the real thing** (KEEP). No flicker and no puff. On first entering the bridge room (campaign), Bowser
speaks in the prompt box before the fight:

```text
BOWSER: NO MORE STAND-INS,
<HERO>. THIS TIME IT'S
REALLY ME! BWA HA HA!
```

The 8-4 castle's first page then confirms it was real (2.12).

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
- **8-4** follows the same rule with the rift as its "gate" (2.12).

**The welcomes** (NEW). Worlds 2-8 are each their hero's homeland, or a piece of it the spell dragged along, laid
over the old map. **Trigger:** the first arrival on World N's start node (N = 2-8), right after the walk in from
the gate. **Staging:** a local (a new map sprite, in the style of the hero's game) stands beside the start node and
speaks in the box at the top; no Toad walk-in. **Replay:** any time, standing on the start node: the hint line
reads `TALK TO THE <LOCAL>` (for example `TALK TO THE HEALER`) and `TALK` (up) plays the welcome again; once the
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

**1-2: a cave Toad.** NEW partner (`cave-toad`, 0.4.40). A Toad in a yellow-spotted cap and a dark miner's
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
LUIGI FOUND HIM. THIS TIME
IT'S PEACH.
```

**1-3: a lookout.** NEW partner (`lookout`, 0.4.40). A Toad in a pink-spotted cap and a green vest, on the ground
at **1-3's start** (column 8), under the treetops he watches the road from.

```text
LOOKOUT:

I CAN SEE THE WHOLE ROAD
FROM UP HERE! JUST NOT
DOWN PIPES. NOBODY CAN SEE
DOWN PIPES.
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

**1-4: a retainer.** NEW partner (`retainer`, 0.4.40). One of the princess's retainers (an orange-spotted cap, a
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

**Hint NPC: a fairy in the clouds.** NEW partner (`fairy`, owner). A small Zelda-style fairy bobbing in the air by
**2-1-sky's arrival** (column 7, beside the vine the player climbs in on at column 4), so nobody rides past her.

```text
FAIRY:

THE SILENT ONE'S TEMPLE
FLOATS HIGHER STILL!
```

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

**Castle 2-4** (a Koopa Troopa). The hero's remark:

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

**Castle 3-4** (a Buzzy Beetle). The hero's remark:

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
HIS KIDS. LARRY. THE KING
STOLE IT FROM HIS OWN SON.
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
LARRY:

AFTER MY WAND, ARE YOU?!
NOBODY TAKES MY WAND!
...NOBODY ELSE, ANYWAY.
STAY RIGHT THERE!
```

He climbs down the chain, sees the hero up close, panics (a `!`, his arms thrown up) and scurries back up (said:
`Larry climbs down the chain, sees you, panics and scurries back up!`). The hero, by name:

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
LARRY:

HEY! THE KING TOOK MY
WAND, AND ALL I GOT WAS
THIS LOUSY SPARE!
```

```text
LARRY:

HE SAYS I GET IT BACK
WHEN THE PRINCESS IS
CAUGHT. SO BUZZ OFF!
```

Once the file has seen the anchor scene (NEW, 0.4.39), Larry knows the hero, and his first page opens instead (the
second page is the same):

```text
LARRY:

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

**Castle 4-4** (a Spiny). The hero's remark:

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

**Hint NPC: the townsperson.** KEEP, on the safe floor at the start of 5-4, before the lift at column 84.

```text
TOWNSPERSON:

WHAT A HORRIBLE NIGHT TO
HAVE A CURSE.
```

```text
TOWNSPERSON:

RIDE THE MOVING FLOOR DOWN,
PAST WHERE FLOORS SHOULD
END. OR DON'T. I'M JUST A
TOWNSPERSON.
```

```text
TOWNSPERSON:

AND HIT THE CRACKED WALL
WITH YOUR HEAD TO MAKE A
HOLE. TRUST ME.
```

(The last line is a Simon's Quest joke that happens to be true here: big Mario's head bump does break the cracked
wall.) After Simon is freed:

```text
TOWNSPERSON:

THE HUNTER IS FREE! WHAT A
WONDERFUL NIGHT TO HAVE NO
CURSE.
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

**Castle 5-4** (a Lakitu). The hero's remark:

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
HUNTER! THE TOWNSPERSON AT
THE OLD CASTLE'S GATE SAID
SOMETHING ABOUT A LIFT...
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

**Castle 6-4** (a Blooper). The hero's remark:

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

**Castle 7-4** (a Hammer Bro). The hero's remark:

```text
<HERO>:

A HAMMER BRO! THE LAST
FAKE. THE REAL KING MUST
BE CLOSE.
```

The castle's pages (REPLACES `CASTLE_PAGES['7-4']`; the old page 2, the wand cracking, is the gates' now):

```text
THANK YOU <HERO>!

A HAMMER BRO UNDER THE
SPELL. THAT WAS HIS LAST
STAND-IN!
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
claws and stands up, furious. His challenge leads to `NO MORE STAND-INS` in 8-4.

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

THE BOY WENT INTO THE KING'S
OWN CASTLE AFTER HIS FROG.
THAT FROG TAKES THE PIPES
NOBODY ELSE DOES.
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

(Peach clue 3. Nobody can explain it; it points at her SMB2 kit and the Lost Kingdom's turnips.)

**Hint NPC: Fred, by the trap pipe.** NEW partner (`fred`). Fred the frog sits beside **8-4-end's trap pipe
(column 10)**, the one that leads down to Jason's secret area in the campaign. He can't talk, so his second page is
a caption. (Fred appears in Jason's area too, by the pool: the frog gets around.)

```text
FRED:

RIBBIT.
```

```text
THE FROG LOOKS AT YOU,
THEN DOWN THE PIPE. THEN
AT YOU AGAIN.
```

After Sophia III is freed, Fred is gone from the pipe (he is home).

**Hint NPC: Jason.** KEEP, in the hidden Underworld area behind the trap pipe. Talking to him starts the follow-Fred
swim.

```text
JASON:

FRED! FRED, COME BACK!
...OH, HI. HAVE YOU SEEN
A FROG? GREEN, THIS BIG?
```

```text
JASON:

HE JUMPED IN THE WATER AND
SWAM DOWN A CRACK. LAST
TIME HE DID THAT, I FOUND
A TANK.
```

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

**Sophia III, captive:** KEEP (the shared first card, then the brainwashing speaking through her computer):

```text
SOPHIA III:

PILOT NOT FOUND. THE
PLUTONIUM BOSS HAS THE
WHEEL. <HERO>...
CLIMB IN. BLAST IT OUT!
```

**Sophia III, freed.** NEW. Her computer finds her pilot, then a tear in space under the castle that the wand holds
shut, and a land beyond it with no Koopas at all (which Toad puts together with the note at the rift).

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
IN SPACE UNDER THIS
CASTLE. THE KING'S WAND IS
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

### 2.12 World 8-4: Bowser falls, the wand breaks, the rift

**The scene** (KEEP, as built): the axe, the bridge falls, Bowser falls. As he drops, the wand spins up out of his
hand, cracks with a white flash (no flash with reduce flashing), and breaks into glowing pieces. A jagged,
shimmering crack opens in the air over the lava; the pieces swirl into it and it stays open, humming. The hero
walks on. Said: _The wand spins out of Bowser's hand and breaks! Its glowing pieces swirl into a crack in the air._

**Who stands at the end:** KEEP. In the campaign, our Toad stands at `8-4-end` column 57 in place of the princess.

**Castle 8-4** (KEEP):

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

**The rift is World 8's gate.** The same rule as every world: the road on to Lost World 1 needs 8-4 cleared **and**
Sophia III freed. The story reason is hers: the last spell still running holds the crack shut.

- **Sophia III not freed yet** (a reminder, Toad's box). **Trigger:** the first time the World 8 map shows after
  the credits with Sophia III still captive. Hint line on 8-4: `SEALED - FREE SOPHIA III FIRST`.

```text
TOAD:

THE KING IS BEATEN, BUT
THAT CRACK IS TOO SMALL TO
GO THROUGH. SOMETHING'S
HOLDING IT SHUT...
```

```text
TOAD:

THE LAST SPELL! THE TANK IS
STILL UNDER IT. HER PILOT IS
LOST IN THE KING'S CASTLE.
```

- **Toad works out the note** (a major scene: Toad walks in). **Trigger:** the first time the World 8 map shows
  with 8-4 cleared and Sophia III freed: right after the credits if she was freed first, or the next time the map
  shows after she is freed (then the crack is first seen tearing wide open on the 8-4 node, a shimmer and a hum,
  as her spell snaps back). The road on to Lost World 1 draws in after it. REPLACES `riftPages` (pages 2-3 new;
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
