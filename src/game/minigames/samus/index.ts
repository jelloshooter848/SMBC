import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { EscapeScene } from './scene';

/**
 * Samus's mini game, Zebes Escape: the cavern under 4-2 self-destructs; played as Samus (beam,
 * missiles, morph ball and bombs) she climbs two shafts, rolls through tunnels and bombs through
 * walls to reach her ship before the countdown runs out (scene.ts).
 */
export const SAMUS_MINIGAME: MiniGameDef = {
  hero: 'samus',
  title: 'ZEBES ESCAPE',
  rules: [
    'PLAY AS SAMUS!',
    'THE CAVERN WILL BLOW UP.',
    'DOWN: MORPH BALL.',
    'BOMB THE CRACKED BLOCKS.',
    'REACH YOUR SHIP IN TIME!',
  ],
  create(game, done): Scene {
    return new EscapeScene(game, done);
  },
};
