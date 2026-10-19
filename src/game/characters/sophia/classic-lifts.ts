import type { InputFrame } from '@engine/input/input-manager';
import type { AudioSink } from '@engine/audio/audio-manager';
import { px, sign, tileAt, velToSub } from '@engine/math/units';
import { JUMP_BUFFER_FRAMES } from '../../constants';
import { moveX, type Body } from '../../entities/body';
import type { Player } from '../../entities/player';
import { Lift } from '../../entities/objects/lift';
import type { TileMap } from '../../world/tilemap';
import type { World } from '../../world/world';
import {
  becomeUpright,
  controls,
  driveSophia,
  hasCeilingClimb,
  hasWallClimb,
  startTurn,
  tickHoverBar,
  type Controls,
} from './drive';
import {
  DRIVE_ACCEL,
  DRIVE_MAX,
  FRICTION,
  MIN_SPEED,
  OUTSIDE_END_PX,
  SQUAT_FRAMES,
  SWIM_WALL_MAX,
  TANK_H,
  TANK_W,
  TURN_OUTSIDE,
} from './profile';
import { CEIL, FLOOR, LEFT, RIGHT, sophiaState, type SophiaState, type Surface } from './state';

/*
 * Classic SMBC Sophia III on moving lifts (SO-38, SO-M12; Sophia.as:1168-1196 the floor and
 * ceiling wraps, 1376-1383 the side wraps, 2317-2336 attaching, 2794-2860 checkPlatform, 2903-2914
 * the underside grip). With Wall Climb (the Crusher) she wraps from a lift's top down onto its
 * side and on round onto its underside (and back), and a rising jump grips its underside. While
 * attached she rides it: each frame, after the lifts have moved, she is put back where she was
 * on it (World.resolveLifts, CharacterBehaviour.afterLifts). She lets go more than MAX_PLAT_DIST
 * (100 Flash px: 50 px) from its centre (an elevator wrapping round), when it is gone, or when the
 * lift pushes her into a wall. On its top she is an ordinary rider (Lift.carry): falling and
 * pulley lifts behave as for every hero; like the original's setCharOnPlat, they also feel her
 * hanging on a side or underneath.
 *
 * Her drive (CharacterBehaviour.drive) runs this file first: while she holds a lift it drives
 * her along it here (the shared drive.ts knows only tiles), else the shared drive runs.
 */

/** MAX_PLAT_DIST 100 Flash px. */
export const MAX_PLAT_DIST = 50;
/** CLIMB_INVERTED_OFS 8 Flash px: her centre this far past a lift's edge starts a wrap. */
const WRAP_OFS = px(OUTSIDE_END_PX);

const UW = px(TANK_W);
const UH = px(TANK_H);

interface LiftRide {
  /** The lift she holds on a side or underneath (or is turning onto or round). */
  hold: Lift | null;
  /** That lift's position after the last frame's follow (subpixels). */
  lx: number;
  ly: number;
  /** The lift she stood on last frame (Lift.carry). */
  standing: Lift | null;
  /** Down held this frame (the underside grip waits for it to be let go, as groundAbove). */
  down: boolean;
}
const RIDES = new WeakMap<Player, LiftRide>();

function ride(p: Player): LiftRide {
  let r = RIDES.get(p);
  if (!r) {
    r = { hold: null, lx: 0, ly: 0, standing: null, down: false };
    RIDES.set(p, r);
  }
  return r;
}

/** The lift she holds on a side or underneath, or is turning onto (tests). */
export function heldLift(p: Player): Lift | null {
  return RIDES.get(p)?.hold ?? null;
}

const centreX = (b: Body): number => b.x + (b.w >> 1);
const centreY = (b: Body): number => b.y + (b.h >> 1);
const dims = (s: Surface): [number, number] => (s === LEFT || s === RIGHT ? [UH, UW] : [UW, UH]);

function boxBlocked(map: TileMap, b: Body): boolean {
  for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
    for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++) if (map.isSolid(tx, ty)) return true;
  return false;
}

function grab(r: LiftRide, lift: Lift): void {
  r.hold = lift;
  r.lx = lift.body.x;
  r.ly = lift.body.y;
}

/** Let go of the lift she holds: upright where she is, falling. */
function release(p: Player, st: SophiaState, r: LiftRide): void {
  r.hold = null;
  if (st.surface !== FLOOR || st.turn) {
    becomeUpright(p, st);
    p.body.vx = 0;
    p.body.vy = 0;
  }
}

/** One frame of Classic Sophia III's driving (CharacterBehaviour.drive). */
export function classicDrive(
  p: Player,
  input: InputFrame,
  map: TileMap,
  audio: AudioSink,
  onHeadBump?: (tx: number, ty: number) => void,
): boolean {
  const st = sophiaState(p);
  const r = ride(p);
  r.down = input.held('down');
  if (st.jason) {
    r.hold = null;
    return driveSophia(p, input, map, audio, onHeadBump);
  }
  // Back on a floor (the turn onto a lift's top ended, a hit, a let-go): no longer holding.
  if (r.hold && ((st.surface === FLOOR && !st.turn) || st.nose || !r.hold.alive)) r.hold = null;
  if (r.hold && !st.turn) return liftFrame(p, st, r, r.hold, input, map, audio, onHeadBump);
  if (!r.hold && r.standing?.alive && offTop(p, st, r, r.standing, input, map)) return true;
  return driveSophia(p, input, map, audio, onHeadBump);
}

/**
 * On a lift's top, forward and Down drive her round its end onto its side (Sophia.as:1168-1182:
 * her centre within CLIMB_INVERTED_OFS of the edge).
 */
function offTop(
  p: Player,
  st: SophiaState,
  r: LiftRide,
  lift: Lift,
  input: InputFrame,
  map: TileMap,
): boolean {
  const b = p.body;
  if (st.surface !== FLOOR || st.turn || st.nose || st.push || st.squat > 0 || !b.onGround) return false;
  if (!hasWallClimb(p)) return false;
  const c = controls(FLOOR, input);
  const f = c.along;
  if (f === 0 || c.both || !c.into || c.away) return false;
  const L = lift.body;
  const edge = f > 0 ? L.x + L.w : L.x;
  const cx = centreX(b);
  if (f > 0 ? cx + WRAP_OFS < edge : cx - WRAP_OFS > edge) return false;
  const to = f > 0 ? LEFT : RIGHT;
  if (!startTurn(p, st, TURN_OUTSIDE, to, edge + f * (UH >> 1), centreY(L), 1, map)) return false;
  grab(r, lift);
  return true;
}

const damp = (v: number, k: number): number => Math.trunc(v * k);

function driveAlong(v: number, c: Controls): number {
  if (c.along !== 0 && !c.both) v += c.along * DRIVE_ACCEL;
  else v = damp(v, FRICTION);
  return v;
}

function clampAlong(v: number, cap: number): number {
  if (v > cap) v = cap;
  else if (v < -cap) v = -cap;
  if (Math.abs(v) < MIN_SPEED) v = 0;
  return v;
}

/** A frame on a lift's side or underside (not turning). */
function liftFrame(
  p: Player,
  st: SophiaState,
  r: LiftRide,
  lift: Lift,
  input: InputFrame,
  map: TileMap,
  audio: AudioSink,
  onHeadBump?: (tx: number, ty: number) => void,
): boolean {
  const b = p.body;
  // The squat's last frame: the shared drive takes off (a push away from the lift).
  if (st.squat === 1) {
    r.hold = null;
    return driveSophia(p, input, map, audio, onHeadBump);
  }
  if (st.squat > 1) st.squat--;
  const c = controls(st.surface, input);
  if (input.bufferedJump(JUMP_BUFFER_FRAMES) && st.squat === 0) {
    input.consumeJumpBuffer();
    if (c.into) {
      // Let go (Down + Jump underneath, toward the lift on a side).
      release(p, st, r);
      return true;
    }
    st.squat = SQUAT_FRAMES;
  }
  const L = lift.body;
  const fwd = c.along !== 0 && !c.both && st.squat === 0;
  p.fallSpeed = 0;
  p.anim = 'walk';
  tickHoverBar(p, st);
  b.onGround = false;
  if (st.surface === CEIL) {
    if (c.along !== 0 && !c.both) {
      st.dir = c.along;
      p.facing = c.along;
    }
    b.vx = clampAlong(driveAlong(b.vx, c), p.inWater ? SWIM_WALL_MAX : DRIVE_MAX);
    b.vy = 0;
    moveX(b, map, velToSub(b.vx));
    const d = c.along !== 0 && !c.both ? c.along : (sign(b.vx) as -1 | 0 | 1);
    if (d !== 0) {
      const edge = d > 0 ? L.x + L.w : L.x;
      const cx = centreX(b);
      if (d > 0 ? cx + WRAP_OFS >= edge : cx - WRAP_OFS <= edge) {
        // Forward at the end: up round it onto the side; else she stops there (Sophia.as:1172-1185).
        const to = d > 0 ? LEFT : RIGHT;
        if (fwd && startTurn(p, st, TURN_OUTSIDE, to, edge + d * (UH >> 1), centreY(L), -1, map)) return true;
        b.x = edge - d * WRAP_OFS - (b.w >> 1);
        b.vx = 0;
      }
    }
    b.y = L.y + L.h;
    return true;
  }
  // On a side: she cannot drive along it (it is shorter than she is); Up wraps her over onto its
  // top, Down round onto its underside (Sophia.as:1376-1383).
  b.vx = 0;
  b.vy = 0;
  const left = st.surface === LEFT;
  const face = left ? L.x + L.w : L.x;
  b.x = left ? face : face - b.w;
  b.y = centreY(L) - (b.h >> 1);
  if (fwd) {
    const into = left ? -1 : 1;
    if (c.along < 0)
      startTurn(p, st, TURN_OUTSIDE, FLOOR, face + into * WRAP_OFS, L.y - (UH >> 1), into, map);
    else if (hasCeilingClimb(p))
      startTurn(p, st, TURN_OUTSIDE, CEIL, face + into * WRAP_OFS, L.y + L.h + (UH >> 1), into, map);
  }
  return true;
}

/** Put her box at the turn's spot for its frame t (as drive.ts turnFrame does). */
function placeTurn(b: Body, st: SophiaState): void {
  const t = st.turn as NonNullable<SophiaState['turn']>;
  const k = Math.min(1, t.t / t.frames);
  const cx = Math.round(t.fromX + (t.toX - t.fromX) * k);
  const cy = Math.round(t.fromY + (t.toY - t.fromY) * k);
  const [w, h] = dims(st.surface);
  b.w = w;
  b.h = h;
  b.x = cx - (w >> 1);
  b.y = cy - (h >> 1);
  b.vx = 0;
  b.vy = 0;
  b.onGround = false;
}

/**
 * After the lifts moved and carried their riders (CharacterBehaviour.afterLifts): follow the
 * lift she holds, finish a turn onto its top, or grip the underside of one her rising jump meets.
 */
export function afterLifts(p: Player, world: World): void {
  const st = sophiaState(p);
  const r = ride(p);
  const b = p.body;
  r.standing = null;
  for (const e of world.entities)
    if (e instanceof Lift && e.alive && e.ridden && e.rider === b) r.standing = e;
  if (st.jason || p.dead) {
    r.hold = null;
    return;
  }
  const lift = r.hold;
  if (lift) {
    const L = lift.body;
    if (!lift.alive) return release(p, st, r);
    const dx = L.x - r.lx;
    const dy = L.y - r.ly;
    r.lx = L.x;
    r.ly = L.y;
    // checkPlatform: too far from the lift's centre (it jumped: an elevator wrapping round).
    const far = px(MAX_PLAT_DIST);
    if (Math.abs(centreX(b) - centreX(L)) > far || Math.abs(centreY(b) - centreY(L)) > far)
      return release(p, st, r);
    if (st.turn) {
      // Mid-turn the corner moves with the lift.
      st.turn.fromX += dx;
      st.turn.toX += dx;
      st.turn.fromY += dy;
      st.turn.toY += dy;
      placeTurn(b, st);
    } else if (st.surface === FLOOR) {
      // The turn onto its top just ended: standing on it, a rider from here on (Lift.carry).
      b.y = L.y - b.h;
      b.prevBottom = b.y + b.h;
      b.vy = 0;
      b.onGround = true;
      r.hold = null;
      r.standing = lift;
    } else if (st.surface === CEIL) {
      b.x += dx;
      b.y = L.y + L.h;
    } else {
      b.x = st.surface === LEFT ? L.x + L.w : L.x - b.w;
      b.y = centreY(L) - (b.h >> 1);
    }
    if (boxBlocked(world.map, b)) return release(p, st, r);
    // Platform.setCharOnPlat: she weighs on it wherever she holds it.
    lift.ridden = true;
    lift.rider = b;
    if (lift.kind === 'lift-right') lift.moving = true;
    return;
  }
  // The underside grip (Sophia.as groundAbove): rising, upright, Ceiling Climb, Down not held, not
  // hovering; her top meets a lift's underside with her centre under it.
  if (st.surface !== FLOOR || st.turn || st.nose || st.engaged || r.down || !hasCeilingClimb(p)) return;
  const rising = st.push ? st.push.dy === -1 : b.vy < 0;
  if (!rising || (p.inWater && !st.push)) return;
  const cx = centreX(b);
  for (const e of world.entities) {
    if (!(e instanceof Lift) || !e.alive) continue;
    const L = e.body;
    if (cx < L.x || cx > L.x + L.w) continue;
    if (b.y > L.y + L.h || b.y < L.y - px(4)) continue;
    const y = b.y;
    b.y = L.y + L.h;
    if (boxBlocked(world.map, b)) {
      b.y = y;
      continue;
    }
    st.surface = CEIL;
    st.attached = true;
    st.push = null;
    st.coasting = false;
    st.squat = 0;
    b.vy = 0;
    b.onGround = false;
    st.dir = p.facing;
    grab(r, e);
    e.ridden = true;
    e.rider = b;
    return;
  }
}
