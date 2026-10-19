import type { CharacterDef } from '../character';
import { LUIGI, LUIGI_PALETTES } from './index';
import { plumberClassic, plumberClassicProfile, type PlumberConstants } from '../mario/classic';
import { plumberClassicGuide } from '../mario/classic-guide';

/**
 * Classic SMBC Luigi (Luigi.as, SMBC 3.1.21; ML-C3, ML-C7): slow to start, a long slide, and a
 * floaty jump with no soft cut (FY = 1), so letting go only ends his rise. Units as in
 * mario/classic.ts.
 */
export const LUIGI_CONSTANTS: PlumberConstants = {
  accel: 0x00072, // AX_DEFAULT 200: 0.02778 px/f²
  runAccel: 0x000a2, // AX_RUN 285: 0.03958 px/f²
  release: 63801, // FX_WALK .2
  brake: 63496, // FX_RUN_CROUCH .15
  skid: 64336, // FX_SKID .33
  standSpeed: 0x03155, // JUMP_SPEED_NORMAL 370: 3.0833 px/f
  runSpeed: 0x03955, // JUMP_SPEED_RUN 430: 3.5833 px/f
  standCap: 64, // JUMP_HEIGHT_NORMAL 128
  runCap: 68, // JUMP_HEIGHT_RUN 136
  minLine: 15, // JUMP_HEIGHT_MIN 30
  gravity: 0x0031c, // GRAVITY 1400: 0.19444 px/f²
  maxFall: 0x04000, // VY_MAX_PSV_NORMAL 480: 4.0 px/f
};

export const LUIGI_CLASSIC_PROFILE = plumberClassicProfile(LUIGI_CONSTANTS);

export const LUIGI_CLASSIC: CharacterDef = {
  ...plumberClassic({
  base: LUIGI,
  constants: LUIGI_CONSTANTS,
  palettes: LUIGI_PALETTES,
  guide: plumberClassicGuide('Luigi', 'slippery, floats high'),
}),
  // The castle text's name (PM-M8): the original's default skin (BmdInfo.as).
  rescueName: 'your princess',
};
