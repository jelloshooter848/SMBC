import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Player } from '../player';
import type { Zone } from '../../level/schema';
import type { World } from '../../world/world';

/*
 * Mega Man style teleport pads (the `teleport` zone, docs/WORLD_MAP.md "Teleport pads").
 *
 *   teleport x y -> level x y [exit=beam|fall] [block=bx,by]
 *
 * The pad lies on the floor of tile (x, y). A player who stands on it (on the ground, centre over
 * the pad) is beamed up: hidden, a streak rises off the top of the screen, and the level moves to
 * `target` like a pipe transfer (the running clock carries over within a stage). Arriving with
 * `exit=beam` (the default) a streak drops from the top onto the start tile and the hero appears;
 * `exit=fall` drops in like a pit. Standing on it is the trigger, not a button (owner brief:
 * "stepping on it beams you up"; Mega Man's own teleporters work on touch, and nothing has to be
 * learned or shown). A pad never fires for a player who has not been off it first, so arriving on
 * a pad (or having it appear under you) never sends you straight back.
 *
 * `block=bx,by`: the pad is hidden in that hidden teleporter block (tile `8`) until the block is
 * bumped; it then rises out of the floor with the power-up sound. Art: the `station` sheet
 * (pad-0/1 16×8, beam-0..2 16×32).
 */

/** Frames the pad takes to rise out of the floor once revealed (px 8 over these frames). */
export const PAD_RISE_FRAMES = 16;
/** Beam streak speed, px per frame (up and down). */
export const BEAM_SPEED = 8;
/** Frames the streak shows its gathered `beam-2` frame where the hero stands, before rising / after landing. */
export const BEAM_GATHER_FRAMES = 10;
/** Frames with the streak gone off the top before the next area loads. */
export const BEAM_HOLD_FRAMES = 12;
/** The streak's size (station:beam-*). */
export const BEAM_W = 16;
export const BEAM_H = 32;

export type TeleportZone = Zone & { kind: 'teleport' };

export class TeleportPad extends Entity {
  readonly kind = 'teleporter';
  /** Shown (and usable once risen); false while still hidden in its block. */
  shown: boolean;
  /** Frames since revealed (rising until PAD_RISE_FRAMES). */
  private risen: number;
  /** Players who have been off the pad since it appeared (only they can be beamed). */
  private readonly ready = new Set<Player>();

  constructor(
    readonly zone: TeleportZone,
    hidden: boolean,
  ) {
    super(px(zone.x * 16), px((zone.y + 1) * 16 - 8), 16, 8);
    this.shown = !hidden;
    this.risen = hidden ? 0 : PAD_RISE_FRAMES;
    // While rising out of the floor it is drawn behind the tiles, so the floor hides its lower part.
    this.layer = hidden ? 'back' : 'main';
    this.despawnMargin = null;
  }

  get tx(): number {
    return this.zone.x;
  }

  /** Bumped out of its block: rise out of the floor. */
  reveal(): void {
    if (this.shown) return;
    this.shown = true;
    this.risen = 0;
  }

  get active(): boolean {
    return this.shown && this.risen >= PAD_RISE_FRAMES;
  }

  /** px: the floor the pad lies on. */
  get floorPx(): number {
    return (this.zone.y + 1) * 16;
  }

  /** Player `p` stands on the pad: on the ground at its floor, the body's centre over it. */
  standing(p: Player): boolean {
    if (p.dead || p.out || p.hidden || p.vine || !p.body.onGround) return false;
    const feet = toPx(p.body.y + p.body.h);
    const cx = toPx(p.centerX);
    return Math.abs(feet - this.floorPx) <= 1 && cx >= this.zone.x * 16 && cx < this.zone.x * 16 + 16;
  }

  /** Any part of `p`'s body over the pad (it has not stepped off). */
  private over(p: Player): boolean {
    const b = p.body;
    return b.x < this.body.x + this.body.w && b.x + b.w > this.body.x;
  }

  update(world: World): void {
    if (!this.shown) return;
    if (this.risen < PAD_RISE_FRAMES) this.risen++;
    // Risen: in front of background tiles (the station's walls), behind the players.
    if (this.risen >= PAD_RISE_FRAMES) this.layer = 'main';
    for (const p of world.players) if (!this.over(p) || p.dead) this.ready.add(p);
  }

  /** The first player standing on the active pad who has been off it since it appeared, else null. */
  rider(players: readonly Player[]): Player | null {
    if (!this.active) return null;
    return players.find((p) => this.ready.has(p) && this.standing(p)) ?? null;
  }

  render(r: Renderer, view: View): void {
    if (!this.shown) return;
    const x = this.zone.x * 16 - view.camX;
    const y = this.floorPx - Math.round((8 * this.risen) / PAD_RISE_FRAMES);
    // A slow glow between the two frames; steady with reduce flashing.
    const glow = !view.reduceFlashing && Math.floor(view.frame / 12) % 2 === 1;
    drawStation(r, view, glow ? 'pad-1' : 'pad-0', x, y);
  }
}

/** A beam streak: `x` its centre, `top` its top (screen y, px); `gather`: the gathered frame. */
export function drawBeam(r: Renderer, view: View, x: number, top: number, gather: boolean): void {
  const left = Math.round(x - BEAM_W / 2) - view.camX;
  const frame = gather ? 'beam-2' : !view.reduceFlashing && view.frame % 4 < 2 ? 'beam-1' : 'beam-0';
  drawStation(r, view, frame, left, top);
}

/** Draw a frame of the `station` sheet (src/content/sprites/station.ts). */
function drawStation(r: Renderer, view: View, frame: string, x: number, y: number): void {
  r.sprite(view.assets.sheet('station'), frame, x, y);
}
