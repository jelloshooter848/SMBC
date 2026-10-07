import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { StationScene } from './scene';

/**
 * Mega Man's mini game, Station Escape: an NES-style stage on the space station above 3-1, played
 * as Mega Man (buster, charge shot, slide; the Saw Disc from a capsule halfway), ending behind a
 * boss shutter in a fight with Dark Mega Man, the brainwashing's copy of him (scene.ts).
 */
export const MEGAMAN_MINIGAME: MiniGameDef = {
  hero: 'megaman',
  title: 'STATION ESCAPE',
  rules: ['PLAY AS MEGA MAN!', 'SHOOT, CHARGE AND SLIDE.', 'FIND THE SAW DISC.', 'BEAT DARK MEGA MAN!'],
  create(game, done): Scene {
    return new StationScene(game, done);
  },
};
