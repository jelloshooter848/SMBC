import type { Action } from '@engine/input/actions';
import { ALIGN, swordAt } from './hero';
import {
  DIRS,
  DIR_VEC,
  mod,
  ROOM_H,
  ROOM_W,
  TILE,
  boxesOverlap,
  type Box,
  type Dir,
  type Side,
} from './geometry';
import { Pickup, PushBlock } from './entity';
import { Projectile } from './enemies';
import type { TopDownWorld } from './world';

/**
 * A simple player for tests and tuning: walks the half-tile grid by breadth-first search, fights
 * by stepping to where the sword reaches an enemy (and stabbing), pushes blocks and leaves rooms.
 * A game gives it a plan per room (a list of steps); it holds the actions for one frame at a time.
 */
export type BotStep =
  | { do: 'fight' }
  | { do: 'goto'; x: number; y: number }
  | { do: 'push'; dir: Dir; from: { x: number; y: number }; until: (w: TopDownWorld) => boolean }
  | { do: 'pickup' }
  | { do: 'leave'; side: Side };

const INSIDE: Record<Side, { x: number; y: number; dir: Dir }> = {
  n: { x: 7.5 * TILE, y: TILE, dir: 'up' },
  s: { x: 7.5 * TILE, y: ROOM_H - 2 * TILE, dir: 'down' },
  w: { x: TILE, y: 5 * TILE, dir: 'left' },
  e: { x: ROOM_W - 2 * TILE, y: 5 * TILE, dir: 'right' },
};

interface Node {
  x: number;
  y: number;
}

export class TopDownBot {
  private room = '';
  private step = 0;
  private attackHeld = false;
  /** Frames stuck on the current step (a goto that can't make progress moves on). */
  private stuck = 0;
  private lastDir: Dir | null = null;

  constructor(private readonly plans: Readonly<Record<string, readonly BotStep[]>>) {}

  /** The actions to hold this frame. */
  next(world: TopDownWorld): Action[] {
    if (world.transition || world.hero.dying) return [];
    if (world.room.id !== this.room) {
      this.room = world.room.id;
      this.step = 0;
      this.stuck = 0;
    }
    const plan = this.plans[this.room] ?? [];
    for (let guard = 0; guard < 8; guard++) {
      const s = plan[this.step];
      if (!s) return [];
      const out = this.run(world, s);
      if (out !== 'done') {
        this.lastDir = (out.find((a) => (DIRS as readonly string[]).includes(a)) as Dir | undefined) ?? null;
        return out;
      }
      this.step++;
      this.stuck = 0;
    }
    return [];
  }

  private run(world: TopDownWorld, s: BotStep): Action[] | 'done' {
    const hero = world.hero;
    switch (s.do) {
      case 'fight': {
        const foes = world.enemies();
        if (foes.length === 0) return 'done';
        return this.fight(world);
      }
      case 'goto':
        if (hero.x === s.x && hero.y === s.y) return 'done';
        return this.walkTo(world, (n) => n.x === s.x && n.y === s.y) ?? 'done';
      case 'pickup': {
        const item = world.entities.find((e): e is Pickup => e instanceof Pickup && !e.hidden && !e.dead);
        if (!item) return 'done';
        const box = item.hurtbox();
        return (
          this.walkTo(world, (n) => boxesOverlap({ x: n.x + 2, y: n.y + 2, w: 12, h: 12 }, box)) ?? 'done'
        );
      }
      case 'push': {
        if (s.until(world)) return 'done';
        const block = world.entities.find((e) => e instanceof PushBlock) as PushBlock | undefined;
        if (block?.moving) return [];
        if (hero.x !== s.from.x || hero.y !== s.from.y) {
          if (this.atPushSpot(world, s)) return [s.dir];
          return this.walkTo(world, (n) => n.x === s.from.x && n.y === s.from.y) ?? [s.dir];
        }
        return [s.dir];
      }
      case 'leave': {
        const at = INSIDE[s.side];
        const lined = s.side === 'n' || s.side === 's' ? hero.x === at.x : hero.y === at.y;
        const past = DIR_VEC[at.dir];
        const beyond = past.dx !== 0 ? (hero.x - at.x) * past.dx >= 0 : (hero.y - at.y) * past.dy >= 0;
        if (lined && beyond) return [at.dir];
        return this.walkTo(world, (n) => n.x === at.x && n.y === at.y) ?? [at.dir];
      }
    }
  }

  /** Already leaning into the block from the planned side (it moved; follow it). */
  private atPushSpot(world: TopDownWorld, s: Extract<BotStep, { do: 'push' }>): boolean {
    const hero = world.hero;
    const v = DIR_VEC[s.dir];
    return v.dx !== 0
      ? hero.y === s.from.y && (hero.x - s.from.x) * v.dx > 0
      : hero.x === s.from.x && (hero.y - s.from.y) * v.dy > 0;
  }

  private fight(world: TopDownWorld): Action[] {
    const hero = world.hero;
    if (hero.attacking) return [];
    const foes = world.enemies();
    // Step out of the way of a shot the shield won't stop.
    const danger = (x: number, y: number) => this.inLine(world, x, y);
    if (danger(hero.x, hero.y)) {
      const out = this.walkTo(
        world,
        (n) => !danger(n.x, n.y),
        foes.map((f) => grow(f.hurtbox(), 2)),
      );
      if (out) return out;
    }
    // Stab if the blade would reach something from here, turning first if needed.
    for (const d of DIRS) {
      const blade = swordAt(hero.x, hero.y, d);
      if (!foes.some((f) => boxesOverlap(blade, f.hurtbox()))) continue;
      if (hero.facing !== d) return [d];
      if (this.attackHeld) {
        this.attackHeld = false;
        return [];
      }
      this.attackHeld = true;
      return ['attack'];
    }
    this.attackHeld = false;
    const path = this.walkTo(
      world,
      // Big foes (a boss) only from below, out of their path.
      (n) =>
        DIRS.some((d) =>
          foes.some((f) => (f.w < 32 || d === 'up') && boxesOverlap(swordAt(n.x, n.y, d), f.hurtbox())),
        ),
      foes.map((f) => grow(f.hurtbox(), 6)),
    );
    return path ?? [];
  }

  /** Would a hostile shot hit a hero standing at (x, y) within the next half second? */
  private inLine(world: TopDownWorld, x: number, y: number): boolean {
    const hero = world.hero;
    const hb = { x: x + 1, y: y + 1, w: 14, h: 14 };
    return world.entities.some((e) => {
      if (!(e instanceof Projectile) || !e.hostile || e.dead) return false;
      // A shot the shield would stop doesn't count when standing still facing it.
      if (e.blockable && x === hero.x && y === hero.y && hero.shieldBlocks(e.dir)) return false;
      for (let t = 0; t <= 30; t += 2) {
        const b = e.hurtbox();
        if (boxesOverlap({ x: b.x + e.vx * t, y: b.y + e.vy * t, w: b.w, h: b.h }, hb)) return true;
      }
      return false;
    });
  }

  /**
   * One step along the shortest half-tile-grid path to a node passing `goal`, avoiding boxes in
   * `avoid` (the hero's hurtbox must not touch them). Null when there is no path.
   */
  private walkTo(world: TopDownWorld, goal: (n: Node) => boolean, avoid: Box[] = []): Action[] | null {
    const hero = world.hero;
    const offX = mod(hero.x, ALIGN) !== 0;
    const offY = mod(hero.y, ALIGN) !== 0;
    if (offX && offY) return ['left']; // knocked off the grid: walking snaps one axis back first
    if (offX || offY) {
      // Between two grid points: head for whichever of them is nearer the goal.
      const lo = offX
        ? { x: hero.x - mod(hero.x, ALIGN), y: hero.y }
        : { x: hero.x, y: hero.y - mod(hero.y, ALIGN) };
      const hi = offX ? { x: lo.x + ALIGN, y: lo.y } : { x: lo.x, y: lo.y + ALIGN };
      const a = this.search(world, lo, goal, avoid);
      const b = this.search(world, hi, goal, avoid);
      const toLo: Dir = offX ? 'left' : 'up';
      const toHi: Dir = offX ? 'right' : 'down';
      if (!a && !b) return [this.lastDir === toHi ? toHi : toLo];
      return [!b || (a && a.dist <= b.dist) ? toLo : toHi];
    }
    const found = this.search(world, { x: hero.x, y: hero.y }, goal, avoid);
    if (found?.first) {
      this.stuck = 0;
      return [found.first];
    }
    if (!found && ++this.stuck > 600) this.step++;
    return null;
  }

  /** Breadth-first search on the half-tile grid: distance to the goal and the first move (null if none). */
  private search(
    world: TopDownWorld,
    start: Node,
    goal: (n: Node) => boolean,
    avoid: Box[],
  ): { dist: number; first: Dir | null } | null {
    const hero = world.hero;
    const key = (n: Node) => `${n.x},${n.y}`;
    const free = (n: Node) =>
      n.x >= 0 &&
      n.y >= 0 &&
      n.x <= ROOM_W - TILE &&
      n.y <= ROOM_H - TILE &&
      !world.blocked(hero.feet(n.x, n.y), 'hero', null) &&
      !avoid.some((b) => boxesOverlap({ x: n.x + 2, y: n.y + 2, w: 12, h: 12 }, b));
    if (goal(start)) return { dist: 0, first: null };
    const prev = new Map<string, { from: Node; dir: Dir; dist: number } | null>([[key(start), null]]);
    const queue: Node[] = [start];
    while (queue.length) {
      const n = queue.shift() as Node;
      const nd = prev.get(key(n))?.dist ?? 0;
      for (const d of DIRS) {
        const v = DIR_VEC[d];
        const m = { x: n.x + v.dx * ALIGN, y: n.y + v.dy * ALIGN };
        if (prev.has(key(m)) || !free(m)) continue;
        prev.set(key(m), { from: n, dir: d, dist: nd + 1 });
        if (goal(m)) {
          let cur = m;
          let first: Dir = d;
          for (;;) {
            const p = prev.get(key(cur));
            if (!p) break;
            first = p.dir;
            cur = p.from;
          }
          return { dist: nd + 1, first };
        }
        queue.push(m);
      }
    }
    return null;
  }
}

function grow(b: Box, n: number): Box {
  return { x: b.x - n, y: b.y - n, w: b.w + 2 * n, h: b.h + 2 * n };
}
