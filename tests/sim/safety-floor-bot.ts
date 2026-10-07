import { px, toPx } from '@engine/math/units';
import { Lift } from '@game/entities/objects/lift';
import type { Action } from '@engine/input/actions';
import type { LevelData } from '@game/level/schema';
import type { GameState } from '@game/context';
import type { CharacterDef } from '@game/characters/character';
import { runSim } from '@game/sim/headless';
import { T } from '@game/level/tiles';
import { groundSurface, SafetyFloor } from '@game/world/safety-floor';
import { TileMap } from '@game/world/tilemap';
import type { World } from '@game/world/world';
import type { Player } from '@game/entities/player';

/**
 * Test support for the Safety floor assist (tests/sim/safety-floor*.test.ts): every deadly pit
 * and lava pool of a level as a drop spot, and the drop-then-walk-out sim.
 */

export interface Drop {
  /** Column the hero drops down, and the row whose top he should land on (rim floor or lava). */
  x: number;
  land: number;
  /** The start row (WorldStart.y: feet on the row below), a few tiles above `land`. */
  y: number;
  kind: 'pit' | 'lava';
  /** Lava lies in the column (under the rim floor, or the landing itself). */
  overLava: boolean;
  /** Columns in the drop's run. */
  width: number;
  /** Directions to walk out, the side the floor is flush with first. */
  dirs: [-1 | 1, -1 | 1];
}

/** Lava's top row in column `tx` (the first lava tile from the top), or -1. */
function lavaTop(map: TileMap, tx: number): number {
  for (let ty = 0; ty < map.height; ty++) if (map.get(tx, ty) === T.LAVA) return ty;
  return -1;
}

/**
 * The drop spots of a level: the middle column of each run of floored columns (a deadly pit) and
 * of each run of lava columns (not under the rim floor), with room to fall in from above.
 */
export function drops(level: LevelData): Drop[] {
  const map = new TileMap(level);
  const floor = new SafetyFloor(map, level);
  const out: Drop[] = [];
  const landOf = (tx: number, kind: Drop['kind']) => {
    const rim = floor.rowAt(tx);
    const lava = lavaTop(map, tx);
    if (kind === 'pit') return rim;
    return lava >= 0 && (rim < 0 || rim > lava) ? lava : -1;
  };
  for (const kind of ['pit', 'lava'] as const) {
    let tx = 0;
    while (tx < map.width) {
      const land = landOf(tx, kind);
      if (land < 0) {
        tx++;
        continue;
      }
      const a = tx;
      while (tx < map.width && landOf(tx, kind) === land) tx++;
      const b = tx - 1;
      const x = (a + b) >> 1;
      // Room above the landing to fall from: 4 free rows. Less is a space a hero only walks
      // into from the side (under Bowser's bridge, under the airship's bow), never falls into.
      let free = 0;
      while (free < 4 && land - 1 - free >= 0 && !map.isSolid(x, land - 1 - free)) free++;
      if (free < 4) continue;
      // Walk out toward the side whose ground is level with the floor first, else the nearer one.
      const side = (dir: -1 | 1) => {
        for (let c = dir < 0 ? a - 1 : b + 1, n = 0; c >= 0 && c < map.width; c += dir, n++) {
          const s = groundSurface(map, c);
          if (s !== null) return { flush: s === land, dist: n };
        }
        return { flush: false, dist: Infinity };
      };
      const l = side(-1);
      const r = side(1);
      const leftFirst = (l.flush && !r.flush) || (l.flush === r.flush && l.dist < r.dist);
      out.push({
        x,
        land,
        y: land - 1 - free,
        kind,
        overLava: lavaTop(map, x) >= 0,
        width: b - a + 1,
        dirs: leftFirst ? [-1, 1] : [1, -1],
      });
    }
  }
  return out;
}

/** Whether `p` stands on a real solid tile (not just the floor or lava). */
export function onRealGround(w: World, p: Player): boolean {
  const b = p.body;
  if (!b.onGround) return false;
  const feet = toPx(b.y + b.h);
  if (feet % 16 !== 0) return true; // a lift or a spring
  const row = feet >> 4;
  for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
    if (w.map.isSolid(tx, row)) return true;
  return false;
}

export interface DropResult {
  died: boolean;
  /** Feet row (px / 16) where he first came to rest, or null if he never did. */
  landedRow: number | null;
  /** Walked or jumped out onto real ground. */
  out: boolean;
  /** First came to rest on a lift (the drop missed the pit: no fall to catch). */
  onLift: boolean;
}

/** The lift `p` stands on, if any. */
function liftUnder(w: World, p: Player): boolean {
  const b = p.body;
  return w.entities.some(
    (e) =>
      e instanceof Lift &&
      e.alive &&
      b.x < e.body.x + e.body.w &&
      b.x + b.w > e.body.x &&
      Math.abs(e.body.y - (b.y + b.h)) <= px(4),
  );
}

/** Take-off distances (px from the wall) the walk out tries in turn after a standing jump. */
const TAKEOFFS = [24, 8, 40, 16, 56, 32];

/**
 * Drop `hero` at `drop` (No damage and Infinite time on, so only a fall can kill; Scroll back on,
 * as the drop's start puts the camera where a real fall never would), wait until he lands, then
 * (with `walkOut`) walk toward `dir` until he stands on real ground: at a wall a standing jump,
 * then run-ups from several distances for heroes whose jump arc is fixed at take-off. A swimmer
 * only has to show he can swim up off the floor.
 */
export function dropSim(
  level: LevelData,
  hero: CharacterDef,
  drop: Drop,
  opts: {
    safety: boolean;
    walkOut?: boolean;
    dir?: -1 | 1;
    state?: Partial<GameState>;
    trace?: (w: World, f: number) => void;
  },
): DropResult {
  let landedRow: number | null = null;
  let landedAt = -1;
  let landedOnLift = false;
  let swamUp = false;
  let jumpT = 0;
  let backT = 0;
  let tries = 0;
  let wallX: number | null = null;
  const dir = opts.dir ?? drop.dirs[0];
  const fwd: Action = dir < 0 ? 'left' : 'right';
  const back: Action = dir < 0 ? 'right' : 'left';
  const r = runSim({
    level,
    character: hero,
    script: { steps: [] },
    assist: {
      safetyFloor: opts.safety,
      invulnerable: true,
      infiniteTime: true,
      infiniteLives: true,
      allowLeftScroll: true,
    },
    start: { x: drop.x, y: drop.y, mode: 'stand' },
    ...(opts.state ? { state: opts.state } : {}),
    maxFrames: opts.walkOut ? 1500 : 600,
    controller: (w, f): Action[] => {
      opts.trace?.(w, f);
      const p = w.player;
      const b = p.body;
      if (p.vine) return ['down'];
      if (landedRow === null) {
        if (f > 2 && b.onGround) {
          landedRow = toPx(b.y + b.h) / 16;
          landedAt = f;
          landedOnLift = liftUnder(w, p);
        }
        return [];
      }
      if (p.inWater) {
        if (toPx(b.y + b.h) <= (landedRow - 2) * 16) swamUp = true;
        return f % 8 < 2 ? ['jump'] : [];
      }
      if (backT > 0) {
        backT--;
        return [back, 'run'];
      }
      if (jumpT > 0) {
        jumpT--;
        return jumpT > 4 ? [fwd, 'run', 'jump'] : [fwd, 'run'];
      }
      const front = dir < 0 ? toPx(b.x) : toPx(b.x + b.w);
      const ahead = (front + dir * 2) >> 4;
      const feetRow = (toPx(b.y + b.h) - 1) >> 4;
      const blocked = b.hitWall === dir || w.map.isSolid(ahead, feetRow) || w.map.isSolid(ahead, feetRow - 1);
      if (!b.onGround) return [fwd, 'run'];
      if (blocked) {
        wallX = front;
        if (tries++ === 0) jumpT = 40;
        else backT = (TAKEOFFS[tries % TAKEOFFS.length] as number) + 30;
      } else if (
        wallX !== null &&
        Math.sign(b.vx) === dir &&
        Math.abs(wallX - front) <= (TAKEOFFS[tries % TAKEOFFS.length] as number)
      ) {
        wallX = null;
        jumpT = 40;
      }
      return [fwd, 'run'];
    },
    until: (w, f) => {
      if (w.player.dead) return true;
      if (!opts.walkOut) return landedRow !== null && f > landedAt + 30;
      return landedRow !== null && f > landedAt + 5 && (swamUp || onRealGround(w, w.player));
    },
  });
  const p = r.world.player;
  return {
    died: p.dead || r.outcome === 'died',
    landedRow,
    out: !p.dead && (swamUp || onRealGround(r.world, p)),
    onLift: landedOnLift,
  };
}
