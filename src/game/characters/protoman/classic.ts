import type { CharacterDef } from '../character';
import { MEGAMAN } from '../megaman';
import { classicMegaMan, type ClassicMegaManOptions } from '../megaman/classic';
import { PROTOMAN_CLASSIC_GUIDE } from './classic-guide';

/**
 * Proto Man and Break Man, Classic-only heroes (2026-10-07-protoman-build-classic-character.md,
 * PM-1..PM-20; TG-41): Classic Mega Man with four rule changes, built by `classicMegaMan`. They
 * charge the buster in every power state (PM-11), fire two buster shots at a time while small
 * (PM-12), are pushed back twice as fast by a hit (PM-9: 160 px/s for 27 frames, about 36 px)
 * and fire buster-placed shots lower (PM-13: 9.5 px above the feet on the ground, 15.5 in the
 * air). Proto Man whistles when picked (PM-18); Break Man does not. No shield (PM-14, PM-M1).
 * Two adjacent select slots (PM-2, PM-M5). The rules live on each def, so two players differ
 * (PM-4).
 */

/** The four rule changes (PM-1's variant options), the same for both. */
const PROTO_RULES: Partial<ClassicMegaManOptions> = {
  chargeWithoutMushroom: true,
  busterCapSmall: 2,
  // 160 Flash px/s = 1.333 px/f (Mega Man 80 px/s, 0x00AAB).
  knockbackVx: 0x01555,
  shotPad: { ground: 9.5, air: 15.5 },
  guide: PROTOMAN_CLASSIC_GUIDE,
};

/** The roster identity (id, names, portrait): no Current def exists, so Mega Man's with these. */
function identity(id: string, name: string, hudName: string, palette: string): CharacterDef {
  return {
    ...MEGAMAN,
    id,
    name,
    hudName,
    portrait: { sheet: 'megaman', palette, frame: 'idle' },
    // His own art (sprites/protoman.ts) on the select screen and the intro card.
    portraitArt: { sheet: 'protoman', palette, frame: 'idle' },
  };
}

export const PROTOMAN_CLASSIC: CharacterDef = {
  ...classicMegaMan({
    ...PROTO_RULES,
    base: identity('protoman', 'Proto Man', 'PROTO', 'protoman'),
    sheet: 'protoman',
    palette: 'protoman',
    pickSfx: 'protoman-whistle',
  }),
  // The castle text's name (PM-M8, BA-M13, PI-M5): Mega Man's Proto Man skin, skin 3
  // (BmdInfo.as:896).
  rescueName: 'Roll',
};

export const BREAKMAN_CLASSIC: CharacterDef = {
  ...classicMegaMan({
    ...PROTO_RULES,
    base: identity('breakman', 'Break Man', 'BREAK', 'breakman'),
    sheet: 'protoman',
    palette: 'breakman',
  }),
  // The castle text's name (PM-M8, BA-M13, PI-M5): Mega Man's Break Man skin, skin 8
  // (BmdInfo.as:916).
  rescueName: 'Roll',
};
