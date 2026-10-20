import { pageSaid } from '../story/cards';
import { abilityHint } from './hints';
import { CardScene } from './message';
import type { Game } from './game';

/*
 * The campaign's gate for 0.5.0 (G-100..G-102): Classic mode is the game; the story campaign
 * ("Chapter 1") comes in 1.0. Outside dev mode the title's Chapter 1 row and a resume link
 * (`#save=`) show this card instead of the file select. Nothing is read, written or migrated:
 * every save file (smbc.save.N), smbc.progress and smbc.settings stays as it is, Options > Save
 * files still copies them out, and with dev mode on everything opens as before.
 */

/** The box's bottom edge: clear of the title's version line (y 228). */
export const CARD_BOTTOM = 222;

/** The card the title's Chapter 1 row shows (at most 28 chars a line). */
export const CHAPTER1_GATE_CARD: readonly string[] = [
  'CHAPTER 1',
  'COMING SOON!',
  '',
  'PLAY CLASSIC FOR NOW.',
  'YOUR SAVE FILES ARE KEPT.',
];

/** The card a resume link (`#save=`) shows: the link stays in the address for later. */
export const CHAPTER1_LINK_CARD: readonly string[] = [
  'CHAPTER 1',
  'COMING SOON!',
  '',
  'THIS RESUME LINK IS KEPT.',
  'OPEN IT AGAIN WHEN',
  'CHAPTER 1 IS OUT.',
];

/**
 * The gate's card in a box over the title (which stays beneath), read out; OK (JUMP), MENU or
 * BACK closes it and the title is back as it was. `lines`: the card (the link's card for a
 * resume link).
 */
export function showChapter1Gate(game: Game, lines: readonly string[] = CHAPTER1_GATE_CARD): void {
  game.ctx.audio.sfx('bump');
  game.deps.announcer?.say(pageSaid(lines, true));
  game.scenes.push(
    new CardScene(game, lines, () => game.scenes.pop(), null, {
      panel: true,
      overlay: true,
      bottomY: CARD_BOTTOM,
      keys: ['jump', 'start', 'attack'],
      prompt: () => abilityHint(game, 'OK', 'jump'),
    }),
  );
}
