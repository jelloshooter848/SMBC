import { GUNS } from '../../characters/bill/weapons';
import { type HeroTraining, k, legacyLesson } from './common';

/* Bill's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

const BILL_GUN_PROMPTS: Record<string, string> = {
  mg: '[WEAPON:select] TO THE MACHINE GUN. HOLD [SHOOT:attack] TO KEEP FIRING.',
  spread: '[WEAPON:select] TO THE SPREAD. [SHOOT:attack]: FIVE SHOTS IN A FAN.',
  laser: '[WEAPON:select] TO THE LASER. [SHOOT:attack]: ONE BEAM THAT PIERCES.',
  'flame-gun': '[WEAPON:select] TO THE FLAME THROWER. [SHOOT:attack]: A HEAVY FIREBALL.',
};

export const BILL_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'aim',
      title: 'AIM',
      room: 'practice',
      lessons: [
        legacyLesson('shoot', '[SHOOT:attack] THE DUMMY. YOUR BULLETS NEVER RUN OUT.', (t) =>
          t.dummyHits.has('shot'),
        ),
        legacyLesson(
          'aim',
          'AIM IN 8 WAYS: HOLD UP, OR UP AND A DIRECTION. [SHOOT:attack] 3 WAYS.',
          (t) => t.shotDirs.size >= 3 && t.aimedDirs >= 2,
        ),
        legacyLesson('prone', 'HOLD DOWN TO GO PRONE.', (t) => t.crouched),
        legacyLesson('jump-shoot', '[JUMP:jump] AND [SHOOT:attack] IN THE AIR.', (t) => t.airShots > 0),
      ],
    },
    {
      id: 'guns',
      title: 'GUNS',
      room: 'practice',
      lessons: GUNS.slice(1).map((g, i) =>
        legacyLesson(
          g.id,
          BILL_GUN_PROMPTS[g.id] ?? '',
          (t) => t.shotKinds.has(g.spec.kind),
          (run) => k(run, 'guns') > i,
        ),
      ),
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        legacyLesson(
          'swim-shoot',
          '[SWIM:jump] STROKES UP. [SHOOT:attack] WHILE YOU SWIM!',
          (t) => t.swimShots > 0,
        ),
      ],
    },
  ],
};
