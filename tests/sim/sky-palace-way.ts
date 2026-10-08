import { px, tileAt, toPx } from '@engine/math/units';
import { TALK_REACH_PX } from '@game/entities/objects/captive';
import type { Action } from '@engine/input/actions';
import type { Body } from '@game/entities/body';
import type { TileMap } from '@game/world/tilemap';

/**
 * The way through Link's sky palace (2-1-sky2) for the sims (sky-palace.test.ts,
 * heroes-link-sky.test.ts): where Link stands, and a player's walk up to him and on.
 */

/** Captive Link: column 52, his feet on the altar's top (row 9). */
export const LINK = { x: 52, feet: 9 * 16 };

const centre = (b: Body): number => b.x + (b.w >> 1);

/** Where Captive.inReach shows TALK: on the ground on the altar's top, within reach of Link. */
export const byLink = (b: Body): boolean =>
  b.onGround &&
  Math.abs(toPx(b.y + b.h) - LINK.feet) <= 8 &&
  Math.abs(centre(b) - px(LINK.x * 16 + 8)) <= px(TALK_REACH_PX);

/**
 * A player's way through, at a walk: go right; jump a step from half a tile short of it (so the
 * arc clears it: Ryu would cling to its side), jump a gap from its edge, step down off a step;
 * let go of right at `stopX` (sub-px, the body's centre) and brake once past it.
 */
export function walker(b: Body, map: TileMap, s: { hold: number }, stopX = Infinity): Action[] {
  if (b.onGround) s.hold = 0;
  const out: Action[] = [];
  if (centre(b) < stopX) out.push('right');
  else if (b.vx > 0) out.push('left');
  const feet = tileAt(b.y + b.h - 1);
  const front = tileAt(b.x + b.w + px(8));
  const step = map.isSolid(front, feet) || map.isSolid(front, feet - 1);
  // A gap: nothing to stand on within three rows past the front of the body.
  const edge = tileAt(b.x + b.w + px(2));
  let gap = true;
  for (let r = feet + 1; r <= feet + 3 && gap; r++) if (map.isSolid(edge, r)) gap = false;
  if (b.onGround && out.includes('right') && (step || gap)) s.hold = 16;
  if (s.hold > 0) {
    s.hold--;
    out.push('jump');
  }
  return out;
}

/** The walk up to Link: let go of right just short of him. */
export const toLink = (b: Body, map: TileMap, s: { hold: number }): Action[] =>
  walker(b, map, s, px(LINK.x * 16));

/** Standing by Link, settled (close to his left, where `toLink` stops). */
export const settledByLink = (b: Body): boolean => byLink(b) && Math.abs(toPx(centre(b)) - LINK.x * 16) <= 12;
