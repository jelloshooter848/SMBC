import { type HeroTraining, itemLesson, lesson, type PracticeRoom, type TrainingLesson } from './common';

/*
 * Luigi's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * He starts small, as in SMB, and finds SMB's own power-ups (standing still in the room): the
 * Super Mushroom, then the Fire Flower.
 */

/** Luigi's standing jump with JUMP held all the way clears this; a tap or Mario's does not. */
export const LUIGI_HIGH_JUMP_PX = 72;
/** Luigi glides at least this far after letting go from a run (Mario stops well short). */
export const LUIGI_COAST_PX = 48;
/**
 * A stop from a run that would carry Luigi this far on open floor also counts: further than
 * Mario's longest (about 64 px from full speed), so it still means "Luigi slides further". The
 * room is short: from a real run Luigi glides 100+ px, so a glide the gap cuts short counts by
 * where it was going (MoveStats.maxRunGlide).
 */
export const LUIGI_SLIDE_PX = 72;

/**
 * Grab the Super Mushroom, then break a brick: only a big Luigi can (the room's brick row). The
 * lesson's setup notes the room and its bricks broken so far (World.feats.bricks), so `done`
 * counts the bricks broken since.
 */
function mushroomLesson(): TrainingLesson {
  let room: PracticeRoom | null = null;
  let before = 0;
  return itemLesson(
    'mushroom',
    'mushroom',
    'GRAB THE MUSHROOM. SUPER LUIGI BREAKS BRICKS: [JUMP:jump] UP INTO ONE!',
    () => !!room && room.world.feats.bricks > before,
    {
      setup: (r) => {
        room = r;
        before = r.world.feats.bricks;
      },
    },
  );
}

export const LUIGI_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'moves',
      title: 'MOVES',
      room: 'practice',
      lessons: [
        lesson(
          'high-jump',
          "HOLD [JUMP:jump] FOR LUIGI'S HIGH JUMP. REACH THE HIGH LEDGE FROM THE STEP!",
          (t) => t.maxJumpHeight >= LUIGI_HIGH_JUMP_PX || t.highestStand <= t.room.ledgeTop,
        ),
        lesson(
          'slippery-stop',
          'HOLD RIGHT AND [RUN:attack], LET GO BEFORE THE GAP AND WATCH LUIGI SLIDE!',
          (t) => t.maxRunCoast >= LUIGI_COAST_PX || t.maxRunGlide >= LUIGI_SLIDE_PX,
          { touchPrompt: 'PUSH THE D-PAD FAR RIGHT OR HOLD [RUN:attack] TO RUN. LET GO BEFORE THE GAP!' },
        ),
      ],
    },
    {
      id: 'power',
      title: 'POWER-UPS',
      room: 'practice',
      lessons: [
        mushroomLesson(),
        itemLesson(
          'fireball',
          'fire-flower',
          'GRAB THE FIRE FLOWER. [FIRE:attack] THROWS A FIREBALL: HIT THE DUMMY WITH ONE.',
          (t) => t.dummyHits.has('fireball'),
        ),
      ],
    },
  ],
};
