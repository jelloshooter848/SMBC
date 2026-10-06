# 1-2 intro: Mario does not walk into the pipe on his own, and the timer runs during the intro

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9 (rechecked against main 2225155 after PR #24)
- **Where:** 1-2-intro (the outdoor scene with the small castle and the sideways pipe at column 10, reached from the 1-2 node on the World 1 map in campaign mode, or from the 1-1 flagpole in `?level=` and Dev mode runs). Also seen in 2-2-intro, 7-2-intro, ll-3-2-intro, ll-5-2-intro, ll-6-2-intro, ll-10-2-intro and ll-11-2-intro; 4-2-intro has the same map settings
- **How to get there:** campaign: from a save file with 1-1 cleared, pick 1-2 on the World 1 map. Without a save file: `?level=1-2-intro&char=mario`, or finish 1-1 in a `?level=1-1&char=mario` or Dev mode run
- **Character and power:** Mario, small
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Campaign: Start game, pick a file whose World 1 map has 1-1 cleared, walk to 1-2 and press Jump, then pick Mario on character select. (`?level=1-1` or Dev mode: finish 1-1 at the flagpole and let the castle walk and score tally finish.)
2. After the WORLD 1-2 card, the intro scene opens. Do not press anything.
3. Wait 7 seconds and watch Mario and the TIME counter.
4. Hold right: Mario walks to column 10 and enters the pipe.

## Expected

The intro is a cutscene. Mario walks right by himself from the castle door and enters the sideways pipe, and the TIME counter is blank and stopped until the underground starts. In the original, area `a` of 1-2 has `TYPE="intro"` with a `gameStateWatch` object (levelDataSmb.xml, `<LEVEL ID="1-2">`, area a). Playtested: with no input, Mario walks from the door to the pipe, TIME is blank during the scene, and the underground then starts at 400.

## Actual

Mario stands still at column 2 in front of the castle until the player holds right. The timer counts down from the start of the scene: 398, 394, 386 over about 7 s with no input. The seconds used in the intro are carried into the underground, which started at 381 in my run instead of 400.

On main 2225155 (by reading the code, not playtested) this is the same in both modes; only the way into the intro changed:

- **Campaign (save file and map):** a level clear returns to the map, and picking 1-2 there calls `Game.enterLevelFromMap`, which loads `entryLevel('1-2')` = `1-2-intro` (`src/game/map/rules.ts` lines 188-195) with `goToLevel(…, { mode: 'stand' })` (`src/game/scenes/game.ts` line 175). The explicit `'stand'` still overrides `startMode: autowalk` in `1-2-intro.map`. `returnToMap` sets `state.time = null` (game.ts line 226), so the intro's `time: inherit` starts the clock at 400 and it runs and carries into the underground as before.
- **`?level=` and Dev mode:** unchanged. A flagpole still calls `game.goToLevel(ev.next, { mode: 'stand' })` (`src/game/scenes/level.ts` line 120), and `?level=` and the level select still start with `mode: 'stand'`.
- The Lost Levels intros listed under Where have no map pages on main, so they are reached only through `?level=` and Dev mode.

## How often

every time (3 of 3 tries: twice through the 1-1 flagpole, once with `?level=1-2-intro`)

## Notes

- PR #24 check: still applies on main 2225155, in campaign mode and in `?level=`/Dev mode; Steps and Actual updated for the campaign route. Original b8379f9 route (no map then): finishing 1-1 went straight to the WORLD 1-2 card and the intro through `game.goToLevel(ev.next, { mode: 'stand' })` (`level.ts:115` at b8379f9), and How to get there read "finish 1-1 normally (or `?level=1-2-intro&char=mario`)".
- Playtested in both games. Original screenshots (reviewer only): `orig/keep/017_12intro_c.png`, `orig/keep/018_12intro_d.png` (walking, TIME blank) and `orig/keep/019_12u_a.png` (underground start).
- Likely cause of the standing start, from our source: `1-2-intro.map` sets `startMode: autowalk`, but the flagpole exit calls `game.goToLevel(ev.next, { mode: 'stand' })` (`src/game/scenes/level.ts:115`), and `World` uses `start.mode ?? level.startMode` (`src/game/world/world.ts:163`), so the explicit `'stand'` overrides `autowalk`. The level select and the `?level=` URL also start levels with `mode: 'stand'`.
- Likely cause of the timer: `1-2-intro.map` has `time: inherit`, so the intro runs the level clock, and the intro pipe carries the remaining time into 1-2 because both have world 1, stage 2 (`carryTime`, `src/game/scenes/level.ts:17-20` and `104-105`).
- Same in the other intros (folded in during the smb-w7/w8 consolidation). All four intro maps (`1-2-intro`, `2-2-intro`, `4-2-intro`, `7-2-intro`) have `time: inherit` and `startMode: autowalk`:
  - 2-2-intro (smb-w2): Mario stands at column 2, does not walk into the pipe, and TIME counts down (390, then 383). Ours: `gauntlet/shots/smb-w2/ours/314_go-2-2-intro.png`, `315_intro2.png`, `316_intro3.png`. The original's 2-2 intro auto-walks with TIME blank: `gauntlet/shots/smb-w2/orig/076_l22c.png`, `077_l22d.png` (reviewer only). Caveat: ours was loaded straight from `?level=2-2-intro`, not through the 2-1 flagpole. Source: `review/smb-w2.md`.
  - 7-2-intro (smb-w7): reached after the 7-1 flagpole. Mario stands at column 2 while TIME goes 399, 395, 390 over 210 frames (`gauntlet/shots/smb-w7/ours/216_i72.png` to `221_i72.png`; the reviewer checked 216, 218 and 221). The original auto-walks with TIME blank and starts the water area at 400 (`gauntlet/shots/smb-w7/orig/067_i.png` to `075_w.png`, reviewer only). Source: `gauntlet/notes/smb-w7.md`.
- Lost Levels intros (folded in by the ll-w3 to ll-w5 review). `ll-3-2-intro.map` and `ll-5-2-intro.map` also have `time: inherit` and `startMode: autowalk`:
  - ll-5-2-intro (ll-w5): playtested in both games. The original's intro hides TIME and Mario walks into the pipe on his own, and the main area starts at 400 (`gauntlet/notes/llw5/o4.png`, frames 1-5; reviewer checked; original, reviewer only). In ours the timer runs during the intro and carries over: 372 on arrival in the main area. Source: `gauntlet/notes/ll-w5.md`.
  - ll-3-2-intro (ll-w3): ours only. Mario does not walk into the pipe and TIME goes 399 to 393 in about 5 s. In a real run the intro comes after the ll-3-1 flagpole (`ll-3-1.map` line 50, `exit 186 next=ll-3-2-intro`). Source: `gauntlet/notes/ll-w3.md`.
- More Lost Levels intros (folded in by the ll-w6/w9/wB review). `ll-6-2-intro.map`, `ll-10-2-intro.map` and `ll-11-2-intro.map` also have `time: inherit` and `startMode: autowalk`:
  - ll-6-2-intro (ll-w6): ours only. Mario does not auto-walk and the timer runs. Source: `gauntlet/notes/ll-w6.md`.
  - ll-10-2-intro (ll-wA): ours only. No auto-walk and the timer runs, even though the map says `startMode: autowalk`. Source: `gauntlet/notes/ll-wA.md`.
  - ll-11-2-intro (ll-wB): playtested in both. The original auto-walks Mario into the side pipe with TIME blank (`gauntlet/shots/ll-wB/orig/023_b2start.png`, reviewer only). Ours doesn't auto-walk and the timer runs. Source: `gauntlet/notes/ll-wB.md`.
- Both parts need fixing for the intro to behave like the original's cutscene; they are filed together because they are one scene.
- Screenshot: not committed (the repo's `check:assets` bans image files) (Mario still at the castle door after about 6 s, TIME 386).
- Reviewed: verified against `levelDataSmb.xml` (`<LEVEL ID="1-2">` area `a` `TYPE="intro"`), the original screenshots above (TIME blank in the intro, 396 shortly after the underground starts), and ours: `src/content/levels/world1/1-2-intro.map`, `src/game/scenes/level.ts`, `src/game/world/world.ts`.
