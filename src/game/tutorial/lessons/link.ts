import { type HeroTraining, itemLesson, lesson, setKit, SWIM_UP_PX } from './common';

/*
 * Link's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * He starts with his basic kit (sword, shield, the thrusts and the Boomerang on his belt), then
 * grabs each of his items in the order his kit builds up (docs/POWERUPS.md 5.2): the Heart
 * Container, the Bomb Bag, the Shield and Jump spells, the Blue Ring, the Fire spell and the
 * Magical Sword. Touch prompts name the belt button as it reads (BOOMERANG, BOMB, HI-JUMP...).
 */

export const LINK_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'sword',
      title: 'SWORD',
      room: 'practice',
      lessons: [
        lesson('sword', 'SWING YOUR [SWORD:attack] AT THE DUMMY.', (t) => t.dummyHits.has('sword')),
        lesson('down-thrust', '[JUMP:jump] OVER THE DUMMY AND HOLD DOWN FOR A DOWN-THRUST.', (t) =>
          t.dummyHits.has('down-thrust'),
        ),
        lesson('up-thrust', '[JUMP:jump] UNDER THE BRICKS AND HOLD UP FOR AN UP-THRUST.', (t) =>
          t.seen.has('upThrust'),
        ),
        lesson(
          'shield',
          'STAND STILL A FEW STEPS FROM THE DUMMY, FACING IT: YOUR SHIELD BLOCKS.',
          (t) => t.blocked > 0,
          {
            setup(room) {
              room.dummyShoots = true;
            },
          },
        ),
      ],
    },
    {
      id: 'tools',
      title: 'TOOLS',
      room: 'gear',
      lessons: [
        lesson(
          'boomerang',
          '[USE TOOL:special:BOOMERANG] THROWS THE BOOMERANG. [TOOLS:select] PICKS ANOTHER TOOL.',
          (t) => t.shotKinds.has('boomerang'),
          // On touch the button itself reads BOOMERANG.
          { touchPrompt: 'TAP [USE TOOL:special:BOOMERANG] TO THROW IT: IT COMES BACK!' },
        ),
        // The grow item: the HUD's hearts grow by one, all filled.
        itemLesson(
          'heart-container',
          'heart-container',
          'GRAB THE HEART CONTAINER: ONE MORE HEART SHOWS UP, AND ALL ARE FILLED.',
          (t) => (t.now.maxHp ?? 0) > 6,
        ),
        itemLesson(
          'bomb',
          'bomb-bag',
          'BOMB BAG! [TOOLS:select] TO THE BOMB. [USE TOOL:special:BOMB] SETS IT BY THE DUMMY. STEP BACK!',
          (t) => t.bombs > 0 && t.dummyHits.has('bomb'),
        ),
      ],
    },
    {
      id: 'magic',
      title: 'MAGIC',
      room: 'practice',
      lessons: [
        itemLesson(
          'shield-spell',
          'shield-spell',
          'SHIELD SPELL! [TOOLS:select] TO IT. [USE TOOL:special:SHIELD]: HALF DAMAGE FOR A WHILE.',
          (t) => t.toolUses.has('shield'),
        ),
        itemLesson(
          'jump-spell',
          'jump-spell',
          '[TOOLS:select] TO THE JUMP SPELL. [USE TOOL:special:HI-JUMP], THEN JUMP TO THE HIGH LEDGE!',
          (t) => t.toolUses.has('jump') && t.highestStand <= t.room.ledgeTop,
        ),
        // A hit on his back with the ring on glances off (halfHit); the shield, facing a shot,
        // takes it instead, and a Shield spell still running from before is put out first.
        itemLesson(
          'blue-ring',
          'blue-ring',
          'BLUE RING: EVERY OTHER HIT GLANCES OFF. LET A SHOT PAST YOUR SHIELD!',
          (t) => (t.now.tunic ?? 0) > 0 && t.seen.has('halfHit'),
          {
            setup(room) {
              room.dummyShoots = true;
              setKit({ halfHit: 0, shieldSpell: 0 })(room);
            },
          },
        ),
        itemLesson(
          'fire-spell',
          'fire-spell',
          '[TOOLS:select] TO THE FIRE SPELL. [USE TOOL:special:FIRE]: YOUR NEXT [SWORD:attack] FIRES A BEAM!',
          (t) => t.toolUses.has('fire') && t.dummyHits.has('sword-beam'),
        ),
        // With full hearts (the room keeps them full) every swing fires a beam: no spell needed.
        itemLesson(
          'magical-sword',
          'magical-sword',
          'MAGICAL SWORD: WITH FULL HEARTS YOUR [SWORD:attack] FIRES A BEAM. HIT THE DUMMY!',
          (t) => t.dummyHits.has('sword-beam'),
          // A Fire spell cast and not swung yet would fire the beam by itself.
          { setup: setKit({ fireSpell: 0 }) },
        ),
      ],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        lesson(
          'swim',
          'IN WATER [SWIM:jump] STROKES UP. SWIM UP ABOVE THE DUMMY!',
          (t) => t.topReached <= t.room.floorTop - SWIM_UP_PX,
        ),
      ],
    },
  ],
};
