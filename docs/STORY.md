# Story script (0.4.13)

Every story line the player will read, written out for the owner to review and edit before it was built.
**Chapter 1 (sections 2.1-2.14) is built in 0.4.13**: its text lives in `src/game/story/script.ts`, word for word as
here (a test, `script-doc.test.ts`, keeps the two the same; Sophia III's lines in 2.11 came with her route in 0.4.15), and
docs/STORY_SYSTEM.md says how it is wired in. **The Lost Kingdom parts (2.15 on) are Chapter 2**, not built yet.

**How to read this file**

- Text in code blocks is the exact text. It is written in the game's own form: UPPERCASE, only characters the
  bitmap font has (`A-Z 0-9 space - . ! ? , ' : ; % / + ( )`; no double quotes, no `…`, so `...` is used), and
  already wrapped to the box it shows in:
  - **Card** (a dialogue box: Toad, partners, heroes, Larry; `CardScene` with `panel`): at most **28 columns** a
    line (`CARD_COLS` in `free-hero.ts` and `mario-1-0.ts`). The first line is the speaker, then a blank line, then
    at most four lines.
  - **Castle text** (`World.castleText`, centred under the score at the end of an X-4): at most **26 columns**, the
    `THANK YOU <HERO>!` line, a blank line and at most four lines. A castle has **at most two pages**: page 1 is the
    fake-Bowser reveal (2.3a), page 2 the story beat.
  - **Hint line** (the black strip at the bottom of the world map): at most **32 columns**.
- `<HERO>` is the name of the hero the player is using (in a castle it is the short HUD name, as now: `MARIO`,
  `MEGA`, `SOPHIA`; in a card the full name, `MEGA MAN`, `SOPHIA III`). Every line is counted with the longest
  name in its place. In co-op it is player 1's hero, as the castle's thanks are now.
- Lines never name a button, only abilities (`OK`, `JUMP`), as everywhere else in the game.
- Each script block says **WHERE** it shows (the scene or file it would replace or add) and **WHEN** (the
  trigger). Blocks marked **NEW** need a small amount of new code; blocks marked **REPLACES** are text swaps.
- The owner reviewed this draft on 2026-10-07. The decisions are listed at the end (section 3); none are still
  open.

## 1. The story in short

### Premise

Princess Peach is in hiding. King Koopa stole Larry Koopa's magic wand and used it to pull heroes from other
worlds into the Mushroom Kingdom and brainwash them, so they would hunt for the princess and he could kidnap her.
Peach slipped away before anyone could catch her, leaving Toad one note: _gone where no Koopa would ever look_.
The king's answer: his Koopas couldn't find her, so he wants searchers who don't think like Koopas. Mario's job is
to find her first, freeing the heroes on the way so fewer eyes are hunting her. Peach doesn't sit still either:
she sends the Koopas the wrong way, gets villagers out ahead of them and leaves turnips behind, but never lets on
where she is. All that spell-work wears the wand thin, and every hero Mario frees makes it worse: each broken spell
snaps back into the wand and cracks it further (overuse alone still breaks it, so the story holds if a player frees
nobody). When Bowser falls at 8-4 it breaks, and its pieces fall through a rift into the Lost Kingdom. Toad works
out the note: the one place no Koopa would ever look is the Lost Kingdom, so that is where Peach has been all
along, and now the wand's pieces, the Koopalings and Bowser are heading straight for her.

### Beat outline

| Part          | What happens                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-0           | Toad meets Mario: the stolen wand, strange heroes under the king's spell, Peach gone with her note. A hero's shadow dashes past; Bowser laughs and says why: his Koopas couldn't find her, so heroes who don't think like Koopas will.                                                                                                                                                  |
| Worlds 1-7    | On each new world Toad says who we are looking for (never by name) and hints at the kind of place. Partners give clues. Each freed hero cracks the wand a little more. Each castle's Toad has news: the spell lifting, the wand weakening, Bowser fleeing east, and signs that Peach is a step ahead of everyone (a fake map signed - P at 3-4, villagers got out just in time at 5-4). |
| 4-2           | Larry Koopa, angry: the king took his wand and left him a spare. He's helping the hunt to get it back. Beaten, he drops his crystal ball, which sees wherever the wand's spell is at work: the hidden heroes.                                                                                                                                                                           |
| World 8       | Bowser's Land. The last hero is a tank; her pilot Jason is lost in 8-4, taking the pipe everyone else skips. Toad finds a pulled-up turnip he can't explain.                                                                                                                                                                                                                            |
| 8-4           | Bowser falls. The wand flies from his hand and breaks; its pieces fall through a crack in the world. Toad stands at the end. Credits, as a false ending (`...BUT THE STORY ISN'T OVER.`). Back on the World 8 map Toad works out Peach's note: she is in the Lost Kingdom, and the road on to Lost World 1 draws in.                                                                    |
| Lost Kingdom  | Everything looks like home, only meaner. Clues that someone is hiding (more pulled-up turnips, a very tall Toad). The wand broke into six pieces and the star tip: each Koopaling but Larry (Morton, Wendy, Iggy, Roy, Lemmy, Ludwig) grabs a piece and flies off in an airship; the king keeps the star tip, the wand's heart.                                                         |
| Finding Peach | **Later release.** Decided: at the end of Lost 4-4 (Toadstool Grove), the castle's "Toad" pulls off its cap: it's Peach, hiding among the Toads. She stops hiding and joins the team.                                                                                                                                                                                                   |
| Lost 8-4      | **The main ending.** Bowser has taped the star tip to a stick and calls it a wand. Beaten at Lost 8-4, he escapes over the Farewell Sea with the star tip, but the princess is safe and the heroes stay. Credits roll (`THE END. / ...OR IS IT?`). World 9 opens by the NES rule (a Lost 8-4 clear without warps).                                                                      |
| Airships      | **Optional side quest.** Six Koopaling airships, one behind each forward warp zone in Lost worlds 1-8 (Lost 1-2 three, 5-1 one, 5-2 two). Each returns one wand piece. Toad hints that the pieces matter: put the wand back together and we could follow the king.                                                                                                                      |
| Lost A to D-4 | **The true ending, unlocked by all six pieces** (campaign). The rebuilt wand opens the way to the Far Lands (A-D); chase Bowser to the Last Glacier for the star tip. At D-4 the wand is made whole, the rift is sealed and Larry gets his wand back whole, with a lock on it. A shorter final credits roll (`...FOR REAL THIS TIME.`). Classic play keeps the NES unlock rule for A-D. |

### Story beat tiers

- **Tier 1, mandatory scenes** (they always play, as story scenes): the 1-0 opening, Bowser's shadow tease, Larry
  in 4-2, the crystal ball, the 8-4 wand break (with Toad working out the note), the Lost Kingdom reveal, Peach's
  discovery, Bowser back at Lost 8, and the main ending at Lost 8-4 (with his escape and the star-tip tease).
- **Optional:** the Koopaling airships and the six wand pieces they hold. The main story never needs them; all six
  unlock the Far Lands (A-D), whose chapter ends in the true ending at Lost D-4 (a mandatory scene once unlocked).
- **Everything else** (world entries, missed-hero lines, partners, castle news, Toad's reactions, the extras) plays
  **once per file** and is quick to skip: one press of `OK` per page, and (NEW) `BACK` closes the rest of that
  scene's pages.

### Who is where

| World | Hero       | Hidden in                                       | Partner               | Partner stands in                                 | Toad's world hint, in short                                   |
| ----- | ---------- | ----------------------------------------------- | --------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| 1     | Luigi      | 1-1's bonus room, top-right ledge               | Toad himself          | (Toad covers him)                                 | In green, taller, always player two; down where coins are     |
| 2     | Link       | 2-1 sky ruins, past the coin heaven's end       | The old man (Zelda 1) | 2-1's start, in a cave mouth before the vine      | A silent swordsman; ruins above the clouds                    |
| 3     | Mega Man   | 3-1 space station, via a hidden teleporter      | Dr. Light             | 3-1's pipe room (`3-1-bonus`), before the vine    | A blue robot boy with a cannon arm; a star that blinks        |
| 4     | Samus      | 4-2 cavern, down the vine area's warp pipe      | A Chozo statue        | 4-1's pipe room (`4-1-bonus`), the level before   | A hunter in a power suit; pipes that don't warp any more      |
| 5     | Simon      | 5-4 crypt, riding the lift down past its end    | A Simon's Quest local | 5-4's entrance, on the safe floor at its start    | A hunter of the night; deep underground, in a dungeon         |
| 6     | Ryu        | 6-2 dojo, through a trick wall in a pipe room   | Irene Lew             | 6-2's start, before the first pipe                | A ninja you only see if he wants you to; walls that aren't    |
| 7     | Bill       | 7-3 camp, falling through the exploding bridge  | Lance                 | 7-3's start, in the jungle                        | A soldier, one big gun, no shirt; bridges that go boom        |
| 8     | Sophia III | 8-4 garage, after Fred down 8-4-end's trap pipe | Jason                 | `8-4-end`'s trap pipe, the hidden Underworld area | Not a person: a tank that jumps; her pilot takes the bad pipe |

Partners are NPCs you walk up to and talk to with **up**, exactly like a captive hero (`TALK` and the up arrow),
campaign only, and they never leave. The Chozo statue is the one exception in wording: its prompt could read
`READ` instead of `TALK`.

## 2. The scripts, in game order

### 2.1 World 1-0: Toad's greeting

**WHERE:** REPLACES `TOAD_PAGES` in `src/game/tutorial/mario-1-0.ts` (the box at the top of the screen).
**WHEN:** as now, when 1-0 starts, before the first lesson.

Old (5 pages, for reference): _MARIO! THANK GOODNESS YOU'RE HERE! / BOWSER HAS BRAINWASHED THE HEROES OF OTHER
WORLDS AND HIDDEN THEM ALONG YOUR ROAD. / THEY HIDE IN SECRET PLACES... / FIND THEM, TALK TO THEM AND FREE THEM...
LOOK CLOSELY AT THE MAP. / BUT FIRST, A QUICK WARM-UP..._

New (4 pages). Toad says what he knows, not what it's for: the heroes' purpose is Bowser's line to reveal (2.2).

```text
TOAD:

MARIO! THANK GOODNESS
YOU'RE HERE! KING KOOPA
STOLE LARRY'S MAGIC WAND!
```

```text
TOAD:

NOW STRANGE HEROES FROM
OTHER WORLDS ARE POPPING
UP, ALL UNDER THE KING'S
SPELL. BUT WHY?
```

```text
TOAD:

AND THE PRINCESS IS GONE!
SHE LEFT ME ONE NOTE:
GONE WHERE NO KOOPA
WOULD EVER LOOK. - P
```

```text
TOAD:

SEARCH EVERY PIPE, VINE
AND HIDDEN BLOCK! BUT
FIRST, A WARM-UP. FOLLOW
THE TIPS UP TOP!
```

### 2.2 World 1-0: the shadow tease

**WHERE:** REPLACES `TEASE_LINES` in `src/game/tutorial/tease.ts` (Bowser's shadow, in the prompt box).
**WHEN:** as now, near 1-0's flagpole, after the hero's shadow dashes past.

Old: _BOWSER: BWA HA HA! / YOUR FRIENDS SERVE ME NOW, MARIO!_

New (two pages; NEW: the box turns to the second page on `OK` or after a few seconds). It answers Toad's "but why?"
and Peach's note: the king wants searchers who don't think like Koopas.

```text
BOWSER: BWA HA HA!
MY KOOPAS COULDN'T FIND
THAT PRINCESS. FINE!
```

```text
THESE HEROES DON'T THINK
LIKE KOOPAS. THEY'LL SNIFF
HER OUT BEFORE YOU DO!
```

### 2.3 Toad on the world map (new)

Toad has no voice on the map today (he only appears in the airship-crash cutscene). Decided: his lines use the
same box as 1-0 (a `CardScene` panel with the `OK` prompt), **at the top of the map** so the hero and nodes stay
visible. Toad's map sprite (`toad-map-0/1`) **walks in** from the left, as in the crash, **only for major scenes**:
the World 1 entry right after 1-0, his fake-Bowser explanation after 1-4, the airship crash, the 8-4 rift scene
(the wand break and the note), the Lost Kingdom entry, Peach found, and the epilogue. Routine lines (world entries,
missed heroes, a hero joined, the extras) just show the box. Each line plays **once per file** (a small list of
seen story beats on the save file, optional so no format bump). When several are due at once they play in this
order: hero joined, world entry, missed hero. (The castle's news is said in the castle itself, so the map doesn't
repeat it.)

#### The "missed something" lines (one per hero)

**WHERE:** NEW card, plus the hint line: REPLACES `HIDING_HINT` (`SOMEONE IS HIDING IN THIS LEVEL`) and
`HIDING_SAID` in `src/game/scenes/world-map.ts` with a line per hero (decided: per-hero lines).
**WHEN:** the card once, the first time that hero's shadow appears by its node (the level cleared, the hero not
freed). The hint line every time the hero stands on that node while the shadow shows. They are in each world's
section below.

After the crystal ball, every remaining shadow appears at once, so the per-hero cards are skipped and one card
is shown instead (see 2.7).

### 2.3a The fake Bowsers (worlds 1-7)

As in SMB1, the "Bowsers" at the end of castles 1-4 to 7-4 are not the king. Our game already has their true forms
(1-4 Goomba, 2-4 Koopa, 3-4 Buzzy Beetle, 4-4 Spiny, 5-4 Lakitu, 6-4 Blooper, 7-4 Hammer Bro). Today a player only
sees the true form after a fireball kill, and nothing explains it. In our story they are **minions the king dressed
in his own shape with the stolen wand**, so he never has to face Mario himself until 8-4. The owner wants this
**apparent to the player**.

What changes, in the campaign only (classic play keeps the NES behaviour):

1. **A tell during the fight.** Every 4 s or so, the fake's disguise flickers for a few frames and the true creature's
   silhouette shows through, with a soft wand sparkle. With reduce flashing on, use a steady bright outline of the true form
   instead of a flicker (one full-contrast colour over Bowser and the black, held for the tell's window, never
   blinking). The real Bowser in 8-4 never flickers.
2. **The disguise always comes off.** However he is beaten, by the axe and bridge or by fireballs, the disguise bursts
   in a puff of wand sparkles with a "poof" sound. The true form drops into the lava, or flees off screen where there's
   no lava. Every hero sees it, not only those who throw fireballs.
3. **The castle names the creature.** Each X-4 castle's news is now two pages, never more: first the reveal, then
   the story beat. The lines are in each world's section below.
4. **Toad explains it once on the map,** the first time the World 1 map shows after 1-4 is cleared:

```text
TOAD:

DID YOU SEE THAT? THE KING
USED THE WAND TO DRESS A
GOOMBA UP AS HIMSELF!
```

```text
TOAD:

HE HIDES BEHIND STAND-INS.
THE REAL ONE WON'T FACE
YOU UNTIL HIS OWN LAND.
```

5. **8-4 is the real thing.** It has no flicker and no puff. On first entering the bridge room (campaign, NEW), Bowser
   speaks in the prompt box before the fight:

```text
BOWSER: NO MORE STAND-INS,
<HERO>. THIS TIME IT'S
REALLY ME! BWA HA HA!
```

The 8-4 castle's first page then confirms it was real (2.12).

**The Lost Kingdom** has its own fake Bowsers (Lost 1-4 to 7-4). The same tell and the same always-reveal apply there,
and (decided) their castles get a reveal page too: page 1 names the creature, page 2 is the story line (2.15). The
code gives them the same true forms as worlds 1-7 (`bowser-die-N` by world number, in `bowser.ts`): Lost 1-4 Goomba,
2-4 Koopa, 3-4 Buzzy Beetle, 4-4 Spiny, 5-4 Lakitu, 6-4 Blooper, 7-4 Hammer Bro.

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
reveals anything. A-4 to C-4 now get two pages like the other fake castles: page 1 the reveal, page 2 the story line.

### 2.3b Restyled levels: "why does it look so different here?"

From 0.4.9 (7-3) and 0.4.12 (2-1, 3-1, 4-2, 5-4, 6-2), the level where a hero hides takes on their game's look in
the campaign. **The story reason:** when the wand pulled a hero into the Mushroom Kingdom, it dragged a bit of their
world along, and that bit reshaped the level they hide in. The look **stays after the hero is freed**, as a souvenir
of where they were found (owner decision). The level's look music plays there for every hero; it is effectively the
hero's level.

**WHEN:** the first time the player starts that level on a file (campaign), Toad's box shows one card before play.
It is a light, story-flavoured hint that someone from another world is near; it never names them.

```text
TOAD:

WHY DOES SEA SIDE LOOK SO
DIFFERENT HERE? STONE
RUINS? SOMEONE BROUGHT A
BIT OF THEIR WORLD ALONG.
```

(2-1, Zelda II look)

```text
TOAD:

WHY DOES NIGHT HILLS LOOK
LIKE A FACTORY HERE? ALL
BOLTS AND PIPES. SOMEBODY
BROUGHT THEIR WORLD ALONG.
```

(3-1, Mega Man look)

```text
TOAD:

MUSHROOM WOODS, BUT BLUE
AND BUBBLY DOWN HERE? IT
FEELS LIKE ANOTHER PLANET.
```

(4-2, Metroid look)

```text
TOAD:

WHY DOES THIS CASTLE LOOK
SO... OLD? CANDLES, STONE,
AND I SWEAR SOMETHING JUST
MOVED IN THAT WINDOW.
```

(5-4, Castlevania look)

```text
TOAD:

SNOW NIGHT HAS STREETS
NOW? SHOP FRONTS, LAMPS...
SOMEONE'S WORLD HAS
BLED INTO THIS ONE.
```

(6-2, Ninja Gaiden look)

```text
TOAD:

CANNON COAST TURNED INTO A
JUNGLE?! AND WHAT'S WITH
THAT BRIDGE'S RED LIGHT?
```

(7-3, Contra look, already in the game since 0.4.9; this card is added with the story batch)

The coin heavens above these levels share the look (owner decision); bonus rooms and water areas keep their own.

### 2.4 World 1: Grass Land (Luigi)

**Toad's world entry**: NEW card on the World 1 map. **WHEN:** back on the map after 1-0 is cleared (or skipped),
as the road to 1-1 draws in.

```text
TOAD:

FIRST, WHO ARE WE LOOKING
FOR HERE? SOMEONE IN GREEN.
TALLER THAN YOU. JUMPS
HIGHER. ALWAYS PLAYER TWO.
```

```text
TOAD:

IF I KNOW HIM, HE FOUND
THE COINS BEFORE YOU DID.
DOWN A PIPE, MAYBE?
```

**Missed him** (shadow on 1-1):

```text
TOAD:

HUH. 1-1 FEELS... CROWDED.
LIKE SOMEONE WAS WAITING
UNDER IT THE WHOLE TIME.
```

Hint line: `TOAD: I HEAR A MUSTACHE SIGH...`

**Partner:** none. Toad covers Luigi.

**Luigi's lines** (`DIALOGUE.luigi` in `free-hero.ts`): keep as they are. Only the first card changes, for every
hero (below, 2.13).

**Castle 1-4**: REPLACES the `BUT OUR PRINCESS IS IN / ANOTHER CASTLE!` push in `World.updateBossClear`
(`src/game/world/world.ts`), with a line per castle (keyed by the castle's main level id). **WHEN:** as now,
1.5 s after the thanks.

```text
THANK YOU <HERO>!

IT WAS A GOOMBA IN THE
KING'S SHAPE! WAND MAGIC!
```

Then, 2 s later (second page, same box):

```text
THE REAL KING FLED EAST,
WAND AND ALL.
```

### 2.5 World 2: Sea Side (Link)

**Toad's world entry** (first arrival on the World 2 map):

```text
TOAD:

ONE CASTLE DOWN! NEXT WE
SEEK A SWORDSMAN IN A
GREEN CAP. HE NEVER SAYS
A WORD. NOT ONE. I'VE TRIED.
```

```text
TOAD:

I KEEP DREAMING OF OLD
RUINS ABOVE THE CLOUDS.
FUNNY... THE CLOUDS HERE
END SO SUDDENLY.
```

**Missed him** (shadow on 2-1):

```text
TOAD:

2-1 LOOKED TALLER THAN IT
SHOULD. AS IF IT KEPT GOING
UP, PAST THE LAST CLOUD...
```

Hint line: `TOAD: SOMETHING UP THERE HUMS...`

**Partner: the old man in the cave.** Decided: before the way in. He stands at **2-1's start**, in front of a
cave mouth (NEW decor: a dark doorway in a small rock face, with a fire on either side) on the ground at columns
6-8, between where the hero starts (column 2) and the first tree (column 11). That ground is empty today, so no
tiles change, and it comes well before the vine brick (column 83) and the coin heaven. (He used to stand in the pipe
room `2-1-bonus`, which comes after the vine.)

```text
OLD MAN:

IT'S DANGEROUS TO GO
ALONE! TAKE THIS.
```

_(A single coin pops out over him.)_

```text
OLD MAN:

THE SILENT ONE WAITS ABOVE
THE CLOUDS. A BRICK AHEAD
HIDES A VINE. CLIMB IT.
```

```text
OLD MAN:

WHERE THE COINS IN THE SKY
RUN OUT, BUMP THE EMPTY AIR.
A SECOND VINE GOES HIGHER.
```

```text
OLD MAN:

ALSO, PAY ME FOR THE DOOR
REPAIR CHARGE. ...KIDDING.
THERE IS NO DOOR.
```

**Link's lines:** keep (`THE SHADOW... HOLDS ME...`). Toad's "never says a word" pays off when Link joins (2.14).

**Castle 2-4:**

```text
THANK YOU <HERO>!

A KOOPA IN DISGUISE! THE
KING SENDS STAND-INS.
```

Then, 2 s later (second page, same box):

```text
THE SPELL OVER THE SEA IS
FADING. THE KING'S SHIPS
SAILED FOR THE HILLS.
```

### 2.6 World 3: Night Hills (Mega Man)

**Toad's world entry:**

```text
TOAD:

THE SEA IS CALM AGAIN!
NEXT: A BLUE ROBOT BOY
WITH A CANNON FOR AN ARM.
FROM THE FUTURE, I THINK.
```

```text
TOAD:

LOOK AT THE SKY TONIGHT.
ONE STAR KEEPS BLINKING.
STARS DON'T BLINK LIKE
THAT. DO THEY?
```

**Missed him** (shadow on 3-1):

```text
TOAD:

THAT STAR OVER 3-1 IS
STILL BLINKING. I THINK
IT'S BLINKING AT US.
```

Hint line: `TOAD: A STAR UP THERE BLINKS...`

**Partner: Dr. Light**. He stands in 3-1's pipe room (`3-1-bonus`, the pipe at column 38), which
comes **before** the vine (column 131) and the coin heaven where the teleporter block hides.

```text
DR. LIGHT:

AH, A VISITOR! I'VE BEEN
TRACKING MY BOY'S SIGNAL.
IT COMES FROM ABOVE THE
SKY. HIGHER THAN COINS GO.
```

```text
DR. LIGHT:

MY OLD TELEPORTER ANSWERS
TO A HIDDEN BLOCK. PAST
THE CLOUD COINS, KEEP
JUMPING. BUMP THE AIR!
```

**Mega Man's lines:** keep (`ERROR... ROGUE PROGRAM`, the dark copy). Dark Mega Man stays an original villain.

**Castle 3-4:**

```text
THANK YOU <HERO>!

A BUZZY BEETLE THIS TIME!
STILL NOT THE REAL KING.
```

Then, 2 s later (second page, same box):

```text
SOMEONE SLIPPED THE KOOPAS
A MAP SIGNED - P. IT LED
THEM STRAIGHT INTO A
SWAMP. HA!
```

(Peach clue 1: she is out there, a step ahead, and never says where.)

### 2.7 World 4: Mushroom Woods (Samus, and Larry Koopa)

**Toad's world entry:**

```text
TOAD:

THREE CASTLES! THE KING IS
WORRIED. NEXT: A HUNTER
IN A POWER SUIT. NO ONE
HAS EVER SEEN HER FACE.
```

```text
TOAD:

SOME OLD WARP PIPES HERE
DON'T WARP ANY MORE...
THEY GO DOWN. DEEP DOWN.
```

```text
TOAD:

AND I SAW AN AIRSHIP
FLYING LOW OVER 4-2.
KEEP AN EYE ON THE SKY!
```

**Missed her** (shadow on 4-2):

```text
TOAD:

4-2 SOUNDED HOLLOW. LIKE
THERE'S A WHOLE CAVE UNDER
IT THAT WE NEVER SAW.
```

Hint line: `TOAD: THE PIPES HERE ECHO...`

**Partner: a Chozo statue.** A small seated Chozo statue (the `zebes` sheet's) in 4-1's pipe room
(`4-1-bonus`, the pipe at column 132), the level **before** 4-2. Statues don't talk, so its card has no speaker
name; its prompt could read `READ`.

```text
AN OLD BIRD STATUE. ITS
EYES GLOW. WORDS ARE CUT
INTO ITS BASE:
```

```text
THE HUNTER SLEEPS BELOW.
CLIMB THE NEXT LAND'S VINE
TO THE PIPE THAT NO LONGER
WARPS, AND GO DOWN.
```

**Samus's lines:** keep (the parasite, the countdown).

#### 4-2: Larry Koopa (new lines)

The old story had Larry steal the wand; now the king stole it from him. Larry still fights with a wand (his
sprite holds one, and he fires rings), so this script makes it a cheap spare (decided: keep the spare), and gives
him a reason to fight: the king promised his wand back once the princess is caught.

**Larry in his room**: NEW card in `4-2-larry` (`scenes/airship.ts`). **WHEN:** the first time the hero rises
out of the room's pipe in a run (not again on TRY AGAIN, so retries stay quick). The fight starts when it closes.

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

**Larry beaten**: his `BWAH!` stays. **The crystal ball card**: REPLACES `CRYSTAL_BALL_CARD` in
`src/game/scenes/level.ts` (two cards; the constant's comment allows 26 columns, and these keep to it).

Old: _THE CRYSTAL BALL SHOWS / WHERE YOUR FRIENDS / ARE HIDDEN!_

```text
LARRY DROPPED HIS
CRYSTAL BALL! IT SEES
WHEREVER THE WAND'S SPELL
IS AT WORK...
```

```text
...SO IT SHOWS WHERE
YOUR FRIENDS ARE HIDDEN!
```

**After the airship crash** (World 4 map): NEW card. **WHEN:** right after the crash cutscene, once Toad has
hammered the wreck into the bonus spot, before the road draws in. This also stands in for the per-hero "missed"
cards that the crystal ball makes appear all at once.

```text
TOAD:

NICE LANDING! I MADE THE
WRECK INTO A BONUS SPOT.
WATCH OUT FOR HAMMER BROS.
```

```text
TOAD:

AND THAT CRYSTAL BALL LIT
UP EVERY HIDING PLACE ON
THE MAP. SEE THE SHADOWS?
```

The bonus spot's texts (`TOAD'S BONUS HOUSE`, `BEAT THE HAMMER BRO TO REOPEN`, `THE HAMMER BROS ARE BEATEN!`,
the Toad House's `PICK A BOX...`) need no change.

**Castle 4-4:**

```text
THANK YOU <HERO>!

A SPINY IN A KING SUIT!
OUCH. STILL A FAKE.
```

Then, 2 s later (second page, same box):

```text
THE KING WAVED THE WAND AT
US, BUT IT ONLY FIZZLED!
IT'S GETTING WEAKER.
```

### 2.8 World 5: Sky Trees (Simon)

**Toad's world entry:**

```text
TOAD:

THE WOODS ARE FREE! NEXT:
A HUNTER OF THE NIGHT.
HIS FAMILY HAS FOUGHT
VAMPIRES FOR AGES.
```

```text
TOAD:

UP IN THE SKY TREES? NO...
A MAN LIKE THAT IS DEEP
UNDERGROUND, IN SOME
DUNGEON. BRR!
```

**Missed him** (shadow on 5-4):

```text
TOAD:

THAT CASTLE'S LIFT WENT
DOWN... AND SOMETHING DOWN
THERE WENT TAP, TAP, TAP.
```

Hint line: `TOAD: THIS LIFT SMELLS OF BATS`

**Partner: a Simon's Quest townsperson**. A robed villager who wandered in looking for Simon, on the
safe floor at the start of 5-4, before the lift at column 84. Simon's Quest's villagers are famous for unhelpful
riddles; this one is helpful, but sounds just as odd.

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

(The last line is a Simon's Quest joke that happens to be true here: big Mario's head bump does break the
cracked wall.)

**Simon's lines:** CHANGE, because Larry no longer had the wand. In `DIALOGUE.simon`:

Old:

```text
LARRY'S WAND WOKE THE CURSE
DRACULA LEFT IN MY BLOOD.
NOW I AM HIS THRALL.

<HERO>... TAKE MY WHIP.
END HIM IN HIS CASTLE!
```

New:

```text
THE STOLEN WAND WOKE THE
CURSE DRACULA LEFT IN MY
BLOOD. NOW I AM HIS THRALL.

<HERO>... TAKE MY WHIP.
END HIM IN HIS CASTLE!
```

The code comment above it (`Larry's wand woke the curse...`) and docs/HEROES.md ("Larry Koopa stole a magic
wand", Simon's paragraph) should be updated with the code.

**Castle 5-4:**

```text
THANK YOU <HERO>!

A LAKITU, OF ALL THINGS!
THE KING HIDES BEHIND
HIS OWN SHAPE.
```

Then, 2 s later (second page, same box):

```text
THE KOOPAS STORMED OUR
VILLAGE, BUT IT WAS EMPTY.
SOMEONE GOT US ALL OUT
JUST BEFORE THEY CAME.
```

(Peach clue 2.)

### 2.9 World 6: Snow Night (Ryu)

**Toad's world entry:**

```text
TOAD:

FIVE CASTLES! NEXT: A
NINJA. YOU WON'T SEE HIM
UNLESS HE WANTS YOU TO.
```

```text
TOAD:

NINJAS LOVE SECRET DOORS.
WALLS THAT AREN'T WALLS.
I'D PUSH ON ANYTHING THAT
LOOKS... POKED.
```

**Missed him** (shadow on 6-2):

```text
TOAD:

6-2 HAD A STAR STUCK IN
A WALL. NOT THE GOOD KIND
OF STAR, EITHER.
```

Hint line: `TOAD: A WALL IN HERE IS WATCHING`

**Partner: Irene Lew**. On the ground at the start of 6-2, before the first pipe (column 19), which is
the pipe down to the room with the trick wall.

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

**Ryu's lines:** keep (the Masked Ninja's curse). The Masked Ninja stays an original villain.

**Castle 6-4:**

```text
THANK YOU <HERO>!

A BLOOPER?! IN A CASTLE?
THE WAND'S TRICKS ARE
GETTING SILLY.
```

Then, 2 s later (second page, same box):

```text
THE KING SLEEPS WITH THE
WAND UNDER HIS PILLOW NOW.
HE KNOWS YOU'RE COMING.
```

### 2.10 World 7: Cannon Coast (Bill)

**Toad's world entry:**

```text
TOAD:

SIX CASTLES! NEXT: A
SOLDIER. ONE BIG GUN,
NO SHIRT, NO FEAR.
```

```text
TOAD:

THE COAST LOOKS LIKE A
JUNGLE NOW, AND THE
BRIDGES GO BOOM. RUN, OR
DON'T. HE'D KNOW WHICH.
```

**Missed him** (shadow on 7-3):

```text
TOAD:

THAT JUNGLE STILL SMELLS
OF SMOKE. SOMEONE IS
CAMPING UNDER THOSE
BRIDGES.
```

Hint line: `TOAD: I SMELL A CAMPFIRE...`

**Partner: Lance**. In the jungle at the start of 7-3 (in its Contra look), well before the marked
bridge at column 128.

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

**Bill's lines:** keep (Red Falcon, `KING KOOPA'S SPELL LET THE ALIEN TAKE MY MIND`), and the Jungle Assault
briefing (`RED FALCON'S ALIENS HAVE TAKEN BILL'S MIND...`) stays.

**Castle 7-4:**

```text
THANK YOU <HERO>!

A HAMMER BRO! THE LAST
FAKE. THE REAL KING
WAITS IN HIS OWN LAND.
```

Then, 2 s later (second page, same box):

```text
THE WAND IS CRACKING! ALL
THAT SPELL-WORK WORE IT
THIN. HE'S GONE HOME.
```

### 2.11 World 8: Bowser's Land (Sophia III)

**Toad's world entry:**

```text
TOAD:

BOWSER'S LAND. HE'S IN
HERE SOMEWHERE WITH THE
WAND. AND HE'S NOT HAPPY.
```

```text
TOAD:

THE LAST ONE WE SEEK ISN'T
A PERSON AT ALL. IT'S A...
TANK? A TANK THAT JUMPS?
```

```text
TOAD:

HER PILOT IS LOST IN THE
KING'S CASTLE. HE KEEPS
TAKING THE PIPE THAT
EVERYONE ELSE SKIPS.
```

```text
TOAD:

ODD... SOMEONE PULLED UP A
TURNIP RIGHT HERE. IN
BOWSER'S LAND! WHO PLANTS
TURNIPS NEXT TO LAVA?
```

(Peach clue 3. Toad can't explain it; it points at her SMB2 kit and the Lost Kingdom's turnips.)

**Missed her** (shadow on 8-4; only after 8-4 is cleared, so this one plays after the rift scene):

```text
TOAD:

A FROG HAS BEEN SITTING
ON 8-4, CROAKING AT ME.
I THINK HE WANTS SOMETHING.
```

Hint line: `TOAD: A FROG CROAKED IN THERE`

**Partner: Jason** (already designed, ROADMAP idea 3). In the hidden Underworld area behind `8-4-end`'s trap pipe
(column 10). Talking to him starts the follow-Fred swim.

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

**Sophia III's lines** (NEW `DIALOGUE.sophia`): a tank can't talk, so the brainwashing speaks through her
computer. The first card is the shared one (2.13). The challenge:

```text
SOPHIA III:

PILOT NOT FOUND. THE
PLUTONIUM BOSS HAS THE
WHEEL. <HERO>...
CLIMB IN. BLAST IT OUT!
```

### 2.12 World 8-4: Bowser falls, the wand breaks

**The scene** (NEW, stage directions for the build): the axe, the bridge falls as now, Bowser falls. As he drops,
the wand spins up out of his hand, cracks with a white flash (no flash with reduce flashing), and breaks into
glowing pieces. A jagged, shimmering crack opens in the air over the lava; the pieces swirl into it and it stays
open, humming. The hero walks on as now.

**Who stands at the end:** Peach can't be there any more (she's hiding). Decided: in the campaign only, the
`princess` at `8-4-end` column 57 is swapped for our Toad, who came to cheer. Outside the campaign 8-4 keeps the
princess and the classic text.

**Castle 8-4**: REPLACES the `YOUR QUEST IS OVER.` push in `World.updateBossClear` (campaign only).

Old: _THANK YOU MARIO! / YOUR QUEST IS OVER._

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

**The credits** roll over it as now (`CreditsScene`). Decided: they stay at 8-4 as a **false ending**; the player
should feel the game is over. In the campaign, the last credits page at 8-4 gets one more line block after
`THANKS FOR PLAYING / SUPER MARIO BROS. CROSSOVER`:

```text
...BUT THE STORY
ISN'T OVER.
```

**Toad works out the note** (World 8 map): NEW cards. **WHEN:** after the credits, when the World 8 map shows
again, before the road on to Lost World 1 draws in.

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
WOULD EVER LOOK, AND NO
HERO EVER SNIFFED. THAT'S
WHERE SHE IS, <HERO>!
```

(This pays off Bowser's tease: the heroes he brought in because they don't think like Koopas never searched there.)

```text
TOAD:

BUT THE WAND'S PIECES FELL
IN THERE TOO, AND THE
KOOPALINGS WILL GO AFTER
THEM. LET'S HURRY!
```

### 2.13 Every hero: the first card, and the freed card

**The first card** (`captiveDialogue` in `free-hero.ts`, shared by every hero): CHANGE, so the brainwashing says
what it is for.

Old:

```text
LUIGI:

...LUIGI SERVES
KING KOOPA...
```

New:

```text
LUIGI:

...LUIGI SERVES
KING KOOPA...
...MUST FIND
THE PRINCESS...
```

(The name is the hero's; `SOPHIA III` fits.)

**The freed card** (`freedCard`): keep (`<HERO> IS FREE! / <HERO> JOINS YOUR TEAM. / PICK THE NEW HERO WHEN YOU
ENTER A LEVEL.`). Toad's reaction comes on the map (2.14).

**The mini games' own lines** (the Shadow Keep's `LINK... WAKE UP...`, `THE SPELL BREAKS!`, `DRACULA IS
DEFEATED! / THE CURSE IS BROKEN.`, `THE MASKED NINJA FALLS!`, `SAMUS ESCAPED!`, `DARK MEGA MAN IS BEATEN!`, the
Ninja Gaiden cutscene, the Contra briefing): no change needed. They speak of a spell or a curse, which still fits.

### 2.14 Toad's reactions

**A hero joins**: NEW card on the map. **WHEN:** the first time the map shows after a hero is freed. These
cards carry the rule that **freeing heroes weakens the wand**: each broken spell snaps back into it. (The castles
keep blaming overuse, so the story holds if a player frees nobody.)

Generic: plays once per file for the **first** hero freed, before that hero's own card, and for any hero without a
specific card. If the wand has already broken (8-4 cleared), the crack card is skipped.

```text
TOAD:

ANOTHER HERO SET FREE! AND
DID YOU HEAR THAT CRACK?
EVERY SPELL YOU BREAK SNAPS
BACK INTO THE WAND!
```

```text
TOAD:

ONE LESS PAIR OF EYES
HUNTING THE PRINCESS, AND
ONE MORE CRACK IN THE WAND!
```

Specific (keep all; each plays the first time the map shows after that hero is freed):

```text
TOAD:

LUIGI! I KNEW YOU'D SNAP
OUT OF IT. ...YOU DID SNAP
OUT OF IT, RIGHT?
```

```text
TOAD:

THE SWORDSMAN STILL HASN'T
SAID A WORD TO ME. HE
TALKED TO YOU?!
```

```text
TOAD:

A ROBOT ON THE TEAM! CAN
HE MAKE TOAST? ...NO?
OKAY. STILL GREAT.
```

```text
TOAD:

THE HUNTER IS WITH US! SHE
SAID THANKS. I THINK. HER
HELMET MUFFLES THINGS.
```

```text
TOAD:

THE VAMPIRE HUNTER SAID
WHAT A HORRIBLE NIGHT IT
IS. IT'S THE MIDDLE OF
THE DAY.
```

```text
TOAD:

THE NINJA IS WITH US! HE
WAS STANDING BEHIND ME THE
WHOLE TIME, WASN'T HE.
```

```text
TOAD:

THE SOLDIER SAYS THANKS.
AT LEAST I THINK SO. IT
WAS MOSTLY EXPLOSIONS.
```

```text
TOAD:

JASON AND FRED SAY THANK
YOU! AND THE TANK... DID
THE TANK JUST HONK?
```

**All heroes found**: NEW card on the map. **WHEN:** the first time the map shows with every hidden hero freed.
Two versions, by whether 8-4 is cleared yet.

Before 8-4:

```text
TOAD:

EVERY HERO IS FREE! NOBODY
HUNTS THE PRINCESS NOW...
EXCEPT BOWSER. THE WAND
MUST BE NEARLY EMPTY!
```

After 8-4:

```text
TOAD:

EVERY HERO IS FREE! NOW
THEY'RE ALL LOOKING FOR
THE PRINCESS WITH US.
```

**Optional extras** (first visit only):

The Warp Zone hub (`STARLIGHT CROSSING`):

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
