import { tileToSub } from '@engine/math/units';
import type { World } from '../../world/world';
import { T } from '../../level/tiles';
import { CannonShot } from '../../characters/sophia/weapons';
import { CEIL, sophiaState } from '../../characters/sophia/state';
import { HOMING_START, TRIPLE_START } from '../../characters/sophia/profile';
import type { Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { TrainingTarget } from '../targets';
import { alive, hitsSince, landedPast, onTop } from './common';
import source from '../../../content/levels/training/sophia.map?raw';

/*
 * Sophia III's training stage (0.4.38, the owner's design section 10), in the Blaster Master
 * Underworld forest look (src/content/levels/training/sophia.map). She starts Normal, with the
 * cannon, the nose-first drop and Jason on foot, then takes the Power Capsule (her grow item: Hyper
 * and the hover) and each item from a block in the order her kit builds up (docs/POWERUPS.md 6.2).
 * A hit at Hyper or better takes her hull and climbs; the kit floor gives them back at the next
 * put-back. Her gates reach the top of the screen: a hover clears anything lower.
 */

/** The set pieces' columns (sophia.map). */
export const SOPHIA_STAGE = {
  plateau: { from: 9, to: 20, top: 9 },
  brickWall: { x: 16, brick: 8 },
  upTarget: 19,
  upGate: 21,
  bridge: { from: 21, to: 40, top: 9 },
  hole: 36,
  pit: { x: 47, coins: [12, 13] },
  jasonGate: 50,
  capsuleBlock: { x: 55, y: 9 },
  ditch: { from: 60, to: 67 },
  farBank: { from: 68, to: 71, top: 9 },
  crusherBlock: { x: 76, y: 9 },
  toughTarget: 83,
  crusherGate: 85,
  missileBlock: { x: 88, y: 9 },
  box: { from: 95, to: 98 },
  missileGate: 100,
  wallBlock: { x: 103, y: 9 },
  wall: { from: 108, to: 111, top: 1 },
  ceilingBlock: { x: 116, y: 9 },
  roof: { from: 120, to: 135, row: 8 },
  roofDitch: { from: 122, to: 133 },
  ceilingGate: 137,
  homingBlock: { x: 140, y: 9 },
  ledge: { from: 145, to: 147, top: 7 },
  homingGate: 151,
  flag: 158,
} as const;
const S = SOPHIA_STAGE;

/**
 * Missiles for a missile's lesson once she has it (at least what the item gives), again at each
 * put-back: three volleys spent missing the target never strand her at the gate.
 */
const fillMissiles = (w: World): void => {
  for (const p of w.players) {
    if (p.scratch.hasTriple) p.scratch.triple = Math.max(p.scratch.triple ?? 0, TRIPLE_START);
    if (p.scratch.hasHoming) p.scratch.homing = Math.max(p.scratch.homing ?? 0, HOMING_START);
  }
};

/** She stands on the floor of the passage under the bridge, past its narrow hole. */
const inPassage = (w: World): boolean =>
  w.players.some(
    (p) =>
      alive(p) &&
      p.body.onGround &&
      p.body.y + p.body.h > tileToSub(S.bridge.top + 1) &&
      p.body.x >= tileToSub(S.hole),
  );

/** Jason took the pit's coins and is back in the tank. */
const coinsFetched = (w: World): boolean =>
  S.pit.coins.every((row) => w.map.get(S.pit.x, row) !== T.COIN) && sophiaState(w.player).jason === null;

/** She is driving along the roof, upside down, past the ditch under it. */
const roofDriven = (w: World): boolean =>
  w.players.some(
    (p) =>
      alive(p) && sophiaState(p).surface === CEIL && p.body.x >= tileToSub(S.roofDitch.to) - tileToSub(1),
  );

export const SOPHIA_LESSONS: readonly Lesson[] = [
  {
    id: 'drive-jump',
    at: 2,
    row: 11,
    text: 'DRIVE RIGHT. HOLD [JUMP:jump] LONGER TO JUMP UP ONTO THE LEDGE.',
    done: (w) => onTop(w, S.plateau.top, S.plateau.from, S.plateau.to),
  },
  {
    id: 'cannon',
    at: 10,
    row: 8,
    text: '[SHOOT:attack] THE BRICK WALL: TWO SHOTS BREAK A BRICK.',
    done: (w) => landedPast(w, S.brickWall.x + 1),
  },
  {
    id: 'cannon-up',
    at: 17,
    row: 8,
    text: 'HOLD UP AND [SHOOT:attack] THE TARGET ABOVE.',
    retry: 'STAND UNDER THE TARGET AND HOLD UP: THE CANNON TURNS UP. THEN SHOOT.',
    done: (w) => hitsSince(w, (h) => h.up && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'nose-drop',
    at: 22,
    row: 8,
    text: 'HOLD DOWN AS YOU DRIVE OVER THE NARROW HOLE: SOPHIA DIPS IN NOSE FIRST.',
    done: inPassage,
  },
  {
    id: 'jason',
    at: 38,
    row: 11,
    text: '[EXIT:select]: JASON HOPS OUT. FETCH THE COINS, THEN UP AT THE TANK.',
    retry: 'PRESS [EXIT:select] TO SEND JASON DOWN THE PIT FOR THE COINS. UP BY THE TANK GETS HIM IN.',
    done: coinsFetched,
  },
  {
    id: 'power-capsule',
    at: 51,
    row: 11,
    item: 'power-capsule',
    block: S.capsuleBlock,
    get: 'JUMP INTO THE ? BLOCK, THEN TAKE WHAT COMES OUT.',
    text: 'SOPHIA IS HYPER: A STRONGER CANNON, AND THE HOVER.',
    done: (w) => w.player.powerState !== 'small',
  },
  {
    id: 'hover',
    at: 56,
    row: 11,
    text: 'PRESS [JUMP:jump] AGAIN IN THE AIR AND HOLD IT TO HOVER ACROSS THE DITCH.',
    done: (w) => onTop(w, S.farBank.top, S.farBank.from, S.farBank.to) || landedPast(w, S.farBank.to + 1),
  },
  {
    id: 'crusher',
    at: 73,
    row: 11,
    item: 'crusher',
    block: S.crusherBlock,
    get: 'ANOTHER ? BLOCK!',
    text: 'ITS CANNON HITS HARDER: ONE SHOT FOR THE TOUGH TARGET.',
    retry: 'THE CRUSHER KNOCKS THE TOUGH TARGET DOWN IN ONE SHOT.',
    done: (w) =>
      hitsSince(
        w,
        (h) =>
          h.reaction === 'kill' &&
          h.target instanceof TrainingTarget &&
          h.shot instanceof CannonShot &&
          h.shot.level === 2,
      ).length > 0,
  },
  {
    id: 'triple-missile',
    at: 86,
    row: 11,
    item: 'triple-missile',
    block: S.missileBlock,
    enter: fillMissiles,
    get: 'A ? BLOCK!',
    text: '[MISSILE:special:MISSILE] FIRES THREE, THROUGH WALLS: HIT THE TARGET.',
    retry: 'FIRE A MISSILE AT THE BOX: IT FLIES THROUGH THE WALL TO THE TARGET.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'sophia-missile' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'wall-climb',
    at: 101,
    row: 11,
    item: 'wall-climb',
    block: S.wallBlock,
    get: 'A ? BLOCK!',
    text: 'DRIVE INTO THE TALL WALL TO DRIVE UP IT.',
    done: (w) => onTop(w, S.wall.top, S.wall.from, S.wall.to) || landedPast(w, S.wall.to + 1),
  },
  {
    id: 'ceiling-climb',
    at: 113,
    row: 11,
    item: 'ceiling-climb',
    block: S.ceilingBlock,
    get: 'ANOTHER ? BLOCK!',
    text: '[JUMP:jump] UP INTO THE ROOF, THEN DRIVE UNDER IT OVER THE DITCH.',
    retry: 'JUMP UP INTO THE ROOF: SOPHIA HOLDS ON. DRIVE ALONG UNDER IT TO THE FAR SIDE.',
    done: roofDriven,
  },
  {
    id: 'homing-missile',
    at: 138,
    row: 11,
    item: 'homing-missile',
    block: S.homingBlock,
    enter: fillMissiles,
    // With Ceiling Climb a jump into a block grips it: the cannon opens this one.
    get: 'THE LAST ? BLOCK: STAND UNDER IT, HOLD UP AND [SHOOT:attack] IT OPEN.',
    text: 'HOLD DOWN AND PRESS [MISSILE:special] TO SWITCH TO HOMING. IT SEEKS!',
    touchText: 'HOLD DOWN, TAP [MISSILE:special:MISSILE] TILL IT READS HOMING. FIRE: IT SEEKS!',
    retry: 'SWITCH TO THE HOMING MISSILE AND FIRE: IT FINDS THE TARGET UP ON THE LEDGE.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'sophia-homing' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'flag',
    at: 152,
    row: 11,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate reaches the top of the screen: her hover clears anything lower. */
const gate = (col: number, after: string, bottom = 11): TutorialGate => ({ col, top: 0, bottom, after });

export const SOPHIA_GATES: readonly TutorialGate[] = [
  gate(S.upGate, 'cannon-up', S.bridge.top - 1),
  // In the passage, under the bridge's roof.
  { col: S.jasonGate, top: S.bridge.top + 1, bottom: 11, after: 'jason' },
  gate(S.crusherGate, 'crusher'),
  gate(S.missileGate, 'triple-missile'),
  // A hover crosses the ditch under the roof: the gate holds until she drove along the roof.
  gate(S.ceilingGate, 'ceiling-climb'),
  gate(S.homingGate, 'homing-missile'),
];

export const SOPHIA_STAGE_DEF: HeroStage = {
  hero: 'sophia',
  source,
  greeting: [
    "SOPHIA III! YOUR UPGRADES ARE HIDDEN IN THE KINGDOM'S ? BLOCKS. LET'S FIND THEM ALL.",
    'FOLLOW THE TIPS UP TOP!',
  ],
  tutorial: {
    level: 'training-sophia',
    hero: 'sophia',
    lessons: SOPHIA_LESSONS,
    gates: SOPHIA_GATES,
  },
};
