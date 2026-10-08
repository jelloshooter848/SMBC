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
 * draws a live one's mark (`ninja:trick-wall-cracked` with a stuck `ninja:shuriken-mark`), the
 * dojo side's wooden back (`ninja:trick-wall-back`), and its half turn while it spins.
 * World.checkTricks counts the push and runs the spin (World.trickSpin).
 */

export type TrickZone = Zone & { kind: 'trick' };

/** Frames of pushing into a live panel, without letting go, that spin it (about a second). */
export const TRICK_PUSH_FRAMES = 60;
/** The panel's half turn (frames). The hero goes through at its middle, with the panel edge-on. */
export const TRICK_SPIN_FRAMES = 24;
/** Frames after the half turn before the transfer: the panel shows its far face, the room empty. */
export const TRICK_HOLD_FRAMES = 12;

/** The `ninja` sheet's frame if that sheet (R3's art) is registered and has it. */
export function ninjaFrame(assets: AssetRegistry, frame: string): boolean {
  return assets.has('ninja') && assets.sheet('ninja').frames.has(frame);
}

/**
 * The `ninja` palette the panel's brick face is drawn in under a theme whose brick is not the
 * underground's colours, or undefined for the sheet's own: 6-2-bonus as the city's sewers (0.4.29,
 * campaign) draws it in the sewer brick's colours, so it still cannot be told from the wall.
 */
export const trickPalette = (theme: string): string | undefined =>
  theme === 'ng-sewer' ? 'ninja-ng-sewer' : undefined;

/**
 * The half turn as seen from the brick side (the bonus room): the brick face (`trick-wall-0`,
 * `brick@underground` exactly), turning (`-1`), edge-on (`-2`), the wooden back turning (`-3`), the
 * back flat (`trick-wall-back`, the dojo side). Each frame fills its tile; a taller panel stacks it.
 */
export const SPIN_SEQUENCE = [
  'trick-wall-0',
  'trick-wall-1',
  'trick-wall-2',
  'trick-wall-3',
  'trick-wall-back',
] as const;
const SPIN_BACKWARD: readonly string[] = [...SPIN_SEQUENCE].reverse();

/**
 * The frame of the half turn at frame `t` (1..TRICK_SPIN_FRAMES; later frames hold the last). A
 * panel at rest shows its own room's face: the brick in the bonus room, the wooden back in the dojo
 * (`dojoSide`). Leaving a room it turns from that face to the far one (0 → back from the bonus
 * room, back → 0 from the dojo); arriving it turns the other way and settles on the room's own
 * face, so it never snaps. The middle frame (`-2`, edge-on) is when the hero goes through.
 */
export function spinFrame(t: number, dir: 'out' | 'in', dojoSide: boolean): string {
  const n = SPIN_SEQUENCE.length;
  const k = Math.min(n - 1, Math.floor(((Math.max(1, t) - 1) * n) / TRICK_SPIN_FRAMES));
  const fromBrick = (dir === 'out') !== dojoSide;
  return (fromBrick ? SPIN_SEQUENCE[k] : SPIN_BACKWARD[k]) as string;
}

/** The dojo side of a panel: its wooden back faces the room (R3's `dojo` theme). */
const isDojoSide = (theme: string): boolean => theme === 'dojo';

/** Rect fallback colours of the brick face (the theme's brick: top light, body, mortar). */
function brickColours(theme: string): [string, string, string] {
  if (theme === 'underground') return [NES.lavender, NES.blueUnderground, NES.blueDark];
  if (theme === 'ng-sewer') return ['#707c80', '#40484c', '#1c2024'];
  return [NES.lightGray, NES.gray, NES.black];
}

export class TrickWall extends Entity {
  readonly kind = 'trick-wall';
  /** Frames into the half turn while it spins (World.trickSpin), else null. */
  spinT: number | null = null;
  /** Which way the current half turn goes: a player leaving through it, or arriving. */
  spinDir: 'out' | 'in' = 'out';

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

  /** The row (tile) of the panel that carries the mark: the middle one (the lower of two). */
  get markRow(): number {
    return this.zone.y + (this.zone.h >> 1);
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
    else if (this.live || isDojoSide(view.theme)) this.renderRest(r, view, x, y, h);
  }

  /**
   * The half turn (spinFrame), every frame stacked down the panel. Without the `ninja` sheet:
   * rects, the face narrowing to its edge and opening out again. No flashing: it only turns.
   */
  private renderSpin(r: Renderer, view: View, x: number, y: number, h: number, t: number): void {
    const frame = spinFrame(t, this.spinDir, isDojoSide(view.theme));
    if (ninjaFrame(view.assets, frame)) {
      const sheet = view.assets.sheet('ninja', trickPalette(view.theme));
      for (let ty = 0; ty < h; ty += 16) r.sprite(sheet, frame, x, y + ty);
      return;
    }
    r.rect(x, y, 16, h, SKY[view.theme] ?? '#000000');
    const tt = Math.min(t, TRICK_SPIN_FRAMES);
    const c = Math.abs(Math.cos((Math.PI * tt) / TRICK_SPIN_FRAMES));
    const w = Math.max(2, Math.round(16 * c));
    const x0 = x + ((16 - w) >> 1);
    const wood = frame === 'trick-wall-3' || frame === 'trick-wall-back';
    const [light, body, mortar] = wood
      ? [NES.brownLight, NES.orangeBrown, NES.brownDark]
      : brickColours(view.theme);
    for (let ty = 0; ty < h; ty += 4) {
      r.rect(x0, y + ty, w, 4, body);
      r.rect(x0, y + ty, w, 1, light);
      r.rect(x0, y + ty + 3, w, 1, mortar);
    }
    r.rect(x0, y, 1, h, mortar);
    r.rect(x0 + w - 1, y, 1, h, mortar);
  }

  /**
   * A panel at rest, over its tiles. The dojo side shows its wooden back (`trick-wall-back`); a
   * live panel on the brick side shows `trick-wall-cracked` on its marked row (the rest is the
   * wall's own brick). A live panel has a shuriken stuck in the marked row, about 5 px in from the
   * tile's left edge and 3 px down (mirrored on a panel whose room is on its left). A brief glint
   * every two seconds, never with reduce flashing. Without the sheet: a faint seam round the panel
   * and a grey four-point star.
   */
  private renderRest(r: Renderer, view: View, x: number, y: number, h: number): void {
    const my = y + (this.markRow - this.zone.y) * 16;
    if (ninjaFrame(view.assets, 'trick-wall-back') && ninjaFrame(view.assets, 'shuriken-mark')) {
      const sheet = view.assets.sheet('ninja', trickPalette(view.theme));
      if (isDojoSide(view.theme))
        for (let ty = 0; ty < h; ty += 16) r.sprite(sheet, 'trick-wall-back', x, y + ty);
      else if (ninjaFrame(view.assets, 'trick-wall-cracked')) r.sprite(sheet, 'trick-wall-cracked', x, my);
      if (!this.live) return;
      const sx = this.side === 1 ? x + 5 : x + 16 - 5 - 8;
      r.sprite(sheet, 'shuriken-mark', sx, my + 3, this.side === -1);
      if (!view.reduceFlashing && view.frame % 120 < 4) r.rect(sx + 1, my + 4, 1, 1, NES.white);
      return;
    }
    if (!this.live) return;
    const seam = '#000000';
    r.rect(x, y, 16, 1, seam);
    r.rect(x, y + h - 1, 16, 1, seam);
    r.rect(this.side === 1 ? x + 1 : x + 14, y + 1, 1, h - 2, seam);
    const cx = this.side === 1 ? x + 9 : x + 7;
    const cy = my + 7;
    r.rect(cx - 1, cy - 4, 2, 8, NES.lightGray);
    r.rect(cx - 4, cy - 1, 8, 2, NES.lightGray);
    r.rect(cx - 1, cy - 1, 2, 2, NES.darkGray);
    if (!view.reduceFlashing && view.frame % 120 < 4) r.rect(cx - 3, cy - 3, 1, 1, NES.white);
  }
}
