import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { BrickPiece } from '../effects/effects';
import { PowerUp } from './powerup';
import type { World } from '../../world/world';

/** Frames the egg takes to rise out of its block (a power-up's rise). */
export const EGG_RISE_FRAMES = 32;
/** Frames it sits on the block, wobbling, before it cracks. */
export const EGG_WOBBLE_FRAMES = 48;
/** Frames it shows its crack before it bursts. */
export const EGG_CRACK_FRAMES = 16;
/** Frames from the bump to the hatch. */
export const EGG_HATCH_FRAME = EGG_RISE_FRAMES + EGG_WOBBLE_FRAMES + EGG_CRACK_FRAMES;

/**
 * Whether Yoshi has been unlocked on the file, so his egg hatches him. Yoshi is not in the game
 * yet: always false.
 *
 * TODO(yoshi): a later release unlocks Yoshi (docs/ROADMAP.md). Then read it from the save file
 * here (through `world`), and `hatch` below lets Yoshi out instead of the 1-up.
 */
export function yoshiUnlocked(_world: World): boolean {
  return false;
}

/**
 * What comes out of a Yoshi egg that bursts with its bottom-centre at (`cx`, `feet`) (subpixels).
 * Super Mario World's egg block gives a 1-up when Yoshi is already with you; here Yoshi is not in
 * the game yet, so the egg always hatches a 1-up mushroom, which hops out and runs off.
 *
 * The hook for a later release: when `yoshiUnlocked(world)`, spawn Yoshi here instead (TODO above).
 */
export function hatch(world: World, cx: number, feet: number): Entity {
  if (yoshiUnlocked(world)) return hatchYoshi(world, cx, feet);
  return hatchOneUp(world, cx, feet);
}

/** A 1-up mushroom hops out of the egg and runs off (Super Mario World's egg with Yoshi along). */
function hatchOneUp(world: World, cx: number, feet: number): Entity {
  const out = PowerUp.hopOut(cx, feet, '1up');
  world.spawn(out);
  world.audio.sfx('powerup-appear');
  return out;
}

/**
 * Yoshi out of his egg, once he is unlocked.
 *
 * TODO(yoshi): spawn Yoshi here (`world.spawn(new Yoshi(cx, feet))`) once he exists. Until then
 * (yoshiUnlocked is always false, so this never runs) the 1-up stands in.
 */
function hatchYoshi(world: World, cx: number, feet: number): Entity {
  return hatchOneUp(world, cx, feet);
}

/**
 * The Top Secret Area's centre block (T.Q_EGG, 0.4.10): a green-spotted Yoshi egg rises out of
 * it like a power-up, sits on top wobbling, cracks and bursts in four bits of shell, and `hatch`
 * lets out what it holds (a 1-up for now). Scenery while it sits: nothing touches it.
 */
export class YoshiEgg extends Entity {
  readonly kind = 'yoshi-egg';
  private t = 0;
  private readonly restY: number;

  constructor(tx: number, ty: number) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 16);
    this.restY = px((ty - 1) * 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
    this.despawnMargin = null;
  }

  /** The egg's phase: rising out of the block, wobbling on it, cracked, or hatched (gone). */
  get phase(): 'rise' | 'wobble' | 'crack' | 'hatched' {
    if (this.t < EGG_RISE_FRAMES) return 'rise';
    if (this.t < EGG_RISE_FRAMES + EGG_WOBBLE_FRAMES) return 'wobble';
    if (this.t < EGG_HATCH_FRAME) return 'crack';
    return 'hatched';
  }

  update(world: World): void {
    this.t++;
    const b = this.body;
    if (this.t <= EGG_RISE_FRAMES) {
      b.y -= px(16) / EGG_RISE_FRAMES;
      if (this.t === EGG_RISE_FRAMES) {
        b.y = this.restY;
        this.layer = 'main';
      }
      return;
    }
    if (this.t === EGG_RISE_FRAMES + EGG_WOBBLE_FRAMES) world.audio.sfx('bump');
    if (this.t < EGG_HATCH_FRAME) return;
    // Burst: four bits of shell fly off, and what the egg held hops out.
    const cx = b.x + (b.w >> 1);
    const feet = b.y + b.h;
    const sx = cx - px(8);
    world.spawn(new BrickPiece(sx, b.y, -0x01000, -0x04000, 'items:egg-shell'));
    world.spawn(new BrickPiece(sx + px(8), b.y, 0x01000, -0x04000, 'items:egg-shell'));
    world.spawn(new BrickPiece(sx, b.y + px(8), -0x01000, -0x02800, 'items:egg-shell'));
    world.spawn(new BrickPiece(sx + px(8), b.y + px(8), 0x01000, -0x02800, 'items:egg-shell'));
    this.destroy();
    hatch(world, cx, feet);
  }

  /** The frame for the egg now: still, tipped left or right while it wobbles, then cracked. */
  frame(): string {
    if (this.phase === 'crack') return 'yoshi-egg-crack';
    if (this.phase !== 'wobble') return 'yoshi-egg';
    // A rocking wobble that quickens: tipped every 8 frames, then every 4.
    const w = this.t - EGG_RISE_FRAMES;
    const step = w < EGG_WOBBLE_FRAMES / 2 ? 8 : 4;
    const k = Math.floor(w / step) % 4;
    return k === 1 ? 'yoshi-egg-l' : k === 3 ? 'yoshi-egg-r' : 'yoshi-egg';
  }

  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), this.frame(), toPx(this.body.x) - view.camX - 2, toPx(this.body.y));
  }
}
