import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/** The sheet holding every hero item's pickup frame (named by item id, 16 × 16). */
export const HERO_ITEMS_SHEET = 'hero-items';

/**
 * A hero's own item out of a power block in the campaign (docs/POWERUPS.md 3.3): it rises like
 * SMB's flower and stays put there (decision 9), drawn in its own sprite. `item` was worked out
 * for the player who struck the block (`owner`); `entries` is the block's `[hero-items]` line, so
 * a different hero who takes it gets their own item from the same block (World.takeHeroItem).
 */
export class HeroItem extends Entity {
  readonly kind = 'hero-item';
  private emerging = 32;
  private readonly targetY: number;

  constructor(
    tx: number,
    ty: number,
    readonly item: string,
    readonly hero: string,
    readonly entries: Readonly<Record<string, string>> | null = null,
  ) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 16);
    this.targetY = px((ty - 1) * 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
  }

  /** Out of its block (not still rising): it can be touched and taken. */
  get out(): boolean {
    return this.emerging === 0;
  }

  update(_world: World): void {
    if (this.emerging <= 0) return;
    this.emerging--;
    this.body.y -= px(16) / 32;
    if (this.emerging === 0) {
      this.body.y = this.targetY;
      this.layer = 'main';
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet(HERO_ITEMS_SHEET);
    r.sprite(sheet, this.item, this.screenX(view), this.screenY());
  }
}
