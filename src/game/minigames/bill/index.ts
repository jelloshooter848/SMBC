import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { JungleScene } from './scene';

/**
 * Bill's mini game, Jungle Assault: a Contra-style stage card (the Konami code gives 30 lives),
 * then an NES Contra stage 1-style run-and-gun played as Bill in Contra form: three lives, one
 * hit each, falcon weapons, exploding bridges, the defense wall, and Red Falcon's heart in the
 * alien lair (scene.ts).
 */
export const BILL_MINIGAME: MiniGameDef = {
  hero: 'bill',
  title: 'JUNGLE ASSAULT',
  rules: [
    'PLAY AS BILL, CONTRA STYLE',
    'ONE HIT COSTS A LIFE (3).',
    'HOLD UP OR DOWN TO AIM;',
    'DOWN + JUMP DROPS DOWN.',
    'FIRE AT FALCONS FOR GUNS.',
    'DESTROY RED FALCON!',
  ],
  create(game, done): Scene {
    return new JungleScene(game, done);
  },
};
