import type { CharacterDef } from '../character';
import { MARIO } from '../mario';
import { plumberSprite, PLUMBER_BEHAVIOUR, PLUMBER_STATES, type PlumberPalettes } from '../mario';
import { LUIGI_PROFILE } from './profile';

/** Luigi recolours Mario's sheet; the star flash cycles through the same loud palettes. */
const LUIGI_PALETTES: PlumberPalettes = { normal: 'luigi', fire: 'luigi-fire', star: 'mario-star' };

export const LUIGI: CharacterDef = {
  id: 'luigi',
  name: 'Luigi',
  hudName: 'LUIGI',
  movement: LUIGI_PROFILE,
  damage: { kind: 'powerup', states: PLUMBER_STATES },
  stomps: true,
  crouches: true,
  canBreakBricks: MARIO.canBreakBricks,
  hitbox: MARIO.hitbox,
  sprite: (p, frame, reduceFlashing) => plumberSprite(p, frame, reduceFlashing, LUIGI_PALETTES),
  blockPowerUp: MARIO.blockPowerUp,
  jumpSfx: MARIO.jumpSfx,
  portrait: { sheet: 'mario', palette: 'luigi', frame: 'small-idle' },
  behaviour: PLUMBER_BEHAVIOUR,
};
