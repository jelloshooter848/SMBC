import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { UnderworldScene } from './scene';

/**
 * Sophia's mini game, Underworld: Blaster Master's opening in brief, then Jason on foot through a
 * gateway into an overhead dungeon (the GUN meter, grenades, POW) and the Plutonium Boss
 * (scene.ts).
 */
export const SOPHIA_MINIGAME: MiniGameDef = {
  hero: 'sophia',
  title: 'UNDERWORLD',
  rules: [
    'PLAY AS JASON, ON FOOT!',
    'SHOOT: FIRE YOUR GUN.',
    'HITS LOWER YOUR GUN LEVEL;',
    'G CAPSULES RAISE IT.',
    'GRENADES BREAK CRACKS.',
    'BEAT THE PLUTONIUM BOSS!',
  ],
  create(game, done): Scene {
    return new UnderworldScene(game, done);
  },
};
