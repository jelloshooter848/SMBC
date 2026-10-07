import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { px, tileAt, toPx } from '@engine/math/units';
import { T } from '../../level/tiles';
import { Entity, type View } from '../entity';
import type { Player } from '../player';
import type { MovementProfile } from '../../characters/profile';
import type { World } from '../../world/world';

/*
 * 7-3's exploding bridge (campaign only, owner decision for 0.4.9: the way into Bill Rizer's jungle
 * camp; docs/HEROES.md). `bridge-blast x y w=N campaign=true` marks the N bridge tiles from (x, y)
 * rightward: steel girders with a blinking red light on the post at their end. When a hero steps
 * onto them they blow up segment by segment, as the bridges of Contra's first stage do: from the
 * end the hero came on at, each segment flashes for BLAST_FLASH frames, then explodes (a boom and
 * its sound) and is gone (open air). The chain chases a ghost: a hero with the slowest active
 * hero's movement setting off at the moment of the step (as fast as the hero who stepped on, else
 * from rest), at that hero's top speed once up to it (`blastTimes`); each segment blows once the
 * ghost is BLAST_LEAD px past its far end. So
 * a hero who runs flat out from rest on the post just about outruns it (8-25 px to spare, every
 * hero); one who walks or stops falls through the gap, which a campaign `pit` zone over the
 * bridge's columns turns into the drop into the camp.
 * The bridge is whole again whenever the level is entered again (a respawn, a re-entry): the map's
 * tiles are copied fresh for every World.
 */

/**
 * How far (px) the chain's ghost runs past a segment's far end before that segment blows. A hero
 * stepping on from rest stands about 11 px behind the bridge's end, so the chain keeps roughly
 * BLAST_LEAD - 11 px behind its heels the whole way across (QA 0.4.9: the old 0.8-pace chain left
 * 40-80 px by the far pillar).
 */
export const BLAST_LEAD = 28;
/** Frames a segment flashes before it blows. */
export const BLAST_FLASH = 16;
/** Frames the boom sprite shows (four frames of the explosion). */
export const BOOM_FRAMES = 20;
/** The `contra` sheet (B3's art): `blast-bridge-0..1`, `boom-0..3`; rect and item fallbacks without it. */
export const CONTRA_SHEET = 'contra';

/**
 * The frames (from the step) the bridge's `n` segments blow, in chain order, for a hero with
 * movement `m` stepping on at `speed` (|vx|, 1/4096 px a frame): a ghost of that hero runs on from
 * the bridge's end at that speed, or from rest (its first step at `minWalk`), speeding up by
 * `runAccel` (`walkAccel` for heroes who cannot run) to its top speed (Mega Man straight at his),
 * and each segment blows the first frame the ghost is BLAST_LEAD px past its far end.
 */
export function blastTimes(m: MovementProfile, n: number, speed = 0): number[] {
  const top = m.canRun ? m.maxRun : m.maxWalk;
  const accel = m.canRun ? m.runAccel : m.walkAccel;
  const out: number[] = [];
  let v = Math.min(top, Math.abs(speed));
  let g = 0;
  for (let t = 1; out.length < n; t++) {
    v = m.instantAccel ? top : v === 0 ? Math.max(1, m.minWalk) : Math.min(top, v + accel);
    g += v;
    while (out.length < n && g >= (16 * (out.length + 1) + BLAST_LEAD) * 4096) out.push(t);
  }
  return out;
}

/** Whether the `contra` sheet is registered and has `frame`. */
function contraFrame(assets: AssetRegistry, frame: string): boolean {
  if (!assets.has(CONTRA_SHEET)) return false;
  try {
    return assets.sheet(CONTRA_SHEET).frames.has(frame);
  } catch {
    return false;
  }
}

const POST = '#7c7c7c';
const POST_DARK = '#3c3c3c';
const LIGHT_ON = '#f83800';
const LIGHT_OFF = '#881400';

export class BridgeBlast extends Entity {
  readonly kind = 'bridge-blast';
  /** 'armed' until a hero steps on; 'blowing' while the chain runs; 'gone' once every segment blew. */
  state: 'armed' | 'blowing' | 'gone' = 'armed';
  /** Frames since the chain started. */
  t = 0;
  /** Which way the chain runs: 1 from the left end (a hero coming from the left), -1 from the right. */
  dir: 1 | -1 = 1;
  /** The frame (since the chain started) each segment blows, in chain order (blastTimes). */
  times: number[] = [];
  /** Segments blown so far, in chain order. */
  blown = 0;

  constructor(
    readonly tx: number,
    readonly ty: number,
    readonly w: number,
  ) {
    super(px(tx * 16), px(ty * 16), w * 16, 16);
    this.despawnMargin = null;
  }

  /** The column of the k-th segment in chain order. */
  column(k: number): number {
    return this.dir > 0 ? this.tx + k : this.tx + this.w - 1 - k;
  }

  /** The frame (since the chain started) the k-th segment in chain order blows. */
  blowAt(k: number): number {
    return this.times[k] ?? Infinity;
  }

  /** A hero standing on an intact segment of this bridge. */
  private standingOn(world: World, p: Player): boolean {
    const b = p.body;
    if (!b.onGround || p.vine || toPx(b.y + b.h) !== this.ty * 16) return false;
    for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++)
      if (tx >= this.tx && tx < this.tx + this.w && world.map.get(tx, this.ty) === T.BRIDGE) return true;
    return false;
  }

  /**
   * Starts the chain from the end `p` came on at: the end of the half of the bridge it stands on
   * (whichever way it faces: a hero may land facing back), paced for the slowest hero: the one
   * whose ghost takes longest to cross.
   */
  private trigger(world: World, p: Player): void {
    this.state = 'blowing';
    this.t = 0;
    this.dir = toPx(p.centerX) < this.tx * 16 + (this.w * 16) / 2 ? 1 : -1;
    const last = (t: number[]) => t[t.length - 1] ?? 0;
    this.times = [];
    for (const o of world.activePlayers()) {
      const times = blastTimes(o.profile, this.w, o === p ? o.body.vx : 0);
      if (this.times.length === 0 || last(times) > last(this.times)) this.times = times;
    }
  }

  update(world: World): void {
    if (this.state === 'gone') return;
    if (this.state === 'armed') {
      const p = world.activePlayers().find((o) => this.standingOn(world, o));
      if (p) this.trigger(world, p);
      return;
    }
    this.t++;
    while (this.blown < this.w && this.t >= this.blowAt(this.blown)) this.blow(world, this.blown++);
    if (this.blown >= this.w) this.state = 'gone';
  }

  /** The k-th segment explodes: a boom over it, the sound, and it is open air. */
  private blow(world: World, k: number): void {
    const x = this.column(k);
    if (world.map.get(x, this.ty) === T.BRIDGE) world.map.set(x, this.ty, T.AIR);
    world.spawn(new BridgeBoom(px(x * 16 + 8), px(this.ty * 16 + 8)));
    world.audio.sfx(world.bridgeBoomSfx);
  }

  render(r: Renderer, view: View): void {
    if (this.state === 'gone') return;
    // The light on the end post blinks about once a second (steady with reduce flashing).
    const lit = view.reduceFlashing || ((view.frame >> 5) & 1) === 0;
    const girders = contraFrame(view.assets, 'blast-bridge-0');
    if (!girders) {
      // The end post: the column before the marked end (the side the chain starts on at rest).
      const post = this.tx - 1;
      const sx = post * 16 - view.camX;
      const sy = this.ty * 16;
      r.rect(sx + 6, sy - 7, 4, 7, POST);
      r.rect(sx + 6, sy - 7, 1, 7, POST_DARK);
      r.rect(sx + 5, sy - 10, 6, 3, lit ? LIGHT_ON : LIGHT_OFF);
    }
    for (let k = this.blown; k < this.w; k++) {
      const x = this.column(k);
      const sx = x * 16 - view.camX;
      if (sx < -16 || sx > 256) continue;
      const sy = this.ty * 16;
      if (girders)
        r.sprite(view.assets.sheet(CONTRA_SHEET), lit ? 'blast-bridge-0' : 'blast-bridge-1', sx, sy);
      const at = this.blowAt(k);
      if (this.state !== 'blowing' || this.t < at - BLAST_FLASH) continue;
      // About to blow: a strobe, or with reduce flashing a steady glow.
      if (view.reduceFlashing) r.rect(sx, sy, 16, 16, 'rgba(248,120,0,0.45)');
      else if ((this.t >> 2) & 1) r.rect(sx, sy, 16, 16, 'rgba(255,255,255,0.7)');
    }
  }
}

/** One segment's explosion: the `contra` sheet's boom-0..3 (32x32), else the items sheet's blast. */
export class BridgeBoom extends Entity {
  readonly kind = 'bridge-boom';
  age = 0;
  constructor(cx: number, cy: number) {
    super(cx - px(16), cy - px(16), 32, 32);
    this.layer = 'front';
    this.despawnMargin = null;
  }
  update(): void {
    if (++this.age >= BOOM_FRAMES) this.destroy();
  }
  render(r: Renderer, view: View): void {
    const n = Math.min(3, Math.floor((this.age * 4) / BOOM_FRAMES));
    const x = this.screenX(view);
    const y = this.screenY();
    if (contraFrame(view.assets, `boom-${n}`)) r.sprite(view.assets.sheet(CONTRA_SHEET), `boom-${n}`, x, y);
    else r.sprite(view.assets.sheet('items'), `explosion-${Math.min(2, n)}`, x, y);
  }
}
