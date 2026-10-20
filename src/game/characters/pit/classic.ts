import type { CharacterDef } from '../character';
import { SAMUS } from '../samus';
import { classicSamus, type ClassicSamusVariant } from '../samus/classic';
import { pitClassicGuide } from './classic-guide';

/**
 * Pit and Dark Pit, Classic-only heroes (2026-10-07-pit-build-classic-character.md, Part A,
 * PI-1..PI-25; TG-41): Classic Samus with six rule changes, built by `classicSamus`. They walk and
 * jump while crouched (PI-7), tuck into the crouch pose and its 12 x 15 box in the air (PI-8),
 * can't walk on the ground while aiming up (PI-9), fire no beam from the crouch (PI-13; missiles
 * still fire, PI-14), fire standing shots 11 px above the feet (PI-15) and never curl into the
 * morph ball (PI-17). Their own beam and jump sounds (PI-22). Two adjacent select slots (PI-2,
 * PI-M6). Part B (the cut bow Pit) is not built.
 */

/** The six rule changes (PI-1's variant options), the same for both. */
export const PIT_VARIANT: Partial<ClassicSamusVariant> = {
  crouchWalk: true,
  airCrouchPose: true,
  noBeamInCrouch: true,
  noWalkWhileAimUp: true,
  morphBall: false,
  standShotHeight: 11,
  beamSfx: 'pit-shoot',
};

/** The roster identity (id, names, portrait): no Current def exists, so Samus's with these. */
function identity(id: string, name: string, hudName: string, palette: string): CharacterDef {
  return { ...SAMUS, id, name, hudName, portrait: { sheet: 'samus', palette, frame: 'idle' } };
}

export const PIT_CLASSIC: CharacterDef = {
  ...classicSamus({
    base: identity('pit', 'Pit', 'PIT', 'pit'),
    variant: PIT_VARIANT,
    palette: 'pit',
    guide: pitClassicGuide('Pit'),
    jumpSfx: 'pit-jump',
  }),
  // The castle text's name (PM-M8, BA-M13, PI-M5): the original's default skin (BmdInfo.as).
  rescueName: 'Palutena',
};

export const DARKPIT_CLASSIC: CharacterDef = {
  ...classicSamus({
    base: identity('darkpit', 'Dark Pit', 'D.PIT', 'darkpit'),
    variant: PIT_VARIANT,
    palette: 'darkpit',
    guide: pitClassicGuide('Dark Pit'),
    jumpSfx: 'pit-jump',
  }),
  // The castle text's name (PM-M8, BA-M13, PI-M5): the original's default skin (BmdInfo.as).
  rescueName: 'the Reaper',
};
