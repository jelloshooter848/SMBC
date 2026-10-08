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
| 4-2           | Larry Koopa, angry: the king took his wand and left him a spare. Beaten, he drops his crystal ball, which from then on shows on the map where each hero hides.                                                                                                                                                                                                                         |
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

| World | The hero's homeland (look)          | Hero       | Hidden in                                       | Welcome on the start node | Hint NPCs, inside the hero's level                                     |
| ----- | ----------------------------------- | ---------- | ----------------------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| 1     | The Mushroom Kingdom (SMB)          | Luigi      | 1-1's bonus room, top-right ledge               | (Toad's scene, 2.4)       | A villager, 1-1 column 55, by the bonus pipe (57)                      |
| 2     | Hyrule (Zelda II)                   | Link       | 2-1 sky ruins, past the coin heaven's end       | A healer                  | The old man, by 2-1's vine block (83); a fairy, at 2-1-sky's arrival   |
| 3     | The year 20XX (Mega Man)            | Mega Man   | 3-1 space station, via a hidden teleporter      | A lab robot               | Dr. Light, by 3-1's vine block (131)                                   |
| 4     | Planet Zebes (Metroid)              | Samus      | 4-2 cavern, down the vine area's warp pipe      | A scientist               | The Chozo statue, by 4-2's vine block (64)                             |
| 5     | Transylvania (Castlevania)          | Simon      | 5-4 crypt, riding the lift down past its end    | A merchant                | The townsperson, at 5-4's entrance                                     |
| 6     | A ninja village (Ninja Gaiden)      | Ryu        | 6-2 dojo, through a trick wall in a pipe room   | The village elder         | Irene Lew, at 6-2's start                                              |
| 7     | The front (Contra)                  | Bill       | 7-3 camp, falling through the exploding bridge  | A sergeant                | Lance, at 7-3's start                                                  |
| 8     | The Underworld (Blaster Master)     | Sophia III | 8-4 garage, after Fred down 8-4-end's trap pipe | A miner                   | Fred the frog, by 8-4-end's trap pipe (10); Jason, behind it           |

Plus one NPC that is not a hint for a hero: the **pipe keeper** in 1-2's warp zone (2.4), who says where its pipe
goes. Hint NPCs are partners: you walk up and talk with **up** (`TALK`, the statue `READ`), campaign only, and they
never leave. The map titles (SEA SIDE, NIGHT HILLS...) are unchanged in this draft (see the open questions).

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

### 2.1 A new file: the princess is missing

**Trigger:** NEW. A new save file in the campaign, before the World 1 map shows for the first time. Once per file.
**Replay:** none yet (open question 1).

**Staging:** Peach's castle at dawn, its courtyard in SMB tiles (the castle behind, its flag up, a pale sky). Mario
stands in the courtyard, music soft. Toad runs out of the castle door waving a sheet of paper and stops beside him.
The caption shows in the box at the top:

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

Back in the courtyard, Toad turns to Mario:

```text
TOAD:

MARIO! THE KOOPAS ARE
ALREADY OUT HUNTING FOR
HER. WE HAVE TO FIND HER
FIRST!
```

```text
TOAD:

COME ON, THE ROAD STARTS
JUST OUTSIDE TOWN. LET'S
GO!
```

They run off to the right; the screen fades to the World 1 map, Mario on 1-0.

**Code:** NEW (a cutscene scene with the courtyard, the parchment drawing and the inked font).

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
tease as it is). **Trigger:** where the tease is now (the `flag` lesson, column 83, a few steps before the
flagpole), every time 1-0 is played in the campaign; on **Pause → Skip tutorial** it plays before 1-0 closes if
this file has never seen it. **Replay:** play 1-0 again from its map node.

**Staging:**

1. The music stops and the sky dims. A column of wand sparkles drops onto the ground between Mario and the
   flagpole, and **Bowser appears in it, in full colour** (his own castle palette, no silhouette), facing Mario.
   Mario turns to face him. The pages show in the box at the top.
2. On the second page Bowser lifts **the wand** to show it off: a short rod with a gold star on the tip (a new
   held prop), the star twinkling.
3. After the fourth page, **the spell**: he raises the wand over his head, the star flares (a steady glow with
   reduce flashing), and eight sparks shoot off the top of the screen. Cut to a dark screen with **eight small
   framed windows** in two rows of four, labelled `1` to `8` in a corner. They open one after another (half a
   second each, a rising chime), each showing a strip of its world as it looks in this game (1 the Mushroom
   Kingdom's grass, 2 a Zelda II field, 3 a Mega Man factory, 4 Brinstar's rock, 5 a Castlevania crypt, 6 a
   Ninja Gaiden street, 7 a Contra jungle, 8 the Blaster Master Underworld), and a hero pulled down into it by a
   beam of sparks: Luigi, Link, Mega Man, Samus, Simon, Ryu, Bill, Sophia III, in order. Each hero is drawn in
   **the captive palette** (the brainwashed look they have in their levels) and **half hidden**: a dark vignette
   round the window and wand sparkles drifting over the hero, so the shape reads but not the details. No names
   on screen. `OK` (or `BACK`) skips to the last page.
4. Back in 1-0 for the last page. Bowser laughs and vanishes in a puff of sparkles (the fakes' "poof"), the sky
   clears, the music comes back, and Mario walks on to the flag.

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
line goes back to the generic `SOMEONE IS HIDING IN THIS LEVEL` (Toad's per-hero lines are removed). After Larry's
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
reads `TALK TO THE <LOCAL>` (for example `TALK TO THE HEALER`) and `TALK` (up) plays the welcome again. Each
welcome names the hero, says who did it (the locals don't know who: "someone"), and says where the hero was last
seen. Some carry a clue that Toad's old world entries carried (World 4's airship, World 8's turnip).

### 2.4 (being rewritten)

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
clues that Peach is near (she grows turnips and throws them, as in SMB2; Toad found the first turnip in World 8);
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
