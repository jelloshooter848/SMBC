import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { InputFrame } from '@engine/input/input-manager';
import { NES } from '@engine/gfx/palette';
import { px, toPx } from '@engine/math/units';
import type { Zone } from '../../level/schema';
import { SKY } from '../../world/tile-render';
import { Entity, type View } from '../entity';
import type { Player } from '../player';

/*
 * A ninja trick wall (karakuri revolving panel; 6-2's bonus room into Ryu's dojo, campaign only;
 * docs/HEROES.md). The panel is a column of T.TRICK tiles drawn as the wall's brick; this entity
 * marks a live one (a shuriken stuck in it and a faint seam around it) and draws its half turn
 * while it spins. World.checkTricks counts the push and runs the spin (World.trickSpin).
 */

export type TrickZone = Zone & { kind: 'trick' };

/** Frames of pushing into a live panel, without letting go, that spin it (about a second). */
export const TRICK_PUSH_FRAMES = 60;
/** The panel's half turn (frames). The hero goes through at its middle, with the panel edge-on. */
export const TRICK_SPIN_FRAMES = 24;
/** Frames after the half turn before the transfer: the panel shut again, the room empty. */
export const TRICK_HOLD_FRAMES = 12;

/** The `ninja` sheet's frame if that sheet (R3's art) is registered and has it. */
export function ninjaFrame(assets: AssetRegistry, frame: string): boolean {
  return assets.has('ninja') && assets.sheet('ninja').frames.has(frame);
}

/** The turning panel's frames, flat (0) to edge-on (3); no string built each frame. */
const SPIN_FRAMES = ['trick-wall-0', 'trick-wall-1', 'trick-wall-2', 'trick-wall-3'] as const;

/** Rect fallback colours of the turning panel (the theme's brick: top light, body, mortar). */
function brickColours(theme: string): [string, string, string] {
  if (theme === 'underground') return [NES.lavender, NES.blueUnderground, NES.blueDark];
  return [NES.lightGray, NES.gray, NES.black];
}

export class TrickWall extends Entity {
  readonly kind = 'trick-wall';
  /** Frames into the half turn while it spins (World.trickSpin), else null. */
  spinT: number | null = null;

  /**
   * `live`: the zone is awake (campaign, or a zone with no `campaign` flag): marked, and pushing
   * spins it. A sleeping one is a plain wall (it can still turn for an arrival). `side`: the side
   * the room is on, 1 right of the panel (players push left into it) or -1 left of it.
   */
  constructor(
    readonly zone: TrickZone,
    readonly live: boolean,
    readonly side: 1 | -1,
  ) {
    super(px(zone.x * 16), px(zone.y * 16), 16, zone.h * 16);
    this.despawnMargin = null;
  }

  update(): void {}

  /** The face players push on (subpixel x). */
  get face(): number {
    return this.side === 1 ? this.body.x + this.body.w : this.body.x;
  }

  /**
   * Whether `p` pushes into the panel this frame: holding toward it (Ryu clinging to it holds
   * toward it too), the body against its face, the body's middle within its rows. Standing,
   * jumping, clinging or rolling in a morph ball all count.
   */
  pushedBy(p: Player, input: InputFrame): boolean {
    if (input.dirX !== -this.side) return false;
    const b = p.body;
    const edge = this.side === 1 ? b.x : b.x + b.w;
    if (Math.abs(edge - this.face) > px(1)) return false;
    const mid = b.y + (b.h >> 1);
    return mid >= this.body.y && mid < this.body.y + this.body.h;
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const h = this.zone.h * 16;
    if (this.spinT !== null) this.renderSpin(r, view, x, y, h, this.spinT);
    else if (this.live) this.renderMark(r, view, x, y, h);
  }

  /**
   * The half turn: the panel narrows to its edge and opens out again (the far face, mirrored),
   * over the wall's own tiles. `ninja:trick-wall-0..3` once that sheet exists, else rects in the
   * theme's brick colours. No flashing: it only turns.
   */
  private renderSpin(r: Renderer, view: View, x: number, y: number, h: number, t: number): void {
    r.rect(x, y, 16, h, SKY[view.theme] ?? '#000000');
    const c = Math.abs(Math.cos((Math.PI * Math.min(t, TRICK_SPIN_FRAMES)) / TRICK_SPIN_FRAMES));
    const back = t > TRICK_SPIN_FRAMES >> 1;
    const k = c > 0.875 ? 0 : c > 0.625 ? 1 : c > 0.375 ? 2 : 3;
    if (ninjaFrame(view.assets, SPIN_FRAMES[k] as string)) {
      const sheet = view.assets.sheet('ninja');
      for (let ty = 0; ty < h; ty += 16) r.sprite(sheet, SPIN_FRAMES[k] as string, x, y + ty, back);
      return;
    }
    const w = Math.max(2, Math.round(16 * c));
    const x0 = x + ((16 - w) >> 1);
    const [light, body, mortar] = brickColours(view.theme);
    for (let ty = 0; ty < h; ty += 4) {
      r.rect(x0, y + ty, w, 4, body);
      r.rect(x0, y + ty, w, 1, light);
      r.rect(x0, y + ty + 3, w, 1, mortar);
    }
    // The slab's two edges, so it reads as a turning board.
    r.rect(x0, y, 1, h, mortar);
    r.rect(x0 + w - 1, y, 1, h, mortar);
  }

  /**
   * The hint on a live panel: a faint seam along its top, its bottom and its far edge, and a
   * shuriken stuck in its face half way up (`ninja:shuriken-mark` once that sheet exists, else a
   * grey four-point star). A brief glint every two seconds, never with reduce flashing.
   */
  private renderMark(r: Renderer, view: View, x: number, y: number, h: number): void {
    const seam = '#000000';
    r.rect(x, y, 16, 1, seam);
    r.rect(x, y + h - 1, 16, 1, seam);
    r.rect(this.side === 1 ? x + 1 : x + 14, y + 1, 1, h - 2, seam);
    // The shuriken: centred 4 px in from the face, half sunk in the panel.
    const cx = this.side === 1 ? x + 16 - 2 : x + 2;
    const cy = y + (h >> 1);
    if (ninjaFrame(view.assets, 'shuriken-mark')) {
      r.sprite(view.assets.sheet('ninja'), 'shuriken-mark', cx - 4, cy - 4, this.side === -1);
    } else {
      r.rect(cx - 1, cy - 4, 2, 8, NES.lightGray);
      r.rect(cx - 4, cy - 1, 8, 2, NES.lightGray);
      r.rect(cx - 1, cy - 1, 2, 2, NES.darkGray);
    }
    if (!view.reduceFlashing && view.frame % 120 < 4) r.rect(cx - 3, cy - 3, 1, 1, NES.white);
  }
}
