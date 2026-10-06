import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Body } from '../body';
import type { World } from '../../world/world';
import { SCREEN_H } from '@engine/viewport';

export type LiftKind =
  'lift-h' | 'lift-v' | 'lift-fall' | 'lift-up' | 'lift-down' | 'lift-balance' | 'lift-right';

/** Moving platforms. The surface is one-way: you land on it from above and it carries you. */
export class Lift extends Entity {
  readonly kind: LiftKind;
  private readonly originX: number;
  private readonly originY: number;
  private readonly range: number; // subpixels
  private readonly speed: number;
  private t = 0;
  private falling = false;
  private dx = 0;
  private dy = 0;
  readonly len: number;
  /** Set by carry() while a player stands on it this frame (balance lifts read it). */
  ridden = false;
  /** A `lift-right` cloud has been stepped on and is drifting. */
  moving = false;

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
    this.range = px(Number(props.range ?? 4) * 16);
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

  update(): void {
    const b = this.body;
    const prevX = b.x;
    const prevY = b.y;
    this.ridden = false;
    this.t++;
    switch (this.kind) {
      case 'lift-h': {
        // back and forth over `range`
        const period = Math.max(1, Math.round((this.range * 2) / velToSub(this.speed)));
        const phase = this.t % period;
        const half = period / 2;
        const dist = phase < half ? phase : period - phase;
        b.x = this.originX + Math.round((dist / half) * this.range);
        break;
      }
      case 'lift-v': {
        const period = Math.max(1, Math.round((this.range * 2) / velToSub(this.speed)));
        const phase = this.t % period;
        const half = period / 2;
        const dist = phase < half ? phase : period - phase;
        b.y = this.originY + Math.round((dist / half) * this.range);
        break;
      }
      case 'lift-up':
        b.y -= velToSub(this.speed);
        if (b.y + b.h < 0) b.y = px(SCREEN_H);
        break;
      case 'lift-down':
        b.y += velToSub(this.speed);
        if (b.y > px(SCREEN_H)) b.y = px(-8);
        break;
      case 'lift-right':
        // Waits for a rider, then drifts right for good (the coin-heaven cloud).
        if (this.moving) b.x += velToSub(this.speed);
        break;
      case 'lift-fall':
      case 'lift-balance':
        if (this.falling) {
          b.vy += 0x00200;
          if (b.vy > 0x04000) b.vy = 0x04000;
          b.y += velToSub(b.vy);
          if (this.isBelowLevel()) this.destroy();
        }
        break;
    }
    this.dx = b.x - prevX;
    this.dy = b.y - prevY;
  }

  /** Land the rider on the surface and move it along. Called after the rider moved. */
  carry(rider: Body, _world: World): void {
    const b = this.body;
    const top = b.y;
    const riderBottom = rider.y + rider.h;
    const horiz = rider.x < b.x + b.w && rider.x + rider.w > b.x;
    if (!horiz) return;
    // Landing: rider was above the surface last frame and is at/below it now, moving down.
    if (
      rider.vy >= 0 &&
      rider.prevBottom - this.dy <= top + px(2) &&
      riderBottom >= top &&
      riderBottom <= top + px(12)
    ) {
      rider.y = top - rider.h;
      rider.vy = 0;
      rider.onGround = true;
      rider.x += this.dx;
      rider.y += this.dy;
      this.ridden = true;
      if (this.kind === 'lift-fall') this.falling = true;
      if (this.kind === 'lift-right') this.moving = true;
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    for (let i = 0; i < this.len; i += 2) r.sprite(sheet, 'platform', x + i * 8, y);
  }
}
