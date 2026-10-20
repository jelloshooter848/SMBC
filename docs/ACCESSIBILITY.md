# Accessibility rules

The rules every screen, card and menu follows. New screens must keep them; a change that cannot is written down
here as an exception, with the owner decision behind it.

## The rules

- **Player text names abilities** (JUMP, ATTACK, TALK, OK, BACK), never raw button letters. Key hints that show
  the player's own bound key or pad button are fine.
- **Every new text is announced** to the screen reader (the announcer's `say`).
- **Text never moves on by itself.** Every page, card and message waits for a press (owner note 4, 0.4.22).
- **Every scene can be skipped.**
- **Reduce flashing** (Options > Video) is respected everywhere: blinks are held steady or slowed, and flashes are
  dimmed. This holds under both Classic rules and Current rules.
- **No level numbers in hints** (the story's hint lines name places, never level numbers).
- **Remapping** never leaves two actions on one key: a key already bound to another action is refused, and the
  options screen asks for another key (G-091).

## Exceptions

### The WORLD card (Classic mode, G-090, owner decision D4)

The black "WORLD 1-1 × 3" card before each level moves on by itself, as the original SMBC 3.1.21's pre-level
screen does: 2 seconds (2.5 seconds in the Single Character game mode). It is the one card that does not wait for
a press. To keep it accessible:

- it is announced (the hero, the level and the lives) as it opens;
- in a Classic run a fresh JUMP, ATTACK or START press skips it at once (after a short guard, so a press meant for
  the level before does not skip it);
- it shows nothing the player must read to play: the same level, hero and lives are in the HUD and in the
  announcement.

The campaign's WORLD card keeps its 0.4 behaviour (it moves on after 2 seconds) and is covered by this exception
too.
