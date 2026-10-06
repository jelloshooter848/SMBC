import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import { Spiny } from './spiny';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/*
 * Numbers from com/smbc/enemies/Lakitu.as and com/smbc/level/LakituSpawner.as (NORMAL difficulty).
 * The original works in px/s on 32-px tiles with ms timers; here that is halved and taken per frame
 * at 60 fps (velocities in 1/4096 px/f).
 */
/** `DEF_VX_MAX` 200 px/s: 1.67 px/f. */
const DEF_VX_MAX = 0x01aab;
/** `VX_MAX_INCREASE_NUM` 100 px/s: while following, top speed is the player's plus 0.83 px/f. */
const VX_MAX_INCREASE = 0x00d55;
/** `EXIT_SPEED` 100 px/s: drifts off to the left past the end of the stretch. */
const EXIT_SPEED = 0x00d55;
/** `ax` 200 px/s² (setStats). */
const ACCEL = 0x00072;
/** 50 px/s: the overshoot threshold of the homing swing (checkState). */
const SWING_VX = 0x006ab;
/** `MIN_CHANGE_DIR_DIST` (1 tile) and `edgeBuffer` (2 tiles), in px. */
const SWING_DIST = 16;
const EDGE_BUFFER = 32;
/** `START_FOLLOW_DEL_TMR` 800 ms: holding a direction this long starts the follow. */
const FOLLOW_DELAY = 48;
/** `hideTmrDur` 1500 ms, then `throwTmrDur` 250 ms in the hide pose, then a throw. */
const HIDE_FRAMES = 90;
const THROW_FRAMES = 15;
/** `maxSpinyDifficulty` on NORMAL: this Lakitu's own Spinies alive at once (`SPINEY_DCT`). */
const MAX_SPINIES = 4;
/** `LakituSpawner.spawnDelTmrDur` = 40 × 397 ms (40 TIME units) = 15.88 s on NORMAL. */
const RESPAWN_FRAMES = 953;

/**
 * Lakitu: rides a cloud along the top of the screen, swinging back and forth over the player,
 * follows a player who keeps going one way, and lobs spiny eggs. Drifts off to the left once the
 * player is past the end of its stretch (and comes back if the player returns before it is gone).
 */
export class Lakitu extends Enemy {
  readonly kind = 'lakitu';
  /** Set by its zone while the player is past the end of the stretch (`checkState`, `exiting`). */
  leaving = false;
  /** Still flying in from the right edge until this is set (`withinBoundaries`). */
  private withinBoundaries = false;
  private followDir: -1 | 0 | 1 = 0;
  private following = false;
  private followTimer = 0;
  private hideTimer = HIDE_FRAMES;
  private throwTimer = 0;
  /** At the Spiny cap: throws the moment one of its own is gone (`setState("wait")`). */
  private waiting = false;
  private spinies: Spiny[] = [];

  constructor(x: number, y: number) {
    super(x, y, 12, 20);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.scores = ENEMY_SCORES.LAKITU;
    this.currentFrame = 'lakitu-0';
    this.layer = 'front';
    this.despawnMargin = null;
    this.activated = true;
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    const cam = world.camera;
    const half = b.w >> 1;
    if (this.leaving) {
      // checkState: vx = -EXIT_SPEED, timers stopped, destroyed once off screen.
      b.vx = -EXIT_SPEED;
      b.x += velToSub(b.vx);
      this.currentFrame = 'lakitu-0';
      if (b.x + b.w < cam.x || b.x > cam.right) this.destroy();
      return;
    }
    const pl = world.nearestPlayer(b.x + half);
    const pvx = pl.body.vx;
    const held = pl.heldDirX;
    let vxMax = DEF_VX_MAX;
    // Held at the edge buffer and pushed along by a player moving away from it.
    const lft = cam.x + px(EDGE_BUFFER);
    const rht = cam.right - px(EDGE_BUFFER);
    if (this.withinBoundaries && b.x + half < lft) {
      if (pvx > 0 && b.vx < pvx) b.vx = pvx;
      b.x = lft - half;
    } else if (this.withinBoundaries && b.x + half > rht) {
      if (pvx < 0 && b.vx > pvx) b.vx = pvx;
      b.x = rht - half;
    }
    if (this.followDir !== 0 && held !== this.followDir) this.cancelFollow();
    if (!this.withinBoundaries) {
      b.vx = -vxMax;
      if (b.x + half < rht) this.withinBoundaries = true;
    }
    if (this.following) {
      // Accelerate the way the player is going, up to the player's speed plus a bit.
      if (this.followDir > 0) {
        b.vx += ACCEL;
        if (pvx > DEF_VX_MAX - VX_MAX_INCREASE) vxMax = pvx + VX_MAX_INCREASE;
      } else {
        b.vx -= ACCEL;
        if (pvx < -DEF_VX_MAX + VX_MAX_INCREASE) vxMax = -(pvx - VX_MAX_INCREASE);
      }
    } else {
      if (held !== 0 && this.followTimer === 0) {
        this.followTimer = FOLLOW_DELAY;
        this.followDir = held;
      }
      // Home in on the player's x, overshooting into a back-and-forth swing.
      const cx = b.x + half;
      const near = Math.abs(cx - pl.centerX) < px(SWING_DIST);
      if (cx > pl.centerX) b.vx += near && b.vx > SWING_VX ? ACCEL : -ACCEL;
      else b.vx += near && b.vx < -SWING_VX ? -ACCEL : ACCEL;
    }
    if (this.followTimer > 0 && --this.followTimer === 0) this.following = true;
    b.vx = Math.max(-vxMax, Math.min(vxMax, b.vx));
    b.x += velToSub(b.vx);
    this.facing = pl.centerX < b.x + half ? -1 : 1;

    // Throw cycle: hideTmr, then throwTmr in the hide pose, then a Spiny unless at the cap.
    this.spinies = this.spinies.filter((e) => e.alive);
    if (this.hideTimer > 0 && --this.hideTimer === 0) this.throwTimer = THROW_FRAMES;
    else if (this.throwTimer > 0 && --this.throwTimer === 0) {
      if (this.spinies.length < MAX_SPINIES) this.throwSpiny(world);
      else this.waiting = true;
    }
    if (this.waiting && this.spinies.length < MAX_SPINIES) this.throwSpiny(world);
    this.currentFrame = this.throwTimer > 0 || this.waiting ? 'lakitu-1' : 'lakitu-0';
  }

  private cancelFollow(): void {
    this.followTimer = 0;
    this.following = false;
    this.followDir = 0;
  }

  private throwSpiny(world: World): void {
    const b = this.body;
    const egg = new Spiny(b.x, b.y - px(8));
    egg.body.vx = this.facing * 0x00800;
    egg.body.vy = -0x03000;
    world.spawn(egg);
    this.spinies.push(egg);
    this.waiting = false;
    this.hideTimer = HIDE_FRAMES;
  }

  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }
}

/**
 * Keeps a Lakitu over a stretch of level (`LakituSpawner`): sends one in from the right once the
 * player's middle is past the start column, sends the next one 15.88 s after the last is gone (only
 * while the player is inside the stretch), and tells it to leave while the player is past `end`.
 */
export class LakituZone extends Entity {
  readonly kind = 'lakitu-zone';
  private lakitu: Lakitu | null = null;
  /** Frames left on `spawnDelTmr` (0 = stopped). */
  private respawn = 0;
  private spawnedFirst = false;
  private readonly flyY: number;

  constructor(
    tx: number,
    ty: number,
    private readonly endCol: number,
    mid = false,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    // Fly just under the HUD (it covers the top 32 px), or at mid-screen (Lost Levels "Middle" ends).
    this.flyY = mid ? 112 : Math.max(40, ty * 16 + 24);
    this.despawnMargin = null;
    this.body.vx = 0;
  }

  get current(): Lakitu | null {
    return this.lakitu;
  }

  update(world: World): void {
    // EnemySpawner.updateSpawner: inside while start < player.nx < end (both tile left edges).
    const x = world.nearestPlayer(world.camera.right).centerX;
    const endX = px(this.endCol * 16);
    const inZone = x > this.body.x && x < endX;
    const alive = this.lakitu?.alive ?? false;
    if (alive) (this.lakitu as Lakitu).leaving = x > endX;
    if (this.respawn > 0) {
      if (--this.respawn === 0 && inZone && !alive) this.send(world);
      return;
    }
    if (!inZone || alive) return;
    if (this.spawnedFirst) this.respawn = RESPAWN_FRAMES;
    else this.send(world);
  }

  private send(world: World): void {
    // Lakitu.as: x = locStgRht + width*.5, just past the right edge of the screen.
    const l = new Lakitu(world.camera.right, px(this.flyY));
    this.lakitu = l;
    this.spawnedFirst = true;
    world.spawn(l);
  }

  render(_r: Renderer, _view: View): void {}
}
