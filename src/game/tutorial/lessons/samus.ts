import { type HeroTraining, k, legacyLesson, setKit } from './common';

/* Samus's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

export const SAMUS_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'beams',
      title: 'BEAMS',
      room: 'gear',
      lessons: [
        legacyLesson(
          'shoot',
          '[SHOOT:attack] THE DUMMY WITH YOUR BEAM.',
          (t) => t.dummyHits.has('beam'),
          undefined,
          setKit({ beam: 0 }),
        ),
        legacyLesson('aim-up', 'HOLD UP TO AIM STRAIGHT UP, AND [SHOOT:attack].', (t) => t.shotsUp > 0),
        legacyLesson(
          'long-beam',
          'LONG BEAM: FULL RANGE. GO TO THE FAR LEFT AND [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('far'),
          (run) => k(run, 'beam') >= 1,
          setKit({ beam: 1 }),
        ),
        legacyLesson(
          'ice-beam',
          'ICE BEAM: IT FREEZES WHAT IT HITS. [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('ice'),
          (run) => k(run, 'beam') >= 2,
          setKit({ beam: 2 }),
        ),
        legacyLesson(
          'wave-beam',
          'WAVE BEAM: IT GOES THROUGH WALLS. [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('wave'),
          (run) => k(run, 'beam') >= 3,
          setKit({ beam: 3 }),
        ),
      ],
    },
    {
      id: 'missiles',
      title: 'MISSILES',
      room: 'practice',
      lessons: [
        legacyLesson(
          'missile',
          '[MISSILE:special] FIRES A MISSILE: THREE DAMAGE, AND IT OPENS BRICKS.',
          (t) => t.shotKinds.has('missile'),
        ),
        legacyLesson(
          'missile-switch',
          '[WEAPON:select] SWITCHES THE CANNON TO MISSILES. THEN [SHOOT:attack].',
          (t) => t.shotTools.has('missile') && t.shotKinds.has('missile'),
        ),
      ],
    },
    {
      id: 'ball',
      title: 'MORPH BALL',
      room: 'gear',
      lessons: [
        legacyLesson(
          'morph-ball',
          'PRESS DOWN TO ROLL INTO THE MORPH BALL. ROLL UNDER THE LOW WALL!',
          (t) => t.seen.has('ball') && t.tunnel,
        ),
        legacyLesson('bomb', 'IN THE MORPH BALL, [BOMB:attack] DROPS A BOMB.', (t) => t.bombs > 0),
        legacyLesson(
          'bomb-jump',
          'SIT ON A BOMB: ITS BLAST BOUNCES THE BALL UP. [BOMB:attack] FOR A BOMB JUMP!',
          (t) => t.ballJumps > 0,
        ),
      ],
    },
  ],
};
