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
import { pickJumpTier } from '@game/characters/profile';

/*
 * A bot for Larry's airship deck (any `camera: auto` level ending in a down pipe), playing it
 * like a careful player: it walks right with the scrolling screen but keeps clear of the right
 * edge, jumps walls and pits, and looks a little ahead at everything that hurts (cannonballs,
 * wrenches, Bullet Bills, a Rocky Wrench that is up). Each frame it tries, in order: walk on,
 * stand, step back; the first that stays clear of every threat for the next ~40 frames wins.
 * When none does, it jumps a flat-flying shot as it arrives. Heroes who stomp jump onto a Rocky
 * Wrench that is up; the others swing or shoot at targets in front of them. On the stern deck
 * it hops onto the pipe and presses DOWN. A hero whose jump is committed at takeoff (Simon) jumps
 * a wall only once the arc clears it, and never jumps a shot onto the screen's left edge.
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
  let downT = 0;
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
      const wide = right - left > 16;
      const overPipe =
        stern !== undefined &&
        b.vy > 0 &&
        feet <= pipeTop &&
        ((left >= pipeL - 2 && right <= pipeL + 34) ||
          // A body wider than a tile (Sophia III) over the pipe at all: brake toward its middle.
          (wide && right > pipeL && left < pipeL + 32));
      // Where the drift carries it over the next few frames (a hero that keeps its speed in the
      // air, Sophia III's tank, has to brake against it).
      const mid = (left + right) / 2 + (wide ? (b.vx / 4096) * 8 : 0) - (pipeL + 16);
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
    // (Now and then UP instead: Samus's DOWN can roll her into the Morph Ball, UP stands her up.)
    if (stern && Math.abs(feet - pipeTop) <= 1 && right > pipeL && left < pipeL + 32) {
      // On the pipe's top: shuffle in over its middle (with a pixel to spare), then down.
      const mid = (b.x + b.w / 2) / 256 - (pipeL + 16);
      if (left < pipeL + 2 || right > pipeL + 30) return [mid > 0 ? 'left' : 'right'];
      return ++downT % 40 < 32 ? ['down'] : ['up'];
    }

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
    // Standing still near a gap's edge while still sliding toward it (Luigi's slippery feet):
    // brake against the slide.
    const gapNear = [6, 14, 22].some((d) => {
      for (let y = row + 1; y < 15; y++) if (w.map.isSolid(ahead(d), y)) return false;
      return true;
    });
    const hold = (): Action[] => (gapNear && dir * b.vx > 0 ? [dir > 0 ? 'left' : 'right', ...out] : out);

    // Threat look-ahead for walking on, standing, stepping back.
    const ts = threats(w);
    // Walking speed over the next second: from the current speed up toward the walk cap.
    const walk = (Math.abs(b.vx) / 4096 + p.def.movement.maxWalk / 4096) / 2;
    // Walls stop a walk: how far can the hero go that way (px)?
    const reach = (v: number): number => {
      if (v === 0) return 0;
      for (let d = 1; d <= LOOK * 2; d++) {
        const edge = v > 0 ? right + d : left - d;
        const col = Math.floor(edge / 16);
        if (w.map.isSolid(col, row) || (feet - top > 16 && w.map.isSolid(col, row - 1))) return d - 1;
      }
      return LOOK * 2;
    };
    const firstHit = (v: number): number => {
      const far = reach(v);
      for (let t = 1; t <= LOOK; t++) {
        let x = left + Math.sign(v) * Math.min(Math.abs(v) * t, far);
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
    const committed = p.def.movement.airControl === 'none';
    /** Would a jump taken now, with no steering, get the feet over the wall ahead before its face? */
    const clearsWall = (): boolean => {
      let face = -1;
      for (let d = 1; d <= 48 && face < 0; d++) {
        const col = ahead(d);
        if (height(col) > 0 || w.map.isSolid(col, row - 1)) face = col;
      }
      if (face < 0) return true;
      const gap = dir > 0 ? face * 16 - right : left - (face + 1) * 16;
      let n = 0;
      while (n < 8 && w.map.isSolid(face, row - n)) n++;
      const need = feet - (row - n + 1) * 16;
      const jt = pickJumpTier(p.def.movement, b.vx);
      let vx = (dir * b.vx) / 4096;
      let vy = -jt.initial;
      let rise = 0;
      let moved = 0;
      for (let t = 1; t <= 120; t++) {
        rise -= vy / 4096;
        vy += vy < 0 ? jt.holdGravity : jt.fallGravity;
        if (rise < 0) return false;
        moved += vx;
        if (moved > gap) {
          if (rise >= need) return true;
          // Bumped the face: the arc goes on straight up from there.
          moved = gap;
          vx = 0;
        }
        // The screen's left edge pushes a hero going right along (into the face: squashed).
        if (dir > 0 && camX + speed * t - left > moved) {
          moved = camX + speed * t - left;
          if (moved > gap) return rise >= need;
        }
      }
      return false;
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
      if (pit && right + 48 > camX + SCREEN_W) return hold();
      if (wantJump && !pressed && jumpHit() !== Infinity && left > camX + 12) return hold();
      // A gap wants a run-up (Simon's jump is committed at takeoff): from a near standstill at
      // the edge, step back first.
      const cap = p.def.movement.maxWalk;
      if (pit && Math.abs(b.vx) < cap * 0.8 && left > camX + 24) {
        back = 14;
        return [dir > 0 ? 'left' : 'right', ...out];
      }
      // A committed jump (Simon) at a wall: take off only once the arc clears its top, else walk
      // on to gain speed (a jump made slowly, or still moving back after a back-off, hits its face).
      if (wall && committed && !clearsWall()) return [go, ...out];
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
    if (tStand === Infinity) return hold();
    // Something is coming: get out of its way, ahead (even near the edge) or back.
    if (tOn === Infinity && !pit && !wall) return [go, ...out];
    if (tBack === Infinity && left > camX + 24) return ['left', ...out];
    // Nowhere to stand clear: jump what comes, as late as is safe.
    const soonest = Math.max(tStand, tBack);
    if (soonest <= 24) {
      // Jump only if that gets clear for longer (a jump into another shot is no better).
      // An unsteered jump keeps the takeoff speed (a committed arc, Simon's, has no other): judge
      // that jump, and never take one that comes down against the screen's left edge (made while
      // stepping back, it can carry the hero back over a cannon, to be pushed into it).
      const vNow = b.vx / 4096;
      const tUp = jumpHit(vNow);
      const tFwd = pit || wall || committed ? 0 : jumpHit();
      const air = ((tier?.initial ?? 0x04000) / (tier?.holdGravity ?? 0x00200)) * 2;
      const upClear = left + vNow * air > camX + speed * air + 16;
      if (tFwd > soonest && tFwd > tUp) {
        held = true;
        airDir = go;
        return [go, 'jump', ...out];
      }
      if (upClear && tUp > soonest) {
        held = true;
        airDir = null;
        return ['jump', ...out];
      }
    }
    if (tBack > tStand && left > camX + 24) return ['left', ...out];
    return hold();
  }
}
