import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';

/** Who stands there instead (CharacterDef.endingGreeter: Classic Peach's Mario). */
export interface PrincessLook {
  sheet: string;
  palette: string;
  frame: string;
  h: number;
}

/** The princess waiting past the axe in the last castle. Scenery: no collision. */
export class Princess extends Entity {
  readonly kind = 'princess';

  constructor(
    tx: number,
    ty: number,
    readonly look: PrincessLook | null = null,
  ) {
    // Anchored on the tile her feet stand on.
    const h = look?.h ?? 24;
    super(px(tx * 16), px((ty + 1) * 16 - h), 16, h);
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
    this.facing = -1;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const l = this.look;
    if (l) r.sprite(view.assets.sheet(l.sheet, l.palette), l.frame, this.screenX(view), this.screenY(), true);
    else r.sprite(view.assets.sheet('items'), 'princess', this.screenX(view), this.screenY(), true);
  }
}
