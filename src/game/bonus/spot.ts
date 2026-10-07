import { freshSeed } from '../world/world';
import { registerBonusGame, type BonusGame } from '../map/bonus-spot';
import { createBonusScene } from '.';
import { BONUS_KINDS, BONUS_TITLES, nextBonusKind } from './rules';

/*
 * The SMB3 bonus games on World 4's bonus spot (map/bonus-spot.ts): registered when this module
 * is imported (the world map imports it). The node shows and plays the next game in the rotation
 * (Toad House, N-spade, spade game). The first choice (a chest opened, a card turned, a reel
 * stopped) uses the visit at once, before any prize is given: the rotation moves on and the spot
 * closes (`Game.bonusUsed`, saved), so reloading cannot replay it. The end then says 'used' (back
 * to the map; bonusUsed again changes nothing). Giving up before any choice is 'left': still open,
 * the same game next time.
 */
export const SMB3_BONUS: BonusGame = {
  label: (game) => BONUS_TITLES[nextBonusKind(game.bonus)],
  icon: (game) => (nextBonusKind(game.bonus) === 'toad-house' ? 'smb3:node-toad-house' : 'smb3:node-spade'),
  create(game, _spot, done) {
    const kind = nextBonusKind(game.bonus);
    return createBonusScene(
      game,
      kind,
      freshSeed(),
      (result) => done(result.played ? 'used' : 'left'),
      () => {
        game.bonus.bonusNext = (BONUS_KINDS.indexOf(kind) + 1) % BONUS_KINDS.length;
        game.bonusUsed(); // closed and saved now
      },
    );
  },
};

registerBonusGame(SMB3_BONUS);
