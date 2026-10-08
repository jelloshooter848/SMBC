import { toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';
import type { TileMap } from '@game/world/tilemap';
import type { Player } from '@game/entities/player';

/*
 * A bot for the water levels (0.4.25, owner note 25: every hero meets water the way their own
 * game does), real inputs only. At the start it plans a way through the water on the tile grid
 * (a box one column wide and as many rows tall as the hero, from the start to the level's way
 * out: the side pipe or the exit line), then follows it:
 *
 * - toward the next few cells of the route, left or right;
 * - a swimmer (a stroke on jump: Mario, Luigi, Bill, Link, Simon, Ryu, and Sophia III's own
 *   water drive) taps jump while the route is above the feet, and otherwise lets the hero sink;
 * - a seabed walker (Mega Man, Samus) jumps off the floor when the route climbs, holding jump
 *   until the feet are above the route (their jump cuts on release), or pushes off again over
 *   bottomless water. Their route prefers cells near a floor to jump from.
 */

type Cell = { c: number; r: number };

const solidAt = (map: TileMap, c: number, r: number): boolean =>
  c < 0 || c >= map.width ? true : r >= 0 && r < map.height && map.isSolid(c, r);
const standAt = (map: TileMap, c: number, r: number): boolean => {
  if (c < 0 || c >= map.width || r < 0 || r >= map.height) return false;
  const k = map.collisionAt(c, r);
  return k === 'solid' || k === 'top';
};

/** Where the route ends: a side pipe's mouth (the body in front of it) or the exit line. */
function goals(w: World, h: number, wc: number): (cell: Cell) => boolean {
  const pipes = w.level.zones.filter((z) => z.kind === 'pipe' && z.dir === 'right');
  const exit = w.level.zones.find((z) => z.kind === 'exit');
  return ({ c, r }) =>
    pipes.some((z) => z.kind === 'pipe' && c + wc === z.x && r + h - 1 === z.y) ||
    (exit !== undefined && c >= exit.x);
}

/** The route (cells of the body's top-left tile), cheapest first; seabed routes hug the floor. */
export function planRoute(w: World, p: Player): Cell[] {
  const map = w.map;
  const h = Math.ceil(toPx(p.body.h) / 16);
  const wc = Math.ceil(toPx(p.body.w) / 16);
  const waterTop = toPx(w.waterTop);
  const seabed = p.profile.swim?.mode === 'seabed';
  const W = map.width;
  const free = (c: number, r: number): boolean => {
    if (r < 0 || r + h > map.height) return false;
    for (let i = 0; i < h; i++) for (let j = 0; j < wc; j++) if (solidAt(map, c + j, r + i)) return false;
    return r * 16 + h * 8 >= waterTop;
  };
  /** Rows from the body's feet down to the first thing to stand on (Infinity: none). */
  const aboveFloor = (c: number, r: number): number => {
    for (let y = r + h; y < map.height; y++) if (standAt(map, c, y)) return y - (r + h);
    return Infinity;
  };
  const cost = (c: number, r: number): number => {
    if (!seabed) return 1;
    // Cells near a floor to jump from are cheap; ones out of a jump's reach are a last resort.
    const d = aboveFloor(c, r);
    return d === Infinity ? 1 : 1 + Math.max(0, d - 3) * 4 + (d > 6 ? 60 : 0);
  };
  const start: Cell = {
    c: (toPx(p.body.x + (p.body.w >> 1)) - (wc - 1) * 8) >> 4,
    r: Math.max(0, (toPx(p.body.y + p.body.h) >> 4) - h),
  };
  // Drop the start straight down into the water if it begins above it.
  while (!free(start.c, start.r) && start.r < map.height - h) start.r++;
  const goal = goals(w, h, wc);
  const key = (c: number, r: number) => r * W + c;
  const dist = new Float64Array(W * map.height).fill(Infinity);
  const prev = new Int32Array(W * map.height).fill(-1);
  const open: [number, number][] = [[0, key(start.c, start.r)]];
  dist[key(start.c, start.r)] = 0;
  let end = -1;
  while (open.length) {
    // A small binary-heap-free Dijkstra: take the cheapest (the grids are small).
    let bi = 0;
    for (let i = 1; i < open.length; i++) if ((open[i] as [number, number])[0] < (open[bi] as [number, number])[0]) bi = i;
    const [d, k] = open.splice(bi, 1)[0] as [number, number];
    if (d > (dist[k] as number)) continue;
    const c = k % W;
    const r = (k - c) / W;
    if (goal({ c, r })) {
      end = k;
      break;
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= W || !free(nc, nr)) continue;
      const nk = key(nc, nr);
      const nd = d + cost(nc, nr);
      if (nd < (dist[nk] as number)) {
        dist[nk] = nd;
        prev[nk] = k;
        open.push([nd, nk]);
      }
    }
  }
  const out: Cell[] = [];
  for (let k = end; k >= 0; k = prev[k] as number) out.push({ c: k % W, r: Math.floor(k / W) });
  return out.reverse();
}

export function waterBot(index = 0, debug?: (s: string) => void): (w: World) => Action[] {
  let route: Cell[] = [];
  let planH = 0;
  let at = 0;
  let rising = false;
  let letGo = 0;
  let risen = 0;
  let prevJump = false;
  let furthest = 0;
  let since = 0;
  return (w: World): Action[] => {
    const p = w.players[index];
    if (!p) return [];
    const b = p.body;
    const h = Math.ceil(toPx(b.h) / 16);
    const wc = Math.ceil(toPx(b.w) / 16);
    if (!p.inWater && route.length === 0) return ['right'];
    // Plan again from where the hero is when the size changed or the route stopped advancing
    // for two seconds (knocked off it, or a rise that overshot into a pocket).
    if (at > furthest) {
      furthest = at;
      since = 0;
    } else since++;
    if (h !== planH || route.length === 0 || (since > 120 && p.inWater)) {
      route = planRoute(w, p);
      planH = h;
      at = 0;
      furthest = 0;
      since = 0;
    }
    if (route.length === 0) return ['right'];
    const cx = toPx(b.x + (b.w >> 1));
    const feet = toPx(b.y + b.h);
    const here = { c: (cx - (wc - 1) * 8) >> 4, r: (feet - 1) >> 4 };
    // Follow on from the nearest route cell at or a little behind where the bot last was.
    let best = at;
    let bestD = Infinity;
    const off = (n: Cell) => Math.abs(n.c - here.c) * 2 + Math.abs(n.r + planH - 1 - here.r) * 3;
    // (Never more than a few cells on at a time, so a cell past a wall is not taken for one in reach.)
    for (let i = Math.max(0, at - 4); i < Math.min(route.length, at + 4); i++) {
      const d = off(route[i] as Cell);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Only fall back along the route when well off it (knocked back), not for overshooting a rise.
    if (best >= at || off(route[at] as Cell) > 8) at = best;
    const last = at >= route.length - 2;
    const t = route[Math.min(at + 2, route.length - 1)] as Cell;
    const keys: Action[] = [];
    const dx = t.c * 16 + wc * 8 - cx;
    // Clinging to a wall above the water (Ryu): let go and drop back in.
    if (p.clinging) letGo = 30;
    if (letGo > 0 && !p.inWater) {
      letGo--;
      return [];
    }
    // Lined up to a pixel when the route drops through a shaft one body wide.
    const slack = b.onGround && route[Math.min(at + 2, route.length - 1)]!.r > (route[at] as Cell).r ? 0 : 2;
    if (last || dx > slack) keys.push('right');
    else if (dx < -slack) keys.push('left');
    const targetFeet = (t.r + planH) * 16;
    let jump = false;
    if (toPx(b.y) < 48 && !b.onGround && w.frame < 300) {
      // Dropping in at the start: no steering until below the fall-in line (World.fallingIn).
    } else if (p.inWater && p.profile.swim?.mode === 'seabed') {
      // The highest the route goes over the next few columns: jump high enough to clear it.
      let need = targetFeet;
      for (let i = at; i < Math.min(route.length, at + 16); i++) {
        const n = route[i] as Cell;
        if (Math.abs(n.c - here.c) > 3) break;
        need = Math.min(need, (n.r + planH) * 16);
      }
      if (rising) {
        // Hold through the take-off (a jump cuts short on release), then until high enough.
        risen++;
        rising = risen < 4 || (b.vy < 0 && feet > need - 6);
        jump = rising;
      } else if (!prevJump && (b.onGround || b.vy >= 0) && (feet > need + 4 || (b.onGround && b.hitWall !== 0))) {
        jump = true;
        rising = true;
        risen = 0;
      }
    } else if (p.inWater && p.def.behaviour.drive) {
      // Sophia III's water drive: "up" alone thrusts her up; let go and she sinks.
      if (feet > targetFeet + 2) keys.push('up');
    } else if (p.inWater) {
      // Stroke once the feet sink a little below the route, never below the floor under it.
      let floor = targetFeet;
      for (let y = t.r + planH; y < w.map.height && !solidAt(w.map, t.c, y) && floor < targetFeet + 32; y++) floor += 16;
      jump = !last && feet > Math.min(floor - 4, targetFeet + 10) && w.frame % 6 === 0;
    } else {
      // Out of the water (a jump or stroke breaking the surface, a dry ledge): jump at walls.
      jump = b.onGround && !prevJump && b.hitWall !== 0;
    }
    debug?.(`at${at}/${route.length} t${t.c},${t.r} rising${rising}`);
    prevJump = jump;
    if (jump) keys.push('jump');
    return keys;
  };
}
