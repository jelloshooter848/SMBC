import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';

const SWIM_SPEED = { red: 0x00c00, grey: 0x00600 } as const; // 0.75 / 0.375 px/f
const BOB_PERIOD = 128;
const BOB_AMPLITUDE = 8; // px
const FLY_GRAVITY = 0x00180; // 0.094 px/f²

/**
 * Cheep Cheep. Underwater it drifts left in a gentle wave through anything (not stompable: a
 * swimmer landing on it gets hurt). Leaping ones (bridge levels) arc up from below the screen
 * and can be stomped.
 */
export class Cheep extends Enemy {
  readonly kind = 'cheep';
  private readonly homeY: number;
  private t = 0;

  constructor(
    x: number,
    y: number,
    readonly color: 'red' | 'grey',
    readonly flying = false,
  ) {
    super(x, y, 12, 12);
    this.homeY = y;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'cheep-0';
    this.scoreValue = 200;
    this.despawnMargin = flying ? null : 64;
    if (flying) {
      this.activated = true;
    } else {
      this.body.vx = -SWIM_SPEED[color];
      this.stompable = false;
      this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker' };
    }
  }

  override palette(view: View): string {
    return this.color === 'grey' ? 'cheep-grey' : super.palette(view);
  }

  update(world: World): void {
    const b = this.body;
    this.t++;
    if (this.flying) {
      b.x += velToSub(b.vx);
      b.vy += FLY_GRAVITY;
      b.y += velToSub(b.vy);
      this.facing = b.vx > 0 ? 1 : -1;
      this.currentFrame = `cheep-${(world.frame >> 3) & 1}`;
      if (b.vy > 0 && toPx(b.y) > 240 + 16) this.destroy();
      return;
    }
    // Water: no tiles, no gravity; a slow wave around the spawn height.
    b.x += velToSub(b.vx);
    b.y = this.homeY + px(Math.round(Math.sin((this.t * Math.PI * 2) / BOB_PERIOD) * BOB_AMPLITUDE));
    this.facing = b.vx > 0 ? 1 : -1;
    this.currentFrame = `cheep-${(world.frame >> 4) & 1}`;
  }

  override render(r: Renderer, view: View): void {
    // Leaping fish on the way down flip tail-up like the original.
    if (this.flying && this.body.vy > 0) {
      const sheet = view.assets.sheet(this.sheet, this.palette(view));
      r.sprite(sheet, this.currentFrame, this.screenX(view), this.screenY(), this.facing > 0, true);
      return;
    }
    super.render(r, view);
  }
}
