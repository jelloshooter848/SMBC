import type { InputFrame } from '@engine/input/input-manager';
import { px, tileAt, tileToSub } from '@engine/math/units';
import type { Player } from '../../entities/player';
import { T } from '../../level/tiles';
import type { TileMap } from '../../world/tilemap';
import type { World } from '../../world/world';

/*
 * Mega Man 2's ladders, for Station Escape's NES form only (nes-form.ts calls `ladderStep` each
 * frame; the campaign's Mega Man never does). From memory of the NES game, not measured:
 *
 * - UP with a ladder behind his middle takes hold of it (on the floor, or catching it in the
 *   air); DOWN standing on a ladder's top takes it down. He snaps to the ladder's centre.
 * - UP / DOWN climb at 0.75 px a frame; nothing held, he hangs still (no gravity).
 * - LEFT / RIGHT only turn him; SHOOT fires that way from the ladder (the side-on shooting
 *   frame), and he holds still while the shot's pose lasts.
 * - JUMP lets go: he drops (no jump up off a ladder). A hit knocks him off it too.
 * - Climbing down onto a floor stands him on it; down past a ladder's foot in the air drops him.
 * - At the top he climbs over: the last few px in the climb-over frame, then he stands on the
 *   ladder's top (a floor tile you can stand on and climb through).
 *
 * The ladder tiles are `chain` (the ladder) and `cloud-ledge` (its top in a floor, one-way
 * solid), drawn as a ladder in the station theme. While he holds a ladder Player.update is
 * skipped (`frozen`): this moves him instead. `scratch.ladder` is the ladder's column,
 * `scratch.ladderTop` its top row.
 */

/** Climbing speed: 0.75 px a frame (subpixels). */
export const LADDER_SPEED = px(0.75);
/** The last px below a ladder's top in which he shows the climb-over frame. */
export const CLIMB_OVER_PX = 8;
/** Where DOWN on a ladder's top puts his feet: this far below it (px, in the climb-over). */
const DOWN_START_PX = 6;
/** Frames after letting go during which a ladder cannot be taken again. */
const GRAB_LOCK = 8;
/** Distance climbed (px) per change of the climbing frame. */
const STEP_PX = 6;

/** A ladder or a ladder's top. */
export function isLadder(map: TileMap, tx: number, ty: number): boolean {
  const t = map.get(tx, ty);
  return t === T.CHAIN || t === T.CLOUD_LEDGE;
}

/** Is he on a ladder? */
export function onLadder(p: Player): boolean {
  return p.scratch.ladder !== undefined;
}

/** In the climb-over frame (the top of a ladder)? */
export function climbingOver(p: Player): boolean {
  return onLadder(p) && (p.scratch.climbOver ?? 0) > 0;
}

/** The highest ladder row of the ladder at column `tx` that runs through row `ty`. */
function ladderTop(map: TileMap, tx: number, ty: number): number {
  let y = ty;
  while (y > 0 && isLadder(map, tx, y - 1)) y--;
  return y;
}

/** Takes hold of the ladder at column `tx` (one of its rows is `ty`). */
function grab(p: Player, map: TileMap, tx: number, ty: number): void {
  const b = p.body;
  p.scratch.ladder = tx;
  p.scratch.ladderTop = ladderTop(map, tx, ty);
  p.scratch.climbOver = 0;
  p.scratch.climbStep = 0;
  p.frozen = true;
  p.sliding = 0;
  p.jumping = false;
  p.fallSpeed = 0;
  p.walkFrame = 0;
  b.x = tileToSub(tx) + px(8) - (b.w >> 1);
  b.vx = 0;
  b.vy = 0;
  b.onGround = false;
  p.anim = 'climb';
}

/** Off the ladder: gravity and Player.update take him again. */
export function letGoLadder(p: Player): void {
  if (!onLadder(p)) return;
  delete p.scratch.ladder;
  p.scratch.climbOver = 0;
  p.scratch.ladderLock = GRAB_LOCK;
  p.frozen = false;
  p.body.vy = 0;
  p.anim = p.body.onGround ? 'idle' : 'jump';
}

/**
 * One frame of ladders for `p` (run before the kit's update, from nes-form.ts): taking hold, climbing,
 * letting go. Returns whether he is on a ladder now.
 */
export function ladderStep(p: Player, input: InputFrame, world: World): boolean {
  const b = p.body;
  const map = world.map;
  if ((p.scratch.ladderLock ?? 0) > 0) p.scratch.ladderLock = (p.scratch.ladderLock ?? 0) - 1;
  if (p.dead || p.hidden || world.beaming) return onLadder(p);
  const cx = tileAt(b.x + (b.w >> 1));
  if (!onLadder(p)) {
    if (p.stun > 0 || p.sliding > 0 || (p.scratch.ladderLock ?? 0) > 0) return false;
    if (input.held('up')) {
      const mid = tileAt(b.y + (b.h >> 1));
      const feet = tileAt(b.y + b.h - 1);
      // Standing on a ladder's top, UP does nothing (the ladder is below him).
      if (isLadder(map, cx, mid) || isLadder(map, cx, feet)) {
        grab(p, map, cx, isLadder(map, cx, mid) ? mid : feet);
        return true;
      }
    } else if (input.held('down') && b.onGround) {
      const below = tileAt(b.y + b.h);
      if (map.get(cx, below) === T.CLOUD_LEDGE) {
        grab(p, map, cx, below);
        b.y = tileToSub(below) + px(DOWN_START_PX) - b.h;
        p.scratch.climbOver = 1;
        return true;
      }
    }
    return false;
  }

  const tx = p.scratch.ladder as number;
  // A hit knocks him off (the knockback plays out once he is free).
  if (p.stun > 0 || p.anim === 'hurt') {
    letGoLadder(p);
    return false;
  }
  if (input.bufferedJump(4)) {
    input.consumeJumpBuffer();
    letGoLadder(p);
    return false;
  }
  if (input.dirX !== 0) p.facing = input.dirX > 0 ? 1 : -1;
  p.anim = 'climb';
  let dy = 0;
  // The shot's pose holds him still.
  if (p.attackTimer <= 0) {
    if (input.held('up')) dy = -LADDER_SPEED;
    else if (input.held('down')) dy = LADDER_SPEED;
  }
  if (dy !== 0) {
    p.scratch.climbStep = (p.scratch.climbStep ?? 0) + Math.abs(dy);
    if ((p.scratch.climbStep ?? 0) >= px(STEP_PX)) {
      p.scratch.climbStep = 0;
      p.walkFrame = (p.walkFrame + 1) & 1;
    }
  }
  b.y += dy;
  b.vx = 0;
  b.vy = 0;
  b.onGround = false;
  const feet = b.y + b.h;
  const top = tileToSub(p.scratch.ladderTop ?? 0);
  // Over the top: he stands on it.
  if (feet <= top) {
    b.y = top - b.h;
    b.onGround = true;
    letGoLadder(p);
    p.anim = 'idle';
    return false;
  }
  p.scratch.climbOver = feet - top <= px(CLIMB_OVER_PX) ? 1 : 0;
  if (dy > 0) {
    // Down onto a floor: he stands on it.
    const row = tileAt(feet);
    if (map.isSolid(tx, row) || (map.get(tx, row) !== T.CLOUD_LEDGE && map.collisionAt(tx, row) === 'top')) {
      b.y = tileToSub(row) - b.h;
      b.onGround = true;
      letGoLadder(p);
      return false;
    }
    // Down past the ladder's foot in the air: he drops.
    if (!isLadder(map, tx, tileAt(b.y + (b.h >> 1))) && !isLadder(map, tx, tileAt(feet - 1))) {
      letGoLadder(p);
      return false;
    }
  }
  return true;
}
