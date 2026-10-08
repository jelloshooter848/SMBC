import { WEAPONS } from '../../characters/megaman/weapons';
import { type HeroTraining, itemLesson, lesson, type TrainingLesson } from './common';

/*
 * Mega Man's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * He starts with his basic kit (the buster and the slide), then grabs the Helmet (his grow item:
 * the charge shot), then each weapon and the Rush Coil as its own item, in the order his kit
 * builds up (docs/POWERUPS.md 5.3). Touch prompts name the weapon button as it reads (SAW, LEAF...).
 */

/** Mega Man's jump off the seabed clears this (his jump on land does not). */
export const SEABED_JUMP_PX = 112;

const MEGAMAN_WEAPON_PROMPTS: Record<string, string> = {
  saw: '[WEAPON:select] TO THE SAW DISC. [USE WEAPON:special:SAW] FIRES IT: AIM IT 8 WAYS.',
  leaf: '[WEAPON:select] TO THE LEAF GUARD. [USE WEAPON:special:LEAF] TWICE TO THROW IT.',
  flame: '[WEAPON:select] TO THE FLAME WAVE. [USE WEAPON:special:FLAME]: IT RUNS ALONG THE FLOOR.',
  knuckle: '[WEAPON:select] TO THE KNUCKLE. [USE WEAPON:special:KNUCKLE]: IT SEEKS THE DUMMY.',
  bolt: '[WEAPON:select] TO THE BOLT. [USE WEAPON:special:BOLT]: A BEAM ACROSS THE SCREEN.',
};

/** Weapon `id`'s lesson: grab its item, pick it with WEAPON and fire it. */
function weaponLesson(id: string): TrainingLesson {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) throw new Error(`no Mega Man weapon ${id}`);
  return itemLesson(w.id, w.item, MEGAMAN_WEAPON_PROMPTS[w.id] ?? '', (t) => t.shotKinds.has(w.spec.kind));
}

export const MEGAMAN_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'basics',
      title: 'BASICS',
      room: 'gear',
      lessons: [
        lesson('shoot', '[SHOOT:attack] THE DUMMY WITH YOUR BUSTER.', (t) => t.dummyHits.has('buster')),
        // The grow item: the Helmet brings the charge shot.
        itemLesson(
          'charge',
          'helmet',
          'GRAB THE HELMET. NOW HOLD [SHOOT:attack] TO CHARGE, LET GO FOR A CHARGE SHOT.',
          (t) => t.shotKinds.has('buster-charged'),
        ),
        lesson(
          'slide',
          'HOLD DOWN AND PRESS [JUMP:jump] TO SLIDE. SLIDE UNDER THE LOW WALL!',
          (t) => t.slid && t.tunnel,
        ),
      ],
    },
    {
      id: 'weapons',
      title: 'WEAPONS',
      room: 'gear',
      lessons: [
        weaponLesson('saw'),
        weaponLesson('leaf'),
        itemLesson(
          'rush',
          'rush-coil',
          '[WEAPON:select] TO RUSH. [USE WEAPON:special:RUSH], THEN LAND ON THE COIL TO FLY UP!',
          (t) => t.seen.has('rush-bounce'),
        ),
      ],
    },
    {
      id: 'more-weapons',
      title: 'MORE WEAPONS',
      room: 'practice',
      lessons: [weaponLesson('flame'), weaponLesson('knuckle'), weaponLesson('bolt')],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        lesson(
          'seabed-jump',
          'UNDER WATER YOU WALK THE SEABED. [JUMP:jump] OFF IT: YOU GO MUCH HIGHER!',
          (t) => t.maxJumpHeight >= SEABED_JUMP_PX,
        ),
      ],
    },
  ],
};
