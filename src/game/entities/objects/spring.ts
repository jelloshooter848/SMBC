import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Player } from '../player';

const PRESS_FRAMES = 9;
/** Launch speed as a multiple of the character's standing jump. */
export const SPRING_BOOST = 1.15;
export const SPRING_BOOST_HELD = 1.65;
/** The Lost Levels' green super springboard: about twice the red one, far off the top of the screen. */
export const SPRING_GREEN_BOOST = 2.3;
export const SPRING_GREEN_BOOST_HELD = 3.3;

/**
 * A springboard: land on it, it compresses, then it throws you up (higher with jump held).
 * The green one (The Lost Levels) is a super springboard that launches about twice as fast.
 */
export class Spring extends Entity {
  readonly kind = 'spring';
  private rider: Player | null = null;
  private t = 0;
  private held = false;

  constructor(
    tx: number,
    ty: number,
    readonly green = false,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.body.vx = 0;
    this.despawnMargin = 64;
  }

  /** How far the plate is pushed down this frame (0, 4 or 8 px). */
  get compression(): number {
    if (!this.rider) return 0;
    const half = PRESS_FRAMES / 2;
    return this.t < half
      ? Math.min(8, Math.round((this.t / half) * 8))
      : Math.round(((PRESS_FRAMES - this.t) / half) * 8);
  }

  /** Called by the world when a player lands on the plate. */
  press(p: Player): void {
    if (this.rider) return;
    this.rider = p;
    this.t = 0;
    this.held = false;
  }

  /** Called by the world every frame while a rider is on it; returns true once the launch happened. */
  ride(jumpHeld: boolean): boolean {
    const p = this.rider;
    if (!p) return false;
    this.t++;
    if (jumpHeld) this.held = true;
    const b = p.body;
    b.vy = 0;
    b.onGround = true;
    b.y = this.body.y + px(this.compression) - b.h;
    if (this.t >= PRESS_FRAMES) {
      if (this.green) p.launch(this.held ? SPRING_GREEN_BOOST_HELD : SPRING_GREEN_BOOST);
      else p.launch(this.held ? SPRING_BOOST_HELD : SPRING_BOOST);
      this.rider = null;
      return true;
    }
    return false;
  }

  get busy(): boolean {
    return this.rider !== null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const c = this.compression;
    const frame = `${this.green ? 'spring-green' : 'spring'}-${c >= 8 ? 2 : c >= 4 ? 1 : 0}`;
    r.sprite(view.assets.sheet('items'), frame, toPx(this.body.x) - view.camX, toPx(this.body.y));
  }
}
