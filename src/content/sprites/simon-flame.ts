import type { SpriteDef } from '@engine/gfx/pixelart';
import { crouchStrike, strike } from './simon';

/**
 * The Flame Whip's strike (Classic SMBC Simon, SI-C10/SI-C15), drawn from scratch in the hunter's
 * own palette: a long lash wrapped in flickering red flames, its tip 51 px ahead of his centre
 * (column 59 of a 64-wide frame; the body's centre is column 8), so the art reaches as far as the
 * hit box. Same layout as the other strikes (`simon.ts`): body in columns 0-15, lash from 16.
 */
const FLAME_W = 64;
const LASH = 44;

/** A row of `LASH` pixels: `ch` every `step` columns from `from`, the rest transparent. */
function dots(ch: string, from: number, step: number, last = LASH): string {
  let r = '';
  for (let x = 0; x < LASH; x++) r += x >= from && x < last && (x - from) % step === 0 ? ch : '.';
  return r;
}

const flameLash: string[] = [
  dots('2', 3, 6, LASH - 2),
  dots('2', 1, 3, LASH - 1),
  // The lash line (starts with 5, as lashRow expects), its tip a burst of flame.
  '5'.repeat(LASH - 3) + '252',
  '0'.repeat(LASH - 4) + '.222',
  dots('2', 2, 4, LASH - 1),
];

export const simonFlameDef: SpriteDef = {
  palette: 'simon',
  frames: {
    'whip-flame': strike(flameLash, FLAME_W),
    'crouch-whip-flame': crouchStrike(flameLash, FLAME_W),
  },
};
