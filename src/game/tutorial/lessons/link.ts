import { type HeroTraining, legacyLesson, setKit, SWIM_UP_PX } from './common';

/* Link's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

export const LINK_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'sword',
      title: 'SWORD',
      room: 'practice',
      lessons: [
        legacyLesson('sword', 'SWING YOUR [SWORD:attack] AT THE DUMMY.', (t) => t.dummyHits.has('sword')),
        legacyLesson('down-thrust', '[JUMP:jump] OVER THE DUMMY AND HOLD DOWN FOR A DOWN-THRUST.', (t) =>
          t.dummyHits.has('down-thrust'),
        ),
        legacyLesson('up-thrust', '[JUMP:jump] UNDER THE BRICKS AND HOLD UP FOR AN UP-THRUST.', (t) =>
          t.seen.has('upThrust'),
        ),
        legacyLesson(
          'shield',
          'STAND STILL A FEW STEPS FROM THE DUMMY, FACING IT: YOUR SHIELD BLOCKS.',
          (t) => t.blocked > 0,
          undefined,
          (room) => {
            room.dummyShoots = true;
          },
        ),
      ],
    },
    {
      id: 'tools',
      title: 'TOOLS',
      room: 'gear',
      lessons: [
        legacyLesson(
          'boomerang',
          '[USE TOOL:special] THROWS THE BOOMERANG. [TOOLS:select] PICKS ANOTHER TOOL.',
          (t) => t.shotKinds.has('boomerang'),
        ),
        legacyLesson(
          'bomb',
          '[TOOLS:select] TO THE BOMB. [USE TOOL:special] SETS IT DOWN BY THE DUMMY. STEP BACK!',
          (t) => t.bombs > 0 && t.dummyHits.has('bomb'),
        ),
      ],
    },
    {
      id: 'magic',
      title: 'MAGIC',
      room: 'practice',
      lessons: [
        legacyLesson(
          'jump-spell',
          '[TOOLS:select] TO THE JUMP SPELL. [USE TOOL:special], THEN JUMP TO THE HIGH LEDGE!',
          (t) => t.toolUses.has('jump') && t.highestStand <= t.room.ledgeTop,
        ),
        legacyLesson(
          'shield-spell',
          '[TOOLS:select] TO THE SHIELD SPELL. [USE TOOL:special]: HALF DAMAGE FOR A WHILE.',
          (t) => t.toolUses.has('shield'),
        ),
        legacyLesson(
          'fire-spell',
          '[TOOLS:select] TO THE FIRE SPELL. [USE TOOL:special]: YOUR NEXT [SWORD:attack] FIRES A BEAM!',
          (t) => t.toolUses.has('fire') && t.dummyHits.has('sword-beam'),
          undefined,
          // Without the red tunic's beam: only the spell makes one.
          setKit({ beam: 0 }),
        ),
      ],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        legacyLesson(
          'swim',
          'IN WATER [SWIM:jump] STROKES UP. SWIM UP ABOVE THE DUMMY!',
          (t) => t.topReached <= t.room.floorTop - SWIM_UP_PX,
        ),
      ],
    },
  ],
};
