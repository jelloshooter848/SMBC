import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import { SMB3_SHEET, sheetWith } from '../../art';

/** Frames after it appears before a touch counts (it pops out of the puff first). */
const READY_FRAMES = 8;
/** The slow shine across it: one cycle (frames). */
const SHINE_FRAMES = 90;

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

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const art = sheetWith(view.assets, SMB3_SHEET, 'crystal-ball');
    if (art) {
      r.sprite(art, 'crystal-ball', x - 2, y - 4);
      return;
    }
    // Until the SMB3 art lands: a pale blue ball on a small stand, a highlight drifting across it
    // (still with reduce flashing).
    r.rect(x + 3, y, 6, 1, '#3cbcfc');
    r.rect(x + 1, y + 1, 10, 1, '#3cbcfc');
    r.rect(x, y + 2, 12, 6, '#3cbcfc');
    r.rect(x + 1, y + 8, 10, 1, '#3cbcfc');
    r.rect(x + 2, y + 2, 8, 5, '#a4e4fc');
    r.rect(x + 2, y + 10, 8, 2, '#f8d878');
    const shine = view.reduceFlashing ? 0 : Math.floor(((this.age % SHINE_FRAMES) / SHINE_FRAMES) * 6);
    r.rect(x + 3 + shine, y + 2, 2, 2, '#fcfcfc');
  }
}
