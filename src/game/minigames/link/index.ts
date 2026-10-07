import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { ShadowKeepScene } from './keep';

/**
 * Link's mini game, the Shadow Keep: a small top-down dungeon in the style of the first Zelda
 * game, the spell's prison in Link's mind. Beat the keeper and take the exit to free him (keep.ts).
 */
export const LINK_MINIGAME: MiniGameDef = {
  hero: 'link',
  title: 'SHADOW KEEP',
  rules: ['ESCAPE THE SHADOW KEEP!', 'SWORD: ATTACK.', 'CHEST ITEMS: SPECIAL.', 'SOLVE ROOMS, FIND KEYS.'],
  create(game, done): Scene {
    return new ShadowKeepScene(game, done);
  },
};
