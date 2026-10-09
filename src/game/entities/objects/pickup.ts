import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/** Things enemies drop for specific characters. */
export type PickupKind =
  | 'bomb'
  | 'magic-small'
  | 'magic-large'
  | 'heart-small'
  | 'heart-large'
  | 'health-small'
  | 'health-large'
  | 'weapon-small'
  | 'weapon-large'
  | 'e-tank'
  | 'energy-small'
  | 'energy-large'
  | 'missile-pack'
  | 'ninpo-small'
  | 'ninpo-large'
  | 'capsule'
  /** Sophia III's missile ammo (her own sheet). */
  | 'triple-ammo'
  | 'homing-ammo';

/** A pickup kind's name, as a map's `pickup x y item=<kind>` gives it. */
export function isPickupKind(v: unknown): v is PickupKind {
  return typeof v === 'string' && Object.hasOwn(FRAMES, v);
}

const FRAMES: Record<PickupKind, { frame: string; size: number; sheet?: string }> = {
  bomb: { frame: 'bomb-0', size: 16 },
  'magic-small': { frame: 'magic-jar-small', size: 8 },
  'magic-large': { frame: 'magic-jar-large', size: 16 },
  'heart-small': { frame: 'heart-small', size: 8 },
  'heart-large': { frame: 'heart-large', size: 16 },
  'health-small': { frame: 'pellet-small', size: 8 },
  'health-large': { frame: 'pellet-large', size: 16 },
  'weapon-small': { frame: 'weapon-pellet-small', size: 8 },
  'weapon-large': { frame: 'weapon-pellet-large', size: 16 },
  'e-tank': { frame: 'e-tank', size: 16 },
  'energy-small': { frame: 'energy-orb-small', size: 8 },
  'energy-large': { frame: 'energy-orb-large', size: 16 },
  'missile-pack': { frame: 'missile-pack', size: 16 },
  'ninpo-small': { frame: 'ninpo-small', size: 8 },
  'ninpo-large': { frame: 'ninpo-large', size: 16 },
  capsule: { frame: 'capsule', size: 16 },
  'triple-ammo': { frame: 'ammo-triple', size: 16, sheet: 'sophia' },
  'homing-ammo': { frame: 'ammo-homing', size: 16, sheet: 'sophia' },
};

export const PICKUP_LIFETIME = 480;
const BLINK_FRAMES = 90;

/** A dropped item: falls, sits for a while, blinks, then vanishes. */
export class Pickup extends Entity {
  readonly kind = 'pickup';
  private life = PICKUP_LIFETIME;

  constructor(
    cx: number,
    bottom: number,
    readonly item: PickupKind,
    /** Laid by the map (`pickup x y item=<kind>`): it sits there for good, no hop, no blink. */
    readonly placed = false,
  ) {
    const size = FRAMES[item].size;
    super(cx - px(size >> 1), bottom - px(size), size, size);
    this.layer = 'front';
    if (placed) {
      this.life = Infinity;
      this.despawnMargin = null;
    } else this.body.vy = -0x02000; // a little hop out of the corpse
  }

  update(world: World): void {
    if (--this.life <= 0 || this.isBelowLevel()) return this.destroy();
    this.fall(world);
  }

  render(r: Renderer, view: View): void {
    if (this.life < BLINK_FRAMES && !view.reduceFlashing && (view.frame & 2) === 0) return;
    const f = FRAMES[this.item];
    r.sprite(view.assets.sheet(f.sheet ?? 'items'), f.frame, this.screenX(view), this.screenY());
  }
}
