import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';
import { CastleScene } from './scene';

/**
 * Simon's mini game, Dracula's Castle: an NES Castlevania-style castle stage under 5-4, played as
 * Simon (whip, the dagger from a candle with hearts as its ammunition, Castlevania stairs), ending
 * in Dracula's throne room: the Count, then his beast form, on one enemy bar (scene.ts).
 */
export const SIMON_MINIGAME: MiniGameDef = {
  hero: 'simon',
  title: "DRACULA'S CASTLE",
  rules: [
    'PLAY AS SIMON!',
    'WHIP CANDLES FOR HEARTS.',
    'HOLD UP OR DOWN AT STAIRS.',
    'HIT DRACULA IN THE HEAD!',
  ],
  create(game, done): Scene {
    return new CastleScene(game, done);
  },
};
