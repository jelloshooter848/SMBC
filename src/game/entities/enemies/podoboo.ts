import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';
import { SCREEN_H } from '@engine/viewport';

/*
 * The original's com/smbc/projectiles/LavaFireBall.as, at 16 px tiles and 60 frames a second
 * (v px/s = v * 4096 / 120 velocity units, a px/s² = a * 4096 / 7200).
 */
/** sy = 700 px/s: 5.83 px/f. */
const JUMP_SPEED = 0x05d55;
/** gravity = 800 px/s²: 0.111 px/f². */
const GRAVITY = 0x001c7;
/** vyMaxPsv = 400 px/s: 3.33 px/f. */
const MAX_FALL = 0x03555;
/** waitTmrDurMin/Max = 750/2000 ms; the first wait is the minimum. */
const ms = (n: number): number => Math.round((n * 60) / 1000);
const REST_FIRST = ms(750);
const restTime = (world: World): number => ms(750 + world.rng.int(1250));
/** restingYPos = GLOB_STG_BOT + height / 2: the fireball's top edge sits on the screen's bottom. */
const REST_TOP = SCREEN_H;

/** Podoboo: a fireball that leaps out of the lava from below the screen and drops back. Immune. */
export class Podoboo extends Enemy {
  readonly kind = 'podoboo';
  private readonly restY: number;
  private rest: number;

  constructor(tx: number, _ty: number, _seed = 0) {
    super(px(tx * 16 + 2), px(REST_TOP + 2), 12, 12);
    this.restY = this.body.y;
    this.rest = REST_FIRST;
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
        this.rest = restTime(world);
        b.y -= px(1);
      }
    } else {
      this.contactHurts = true;
      b.vy = Math.min(b.vy + GRAVITY, MAX_FALL);
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
