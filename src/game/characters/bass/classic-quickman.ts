import type { CharacterDef } from '../character';
import type { MovementProfile } from '../profile';
import { MEGAMAN_CLASSIC_PROFILE } from '../megaman/classic';
import { BASS_CLASSIC_GUIDE } from './classic-guide';
import { BASS_CLASSIC_PROFILE, classicBass } from './classic';

/**
 * Quick Man's look on Bass's slot (G-051; SkinDescriptions.as BASS_SKIN_QUICK_MAN "Moves faster,
 * jumps higher, can't double jump or dash"; MegaManBase.setStats 808-831): walkSpeed ×1.3, no
 * slide (dash), no double jump and so the high jump (JUMP_PWR_HIGH_JUMP: Mega Man's 650 px/s,
 * 0x05355), no dash jump. The rest is Bass. In the original he also sees the per-hero helper
 * pieces (Bass.as 100-109: usesHorzObjs, usesVertObjs); those layers come with the level build
 * (G-010). Our own art (sprites/hero-looks.ts: Bass's suit under a boomerang-crested helmet).
 */
const QUICK_WALK = 1.3;
const quick = (v: number): number => Math.round(v * QUICK_WALK);

const { slide: _dash, ...NO_DASH } = BASS_CLASSIC_PROFILE;

export const QUICKMAN_CLASSIC_PROFILE: MovementProfile = {
  ...NO_DASH,
  minWalk: quick(BASS_CLASSIC_PROFILE.minWalk),
  walkAccel: quick(BASS_CLASSIC_PROFILE.walkAccel),
  runAccel: quick(BASS_CLASSIC_PROFILE.runAccel),
  maxWalk: quick(BASS_CLASSIC_PROFILE.maxWalk),
  maxRun: quick(BASS_CLASSIC_PROFILE.maxRun),
  jump: MEGAMAN_CLASSIC_PROFILE.jump,
  airJumps: 0,
};

export const QUICKMAN_CLASSIC: CharacterDef = {
  ...classicBass(
    {
      id: 'quickman',
      name: 'Quick Man',
      hudName: 'QUICK',
      portrait: { sheet: 'quickman', palette: 'quickman', frame: 'idle' },
    },
    QUICKMAN_CLASSIC_PROFILE,
    'quickman',
  ),
  lookOf: 'bass',
  guide: { ...BASS_CLASSIC_GUIDE, tagline: 'Quick Man: faster and a higher jump; no double jump or dash' },
  rescueName: 'Dr. Wily',
};
