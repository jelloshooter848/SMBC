import type { CharacterDef } from '../character';
import { BASS_CLASSIC, BASS_CLASSIC_PROFILE, classicBass } from './classic';

/**
 * Bass's other looks (owner addition to 0.5.0 batch 6; BmdInfo.as Bass003..Bass015): Dr. Wily,
 * Mr. X, Dr. Cossack, Gemini Man and Skull Man. Cosmetic: each plays exactly as Bass (the
 * original gives them no rule of their own; its rotateBassBuster only turns the buster's art).
 * Our own art (sprites/hero-looks.ts BASS_LOOKS: Bass's suit under each one's own head).
 */
function bassLook(
  id: string,
  name: string,
  hudName: string,
  orbs: 'colour' | 'white' = 'white',
): CharacterDef {
  return {
    ...classicBass(
      { id, name, hudName, portrait: { sheet: id, palette: id, frame: 'idle' } },
      BASS_CLASSIC_PROFILE,
      id,
      orbs,
    ),
    lookOf: 'bass',
    guide: { ...BASS_CLASSIC.guide, tagline: `${name}: plays as Bass` },
    rescueName: BASS_CLASSIC.rescueName ?? 'Dr. Wily',
  };
}

// Dr. Wily's orbs are the colour ones (BASS_COLOR_PARTICLE_SKIN_NUM 3, 4); the rest white.
export const WILY_CLASSIC = bassLook('wily', 'Dr. Wily', 'WILY', 'colour');
export const MRX_CLASSIC = bassLook('mrx', 'Mr. X', 'MR. X');
export const COSSACK_CLASSIC = bassLook('cossack', 'Dr. Cossack', 'COSSACK');
export const GEMINI_CLASSIC = bassLook('gemini', 'Gemini Man', 'GEMINI');
export const SKULLMAN_CLASSIC = bassLook('skullman', 'Skull Man', 'SKULL');
