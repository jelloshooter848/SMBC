import type { CharacterDef } from '../character';
import type { MovementProfile } from '../profile';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import { MEGAMAN_CLASSIC_PROFILE, classicMegaMan } from '../megaman/classic';
import { mmWeapon, type MMWeaponId } from '../megaman/classic-weapons';
import { BASS_CLASSIC_GUIDE } from './classic-guide';
import {
  AIM_POSE,
  BASS_BUSTER,
  BASS_CAP_BIG,
  BASS_CAP_SMALL,
  BASS_FIRE_EVERY,
  BASS_FIRE_STEP,
  bassAim,
} from './classic-weapons';

/**
 * Classic SMBC Bass (bug-reports/2026-10-07-bass-build-classic-character.md, BA-1..BA-37), a
 * Classic-only hero (TG-41..TG-43: registry.ts CLASSIC_EXTRAS, never in CHARACTERS). He is Classic
 * Mega Man's factory (megaman/classic.ts) with a rooted 7-way rapid-fire buster, a full-height dash
 * whose jump keeps its speed, a double jump, the Water Shield on the Flower, Select swapping the
 * buttons at once, no charge and no Rush.
 */

/**
 * BA-8, BA-10..BA-13, BA-15: Classic Mega Man's profile with the 565 px/s jump (our take-off less
 * one frame of gravity: 0x04800), one air jump of the same strength, a dash (his slide: 2.5 px/f
 * for 62.5 px) that keeps his 22 px height, a dash jump of 650 px/s (0x05355) allowed with Down held
 * that keeps the dash speed in the air, and his floor-jump water numbers.
 */
export const BASS_CLASSIC_PROFILE: MovementProfile = {
  ...MEGAMAN_CLASSIC_PROFILE,
  jump: [{ maxVx: Infinity, initial: 0x04800, holdGravity: 0x00355, fallGravity: 0x00355 }],
  airJumps: 1,
  springKeepsAirJumps: true,
  slide: {
    ...(MEGAMAN_CLASSIC_PROFILE.slide as NonNullable<MovementProfile['slide']>),
    hitboxH: 22,
    jumpWithDown: true,
    jumpSpeed: 0x05355,
    keepSpeedInAir: true,
  },
  swim: CLASSIC_SWIM.bass,
};

/** The roster identity of a hero with no Campaign def (BA-2, BA-4). */
const BASS_BASE: Pick<CharacterDef, 'id' | 'name' | 'hudName' | 'portrait' | 'music'> = {
  id: 'bass',
  name: 'Bass',
  hudName: 'BASS',
  portrait: { sheet: 'bass', palette: 'bass', frame: 'idle' },
};

/**
 * Bass's Classic def on `base`, `profile` and look `palette` (its sheet of the same name): Bass
 * himself, and his Quick Man look (G-051, bass/classic-quickman.ts). He wears the Water Shield
 * suit (`<palette>-water`) while he holds the Flower (BA-33); his own suit otherwise.
 */
export function classicBass(
  base: Pick<CharacterDef, 'id' | 'name' | 'hudName' | 'portrait' | 'music'>,
  profile: MovementProfile,
  palette: string,
  orbs: 'colour' | 'white' = 'white',
): CharacterDef {
  const def = classicMegaMan({
    base,
    profile,
    sheet: palette,
    palette,
    buster: { spec: BASS_BUSTER, cap: BASS_CAP_BIG },
    busterCapSmall: BASS_CAP_SMALL,
    charge: null,
    flowerWeapon: 'water-shield',
    flowerSetting: 'bass',
    rush: false,
    guide: BASS_CLASSIC_GUIDE,
    rapid: {
      step: BASS_FIRE_STEP,
      every: BASS_FIRE_EVERY,
      aim: bassAim,
      poses: AIM_POSE,
    },
    swapOnPress: true,
    weaponPalette: (id: MMWeaponId) => (id === 'water-shield' ? `${palette}-water` : palette),
    weaponLabel: (id) => (id === 'water-shield' ? 'WATER' : mmWeapon(id).label),
    slideFrame: 'dash',
    // G-054: white orbs, colour only for Dr. Wily and Quick Man (BASS_COLOR_PARTICLE_SKIN_NUM 3, 4, 7, 8).
    orbs,
  });
  // The original's level flags (G-010), after the Mega Man factory's (which has his `horz`):
  // Bass.as:102-103 gives him and his looks no helper pieces (his Quick Man look has them).
  return { ...def, levelFlags: {} };
}

export const BASS_CLASSIC: CharacterDef = {
  ...classicBass(BASS_BASE, BASS_CLASSIC_PROFILE, 'bass'),
  // The castle text's name (BA-M13): the original's default skin (BmdInfo.as).
  rescueName: 'Dr. Wily',
};
