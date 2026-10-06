import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { decorDef } from '@content/sprites/decor';
import { Entity, type View } from '../entity';
import type { Decoration } from '../objects/decoration';

/**
 * The original's FireworkLocations.as (FW_6_ARR; FW_3_ARR is its first three, FW_1_ARR its first),
 * in tiles: x from the castle flag, y from a point one tile above the castle flag's start
 * (Level.fireworkPivotY = castleFlag.y - TILE_SIZE).
 */
export const FIREWORK_TILES: readonly (readonly [number, number])[] = [
  [-1, -4],
  [-3, -1],
  [3, -3],
  [3, 0],
  [0, -3],
  [-3, -1],
];

/** Firework.NEXT_FIREWORK_TMR: each one is removed after 400 ms, which launches the next. */
export const FIREWORK_FRAMES = 24;
/** Animation frame length: Firework's accurateAnimTmr = AnimationTimers.DEL_VERY_SLOW (115 ms). */
const FRAME_LEN = 7;

/**
 * Where the castle's flag starts (px, top-left of its 16x16 sprite), as Decoration.render draws
 * it: centred on the castle, 8 px below the castle's top.
 */
export function castleFlagStart(d: Decoration): { x: number; y: number } {
  const rows = decorDef.frames[d.name] ?? [];
  const w = rows[0]?.length ?? 16;
  const h = rows.length || 16;
  return { x: toPx(d.body.x) + w / 2 - 8, y: toPx(d.body.y) + 16 - h + 8 };
}

/** One burst over the castle after the flagpole tally (the original's com/smbc/projectiles/Firework). */
export class Firework extends Entity {
  readonly kind = 'firework';
  private t = 0;
  /** `x`, `y`: the burst's centre (px). */
  constructor(x: number, y: number) {
    super(px(x - 8), px(y - 8), 16, 16);
    this.layer = 'front';
    this.despawnMargin = null;
  }
  update(): void {
    this.t++;
    if (this.t >= FIREWORK_FRAMES) this.destroy();
  }
  render(r: Renderer, view: View): void {
    const f = Math.floor(this.t / FRAME_LEN);
    if (f > 2) return; // the animation's "end" label hides it until the timer removes it
    r.sprite(view.assets.sheet('items'), `firework-${f}`, toPx(this.body.x) - view.camX, toPx(this.body.y));
  }
}
