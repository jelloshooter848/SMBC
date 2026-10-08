import { type HeroTraining, itemLesson, lesson } from './common';

/*
 * Ryu's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * He starts from his basic kit (the Dragon Sword, wall cling and wall jump, a 10-point health bar
 * and a 40-point ninpo meter) and finds his items in the order the campaign places them
 * (docs/POWERUPS.md 6.2): the Medicine first, then the Throwing Star, a Ninpo Scroll, the Windmill
 * Star, the Fire Wheel and Jump and Slash. Touch prompts name the art as CAST's button shows it
 * (SHURIKEN, WINDMILL, WHEEL, SPIN).
 */

/** The Medicine's health bar (characters/ryu MAX_HP; small Ryu has 10). */
export const RYU_BIG_HP = 16;
/** The ninpo meter before any scroll (characters/ryu START_NINPO). */
export const RYU_START_NINPO = 40;

export const RYU_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'sword',
      title: 'SWORD',
      room: 'practice',
      lessons: [
        lesson('slash', '[SLASH:attack] THE DUMMY WITH YOUR SWORD.', (t) => t.dummyHits.has('melee')),
        lesson('cling', '[JUMP:jump] AT THE TALL WALL AND HOLD TOWARD IT TO CLING.', (t) => t.clung),
        lesson('wall-jump', 'WHILE CLINGING, [JUMP:jump] TO KICK OFF THE WALL.', (t) => t.wallJumps > 0),
      ],
    },
    {
      id: 'ninpo',
      title: 'NINPO',
      room: 'practice',
      lessons: [
        // A chapter starts with the hero at the start, so the item lies to the right.
        itemLesson(
          'medicine',
          'medicine',
          'RUN RIGHT TO THE MEDICINE: YOUR HEALTH BAR GROWS FROM 10 TO 16.',
          (t) => (t.now.maxHp ?? 0) >= RYU_BIG_HP,
        ),
        itemLesson(
          'throwing-star',
          'throwing-star',
          'GRAB THE THROWING STAR. [CAST:special:SHURIKEN] THROWS IT. IT COSTS NINPO.',
          (t) => t.shotKinds.has('throwing-star'),
        ),
        itemLesson(
          'ninpo-scroll',
          'ninpo-scroll',
          'GRAB THE NINPO SCROLL: YOUR NINPO BAR GROWS BY 20, AND FILLS.',
          (t) => (t.now.ninpoMax ?? 0) > RYU_START_NINPO,
        ),
        itemLesson(
          'windmill',
          'windmill',
          'GRAB THE WINDMILL. [NINPO:select] TO IT. [CAST:special:WINDMILL]: IT CUTS AND RETURNS.',
          (t) => t.shotKinds.has('windmill'),
        ),
        itemLesson(
          'fire-wheel',
          'fire-wheel',
          'GRAB THE FIRE WHEEL. [NINPO:select] TO IT. [CAST:special:WHEEL]: FLAMES CIRCLE YOU.',
          (t) => t.shotKinds.has('fire-wheel'),
        ),
        itemLesson(
          'jump-slash',
          'jump-slash',
          'GRAB JUMP AND SLASH. [NINPO:select] TO IT. [CAST:special:SPIN]: A SOMERSAULT THAT CUTS.',
          (t) => t.seen.has('spin'),
        ),
      ],
    },
  ],
};
