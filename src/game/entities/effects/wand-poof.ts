import type { Renderer } from '@engine/gfx/renderer';
import { toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** The stolen wand's magic: a pale lilac, its deeper glow and a warm white (docs/STORY.md 2.3a). */
export const WAND_SPARKLE = ['#f8d8f8', '#b070e8', '#fcfcfc'] as const;

/**
 * One wand sparkle, a small plus sign (`size` 0: a single pixel, 1: a 3-pixel cross, 2: a
 * 5-pixel cross), drawn at screen pixel (x, y).
 */
export function drawSparkle(r: Renderer, x: number, y: number, size: number, color: string): void {
  r.rect(x, y, 1, 1, color);
  for (let i = 1; i <= size; i++) {
    r.rect(x - i, y, 1, 1, color);
    r.rect(x + i, y, 1, 1, color);
    r.rect(x, y - i, 1, 1, color);
    r.rect(x, y + i, 1, 1, color);
  }
}

/** Frames the puff lasts. */
const LIFE = 30;
/** Sparkles in the puff, flung out evenly around its centre. */
const COUNT = 12;

/**
 * A fake Bowser's disguise bursting (campaign): a ring of wand sparkles flung out from where he
 * stood, slowing and shrinking away over half a second. With reduce flashing on the sparkles keep
 * one colour each instead of twinkling.
 */
export class WandPoof extends Entity {
  readonly kind = 'wand-poof';
  private age = 0;

  /** (cx, cy): the burst's centre, in subpixels. */
  constructor(cx: number, cy: number) {
    super(cx, cy, 1, 1);
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(): void {
    if (++this.age >= LIFE) this.destroy();
  }

  render(r: Renderer, view: View): void {
    const cx = toPx(this.body.x) - view.camX;
    const cy = toPx(this.body.y);
    const k = this.age / LIFE;
    // Fast at first, easing out to 22 px.
    const dist = 22 * (1 - (1 - k) * (1 - k));
    const size = k < 0.4 ? 2 : k < 0.75 ? 1 : 0;
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + (i & 1) * 0.2;
      const d = dist * (i & 1 ? 0.7 : 1);
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d);
      const c = view.reduceFlashing ? i % 3 : (i + (this.age >> 2)) % 3;
      drawSparkle(r, x, y, size, WAND_SPARKLE[c] as string);
    }
  }
}
