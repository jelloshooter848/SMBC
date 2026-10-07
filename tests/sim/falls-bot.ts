import { toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';
import type { Player } from '@game/entities/player';

/**
 * A climber for 7-3-falls (the waterfall climb from Bill's camp back into 7-3): from whichever
 * ledge the hero stands on, the next step of the route. Walks (never runs) to the take-off point
 * and jumps toward the next ledge, steering onto it once above it; at a vine, climbs to its top
 * and steps off onto the ledge beside it; the last vine leads off the top of the screen. A hero
 * who falls picks the route up again from wherever it lands.
 */

/** A ledge: tile columns x0..x1 (inclusive), standing on row `row`. */
export interface Ledge {
  x0: number;
  x1: number;
  row: number;
}

export const FALLS = {
  floor: { x0: 1, x1: 14, row: 30 },
  a1: { x0: 4, x1: 6, row: 27 },
  a2: { x0: 8, x1: 10, row: 24 },
  a3: { x0: 12, x1: 14, row: 21 },
  b1: { x0: 10, x1: 13, row: 12 },
  b2: { x0: 6, x1: 8, row: 9 },
  b3: { x0: 1, x1: 4, row: 6 },
} satisfies Record<string, Ledge>;

/** The two vines: the switchback (column 14, from a3 to b1) and the way out (column 1, off the top). */
export const VINES = {
  switchback: { col: 14, top: 9 * 16, off: -1 as const },
  out: { col: 1, top: -32, off: 0 as const },
};

type Vine = (typeof VINES)[keyof typeof VINES];
type Leg = { from: Ledge; jump: Ledge } | { from: Ledge; vine: Vine };

export const ROUTE: Leg[] = [
  { from: FALLS.floor, jump: FALLS.a1 },
  { from: FALLS.a1, jump: FALLS.a2 },
  { from: FALLS.a2, jump: FALLS.a3 },
  { from: FALLS.a3, vine: VINES.switchback },
  { from: FALLS.b1, jump: FALLS.b2 },
  { from: FALLS.b2, jump: FALLS.b3 },
  { from: FALLS.b3, vine: VINES.out },
];

const centre = (l: Ledge) => ((l.x0 + l.x1 + 1) * 16) / 2;

/** The ledge `p` stands on (feet on its row, body over its columns), else undefined. */
export function standingOn(p: Player): Ledge | undefined {
  const b = p.body;
  if (!b.onGround) return undefined;
  const left = toPx(b.x);
  const right = toPx(b.x + b.w);
  const feet = toPx(b.y + b.h);
  return Object.values(FALLS).find((l) => feet === l.row * 16 && right > l.x0 * 16 && left < (l.x1 + 1) * 16);
}

/** A fresh climber for player `index` (it remembers the ledge it is jumping to). */
export function fallsBot(index = 0): (w: World) => Action[] {
  let target: Ledge | null = null;
  let dir: -1 | 1 = 1;
  /** Backing away from the take-off point for a run-up (a committed jump needs the speed). */
  let backing = false;
  /** JUMP was held last frame: let go first, so the next jump is a fresh press. */
  let held = false;
  const out = (a: Action[]): Action[] => {
    held = a.includes('jump');
    return a;
  };
  return (w) => out(step(w));
  function step(w: World): Action[] {
    const p = w.players[index] as Player;
    const b = p.body;
    const left = toPx(b.x);
    const right = toPx(b.x + b.w);
    const cx = (left + right) / 2;
    const feet = toPx(b.y + b.h);
    if (p.vine) {
      const at = toPx(p.vine.x);
      const v = Object.values(VINES).find((x) => x.col * 16 + 8 === at);
      if (!v || v.off === 0 || toPx(b.y) > v.top + 1) return ['up'];
      // At the top: let go of every direction, then step off toward the ledge.
      return w.frame % 2 ? [v.off < 0 ? 'left' : 'right'] : [];
    }
    if (b.onGround) {
      target = null;
      const on = standingOn(p);
      const leg = on && ROUTE.find((l) => l.from === on);
      if (!leg) return [];
      if ('vine' in leg) {
        const vx = leg.vine.col * 16 + 8;
        if (Math.abs(cx - vx) > 2) return [cx < vx ? 'right' : 'left'];
        return ['up'];
      }
      const from = leg.from;
      const to = leg.jump;
      dir = centre(to) > cx ? 1 : -1;
      const edge =
        dir > 0
          ? Math.min((from.x1 + 1) * 16, to.x0 * 16 - 16)
          : Math.max(from.x0 * 16, (to.x1 + 1) * 16 + 16);
      const lead = dir > 0 ? right : left;
      const d: Action = dir > 0 ? 'right' : 'left';
      const back: Action = dir > 0 ? 'left' : 'right';
      const short = dir > 0 ? edge - lead : lead - edge;
      if (backing) {
        // Far enough back (or against the ledge's other end): turn round for the run-up.
        const room = dir > 0 ? left - from.x0 * 16 : (from.x1 + 1) * 16 - right;
        if (short < 28 && room > 2) return [back];
        backing = false;
      }
      if (short > 2) return [d];
      // A jump needs speed (Simon's arc is committed at take-off): back off for a run-up.
      const speed = Math.abs(b.vx);
      if (p.profile.airControl === 'none' && speed < 0.8 * p.profile.maxWalk) {
        backing = true;
        return [back];
      }
      if (held) return [d];
      target = to;
      return [d, 'jump'];
    }
    if (!target || p.clinging) return [];
    const d: Action = dir > 0 ? 'right' : 'left';
    if (feet > target.row * 16) {
      // Still below the ledge's top: on toward it, but never into its side (Ryu would cling).
      const near = dir > 0 ? target.x0 * 16 - right : left - (target.x1 + 1) * 16;
      return near > 2 ? [d, 'jump'] : ['jump'];
    }
    const c = centre(target);
    if (cx < c - 3) return ['right', 'jump'];
    if (cx > c + 3) return ['left', 'jump'];
    return ['jump'];
  }
}

/**
 * Walking right through a room, hopping up one-tile steps (the camp's riverbank): a jump when the
 * way ahead is blocked, after a few steps back for a run-up when the hero's jump is committed at
 * take-off (Simon's).
 */
export function walkRight(index = 0): (w: World) => Action[] {
  let backing = 0;
  return (w) => {
    const p = w.players[index] as Player;
    const b = p.body;
    if (p.clinging) return [];
    const ahead = (toPx(b.x + b.w) + 1) >> 4;
    const feetRow = (toPx(b.y + b.h) - 1) >> 4;
    // In the air: on over the step once above it, never into its side (Ryu would cling).
    if (!b.onGround) return w.map.isSolid(ahead, feetRow) ? ['jump'] : ['right', 'jump'];
    if (backing > 0) {
      backing--;
      return ['left'];
    }
    if (p.profile.airControl === 'none') {
      // A committed jump leaves a few px short of the step, at walking speed.
      if (!w.map.isSolid((toPx(b.x + b.w) + 6) >> 4, feetRow)) return ['right'];
      if (Math.abs(b.vx) < 0.8 * p.profile.maxWalk) {
        backing = 24;
        return ['left'];
      }
      return ['right', 'jump'];
    }
    if (!w.map.isSolid(ahead, feetRow)) return ['right'];
    // Straight up first, then over once above the step.
    return w.frame % 2 ? ['jump'] : [];
  };
}
