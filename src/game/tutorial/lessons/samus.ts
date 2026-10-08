import { type HeroTraining, itemLesson, lesson, setKit } from './common';

/*
 * Samus's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * She starts with her basic kit (the short Power Beam, aiming up, the Morph Ball and its bombs),
 * then grabs the Energy Tank (her grow item), Missiles, then the beams and the suit in the order
 * her kit builds up (docs/POWERUPS.md 5.4). Ice and Wave are both kept: WEAPON picks each one.
 */

export const SAMUS_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'basics',
      title: 'BASICS',
      room: 'gear',
      lessons: [
        lesson('shoot', '[SHOOT:attack] THE DUMMY WITH YOUR BEAM.', (t) => t.dummyHits.has('beam')),
        // The grow item: a reserve tank, shown as a box over her energy.
        itemLesson(
          'energy-tank',
          'energy-tank',
          'GRAB THE ENERGY TANK. ITS BOX SHOWS UP ABOVE YOUR ENERGY.',
          (t) => (t.now.tanks ?? 0) > 0,
        ),
        lesson('aim-up', 'HOLD UP TO AIM STRAIGHT UP, AND [SHOOT:attack].', (t) => t.shotsUp > 0),
        lesson(
          'morph-ball',
          'PRESS DOWN TO ROLL INTO THE MORPH BALL. ROLL UNDER THE LOW WALL!',
          (t) => t.seen.has('ball') && t.tunnel,
        ),
        lesson('bomb', 'IN THE MORPH BALL, [BOMB:attack] DROPS A BOMB.', (t) => t.bombs > 0),
        lesson(
          'bomb-jump',
          'SIT ON A BOMB: ITS BLAST BOUNCES THE BALL UP. [BOMB:attack] FOR A BOMB JUMP!',
          (t) => t.ballJumps > 0,
        ),
      ],
    },
    {
      id: 'missiles',
      title: 'MISSILES',
      room: 'practice',
      lessons: [
        itemLesson(
          'missile',
          'missiles',
          'MISSILES! [MISSILE:special] FIRES ONE: THREE DAMAGE, AND IT OPENS BRICKS.',
          (t) => t.shotKinds.has('missile'),
        ),
        lesson(
          'missile-switch',
          '[WEAPON:select] SWITCHES THE CANNON TO MISSILES. THEN [SHOOT:attack:MISSILE].',
          (t) => t.shotTools.has('missile') && t.shotKinds.has('missile'),
        ),
      ],
    },
    {
      id: 'beams',
      title: 'BEAMS',
      room: 'gear',
      lessons: [
        // The beam selected again (missile-switch left the cannon on missiles, which fly far too).
        itemLesson(
          'long-beam',
          'long-beam',
          'LONG BEAM: FULL RANGE. GO TO THE FAR LEFT AND [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('far') && t.dummyHits.has('beam'),
          { setup: setKit({ tool: 0 }) },
        ),
        itemLesson(
          'ice-beam',
          'ice-beam',
          '[WEAPON:select] TO THE ICE BEAM: IT FREEZES WHAT IT HITS. [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('ice'),
        ),
        // The room keeps her energy full, so the hit counts as the tracker's `hurt`.
        itemLesson(
          'varia-suit',
          'varia-suit',
          'GRAB THE VARIA SUIT: HITS TAKE HALF THE ENERGY. LET THE DUMMY SHOOT YOU!',
          (t) => (t.now.varia ?? 0) > 0 && t.hurt > 0,
          { setup: (room) => void (room.dummyShoots = true) },
        ),
        itemLesson(
          'wave-beam',
          'wave-beam',
          '[WEAPON:select] TO THE WAVE BEAM: IT GOES THROUGH WALLS. [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('wave'),
        ),
      ],
    },
  ],
};
