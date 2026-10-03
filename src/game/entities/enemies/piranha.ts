import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';

const HEIGHT = 24;
const RISE_FRAMES = 32;
const HOLD_FRAMES = 60;
const HIDDEN_FRAMES = 60;

/** Lives in a pipe at (tx, ty) = the pipe's top-left tile. Won't come out while the player is close. */
export class Piranha extends Enemy {
  readonly kind = 'piranha';
  private phase: 'hidden' | 'rising' | 'up' | 'sinking' = 'hidden';
  private t = HIDDEN_FRAMES;
  private readonly pipeTopY: number; // subpixels: y of the pipe's top edge
  private readonly centerX: number; // subpixels

  constructor(tx: number, ty: number) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 0);
    this.pipeTopY = px(ty * 16);
    this.centerX = px(tx * 16 + 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
    this.vulnerability = {
      fireball: 'kill',
      shell: 'kill',
      star: 'kill',
      sword: 'kill',
      buster: 'kill',
      bomb: 'kill',
      weapon: 'kill',
      boomerang: 'immune',
      stomp: 'hurtAttacker',
    };
    this.scoreValue = 200;
    this.body.vx = 0;
    this.currentFrame = 'piranha-0';
  }

  private set visible(pxVisible: number) {
    const v = Math.max(0, Math.min(HEIGHT, pxVisible));
    this.body.h = px(v);
    this.body.y = this.pipeTopY - this.body.h;
    this.contactHurts = v > 4;
  }

  private get visiblePx(): number {
    return toPx(this.body.h);
  }

  update(world: World): void {
    const pl = world.nearestPlayer(this.centerX).body;
    const playerNear = Math.abs(pl.x + pl.w / 2 - this.centerX) < px(28);
    this.t--;
    switch (this.phase) {
      case 'hidden':
        this.visible = 0;
        if (this.t <= 0 && !playerNear) {
          this.phase = 'rising';
          this.t = RISE_FRAMES;
        }
        break;
      case 'rising':
        this.visible = Math.round(((RISE_FRAMES - this.t) / RISE_FRAMES) * HEIGHT);
        if (this.t <= 0) {
          this.phase = 'up';
          this.t = HOLD_FRAMES;
        }
        break;
      case 'up':
        this.visible = HEIGHT;
        if (this.t <= 0) {
          this.phase = 'sinking';
          this.t = RISE_FRAMES;
        }
        break;
      case 'sinking':
        this.visible = Math.round((this.t / RISE_FRAMES) * HEIGHT);
        if (this.t <= 0) {
          this.phase = 'hidden';
          this.t = HIDDEN_FRAMES;
        }
        break;
    }
    this.currentFrame = `piranha-${(world.frame >> 3) & 1}`;
  }

  override render(r: Renderer, view: View): void {
    if (this.visiblePx <= 0) return;
    // Draw the whole 24-tall sprite anchored to the pipe top; the pipe tiles (drawn later) cover the rest.
    const sheet = view.assets.sheet(this.sheet, this.palette(view));
    r.sprite(
      sheet,
      this.currentFrame,
      toPx(this.body.x) - view.camX - 2,
      toPx(this.pipeTopY) - this.visiblePx,
    );
  }
}
