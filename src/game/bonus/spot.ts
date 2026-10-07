import { freshSeed } from '../world/world';
import { registerBonusGame, type BonusGame } from '../map/bonus-spot';
import { createBonusScene } from '.';
import { BONUS_KINDS, BONUS_TITLES, nextBonusKind } from './rules';

/*
 * The SMB3 bonus games on World 4's bonus spot (map/bonus-spot.ts): registered when this module
 * is imported (the world map imports it). The node shows and plays the next game in the rotation
 * (Toad House, N-spade, spade game). A round that was played ('used': a chest opened, a card
 * turned, a reel stopped, even if the player then gave up) advances the rotation and closes the
 * spot until its Hammer Bro is beaten; giving up before any of that is 'left' (it stays open, the
 * same game next time).
 */
export const SMB3_BONUS: BonusGame = {
  label: (game) => BONUS_TITLES[nextBonusKind(game.bonus)],
  icon: (game) => (nextBonusKind(game.bonus) === 'toad-house' ? 'smb3:node-toad-house' : 'smb3:node-spade'),
  create(game, _spot, done) {
    const kind = nextBonusKind(game.bonus);
    return createBonusScene(game, kind, freshSeed(), (result) => {
      if (!result.played) return done('left');
      game.bonus.bonusNext = (BONUS_KINDS.indexOf(kind) + 1) % BONUS_KINDS.length;
      done('used'); // closes the spot and saves (Game.bonusUsed)
    });
  },
};

registerBonusGame(SMB3_BONUS);
