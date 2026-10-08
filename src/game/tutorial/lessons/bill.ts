import { type HeroTraining, itemLesson, lesson } from './common';

/*
 * Bill's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * He starts from his basic kit (the rifle, 8-way aim, prone, 3 hits) and finds his items in the
 * order the campaign places them (docs/POWERUPS.md 6.2): a Medal first, then the Machine Gun, the
 * Laser, the Flame Gun and the Spread Gun. A gun he grabs is the one in his hands, so the lesson
 * only has him SHOOT it.
 */

/** Bill's hits with one Medal (characters/bill START_HITS + 1). */
export const BILL_MEDAL_HITS = 4;

export const BILL_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'aim',
      title: 'AIM',
      room: 'practice',
      lessons: [
        lesson('shoot', '[SHOOT:attack] THE DUMMY. YOUR BULLETS NEVER RUN OUT.', (t) =>
          t.dummyHits.has('shot'),
        ),
        lesson(
          'aim',
          'AIM IN 8 WAYS: HOLD UP, OR UP AND A DIRECTION. [SHOOT:attack] 3 WAYS.',
          (t) => t.shotDirs.size >= 3 && t.aimedDirs >= 2,
        ),
        lesson('prone', 'HOLD DOWN TO GO PRONE.', (t) => t.crouched),
        lesson('jump-shoot', '[JUMP:jump] AND [SHOOT:attack] IN THE AIR.', (t) => t.airShots > 0),
      ],
    },
    {
      id: 'guns',
      title: 'GUNS',
      room: 'practice',
      lessons: [
        // A chapter starts with the hero at the start, so the item lies to the right.
        itemLesson(
          'medal',
          'medal',
          'RUN RIGHT TO THE MEDAL: ONE MORE HIT. NOW YOU CAN TAKE 4.',
          (t) => (t.now.maxHp ?? 0) >= BILL_MEDAL_HITS,
        ),
        itemLesson('mg', 'machine-gun', 'GRAB THE MACHINE GUN. HOLD [SHOOT:attack] TO KEEP FIRING.', (t) =>
          t.shotKinds.has('mg'),
        ),
        itemLesson('laser', 'laser', 'GRAB THE LASER. [SHOOT:attack]: ONE BEAM THAT PIERCES.', (t) =>
          t.shotKinds.has('laser'),
        ),
        itemLesson(
          'flame-gun',
          'flame-gun',
          'GRAB THE FLAME GUN. [SHOOT:attack]: A SLOW, HEAVY FIREBALL.',
          (t) => t.shotKinds.has('flame-gun'),
        ),
        itemLesson('spread', 'spread-gun', 'GRAB THE SPREAD GUN. [SHOOT:attack]: FIVE SHOTS IN A FAN.', (t) =>
          t.shotKinds.has('spread'),
        ),
      ],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        lesson(
          'swim-shoot',
          '[SWIM:jump] STROKES UP. [SHOOT:attack] WHILE YOU SWIM!',
          (t) => t.swimShots > 0,
        ),
      ],
    },
  ],
};
