import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** SMB3 airship propeller decor: it turns, cycling `smb3:propeller-0/1/2`. */
const PROPELLER = 'smb3:propeller-0';

/**
 * Background scenery anchored at its bottom-left tile. Castles can raise a flag at level end. A
 * `sheet:frame` kind (`station:window`) draws that frame of another sheet.
 */
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
    // Scenery of another sheet (`station:window`) hangs on background wall tiles: drawn after
    // the tiles, still behind the players. The classic decor stands behind the tiles.
    this.layer = decorInFront(name) ? 'main' : 'back';
    this.despawnMargin = 192;
  }
  raiseFlag(): void {
    if (this.name.startsWith('castle')) this.flag = true;
  }
  update(): void {
    if (this.flag && this.flagT < 24) this.flagT++;
  }
  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const bottom = this.screenY() + 16;
    if (this.flag) {
      const f = view.assets.sheet('decor', decorPalette(view.theme)).frames.get(this.name);
      if (f)
        r.sprite(view.assets.sheet('items'), 'castle-flag', x + f.w / 2 - 8, bottom - f.h + 8 - this.flagT);
    }
    // SMB3 airship propellers turn: `smb3:propeller-0` cycles through its three frames.
    const name = this.name === PROPELLER ? `smb3:propeller-${Math.floor(view.frame / 4) % 3}` : this.name;
    drawDecor(r, view, name, x, bottom);
  }
}

/** `sheet:frame` decor (`station:window`) hangs in front of the tiles; the classic decor behind them. */
export const decorInFront = (kind: string): boolean => kind.includes(':');

/**
 * Draw decor `kind` with its bottom-left at screen (x, bottom) (shared with the editor): a frame
 * of the `decor` sheet in the theme's palette, or for `sheet:frame` that frame of another sheet
 * in its own palette. An unknown frame, or a sheet not registered (yet), draws nothing.
 */
export function drawDecor(r: Renderer, view: View, kind: string, x: number, bottom: number): void {
  const colon = kind.indexOf(':');
  if (colon > 0 && !view.assets.has(kind.slice(0, colon))) return;
  const sheet =
    colon > 0
      ? view.assets.sheet(kind.slice(0, colon))
      : view.assets.sheet('decor', decorPalette(view.theme));
  const plain = colon > 0 ? kind.slice(colon + 1) : kind;
  // A theme can redraw the classic decor (`cloud-1@contra-jungle` is jungle canopy).
  const themed = colon > 0 ? '' : `${plain}@${view.theme}`;
  const frame = themed && sheet.frames.has(themed) ? themed : plain;
  const f = sheet.frames.get(frame);
  if (f) r.sprite(sheet, frame, x, bottom - f.h);
}

/** Decor palette for a theme (shared with the editor). */
export function decorPalette(theme: string): string {
  if (
    theme === 'night' ||
    theme === 'underground' ||
    theme === 'castle' ||
    theme === 'castle-water' ||
    theme === 'station' ||
    theme === 'airship' ||
    theme === 'crypt' ||
    theme === 'dojo' ||
    theme === 'ninja-night' ||
    theme === 'alien-lair' ||
    theme === 'bm-dungeon'
  )
    return 'decor-night';
  if (theme === 'underworld') return 'decor-underworld';
  if (theme === 'contra-jungle' || theme === 'contra-falls') return 'decor-jungle';
  if (theme === 'snow') return 'decor-snow';
  if (theme === 'cavern') return 'decor-cavern';
  if (theme === 'mushroom') return 'decor-mushroom';
  if (theme === 'mushroom-red') return 'decor-mushroom-red';
  if (theme === 'water-gray') return 'decor-gray';
  return 'decor-overworld';
}
