import { tileToSub } from '@engine/math/units';
import type { World } from '../../world/world';
import { lessonUpFrame, type Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { TrainingTarget } from '../targets';
import { alive, hitsSince, hurtsSince, landedPast } from './common';
import source from '../../../content/levels/training/samus.map?raw';

/*
 * Samus's training stage (0.4.37, the owner's design section 6), in the Brinstar look
 * (src/content/levels/training/samus.map). She starts with the short Power Beam, aiming up, the
 * Morph Ball and its bombs, then takes the Energy Tank (her grow item) and each beam, the
 * Missiles and the Varia Suit from a block in the order her kit builds up (docs/POWERUPS.md 5.4).
 */

/** The set pieces' columns (samus.map). */
export const SAMUS_STAGE = {
  enemy: 13,
  beamGate: 16,
  ceiling: { from: 18, to: 26, row: 6 },
  hanging: 22,
  upGate: 27,
  tunnel: { from: 30, to: 37 },
  step: { from: 35, top: 11 },
  tankBlock: { x: 43, y: 7 },
  longBlock: { x: 49, y: 7 },
  ditch: { from: 52, to: 54 },
  farTarget: 58,
  longGate: 60,
  missileBlock: { x: 63, y: 7 },
  wall: { x: 67, brick: 10 },
  iceBlock: { x: 73, y: 7 },
  icePipe: 79,
  iceGate: 82,
  variaBlock: { x: 85, y: 7 },
  variaPipe: 90,
  variaGate: 94,
  waveBlock: { x: 97, y: 7 },
  box: { from: 103, to: 106 },
  waveGate: 109,
  flag: 116,
} as const;
const S = SAMUS_STAGE;

/** Energy a hit costs: 8, and 4 in the Varia Suit (samus/index.ts). */
export const HIT_COST = 8;
export const VARIA_COST = 4;
/** A hit on the far target from this far (px) is a long-range hit: the short beam fizzles first. */
export const FAR_PX = 80;

/** Per world: missiles she had when the lesson came up (she fired one since if fewer now). */
const missileStock = new WeakMap<World, { from: number; count: number; fired: boolean }>();

/** She fired a missile since the lesson came up. */
function firedMissile(w: World): boolean {
  const from = lessonUpFrame(w);
  const now = w.player.scratch.missiles ?? 0;
  let m = missileStock.get(w);
  if (!m || m.from !== from) missileStock.set(w, (m = { from, count: now, fired: false }));
  if (now < m.count) m.fired = true;
  m.count = Math.max(m.count, now);
  return m.fired;
}

/** Frames the Varia hit's cost shows before its lesson is done. */
export const READ_FRAMES = 75;

/** Her hit since the Varia Suit was taken (its cost and frame), or null. */
function variaHit(w: World): { cost: number; frame: number } | null {
  if (!w.player.scratch.varia) return null;
  return hurtsSince(w).find((h) => h.cost > 0) ?? null;
}

export const SAMUS_LESSONS: readonly Lesson[] = [
  {
    id: 'beam',
    at: 2,
    row: 11,
    text: '[SHOOT:attack] THE ENEMY. YOUR BEAM IS SHORT, SO GET CLOSE.',
    retry: 'GET CLOSE AND SHOOT THE ENEMY: YOUR BEAM IS SHORT. HERE IT COMES AGAIN!',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'beam' && !(h.target instanceof TrainingTarget)).length > 0,
  },
  {
    id: 'aim-up',
    at: 17,
    row: 11,
    text: 'HOLD UP AND [SHOOT:attack] THE TARGET ON THE CEILING.',
    retry: 'STAND UNDER THE TARGET ON THE CEILING, HOLD UP AND SHOOT.',
    done: (w) => hitsSince(w, (h) => h.up && h.shotKind === 'beam').length > 0,
  },
  {
    id: 'morph-ball',
    at: 28,
    row: 11,
    text: 'PRESS DOWN TO CURL INTO THE MORPH BALL. ROLL THROUGH THE TUNNEL.',
    done: (w) => w.players.some((p) => alive(p) && p.body.x >= tileToSub(S.step.from - 1)),
  },
  {
    id: 'bomb-jump',
    at: 28,
    row: 11,
    text: 'IN THE BALL, [BOMB:attack] DROPS A BOMB. SIT ON IT TO BOUNCE UP THE STEP.',
    done: (w) => landedPast(w, S.step.from) && w.player.body.y + w.player.body.h <= tileToSub(S.step.top),
  },
  {
    id: 'energy-tank',
    at: 39,
    row: 10,
    item: 'energy-tank',
    get: 'PRESS UP TO STAND, THEN JUMP INTO THE ? BLOCK.',
    text: 'ITS BOX SHOWS ABOVE YOUR ENERGY.',
    done: (w) => (w.player.scratch.tanks ?? 0) > 0,
  },
  {
    id: 'long-beam',
    at: 45,
    row: 10,
    item: 'long-beam',
    get: 'ANOTHER ? BLOCK!',
    text: 'YOUR BEAM GOES ALL THE WAY. HIT THE TARGET ACROSS.',
    retry: 'SHOOT THE TARGET FROM THIS SIDE OF THE DITCH: THE LONG BEAM REACHES IT.',
    done: (w) => hitsSince(w, (h) => h.shotKind === 'beam' && h.dist >= FAR_PX).length > 0,
  },
  {
    id: 'missiles',
    at: 61,
    row: 10,
    item: 'missiles',
    get: 'A ? BLOCK BY THE WALL!',
    text: '[MISSILE:special:MISSILE] OPENS BRICKS: BLAST THE WALL, ROLL THROUGH.',
    done: (w) => firedMissile(w) && landedPast(w, S.wall.x + 1),
  },
  {
    id: 'ice-beam',
    at: 69,
    row: 10,
    item: 'ice-beam',
    get: 'ONE MORE ? BLOCK.',
    text: 'FREEZE, THEN SHATTER THE ENEMY. PICK IT WITH [WEAPON:select].',
    retry: 'PICK THE ICE BEAM WITH [WEAPON:select]: ONE SHOT FREEZES THE ENEMY, THE NEXT SHATTERS IT.',
    done: (w) => hitsSince(w, (h) => h.wasFrozen && h.reaction === 'kill').length > 0,
  },
  {
    id: 'varia-suit',
    at: 83,
    row: 10,
    item: 'varia-suit',
    get: 'ANOTHER ? BLOCK.',
    text: 'HITS COST HALF THE ENERGY. LET THE ENEMY TOUCH YOU.',
    retry: 'TAKE THE VARIA SUIT, THEN LET THE ENEMY TOUCH YOU: SEE THE ENERGY IT COSTS.',
    done: (w) => {
      const hit = variaHit(w);
      return !!hit && w.frame >= hit.frame + READ_FRAMES;
    },
    note2: (w) => {
      const hit = variaHit(w);
      return hit ? `-${hit.cost} EN (WAS -${HIT_COST})` : null;
    },
  },
  {
    id: 'wave-beam',
    at: 95,
    row: 10,
    item: 'wave-beam',
    get: 'THE LAST ? BLOCK!',
    text: 'THROUGH WALLS! [WEAPON:select] TO IT, HIT THE TARGET.',
    retry: 'PICK THE WAVE BEAM WITH [WEAPON:select]: IT SHOOTS THROUGH THE WALL TO THE TARGET.',
    done: (w) => hitsSince(w, (h) => h.wave && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'flag',
    at: 110,
    row: 10,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate stands the whole height of the screen over the ground. */
const gate = (col: number, after: string, bottom: number): TutorialGate => ({ col, top: 0, bottom, after });

export const SAMUS_GATES: readonly TutorialGate[] = [
  gate(S.beamGate, 'beam', 11),
  gate(S.upGate, 'aim-up', 11),
  gate(S.longGate, 'long-beam', 10),
  gate(S.iceGate, 'ice-beam', 10),
  gate(S.variaGate, 'varia-suit', 10),
  gate(S.waveGate, 'wave-beam', 10),
];

export const SAMUS_STAGE_DEF: HeroStage = {
  hero: 'samus',
  source,
  greeting: ["SAMUS! YOUR SUIT'S UPGRADES ARE HIDDEN IN THE KINGDOM'S ? BLOCKS.", 'FOLLOW THE TIPS UP TOP!'],
  tutorial: {
    level: 'training-samus',
    hero: 'samus',
    lessons: SAMUS_LESSONS,
    gates: SAMUS_GATES,
  },
};
