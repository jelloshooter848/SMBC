import { px, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';

// Bloopa.as, Flash px/s at 32 px tiles: /2/60 for px/f, /2/3600 for px/f².
/** `ySpeed = 80`: the steady sink (defyGrav, so no gravity). */
const SINK_SPEED = 0x00aab; // 0.667 px/f
/** `axy = 700`: the rise accelerates up and toward the player on both axes. */
const RISE_ACCEL = 0x0018e; // 0.097 px/f²
/** `fxy = .000001` per second, applied as fxy^dt: about ×0.794 a frame. */
const RISE_FRICTION = Math.pow(0.000001, 1 / 60);
/** The rise ends when |vy| < 50. */
const RISE_END = 0x006ab; // 0.417 px/f
/** `yMaxDist = 50`: friction starts once it has risen this far. */
const RISE_DIST = px(25);
/** Friction also starts once its bottom is within 4 tiles of the stage top (line 112). */
const RISE_TOP = px(64);
/** `MAX_BOTTOM_Y = STAGE_HEIGHT - TILE_SIZE*3.5`: it never sinks its bottom below this. */
const MAX_BOTTOM = px(184);
/** `moveDelTmrDur = 200` ms of sinking before it may rise again. */
const WAIT_FRAMES = 12;

/**
 * Blooper (Bloopa.as): sinks steadily; once its 200 ms wait is over it rises as soon as the
 * player's feet are above its bottom (or its bottom passes MAX_BOTTOM), with a quick burst up and
 * toward the player that friction slows to a stop. Ignores tiles. In water it is not stompable
 * and stays under the surface; out of water (The Lost Levels) it swims through the air the same
 * way and can be stomped for 1000 points (setStats: `stompable = !level.waterLevel`).
 */
export class Blooper extends Enemy {
  readonly kind = 'blooper';
  private state: 'wait' | 'ready' | 'chase' = 'wait';
  private t = 0;
  private goRight = false;
  private yStart = 0;
  private braking = false;
  private setUp = false;

  constructor(x: number, y: number) {
    super(x, y, 12, 20);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'blooper-1';
    this.scores = ENEMY_SCORES.BLOOPA;
    this.stompable = false;
    this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker' };
    this.body.vx = 0;
    this.body.vy = SINK_SPEED;
  }

  update(world: World): void {
    const b = this.body;
    const water = Number.isFinite(world.waterTop);
    if (!this.setUp) {
      this.setUp = true;
      if (!water) {
        this.stompable = true;
        this.vulnerability = { ...this.vulnerability, stomp: 'flip' };
      }
    }
    const pl = world.nearestPlayer(b.x).body;
    const bottom = b.y + b.h;
    if (this.state === 'wait' && ++this.t >= WAIT_FRAMES) this.state = 'ready';
    if (this.state === 'ready' && (pl.y + pl.h < bottom || bottom > MAX_BOTTOM)) {
      this.state = 'chase';
      this.yStart = bottom;
      this.goRight = pl.x + pl.w / 2 > b.x + b.w / 2;
      b.vx = 0;
      b.vy = 0;
    }
    if (this.state === 'chase') {
      b.vy -= RISE_ACCEL;
      b.vx += this.goRight ? RISE_ACCEL : -RISE_ACCEL;
      if (this.yStart - bottom > RISE_DIST || bottom < RISE_TOP) this.braking = true;
      if (this.braking) {
        b.vx = Math.trunc(b.vx * RISE_FRICTION);
        b.vy = Math.trunc(b.vy * RISE_FRICTION);
        if (Math.abs(b.vy) < RISE_END) {
          b.vx = 0;
          b.vy = SINK_SPEED;
          this.braking = false;
          this.state = 'wait';
          this.t = 0;
        }
      }
    }
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    this.currentFrame = this.state === 'chase' ? 'blooper-0' : 'blooper-1';
    // Stay under the surface in water, and above the floor.
    if (water && b.y < world.waterTop + px(8)) b.y = world.waterTop + px(8);
    if (b.y + b.h > px(13 * 16)) b.y = px(13 * 16) - b.h;
    if (b.vx !== 0) this.facing = b.vx > 0 ? 1 : -1;
  }
}
