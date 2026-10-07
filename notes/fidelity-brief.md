# 0.4.12 mini game fidelity pass: shared brief (G1 Mega Man and Samus, G2 Simon, Dracula and Ryu, G3 Link, Luigi and Larry)

## Conventions and process

- Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md.
  - Run the checks with `set -o pipefail`.
  - Use the commit trailers.
  - Never commit node_modules.
  - No CHANGELOG edits.
  - Player text names abilities, never button letters (see the one exception below).
  - Announcer and reduce flashing.
  - Write a failing test first.
- Base: `git merge claude/admiring-galileo-quy3ri`.
- After each commit, push a backup to `claude/wip-0.4.12-fidelity-g<N>`. Retry after 2, 4, 8 and 16 s. Never push
  anywhere else.
- This ships in 0.4.12, after 0.4.10 and 0.4.11. Other agents are changing world.ts, character code and level maps in
  parallel, so keep shared-file edits small and additive.

## Inputs

- The audit: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/fidelity-audit/REPORT.md.
  Item IDs (M1, S2, V4 and so on) refer to it.
- The comparison images: cmp-*.png in the same folder.
- The owner's reference screenshots, for reference only (never copy them into the repo):
  - scratchpad/refimg/ and scratchpad/refimg3/, each with an INDEX.md.
- The owner's rule: as true to the real NES game as possible. Art and music stay original.

## Owner-approved scope (the audit's quick wins plus two medium items)

1. **HUDs.**
   - Mega Man: bars only, no MEGA or STATION text.
   - Samus: EN with energy-tank boxes and a 3-digit missile count; no name or place text.
   - Simon: the true 3-row Castlevania HUD. Row 1 is SCORE, TIME and STAGE; row 2 is PLAYER, the sub-weapon box and
     hearts; row 3 is ENEMY and P-lives.
   - Luigi's Mirror Race: the SMB HUD (name and score, coins, WORLD, TIME), with the race track bar moved under it.
   - Link: the Zelda 1 style. LEVEL-n over the map, a column of key and bomb counts (rupees only if we have them),
     item boxes labelled **B** and **A**, and -LIFE-.
   - **Exception:** the owner explicitly allows the B and A letters on Link's HUD, as authentic HUD art. They must
     still not appear in rules or instruction text.
2. **Each hero's own death.**
   - Mega Man: an orb burst. The effect already exists for Dark Mega Man.
   - Samus: flashes and explodes.
   - Simon: falls and collapses.
   - Ryu: his own fall or collapse, close to Ninja Gaiden.
   - Each comes with its sound instead of Mario's hop and the `death` jingle.
3. **Proper starts.**
   - Mega Man: READY blinks on an empty spot, then he beams down.
   - Samus: she materialises to a start jingle, with no READY.
   - Luigi's race: a black "WORLD 1-1" card with lives, instead of the 3-2-1 countdown. Keep a short GO so the race
     start stays fair.
4. **Samus's escape opener.** Show "TIME BOMB SET / GET OUT FAST!". The escape clock becomes a TIME counter that
   starts at 999, mapped onto our existing escape duration.
5. **Link.** A sword beam at full hearts. Drop the boss name label.
6. **Physics for the mini games only.** Follow `src/game/minigames/bill/commando.ts`, which gives the mini game its own
   authentic form. The campaign hero kits must stay unchanged; test this.
   - Simon: stops dead when he whips on the ground, walks at full speed instantly, and his knockback is Castlevania's
     fixed backward arc with no control until he lands.
   - Mega Man: a jump apex of about 3 tiles (verify this against your best knowledge and note it), no upward pop on
     knockback, and buster shots that pass through walls.
   - Re-run each game's human-sims. Keep the cautious player at 85% or above. If a game gets too hard, ease enemy
     placement, not the authentic physics.
7. **Larry's cabin.** The hero drops in from the ceiling instead of rising out of a floor pipe.
8. **Lives and checkpoints** for Mega Man, Samus, Simon and Ryu, using Bill's REST model as the pattern:
   - 3 lives;
   - a mid-stage checkpoint, plus a restart at the boss door;
   - the retry menu (TRY AGAIN) only on game over;
   - the dev assists still work.
9. **Dracula's real second form.**
   - The ENEMY bar empties on phase 1, his head flies off, the beast appears and the bar **refills**.
   - The beast **leaps around the room and spits fireballs**. Remove the floor shock wave.
   - Make the beast's head the weak point if that is confirmed by the real game.
   - Dress the room with the coffin dais and tall barred windows.
   - Re-run CV_SIM.

## Shared pieces (G1 owns them; the others use them)

- **A death-style hook in World:** a `WorldStart` option such as
  `deathStyle?: 'hop' | 'orbs' | 'explode' | 'collapse' | 'ninja'`. The default `hop` changes nothing. G1 implements
  the World side for every style, so G2 only sets `collapse` for Simon and `ninja` for Ryu.
- **A shared lives and checkpoint helper** for World-based mini games, e.g. `src/game/minigames/lives.ts`, modelled on
  Bill's REST flow. G1 builds it with Mega Man and Samus first, commits early, and tells the orchestrator. G2 then
  merges G1's branch to use it for Simon and Ryu. Until then G2 does its other items.

## Agents

- **G1:** Mega Man and Samus, items 1 to 4, 6 and 8. Also owns the death-style hook and the lives helper.
- **G2:** Simon, Dracula and Ryu, items 1, 2, 6, 8 and 9. Ryu's HUD gains the SCORE and STAGE row and P-lives.
- **G3:** Link (items 1 and 5), Luigi (items 1 and 3) and Larry (item 7).
