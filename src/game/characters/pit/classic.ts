import type { CharacterDef } from '../character';
import type { ProjectileSpec } from '../../entities/projectiles/projectile';
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

/** Samus's shot frames and their arrow twins on the `pit-shots` sheet (PI-21: arrows, art only). */
const ARROW_FRAMES: Readonly<Record<string, string>> = {
  'beam-0': 'arrow-0',
  'beam-1': 'arrow-1',
  'ice-beam-0': 'ice-arrow-0',
  'ice-beam-1': 'ice-arrow-1',
  'wave-beam-0': 'light-arrow-0',
  'wave-beam-1': 'light-arrow-1',
  missile: 'heavy-arrow',
  'missile-up': 'heavy-arrow-up',
};

/**
 * Each beam and missile drawn as an arrow from `sheet` (`pit-shots`, or Dark Pit's `darkpit-shots`):
 * the same spec with its frames swapped and every number kept; its end is a small burst of light.
 */
function arrows(sheet: string): (spec: ProjectileSpec, up: boolean) => ProjectileSpec {
  const memo = new Map<ProjectileSpec, ProjectileSpec>();
  const memoUp = new Map<ProjectileSpec, ProjectileSpec>();
  return (spec, up) => {
    const book = up ? memoUp : memo;
    let look = book.get(spec);
    if (!look) {
      // A beam fired up points up (`<arrow>-up-N`); the missile has its own up spec and frame.
      const frame = (f: string): string => {
        const a = ARROW_FRAMES[f] ?? 'arrow-0';
        return up && a !== 'heavy-arrow-up' ? a.replace(/-(\d)$/, '-up-$1') : a;
      };
      look = {
        ...spec,
        sheet,
        frames: spec.frames.map(frame),
        ...(spec.burstFrame ? { burstFrame: 'burst' } : {}),
      };
      book.set(spec, look);
    }
    return look;
  };
}

/** The roster identity (id, names, portrait): no Current def exists, so Samus's with these. */
function identity(id: string, name: string, hudName: string, palette: string): CharacterDef {
  return {
    ...SAMUS,
    id,
    name,
    hudName,
    portrait: { sheet: 'samus', palette, frame: 'idle' },
    // His own art (sprites/pit.ts) on the select screen and the intro card.
    portraitArt: { sheet: 'pit', palette, frame: 'idle' },
  };
}

export const PIT_CLASSIC: CharacterDef = classicSamus({
  base: identity('pit', 'Pit', 'PIT', 'pit'),
  variant: { ...PIT_VARIANT, shotLook: arrows('pit-shots') },
  palette: 'pit',
  sheet: 'pit',
  guide: pitClassicGuide('Pit'),
  jumpSfx: 'pit-jump',
});

export const DARKPIT_CLASSIC: CharacterDef = classicSamus({
  base: identity('darkpit', 'Dark Pit', 'D.PIT', 'darkpit'),
  variant: { ...PIT_VARIANT, shotLook: arrows('darkpit-shots') },
  palette: 'darkpit',
  sheet: 'pit',
  guide: pitClassicGuide('Dark Pit'),
  jumpSfx: 'pit-jump',
});
