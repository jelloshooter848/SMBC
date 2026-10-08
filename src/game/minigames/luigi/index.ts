import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { MirrorRaceScene } from './race';

/**
 * Luigi's mini game, the Mirror Race: race brainwashed Luigi along a short course to the
 * flagpole as Mario; touching it first frees him (race.ts).
 */
export const LUIGI_MINIGAME: MiniGameDef = {
  hero: 'luigi',
  title: 'MIRROR RACE',
  rules: ['RACE LUIGI TO THE FLAG!', 'RUN AND JUMP.', "DON'T FALL IN A PIT!"],
  create(game, done, opts): Scene {
    return new MirrorRaceScene(game, done, opts?.retry === true);
  },
};
