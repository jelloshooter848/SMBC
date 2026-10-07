# Story system (0.4.13)

How the Chapter 1 story (docs/STORY.md, 1-0 to 8-4 and the hand-off to Lost World 1) is wired
into the game. docs/STORY.md is the script and the decisions; this file is the code. Every line
of text lives in `src/game/story/script.ts` (checked by `script.test.ts`: box widths, font
characters); nothing else types story text. `script-doc.test.ts` reads docs/STORY.md's text blocks
for the shipped sections (2.1-2.14) and checks them against script.ts both ways, so the script
and the doc cannot drift apart (edit both together).

Every story box is announced the same way, by `pageSaid` (story/cards.ts): the page's lines, then
"OK for more, BACK to skip." (or "OK to continue." on the last page). Story cards, Toad's map box
1-0's greeting (campaign) and 1-0's shadow tease all use it.

## Files

| File                                    | What                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `src/game/story/script.ts`              | All the text: pages, castle pages, partners, Toad's map lines               |
| `src/game/story/beats.ts`               | `storyOn`, the beat ids (`beat.*`), `seedSeen`                              |
| `src/game/story/cards.ts`               | `playStoryCards`: pages in the story box over a frozen level or the map     |
| `src/game/story/level-beats.ts`         | Scenes inside a level: restyle remarks, Larry, Bowser in 8-4's bridge room  |
| `src/game/story/partners.ts`            | Talking to a partner (`talkToPartner`), its announcement                    |
| `src/game/map/toad-guide.ts`            | Which of Toad's map scenes are due (`dueScenes`), and his box (`ToadGuide`) |
| `src/game/entities/objects/partner.ts`  | The partner entity                                                          |
| `src/game/world/world.ts`               | Castle pages (`updateBossClear`), partner spawns, `storyMode`               |
| `src/game/entities/enemies/bowser.ts`   | The fake Bowser's disguise, tell and unmasking                              |
| `src/game/level/campaign.ts`            | `toadAt84`: Toad in place of the princess at the end of 8-4                 |
| `src/game/scenes/credits.ts`, `game.ts` | The false ending's credits line (`creditsLines`, `showEnding`)              |

## Campaign only: `storyOn`

`storyOn(game)` (beats.ts) is true only while a save file is played (`game.campaign`) and not in an
arena / Dev → Mini games round (`inRound`, `stageRound`) or an editor play-test (`playtestDone`).
Classic play, dev select, `?level=` and shared levels keep the old text and behaviour exactly
(tests check both sides). Inside a level the same answer is `World.storyMode`, set by `LevelScene`
from `storyOn`. Every story hook checks one of the two first.

## Beats and the save file

A **beat** is a story scene that plays once per file. Its id (a plain string, `beat.enter('smb-3')`
→ `'enter:smb-3'`; the list is at the top of beats.ts) goes into `Game.story` when it plays:
`game.seen(id)` asks, `game.markSeen(id)` adds it once and writes it to the file. Ids are saved, so
never rename one.

- **Only the list is written.** `markSeen` updates the stored campaign file's `story` field and
  writes that, nothing else: a beat seen mid-level (a partner, a restyle remark, Bowser in 8-4)
  never turns the run's power, coins or score into a new save point. The next full `autosave`
  (a level's end, the map) saves the rest as before.
- **Developer "Unlock all"** (`game.mapUnlockAll`): story scenes may play, but `markSeen` never
  records anything on the file, for map and level beats alike (Toad's map scenes included). The
  ids played meanwhile are kept aside in memory, so a scene does not repeat while Unlock all
  stays on; once it is off, each beat plays for real and is saved.

The list is saved as `SaveFile.story?: string[]`: optional, no format bump, no migration (a patch
change by docs/RELEASING.md). A file without it (from before 0.4.13, or a test's file) is seeded on
load (`Game.openFile`) by `seedSeen(progress, freed)`: every beat whose trigger already holds
counts as seen (open worlds' entries, `fakes` once 1-4 is cleared, joined cards for freed heroes,
shown silhouettes, the crash with the crystal ball, the rift once 8-4 is beaten, ...), so an old
file is not flooded with cards about the past. A malformed list is dropped and seeded the same way.

## Toad on the map (`map/toad-guide.ts`)

When a map page shows (the map opens, a slide or fade ends, the airship crash cutscene ends),
`WorldMapScene.startStory` asks `dueScenes` for Toad's scenes due there, and plays them in the
`story` mode **before** the page's reveal draws in; the reveal (or idle and the autosave) follows.
Not on pages shown only through dev "Unlock all", and none on the Lost Kingdom's pages (their
story is a later release).

- **Play order:** the major scene (the airship crash, the 8-4 rift, the fake Bowsers), then heroes
  joined (the generic card once per file, then each hero's own), every hero freed, the world's
  entry on first arrival (World 1's only once 1-0 is cleared), missed heroes (a shadow's first
  showing; after the crystal ball only marked, the crash's card stands in), then the hub / arena
  extras.
- **All heroes freed** (`all-freed`) counts the hidden heroes the game has: a hidden hero whose
  character is not registered (Sophia III, not in every build) is left out, so in a build without
  her it fires once the 7 others are freed. It is a beat like any other: once seen it does not
  play again when Sophia lands later (World 8's entry has its own guard, `ENTRY_NEEDS`, below;
  this card has none).
- **The box:** at the top of the map (`TOAD_BOX_Y` = 28, under the header bar), white-rimmed
  black, the lines centred, the OK prompt after `CARD_GUARD_FRAMES`. OK (jump) or MENU goes on;
  **BACK** (attack) skips the rest of that scene (the next scene still plays). Each page is
  announced; it goes on by itself after a minute.
- **Toad walks in** (his `smb3:toad-map-0/1` frames, 2 px a frame from off the left edge to 20 px
  left of the hero) only for the major scenes: the World 1 entry after 1-0, the fake Bowsers
  (after 1-4), the crash and the rift. He stays until the last scene and walks back off; that
  walk-off plays over the map once it is already the player's (the reveal draws in, the hero can
  move: `ToadGuide.leaving`), so nobody waits for him to leave.
- Every scene's beat ids are marked seen as it starts, so leaving mid-scene never replays it.
- **World 8's guard:** pages 2-3 of World 8's entry are about Sophia III, who is not in every
  build. `ENTRY_NEEDS` keeps them back until her character is registered; they then play once as a
  beat of their own (`enter:smb-8:sophia`), while the rest of the entry plays as usual.
- Missed heroes also get a hint line while the hero stands by their shadow (`missedHint`).
  When the map opens on that node with the hero's missed card due, the page's line (which says
  the hint) waits until Toad's scenes are over, so his card is announced first.

## Scenes inside a level (`story/level-beats.ts`)

`playLevelBeat` runs before the world moves, once the players stand free (not in a pipe), and
plays over the frozen level with `playStoryCards` (top box; OK next, BACK skips the rest):
Toad's restyle remark on a restyled level's first start (`restyle:<id>`, only while its campaign
look is on), Larry in `4-2-larry` (every run, not on TRY AGAIN), and Bowser's "no more stand-ins"
on first entering `8-4-end` (`bowser-8-4`, in the prompt box with his laugh). When the scene
closes, play goes on with `LevelScene.resumePlay`: the music is never stopped or restarted (only
the closing press is kept from making the hero jump). `resume` (music back on) is for the captive
flow, whose mini game changes the music. Under `storyOn`, 1-0's greeting plays
`STORY_TOAD_PAGES` with `playStoryCards` (then `resumePlay`) and the shadow tease swaps in
`STORY_TEASE_PAGES`; outside the campaign the greeting keeps `TOAD_PAGES`, its own keys and
words, and `resume`.

## Partners

A partner is someone from a hero's own game who says how to find that hero
(`partner x y who=<id> campaign=true` in a map's `[entities]`, optional `dx=` px further right).
They spawn only while the story plays (`World.storyMode`); `campaign=true` also keeps them asleep
outside the campaign. Scenery like a captive: no collision, never despawn. A player on the ground
within `TALK_REACH_PX` on the same floor sees TALK (the statue: READ) with an up arrow, announced
once on arrival; up talks (`partner` event → `talkToPartner`), and the pages can be read again any
time. Any player can talk (in co-op, player 2 too); the pages close back into play with
`resumePlay`, the music untouched.

| `who`         | Level and spot           | For        |
| ------------- | ------------------------ | ---------- |
| `old-man`     | 2-1 (8, 12), `dx=8`      | Link       |
| `dr-light`    | 3-1's bonus room (4, 12) | Mega       |
| `chozo`       | 4-1's bonus room (2, 12) | Samus      |
| `townsperson` | 5-4 (10, 9)              | Simon      |
| `irene`       | 6-2 (7, 12)              | Ryu        |
| `lance`       | 7-3 (5, 12)              | Bill       |
| `jason`       | 8-4-jason (5, 12)        | Sophia III |

The old man gives one coin after his first page (`coinAfter`, once a visit). The statue's eyes
glow slowly, held dim with reduce flashing. Art: `src/content/sprites/partners.ts` (`<who>-0`,
`<who>-1`), but Jason is drawn from Sophia III's sheet (`jason-stand`, `BORROWED` in
`objects/partner.ts`), facing the heroes and now and then looking round at the pool. A partner
talked to is marked (`Partner.talked`): talking to Jason sends his frog Fred into the pool, the way
on to Sophia III (`objects/fred.ts`, docs/HEROES.md).

## Castle pages (`World.updateBossClear`)

In the campaign every SMB castle (looked up by `level.parent ?? level.id`, so `8-4-end` counts as
8-4) shows `CASTLE_PAGES[id]` in place of the NES text: THANK YOU <HERO>! at 0.5 s as before, then
**page 1** (the reveal of the fake's true form; at 8-4 that the king was real) at 2 s and **page 2**
(the story news) at 4 s, each replacing the last under the thanks and each announced; the exit
follows at 7.5 s (450 frames). Castle pages are at most 26 columns. The Lost castles keep their
NES text: their reveal pages (docs/STORY.md 2.15) are Chapter 2, though their fakes already
unmask (below).

## The fake Bowsers (`bowser.ts`)

In the campaign the Bowser of castles 1-4 to 7-4 is a fake, and so is the Lost Kingdom's from Lost
1-4 to 7-4 (owner-approved, docs/STORY.md 2.3a): `trueFormOf(world)` (by world number, 1..7:
Goomba, Koopa, Buzzy Beetle, Spiny, Lakitu, Blooper, Hammer Bro; 0 in World 8 and the Lost
Kingdom's later worlds) is his disguise, with the same tell and unmasking as below. The Lost
castles' reveal pages stay Chapter 2. The later Lost fakes (Lost 8, 9, A-4 to C-4, D) have no true
form yet: the new forms in 2.3a's table (Bullet Bill, Cheep Cheep, ...) are not built, so until
then their die frame is the king and they neither tell nor unmask.

- **The tell:** for the last 12 frames of every 240 (4 s) the disguise flickers, the true form's
  dark silhouette (rimmed so it reads on black) showing every other two frames, with a few wand
  sparkles. With **reduce flashing** there is no flicker: a solid 1 px outline of the true form
  (`bowser-ghost-N`) in bright cyan (palette fx `tell`, NES $3C, in no enemy palette) is held
  over him for those same 12 frames (`tellWindow`), steady, never blinking.
- **The unmasking:** however he is beaten, the disguise bursts in a puff of wand sparkles with a
  "poof", and the true form falls in his place (`bowser-die-N`, palette `bowser-true-form` in
  castles).
- Toad's `fakes` scene on the World 1 map after 1-4 explains them.

## 8-4 and the hand-off

- `campaignLevel` (`toadAt84`) swaps 8-4's `princess` for a `toad`: Toad came to cheer, the
  princess is in hiding. The map file and every other play keep the princess.
- 8-4's castle pages say the king was real and the wand broke; the exit is `end`, so the castle
  text heads the credits (`Game.showEnding`), which add "...BUT THE STORY ISN'T OVER." after
  THANKS FOR PLAYING (`creditsLines(true)`, said by the announcer too).
- After the credits the file returns to World 8, where Toad's rift scene (a major scene, due once
  `gameCleared`) plays first and then the road on to Lost World 1 draws in.

## Adding a beat

1. Write its text in `script.ts` (it is then checked by `script.test.ts`).
2. Give it an id in `beat` (beats.ts), add it to the list at the top of the file, and teach
   `seedSeen` when an old file has already passed it.
3. Play it where it belongs: a map scene in `dueScenes` (pick its place in the play order and
   whether Toad walks in), a level scene in `playLevelBeat`, or `playStoryCards` from the hook,
   always behind `storyOn` / `storyMode`, with `game.markSeen(id)` as it starts.
4. Test both sides: it plays once on a campaign file, and classic play is unchanged.

## Adding a partner

1. Add its `PartnerScript` to `PARTNERS` in `script.ts` (verb, the name the announcer says, pages
   of at most 28 columns with the speaker line first, optional `coinAfter`).
2. Draw `<who>-0` and `<who>-1` (blink or glow) in `src/content/sprites/partners.ts` (original art).
3. Place `partner x y who=<who> campaign=true` in the level's `[entities]`, feet on row `y`, with
   room to stand next to it on the same floor.
