import { tileToSub } from '@engine/math/units';
import type { World } from '../../world/world';
import type { Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { SPRINT_FRAMES, sprintFrames, sprintMeter } from '../mario-1-0';
import { landedPast, onTop } from './common';
import source from '../../../content/levels/training/luigi.map?raw';

/*
 * Luigi's training stage (0.4.37, the owner's design section 3): only what is different from
 * Mario, in the Lost Levels' overworld look (src/content/levels/training/luigi.map). He starts
 * small at the bottom of a well whose tall side only his higher jump clears (on the move: his
 * jump from a dead stop is a pixel short of five blocks, and Mario's best from in there is a block
 * short); the long run fills the sprint bar a little later than Mario's (he takes longer to reach
 * top speed); letting go early, he slides onto the hard-block strip before a shallow ditch; his
 * floatier running jump clears the wide ditch to a higher bank (Mario's falls short, and its far
 * wall is too tall to climb out of); a note on the mushroom and the flower, with an optional ?
 * block, and the flagpole.
 */

/** The set pieces' columns and rows (luigi.map). */
export const LUIGI_STAGE = {
  /**
   * The well (columns 1-4, floor top row 14, its left wall column 0) and its tall side (5-8, top
   * row 9). Four blocks wide: room for the walk at the wall his jump needs.
   */
  well: { from: 1, to: 4, floor: 14 },
  tallSide: { from: 5, to: 8, top: 9 },
  /** The run starts here; its gate. */
  runFrom: 10,
  runGate: 31,
  /** The hard-block strip (top row 10), the shallow ditch after it and the slide's gate. */
  strip: { from: 32, to: 37, top: 10 },
  ditch: { from: 38, to: 40 },
  slideFrom: 14,
  slideGate: 42,
  /** The run-up and the wide ditch (columns 56-63) to the higher far bank (top row 8). */
  floatFrom: 43,
  wide: { from: 56, to: 63 },
  farBank: { from: 64, to: 75, top: 8 },
  block: { x: 70, y: 5 },
  flag: 84,
} as const;
const S = LUIGI_STAGE;

/** Per world: a glide on the ground with nothing held (its starting speed), and a rest on the strip. */
const slides = new WeakMap<World, { frame: number; from: number; rested: boolean }>();

/**
 * Luigi let go of a run and slid to a stop on the hard-block strip: a glide on the ground with no
 * direction held that began faster than walking speed and came to rest with him on the strip.
 */
function restedOnStrip(w: World): boolean {
  let s = slides.get(w);
  if (!s) slides.set(w, (s = { frame: -1, from: 0, rested: false }));
  if (s.frame === w.frame) return s.rested;
  s.frame = w.frame;
  const p = w.player;
  const b = p.body;
  if (p.dead || !b.onGround || p.heldDirX !== 0) {
    s.from = 0;
    return s.rested;
  }
  const v = Math.abs(b.vx);
  if (v > 0) {
    if (s.from === 0) s.from = v;
    return s.rested;
  }
  const fast = s.from > p.def.movement.maxWalk;
  s.from = 0;
  const on =
    b.y + b.h <= tileToSub(S.strip.top) &&
    b.x + b.w > tileToSub(S.strip.from) &&
    b.x < tileToSub(S.strip.to + 1);
  if (fast && on) s.rested = true;
  return s.rested;
}

export const LUIGI_LESSONS: readonly Lesson[] = [
  {
    id: 'high-jump',
    at: 1,
    row: 13,
    // A jump from against the wall falls a pixel short: he needs a walk at it from the back.
    text: 'LUIGI JUMPS HIGHER! FROM THE BACK, WALK AT THE WALL AND HOLD [JUMP:jump].',
    done: (w) => onTop(w, S.tallSide.top, S.tallSide.from, S.tallSide.to) || landedPast(w, S.tallSide.to + 1),
  },
  {
    id: 'run',
    at: S.runFrom,
    row: 9,
    text: 'HOLD [RUN:attack] TO RUN. LUIGI TAKES A FEW MORE STEPS TO TOP SPEED: FILL THE BAR!',
    touchText: 'PUSH THE D-PAD FAR TO THE SIDE TO RUN. LUIGI TAKES A FEW MORE STEPS TO TOP SPEED!',
    retry: 'THE WAY OPENS FOR A REAL RUN! HOLD [RUN:attack] AT TOP SPEED UNTIL THE BAR FILLS.',
    done: (w) => sprintFrames(w) >= SPRINT_FRAMES,
    meter: sprintMeter,
  },
  {
    id: 'slide',
    at: S.slideFrom,
    row: 9,
    text: 'RUN, THEN LET GO EARLY: LUIGI SLIDES! STOP ON THE HARD BLOCKS.',
    retry: 'LUIGI SLIDES FAR! RUN, LET GO WELL BEFORE THE HARD BLOCKS AND STOP ON THEM.',
    done: restedOnStrip,
  },
  {
    id: 'float',
    at: S.floatFrom,
    row: 9,
    text: 'HE FLOATS LONGER TOO! RUN, AND HOLD [JUMP:jump] FROM THE EDGE TO CLEAR THE DITCH.',
    done: (w) => onTop(w, S.farBank.top, S.farBank.from, S.farBank.to),
  },
  {
    id: 'power-ups',
    at: S.farBank.from + 1,
    row: 7,
    note: true,
    item: 'mushroom',
    block: S.block,
    get: 'MUSHROOMS AND FIRE FLOWERS WORK FOR LUIGI JUST AS FOR MARIO. ON TO THE FLAGPOLE!',
    text: 'BIG LUIGI TAKES A HIT AND BREAKS BRICKS. ON TO THE FLAGPOLE!',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate is six blocks and more over the ground (top row 10): even Luigi's best jump can't clear it. */
export const LUIGI_GATES: readonly TutorialGate[] = [
  { col: S.runGate, top: 3, bottom: 9, after: 'run' },
  { col: S.slideGate, top: 3, bottom: 9, after: 'slide' },
];

export const LUIGI_STAGE_DEF: HeroStage = {
  hero: 'luigi',
  source,
  greeting: [
    "LUIGI! YOU'RE FREE! LET'S SEE WHAT MAKES YOU DIFFERENT FROM YOUR BROTHER.",
    'FOLLOW THE TIPS UP TOP!',
  ],
  tutorial: {
    level: 'training-luigi',
    hero: 'luigi',
    lessons: LUIGI_LESSONS,
    gates: LUIGI_GATES,
  },
};
