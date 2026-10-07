import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { EscapeScene } from './scene';

/**
 * Samus's mini game, Zebes Escape, as the NES Metroid ends: played as Samus (beam, missiles, morph
 * ball and bombs) she fights through Tourian's rooms to the brain, destroys it, and climbs the
 * escape shaft to the surface before the time bomb goes off (scene.ts).
 */
export const SAMUS_MINIGAME: MiniGameDef = {
  hero: 'samus',
  title: 'ZEBES ESCAPE',
  rules: [
    'PLAY AS SAMUS!',
    'SHOOT THE DOORS OPEN.',
    'MISSILES BREAK RED DOORS.',
    'DESTROY THE BRAIN, THEN',
    'CLIMB OUT IN TIME!',
  ],
  create(game, done): Scene {
    return new EscapeScene(game, done);
  },
};
