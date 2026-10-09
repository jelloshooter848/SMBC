import type { World } from '../../world/world';
import { MAX_HP, ninpoMax } from '../../characters/ryu';
import type { Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { TrainingTarget } from '../targets';
import { alive, blocksSince, hitsSince, onTop } from './common';
import source from '../../../content/levels/training/ryu.map?raw';

/*
 * Ryu's training stage (0.4.38, the owner's design section 8), in the Ninja Gaiden city-street look
 * (src/content/levels/training/ryu.map). He starts with the Dragon Sword, wall cling and a 10-point
 * bar, then takes the Medicine (his grow item) and each art and the Ninpo Scroll from a block in
 * the order his kit builds up (docs/POWERUPS.md 6.2). His ninpo bar shows once he has an art, and
 * is full again whenever an art's lesson comes up, so it never runs dry.
 */

/** The set pieces' columns (ryu.map). */
export const RYU_STAGE = {
  enemy: 13,
  slashGate: 16,
  /** The shaft: its hanging left wall, its floor between, and the tall block's roof. */
  leftWall: { from: 19, to: 20, bottom: 8 },
  shaft: { from: 21, to: 23 },
  roof: { from: 24, to: 29, top: 4 },
  medicineBlock: { x: 34, y: 9 },
  starBlock: { x: 38, y: 9 },
  starTarget: 44,
  starGate: 47,
  scrollBlock: { x: 50, y: 9 },
  windmillBlock: { x: 53, y: 9 },
  windmillTargets: [58, 60],
  windmillGate: 63,
  wheelBlock: { x: 66, y: 9 },
  shooter: 74,
  wheelGate: 78,
  spinBlock: { x: 81, y: 9 },
  pipe: 90,
  spinGate: 95,
  flag: 100,
} as const;
const S = RYU_STAGE;

/** The ninpo bar after the scroll (40, and 20 more). */
export const RYU_SCROLL_NINPO = 60;
/** Frames a cling must last to count (a real hold on the wall, not a brush past it). */
export const CLING_FRAMES = 10;

/** Ninpo full for an art's lesson (and again at each put-back). */
const fillNinpo = (w: World): void => {
  for (const p of w.players) p.scratch.ninpo = ninpoMax(p);
};

/** Per world: frames clinging in a row, and whether a cling lasted CLING_FRAMES. */
const clings = new WeakMap<World, { frames: number; held: boolean }>();

/** He held on to a wall for CLING_FRAMES. */
function clung(w: World): boolean {
  let c = clings.get(w);
  if (!c) clings.set(w, (c = { frames: 0, held: false }));
  c.frames = w.players.some((p) => alive(p) && p.clinging) ? c.frames + 1 : 0;
  if (c.frames >= CLING_FRAMES) c.held = true;
  return c.held;
}

export const RYU_LESSONS: readonly Lesson[] = [
  {
    id: 'slash',
    at: 2,
    row: 11,
    text: '[SLASH:attack] THE ENEMY WITH YOUR SWORD.',
    retry: 'SLASH THE ENEMY TO OPEN THE WAY. HERE IT COMES AGAIN!',
    done: (w) =>
      hitsSince(w, (h) => !h.shot && h.reaction === 'kill' && !(h.target instanceof TrainingTarget)).length >
      0,
  },
  {
    id: 'cling',
    at: 17,
    row: 11,
    text: '[JUMP:jump] AT A WALL OF THE SHAFT AND HOLD TOWARD IT: RYU CLINGS ON.',
    done: clung,
  },
  {
    id: 'wall-jump',
    at: 21,
    row: 11,
    text: 'WHILE CLINGING, [JUMP:jump] TO KICK OFF. KICK FROM WALL TO WALL UP TO THE ROOF.',
    done: (w) => onTop(w, S.roof.top, S.roof.from, S.roof.to),
  },
  {
    id: 'medicine',
    at: 31,
    row: 11,
    item: 'medicine',
    block: S.medicineBlock,
    get: 'JUMP INTO THE ? BLOCK, THEN TAKE WHAT COMES OUT.',
    text: 'YOUR HEALTH BAR GROWS TO 16, AND FILLS.',
    done: (w) => (w.player.scratch.maxHp ?? 0) >= MAX_HP,
  },
  {
    id: 'throwing-star',
    at: 36,
    row: 11,
    item: 'throwing-star',
    block: S.starBlock,
    enter: fillNinpo,
    get: 'ANOTHER ? BLOCK!',
    text: '[CAST:special:SHURIKEN] THROWS IT AT THE TARGET. IT COSTS NINPO: THE BLUE BAR.',
    touchText: 'TAP [SHURIKEN:special:SHURIKEN] AT THE TARGET. IT COSTS NINPO: THE BLUE BAR.',
    retry: 'FACE THE TARGET AND SEND A THROWING STAR AT IT.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'throwing-star' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'ninpo-scroll',
    at: 48,
    row: 11,
    item: 'ninpo-scroll',
    block: S.scrollBlock,
    get: 'JUMP INTO THE ? BLOCK.',
    text: 'THE BLUE BAR GROWS LONGER, AND FILLS.',
    done: (w) => ninpoMax(w.player) >= RYU_SCROLL_NINPO,
  },
  {
    id: 'windmill',
    at: 51,
    row: 11,
    item: 'windmill',
    block: S.windmillBlock,
    enter: fillNinpo,
    get: 'ANOTHER ? BLOCK!',
    text: '[NINPO:select] TO IT. HIT BOTH: IT CUTS THROUGH!',
    touchText: 'TAP [NINPO:select] TILL IT READS WINDMILL. [WINDMILL:special:WINDMILL]: HIT BOTH TARGETS!',
    retry: 'PICK THE WINDMILL STAR WITH [NINPO:select]: IT CUTS THROUGH BOTH TARGETS.',
    done: (w) => {
      const hit = new Set(hitsSince(w, (h) => h.shotKind === 'windmill').map((h) => h.target));
      return [...hit].filter((t) => t instanceof TrainingTarget).length >= 2;
    },
  },
  {
    id: 'fire-wheel',
    at: 64,
    row: 11,
    item: 'fire-wheel',
    block: S.wheelBlock,
    enter: fillNinpo,
    get: 'A ? BLOCK!',
    text: 'FLAMES STOP SHOTS. [NINPO:select] TO IT, WALK AT THE SHOOTER.',
    touchText: 'TAP [NINPO:select] TILL IT READS WHEEL. TAP [WHEEL:special:WHEEL], WALK AT THE SHOOTER.',
    retry: 'PICK THE FIRE WHEEL WITH [NINPO:select] AND WALK AT THE SHOOTER: ITS FLAMES STOP SHOTS.',
    done: (w) => blocksSince(w).swats > 0,
  },
  {
    id: 'jump-slash',
    at: 79,
    row: 11,
    item: 'jump-slash',
    block: S.spinBlock,
    enter: fillNinpo,
    get: 'THE LAST ? BLOCK!',
    text: '[NINPO:select] TO IT. SOMERSAULT INTO THE ENEMY!',
    touchText: 'TAP [NINPO:select] TILL IT READS SPIN. TAP [SPIN:special:SPIN] AS THE ENEMY COMES.',
    retry: 'PICK JUMP AND SLASH WITH [NINPO:select] AND SPIN AS THE ENEMY REACHES YOU.',
    done: (w) => hitsSince(w, (h) => h.spin && !(h.target instanceof TrainingTarget)).length > 0,
  },
  {
    id: 'flag',
    at: 96,
    row: 11,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate is the whole height of the screen over the ground: his kicks can't climb over one. */
const gate = (col: number, after: string): TutorialGate => ({ col, top: 0, bottom: 11, after });

export const RYU_GATES: readonly TutorialGate[] = [
  gate(S.slashGate, 'slash'),
  gate(S.starGate, 'throwing-star'),
  gate(S.windmillGate, 'windmill'),
  gate(S.wheelGate, 'fire-wheel'),
  gate(S.spinGate, 'jump-slash'),
];

export const RYU_STAGE_DEF: HeroStage = {
  hero: 'ryu',
  source,
  greeting: [
    "RYU! THE KINGDOM'S ? BLOCKS HOLD YOUR NINPO ARTS. LET'S FIND THEM ALL.",
    'FOLLOW THE TIPS UP TOP!',
  ],
  tutorial: {
    level: 'training-ryu',
    hero: 'ryu',
    lessons: RYU_LESSONS,
    gates: RYU_GATES,
    // Clear of his health and ninpo bars at the left edge (hud.ts, x 7-23).
    boxLeft: 26,
  },
};
