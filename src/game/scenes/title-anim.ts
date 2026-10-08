import type { CharacterDef } from '../characters/character';
import { FIRST_HERO, type SlotContents } from '../save/save-files';

/**
 * The title screen's timeline and hero row (scenes/title.ts draws them). Frames at 60 fps.
 *
 * The rift (first title of a session only): the wand bolt zaps, the rift tears open across the
 * top, the logo letters and the heroes fly out of it onto the SMB field, the space around the
 * rift fades to the field and the rift closes, then the REMIX stamp slams on.
 *
 * The quick drop (every later title): the logo letters drop in one by one with a block-bump
 * bounce, the stamp slams on, and the freed heroes walk in from the left one at a time.
 */
export const TITLE_TIMING = {
  // --- the rift
  boltEnd: 24,
  /** The bolt's flash frames (left out with reduce flashing). */
  flashFrom: 10,
  flashTo: 12,
  tearFrom: 16,
  /** Frames per rift stage while it tears open (and closes). */
  tearStep: 6,
  lettersFrom: 70,
  letterGap: 6,
  letterFlight: 24,
  heroesFrom: 120,
  heroGap: 8,
  heroFlight: 30,
  fadeFrom: 160,
  fadeTo: 230,
  closeFrom: 200,
  riftStamp: 250,
  riftEnd: 280,
  // --- the quick drop
  dropLetterFrom: 4,
  dropLetterGap: 5,
  dropFall: 12,
  dropStamp: 72,
  dropEnd: 90,
  walkGap: 30,
  /** Walking speed in px per frame. */
  walkSpeed: 1.5,
  // --- both
  /** Frames the stamp shows at 2x before it lands. */
  stampPop: 2,
  /** Frames the screen shakes after it lands (none with reduce flashing). */
  stampShake: 2,
  dustFrames: 18,
  /** A freed hero strikes a pose every this many frames, for poseFrames. */
  poseEvery: 150,
  poseFrames: 24,
  /** The rift's band colours rotate every this many frames (not with reduce flashing). */
  rimStep: 4,
} as const;

export interface HeroSlot {
  def: CharacterDef;
  /** Freed on the file shown: drawn in colour; else a black silhouette with a "?". */
  freed: boolean;
  /** Centre x of the hero's place on the ground. */
  x: number;
}

/** The ground the heroes stand on (top of the ground tiles). */
export const TITLE_GROUND_Y = 208;

/** Every registered hero in registry order, spaced across the ground, freed ones marked. */
export function heroRow(characters: readonly CharacterDef[], freed: readonly string[]): HeroSlot[] {
  const n = characters.length;
  const step = Math.min(24, Math.floor(232 / Math.max(1, n)));
  return characters.map((def, i) => ({
    def,
    freed: def.id === FIRST_HERO || freed.includes(def.id),
    x: Math.round(128 + (i - (n - 1) / 2) * step),
  }));
}

/**
 * The freed heroes the title shows: those of the most advanced save file (most heroes freed,
 * the most recently played on a tie), or just the first hero when there is no file.
 */
export function titleFreed(saves: readonly SlotContents[]): string[] {
  let best: { freed: string[]; updated: number } | null = null;
  for (const s of saves) {
    if (!s || typeof s === 'string') continue;
    const freed = Array.isArray(s.freed) ? s.freed : [FIRST_HERO];
    if (
      !best ||
      freed.length > best.freed.length ||
      (freed.length === best.freed.length && s.updated > best.updated)
    )
      best = { freed, updated: s.updated };
  }
  return best ? [...best.freed] : [FIRST_HERO];
}

/** The block-bump bounce after a letter lands: px above its resting place, by frame. */
const BUMP = [-4, -6, -6, -4, -2, -1, 0, 0];
export function bump(t: number): number {
  return t >= 0 && t < BUMP.length ? (BUMP[t] as number) : 0;
}

/** Ease-in fall from `from` px above to 0 over `frames`. */
export function fall(t: number, from: number, frames: number): number {
  if (t >= frames) return 0;
  const k = Math.max(0, t) / frames;
  return -from * (1 - k * k);
}
