import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';

const JUMP_SPEED = 0x05800; // 5.5 px/f
const GRAVITY = 0x00180; // 0.094 px/f²
const REST_MIN = 60;
const REST_MAX = 150;

/** Podoboo: a fireball that leaps out of the lava at its spawn tile and drops back in. Immune. */
export class Podoboo extends Enemy {
  readonly kind = 'podoboo';
  private readonly restY: number;
  private rest: number;

  constructor(tx: number, ty: number, seed: number) {
    super(px(tx * 16 + 2), px(ty * 16 + 20), 12, 12);
    this.restY = this.body.y;
    this.rest = REST_MIN + (seed % (REST_MAX - REST_MIN));
    this.vulnerability = {};
    this.stompable = false;
    this.body.vx = 0;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'podoboo-0';
    this.despawnMargin = 128;
  }

  get airborne(): boolean {
    return this.body.y < this.restY;
  }

  update(world: World): void {
    const b = this.body;
    if (!this.airborne && b.vy >= 0) {
      b.y = this.restY;
      b.vy = 0;
      this.contactHurts = false;
      if (--this.rest <= 0) {
        b.vy = -JUMP_SPEED;
        this.rest = REST_MIN + world.rng.int(REST_MAX - REST_MIN);
        b.y -= px(1);
      }
    } else {
      this.contactHurts = true;
      b.vy += GRAVITY;
      b.y += velToSub(b.vy);
      if (b.y >= this.restY) {
        b.y = this.restY;
        b.vy = 0;
      }
    }
    this.currentFrame = `podoboo-${(world.frame >> 2) & 1}`;
  }

  override render(r: Renderer, view: View): void {
    if (!this.airborne) return;
    const sheet = view.assets.sheet(this.sheet, this.palette(view));
    // Falling: tail up.
    r.sprite(
      sheet,
      this.currentFrame,
      this.screenX(view),
      toPx(this.body.y) - this.spriteOffsetY,
      false,
      this.body.vy > 0,
    );
  }
}
