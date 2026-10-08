import { givePower, type HeroTraining, k, legacyLesson } from './common';

/* Sophia III's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

export const SOPHIA_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'drive',
      title: 'DRIVE',
      room: 'practice',
      lessons: [
        legacyLesson(
          'drive-jump',
          'DRIVE RIGHT AND [JUMP:jump] THE GAP. HOLD JUMP TO GO HIGHER.',
          (t) => t.gapCrossings > 0,
        ),
        legacyLesson('cannon', "[SHOOT:attack] THE DUMMY WITH SOPHIA'S CANNON.", (t) =>
          t.dummyHits.has('sophia-cannon'),
        ),
        legacyLesson(
          'cannon-up',
          'HOLD UP AND [SHOOT:attack]: THE CANNON FIRES STRAIGHT UP.',
          (t) => t.shotsUp > 0,
        ),
      ],
    },
    {
      id: 'power',
      title: 'POWER-UPS',
      room: 'practice',
      lessons: [
        legacyLesson(
          'hover',
          'HYPER! [JUMP:jump], THEN HOLD JUMP AGAIN IN THE AIR TO HOVER.',
          (t) => t.seen.has('_hover'),
          (run) => run.power !== 'small',
          (room) => givePower(room, 'big', ['big', 'fire']),
        ),
        legacyLesson(
          'missile',
          '[MISSILE:special] FIRES THREE MISSILES. THEY FLY THROUGH WALLS.',
          (t) => t.shotKinds.has('sophia-missile'),
          (run) => k(run, 'hasTriple') > 0,
        ),
        legacyLesson(
          'homing',
          'HOLD DOWN AND [MISSILE:special] TO SWITCH TO HOMING. THEN FIRE ONE!',
          (t) => t.shotKinds.has('sophia-homing'),
          (run) => k(run, 'hasHoming') > 0,
        ),
        legacyLesson(
          'wall-climb',
          'CRUSHER! HOLD UP AND DRIVE INTO THE TALL WALL TO CLIMB IT.',
          (t) => t.seen.has('_wall'),
          (run) => run.power === 'fire',
          (room) => givePower(room, 'fire'),
        ),
      ],
    },
    {
      id: 'jason',
      title: 'JASON',
      room: 'practice',
      lessons: [
        legacyLesson(
          'jason',
          '[EXIT:select] AND JASON HOPS OUT ON FOOT. UP BY THE TANK GETS HIM BACK IN.',
          (t) => t.seen.has('_jason'),
        ),
      ],
    },
  ],
};
