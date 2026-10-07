import type { Action } from '@engine/input/actions';
import { toPx, velToSub } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import type { World } from '@game/world/world';
import type { Entity } from '@game/entities/entity';
import { Cannonball } from '@game/entities/enemies/cannon';
import { RockyWrench } from '@game/entities/enemies/rocky-wrench';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import { Enemy } from '@game/entities/enemies/enemy';
import { Projectile } from '@game/entities/projectiles/projectile';

/*
 * A bot for Larry's airship deck (any `camera: auto` level ending in a down pipe), playing it
 * like a careful player: it walks right with the scrolling screen but keeps clear of the right
 * edge, jumps walls and pits, and looks a little ahead at everything that hurts (cannonballs,
 * wrenches, Bullet Bills, a Rocky Wrench that is up). Each frame it tries, in order: walk on,
 * stand, step back; the first that stays clear of every threat for the next ~40 frames wins.
 * When none does, it jumps a flat-flying shot as it arrives. Heroes who stomp jump onto a Rocky
 * Wrench that is up; the others swing or shoot at targets in front of them. On the stern deck
 * it hops onto the pipe and presses DOWN.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LOOK = 40;
const overlap = (a: Box, b: Box, m: number) =>
  a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

/** Things that hurt on touch, with their velocity in px/f (0 for a Rocky Wrench that is up). */
function threats(w: World): { box: Box; vx: number; vy: number; e: Entity }[] {
  const out: { box: Box; vx: number; vy: number; e: Entity }[] = [];
  for (const e of w.entities) {
    if (!e.alive) continue;
    const hurts =
      (e instanceof Projectile && e.spec.hitsPlayer) ||
      (e instanceof RockyWrench && (e.exposed || e.state === 'rise')) ||
      (e instanceof Enemy && !(e instanceof RockyWrench) && e.contactHurts && e.stunned === 0);
    if (!hurts) continue;
    const b = e.body;
    const box = { x: toPx(b.x), y: toPx(b.y), w: toPx(b.w), h: toPx(b.h) };
    if (e instanceof RockyWrench) {
      // Count him fully out (he is, or soon will be).
      box.y = toPx(b.y + b.h) - 16 - (e.state === 'rise' ? 16 - e.out : 0);
      box.h = 16;
    }
    const moving = e instanceof Cannonball || e instanceof BulletBill || e instanceof Projectile;
    out.push({ box, vx: moving ? velToSub(b.vx) / 256 : 0, vy: moving ? velToSub(b.vy) / 256 : 0, e });
  }
  return out;
}

export interface AirshipBotOptions {
  /** Keep this many px between the hero's right side and the screen's right edge. */
  margin?: number;
}

export function airshipBot(opts: AirshipBotOptions = {}): (w: World) => Action[] {
  const margin = opts.margin ?? 64;
  let held = false;
  let airDir: Action | null = null;
  let lastX = -1;
  let still = 0;
  let back = 0;
  let attackT = 0;
  let pushing = false;
  const step = (a: Action[]): Action[] => {
    pushing = a.includes('right') || a.includes('left');
    return a;
  };
  return (w) => step(decide(w));
  function decide(w: World): Action[] {
    const p = w.player;
    const b = p.body;
    const cam = w.camera;
    const camX = toPx(cam.x);
    const speed = cam.autoSpeed / 256;
    const left = toPx(b.x);
    const right = toPx(b.x + b.w);
    const top = toPx(b.y);
    const feet = toPx(b.y + b.h);
    const row = Math.floor((feet - 1) / 16);
    attackT++;
    const stern = w.level.zones.find((z) => z.kind === 'pipe' && z.dir === 'down') as
      { x: number; y: number } | undefined;
    const pipeL = (stern?.x ?? w.level.width) * 16;
    const pipeTop = (stern?.y ?? 0) * 16;

    still = pushing && left === lastX ? still + 1 : 0;
    lastX = left;

    // In the air: keep the jump going while rising, keep the chosen direction.
    if (!b.onGround) {
      // Clinging to a wall (Ryu): let go, drop, and take a run-up.
      if (p.clinging) {
        held = false;
        airDir = null;
        back = 10;
        return [];
      }
      // Coming down over the stern pipe: stop steering so the hero lands on it.
      const overPipe =
        stern !== undefined && b.vy > 0 && feet <= pipeTop && left >= pipeL - 2 && right <= pipeL + 34;
      const mid = (left + right) / 2 - (pipeL + 16);
      const steer: Action[] = mid > 3 ? ['left'] : mid < -3 ? ['right'] : [];
      let out: Action[] = overPipe ? steer : airDir ? [airDir] : [];
      if (!overPipe) {
        // About to fly into a shot: steer the other way (or not at all) if that misses it.
        const ts = threats(w);
        const vx0 = b.vx / 4096;
        const vy0 = b.vy / 4096;
        const g = (p.def.movement.jump[0]?.fallGravity ?? 0x00400) / 4096;
        const walkCap = p.def.movement.maxWalk / 4096;
        const hitIn = (steerTo: Action | null | undefined): number => {
          const target = steerTo === 'right' ? walkCap : steerTo === 'left' ? -walkCap : vx0;
          for (let t = 1; t <= 24; t++) {
            const x = Math.max(left + ((vx0 + target) / 2) * t, camX + speed * t);
            const me = { x, y: top + vy0 * t + (g * t * t) / 2, w: right - left, h: feet - top };
            for (const th of ts) {
              const box = { ...th.box, x: th.box.x + th.vx * t, y: th.box.y + th.vy * t };
              // Coming down on something stompable is a stomp, not a hit.
              const stomp = p.def.stomps && th.e instanceof Enemy && th.e.stompable && vy0 + g * t > 0;
              if (stomp && box.y >= me.y + me.h - 8) continue;
              if (overlap(me, box, 1)) return t;
            }
          }
          return Infinity;
        };
        const now: Action | null = out[0] === 'right' || out[0] === 'left' ? out[0] : null;
        if (hitIn(now) !== Infinity) {
          const options: (Action | null)[] = [null, 'left', 'right'].filter(
            (o) => o !== now,
          ) as (Action | null)[];
          let best: Action | null = now;
          let bestT = hitIn(now);
          // Never steer out over a gap: where would this steering come down?
          const landsSafe = (o: Action | null): boolean => {
            const target = o === 'right' ? walkCap : o === 'left' ? -walkCap : vx0;
            const x = left + ((vx0 + target) / 2) * 30 + (right - left) / 2;
            const col = Math.floor(x / 16);
            for (let y = Math.max(0, row); y < 15; y++) if (w.map.isSolid(col, y)) return true;
            return false;
          };
          for (const o of options) {
            if (!landsSafe(o)) continue;
            const tt = hitIn(o);
            if (tt > bestT) {
              best = o;
              bestT = tt;
            }
          }
          out = best ? [best] : [];
        }
      }
      if (held && b.vy < 0) out.push('jump');
      else held = false;
      return out;
    }
    held = false;
    airDir = null;

    // On the pipe's top, over its middle: down.
    if (stern && Math.abs(feet - pipeTop) <= 1 && left >= pipeL && right <= pipeL + 32) return ['down'];

    // Stuck at a wall (a committed jump that came up short): back off a little and try again.
    if (still > 40) back = 16;
    if (back > 0) {
      back--;
      return ['left'];
    }

    const past = stern !== undefined && left > pipeL + 4 && feet <= pipeTop + 32;
    const dir = past ? -1 : 1;
    const go: Action = past ? 'left' : 'right';
    const ahead = (d: number) => Math.floor((dir > 0 ? right + d : left - d) / 16);
    const height = (x: number) => {
      let n = 0;
      while (n < 5 && w.map.isSolid(x, row - n)) n++;
      return n;
    };
    let wall = false;
    for (const d of [2, 10, 18]) if (height(ahead(d)) > 0 || w.map.isSolid(ahead(d), row - 1)) wall = true;
    for (const d of [26, 34]) if (height(ahead(d)) >= 2) wall = true;
    let pit = true;
    for (let y = row + 1; y < 15; y++) if (w.map.isSolid(ahead(6), y)) pit = false;
    const toPipe = stern !== undefined && feet > pipeTop && left > pipeL - 40 && !past;

    // Threat look-ahead for walking on, standing, stepping back.
    const ts = threats(w);
    // Walking speed over the next second: from the current speed up toward the walk cap.
    const walk = (Math.abs(b.vx) / 4096 + p.def.movement.maxWalk / 4096) / 2;
    const firstHit = (v: number): number => {
      for (let t = 1; t <= LOOK; t++) {
        let x = left + v * t;
        x = Math.max(x, camX + speed * t);
        const me = { x, y: top, w: right - left, h: feet - top };
        for (const th of ts) {
          const box = { ...th.box, x: th.box.x + th.vx * t, y: th.box.y + th.vy * t };
          if (overlap(me, box, 1)) return t;
        }
      }
      return Infinity;
    };
    /** The same for a jump on: the hero's full jump arc while walking on. */
    const tier = p.def.movement.jump[0];
    const v0 = (tier?.initial ?? 0x04000) / 4096;
    const g = (tier?.holdGravity ?? 0x00200) / 4096;
    const jumpHit = (vx = dir * walk): number => {
      for (let t = 1; t <= LOOK; t++) {
        const rise = Math.max(0, v0 * t - (g * t * t) / 2);
        const x = Math.max(left + vx * t, camX + speed * t);
        const me = { x, y: top - rise, w: right - left, h: feet - top };
        for (const th of ts) {
          const box = { ...th.box, x: th.box.x + th.vx * t, y: th.box.y + th.vy * t };
          if (overlap(me, box, 3)) return t;
        }
      }
      return Infinity;
    };
    const out: Action[] = [];

    // Swing or shoot at what is in front (heroes who stomp just stomp).
    if (!p.def.stomps) {
      for (const th of ts) {
        const dx = dir > 0 ? th.box.x - right : left - (th.box.x + th.box.w);
        const vert = th.box.y < feet + 4 && th.box.y + th.box.h > top - 4;
        const target = th.e instanceof Enemy;
        if (target && vert && dx > -8 && dx < 64 && (attackT & 7) === 0) out.push('attack');
      }
    }

    // A Rocky Wrench up just ahead: a stomper jumps onto him.
    if (p.def.stomps) {
      for (const th of ts) {
        if (!(th.e instanceof RockyWrench) || !th.e.exposed) continue;
        const dx = th.box.x - right;
        if (dx > 4 && dx < 30 && Math.abs(th.box.y + 16 - feet) < 4) {
          held = true;
          airDir = go;
          return [go, 'jump', ...out];
        }
      }
    }

    const roomAhead = right < camX + SCREEN_W - margin || left < camX + 40 || cam.x >= cam.maxX || past;
    const tOn = firstHit(dir * walk);
    const tStand = firstHit(0);
    const tBack = firstHit(-walk);
    const wantJump = wall || pit || toPipe;
    const walkOn = (pressed = false): Action[] => {
      // A pit's far side must be on screen before the jump, and the jump's arc clear.
      if (pit && right + 48 > camX + SCREEN_W) return out;
      if (wantJump && !pressed && jumpHit() !== Infinity && left > camX + 12) return out;
      // A gap wants a run-up (Simon's jump is committed at takeoff): from a near standstill at
      // the edge, step back first.
      const cap = p.def.movement.maxWalk;
      if (pit && Math.abs(b.vx) < cap * 0.8 && left > camX + 24) {
        back = 14;
        return [dir > 0 ? 'left' : 'right', ...out];
      }
      if (wantJump) {
        held = true;
        airDir = go;
        return [go, 'jump', ...out];
      }
      return [go, ...out];
    };
    if (roomAhead && tOn === Infinity) return walkOn();
    // The left edge is closing in with a wall ahead: get over it, whatever is flying.
    if (wall && left < camX + 40) return walkOn(true);
    if (tStand === Infinity) return out;
    // Something is coming: get out of its way, ahead (even near the edge) or back.
    if (tOn === Infinity && !pit && !wall) return [go, ...out];
    if (tBack === Infinity && left > camX + 24) return ['left', ...out];
    // Nowhere to stand clear: jump what comes, as late as is safe.
    const soonest = Math.max(tStand, tBack);
    if (soonest <= 14) {
      // Jump only if that gets clear for longer (a jump into another shot is no better).
      const tUp = jumpHit(0);
      const tFwd = pit || wall ? 0 : jumpHit();
      if (Math.max(tUp, tFwd) > soonest) {
        held = true;
        airDir = tFwd > tUp ? go : null;
        return airDir ? [airDir, 'jump', ...out] : ['jump', ...out];
      }
    }
    if (tBack > tStand && left > camX + 24) return ['left', ...out];
    return out;
  }
}
