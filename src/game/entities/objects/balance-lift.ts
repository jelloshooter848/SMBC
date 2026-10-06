import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, SUB } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import { Lift } from './lift';

/*
 * com/smbc/ground/Platform.as (PT_PULLY), in Flash px (32 px tiles) per second, halved for our 16 px
 * tiles and taken per 60 fps frame. Speeds here are in px/frame.
 */
const FPS = 60;
/** ayPully 200 px/s²: a rider speeds his platform up by this much each frame (setCharOnPlat). */
const ACCEL = (200 * 0.5) / FPS / FPS;
/** vyMaxPully 275 px/s. */
const MAX_SPEED = (275 * 0.5) / FPS;
/** fyPully 0.0006: with nobody on either platform the speed is multiplied by 0.0006 per second. */
const FRICTION = Math.pow(0.0006, 1 / FPS);
/** vyMinPully 20 px/s: below this a coasting pair stops (updatePully). */
const MIN_SPEED = (20 * 0.5) / FPS;
/** ScoreValue.PULLY_FALL: popped at the rider when the rope snaps. */
const SNAP_SCORE = 1000;
const ROPE_COLOUR = '#d8b878';

/**
 * Two platforms on a rope over a pair of pulleys. Standing on one lowers it and raises the
 * other; pull one up to its pulley and both drop. This entity owns the rope and pulleys and
 * spawns the two `lift-balance` platforms it drives.
 */
export class BalanceLift extends Entity {
  readonly kind = 'balance';
  private left: Lift | null = null;
  private right: Lift | null = null;
  private slack = false;
  private readonly x1: number;
  private readonly x2: number;
  /** px from a cell's left edge to its platform's: centred on the cell (Level.as `currentX + TILE_SIZE/2`). */
  private readonly dx: number;
  private readonly y2: number;
  private readonly len: number;
  private readonly topRow: number;
  /** Speed of the left platform in px/frame, down positive; the right one mirrors it. */
  private v = 0;
  /** Exact y of the left platform (subpixels) and the constant sum of both platforms' y. */
  private fy = 0;
  private ySum = 0;
  /** Where the left platform is: at its pulley ('top'), at the bottom, or between. */
  private loc: 'top' | 'mid' | 'bottom' = 'mid';

  constructor(tx: number, ty: number, props: Record<string, string | number | boolean>) {
    const len = Number(props.len ?? 6);
    const dx = 8 - len * 4;
    super(px(tx * 16 + dx), px(ty * 16), 16, 8);
    this.x1 = tx;
    this.x2 = Number(props.x2 ?? tx + 4);
    this.y2 = Number(props.y2 ?? ty);
    this.len = len;
    this.dx = dx;
    this.topRow = Number(props.top ?? ty - 4);
    this.layer = 'back';
    this.despawnMargin = 64;
    this.body.vx = 0;
  }

  /** px: y of the rope line over the pulleys. */
  get ropeY(): number {
    return this.topRow * 16 + 8;
  }

  get platforms(): [Lift, Lift] | null {
    return this.left && this.right ? [this.left, this.right] : null;
  }

  /** Platform.yMin: one tile below the pulley corners. */
  private get yMin(): number {
    return px((this.topRow + 1) * 16);
  }

  update(world: World): void {
    if (!this.left || !this.right) {
      const opts = { len: this.len, dx: this.dx };
      this.left = new Lift('lift-balance', this.x1, this.body.y / px(16), opts);
      this.right = new Lift('lift-balance', this.x2, this.y2, opts);
      world.spawn(this.left);
      world.spawn(this.right);
      this.fy = this.left.body.y;
      this.ySum = this.left.body.y + this.right.body.y;
      return;
    }
    if (this.slack) return;
    const l = this.left;
    const r = this.right;
    // Platform.setCharOnPlat for each ridden platform: snap the rope when it is already at the
    // bottom, else speed it up downwards. With a rider on each (co-op) the pulls cancel; sum them
    // and move the pair once, so it never moves twice in a frame.
    if (l.ridden && this.loc === 'bottom') return this.snap(world, l);
    if (r.ridden && this.loc === 'top') return this.snap(world, r);
    if (l.ridden || r.ridden) {
      const pull = (l.ridden ? ACCEL : 0) - (r.ridden ? ACCEL : 0);
      this.v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.v + pull));
      this.move();
      return;
    }
    if (this.v === 0) return;
    // Platform.updatePully: nobody on either, so the pair coasts and slows down.
    this.v *= FRICTION;
    if (Math.abs(this.v) < MIN_SPEED) this.v = 0;
    this.move();
  }

  /** The rope snaps: 1000 points at the rider's centre (scorePop at hMidX, hMidY) and both fall. */
  private snap(world: World, p: Lift): void {
    const rider = p.rider ?? p.body;
    world.addScore(SNAP_SCORE, rider.x + (rider.w >> 1), rider.y + (rider.h >> 1));
    this.left?.drop();
    this.right?.drop();
    this.slack = true;
  }

  /** Platform.movePartner: the partner mirrors the move; either one at its pulley stops both. */
  private move(): void {
    const l = this.left as Lift;
    const r = this.right as Lift;
    const yMin = this.yMin;
    const yMax = this.ySum - yMin;
    this.fy += this.v * SUB;
    if (this.fy <= yMin) {
      this.fy = yMin;
      this.v = 0;
      this.loc = 'top';
    } else if (this.fy >= yMax) {
      this.fy = yMax;
      this.v = 0;
      this.loc = 'bottom';
    } else this.loc = 'mid';
    // Whole pixels, so the two platforms (and their ropes) stay mirror images on screen.
    const y = Math.round(this.fy / SUB) * SUB;
    l.shift(y - l.body.y);
    r.shift(this.ySum - y - r.body.y);
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    const lx = toPx(this.body.x) - view.camX;
    const rx = this.x2 * 16 + this.dx - view.camX;
    const ropeY = this.ropeY;
    const halfW = (this.len * 8) / 2;
    // Rope across the top, then down to each platform's centre.
    r.rect(lx + halfW, ropeY, rx - lx, 1, ROPE_COLOUR);
    if (!this.slack && this.left && this.right) {
      r.rect(lx + halfW, ropeY, 1, toPx(this.left.body.y) - ropeY, ROPE_COLOUR);
      r.rect(rx + halfW, ropeY, 1, toPx(this.right.body.y) - ropeY, ROPE_COLOUR);
    }
    r.sprite(sheet, 'pulley', lx + halfW - 8, ropeY - 8);
    r.sprite(sheet, 'pulley', rx + halfW - 8, ropeY - 8, true);
  }
}
