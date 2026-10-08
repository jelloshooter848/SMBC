import { givePower, type HeroTraining } from './common';

/* Luigi's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

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

export const LUIGI_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'moves',
      title: 'MOVES',
      room: 'practice',
      lessons: [
        {
          id: 'high-jump',
          prompt: "HOLD [JUMP:jump] FOR LUIGI'S HIGH JUMP. REACH THE HIGH LEDGE FROM THE STEP!",
          done: (t) => t.maxJumpHeight >= LUIGI_HIGH_JUMP_PX || t.highestStand <= t.room.ledgeTop,
        },
        {
          id: 'slippery-stop',
          prompt: 'HOLD RIGHT AND [RUN:attack], LET GO BEFORE THE GAP AND WATCH LUIGI SLIDE!',
          touchPrompt: 'PUSH THE D-PAD FAR RIGHT OR HOLD [RUN:attack] TO RUN. LET GO BEFORE THE GAP!',
          done: (t) => t.maxRunCoast >= LUIGI_COAST_PX || t.maxRunGlide >= LUIGI_SLIDE_PX,
        },
      ],
    },
    {
      id: 'fire',
      title: 'FIRE',
      room: 'practice',
      lessons: [
        {
          id: 'fireball',
          prompt: 'FIRE POWER! [FIRE:attack] THROWS A FIREBALL. HIT THE DUMMY WITH ONE.',
          unlocked: (run) => run.power === 'fire',
          setup: (room) => givePower(room, 'fire'),
          done: (t) => t.dummyHits.has('fireball'),
        },
      ],
    },
  ],
};
