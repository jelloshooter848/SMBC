import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { DuelScene } from './scene';

/**
 * Ryu's mini game, Shadow Duel: a Tecmo-style cutscene of the moonlit field duel, then a Ninja
 * Gaiden-style stage played as Ryu (his sword, wall cling and ninpo), built around climbing and
 * kicking between walls, ending in a duel with the Masked Ninja on a moonlit rooftop (scene.ts).
 */
export const RYU_MINIGAME: MiniGameDef = {
  hero: 'ryu',
  title: 'SHADOW DUEL',
  rules: [
    'PLAY AS RYU!',
    'HOLD TOWARD A WALL IN THE',
    'AIR TO CLING; KEEP HOLDING',
    'AND TAP JUMP TO CLIMB.',
    'SLASH LANTERNS FOR NINPO.',
    'BEAT THE MASKED NINJA!',
  ],
  create(game, done): Scene {
    return new DuelScene(game, done);
  },
};
