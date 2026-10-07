import type { Scene } from '@engine/scene';
import type { Game } from '../scenes/game';
import { MessageScene } from '../scenes/message';
import { fontText } from '../hud/text';
import { abilityHint } from '../scenes/hints';
import type { PageId } from './types';

/*
 * The hook between the world map's bonus spot (World 4's, revealed by Larry Koopa's crystal ball;
 * docs/WORLD_MAP.md "The bonus spot and its Hammer Bro") and the bonus games played there (the
 * SMB3 bonus work: Toad House, N-spade, the spade slots). The map owns the node, its road, the
 * one-shot `Game.bonusOpen` state and the Hammer Bro; the bonus game owns its scene.
 *
 * JUMP on the open bonus node calls `Game.openBonus(spot)`, which pushes `bonusGame().create(...)`
 * over the map. The scene calls `done` exactly once: 'used' (a round was played: the bonus closes,
 * `Game.bonusOpen = false`, saved, and the Hammer Bro comes out on the map) or 'left' (backed out
 * before playing: it stays open). Either way the map comes back with the hero on the node.
 * Until a bonus game registers itself (`registerBonusGame`), a placeholder card stands in and
 * counts as used, so the Hammer Bro loop can be played.
 */

/** Where the bonus was entered from (the node's page and id). */
export interface BonusSpot {
  page: PageId;
  node: string;
}

export type BonusOutcome = 'used' | 'left';

export interface BonusGame {
  /**
   * The hint line and the announcer's name for the open bonus node ('TOAD HOUSE', 'N-SPADE';
   * at most 32 chars, A-Z 0-9 space and - ! ').
   */
  label(game: Game): string;
  /**
   * The node's map icon as `sheet:frame` (16×16, e.g. 'smb3:node-toad-house'); the map falls back
   * to its own bonus dot while the sheet or frame is missing.
   */
  icon(game: Game): string;
  /** One visit; `done` must be called exactly once. */
  create(game: Game, spot: BonusSpot, done: (outcome: BonusOutcome) => void): Scene;
}

/** The placeholder until the bonus games land: a card, counted as used. */
export const PLACEHOLDER_BONUS: BonusGame = {
  label: () => 'BONUS GAME',
  icon: () => 'smb3:node-toad-house',
  create(game, _spot, done) {
    const lines = ["TOAD'S BONUS HOUSE", '', 'THE BONUS GAMES', 'ARE COMING SOON!'];
    game.deps.announcer?.say(`${lines.filter(Boolean).join(' ')} OK to continue.`);
    return new MessageScene(
      game,
      [...lines, '', fontText(`PRESS ${abilityHint(game, 'OK', 'jump')}`)],
      () => done('used'),
      1800,
      ['start', 'jump', 'attack'],
    );
  },
};

let registered: BonusGame | null = null;

/** The bonus games register here (null puts the placeholder back). */
export function registerBonusGame(g: BonusGame | null): void {
  registered = g;
}

/** The registered bonus game, or the placeholder. */
export function bonusGame(): BonusGame {
  return registered ?? PLACEHOLDER_BONUS;
}

/** The hint line on a bonus node that has been used (the Hammer Bro must be beaten first). */
export const BONUS_CLOSED_HINT = 'BEAT THE HAMMER BRO TO REOPEN';
export const BONUS_CLOSED_SAID = 'Bonus used. Beat the Hammer Bro to open it again.';
