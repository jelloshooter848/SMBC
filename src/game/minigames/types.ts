import type { Scene } from '@engine/scene';
import type { Game } from '../scenes/game';

/**
 * How a mini game ended. `pass` frees the hero; `fail` offers a retry (any number of times);
 * `quit` leaves without a retry prompt (the player chose to stop, e.g. from the mini game's menu).
 */
export type MiniGameResult = 'pass' | 'fail' | 'quit';

/**
 * A mini game that frees a brainwashed hero (campaign only). The unlock flow (dialogue, rules
 * card, retry prompt, the freed card and the save) lives outside; a mini game only plays one
 * round and reports how it ended, so a later version in the hero's own game style can replace a
 * folder without touching the flow.
 */
export interface MiniGameDef {
  /** The CharacterDef id this mini game frees. */
  hero: string;
  /** Shown on the rules card and announced, e.g. 'MIRROR RACE'. */
  title: string;
  /** Rules card lines (ability names, never button letters), at most 26 columns each. */
  rules: string[];
  /**
   * Builds one round as a scene the flow pushes over the level. The scene calls `done` exactly
   * once; the flow pops it. It owns its own menu (the menu button offers Continue / Give up →
   * `done('quit')`), music and touch labels.
   */
  create(game: Game, done: (result: MiniGameResult) => void): Scene;
}
