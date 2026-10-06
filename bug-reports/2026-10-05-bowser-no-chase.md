# Bowser never chases a player who gets behind him

- **Severity:** wrong behaviour
- **Build:** V0.1.0-B8379F9
- **Where:** every bridge Bowser. Seen in 1-4 and 3-4: the bridge at columns 128-140, Bowser starts at column 136, the axe is at 141. Also seen in 6-4 (hammer Bowser, same bridge columns) and 8-4 (`8-4-end`, Bowser at column 40).
- **How to get there:** `?level=1-4&char=mario&dev=1` (or `?level=3-4&char=mario&dev=1`), turn on the Dev assist No damage, reach the bridge, jump over Bowser and stand at column 139 or 140
- **Character and power:** Mario, small (Dev assist No damage on, so Mario can pass Bowser)
- **Input:** keyboard (scripted through Playwright)
- **Browser and device:** headless Chromium on Linux (cloud container)

## Steps

1. Get past Bowser on the bridge and stand on the bridge at column 139 or 140 without touching the axe.
2. Watch Bowser for 3-5 seconds.

## Expected

In the original, `Bowser.as` `updateStats()` (lines 218-223) does `if (onGround && player.nx > nx && !gotAxe) { vx = RUN_SPEED; scaleX = 1; setState(ST_CHASE); }`, with `RUN_SPEED = 62` px/s, about 0.52 px per frame at our scale. Once the player is to his right and he is on the ground, Bowser turns right and runs at him until his right edge reaches `xMax`, one tile past the bridge's right end, where he stops (`pastXMax`, lines 271-281, sets `vx = 0` outside the normal state). While chasing he neither breathes fire (`fbTmrLsr` and `fbDelTmrLsr` need `cState == ST_NORMAL`) nor jumps (`jumpTmrLsr` needs `ST_NORMAL`). In his normal state he always faces left (`scaleX = -1`, line 229); he only faces right while chasing.

## Actual

Bowser turns to face Mario but keeps pacing his usual short stretch, about columns 133 to 136.6, and keeps breathing fire, now to the right at Mario. In 3 s in 1-4 (frames 239 to 389) he never came closer than about 3 tiles to Mario at column 139; in 3-4, with Mario at column 140, he stayed between columns ~134 and ~137 and breathed a flame to the right at Mario. `src/game/entities/enemies/bowser.ts` `update()` (lines 82-86) only paces around `homeX` and flips `facing` toward the player; it has no chase state.

## How often

every time

## Notes

- Merged from `smb-w1/2026-10-05-bowser-no-chase.md` (1-4) and `smb-w3/2026-10-05-bowser-does-not-chase-and-fires-backwards.md` (3-4). The "fires backwards" part of the second report is in `2026-10-05-bowser-flames-aimed-at-player.md`.
- Ours: playtested in 1-4 and 3-4 (share-link copies that start at column 139 and column 120, same entities and tiles, so the HUD reads WORLD 1-1). Original: code reading only; 1-4 and 3-4 froze on load in Ruffle (`TypeError: Error #1009` in `addedToStage`), so neither tester could watch Bowser there.
- Screenshots: not committed (the repo's `check:assets` bans image files) (1-4, Mario at 139, Bowser near 135, frame 389) and (screenshot not committed: the repo's `check:assets` bans image files) (3-4, flame heading right toward Mario at column 140).
- More sightings in ours (folded in during the smb-w7/w8 consolidation; the original's castles were not played):
  - 6-4 (smb-w6), hammer Bowser: in a share-link copy (HUD reads WORLD 1-1), Mario stands at column 140, behind Bowser. Bowser stays at about columns 135-137 for about 13.6 s (frames 258-1074) and does not chase: `gauntlet/shots/smb-w6/ours/254_ax1.png` to `262_ax9.png` and `263_fl1.png` to `278_fl16.png` (reviewer checked 254, 262, 270 and 278). He also keeps throwing hammers the whole time; the original's `throwHammerTmrHandler` throws only in `ST_NORMAL`, so a chasing Bowser throws none (see `2026-10-05-bowser-hammers-in-volleys.md`). The tester also said Bowser once walked off the left edge behind Mario; that frame was not found. Source: `review/smb-w6.md`.
  - 8-4 (smb-w8), fire-and-hammer Bowser: the tester jumped over him and he kept facing left (`gauntlet/notes/smb-w8.md`; no shot cited).
- Related: `2026-10-05-bowser-pacing-speed-and-range.md`, `2026-10-05-bowser-jumps-too-rarely.md`.
- Reviewed: verified against `com/smbc/enemies/Bowser.as` (`RUN_SPEED` 62, `updateStats`, `pastXMax`, `fbTmrLsr`, `fbDelTmrLsr`, `jumpTmrLsr`) and ours: `src/game/entities/enemies/bowser.ts` (`update`).

Status: fixed — once a player is right of him and he is on the ground, Bowser turns right and runs at 62 px/s (0.52 px/f) until his right edge reaches `xMax`, where he stops; while chasing he breathes no fire, throws no hammers and does not jump, and in his normal state he always faces left (Bowser.as `updateStats` `ST_CHASE`, `pastXMax`).
