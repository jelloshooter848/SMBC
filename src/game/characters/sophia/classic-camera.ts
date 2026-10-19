import { px } from '@engine/math/units';
import type { Player } from '../../entities/player';
import { sophiaState } from './state';

/*
 * Classic SMBC Sophia III's camera anchor (SO-39; Sophia.as:303-308, 835-846, 2503-2516). A corner
 * turn moves her box, and with it the x the camera leads from, in steps (the box turns on its
 * side at the turn's midpoint, and turns upright again after it). The original keeps the screen
 * from jumping with `screenScrollPosOffset`: the jump is held back, paid out evenly over the
 * turn's frames (`ssxInt`), and whatever is left afterwards decays by the scroll friction
 * SCROLL_FRICTION 0.01 a second (×0.926 a frame) until under SCROLL_MIN_DIST (0.5 Flash px).
 */

/** SCROLL_FRICTION 0.01 per second, per 60 fps frame. */
export const SCROLL_DECAY = Math.pow(0.01, 1 / 60);
/** SCROLL_MIN_DIST 0.5 Flash px: 0.25 px at our 16 px tiles. */
const SCROLL_MIN = px(0.25);
/** A move larger than this in one frame is a jump of the whole hero (a pipe, a respawn). */
const TELEPORT = px(32);

interface Ease {
  /** The camera anchor minus her box x (subpixels): the part of a jump not yet paid out. */
  off: number;
  last: number;
  w: number;
  turning: boolean;
}
const EASE = new WeakMap<Player, Ease>();

/** The camera's x for her this frame (CharacterDef.cameraX). */
export function sophiaCameraX(p: Player): number {
  const b = p.body;
  const st = sophiaState(p);
  let e = EASE.get(p);
  if (!e) {
    e = { off: 0, last: b.x, w: b.w, turning: false };
    EASE.set(p, e);
  }
  const delta = b.x - e.last;
  const turning = st.turn !== null;
  if (Math.abs(delta) > TELEPORT) e.off = 0;
  // A turn's step (and the box turning upright as one ends) is held back...
  else if (turning || e.turning || b.w !== e.w) e.off -= delta;
  if (st.turn) {
    // ...and paid out evenly over the frames the turn has left...
    const left = Math.max(1, st.turn.frames - st.turn.t);
    e.off -= e.off / left;
  } else {
    // ...then the rest decays.
    e.off *= SCROLL_DECAY;
    if (Math.abs(e.off) < SCROLL_MIN) e.off = 0;
  }
  e.last = b.x;
  e.w = b.w;
  e.turning = turning;
  return b.x + Math.round(e.off);
}

/** The part of a turn's jump still held back (subpixels; tests). */
export function cameraLag(p: Player): number {
  return EASE.get(p)?.off ?? 0;
}
