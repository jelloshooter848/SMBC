# Lost Levels progression departs from the NES rules: worlds A-D are flagged as unlocked after one 8-4 clear instead of 8 games beaten, nothing reads the flag, and the endings show SMB's "princess is safe" card

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** the end of ll-8-4 (`ll-8-4-end3`: axe at column 125, princess at column 137, exit marker at column 136); the end of ll-9-4 (exit marker at column 113); the end of ll-13-4 (`ll-13-4-end`, exit marker at column 120); the saved progress (`smbc.progress`)
- **How to get there:** `?level=ll-8-4-end3&char=mario&dev=1`, turn on Dev mode > Assists > No damage and Inf. lives, then run to the axe
- **Character and power:** Mario, small (Dev assists: infinite lives and No damage, used to get past the fake Bowser, the lava and Bowser)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Open `?level=ll-8-4-end3&char=mario&dev=1` and turn on No damage and Inf. lives.
2. Cross the lava at columns 64-78, jump over Bowser and touch the axe at column 125.
3. Let Mario walk to the princess. Read the text in the room and on the next screen, then press Enter.
4. Look at the saved progress: `localStorage['smbc.progress']` now has `lost.letters: true` after this single clear.

## Expected

The project owner has decided that Lost Levels progression follows the NES (Famicom Disk System) rules:

1. **World 9:** after 8-4, a run that used no warp zone goes on to 9-1. A run that used a warp zone ends after 8-4.
2. **End of World 9:** finishing World 9 ends the game.
3. **Worlds A-D:** they unlock after the game has been beaten 8 times. The player picks them from the title screen. They run A → B → C → D, and D-4 ends the game.

At the end of 8-4, the princess thanks Mario in the room and the game says that the quest is over. In a warpless run, it then goes on to World 9. The owner should confirm the exact NES wording (see Notes).

## Actual

**World 9's entry and ending already match the NES rules.** Checked in `src` (b8379f9):

- **A warpless 8-4 goes to 9-1.** `Game.showEnding('ll-8-4')` (`src/game/scenes/game.ts` lines 65-99) sets `next = 'll-9-1-start'` when `state.warped` is false. The ll-w8 tester played this branch to the WORLD 9-1 card.
- **A warped 8-4 ends the game.** With `state.warped` true, `next` stays null and Start goes to the title (line 96). This was found by reading the code. `warped` is set by any pipe into another world or stage (`src/game/scenes/level.ts` line 103). The Lost Levels maps have 12 such pipes, and every one is a warp-zone or backward-warp pipe: ll-1-2 (3), ll-3-1, ll-3-1-exit, ll-5-1, ll-5-2 (2), ll-8-1-exit, ll-10-2, ll-10-3 and ll-11-4-exit. Nothing else sets the flag. A Continue keeps it (`continueGame`, line 293), and a new game clears it (`newGameState`).
- **World 9 ends the game.** `ll-9-4.map` line 38 is `exit 113 next=end`. After its flagpole, `showEnding('ll-9-4')` shows the ending card and then goes to the title. The ll-w9 and ll-wA testers both played this.
- **A → B → C → D, and D-4 ends the game.** The exits chain from ll-10-1 to ll-13-4, and `ll-13-4-end.map` line 46 is `exit 120 next=end`. The ll-wA tester played A-1 → A-2 intro → A-3 → A-4 → B-1, and the HUD and intro card read "WORLD A-1" and so on.
- **8-4 has the princess.** `ll-8-4-end3.map` line 40 has `princess 137 12`, as on the NES.

These are the departures:

1. **The A-D unlock is set after one ll-8-4 clear, not after 8 games beaten.** `showEnding` sets `progress.lost.letters = true` the first time ll-8-4 is cleared, with or without a warp (game.ts line 71), and saves it. There is no counter of games beaten: `Progress` has only `bestScore`, `lastCharacter`, `reached`, `cleared` and `lost: { world9, letters }` (`src/engine/save/progress.ts` lines 3-13). Finishing World 9 or D-4 records nothing.
2. **Nothing reads the unlock flags.** `grep -rn "\.letters\|\.world9" src` finds only the writer in `showEnding` and the loader in `progress.ts` (lines 17-28). So even with a title entry, nothing would know that A-D had been unlocked.
3. **The text after 8-4 is the same in both branches, and it is SMB's ending card.** In the room, only "THANK YOU MARIO!" appears. The second line is skipped when `next === 'end'` (`src/game/world/world.ts` lines 1436-1440), and the room is left 1.5 s later. Then a black card shows "THANK YOU MARIO! / THE PRINCESS IS SAFE / AND THE KINGDOM IS FREE. / FINAL SCORE 0005000 / PRESS START" (game.ts lines 83-98). After Start, a warpless run goes to the WORLD 9-1 card, and a warped run goes to the title. Nothing says that the quest is over, that World 9 comes next, or why a warped run ended.
4. **The same card follows World 9 and D-4.** ll-9-4 ends at a flagpole with no princess in the level, but it shows the same "THE PRINCESS IS SAFE" card and then the title. ll-13-4 shows the same card as well.

Screenshot: not committed (the repo's `check:assets` bans image files) (our ending card after ll-8-4).

## How often

every time

## Notes

- PR #24 check: still applies on main 2225155 (`?level=` and Dev mode; the Lost Levels have no map pages, so there is no campaign path to them on main). `showEnding`'s Lost Levels branch is unchanged (`src/game/scenes/game.ts` lines 104-114 on main); its new campaign branch never runs in a Lost Levels level.
- **Owner decision (2026-10-05):** progression follows the NES (Famicom Disk System) rules, not the original Crossover. The Crossover goes straight through every time:
  - 8-4 shows Toad (a `toad` token in `levelDataLostLevels.xml`, `<LEVEL ID="8-4">` line 399; `peach` is only in 13-4) and "But our princess is in another castle!". `ScreenManager.as` line 399 compares the world with `worldCount`, which `LevelData.as` lines 72-80 set to the highest world in the XML, 13.
  - `Level.completeLevel()` (lines 3476-3490) always loads world + 1, level 1, so the order is 8-4 → 9-1 → … → 9-4 → 10-1 → … → 13-4. The ll-wA tester watched the original go from the 9-4 flag straight to the WORLD A-1 card.
  - There is no warp tracking: `StatManager.warpPipeHandler` only sets `_allowCharacterRevival`.
  - The Crossover shows "Your quest is over." and the credits only after D-4 (13-4).
- **Rewritten by the reviewer.** The ll-w8 report filed the Crossover flow as the expected behaviour. After the owner's decision, that flow is context only. The parts of ours that the report called wrong are correct under the NES rules: the princess at 8-4, the ending after a warped 8-4, World 9 only without a warp, and the ending at 9-4.
- **Title screen access is known and planned after PR #25.** The title has no Lost Levels entry yet; `ll-*` levels are reached by `?level=` or the Dev mode level select. That is not part of this report. PR #24 (the world map) gives map pages to SMB worlds 1-8 only, so the Lost Levels stay outside it. Once an entry point exists, it needs items 1 and 2 above to offer A-D.
- **NES details the owner may want to check (not verified).** The pages could not be fetched: the egress proxy blocks mariowiki.com, strategywiki.org and tasvideos.org. Search-result summaries of Super Mario Wiki say:
  - The backward warps (3-1 → 1-1, 8-1 → 5-1) also count as warps for World 9. Ours counts them, so ours is probably right (the ll-w9 tester believes the same).
  - World 9 starts with one life.
  - On the Famicom Disk System, a Game Over in World 9 offers no continue and shows a "super player" message instead. Ours offers CONTINUE and restarts at ll-9-1 (`continueGame`, `firstLevelOfWorld`), as the ll-w9 tester noted.
  - **On the original FDS release, clearing 9-4 goes back to 9-1, and World 9 loops until a Game Over.** That does not match the owner's rule "finishing World 9 ends the game", so the owner should confirm which one they mean. Ours ends the game after 9-4.
- **NES text.** The exact NES wording after 8-4, World 9 and D-4 was not checked against a ROM or any source in this workspace. If the owner wants matching text, they should supply it. The fix for items 3 and 4 needs it.
- `world9` is saved too, but under the NES rules World 9 follows 8-4 directly, so it needs no reader unless the owner wants World 9 replayable from the title.
- The 5000 points on the card come from the axe: `2026-10-05-bowser-axe-awards-5000-points.md`. The SMB 8-4 ending (no "Your quest is over." and no credits) is `2026-10-05-8-4-ending-no-quest-over-or-credits.md`.
- Evidence:
  - Ours playtested: the warpless ll-8-4 branch (ll-w8), and the ll-9-4 ending and the title after it (ll-w9, `gauntlet/shots/ll-w9/ours/061_b9.png`; ll-wA), and the D-4 ending: axe, princess, "THANK YOU MARIO!", the same card, then the title (ll-wD, `gauntlet/notes/llwD/m6.png`).
  - Ours by reading the code: the warped branch, the unlock flags and the A-D chain.
  - The original: by reading its code and data, and the ll-wA tester's play from 9-4 to A-1.
- Sources:
  - `ll-w8/2026-10-05-ll-8-4-runs-game-ending-instead-of-another-castle.md` (rewritten).
  - `ll-wA/2026-10-05-ll-10-1-worlds-a-d-unreachable.md` (merged: the unlock-flag evidence, the single-clear unlock and the A-D flow; its title-screen part is the known item above, and its "blocks progress" severity is not used).
  - The ll-w9 tester's progression notes (`gauntlet/notes/ll-w9.md`, "Progression").
- Reviewed: verified against `com/smbc/level/LevelData.as` (`_worldCount`), `com/smbc/level/Level.as` (`completeLevel`), `com/smbc/managers/ScreenManager.as` (castle text), `com/smbc/managers/EventManager.as` and `StatManager.as` (`levelTransfer`, `warpPipeHandler`), `levelDataLostLevels.xml`, and ours: `src/game/scenes/game.ts` (`showEnding`, `continueGame`, `firstLevelOfWorld`), `src/game/scenes/level.ts`, `src/game/world/world.ts`, `src/engine/save/progress.ts`, every `pipe` line in `src/content/levels/lost/`, and the exits of worlds 8-13.

Status: partly fixed — progress now counts Lost Levels games beaten (each ll-8-4 clear) and opens A-D only at 8 (`lostLettersOpen`), and 8-4/9-4/D-4 show their own cards instead of "THE PRINCESS IS SAFE" (warpless 8-4: World 9 next; warped: why World 9 stays shut); left: a title-screen Lost Levels entry to read the flags (planned after PR #25) and the exact NES wording, which the owner still has to supply (the card text is ours). A 0.2.1 progress file that already had `letters: true` and no count starts at 8 games beaten, so players keep that unlock; new files still need 8 clears.

Status (follow-up): card wording from the owner, D-4 rolls credits — 3607fe0
