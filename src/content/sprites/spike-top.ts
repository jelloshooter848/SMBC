import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Spike Top (Classic mode's Replace Goombas choice, entities/enemies/spike-top.ts): an original
 * design, nothing traced: a red dome shell with one white-tipped spike, a peeking face at the
 * front and stubby feet. 16x16, two walking frames (the original's ar(126,7,49,24): two cells,
 * animated as its Goomba base). Drawn with the enemy palettes' roles (sprites/enemies.ts):
 * 1 outline, 3 skin, 4 white, 7 red accent, so it takes each area's enemy colours. Faces LEFT.
 */
const SHELL = [
  '.......11.......',
  '......1441......',
  '......1471......',
  '.....147771.....',
  '....11777711....',
  '...1477777771...',
  '..147777777771..',
  '..177777777771..',
  '.17777777777771.',
  '.17777777777771.',
  '1331777777777771',
  '1413177777777771',
  '1333111111111111',
];

export const spikeTopDef: SpriteDef = {
  palette: 'enemies-overworld',
  frames: {
    'spike-top-0': [...SHELL, '.111.1331.1331..', '....1331..1331..', '....1111..1111..'],
    'spike-top-1': [...SHELL, '.111..1331.1331.', '......1331.1331.', '......1111.1111.'],
  },
};
