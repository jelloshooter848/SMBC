# Classic save files: design for approval

Its own patch, after v0.4.69 (the current bug fixes) and before 0.5.0.

## Look
- Every new screen uses the CLASSIC menu style: the orange boxes over the live 1-1 demo, the
  mushroom cursor, the original's move/choose/back sounds, announced, with BACK stepping back one
  box. Reduce flashing is respected. No campaign-style blue panels.

## Flow
1. CLASSIC title → START → **set box**: SUPER MARIO BROS. / SMB SPECIAL / THE LOST LEVELS / BACK.
   Map difficulty and Options are no longer on this box.
2. Pick a set → **file box** for that set, laid out like the campaign's file select, in the
   Classic style:
   - FILE 1 / FILE 2 / FILE 3. A used file shows its difficulty, world, lives, score and hero. An
     empty file shows NEW GAME.
   - **ERASE FILE** is its own row below the files, as in the campaign, so a file can't be erased
     by accident.
   - BACK.
3. Pick a **used file** → CONTINUE straight away (to the hero select, as BUG-03).
4. Pick an **empty file** → **difficulty** (Easy / Normal / Hard) → the file's **game rules** →
   the hero select → play.
5. **ERASE FILE** → pick a file → "ERASE FILE N?" with **NO** picked first → YES empties it.
   BACK always means No.

## What each file keeps (fixed once the file starts)
- Map difficulty
- Game mode (All heroes, Survival, Single random…)
- More settings (lives, attack, when hit, item drops, piranhas, goombas, enemy speed)
- Weapons
- Disable heroes
- The run itself: level, lives, score, coins, every hero's power-ups, checkpoint, Survival state

To change a file's rules, erase it and start it again.

## Shared across all of Classic (change any time, in the title's OPTIONS)
- Music set, Tutorials, Cheats (switching unlocked cheats on or off), and Video/audio/controls.
- Cheat unlocks, "beaten" records and the continues count stay shared, as now.

## Other rules
- 3 sets × 3 files = 9 saves. A run belongs to its file. If the Level Select cheat jumps it to
  another set, it stays in its own file, and the file shows where it is.
- A file is written at each WORLD card and on a game over (at the continue point), as now. Dev
  runs and link runs never write.
- **Moving existing saves:** each current per-set save moves into **FILE 1** of its set, keeping
  its difficulty and mode. Its other rules come from the current Classic options. Nothing is lost.
- The overwrite warning from per-set saves goes away: an empty file is never overwritten, and a
  used one can only be emptied through ERASE FILE.
