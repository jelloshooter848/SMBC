import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { UnderworldScene } from './scene';

/**
 * Sophia's mini game, Underworld, Blaster Master in brief: the opening, the tank's cavern in side
 * view, Jason on foot through a gateway into an overhead dungeon (the GUN meter, grenades, POW)
 * and its guardian, back to the tank, and the Plutonium Boss in side view (scene.ts).
 */
export const SOPHIA_MINIGAME: MiniGameDef = {
  hero: 'sophia',
  title: 'UNDERWORLD',
  rules: [
    'PLAY AS SOPHIA AND JASON!',
    'SHOOT: THE CANNON BREAKS',
    'BRICKS. EXIT: JASON HOPS',
    'OUT. GATEWAYS ARE HIS.',
    "HITS LOWER JASON'S GUN.",
    'BEAT THE PLUTONIUM BOSS!',
  ],
  create(game, done): Scene {
    return new UnderworldScene(game, done);
  },
};
