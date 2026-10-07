# Mini game fidelity audit (for the 0.4.12 fidelity pass)

The audit is read-only: nothing in the repo changed. The comparison images (owner reference on the left, our build on
the right) are the `cmp-*.png` files in this folder.

**Sources.** Each finding is marked:
- **[R]:** seen in an owner reference screenshot;
- **[M]:** recalled from the NES game. These need checking before any tuning.
- **[C]:** our current behaviour.

**Impact** is how much the gap hurts the "feels like the real game" test: H, M or L. **Effort** is S, M or L.

## Problems shared by several games (cheapest wins)

1. **Death.** Every mini game built on World dies the way Mario does (`World.kill` / `updateDeath`). The real
   games differ: Mega Man bursts into orbs, Samus explodes, and Simon collapses.
2. **One life.** Mega Man, Samus, Simon and Ryu each get one life, and a death ends the round. All four real games
   give lives and checkpoints. Bill's REST model is the one to follow.
3. **Generic HUD.** Mega Man and Samus use the generic HUD, which prints MEGA / STATION and SAMUS / ZEBES. The real
   games show no names.
4. **Physics.** The heroes use their main-game physics, which were tuned by feel. Give each mini game its own
   authentic physics profile (as `bill/commando.ts` does) and leave the campaign heroes alone.

## Top gaps per game

### Luigi (Mirror Race)
- No SMB HUD. A track bar and race clock replace it (H, S).
- The course has only Goombas. Lost Levels 1-1 has piranha plants in the pipes, Koopas and Paratroopas, a poison
  mushroom and the end staircase (H, M).
- The race starts with a 3-2-1 countdown, not the WORLD 1-1 card (M, S).

### Link (Shadow Keep)
- No sword beam at full hearts (H, S).
- Rooms have 1-tile walls and a 14×9 floor. Zelda uses thick 2-tile walls and a 12×7 floor (H, L).
- The HUD reads ITEM / SWORD and SHADOW KEEP, against Zelda's B / A, LEVEL-n and rupee / key / bomb counts (M, S).
  B / A are button letters, so this one is the owner's call.
- The boss's name is drawn on screen (L, S). There is no Triforce ending (M, S).

### Mega Man (Station Escape)
- The HUD prints text where the real game shows bars only (H, S).
- Mario's death hop and one life (H, S/M).
- READY blinks with Mega Man already standing. He should beam in after READY (M, S).
- His jump is about 4.3 tiles high against roughly 3 in the original [M, verify]. Knockback pops him upward (H, S).
- The stage is one flat corridor with one shutter. The original has ladders, vertical screens, two shutters and Met
  enemies; it also has a START weapon menu (H, M/L).

### Samus (Zebes Escape)
- The HUD shows SAMUS / ZEBES and big digits. Metroid shows EN with tank boxes and a missile count (H, S).
- No "TIME BOMB SET / GET OUT FAST!" and no TIME 999-style counter (H, S).
- The escape runs through a Brinstar cavern to a ship. NES Metroid escapes up Tourian's shaft after Mother Brain, and
  has no ship (H, L).
- She starts on READY and dies with Mario's hop. She should materialise, then explode on death (M, S).
- No blue doors with room transitions (M, M).

### Simon (Dracula's Castle)
- The HUD has 2 rows. Castlevania has 3: SCORE / TIME / STAGE, the PLAYER bar with box and hearts, and the ENEMY
  bar with P-lives (H, S).
- Dracula's two forms share one 14-hit bar. In the original the bar refills for the second form, which leaps and
  spits fire. Ours walks and makes a floor shock wave, which isn't in Castlevania 1 (H, M).
- Simon walks while he whips and speeds up gradually. The original roots him while whipping and walks at full speed
  at once (H, S).
- Mario's death hop, one life, a softer knockback (M, S/M).
- The Dracula room needs the coffin dais and barred windows (M, S).

### SMB3 pieces (airship, Larry, bonus games)
- There is no SMB3 bottom status bar anywhere (H, M).
- You enter Larry's cabin rising from a floor pipe. SMB3 drops you in from the ceiling (M, S).
- The Toad House is a pointer menu, not a room you walk up to the chest in (M, M).
- N-Spade boards are random. SMB3 uses fixed boards that persist (L, S/M).
- After the Hammer Bro fight, the prize appears on a card. SMB3 drops a chest (L, S).

### Ryu and Bill
- **Ryu** is fine, apart from the shared problems above. His HUD has no SCORE / STAGE row or P-lives (L, S).
- **Bill** matches the references.
- **Caption fixes:** `refimg3/01` is Contra's Stage 8 gate boss, not Stage 1. `refimg/18` is the spade slot game's
  intro, not the memory match.

## Proposed fix order

**Quick wins:**
1. Mega Man HUD: bars only.
2. Samus HUD and the escape opener.
3. Simon's 3-row HUD.
4. A death animation per hero.
5. Proper starts: Mega Man beams in, Samus materialises, Luigi gets the WORLD card.
6. Link's sword beam, and drop the boss name.
7. Authentic physics profiles for the mini games: Simon rooted while whipping and his knockback arc; Mega Man's jump,
   knockback and shots that pass through walls.
8. Luigi gets the SMB HUD.
9. Larry's cabin is entered from the ceiling.

**Medium:**

10. Lives and checkpoints for Mega Man, Samus, Simon and Ryu.
11. Dracula: the bar refills, the beast leaps and spits fire, and the coffin dais.
12. Luigi's course rebuilt with Lost Levels elements.
13. The SMB3 status bar.
14. Mega Man: two shutters, a Met enemy, the weapon menu.
15. Toad House you walk into, fixed N-Spade boards, the Hammer Bro chest.
16. Link's Triforce ending, and B / A labels if the owner agrees.
17. Samus's doors.

**Large:**

18. Link's rooms re-laid out.
19. Mega Man's stage rebuilt with ladders and vertical screens.
20. Samus's Tourian finale.

Re-run each game's human sims after any tuning.
