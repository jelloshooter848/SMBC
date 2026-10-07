import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, vel, velToSub, SUB } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { moveX, type Body } from '../body';
import type { World } from '../../world/world';
import { SCREEN_H } from '@engine/viewport';

export type LiftKind =
  'lift-h' | 'lift-v' | 'lift-fall' | 'lift-up' | 'lift-down' | 'lift-balance' | 'lift-right';

/*
 * Speeds from the original's com/smbc/ground/Platform.as. Its numbers are Flash px (32 px tiles) per
 * second; ours are half that (16 px tiles) per 60 fps frame.
 */
const FPS = 60;
const HALF = 0.5;
/** hWaveRange 60, hWaveSpeed 1.5 rad/s (PT_WAVE_HORIZONTAL): ±30 px, 0.025 rad per frame. */
const H_WAVE_RANGE = px(60 * HALF);
const H_WAVE_STEP = 1.5 / FPS;
/** waveRange 150, waveSpeed 1 rad/s (PT_WAVE_VERTICAL): ±75 px, 1/60 rad per frame. */
const V_WAVE_RANGE = px(150 * HALF);
const V_WAVE_STEP = 1 / FPS;
/** ySpeed 110 px/s (PT_CONSTANT_RISE / PT_CONSTANT_FALL): 0.917 px/frame, in subpixels. */
const Y_SPEED = ((110 * HALF) / FPS) * SUB;
/** fallSpeed 225 px/s (PT_STEP_FALL, applied in setCharOnPlat): 1.875 px/frame, in subpixels. */
const STEP_FALL_SPEED = ((225 * HALF) / FPS) * SUB;
/** ayPullyFall 500 px/s², vyMaxPullyFall 350 px/s (PT_FALLING): in 1/4096 px per frame. */
const PULLY_FALL_ACCEL = vel((500 * HALF) / FPS / FPS);
const PULLY_FALL_MAX = vel((350 * HALF) / FPS);
/** In castles (`level.levNum == 4`) elevators wrap at GLOB_STG_TOP + TILE_SIZE*2 (2 tiles). */
const CASTLE_WRAP_Y = px(2 * 16);

/** How far (px) a descent lift sinks past the screen bottom with its rider before it wraps. */
const DESCENT_DEPTH = 64;

/** Moving platforms. The surface is one-way: you land on it from above and it carries you. */
export class Lift extends Entity {
  readonly kind: LiftKind;
  private readonly originX: number;
  private readonly originY: number;
  private readonly speed: number;
  private t = 0;
  private falling = false;
  private dx = 0;
  private dy = 0;
  /** Position at the end of the last update, so dx/dy also count shift() moves in between. */
  private lastX: number;
  private lastY: number;
  /** Exact y in subpixels for the elevator and drop lifts, whose speeds are fractional. */
  private fy: number;
  readonly len: number;
  /** Set by carry() while a player stands on it this frame (balance lifts read it). */
  ridden = false;
  /** The body carry() last stood on it (balance lifts pop their score there). */
  rider: Body | null = null;
  /** A `lift-right` cloud has been stepped on and is drifting. */
  moving = false;
  /**
   * A down lift in a live `descent` shaft (World sets it to the zone's target): with a rider it
   * sinks on past the screen bottom instead of wrapping, carrying them down into that area, and
   * its planks bear a faint skull mark (the hint).
   */
  descent: { level: string; x: number; y: number } | null = null;

  /**
   * Top-left corner at tile (tx, ty), moved by the map's pixel props `dx` / `dy`. The converter
   * sets them so the lift's centre and top sit where the original's Platform x / y are (centred
   * on its cell, plus the half-tile shifts: tools/levelgen/convert-smbc.mjs `movingPlatform`).
   */
  constructor(kind: LiftKind, tx: number, ty: number, props: Record<string, string | number | boolean>) {
    const len = Number(props.len ?? 3);
    super(px(tx * 16 + Number(props.dx ?? 0)), px(ty * 16 + Number(props.dy ?? 0)), len * 8, 8);
    this.kind = kind;
    this.len = len;
    this.originX = this.body.x;
    this.originY = this.body.y;
    this.lastX = this.body.x;
    this.lastY = this.body.y;
    this.fy = this.body.y;
    // Only the cloud lift reads `speed`: CONSTANT_RIGHT_SPEED 120 px/s = 1 px/frame. The wave
    // lifts ignore the maps' old `range`; their swing is fixed in the original (constants above).
    this.speed = Number(props.speed ?? 0x01000);
    this.despawnMargin = kind === 'lift-v' || kind === 'lift-up' || kind === 'lift-down' ? null : 64;
    this.t = Number(props.phase ?? 0);
  }

  /** Move the platform by a controller (balance lifts); the rider follows through dx/dy. */
  shift(dySub: number): void {
    this.body.y += dySub;
    this.dy += dySub;
  }

  /** Let go: fall off the screen like a step-fall platform. */
  drop(): void {
    this.falling = true;
  }

  get isFalling(): boolean {
    return this.falling;
  }

  update(world: World): void {
    const b = this.body;
    const rodeLastFrame = this.ridden;
    this.ridden = false;
    const castle = world.level.stage === 4;
    switch (this.kind) {
      case 'lift-h':
        // Platform.updateGround PT_WAVE_HORIZONTAL: x = centerX + sin(waveAngle) * hWaveRange,
        // centred on the spot it was placed at (initiate: centerX = x).
        b.x = this.originX + Math.round(Math.sin(this.t * H_WAVE_STEP) * H_WAVE_RANGE);
        break;
      case 'lift-v':
        // PT_WAVE_VERTICAL: y = centerY + sin(waveAngle) * waveRange (down first).
        b.y = this.originY + Math.round(Math.sin(this.t * V_WAVE_STEP) * V_WAVE_RANGE);
        break;
      case 'lift-up':
        // PT_CONSTANT_RISE: back to the bottom (GLOB_STG_BOT) once above resetPos, which is the
        // screen top minus its height, or 2 tiles below the top in castles (initiate).
        this.fy -= Y_SPEED;
        if (this.fy < (castle ? CASTLE_WRAP_Y : -b.h)) this.fy = px(SCREEN_H);
        b.y = Math.round(this.fy);
        break;
      case 'lift-down':
        // PT_CONSTANT_FALL: past the bottom it reappears just above the top, or 2 tiles below
        // the top in castles.
        this.fy += Y_SPEED;
        if (this.fy > px(SCREEN_H + (this.descent && rodeLastFrame ? DESCENT_DEPTH : 0)))
          this.fy = castle ? CASTLE_WRAP_Y : -b.h;
        b.y = Math.round(this.fy);
        break;
      case 'lift-right':
        // Waits for a rider, then drifts right for good (the coin-heaven cloud).
        if (this.moving) b.x += velToSub(this.speed);
        break;
      case 'lift-fall':
        // PT_STEP_FALL only moves in setCharOnPlat, i.e. while someone stands on it; it waits
        // where it is when the rider leaves (updateGround has no StepFall branch).
        if (rodeLastFrame) {
          this.fy += STEP_FALL_SPEED;
          b.y = Math.round(this.fy);
        }
        if (this.isBelowLevel()) this.destroy();
        break;
      case 'lift-balance':
        // After the rope snaps: PT_FALLING, vy += ayPullyFall up to vyMaxPullyFall.
        if (this.falling) {
          b.vy += PULLY_FALL_ACCEL;
          if (b.vy > PULLY_FALL_MAX) b.vy = PULLY_FALL_MAX;
          b.y += velToSub(b.vy);
          if (this.isBelowLevel()) this.destroy();
        }
        break;
    }
    this.t++;
    this.dx = b.x - this.lastX;
    this.dy = b.y - this.lastY;
    this.lastX = b.x;
    this.lastY = b.y;
  }

  /** Land the rider on the surface and move it along. Called after the rider moved. */
  carry(rider: Body, world: World): void {
    const b = this.body;
    const top = b.y;
    const prevTop = top - this.dy;
    const riderBottom = rider.y + rider.h;
    const horiz = rider.x < b.x + b.w && rider.x + rider.w > b.x;
    if (!horiz) return;
    // Landing or still standing: the rider was on or above last frame's surface and is now at or
    // below the higher of the two (a sinking lift drops away from a standing rider by more
    // than his 1-subpixel ground probe; he still rides it, as the original copies the
    // platform's vy into him in AnimatedObject.groundBelow).
    // (A jump of a whole screen is an elevator wrapping round; that drops its rider.)
    if (
      rider.vy >= 0 &&
      Math.abs(this.dy) < px(8) &&
      rider.prevBottom <= prevTop + px(2) &&
      riderBottom >= Math.min(top, prevTop) &&
      riderBottom <= top + px(12)
    ) {
      rider.y = top - rider.h;
      rider.vy = 0;
      rider.onGround = true;
      // The original moves the rider (Character.checkPlatform `nx += dxPlatform`, or
      // Platform.updateGround for the cloud lift) before its ground hit test, so walls still
      // stop him (Character.groundOnSide). Carry through the same wall check as walking.
      if (this.dx !== 0) {
        const wall = rider.hitWall;
        moveX(rider, world.map, this.dx);
        if (rider.hitWall === 0) rider.hitWall = wall;
      }
      this.ridden = true;
      this.rider = rider;
      if (this.kind === 'lift-right') this.moving = true;
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    // One 8 px plank per `len` segment, so the drawing is exactly the body's width (a len=3
    // lift is 24 px; whole 16 px platforms overhung it by 8 px).
    for (let i = 0; i < this.len; i++) r.sprite(sheet, 'plank', x + i * 8, y);
    if (this.descent) drawSkullMark(r, x + ((this.len * 8) >> 1) - 2, y + 2);
  }
}

/**
 * The descent lift's hint: a tiny dim skull (5×4 px) on the middle plank, bone grey so it only
 * shows to someone looking.
 */
function drawSkullMark(r: Renderer, x: number, y: number): void {
  const bone = '#a8a8a8';
  r.rect(x, y, 5, 3, bone);
  r.rect(x + 1, y + 3, 3, 1, bone);
  r.rect(x + 1, y + 1, 1, 1, '#000000');
  r.rect(x + 3, y + 1, 1, 1, '#000000');
}
