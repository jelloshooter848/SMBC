import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** Background scenery anchored at its bottom-left tile. Castles can raise a flag at level end. */
export class Decoration extends Entity {
  readonly kind = 'decor';
  private flag = false;
  private flagT = 0;
  constructor(
    readonly name: string,
    tx: number,
    ty: number,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.layer = 'back';
    this.despawnMargin = 192;
  }
  raiseFlag(): void {
    if (this.name.startsWith('castle')) this.flag = true;
  }
  update(): void {
    if (this.flag && this.flagT < 24) this.flagT++;
  }
  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('decor', decorPalette(view.theme));
    const f = sheet.frames.get(this.name);
    if (!f) return;
    const x = this.screenX(view);
    const bottom = this.screenY() + 16;
    if (this.flag) {
      const fl = view.assets.sheet('items');
      r.sprite(fl, 'castle-flag', x + f.w / 2 - 8, bottom - f.h + 8 - this.flagT);
    }
    r.sprite(sheet, this.name, x, bottom - f.h);
  }
}

/** Decor palette for a theme (shared with the editor). */
export function decorPalette(theme: string): string {
  if (
    theme === 'night' ||
    theme === 'underground' ||
    theme === 'castle' ||
    theme === 'castle-water' ||
    theme === 'station'
  )
    return 'decor-night';
  if (theme === 'snow') return 'decor-snow';
  if (theme === 'mushroom') return 'decor-mushroom';
  if (theme === 'mushroom-red') return 'decor-mushroom-red';
  if (theme === 'water-gray') return 'decor-gray';
  return 'decor-overworld';
}
