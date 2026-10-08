import { type HeroTraining, itemLesson, lesson } from './common';

/*
 * Sophia III's training (docs/HEROES.md): the chapters of lessons, in the order the room plays
 * them. She starts from her basic kit (Normal: the cannon, driving, Jason on foot) and finds her
 * items in the order the campaign places them (docs/POWERUPS.md 6.2): the Power Capsule (Hyper and
 * the hover) first, then the Crusher, the Triple Missile, Wall Climb, Ceiling Climb (each climb
 * its own item, decision 10) and the Homing Missile.
 */

export const SOPHIA_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'drive',
      title: 'DRIVE',
      room: 'practice',
      lessons: [
        lesson(
          'drive-jump',
          'DRIVE RIGHT AND [JUMP:jump] THE GAP. HOLD JUMP TO GO HIGHER.',
          (t) => t.gapCrossings > 0,
        ),
        lesson('cannon', "[SHOOT:attack] THE DUMMY WITH SOPHIA'S CANNON.", (t) =>
          t.dummyHits.has('sophia-cannon'),
        ),
        lesson(
          'cannon-up',
          'HOLD UP AND [SHOOT:attack]: THE CANNON FIRES STRAIGHT UP.',
          (t) => t.shotsUp > 0,
        ),
        // Out and back in: the next lessons are the tank's.
        lesson(
          'jason',
          '[EXIT:select] AND JASON HOPS OUT ON FOOT. UP BY THE TANK GETS HIM BACK IN.',
          (t) => t.seen.has('_jason') && !t.now._jason,
        ),
      ],
    },
    {
      id: 'power',
      title: 'POWER-UPS',
      room: 'practice',
      lessons: [
        itemLesson(
          'hover',
          'power-capsule',
          'GRAB THE POWER CAPSULE: HYPER! [JUMP:jump], THEN HOLD JUMP IN THE AIR TO HOVER.',
          (t) => t.seen.has('_hover'),
        ),
        // The Crusher's shot does 3: the dummy pops at once.
        itemLesson(
          'crusher',
          'crusher',
          'GRAB THE CRUSHER, AND [SHOOT:attack] THE DUMMY WITH ITS BIG CANNON.',
          (t) => t.dummyHits.has('sophia-cannon'),
        ),
        itemLesson(
          'missile',
          'triple-missile',
          'GRAB THE TRIPLE MISSILE. [MISSILE:special] FIRES THREE. THEY FLY THROUGH WALLS.',
          (t) => t.shotKinds.has('sophia-missile'),
        ),
        itemLesson(
          'wall-climb',
          'wall-climb',
          'GRAB WALL CLIMB. HOLD UP AND DRIVE INTO THE TALL WALL TO CLIMB IT.',
          (t) => t.seen.has('_wall'),
        ),
      ],
    },
    {
      // A fresh room: off the wall and back at the start.
      id: 'more',
      title: 'MORE POWER-UPS',
      room: 'practice',
      lessons: [
        itemLesson(
          'ceiling-climb',
          'ceiling-climb',
          'GRAB CEILING CLIMB. [JUMP:jump] UP INTO THE BRICKS TO DRIVE ALONG UNDER THEM.',
          (t) => t.seen.has('_ceiling'),
        ),
        itemLesson(
          'homing',
          'homing-missile',
          'GRAB THE HOMING MISSILE. HOLD DOWN AND [MISSILE:special] TO SWITCH, THEN FIRE ONE!',
          (t) => t.shotKinds.has('sophia-homing'),
        ),
      ],
    },
  ],
};
