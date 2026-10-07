# Story script (draft for 0.4.13)

Every story line the player will read, written out for the owner to review and edit **before** anything is built.
Nothing here is in the game yet. When a line is approved, it can be pasted into the code as it stands.

**How to read this file**

- Text in code blocks is the exact text. It is written in the game's own form: UPPERCASE, only characters the
  bitmap font has (`A-Z 0-9 space - . ! ? , ' : ; % / + ( )`; no double quotes, no `…`, so `...` is used), and
  already wrapped to the box it shows in:
  - **Card** (a dialogue box: Toad, partners, heroes, Larry; `CardScene` with `panel`): at most **28 columns** a
    line (`CARD_COLS` in `free-hero.ts` and `mario-1-0.ts`). The first line is the speaker, then a blank line, then
    at most four lines.
  - **Castle text** (`World.castleText`, centred under the score at the end of an X-4): at most **26 columns**, the
    `THANK YOU <HERO>!` line, a blank line and at most four lines.
  - **Hint line** (the black strip at the bottom of the world map): at most **32 columns**.
- `<HERO>` is the name of the hero the player is using (in a castle it is the short HUD name, as now: `MARIO`,
  `MEGA`, `SOPHIA`; in a card the full name, `MEGA MAN`, `SOPHIA III`). Every line is counted with the longest
  name in its place. In co-op it is player 1's hero, as the castle's thanks are now.
- Lines never name a button, only abilities (`OK`, `JUMP`), as everywhere else in the game.
- Each script block says **WHERE** it shows (the scene or file it would replace or add) and **WHEN** (the
  trigger). Blocks marked **NEW** need a small amount of new code; blocks marked **REPLACES** are text swaps.
- Partner characters, places for them, and the Peach scenes are **proposals**. Questions for the owner are listed
  at the end.

## 1. The story in short

### Premise

Princess Peach is in hiding. King Koopa stole Larry Koopa's magic wand and used it to pull heroes from other
worlds into the Mushroom Kingdom and brainwash them, so they would hunt for the princess and he could kidnap her.
Peach slipped away before anyone could catch her, leaving Toad one note: _gone where no Koopa would ever look_.
Mario's job is to find her first, freeing the heroes on the way so fewer eyes are hunting her. All that spell-work
wears the wand thin; when Bowser falls at 8-4 it breaks, and its pieces fall through a rift into the Lost
Kingdom. Toad works out the note: the one place no Koopa would ever look is the Lost Kingdom, so that is where
Peach has been all along, and now the wand's pieces, the Koopalings and Bowser are heading straight for her.

### Beat outline

| Part            | What happens                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-0             | Toad meets Mario: the stolen wand, the brainwashed heroes, Peach's note. A hero's shadow dashes past; Bowser laughs.                                                                                                                                                            |
| Worlds 1-7      | On each new world Toad says who we are looking for (never by name) and hints at the kind of place. Partners give clues. Each castle's Toad has news: the spell lifting, the heroes asking about Peach, the wand weakening, Bowser fleeing east.                                 |
| 4-2             | Larry Koopa, angry: the king took his wand and left him a spare. He's helping the hunt to get it back. Beaten, he drops his crystal ball, which sees wherever the wand's spell is at work: the hidden heroes.                                                                   |
| World 8         | Bowser's Land. The last hero is a tank; her pilot Jason is lost in 8-4, taking the pipe everyone else skips.                                                                                                                                                                    |
| 8-4             | Bowser falls. The wand flies from his hand and breaks; its pieces fall through a crack in the world. Credits. Back on the World 8 map Toad works out Peach's note: she is in the Lost Kingdom, and the road on to Lost World 1 draws in.                                        |
| Lost Kingdom    | Everything looks like home, only meaner. Clues that someone is hiding (pulled-up turnips, a very tall Toad). Koopaling airships hunt for the pieces.                                                                                                                            |
| Finding Peach   | **Later release.** Proposed: at the end of Lost 4-4 (Toadstool Grove), the castle's "Toad" pulls off its cap: it's Peach, hiding among the Toads. She stops hiding and joins the team.                                                                                          |
| Lost 8-4 to D-4 | Bowser has taped half the wand together; beaten at Lost 8-4 he flees over the Farewell Sea with the last piece, the star tip. Across the Far Lands (A-D) to the Last Glacier, where the wand is made whole, the rift is sealed and Larry gets his wand back, with a lock on it. |

### Who is where

| World | Hero       | Hidden in                                      | Partner (proposal)    | Partner stands in (proposal)                      | Toad's world hint, in short                                   |
| ----- | ---------- | ---------------------------------------------- | --------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| 1     | Luigi      | 1-1's bonus room, top-right ledge              | Toad himself          | (Toad covers him)                                 | In green, taller, always player two; down where coins are     |
| 2     | Link       | 2-1 sky ruins, past the coin heaven's end      | The old man (Zelda 1) | 2-1's pipe room (`2-1-bonus`): the "cave"         | A silent swordsman; ruins above the clouds                    |
| 3     | Mega Man   | 3-1 space station, via a hidden teleporter     | Dr. Light             | 3-1's pipe room (`3-1-bonus`), before the vine    | A blue robot boy with a cannon arm; a star that blinks        |
| 4     | Samus      | 4-2 cavern, down the vine area's warp pipe     | A Chozo statue        | 4-1's pipe room (`4-1-bonus`), the level before   | A hunter in a power suit; pipes that don't warp any more      |
| 5     | Simon      | 5-4 crypt, riding the lift down past its end   | A Simon's Quest local | 5-4's entrance, on the safe floor at its start    | A hunter of the night; deep underground, in a dungeon         |
| 6     | Ryu        | 6-2 dojo, through a trick wall in a pipe room  | Irene Lew             | 6-2's start, before the first pipe                | A ninja you only see if he wants you to; walls that aren't    |
| 7     | Bill       | 7-3 camp, falling through the exploding bridge | Lance                 | 7-3's start, in the jungle                        | A soldier, one big gun, no shirt; bridges that go boom        |
| 8     | Sophia III | 8-4, Jason's trap pipe (planned, 0.4.11)       | Jason (designed)      | `8-4-end`'s trap pipe, the hidden Underworld area | Not a person: a tank that jumps; her pilot takes the bad pipe |

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

New (6 pages):

```text
TOAD:

MARIO! THANK GOODNESS
YOU'RE HERE!
```

```text
TOAD:

KING KOOPA STOLE LARRY'S
MAGIC WAND. HE USED IT TO
PULL HEROES FROM OTHER
WORLDS INTO OUR KINGDOM...
```

```text
TOAD:

...AND BRAINWASH THEM! NOW
THEY HUNT FOR PRINCESS
PEACH, SO HE CAN GRAB HER.
```

```text
TOAD:

DON'T WORRY, SHE'S HIDING.
SHE LEFT ME ONE NOTE:
GONE WHERE NO KOOPA
WOULD EVER LOOK. - P
```

```text
TOAD:

WE HAVE TO FIND HER FIRST!
FREE THE HEROES ON THE WAY.
CHECK PIPES, VINES AND
HIDDEN BLOCKS. ALL OF THEM!
```

```text
TOAD:

I'LL WATCH THE MAP FOR
ANYONE WE MISS. BUT FIRST,
A QUICK WARM-UP. FOLLOW
THE TIPS UP TOP!
```

### 2.2 World 1-0: the shadow tease

**WHERE:** REPLACES `TEASE_LINES` in `src/game/tutorial/tease.ts` (Bowser's shadow, in the prompt box).
**WHEN:** as now, near 1-0's flagpole, after the hero's shadow dashes past.

Old: _BOWSER: BWA HA HA! / YOUR FRIENDS SERVE ME NOW, MARIO!_

New:

```text
BOWSER: BWA HA HA!
THE HEROES ARE MINE NOW.
THEY'LL SNIFF OUT THAT
PRINCESS BEFORE YOU DO!
```

### 2.3 Toad on the world map (new)

Toad has no voice on the map today (he only appears in the airship-crash cutscene). Proposed: his lines use the
same box as 1-0 (a `CardScene` panel with the `OK` prompt, at the top of the map so the hero and nodes stay
visible), with Toad's map sprite (`toad-map-0/1`) walking in from the left while it shows, as in the crash. Each
line plays **once per file** (a small list of seen story beats on the save file, optional so no format bump).
When several are due at once they play in this order: hero joined, world entry, missed hero. (The castle's news is
said in the castle itself, so the map doesn't repeat it.)

#### The "missed something" lines (one per hero)

**WHERE:** NEW card, plus the hint line: REPLACES `HIDING_HINT` (`SOMEONE IS HIDING IN THIS LEVEL`) and
`HIDING_SAID` in `src/game/scenes/world-map.ts` with a line per hero.
**WHEN:** the card once, the first time that hero's shadow appears by its node (the level cleared, the hero not
freed). The hint line every time the hero stands on that node while the shadow shows. They are in each world's
section below.

After the crystal ball, every remaining shadow appears at once, so the per-hero cards are skipped and one card
is shown instead (see 2.7).

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

THAT BOWSER WAS A FAKE!
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

**Partner: the old man in the cave** (proposal). He stands between two fires in 2-1's pipe room (`2-1-bonus`, the
pipe at column 103), the nearest thing SMB has to a Zelda cave. That room comes **after** 2-1's vine (column 83),
so on a first run his hint is for the trip back, which is when Toad's "missed him" line sends players. The other
choice is the far end of the coin heaven (`2-1-sky`), right before the hidden vine block, where he would help at
once (see the open questions).

```text
OLD MAN:

IT'S DANGEROUS TO GO
ALONE! TAKE THIS.
```

_(A single coin pops out over him.)_

```text
OLD MAN:

THE SILENT ONE WAITS
WHERE THE COINS IN THE SKY
RUN OUT. GO ON ANYWAY.
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

**Partner: Dr. Light** (proposal). He stands in 3-1's pipe room (`3-1-bonus`, the pipe at column 38), which
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

A HERO CAME KNOCKING HERE,
ASKING FOR THE PRINCESS.
WE SAID NOTHING!
```

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

**Partner: a Chozo statue** (proposal). A small seated Chozo statue (the `zebes` sheet's) in 4-1's pipe room
(`4-1-bonus`, the pipe at column 132), the level **before** 4-2. Statues don't talk, so its card has no speaker
name; its prompt could read `READ`.

```text
AN OLD BIRD STATUE. ITS
EYES GLOW. WORDS ARE CUT
INTO ITS BASE:
```

```text
THE HUNTER SLEEPS BELOW
THE VINES, WHERE THE OLD
PIPES NO LONGER WARP.
```

**Samus's lines:** keep (the parasite, the countdown).

#### 4-2: Larry Koopa (new lines)

The old story had Larry steal the wand; now the king stole it from him. Larry still fights with a wand (his
sprite holds one, and he fires rings), so this script makes it a cheap spare, and gives him a reason to fight:
the king promised his wand back once the princess is caught.

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

**Partner: a Simon's Quest townsperson** (proposal). A robed villager who wandered in looking for Simon, on the
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

WE HEARD THE KING YELLING
FROM THE TREETOPS: FIND
HER! FIND HER NOW!
```

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

**Partner: Irene Lew** (proposal). On the ground at the start of 6-2, before the first pipe (column 19), which is
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
THE DOOR.
```

**Ryu's lines:** keep (the Masked Ninja's curse). The Masked Ninja stays an original villain.

**Castle 6-4:**

```text
THANK YOU <HERO>!

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

**Partner: Lance** (proposal). In the jungle at the start of 7-3 (in its Contra look), well before the marked
bridge at column 128.

```text
LANCE:

SEEN MY PARTNER? WE CAME
TO STOP AN ALIEN. NOW HE
WORKS FOR IT.
```

```text
LANCE:

LAST I SAW, A BRIDGE BLEW
UP UNDER HIM. HE DIDN'T
RUN. HE NEVER RUNS.
```

**Bill's lines:** keep (Red Falcon, `KING KOOPA'S SPELL LET THE ALIEN TAKE MY MIND`), and the Jungle Assault
briefing (`RED FALCON'S ALIENS HAVE TAKEN BILL'S MIND...`) stays.

**Castle 7-4:**

```text
THANK YOU <HERO>!

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

**Who stands at the end:** Peach can't be there any more (she's hiding). Proposed: in the campaign only, the
`princess` at `8-4-end` column 57 is swapped for our Toad, who came to cheer. Outside the campaign 8-4 keeps the
princess and the classic text.

**Castle 8-4**: REPLACES the `YOUR QUEST IS OVER.` push in `World.updateBossClear` (campaign only).

Old: _THANK YOU MARIO! / YOUR QUEST IS OVER._

```text
THANK YOU <HERO>!

BOWSER FELL... AND THE
WAND BROKE! ITS PIECES
FELL THROUGH A CRACK IN
THE WORLD!
```

**The credits** roll over it as now (`CreditsScene`). Proposed: in the campaign, the last credits page at 8-4
gets one more line block after `THANKS FOR PLAYING / SUPER MARIO BROS. CROSSOVER`:

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
WOULD EVER LOOK. <HERO>!
THAT'S WHERE SHE IS!
```

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

**A hero joins**: NEW card on the map. **WHEN:** the first time the map shows after a hero is freed. The generic
card plays for any hero without a specific one; the specific ones are short so they can all be kept or cut.

Generic:

```text
TOAD:

ANOTHER HERO SET FREE!
THAT'S ONE LESS PAIR OF
EYES HUNTING THE PRINCESS.
```

Specific:

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

**Lost worlds 2-D: Toad's world entries** (one card each, first arrival; kept light). Lost 2 and 4 carry the
clues that Peach is near (she grows turnips and throws them, as in SMB2); Lost 3 brings in the Koopalings. The
Lost 4 card assumes Option A for Peach (below); with Option B, move its clue to Lost 2.

Lost 2, Twilight Vale:

```text
TOAD:

SOMEONE PULLED UP TURNIPS
ALL OVER THIS VALE. WHO
EATS THAT MANY TURNIPS?
```

Lost 3, Frost Fields:

```text
TOAD:

AIRSHIPS OVERHEAD! THE
KOOPALINGS ARE HUNTING
FOR THE PIECES TOO.
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

BOWSER'S BACK! AND HE'S
TAPED HALF THE WAND BACK
TOGETHER. GROSS.
```

Lost 9, Farewell Sea:

```text
TOAD:

HE FLED OVER THE SEA WITH
THE LAST PIECE. I CAN'T
SWIM, SO... YOU FIRST.
```

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
CASTLE!` too today (`World.updateBossClear`), so they get lines of their own:

Lost 1-4:

```text
THANK YOU <HERO>!

A KOOPALING GRABBED A
PIECE OF THE WAND AND
FLEW OFF IN AN AIRSHIP!
```

Lost 2-4:

```text
THANK YOU <HERO>!

SOMEONE LEFT US A BASKET
OF TURNIPS. THE NOTE SAYS:
EAT YOUR GREENS. - P
```

Lost 3-4:

```text
THANK YOU <HERO>!

THE KOOPALINGS ARE ALL
OVER THE KINGDOM. EACH
ONE WANTS A PIECE.
```

Lost 4-4 (until Peach is built; with Option A her discovery scene replaces it):

```text
THANK YOU <HERO>!

A VERY TALL TOAD WAS JUST
HERE. SHE SAID TO TELL
YOU: SEE YOU SOON!
```

Lost 5-4:

```text
THANK YOU <HERO>!

THE KING IS GATHERING THE
PIECES. HE WANTS HIS
WAND BACK. WELL, LARRY'S.
```

Lost 6-4:

```text
THANK YOU <HERO>!

THE FAKE KINGS KEEP
GETTING BETTER. THAT ONE
EVEN HAD THE EYEBROWS.
```

Lost 7-4:

```text
THANK YOU <HERO>!

THE KING WENT TO HIS DARK
CITADEL, WITH EVERY PIECE
HE COULD CARRY.
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

**Lost 8-4 ending**: REPLACES the Lost 8-4 card in `Game.showLostEnding` (campaign only; outside the campaign
the NES card and tally stay).

Old: _THANK YOU <HERO>! / YOUR QUEST IS OVER. / WE PRESENT YOU A NEW QUEST. / PUSH BUTTON B / TO SELECT A
WORLD_ (the NES wording, chosen by the owner on 2026-10-06; see the open questions).

```text
THANK YOU <HERO>!

BOWSER FLED OVER THE
FAREWELL SEA WITH THE
WAND'S STAR TIP!
```

**Lost 9-4 ending**: REPLACES the `THANK YOU!` card (campaign only).

```text
THANK YOU <HERO>!

THE SEA IS CROSSED. PAST
IT LIE THE FAR LANDS,
WHERE NO MAP GOES.
```

### 2.16 Peach (for a later release)

These scenes are **for the release that makes Peach playable**, not 0.4.13. Until then, the clues in 2.15 point
at her and the Lost 4-4 castle line above stands in.

**Where she is found**, two options:

- **Option A (proposed): Lost 4-4, Toadstool Grove.** The Toad at the end of the castle is Peach in a Toad cap,
  hiding among the Toads. It is the fourth of thirteen Lost worlds: early, after the player has learned the Lost
  Kingdom, and the page's own name sets it up. Clues on Lost 2 (turnips) and Lost 4 (a very tall Toad).
- **Option B: Lost 2-4, Twilight Vale.** The same scene one world after entering the Lost Kingdom, for an earlier
  partner. The turnip clue then sits on the Lost 1 entry card, and the tall-Toad clue moves to the Lost 2 card.

**Her discovery scene** (castle end, NEW): the castle's thanks as usual, then the "Toad" pulls off its cap, and
the cards play in the box over the room.

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

### 2.17 The final ending: Lost D-4

**The castle card**: REPLACES the D-4 card in `Game.showLostEnding` (campaign only). The credits then roll over
it as now. Two versions, by whether Peach is in the game yet.

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

**Toad's epilogue** (World D map, after the credits): NEW cards.

```text
TOAD:

LARRY GOT HIS WAND BACK,
AND A LOCK FOR IT. THE
KING HAS TO SAY SORRY TO
EVERY HERO. IN PERSON.
```

```text
TOAD:

THE HEROES CAN GO HOME
ANY TIME... BUT NOBODY
IS PACKING. I THINK THEY
LIKE IT HERE.
```

Until Peach is in the game, this card goes between those two:

```text
TOAD:

AND A VERY TALL TOAD SENT
WORD: THANK YOU. SHE'LL
COME HOME SOON.
```

The last card:

```text
TOAD:

THANK YOU, <HERO>. FOR
EVERYTHING. NOW... WHO
WANTS CAKE?
```

## 3. Open questions for the owner

1. **Which Lost world for Peach?** Option A, Lost 4-4 (Toadstool Grove, disguised as a Toad), or Option B, Lost
   2-4 (earlier). Or somewhere other than a castle's end, such as a hidden room like the heroes'?
2. **Partners before or after their hero?** Dr. Light, the Chozo statue, the townsperson, Irene and Lance stand
   before the way in. The old man's pipe room in 2-1 comes after the vine; move him to the end of the coin heaven
   so he helps at once, or keep the cave and let him help on the way back?
3. **How direct should partners be?** They are a step clearer than Toad (Dr. Light says "bump the air", Irene
   names the first pipe). Keep, or make them as vague as Toad?
4. **Who stands at the end of 8-4** in the campaign: our Toad (proposed), nobody (just the rift), or the princess
   sprite kept with new words?
5. **The Lost 8-4 card**: replace the NES wording you chose on 2026-10-06 (proposed, campaign only), or keep the
   NES card as a homage and put the story line in a Toad card after it?
6. **The 8-4 credits**: roll them at 8-4 as now (with `...BUT THE STORY ISN'T OVER.`), or save the credits for
   Lost D-4 only?
7. **The wand's pieces and the Koopalings**: should each Koopaling airship (idea 1) hold one piece of the wand,
   and Bowser the star tip? The script only hints at it, so it works whether or not the airships are built. How
   many pieces?
8. **Freed heroes and the wand**: should freeing heroes be what cracks the wand (it would make freeing matter to
   the story), or only overuse, as the script says now so it holds when a player frees nobody?
9. **Tone**: a few lines are jokes on the heroes' own games (the old man's door repair charge, the Simon's Quest
   riddles, Jason's frog, Bowser's eyebrows, cake). Keep them all, or tone some down?
10. **Toad's map box**: at the top of the map (proposed) or the bottom, and should Toad's sprite walk in for each
    line or only for big moments (the rift, the Lost Kingdom)?
11. **The missed-hero hint line**: replace `SOMEONE IS HIDING IN THIS LEVEL` with Toad's per-hero lines
    (proposed), or keep the plain line and only add the one-time card?
12. **Larry's spare wand**: is "the king took my wand, I got a spare" the right fix for Larry still using a wand,
    or should his rings come from something else (an SMB3-style scepter he stole back)?
