import { clipped, type Renderer } from '@engine/gfx/renderer';
import { px, tileAt, toPx, velToSub } from '@engine/math/units';
import type { View } from '../../entities/entity';
import { moveX, moveY } from '../../entities/body';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { HUD_BOTTOM } from '../../hud/hud';

/**
 * Sir Arthur's weapons (bug-reports/2026-10-19-arthur-build-classic-character.md, AR-10..AR-19).
 * He was never in SMBC 3.1.21, so every number is a tuning value (T) from the report, translated
 * from Ghosts 'n Goblins by feel. Damage in Classic units (a Goomba has 250 HP); velocities in
 * 1/4096 px/f. Steel weapons have pierce 0 (armour blocks them, with the `kick` sound, HP-C14);
 * the Gold armour's add 100 and pierce 6 (AR-18). The fx sheet stores the shots pointing left.
 */

export type ArthurWeaponId = 'lance' | 'dagger' | 'torch' | 'axe';
/** In `p.scratch.weapon` order. */
export const ARTHUR_WEAPONS: readonly ArthurWeaponId[] = ['lance', 'dagger', 'torch', 'axe'];
/** What the HUD writes and the screen reader says (AR-27). */
export const WEAPON_NAMES: Readonly<Record<ArthurWeaponId, string>> = {
  lance: 'Lance',
  dagger: 'Dagger',
  torch: 'Torch',
  axe: 'Axe',
};

/** The Gold armour's extra damage and pierce (AR-18). */
export const GOLD_BONUS = 100;
const GOLD_PIERCE = 6;
/** The torch's floor fire (AR-12; owner 2026-10-20): 73 f, re-hits every 24 f, so 4 touches (0/24/48/72). */
export const FIRE_FRAMES = 73;
export const FIRE_REHIT = 24;
/** Lightning (AR-19): 40 f wind-up, 20 f bolts, 90 f cooldown, 56 px either side, 24 px wide. */
export const MAGIC_WINDUP = 40;
export const BOLT_FRAMES = 20;
export const MAGIC_COOLDOWN = 90;
export const BOLT_AHEAD = 56;
export const BOLT_DAMAGE = 600;
/**
 * The column's top on the screen (px): 8 px under the HUD's rows, clear of the power icon at their
 * left end (patch-2 item 7).
 */
export const BOLT_TOP = HUD_BOTTOM + 8;

const STEEL_HIT = { blockedSfx: 'kick' } as const;
const GOLD_HIT = { pierce: GOLD_PIERCE, blockedSfx: 'kick' } as const;

const BASE: Omit<ProjectileSpec, 'kind' | 'amount' | 'speed' | 'w' | 'h' | 'frames'> = {
  damage: 'weapon',
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  sheet: 'arthur-fx',
  frameRate: 4,
  classicHit: STEEL_HIT,
  onBlocked: 'burst',
  // Stopped by walls, a plain brick breaks, a ? block bumps; it ends on the block (AR-11).
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
};

/** Lance: 300, straight at 4 px/f, ends on the hit. */
export const LANCE: ProjectileSpec = {
  ...BASE,
  kind: 'arthur-lance',
  amount: 300,
  speed: 0x04000,
  w: 16,
  h: 4,
  frames: ['lance'],
};

/** Dagger: 200, straight at 5.5 px/f. */
export const DAGGER: ProjectileSpec = {
  ...BASE,
  kind: 'arthur-dagger',
  amount: 200,
  speed: 0x05800,
  w: 10,
  h: 4,
  frames: ['dagger'],
};

/** Torch: 250, a lob (vx 2, vy -2.5 px/f, gravity 0.1667 px/f²); ArthurTorch lights the fire. */
export const TORCH: ProjectileSpec = {
  ...BASE,
  kind: 'arthur-torch',
  amount: 250,
  speed: 0x02000,
  vy: -0x02800,
  gravity: 0x002ab,
  w: 8,
  h: 8,
  frames: ['torch-0', 'torch-1'],
};

/** The torch's floor fire (AR-12): 150 a touch, armour-piercing, every 24 f, for 73 f (4 touches). */
export const TORCH_FIRE: ProjectileSpec = {
  ...BASE,
  kind: 'arthur-fire',
  amount: 150,
  speed: 0,
  lifetime: FIRE_FRAMES,
  w: 16,
  h: 10,
  frames: ['flame-0', 'flame-1'],
  frameRate: 8,
  pierce: true,
  rehitAfter: FIRE_REHIT,
  classicHit: { pierce: GOLD_PIERCE },
  onBlocked: 'continue',
  // It strikes a brick it touches (World.shotBlocks), once per contact.
  classicBlocks: { ground: 'collide', afterBlock: 'continue', strikesBlocks: true },
};

/** Axe: 400, an upward arc through ground (vx 2.5, vy -3.5, gravity 0.15, cap 6 px/f). */
export const AXE: ProjectileSpec = {
  ...BASE,
  kind: 'arthur-axe',
  amount: 400,
  speed: 0x02800,
  vy: -0x03800,
  gravity: 0x00266,
  maxFall: 0x06000,
  w: 12,
  h: 12,
  frames: ['axe-0', 'axe-1', 'axe-2', 'axe-3'],
  // Through every enemy it kills, ends on one it does not (AR-11).
  pierceDefeat: true,
  // Through ground; strikes bricks and flies on (as Simon's Axe, SI-C21).
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
};

/** The Gold armour's look and numbers for `spec` (AR-18). */
function gold(spec: ProjectileSpec): ProjectileSpec {
  return {
    ...spec,
    amount: spec.amount + GOLD_BONUS,
    sheet: 'arthur-gold-fx',
    classicHit: spec === TORCH_FIRE ? { pierce: GOLD_PIERCE } : GOLD_HIT,
  };
}
/** Thrown straight down (AR-14): the lance and dagger turned to point down. */
function down(spec: ProjectileSpec, frame: string): ProjectileSpec {
  return { ...spec, w: spec.h, h: spec.w, frames: [frame] };
}

/** One weapon's specs and rate (AR-11, AR-13). */
export interface ArthurWeapon {
  id: ArthurWeaponId;
  steel: ProjectileSpec;
  gold: ProjectileSpec;
  /** The down-throw's spec (lance and dagger turned; torch and axe as thrown). */
  steelDown: ProjectileSpec;
  goldDown: ProjectileSpec;
  /** Frames between throws. */
  delay: number;
  /** On screen at most, by power state. */
  cap: Readonly<Record<string, number>>;
}

const LANCE_DOWN = down(LANCE, 'lance-down');
const DAGGER_DOWN = down(DAGGER, 'dagger-down');
export const GOLD_TORCH_FIRE = gold(TORCH_FIRE);

export const WEAPONS: Readonly<Record<ArthurWeaponId, ArthurWeapon>> = {
  lance: {
    id: 'lance',
    steel: LANCE,
    gold: gold(LANCE),
    steelDown: LANCE_DOWN,
    goldDown: gold(LANCE_DOWN),
    delay: 12,
    cap: { small: 2, big: 2, fire: 3 },
  },
  dagger: {
    id: 'dagger',
    steel: DAGGER,
    gold: gold(DAGGER),
    steelDown: DAGGER_DOWN,
    goldDown: gold(DAGGER_DOWN),
    delay: 8,
    cap: { small: 3, big: 3, fire: 4 },
  },
  torch: {
    id: 'torch',
    steel: TORCH,
    gold: gold(TORCH),
    steelDown: TORCH,
    goldDown: gold(TORCH),
    delay: 16,
    cap: { small: 1, big: 1, fire: 2 },
  },
  axe: {
    id: 'axe',
    steel: AXE,
    gold: gold(AXE),
    steelDown: AXE,
    goldDown: gold(AXE),
    delay: 20,
    cap: { small: 1, big: 1, fire: 2 },
  },
};

/** Every thrown weapon's kind (the fire is not a throw: it does not count toward the cap). */
export const ARTHUR_SHOT_KINDS: ReadonlySet<string> = new Set([
  LANCE.kind,
  DAGGER.kind,
  TORCH.kind,
  AXE.kind,
]);

/**
 * The torch (AR-11, AR-12): a lob that ends on ground, a wall, a ceiling or an enemy, lighting the
 * floor fire there; it strikes the block it hits with its own damage.
 */
export class ArthurTorch extends Projectile {
  override update(world: World): void {
    const b = this.body;
    this.age++;
    b.vy += this.spec.gravity;
    if (b.vy > 0x04000) b.vy = 0x04000;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) return this.ignite(world, b.x + (b.hitWall > 0 ? b.w : -1), b.y + (b.h >> 1));
    moveY(b, world.map, velToSub(b.vy));
    if (b.onGround) return this.ignite(world, b.x + (b.w >> 1), b.y + b.h);
    if (b.hitHead) return this.ignite(world, b.x + (b.w >> 1), b.y - 1);
    const camL = world.camera.x - px(16);
    const camR = world.camera.right + px(16);
    // A torch falling into a pit is gone.
    if (b.x + b.w < camL || b.x > camR || this.isBelowLevel()) this.destroy();
  }

  /** An enemy hit ends it too: the fire starts there. */
  override burst(world: World): void {
    if (!this.alive) return;
    this.ignite(world, null, null);
  }

  private ignite(world: World, x: number | null, y: number | null): void {
    const b = this.body;
    const s = this.spec.sheet === 'arthur-gold-fx' ? GOLD_TORCH_FIRE : TORCH_FIRE;
    const fire = new TorchFire(b.x + (b.w >> 1) - px(s.w >> 1), b.y + b.h - px(s.h), s, this.owner as Player);
    world.spawn(fire);
    if (x !== null && y !== null) {
      world.shotBlockAt(this, x, y);
      // The fire does not strike that block again while it touches it.
      fire.touchingTiles().add(`${tileAt(x)},${tileAt(y)}`);
    }
    world.audio.sfx('fireball');
    this.destroy();
  }
}

/**
 * The torch's floor fire (AR-12): drops to the ground where it was lit and burns there for 73 f,
 * hitting each enemy inside it again every 24 f; gone into a pit. It never hurts Arthur.
 */
export class TorchFire extends Projectile {
  constructor(x: number, y: number, spec: ProjectileSpec, owner: Player) {
    super(x, y, owner.facing, spec, owner, { vx: 0, vy: 0 });
  }

  override update(world: World): void {
    for (const id of [...this.hitIds]) {
      if (world.frame - (this.hitAt?.get(id) ?? -Infinity) < FIRE_REHIT) continue;
      this.hitIds.delete(id);
      this.hitAt?.delete(id);
    }
    const b = this.body;
    this.age++;
    if (this.age > FIRE_FRAMES) return this.destroy();
    b.vy = Math.min(b.vy + TORCH.gravity, 0x04000);
    moveY(b, world.map, velToSub(b.vy));
    if (b.onGround) b.vy = 0;
    world.shotBlocks(this);
    if (this.isBelowLevel()) this.destroy();
  }
}

/** Lightning (AR-19): a bolt column, 24 px wide, from the top of the screen to the ground. */
export const BOLT: ProjectileSpec = {
  kind: 'arthur-bolt',
  damage: 'weapon',
  amount: BOLT_DAMAGE,
  speed: 0,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: BOLT_FRAMES,
  w: 24,
  h: 16,
  sheet: 'arthur-fx',
  frames: ['bolt'],
  frameRate: 2,
  // Each enemy once; through armour.
  pierce: true,
  classicHit: { pierce: GOLD_PIERCE },
  onBlocked: 'continue',
};

export class ArthurBolt extends Projectile {
  /** Its column from the screen's top to the first solid tile under `feet` (subpixels). */
  constructor(cx: number, feet: number, world: World, owner: Player) {
    const top = world.camera.y;
    super(cx - px(BOLT.w >> 1), top, owner.facing, BOLT, owner, { vx: 0, vy: 0 });
    const tx = tileAt(cx);
    let ty = tileAt(feet - 1);
    const last = tileAt(world.camera.y) + 16;
    while (ty < last && !world.map.isSolid(tx, ty)) ty++;
    this.body.h = Math.max(px(16), px(ty * 16) - top);
  }

  override render(r: Renderer, view: View): void {
    const b = this.body;
    const x = toPx(b.x) - view.camX + 4;
    const y = toPx(b.y);
    const h = toPx(b.h);
    // The column flickers between two looks; with Reduce flashing it holds one.
    const alt = !view.reduceFlashing && ((this.age >> 1) & 1) === 1;
    const sheet = view.assets.sheet('arthur-fx', alt ? 'arthur-fx-alt' : 'arthur-fx');
    // From the ground up to BOLT_TOP, the top piece cut there, so it never reaches the HUD.
    const top = Math.max(y, BOLT_TOP);
    const bottom = y + h;
    if (bottom <= top) return;
    clipped(r, x, top, 16, bottom - top, () => {
      for (let i = 0, sy = bottom - 16; sy + 16 > top; i++, sy -= 16)
        r.sprite(sheet, 'bolt', x, sy, (i & 1) === 1);
    });
  }
}
