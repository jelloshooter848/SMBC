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
    // the tiles, still behind the players. The classic decor stands behind the tiles. A pipe the
    // players drop out of is drawn over them (decorOverPlayers).
    this.layer = decorOverPlayers(name) ? 'front' : decorInFront(name) ? 'main' : 'back';
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

/**
 * `sheet:frame` decor (`station:window`) hangs in front of the tiles; the classic decor behind them.
 * The exception is Link's sky palace (`zelda2-sky:*`, 2-1-sky2's campaign look): its back wall,
 * columns and gate stand behind the hall's tiles and coins, like the classic decor.
 */
export const decorInFront = (kind: string): boolean => kind.includes(':') && !kind.startsWith('zelda2-sky:');

/**
 * Decor drawn over the players: the pipe in Larry's cabin ceiling (`smb3:ceiling-pipe`), so a
 * hero dropping in comes out of its mouth instead of falling in front of it.
 */
export const decorOverPlayers = (kind: string): boolean => kind === 'smb3:ceiling-pipe';

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
  if (theme === 'castlevania') return 'decor-castlevania';
  if (theme === 'ninja-city') return 'decor-ninja-city';
  if (theme === 'smw-secret') return 'decor-smw';
  if (theme === 'zelda2' || theme === 'megaman-stage' || theme === 'brinstar') return `decor-${theme}`;
  // World 2 as Hyrule (0.4.24): the lake, the palace and the cave.
  if (theme === 'zelda2-water' || theme === 'zelda2-palace' || theme === 'zelda2-cave')
    return `decor-${theme}`;
  // World 3 as Mega Man's world (0.4.26): the factory, the forest, the sky and Wily's fortress.
  if (theme.startsWith('megaman-') && theme !== 'megaman-stage') return `decor-${theme}`;
  // World 4 as Samus's world, Zebes (0.4.27): the surface, Norfair and Mother Brain's lair.
  if (theme === 'crateria' || theme === 'norfair' || theme === 'tourian-lair') return `decor-${theme}`;
  // World 5 as Simon's world, Transylvania (0.4.28): the gate, catacombs, town, storm, lake, clock tower.
  if (theme.startsWith('cv-')) return `decor-${theme}`;
  // World 6 as Ryu's world (0.4.29): the field, the sewers, the harbour, the pass and the temple.
  if (theme.startsWith('ng-')) return `decor-${theme}`;
  // World 7 as Bill's world (0.4.30): the snowfield, the base, the shore, the river and the lair.
  if (
    theme === 'contra-snow' ||
    theme === 'contra-base' ||
    theme === 'contra-shore' ||
    theme === 'contra-river' ||
    theme === 'contra-lair'
  )
    return `decor-${theme}`;
  if (theme === 'snow') return 'decor-snow';
  if (theme === 'cavern' || theme === 'tourian') return 'decor-cavern';
  if (theme === 'mushroom') return 'decor-mushroom';
  if (theme === 'mushroom-red') return 'decor-mushroom-red';
  if (theme === 'water-gray') return 'decor-gray';
  return 'decor-overworld';
}
