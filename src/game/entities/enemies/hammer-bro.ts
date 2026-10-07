import { px, tileAt, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import { moveX, moveY } from '../body';
import { tileDef } from '../../level/tiles';
import { hasSolidFloors } from '../../level/schema';
import { Projectile, HAMMER } from '../projectiles/projectile';

/*
 * Numbers from com/smbc/enemies/HammerBro.as. The original works in px/s on 32-px tiles with ms
 * timers; here that is halved and taken per frame at 60 fps (velocities in 1/4096 px/f).
 */
/** `WALK_SPEED` 30 px/s: paces at 0.25 px/f. */
const WALK_SPEED = 0x00400;
/** `chaseSpeed` = `Enemy.ENEMY_WALK_SPEED_NORMAL` 65 px/s: 0.54 px/f. */
const CHASE_SPEED = 0x008ab;
/** `xWaveLeft/Right` = nx -/+ TILE_SIZE*.5: paces half a tile either side of its spot (px). */
const PACE_RANGE = 8;
/** `CHASE_TMR_DUR` 27000 ms: after this it walks at a player on its left. */
const CHASE_AFTER = 1620;
/** `JUMP_TMR_DUR_MIN/MAX` 600-2000 ms, run whenever it stands on something. */
const JUMP_MIN = 36;
const JUMP_SPREAD = 84;
/** `HAMMER_TMR_DUR_MIN/MAX` 300-1200 ms, then `HAMMER_DEL_TMR` 250 ms in the throw pose. */
const HAMMER_MIN = 18;
const HAMMER_SPREAD = 54;
const HAMMER_DELAY = 15;
/** `jumpPwr` 625 and `smallJumpPwr` 200 px/s, `gravity` 1250 px/s², `vyMaxPsv` 500 px/s. */
const HIGH_JUMP = 0x05355;
const LOW_JUMP = 0x01aab;
const GRAVITY = 0x002c7;
const MAX_FALL = 0x042ab;
/** A low hop falls through floors for at most 2 tiles (`ny - startJumpLoc > TILE_SIZE*2`). */
const DROP_THROUGH = px(32);
/** Feet from the screen bottom below which it never passes through (`GLOB_STG_BOT - TILE_SIZE*2.9`). */
const SOLID_BELOW = Math.round(px(240 - 2.9 * 16));
/** Feet on the floor (`GLOB_STG_BOT - TILE_SIZE*2`) and on the top brick row (`GLOB_STG_TOP + TILE_SIZE*5`). */
const FLOOR_FEET = px(240 - 32);
const TOP_ROW_FEET = px(5 * 16);

/**
 * Hammer Bro: paces half a tile either side of its spot facing the player, throws single hammers,
 * and jumps up through or hops down through the brick rows every 0.6-2 s. After 27 s it walks at a
 * player on its left (never to the right); a chasing one (The Lost Levels) does so from the start.
 */
export class HammerBro extends Enemy {
  readonly kind = 'hammer-bro';
  private waveLeft = 0;
  private waveRight = 0;
  private age = 0;
  private chasing = false;
  private jumpTimer = 0;
  private hammerTimer = 0;
  private throwDelay = 0;
  private jumped = false;
  private jumpedHigh = false;
  private jumpFeet = 0;
  /** Which way it is pacing. Kept apart from vx, which a wall bump zeroes (`moveX`). */
  private paceDir: -1 | 1 = 1;

  constructor(
    x: number,
    y: number,
    readonly chase = false,
  ) {
    super(x, y, 12, 22);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.scores = ENEMY_SCORES.HAMMER_BRO;
    this.corpseGravity = 0x002c7; // HammerBro.setStats: gravity = 1250 Flash px/s² (0.174 px/f²)
    this.fallsOffLedges = false;
    this.currentFrame = 'hammer-bro-1';
    this.body.vx = WALK_SPEED;
  }

  update(world: World): void {
    const b = this.body;
    const pl = world.nearestPlayer(b.x).body;
    const cx = b.x + (b.w >> 1);
    this.age++;
    const chase = this.chase || this.age >= CHASE_AFTER;

    // Timers (the constructor starts JUMP_TMR; updateStats restarts it while on the ground).
    if (this.age === 1) {
      // initiate(): the pacing range is set where it is when it enters the level.
      this.waveLeft = b.x - px(PACE_RANGE);
      this.waveRight = b.x + px(PACE_RANGE);
      this.jumpTimer = JUMP_MIN + world.rng.int(JUMP_SPREAD);
    }
    if (b.onGround) {
      this.jumped = false;
      if (this.jumpTimer === 0) this.jumpTimer = JUMP_MIN + world.rng.int(JUMP_SPREAD);
    }
    if (this.hammerTimer === 0 && this.throwDelay === 0)
      this.hammerTimer = HAMMER_MIN + world.rng.int(HAMMER_SPREAD);

    // Horizontal: walk at a player on its left once chasing, otherwise pace around its spot.
    if (pl.x + pl.w < cx) {
      if (chase) {
        b.vx = -CHASE_SPEED;
        this.chasing = true;
      } else this.chasing = false;
      this.facing = -1;
    } else {
      if (this.chasing) {
        this.chasing = false;
        this.waveLeft = b.x - px(PACE_RANGE);
        this.waveRight = b.x + px(PACE_RANGE);
      }
      this.facing = pl.x > cx || pl.x + (pl.w >> 1) >= cx ? 1 : -1;
    }
    if (!this.chasing) {
      if (b.x < this.waveLeft) {
        b.x = this.waveLeft;
        this.paceDir = 1;
      } else if (b.x > this.waveRight) {
        b.x = this.waveRight;
        this.paceDir = -1;
      }
      b.vx = this.paceDir * WALK_SPEED;
    }

    // Vertical: jumps pass up through floors, hops pass down through one (passThroughGround).
    if (this.jumpTimer > 0 && --this.jumpTimer === 0 && b.onGround) this.jump(world);
    const feet = b.y + b.h;
    let through = (this.jumpedHigh && b.vy < 0) || (!this.jumpedHigh && this.jumped && b.vy > 0);
    if (feet - this.jumpFeet > DROP_THROUGH || feet > SOLID_BELOW || this.solidFloors(world)) through = false;
    // `if (wallOnLeft || wallOnRight) passThroughGround = false`: never pass through beside a wall
    // (the wall contact of the last frame's hit tests).
    if (b.hitWall !== 0) through = false;

    // While passing through, the original drops its ground and brick hit tests, walls included;
    // and a pass that has just ended inside the row is not shoved sideways out of it.
    if (through || this.embedded(world)) {
      b.x += velToSub(b.vx);
      b.hitWall = 0;
    } else {
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0 && !this.chasing) {
        this.paceDir = b.hitWall > 0 ? -1 : 1;
        b.vx = this.paceDir * WALK_SPEED;
      }
    }

    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY);
    if (through) {
      b.y += velToSub(b.vy);
      b.onGround = false;
    } else {
      moveY(b, world.map, b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy));
      if (b.onGround || b.hitHead) b.vy = 0;
    }

    // Hammers: one at a time, after the timer and a short wind-up in the throw pose.
    if (this.hammerTimer > 0 && --this.hammerTimer === 0) this.throwDelay = HAMMER_DELAY;
    else if (this.throwDelay > 0 && --this.throwDelay === 0) this.throwHammer(world);
    this.currentFrame = this.throwDelay > 0 ? 'hammer-bro-0' : `hammer-bro-${(world.frame >> 3) & 1}`;
    if (this.isBelowLevel()) this.destroy();
  }

  /** Overlapping a solid tile (still inside the brick row a pass-through has just ended in). */
  private embedded(world: World): boolean {
    const b = this.body;
    for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
      for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++)
        if (world.map.isSolid(tx, ty)) return true;
    return false;
  }

  /** Castles and underground (`cannotPassThroughGround`): jumps only go straight up and down. */
  private solidFloors(world: World): boolean {
    return hasSolidFloors(world.level.theme);
  }

  /** HammerBro.jump: high from the floor or off solid ground, a hop down from the top row, else either. */
  private jump(world: World): void {
    const b = this.body;
    const feet = b.y + b.h;
    const under = tileDef(world.map.get(tileAt(b.x + (b.w >> 1)), tileAt(feet)));
    const high =
      feet === FLOOR_FEET || this.solidFloors(world) || under.block?.kind !== 'brick'
        ? true
        : feet === TOP_ROW_FEET
          ? false
          : world.rng.chance(0.5);
    b.vy = -(high ? HIGH_JUMP : LOW_JUMP);
    b.onGround = false;
    this.jumpedHigh = high;
    this.jumped = true;
    this.jumpFeet = feet;
  }

  /**
   * Hammer.as: thrown from `nx ± hWidth*.75`, `ny - height*1.2` (centre), 120 px/s across and
   * 200 px/s up under 500 px/s² (the HAMMER spec), so it rises only about 20 px.
   */
  private throwHammer(world: World): void {
    const b = this.body;
    const x = b.x + (b.w >> 1) + this.facing * px(9) - px(HAMMER.w >> 1);
    const y = b.y + b.h - px(29) - px(HAMMER.h >> 1);
    world.spawn(new Projectile(x, y, this.facing, HAMMER, this));
  }

  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }
}
