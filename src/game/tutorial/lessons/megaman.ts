import { WEAPONS } from '../../characters/megaman/weapons';
import { type HeroTraining, k, legacyLesson } from './common';

/* Mega Man's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

/** Mega Man's jump off the seabed clears this (his jump on land does not). */
export const SEABED_JUMP_PX = 112;

const MEGAMAN_WEAPON_PROMPTS: Record<string, string> = {
  saw: '[WEAPON:select] TO THE SAW DISC. [USE WEAPON:special] FIRES IT: AIM IT 8 WAYS.',
  leaf: '[WEAPON:select] TO THE LEAF GUARD. [USE WEAPON:special] TWICE TO THROW IT.',
  flame: '[WEAPON:select] TO THE FLAME WAVE. [USE WEAPON:special]: IT RUNS ALONG THE FLOOR.',
  knuckle: '[WEAPON:select] TO THE KNUCKLE. [USE WEAPON:special]: IT SEEKS THE DUMMY.',
  bolt: '[WEAPON:select] TO THE BOLT. [USE WEAPON:special]: A BEAM ACROSS THE SCREEN.',
};

export const MEGAMAN_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'buster',
      title: 'BUSTER',
      room: 'practice',
      lessons: [
        legacyLesson('shoot', '[SHOOT:attack] THE DUMMY WITH YOUR BUSTER.', (t) => t.dummyHits.has('buster')),
        legacyLesson(
          'charge',
          'THE HELMET: HOLD [SHOOT:attack] TO CHARGE, LET GO FOR A CHARGE SHOT.',
          (t) => t.shotKinds.has('buster-charged'),
          (run) => k(run, 'helmet') > 0,
        ),
      ],
    },
    {
      id: 'moves',
      title: 'MOVES',
      room: 'gear',
      lessons: [
        legacyLesson(
          'slide',
          'HOLD DOWN AND PRESS [JUMP:jump] TO SLIDE. SLIDE UNDER THE LOW WALL!',
          (t) => t.slid && t.tunnel,
        ),
        legacyLesson(
          'rush',
          '[WEAPON:select] TO RUSH. [USE WEAPON:special], THEN LAND ON THE COIL TO FLY UP!',
          (t) => t.seen.has('rush-bounce'),
          (run) => k(run, 'helmet') > 0,
        ),
      ],
    },
    {
      id: 'weapons',
      title: 'WEAPONS',
      room: 'practice',
      lessons: [
        legacyLesson(
          'weapon',
          '[WEAPON:select] PICKS A WEAPON. THE BAR BY YOUR HEALTH IS ITS ENERGY.',
          (t) => t.toolCycles > 0,
          (run) => k(run, 'helmet') > 0 || k(run, 'weapons') > 0,
        ),
        ...WEAPONS.map((w, i) =>
          legacyLesson(
            w.id,
            MEGAMAN_WEAPON_PROMPTS[w.id] ?? '',
            (t) => t.shotKinds.has(w.spec.kind),
            (run) => k(run, 'weapons') > i,
          ),
        ),
      ],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        legacyLesson(
          'seabed-jump',
          'UNDER WATER YOU WALK THE SEABED. [JUMP:jump] OFF IT: YOU GO MUCH HIGHER!',
          (t) => t.maxJumpHeight >= SEABED_JUMP_PX,
        ),
      ],
    },
  ],
};
