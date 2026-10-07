import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { DuelScene } from './scene';

/**
 * Ryu's mini game, Shadow Duel: a Tecmo-style cutscene of the moonlit field duel, then a Ninja
 * Gaiden-style stage played as Ryu (his sword, wall cling and ninpo), built around climbing and
 * kicking between walls, ending in the Masked Ninja's dojo (scene.ts).
 */
export const RYU_MINIGAME: MiniGameDef = {
  hero: 'ryu',
  title: 'SHADOW DUEL',
  rules: [
    'PLAY AS RYU!',
    'JUMP AT A WALL AND HOLD',
    'TOWARD IT TO CLING; JUMP',
    'AGAIN TO KICK OFF, CLIMB.',
    'SLASH LANTERNS FOR NINPO.',
    'BEAT THE MASKED NINJA!',
  ],
  create(game, done): Scene {
    return new DuelScene(game, done);
  },
};
