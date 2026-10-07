import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/** Frames after it appears before a touch counts (it pops out of the puff first). */
const READY_FRAMES = 8;

/**
 * Larry Koopa's crystal ball (enemies/larry.ts drops it where he was beaten). It falls to the
 * floor; a player touching it raises one `crystal-ball` event (the level then shows its card and,
 * in the campaign, ends the area as 4-2's secret exit `secret:larry`; docs/HEROES.md). `next`: the
 * level play goes on to outside the campaign.
 */
export class CrystalBall extends Entity {
  readonly kind = 'crystal-ball';
  private age = 0;
  taken = false;

  constructor(
    cx: number,
    feet: number,
    readonly next: string | null,
  ) {
    super(cx - px(6), feet - px(12), 12, 12);
    this.despawnMargin = null;
    this.body.vy = -0x02000;
  }

  update(world: World): void {
    this.age++;
    this.fall(world);
    if (this.taken || this.age < READY_FRAMES) return;
    for (const p of world.activePlayers()) {
      if (!overlaps(p.body, this.body)) continue;
      this.taken = true;
      world.audio.sfx('powerup');
      world.events.push({ type: 'crystal-ball', player: world.players.indexOf(p), next: this.next });
      return;
    }
  }

  /** The smb3 sheet's `crystal-ball` (on its stand), bottom-centred on the body. */
  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('smb3');
    const f = sheet.frames.get('crystal-ball');
    const w = f?.w ?? 16;
    const h = f?.h ?? 16;
    const b = this.body;
    r.sprite(sheet, 'crystal-ball', toPx(b.x + (b.w >> 1)) - view.camX - (w >> 1), toPx(b.y + b.h) - h);
  }
}
