import type { InputFrame } from '@engine/input/input-manager';
import type { AudioSink } from '@engine/audio/audio-manager';
import { px, sign, tileAt, tileToSub, velToSub } from '@engine/math/units';
import { JUMP_BUFFER_FRAMES } from '../../constants';
import { moveX, moveY, type Body } from '../../entities/body';
import type { Player } from '../../entities/player';
import type { TileMap } from '../../world/tilemap';
import {
  BUMP_VY,
  CEILING_PUSH_PX,
  DRIVE_ACCEL,
  DRIVE_MAX,
  FALL_MAX,
  FRICTION,
  GRAVITY,
  HOLD_DAMPING,
  HOVER_CELLS,
  HOVER_DRAIN,
  HOVER_FILL,
  HOVER_THRUST,
  HOVER_VMAX,
  INSIDE_END_PX,
  MIN_SPEED,
  OUTSIDE_END_PX,
  RELEASE_DAMPING,
  RISE,
  RISE_PX,
  SQUAT_FRAMES,
  SWIM_DOWN_DAMP,
  SWIM_DOWN_KICK,
  SWIM_FLOOR_MAX,
  SWIM_RISE_PX,
  SWIM_SINK_SUB,
  SWIM_THRUST,
  SWIM_UP_DAMP,
  SWIM_VMAX,
  SWIM_WALL_MAX,
  SWIM_X_FAST,
  SWIM_X_MAX,
  TANK_H,
  TANK_W,
  TURN_INSIDE,
  TURN_OUTSIDE,
  TURN_REACH,
  WALL_PUSH_PX,
  WRAP_REACH,
} from './profile';
import { CEIL, FLOOR, LEFT, RIGHT, SOUNDS, sophiaState, type SophiaState, type Surface } from './state';

/*
 * Sophia III's own driving code (SO-10 to SO-21, SO-35 to SO-37): it replaces the shared
 * walking, jumping and swimming in Player.update while she is in the tank (CharacterBehaviour.
 * drive). Each frame, in the original's order: the squat, the jump state (a push in progress),
 * driving along the surface, gravity (or hover thrust, or swimming), the clamps, then the move.
 * Gravity comes before the move, so every launch speed is used as written (SO-10).
 */

/** The box upright (floor, air, ceiling) and on a wall, in subpixels. */
const UW = px(TANK_W);
const UH = px(TANK_H);

/** Owns Hover (Hyper and up: a Mushroom). */
export const hasHover = (p: Player): boolean => p.powerState === 'big' || p.powerState === 'fire';
/** Owns Wall Climb and Ceiling Climb (Crusher: a Flower). */
export const hasClimb = (p: Player): boolean => p.powerState === 'fire';

/** A visible solid tile she can drive on (inside the map: the level's side edges don't count). */
const climbable = (map: TileMap, tx: number, ty: number): boolean =>
  map.inBounds(tx, ty) && map.isSolid(tx, ty);

/** Any solid tile under the box (out-of-map sides count, as for walking). */
function boxBlocked(map: TileMap, x: number, y: number, w: number, h: number): boolean {
  for (let ty = tileAt(y); ty <= tileAt(y + h - 1); ty++)
    for (let tx = tileAt(x); tx <= tileAt(x + w - 1); tx++) if (map.isSolid(tx, ty)) return true;
  return false;
}

/** Box size for a surface: turned on a wall. */
const dims = (s: Surface): [number, number] => (s === LEFT || s === RIGHT ? [UH, UW] : [UW, UH]);

/** Put the box at centre (cx, cy) with the surface's size. */
function place(b: Body, s: Surface, cx: number, cy: number): void {
  const [w, h] = dims(s);
  b.w = w;
  b.h = h;
  b.x = cx - (w >> 1);
  b.y = cy - (h >> 1);
}

const centreX = (b: Body): number => b.x + (b.w >> 1);
const centreY = (b: Body): number => b.y + (b.h >> 1);

/**
 * Turn upright where she is (detach, a push ending, a hit). From a wall the upright box keeps its
 * edge on the wall face (SO-36 detachFromWall). Nudged clear of tiles when the turn would overlap
 * them (a corner).
 */
export function becomeUpright(p: Player, st: SophiaState): void {
  const b = p.body;
  const was = st.surface;
  const cy = centreY(b);
  let x: number;
  if (was === LEFT) x = b.x;
  else if (was === RIGHT) x = b.x + b.w - UW;
  else x = centreX(b) - (UW >> 1);
  let y = cy - (UH >> 1);
  const map = lastMap.get(p);
  if (map && boxBlocked(map, x, y, UW, UH)) {
    // Try small shifts away from what she touches: sideways first, then up and down.
    const tries: [number, number][] = [];
    for (let d = 1; d <= 8; d++) tries.push([d, 0], [-d, 0], [0, -d], [0, d]);
    const hit = tries.find(([dx, dy]) => !boxBlocked(map, x + px(dx), y + px(dy), UW, UH));
    if (hit) {
      x += px(hit[0]);
      y += px(hit[1]);
    }
  }
  b.w = UW;
  b.h = UH;
  b.x = x;
  b.y = y;
  st.surface = FLOOR;
  st.attached = false;
  st.turn = null;
  b.onGround = false;
  if (b.vx !== 0) p.facing = sign(b.vx) as -1 | 1;
  st.dir = p.facing;
}

/** The map each player last drove on (becomeUpright's clearance check outside the drive). */
const lastMap = new WeakMap<Player, TileMap>();

/** Inputs read relative to her surface (SO-6): along it, away from it ("up"), into it ("down"). */
interface Controls {
  along: -1 | 0 | 1;
  both: boolean;
  away: boolean;
  into: boolean;
}
function controls(s: Surface, input: InputFrame): Controls {
  const l = input.held('left');
  const r = input.held('right');
  const u = input.held('up');
  const d = input.held('down');
  if (s === FLOOR || s === CEIL) {
    return {
      along: input.dirX,
      both: l && r,
      away: s === FLOOR ? u : d,
      into: s === FLOOR ? d : u,
    };
  }
  return {
    along: u && !d ? -1 : d && !u ? 1 : 0,
    both: u && d,
    away: s === LEFT ? r : l,
    into: s === LEFT ? l : r,
  };
}

/** "Up": away from her surface (the cannon raise, SO-28). */
export function holdsAway(p: Player, input: InputFrame): boolean {
  return controls(sophiaState(p).surface, input).away;
}

const damp = (v: number, k: number): number => Math.trunc(v * k);

/** Speed along the surface after a frame of driving (SO-10 step 3, SO-11). */
function drive(v: number, c: Controls, onSurface: boolean, blocked: boolean, friction: number): number {
  if (c.along !== 0 && !c.both) {
    if (!blocked) v += c.along * DRIVE_ACCEL;
  } else if (c.both || onSurface) v = damp(v, friction);
  return v;
}

function clampAlong(v: number, cap: number): number {
  if (v > cap) v = cap;
  else if (v < -cap) v = -cap;
  if (Math.abs(v) < MIN_SPEED) v = 0;
  return v;
}

/** The hover bar's timers (SO-35): drain while thrusting, refill while not. */
function tickHoverBar(p: Player, st: SophiaState): void {
  if (!hasHover(p)) return;
  if (st.hovering) {
    st.fillT = 0;
    if (p.star > 0) return;
    if (++st.drainT >= HOVER_DRAIN) {
      st.drainT = 0;
      st.cells = Math.max(0, st.cells - 1);
    }
  } else if (st.cells < HOVER_CELLS) {
    if (++st.fillT >= HOVER_FILL) {
      st.fillT = 0;
      st.cells++;
    }
  }
}

/** The take-off at the end of the squat (SO-12, SO-13; walls and ceilings SO-36; water SO-18). */
function takeoff(p: Player, st: SophiaState, input: InputFrame, audio: AudioSink): void {
  const b = p.body;
  st.released = !input.held('jump');
  st.coasting = false;
  if (st.surface === FLOOR) {
    const limit = p.inWater ? (input.held('down') ? RISE_PX : SWIM_RISE_PX) : RISE_PX;
    st.push = { dx: 0, dy: -1, from: b.y, limit };
    b.vy = -RISE;
  } else if (st.surface === CEIL) {
    st.attached = false;
    st.push = { dx: 0, dy: 1, from: b.y, limit: CEILING_PUSH_PX };
    b.vy = RISE;
  } else {
    const dx = st.surface === LEFT ? 1 : -1;
    st.attached = false;
    st.push = { dx, dy: 0, from: b.x, limit: WALL_PUSH_PX };
    b.vx = dx * RISE;
  }
  b.onGround = false;
  audio.sfx(SOUNDS.jump);
}

/**
 * One frame of Sophia III in the tank. Returns false while Jason is out on foot: the shared
 * Player code moves him.
 */
export function driveSophia(
  p: Player,
  input: InputFrame,
  map: TileMap,
  audio: AudioSink,
  onHeadBump?: (tx: number, ty: number) => void,
): boolean {
  const st = sophiaState(p);
  if (st.jason) return false;
  lastMap.set(p, map);
  const b = p.body;
  if (st.vineBox) {
    // Off the vine: back to the upright box, feet where they were.
    st.vineBox = false;
    const feet = b.y + b.h;
    const cx = centreX(b);
    b.w = UW;
    b.h = UH;
    b.x = cx - (UW >> 1);
    b.y = feet - UH;
    if (boxBlocked(map, b.x, b.y, UW, UH)) {
      const hit = [1, -1, 2, -2, 3, -3, 4, -4].find((d) => !boxBlocked(map, b.x + px(d), b.y, UW, UH));
      if (hit !== undefined) b.x += px(hit);
    }
  }
  if (st.turn) {
    turnFrame(p, st);
    return true;
  }
  // 1. The squat: the take-off comes on its 4th frame, even off a ledge (SO-12).
  const tookOff = st.squat > 0 && --st.squat === 0;
  if (tookOff) takeoff(p, st, input, audio);
  if (st.surface === FLOOR) upright(p, st, input, map, audio, tookOff, onHeadBump);
  else if (!st.attached) wallPush(p, st, input, map);
  else if (st.surface === CEIL) ceiling(p, st, input, map);
  else wall(p, st, input, map);
  tickHoverBar(p, st);
  p.fallSpeed = b.onGround ? 0 : b.vy;
  p.anim =
    st.surface !== FLOOR
      ? 'walk'
      : !b.onGround
        ? p.inWater
          ? 'swim'
          : 'jump'
        : b.vx !== 0
          ? 'walk'
          : 'idle';
  return true;
}

/** Floor and air, upright (SO-10 to SO-21, SO-35, SO-37's grip). */
function upright(
  p: Player,
  st: SophiaState,
  input: InputFrame,
  map: TileMap,
  audio: AudioSink,
  tookOff: boolean,
  onHeadBump?: (tx: number, ty: number) => void,
): void {
  const b = p.body;
  const c = controls(FLOOR, input);
  const water = p.inWater;
  const grounded = b.onGround;
  if (grounded && !st.push) {
    st.engaged = false;
    st.hovering = false;
    st.coasting = false;
  }
  if (!input.held('jump')) st.released = true;
  if (p.launched && (b.vy >= 0 || grounded)) p.launched = false;

  // Jump: a squat from the floor; in the air with the hover, engage it (SO-12, SO-35).
  if (grounded && st.squat === 0 && !st.push && input.bufferedJump(JUMP_BUFFER_FRAMES)) {
    input.consumeJumpBuffer();
    st.squat = SQUAT_FRAMES;
  } else if (
    !grounded &&
    !tookOff &&
    input.pressed('jump') &&
    !water &&
    hasHover(p) &&
    (st.cells > 0 || p.star > 0) &&
    !(st.push && st.push.dy === 1)
  ) {
    input.consumeJumpBuffer();
    st.engaged = true;
    if (st.push && st.push.dy === -1) st.push = null; // the hover takes over from the rise
    st.coasting = false;
    p.launched = false;
  }

  // Wall Climb from the floor: an inside turn up a wall ahead, or round a ledge (SO-36).
  if (grounded && !st.push && st.squat === 0 && hasClimb(p) && startFloorTurn(p, st, c, map)) return;

  // 2. The jump state: the rise ends at its height (put exactly there).
  const pu = st.push;
  if (pu) {
    const gone = pu.dy !== 0 ? (b.y - pu.from) * pu.dy : (b.x - pu.from) * pu.dx;
    if (gone >= px(pu.limit)) {
      if (pu.dy !== 0) b.y = pu.from + pu.dy * px(pu.limit);
      st.push = null;
      st.coasting = pu.dy === -1;
    }
  }

  // 3. Along the floor (or air).
  const offFloor = !grounded;
  let cap = DRIVE_MAX;
  if (water) cap = !offFloor ? SWIM_FLOOR_MAX : input.held('jump') || st.push ? SWIM_X_FAST : SWIM_X_MAX;
  const friction = FRICTION;
  const swimming = water && offFloor && !st.push;
  // Off the floor in water, friction only with both held; on land in the air, never.
  b.vx = drive(b.vx, c, grounded, b.hitWall === c.along && c.along !== 0, friction);
  if (c.along !== 0 && !c.both) {
    p.facing = c.along;
    st.dir = c.along;
  }
  b.vx = clampAlong(b.vx, cap);

  // 4. Gravity, hover thrust, or swimming.
  let sink = 0;
  const hoverHeld = st.engaged && input.held('jump') && (st.cells > 0 || p.star > 0) && !water;
  st.hovering = false;
  if (st.push) {
    // A rise or push: constant speed, gravity off.
  } else if (swimming) {
    const up = input.held('up');
    const down = input.held('down');
    if (input.pressed('down') && b.vy === 0) b.vy = SWIM_DOWN_KICK;
    else if (up && !down) b.vy -= SWIM_THRUST;
    else if (down && !up) b.vy += SWIM_THRUST;
    else {
      b.vy = damp(b.vy, b.vy < 0 ? SWIM_UP_DAMP : SWIM_DOWN_DAMP);
      if (Math.abs(b.vy) < MIN_SPEED) b.vy = 0;
      sink = SWIM_SINK_SUB;
    }
    if (b.vy > SWIM_VMAX) b.vy = SWIM_VMAX;
    if (b.vy < -SWIM_VMAX) b.vy = -SWIM_VMAX;
  } else {
    if (hoverHeld) {
      st.hovering = true;
      b.vy -= HOVER_THRUST;
      if (b.vy < -HOVER_VMAX) b.vy = -HOVER_VMAX;
    } else if (b.vy < 0 && (st.coasting || st.engaged || p.launched)) {
      const k = (st.engaged && !p.launched) || (st.coasting && st.released) ? RELEASE_DAMPING : HOLD_DAMPING;
      b.vy = damp(b.vy, k);
      if (b.vy >= 0) st.coasting = false;
    }
    b.vy += GRAVITY;
    // 5. The fall clamp (no SMB1 reset).
    if (b.vy > FALL_MAX) b.vy = FALL_MAX;
  }

  // 6. Move: x, then y; her head strikes every block it touches (SO-17, SO-42).
  const vyBefore = b.vy;
  moveX(b, map, velToSub(b.vx));
  const struck: [number, number][] = [];
  moveY(b, map, velToSub(b.vy) + sink, {
    bumpAll: true,
    cornerFreeTiles: 2,
    onHeadBump: (tx, ty) => struck.push([tx, ty]),
  });
  if (b.hitHead) {
    if (canGrip(p, st, input, map, struck, vyBefore)) {
      st.surface = CEIL;
      st.attached = true;
      st.push = null;
      st.coasting = false;
      b.vy = 0;
      st.dir = p.facing;
    } else {
      const rising = st.push !== null || st.coasting;
      if (rising) {
        st.push = null;
        st.coasting = false;
        b.vy = BUMP_VY;
      }
      // No bumps after a hover, or while swimming off a jump (SO-20, SO-35, SO-42).
      if (!st.engaged && !swimming) for (const [tx, ty] of struck) onHeadBump?.(tx, ty);
    }
  }
  if (b.onGround) {
    if (!grounded && vyBefore > GRAVITY) audio.sfx(SOUNDS.land);
    if (st.push && st.push.dy !== -1) st.push = null;
    st.coasting = false;
    st.engaged = false;
    p.launched = false;
    b.vy = 0;
  }
  // The water's surface holds her under (SO-19) unless she touches a wall.
  if (water && Number.isFinite(st.waterTop) && b.hitWall === 0) {
    const line = st.waterTop - px(7);
    if (b.y < line) {
      b.y = line;
      if (b.vy < 0) b.vy = 0;
      if (st.push?.dy === -1) st.push = null;
    }
  }
}

/** SO-37: a rising, upright Crusher grips the visible ceiling her head meets. */
function canGrip(
  p: Player,
  st: SophiaState,
  input: InputFrame,
  map: TileMap,
  struck: readonly [number, number][],
  vy: number,
): boolean {
  if (!hasClimb(p) || vy >= 0 || input.held('down') || st.engaged) return false;
  if (p.inWater && !st.push) return false;
  return struck.some(([tx, ty]) => climbable(map, tx, ty) && ty < map.height - 1);
}

/** Start a turn: the centres are subpixels, `dir` the heading on the new surface. */
function startTurn(
  p: Player,
  st: SophiaState,
  frames: number,
  to: Surface,
  toX: number,
  toY: number,
  dir: -1 | 1,
  map: TileMap,
): boolean {
  const [w, h] = dims(to);
  if (boxBlocked(map, toX - (w >> 1), toY - (h >> 1), w, h)) return false;
  const b = p.body;
  st.turn = {
    t: 0,
    frames,
    to,
    fromX: centreX(b),
    fromY: centreY(b),
    toX,
    toY,
    dir,
    speed: p.inWater ? SWIM_WALL_MAX : DRIVE_MAX,
    from: st.surface,
  };
  st.squat = 0;
  st.push = null;
  b.vx = 0;
  b.vy = 0;
  b.onGround = false;
  return true;
}

/** A turn's frame: the centre slides to the new spot; the pose and box swap at its midpoint. */
function turnFrame(p: Player, st: SophiaState): void {
  const t = st.turn as NonNullable<SophiaState['turn']>;
  const b = p.body;
  t.t++;
  const k = Math.min(1, t.t / t.frames);
  const cx = Math.round(t.fromX + (t.toX - t.fromX) * k);
  const cy = Math.round(t.fromY + (t.toY - t.fromY) * k);
  if (t.t * 2 >= t.frames && st.surface !== t.to) {
    st.surface = t.to;
    st.attached = t.to !== FLOOR;
  }
  place(b, st.surface, cx, cy);
  b.vx = 0;
  b.vy = 0;
  b.onGround = false;
  if (t.t < t.frames) return;
  st.turn = null;
  st.dir = t.dir;
  st.wallFromFloor = t.from === FLOOR && (t.to === LEFT || t.to === RIGHT);
  if (t.to === FLOOR || t.to === CEIL) {
    b.vx = t.dir * t.speed;
    p.facing = t.dir;
  } else b.vy = t.dir * t.speed;
  if (t.to === FLOOR) b.onGround = true;
}

/**
 * From the floor (SO-36): forward and Up into a wall ahead drives up it (inside corner); forward
 * and Down off a ledge wraps down its face (outside corner).
 */
function startFloorTurn(p: Player, st: SophiaState, c: Controls, map: TileMap): boolean {
  const b = p.body;
  const f = c.along;
  if (f === 0 || c.both || c.away === c.into) return false;
  const cx = centreX(b);
  const feet = b.y + b.h;
  const row = tileAt(feet - 1);
  if (c.away) {
    // Up a wall: a solid tile in her row within 12 px ahead of her centre, room above the cell
    // in front of it.
    const wcol = tileAt(cx + f * px(TURN_REACH));
    if (!climbable(map, wcol, row)) return false;
    if (map.isSolid(wcol - f, row - 1)) return false;
    const face = f > 0 ? tileToSub(wcol) : tileToSub(wcol + 1);
    const to = f > 0 ? RIGHT : LEFT;
    return startTurn(p, st, TURN_INSIDE, to, face - f * (UH >> 1), feet - px(INSIDE_END_PX), -1, map);
  }
  // Down a cliff face: the last floor tile under her in the way she drives.
  const floorRow = tileAt(feet);
  const first = tileAt(f > 0 ? b.x + b.w - 1 : b.x);
  const last = tileAt(f > 0 ? b.x : b.x + b.w - 1);
  for (let col = first; f > 0 ? col >= last : col <= last; col -= f) {
    if (!climbable(map, col, floorRow)) continue;
    if (map.collisionAt(col + f, floorRow) !== 'none') return false;
    const ecx = tileToSub(col) + px(8);
    if (Math.abs(cx - ecx) > px(WRAP_REACH)) return false;
    const face = f > 0 ? tileToSub(col + 1) : tileToSub(col);
    const to = f > 0 ? LEFT : RIGHT;
    return startTurn(
      p,
      st,
      TURN_OUTSIDE,
      to,
      face + f * (UH >> 1),
      tileToSub(floorRow) + px(OUTSIDE_END_PX),
      1,
      map,
    );
  }
  return false;
}

/** Move along y on a wall: stops at solid tiles (no bumps, no corner slips). */
function slideY(b: Body, map: TileMap, dy: number): boolean {
  if (dy === 0) return false;
  b.y += dy;
  const l = tileAt(b.x);
  const r = tileAt(b.x + b.w - 1);
  if (dy > 0) {
    const row = tileAt(b.y + b.h - 1);
    for (let tx = l; tx <= r; tx++)
      if (map.isSolid(tx, row)) {
        b.y = tileToSub(row) - b.h;
        return true;
      }
  } else {
    const row = tileAt(b.y);
    for (let tx = l; tx <= r; tx++)
      if (map.isSolid(tx, row)) {
        b.y = tileToSub(row + 1);
        return true;
      }
  }
  return false;
}

/**
 * Where the surface beside her ends in direction `d`, scanning from her rear: the coordinate of
 * the edge (subpixels along the axis), or null when it goes on past her front. A one-tile gap
 * with more surface after it is driven across (she is wider than it).
 */
function edgeAhead(
  map: TileMap,
  fixed: number,
  vertical: boolean,
  from: number,
  front: number,
  d: -1 | 1,
): number | null {
  const at = (i: number) => (vertical ? climbable(map, fixed, i) : climbable(map, i, fixed));
  let i = tileAt(from);
  const end = tileAt(front) + d * 2;
  // Find the first tile of surface from her rear on.
  while (!at(i) && i !== end) i += d;
  for (; i !== end; i += d) {
    if (at(i + d)) continue;
    if (at(i + 2 * d)) {
      i += d;
      continue;
    }
    return d > 0 ? tileToSub(i + 1) : tileToSub(i);
  }
  return null;
}

/** On a wall (SO-36): up and down drive; corners turn; the end of the wall stops or wraps. */
function wall(p: Player, st: SophiaState, input: InputFrame, map: TileMap): void {
  const b = p.body;
  const left = st.surface === LEFT;
  const c = controls(st.surface, input);
  const wcol = left ? tileAt(b.x - 1) : tileAt(b.x + b.w);
  const face = left ? b.x : b.x + b.w;
  // Detach when the wall is gone behind her: rear end, middle and front end (SO-36).
  if (![b.y + px(1), centreY(b), b.y + b.h - px(1)].some((y) => climbable(map, wcol, tileAt(y)))) {
    becomeUpright(p, st);
    return;
  }
  if (input.bufferedJump(JUMP_BUFFER_FRAMES) && st.squat === 0) {
    input.consumeJumpBuffer();
    if (c.into) {
      // Let go: only when the upright box fits (checkDropFromWall).
      const x = left ? face : face - UW;
      if (!boxBlocked(map, x, centreY(b) - (UH >> 1), UW, UH)) {
        b.vx = 0;
        becomeUpright(p, st);
        return;
      }
    } else st.squat = SQUAT_FRAMES;
  }
  if (c.along !== 0 && !c.both) st.dir = c.along;
  b.vy = drive(b.vy, c, true, false, FRICTION);
  b.vy = clampAlong(b.vy, p.inWater ? SWIM_WALL_MAX : DRIVE_MAX);
  b.vx = 0;
  const d = c.along !== 0 && !c.both ? c.along : (sign(b.vy) as -1 | 0 | 1);
  const fwd = c.along !== 0 && !c.both && st.squat === 0;
  if (d !== 0) {
    const cy = centreY(b);
    const front = d < 0 ? b.y : b.y + b.h - 1;
    // Inside corner: a ceiling (up) or the floor (down) within 12 px of her centre.
    const aheadRow = tileAt(cy + d * px(TURN_REACH));
    const l = tileAt(b.x);
    const r = tileAt(b.x + b.w - 1);
    let ahead = false;
    for (let tx = l; tx <= r; tx++) if (climbable(map, tx, aheadRow)) ahead = true;
    if (ahead && fwd) {
      const out = left ? 1 : -1;
      if (d > 0) {
        const floorY = tileToSub(aheadRow);
        const toX = face + out * (px(INSIDE_END_PX) + 0);
        if (startTurn(p, st, TURN_INSIDE, FLOOR, toX, floorY - (UH >> 1), out as -1 | 1, map)) return;
      } else if (hasClimb(p)) {
        const ceilY = tileToSub(aheadRow + 1);
        if (
          startTurn(
            p,
            st,
            TURN_INSIDE,
            CEIL,
            face + out * px(INSIDE_END_PX),
            ceilY + (UH >> 1),
            out as -1 | 1,
            map,
          )
        )
          return;
      }
    }
    // Outside corner: the wall ends ahead.
    const edge = edgeAhead(map, wcol, true, d < 0 ? b.y + b.h - 1 : b.y, front, d);
    const dy = velToSub(b.vy);
    if (edge !== null && (d < 0 ? b.y + dy <= edge : b.y + b.h + dy >= edge)) {
      // Clamp to the edge, then wrap round it (forward held) or stop there.
      if (d < 0) b.y = edge;
      else b.y = edge - b.h;
      b.vy = 0;
      if (fwd && (d < 0 || hasClimb(p))) {
        const into = left ? -1 : 1;
        const toX = face + into * px(OUTSIDE_END_PX);
        if (d < 0) {
          if (startTurn(p, st, TURN_OUTSIDE, FLOOR, toX, edge - (UH >> 1), into as -1 | 1, map)) return;
        } else if (startTurn(p, st, TURN_OUTSIDE, CEIL, toX, edge + (UH >> 1), into as -1 | 1, map)) return;
      }
      return;
    }
  }
  if (slideY(b, map, velToSub(b.vy))) b.vy = 0;
  b.onGround = false;
}

/** On a ceiling (SO-36, SO-37): left and right drive upside down. */
function ceiling(p: Player, st: SophiaState, input: InputFrame, map: TileMap): void {
  const b = p.body;
  const c = controls(CEIL, input);
  const crow = tileAt(b.y - 1);
  if (![b.x + px(1), centreX(b), b.x + b.w - px(1)].some((x) => climbable(map, tileAt(x), crow))) {
    becomeUpright(p, st);
    b.vy = 0;
    return;
  }
  if (input.bufferedJump(JUMP_BUFFER_FRAMES) && st.squat === 0) {
    input.consumeJumpBuffer();
    if (c.into) {
      b.vy = 0;
      becomeUpright(p, st);
      return;
    }
    st.squat = SQUAT_FRAMES;
  }
  if (c.along !== 0 && !c.both) {
    st.dir = c.along;
    p.facing = c.along;
  }
  b.vx = drive(b.vx, c, true, b.hitWall === c.along && c.along !== 0, FRICTION);
  b.vx = clampAlong(b.vx, p.inWater ? SWIM_WALL_MAX : DRIVE_MAX);
  b.vy = 0;
  const d = c.along !== 0 && !c.both ? c.along : (sign(b.vx) as -1 | 0 | 1);
  const fwd = c.along !== 0 && !c.both && st.squat === 0;
  if (d !== 0) {
    const cx = centreX(b);
    const ceilY = b.y;
    // Inside corner: a wall within 12 px of her centre: down it.
    const acol = tileAt(cx + d * px(TURN_REACH));
    let ahead = false;
    for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++) if (climbable(map, acol, ty)) ahead = true;
    if (ahead && fwd) {
      const faceX = d > 0 ? tileToSub(acol) : tileToSub(acol + 1);
      const to = d > 0 ? RIGHT : LEFT;
      if (startTurn(p, st, TURN_INSIDE, to, faceX - d * (UH >> 1), ceilY + px(INSIDE_END_PX), 1, map)) return;
    }
    // Outside corner: the ceiling ends ahead: up round its end.
    const front = d > 0 ? b.x + b.w - 1 : b.x;
    const edge = edgeAhead(map, crow, false, d > 0 ? b.x : b.x + b.w - 1, front, d);
    const dx = velToSub(b.vx);
    if (edge !== null && (d > 0 ? b.x + b.w + dx >= edge : b.x + dx <= edge)) {
      if (d > 0) b.x = edge - b.w;
      else b.x = edge;
      b.vx = 0;
      if (fwd) {
        const to = d > 0 ? LEFT : RIGHT;
        if (startTurn(p, st, TURN_OUTSIDE, to, edge + d * (UH >> 1), ceilY - px(OUTSIDE_END_PX), -1, map))
          return;
      }
      return;
    }
  }
  moveX(b, map, velToSub(b.vx));
  b.onGround = false;
}

/**
 * A wall jump's push (SO-36): 65 px straight away from the wall at the rise speed, gravity off,
 * up and down still driving along the wall's axis. Meeting another wall face grips it at once;
 * at the end she turns upright and falls. A ceiling jump's push down is the same, 41 px.
 */
function wallPush(p: Player, st: SophiaState, input: InputFrame, map: TileMap): void {
  const b = p.body;
  const pu = st.push;
  if (!pu) {
    becomeUpright(p, st);
    return;
  }
  const gone = pu.dy !== 0 ? (b.y - pu.from) * pu.dy : (b.x - pu.from) * pu.dx;
  if (gone >= px(pu.limit)) {
    if (pu.dy !== 0) b.y = pu.from + pu.dy * px(pu.limit);
    else b.x = pu.from + pu.dx * px(pu.limit);
    st.push = null;
    becomeUpright(p, st);
    return;
  }
  // Hover during a wall jump: upright first (SO-35).
  if (input.pressed('jump') && hasHover(p) && !p.inWater && (st.cells > 0 || p.star > 0)) {
    st.push = null;
    becomeUpright(p, st);
    st.engaged = true;
    return;
  }
  if (pu.dx !== 0) {
    const c = controls(st.surface, input);
    if (c.along !== 0 && !c.both) b.vy = clampAlong(b.vy + c.along * DRIVE_ACCEL, DRIVE_MAX);
    b.vx = pu.dx * RISE;
    moveX(b, map, velToSub(b.vx));
    if (b.hitWall === pu.dx) {
      const col = pu.dx > 0 ? tileAt(b.x + b.w) : tileAt(b.x - 1);
      if ([b.y + px(1), centreY(b), b.y + b.h - px(1)].some((y) => climbable(map, col, tileAt(y)))) {
        // Wall to wall: grip the far wall at once, no turn.
        st.surface = pu.dx > 0 ? RIGHT : LEFT;
        st.attached = true;
        st.push = null;
        b.vx = 0;
        return;
      }
    }
    if (slideY(b, map, velToSub(b.vy))) b.vy = 0;
  } else {
    b.vy = pu.dy * RISE;
    if (slideY(b, map, velToSub(b.vy))) {
      st.push = null;
      becomeUpright(p, st);
      b.vy = 0;
      if (pu.dy > 0) b.onGround = true;
    }
  }
}
