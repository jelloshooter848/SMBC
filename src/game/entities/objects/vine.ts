import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';

const GROW_SPEED = 2; // px per frame while sprouting from a block

/**
 * How a vine looks: the beanstalk (items sheet) or an anchor chain (`chain` of the smb3 sheet,
 * 16x16 a link, theme-independent; 4-2's anchor chain up to Larry's airship). Climbed the same.
 */
export type VineArt = 'vine' | 'chain';
/** The chain's frame (16x16, centred on the vine's climb line like the beanstalk). */
export const CHAIN_SHEET = 'smb3';
export const CHAIN_FRAME = 'chain';

/**
 * A climbable beanstalk. Either placed in a level (`vine x y len=N`, standing on tile row y) or
 * sprouting from a hit vine brick, in which case it grows from the block up past the top of the
 * screen so the player can climb off it into the level's sky area. A `chain x y len=N` is the
 * same thing drawn as an anchor chain (VineArt); a `vine` zone on its foot (column x, row y)
 * links its top to another area like a vine brick's.
 */
export class Vine extends Entity {
  readonly kind = 'vine';
  /** Tile column. */
  readonly tx: number;
  /** px: the vine's lowest point (the block top or the bottom tile's bottom). */
  readonly basePx: number;
  /** px: how high the vine may grow (negative = above the screen). */
  readonly topPx: number;
  /** px: current top edge (shrinks toward topPx while growing). */
  private top: number;
  /** Which brick grew this vine, for the sky-area link. */
  readonly fromBlock: { tx: number; ty: number } | null;

  constructor(
    tx: number,
    bottomRow: number,
    len: number,
    fromBlock: { tx: number; ty: number } | null = null,
    readonly art: VineArt = 'vine',
  ) {
    const basePx = fromBlock ? bottomRow * 16 : (bottomRow + 1) * 16;
    const topPx = fromBlock ? -16 : basePx - len * 16;
    super(px(tx * 16 + 7), px(topPx), 2, basePx - topPx);
    this.tx = tx;
    this.basePx = basePx;
    this.topPx = topPx;
    this.fromBlock = fromBlock;
    this.top = fromBlock ? basePx : topPx;
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
    this.syncBody();
  }

  /** px per frame while growing. */
  private growSpeed = GROW_SPEED;

  /** Grow up from the base at `speed` px a frame (the sky-area arrival vine, Vine.growFromStgBot). */
  growFromBase(speed: number): void {
    this.top = this.basePx;
    this.growSpeed = speed;
    this.syncBody();
  }

  get grown(): boolean {
    return this.top <= this.topPx;
  }

  /** px: top edge the player can climb to. */
  get climbTop(): number {
    return this.top;
  }

  /** Subpixel x of the vine's centre line. */
  get centerX(): number {
    return px(this.tx * 16 + 8);
  }

  private syncBody(): void {
    this.body.y = px(this.top);
    this.body.h = px(this.basePx - this.top);
  }

  update(): void {
    if (this.top > this.topPx) {
      this.top = Math.max(this.topPx, this.top - this.growSpeed);
      this.syncBody();
    }
  }

  /** Tile row the vine stands on (its foot), for a `vine` zone linking a placed vine or chain. */
  get footRow(): number {
    return (this.basePx >> 4) - 1;
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - 7 - view.camX;
    if (this.art === 'chain') {
      // Links tile with no gaps and need no top frame (the chain runs off the screen).
      const chain = view.assets.sheet(CHAIN_SHEET);
      for (let y = this.basePx - 16; y >= this.top; y -= 16) r.sprite(chain, CHAIN_FRAME, x, y);
      return;
    }
    const sheet = view.assets.sheet('items');
    for (let y = this.basePx - 16; y >= this.top; y -= 16) {
      const name = y - 16 < this.top ? 'vine-top' : 'vine-mid';
      r.sprite(sheet, name, x, y);
    }
  }
}
