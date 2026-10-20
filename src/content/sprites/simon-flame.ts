import type { SpriteDef } from '@engine/gfx/pixelart';
import { SIMON_CLASSIC_FRAMES } from './simon-classic';

/**
 * The Flame Whip's strike (Classic SMBC Simon, SI-C10/SI-C15), drawn from scratch in the hunter's
 * own palette: a long lash wrapped in flickering red flames, its tip 51 px ahead of his centre
 * (column 59; the body's centre is column 8), so the art reaches as far as the hit box. R1: the
 * Classic body at the original's sizes (simon-classic.ts, the original's 44 px long whip).
 */
export const simonFlameDef: SpriteDef = {
  palette: 'simon',
  frames: {
    'whip-flame': SIMON_CLASSIC_FRAMES['whip-flame'] as string[],
    'crouch-whip-flame': SIMON_CLASSIC_FRAMES['crouch-whip-flame'] as string[],
  },
};
