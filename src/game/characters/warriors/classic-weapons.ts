import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import type { View } from '../../entities/entity';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';

/**
 * The Black Mage's three spells (WL-13..WL-15; BlackMageSpell.as, BlackMage.as:19-55): no
 * gravity, through solid ground, piercing every enemy (each hit once), armour stops their damage
 * but not the spell. Every tile the box overlaps is struck each frame, once per contact (the
 * Classic `classicBlocks` 'pass' loop, World.shotBlocks): a plain brick takes the spell's damage
 * (all three break its 125 HP) and a ? block bumps once. Damage in the original's units (WL-11).
 */

/** Shared flags: a free-flying Classic spell. */
const SPELL: Omit<
  ProjectileSpec,
  'kind' | 'damage' | 'amount' | 'speed' | 'lifetime' | 'w' | 'h' | 'frames'
> = {
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: true,
  hitsPlayer: false,
  sheet: 'warriors-fx',
  frameRate: 2,
  pierce: true,
  onBlocked: 'continue',
  classicHit: {},
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
};

/** Fire (Attack): 400, a 16 x 18 box flying 3.75 px/f until off screen. */
export const WL_FIRE: ProjectileSpec = {
  ...SPELL,
  kind: 'wl-fire',
  damage: 'fireball',
  amount: 400,
  speed: 0x03c00,
  lifetime: null,
  w: 16,
  h: 18,
  frames: ['fire-0', 'fire-1', 'fire-2'],
};

/** Ice (Down + Attack): 400, one 48 x 48 burst for 22 frames (5 frames of 75 ms). */
export const WL_ICE: ProjectileSpec = {
  ...SPELL,
  kind: 'wl-ice',
  damage: 'weapon',
  amount: 400,
  speed: 0,
  lifetime: 22,
  w: 48,
  h: 48,
  frames: ['ice-0', 'ice-1', 'ice-2', 'ice-3', 'ice-4'],
};

/** Bolt (Up + Attack): 600, a 27 x 240 column the screen's height for 27 frames (6 of 75 ms). */
export const WL_BOLT: ProjectileSpec = {
  ...SPELL,
  kind: 'wl-bolt',
  damage: 'weapon',
  amount: 600,
  speed: 0,
  lifetime: 27,
  w: 27,
  h: 240,
  frames: ['bolt'],
};

export type WarriorSpellId = 'fire' | 'ice' | 'bolt';
export const WL_SPELLS: Readonly<Record<WarriorSpellId, ProjectileSpec>> = {
  fire: WL_FIRE,
  ice: WL_ICE,
  bolt: WL_BOLT,
};

/** Fire's centre: 19 px ahead of the body's centre (FIRE_X_OFS 38 Flash). */
export const FIRE_AHEAD = 19;
/** Ice's and Bolt's centre: 50 px ahead (ICE_OFS_PNT.x 100 Flash). */
export const BURST_AHEAD = 50;
/** Fire's and Ice's centre height above the feet (FIRE_Y_OFS / ICE_OFS_PNT.y 27 Flash). */
export const SPELL_HEIGHT = 13.5;
/** Bolt's top below the screen top: centred 125 px down, 240 px tall. */
export const BOLT_TOP = 5;

/** A spell on screen: drawn centred on its box (Bolt tiled down its column, anchored to the screen). */
export class WarriorSpell extends Projectile {
  override update(world: World): void {
    // Bolt hangs from the screen top, whatever the camera does (WL-15).
    if (this.spec === WL_BOLT) this.body.y = world.camera.y + px(BOLT_TOP);
    super.update(world);
  }

  override render(r: Renderer, view: View): void {
    const b = this.body;
    const x = toPx(b.x) - view.camX;
    const y = toPx(b.y);
    const w = toPx(b.w);
    const h = toPx(b.h);
    if (this.spec === WL_BOLT) {
      // The column flickers between two looks; with Reduce flashing it holds one.
      const alt = !view.reduceFlashing && (this.age >> 1) & 1;
      const sheet = view.assets.sheet('warriors-fx', alt ? 'war-fx-alt' : 'war-fx');
      for (let i = 0, sy = y; sy < y + h; i++, sy += 16) r.sprite(sheet, 'bolt', x + 1, sy, (i & 1) === 1);
      return;
    }
    const sheet = view.assets.sheet('warriors-fx');
    let frame: string;
    if (this.spec === WL_ICE) {
      // Five frames over its 22: grow, full, fade.
      const i = Math.min(4, Math.floor(((this.age - 1) * 5) / (WL_ICE.lifetime ?? 22)));
      frame = WL_ICE.frames[Math.max(0, i)] as string;
    } else
      frame = this.spec.frames[
        Math.floor(this.age / this.spec.frameRate) % this.spec.frames.length
      ] as string;
    const f = sheet.frames.get(frame);
    const fw = f?.w ?? w;
    const fh = f?.h ?? h;
    r.sprite(sheet, frame, x + ((w - fw) >> 1), y + ((h - fh) >> 1), this.facing < 0);
  }
}

/** Casts spell `id` from where the hero is now (the end of the wind-up; WL-13, WL-14). */
export function castSpell(p: Player, world: World, id: WarriorSpellId): WarriorSpell {
  const spec = WL_SPELLS[id];
  const b = p.body;
  const f = p.facing;
  const cx = b.x + (b.w >> 1) + f * px(id === 'fire' ? FIRE_AHEAD : BURST_AHEAD);
  const feet = b.y + b.h;
  const x = cx - px(spec.w / 2);
  const y = id === 'bolt' ? world.camera.y + px(BOLT_TOP) : feet - px(SPELL_HEIGHT) - px(spec.h / 2);
  const s = new WarriorSpell(Math.round(x), Math.round(y), f, spec, p);
  world.spawn(s);
  world.audio.sfx(id === 'fire' ? 'fireball' : id === 'ice' ? 'magic' : 'beam');
  return s;
}
