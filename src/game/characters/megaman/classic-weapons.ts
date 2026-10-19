import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { px, tileAt, toPx, velToSub } from '@engine/math/units';
import { overlaps } from '@engine/math/aabb';
import { Entity, type View } from '../../entities/entity';
import {
  Projectile,
  type ClassicBlocks,
  type ProjectileOptions,
  type ProjectileSpec,
} from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { ClassicHitProps } from '../../rules/damage';
import { T, tileDef } from '../../level/tiles';

/**
 * Classic SMBC Mega Man's shots and Robot Master weapons (2026-10-07-megaman-classic-smbc-rules.md
 * MM-C19..MM-C27). Damage is in the original's units (a Goomba has 250, HP-C); every shot flies
 * through solid ground and strikes bricks and ? blocks (BR-C), unless its row says otherwise.
 * Speeds are 1/4096 px per frame (0x1000 = 1 px/f), from the original's px/s ÷ 120.
 *
 * Built to be shared by the Classic Mega Man variants (Bass, Proto Man: FU-1, FU-5): every spec,
 * shot class and weapon row here is plain data or takes its owner as a parameter.
 */

/** Each weapon's energy in units: 28 bars of 4 (MM-C17). */
export const WEAPON_UNITS = 112;

export type MMWeaponId =
  | 'metal-blade'
  | 'super-arm'
  | 'hard-knuckle'
  | 'pharaoh-shot'
  | 'charge-kick'
  | 'flame-blast'
  | 'magma-bazooka'
  | 'water-shield'
  | 'screw-crusher';

/**
 * The Fire Flower's weapon (MM-C21): the original's Customize Weapons default. One constant so the
 * follow-up (FU-7) can switch it.
 */
export const CLASSIC_FLOWER_WEAPON: MMWeaponId = 'metal-blade';

/** One Robot Master weapon (MM-C22). */
export interface MMWeapon {
  id: MMWeaponId;
  name: string;
  /** Touch caption (short, upper case). */
  label: string;
  /** HUD icon on the items sheet. */
  icon: string;
  /** Suit palette while it is the Flower weapon (MM-C23). */
  palette: string;
  /** Energy bar colour. */
  colour: string;
  /** Units per use. */
  cost: number;
  /** Fired from the ground it stops him for MM_ROOT_FRAMES (MM-C24). */
  roots: boolean;
}

export const MM_WEAPONS: readonly MMWeapon[] = [
  w('metal-blade', 'Metal Blade', 'BLADE', 'icon-saw', 'megaman-saw', '#bcbcbc', 2, true),
  w('super-arm', 'Super Arm', 'ARM', 'icon-super-arm', 'megaman-arm', '#f8b800', 8, true),
  w('hard-knuckle', 'Hard Knuckle', 'KNUCKLE', 'icon-knuckle', 'megaman-knuckle', '#f878f8', 8, true),
  w('pharaoh-shot', 'Pharaoh Shot', 'PHARAOH', 'icon-pharaoh', 'megaman-bolt', '#f8d878', 4, true),
  w('charge-kick', 'Charge Kick', 'KICK', 'icon-kick', 'megaman-kick', '#f87858', 4, false),
  w('flame-blast', 'Flame Blast', 'FLAME', 'icon-flame', 'megaman-flame', '#f83800', 4, false),
  w('magma-bazooka', 'Magma Bazooka', 'MAGMA', 'icon-magma', 'megaman-rush', '#d82800', 2, false),
  w('water-shield', 'Water Shield', 'SHIELD', 'icon-water-shield', 'megaman-water', '#3cbcfc', 16, false),
  w('screw-crusher', 'Screw Crusher', 'SCREW', 'icon-screw', 'megaman-plain', '#a4e4fc', 2, true),
];

function w(
  id: MMWeaponId,
  name: string,
  label: string,
  icon: string,
  palette: string,
  colour: string,
  cost: number,
  roots: boolean,
): MMWeapon {
  return { id, name, label, icon, palette, colour, cost, roots };
}

export function mmWeapon(id: MMWeaponId): MMWeapon {
  return MM_WEAPONS.find((x) => x.id === id) as MMWeapon;
}

/** The ground stop after a thrown weapon, 200 ms (MM-C24). */
export const MM_ROOT_FRAMES = 12;

/* ---------- specs ---------- */

/** Every Mega Man hit blinks the enemy invisible for 2 frames (HP-C16); armour clinks (HP-C14). */
export const MM_HIT: ClassicHitProps = { blinkFrames: 2, blockedSfx: 'armour' };

const PASS_END: ClassicBlocks = { ground: 'pass', afterBlock: 'end', strikesBlocks: true };
const PASS_ON: ClassicBlocks = { ground: 'pass', afterBlock: 'continueIfBroken', strikesBlocks: true };
const COLLIDE_END: ClassicBlocks = { ground: 'collide', afterBlock: 'end', strikesBlocks: true };
const NO_TILES: ClassicBlocks = { ground: 'none', afterBlock: 'end', strikesBlocks: false };

/** 450 px/s (3.75 px/f): the buster, charge shots, Metal Blade and most weapons. */
export const MM_SHOT_SPEED = 0x03c00;
/** A diagonal at 3.75 px/f: 2.8125 px/f on each axis (0x02D00). */
export const MM_DIAGONAL = 0x02d00;

type Body = Omit<ProjectileSpec, 'kind' | 'amount' | 'w' | 'h' | 'frames' | 'frameRate'>;
const SHOT: Body = {
  damage: 'buster',
  speed: MM_SHOT_SPEED,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  sheet: 'items',
  classicHit: MM_HIT,
  classicBlocks: PASS_END,
  onBlocked: 'deflect',
};
const WEAPON: Body = { ...SHOT, damage: 'weapon' };

/** The Mega Buster (MM-C19): 100, straight ahead, through ground; armour bounces it back. */
export const MM_BUSTER: ProjectileSpec = {
  ...SHOT,
  kind: 'mm-buster',
  amount: 100,
  w: 8,
  h: 6,
  frames: ['buster-0', 'buster-1'],
  frameRate: 3,
};

/** The weak Charge Shot (MM-C20): 200, ends on any hit, vanishes against armour. */
export const MM_CHARGE_WEAK: ProjectileSpec = {
  ...SHOT,
  kind: 'mm-charge',
  amount: 200,
  w: 16,
  h: 10,
  frames: ['charge-shot-0', 'charge-shot-1'],
  frameRate: 4,
  onBlocked: 'remove',
};

/** The full Charge Shot (MM-C20): 300, on through what it defeats and the bricks it breaks. */
export const MM_CHARGE_FULL: ProjectileSpec = {
  ...MM_CHARGE_WEAK,
  kind: 'mm-charge-full',
  amount: 300,
  w: 24,
  h: 14,
  pierceDefeat: true,
  classicBlocks: PASS_ON,
};

/** Metal Blade (MM-C23): 150 in eight directions, on through kills and broken bricks. */
export const METAL_BLADE: ProjectileSpec = {
  ...WEAPON,
  kind: 'metal-blade',
  amount: 150,
  w: 14,
  h: 14,
  frames: ['saw-disc-0', 'saw-disc-1'],
  frameRate: 2,
  pierceDefeat: true,
  classicBlocks: PASS_ON,
};

/** Super Arm's thrown brick: 800, breaks into four 250 pieces on ground, enemies or armour. */
export const SUPER_ARM_BRICK: ProjectileSpec = {
  ...WEAPON,
  kind: 'super-arm',
  amount: 800,
  speed: 0x02555, // 280 px/s
  vy: -0x02aab, // 320 px/s
  gravity: 0x0038e, // 1600 px/s²
  arc: true,
  w: 16,
  h: 16,
  frames: ['brick-piece'],
  frameRate: 1,
  classicBlocks: COLLIDE_END,
  onBlocked: 'burst',
};

/** A Super Arm piece (BrickPiece.as): 250, flies off under gravity through everything. */
export const SUPER_ARM_PIECE: ProjectileSpec = {
  ...WEAPON,
  kind: 'arm-debris',
  amount: 250,
  gravity: 0x00300,
  w: 8,
  h: 8,
  frames: ['brick-piece'],
  frameRate: 1,
  classicBlocks: NO_TILES,
  onBlocked: 'burst',
};

/** Hard Knuckle: 800, pierces armour (level 10), accelerates out of a still start. */
export const HARD_KNUCKLE: ProjectileSpec = {
  ...WEAPON,
  kind: 'hard-knuckle',
  amount: 800,
  speed: 0,
  w: 12,
  h: 12,
  frames: ['knuckle'],
  frameRate: 1,
  classicHit: { ...MM_HIT, pierce: 10 },
};
/** Hard Knuckle's acceleration and top speed (0.0625 px/f², 2.9167 px/f) and steer (0.4167 px/f). */
export const KNUCKLE_ACCEL = 0x00100;
export const KNUCKLE_MAX = 0x02eab;
export const KNUCKLE_STEER = 0x006ab;
/** Its harmless appear animation (Open question 3's default). */
export const KNUCKLE_APPEAR = 8;

const pharaoh = (level: 0 | 1 | 2): ProjectileSpec => ({
  ...WEAPON,
  kind: 'pharaoh-shot',
  amount: [150, 200, 400][level] as number,
  w: [8, 12, 16][level] as number,
  h: [8, 12, 16][level] as number,
  frames: ['spell-fire-0', 'spell-fire-1'],
  frameRate: 3,
  ...(level === 2 ? { pierceDefeat: true, classicBlocks: PASS_ON } : {}),
});
/** Pharaoh shots by level: small 150 (the tap), medium 200, big 400 (on through kills). */
export const PHARAOH_SHOTS: readonly ProjectileSpec[] = [pharaoh(0), pharaoh(1), pharaoh(2)];
const balloon = (level: 0 | 1 | 2): ProjectileSpec => ({
  ...(PHARAOH_SHOTS[level] as ProjectileSpec),
  kind: 'pharaoh-balloon',
  speed: 0,
  pierce: true,
  pierceDefeat: false,
  classicBlocks: NO_TILES,
});
export const PHARAOH_BALLOONS: readonly ProjectileSpec[] = [balloon(0), balloon(1), balloon(2)];
/** The balloon shows 15 frames after the press; medium and big this long after that (Open q. 2). */
export const BALLOON_APPEAR = 15;
export const BALLOON_MEDIUM = 30;
export const BALLOON_BIG = 60;

/** Flame Blast's bullet: 350, falls (0.18056 px/f²), becomes a flame pillar on any surface. */
export const FLAME_BULLET: ProjectileSpec = {
  ...WEAPON,
  kind: 'flame-blast',
  amount: 350,
  gravity: 0x002e4,
  arc: true,
  w: 8,
  h: 8,
  frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
  frameRate: 2,
  classicBlocks: COLLIDE_END,
};
const pillar = (w: number, h: number): ProjectileSpec => ({
  ...WEAPON,
  kind: 'flame-pillar',
  amount: 350,
  speed: 0,
  lifetime: 30,
  w,
  h,
  frames: ['holy-fire-0', 'holy-fire-1'],
  frameRate: 3,
  classicBlocks: NO_TILES,
  onBlocked: 'remove',
});
/** The pillar standing out of a floor or ceiling, and out of a wall (MM-C25). */
export const FLAME_PILLAR = pillar(12, 24);
export const FLAME_PILLAR_WALL = pillar(24, 12);

/** Magma Bazooka: three 100 shots (two hits for a brick); charged three 300 on through kills. */
export const MAGMA_SHOT: ProjectileSpec = {
  ...WEAPON,
  kind: 'magma-bazooka',
  amount: 100,
  w: 8,
  h: 8,
  frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
  frameRate: 2,
};
export const MAGMA_CHARGED: ProjectileSpec = {
  ...MAGMA_SHOT,
  kind: 'magma-bazooka',
  amount: 300,
  w: 12,
  h: 12,
  pierceDefeat: true,
  classicBlocks: PASS_ON,
};
/** Magma's charged release costs this on top of the press's 2 (MM-C22). */
export const MAGMA_CHARGE_COST = 12;

/** A Water Shield drop: 275, ends on a hit, armour destroys it. */
export const WATER_DROP: ProjectileSpec = {
  ...WEAPON,
  kind: 'water-drop',
  amount: 275,
  speed: 0,
  w: 8,
  h: 8,
  frames: ['water-drop'],
  frameRate: 1,
  onBlocked: 'remove',
};
export const WATER_DROPS = 8;
/** Orbit radius (px), turn (rad/f) and the thrown drops' growth (px/f) (MM-C22, MM-C25). */
export const WATER_RADIUS = 22.5;
export const WATER_TURN = 0.0667;
export const WATER_OUT = 2.5;

/** Screw Crusher: 175, a lob up and forward that falls back (gravity 0.20833 px/f²). */
export const SCREW_CRUSHER: ProjectileSpec = {
  ...WEAPON,
  kind: 'screw-crusher',
  amount: 175,
  speed: 0x01400,
  vy: -0x04b00,
  gravity: 0x00355,
  w: 8,
  h: 8,
  frames: ['screw-0', 'screw-1'],
  frameRate: 3,
};

/** Kinds that are buster shots (never counted as a weapon's projectile; MM-C16). */
export const BUSTER_KINDS: ReadonlySet<string> = new Set(['mm-buster', 'mm-charge', 'mm-charge-full']);
/** Kinds the caps leave out (MM-C19): Water Shield drops, Pharaoh shots and balloons, debris. */
const CAP_EXEMPT = new Set(['water-drop', 'pharaoh-shot', 'pharaoh-balloon', 'arm-debris']);

/* ---------- shots ---------- */

/** A Classic Mega Man shot: a Projectile also gone once off the top or bottom of the screen. */
export class MMShot extends Projectile {
  override update(world: World): void {
    super.update(world);
    if (!this.alive) return;
    const b = this.body;
    if (b.y + b.h < world.camera.y - px(16) || b.y > world.camera.bottom + px(16)) this.destroy();
  }
}

/** Hard Knuckle (MM-C25): harmless while it appears, then accelerates; Up / Down steer it. */
export class KnuckleShot extends MMShot {
  override update(world: World): void {
    const owner = this.owner as Player;
    if (this.age < KNUCKLE_APPEAR) {
      // Harmless until it has appeared: `deflected` keeps World.projectile off enemies.
      this.deflected = true;
      this.age++;
      return;
    }
    this.deflected = false;
    const b = this.body;
    b.vx = this.facing * Math.min(KNUCKLE_MAX, Math.abs(b.vx) + KNUCKLE_ACCEL);
    const ud = owner.dead ? 0 : (owner.scratch._ud ?? 0);
    b.vy = ud * KNUCKLE_STEER;
    super.update(world);
  }
}

/** Flame Blast's bullet (MM-C25): on touching ground, a wall or a ceiling it becomes a pillar. */
export class FlameBullet extends MMShot {
  override update(world: World): void {
    super.update(world);
    const b = this.body;
    if (this.alive && b.hitHead) this.destroy();
    if (this.alive || !(b.onGround || b.hitWall !== 0 || b.hitHead)) return;
    const wall = b.hitWall !== 0 && !b.onGround;
    const spec = wall ? FLAME_PILLAR_WALL : FLAME_PILLAR;
    const cx = b.x + (b.w >> 1);
    let x = cx - px(spec.w >> 1);
    let y = b.onGround ? b.y + b.h - px(spec.h) : b.y;
    if (wall) {
      // Out of the wall, away from it.
      x = b.hitWall > 0 ? b.x + b.w - px(spec.w) : b.x;
      y = b.y + (b.h >> 1) - px(spec.h >> 1);
    }
    world.spawn(new MMShot(x, y, this.facing, spec, this.owner, { vx: 0, vy: 0 }));
  }
}

/** Super Arm's thrown brick: breaks into four pieces however it ends (ground, enemy, armour). */
export class ArmBrick extends MMShot {
  override burst(world: World): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const cy = b.y + (b.h >> 1);
    for (const [vx, vy] of [
      [-0x01000, -0x03000],
      [0x01000, -0x03000],
      [-0x00c00, -0x01800],
      [0x00c00, -0x01800],
    ] as const)
      world.spawn(
        new MMShot(cx - px(4), cy - px(4), vx < 0 ? -1 : 1, SUPER_ARM_PIECE, this.owner, { vx, vy }),
      );
    world.audio.sfx('break');
    this.destroy();
  }

  override render(r: Renderer, view: View): void {
    drawBrick(r, view, this.body.x, this.body.y);
  }
}

function drawBrick(r: Renderer, view: View, x: number, y: number): void {
  const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
  const f = sheet.frames.has(`brick@${view.theme}`) ? `brick@${view.theme}` : 'brick';
  r.sprite(sheet, f, toPx(x) - view.camX, toPx(y));
}

/** The brick Super Arm carries over his head (MM-C25): drawn only, until thrown. */
export class CarriedBrick extends Entity {
  readonly kind = 'carried-brick';
  constructor(readonly owner: Player) {
    super(owner.body.x, owner.body.y - px(16), 16, 16);
    this.despawnMargin = null;
    this.layer = 'front';
  }
  update(): void {
    const ob = this.owner.body;
    if (this.owner.dead) return this.destroy();
    this.body.x = ob.x + (ob.w >> 1) - px(8);
    this.body.y = ob.y - px(16);
  }
  render(r: Renderer, view: View): void {
    drawBrick(r, view, this.body.x, this.body.y);
  }
}

/** Pharaoh Shot's balloon (MM-C25): follows above his head, grows while held, hurts what it touches. */
export class PharaohBalloon extends MMShot {
  level: 0 | 1 | 2 = 0;
  override update(_world: World): void {
    const owner = this.owner as Player;
    if (owner.dead) return this.destroy();
    this.age++;
    const shown = this.age > BALLOON_APPEAR;
    this.deflected = !shown;
    const grown = this.age - BALLOON_APPEAR;
    const level = grown >= BALLOON_BIG ? 2 : grown >= BALLOON_MEDIUM ? 1 : 0;
    if (level !== this.level) {
      this.level = level;
      // A bigger balloon hits harder: its spec is swapped for the level's (World reads it per hit).
      const spec = PHARAOH_BALLOONS[level] as ProjectileSpec;
      (this as { spec: ProjectileSpec }).spec = spec;
      const b = this.body;
      const cx = b.x + (b.w >> 1);
      const bottom = b.y + b.h;
      b.w = px(spec.w);
      b.h = px(spec.h);
      b.x = cx - (b.w >> 1);
      b.y = bottom - b.h;
    }
    // Follows 15 px above his head at 0.625 px/f, never more than 10 px behind.
    const ob = owner.body;
    const b = this.body;
    const tx = ob.x + (ob.w >> 1) - (b.w >> 1);
    const ty = ob.y - px(15) - b.h;
    b.x = follow(b.x, tx);
    b.y = follow(b.y, ty);
  }

  override render(r: Renderer, view: View): void {
    if (this.age > BALLOON_APPEAR) super.render(r, view);
  }
}

function follow(at: number, to: number): number {
  const step = velToSub(0x00a00); // 0.625 px/f
  const lag = px(10);
  let v = at + Math.max(-step, Math.min(step, to - at));
  if (v < to - lag) v = to - lag;
  if (v > to + lag) v = to + lag;
  return v;
}

/** One Water Shield drop (MM-C25): orbits his centre, live once it first passes the start angle. */
export class WaterDrop extends MMShot {
  private turned = 0;
  private radius = WATER_RADIUS;
  /** Thrown outward: the centre it left (subpixels), no longer following him. */
  thrownFrom: { x: number; y: number } | null = null;
  constructor(
    owner: Player,
    private orbitAngle: number,
    /** Radians it must turn before it is live (0 for the first drop). */
    private readonly liveAfter: number,
  ) {
    super(owner.body.x, owner.body.y, 1, WATER_DROP, owner, { vx: 0, vy: 0 });
    this.place();
  }

  get live(): boolean {
    return this.turned >= this.liveAfter - 1e-9;
  }

  override update(world: World): void {
    const owner = this.owner as Player;
    this.age++;
    if (this.thrownFrom) {
      this.radius += WATER_OUT;
    } else {
      if (owner.dead) return this.destroy();
      this.orbitAngle += WATER_TURN;
      this.turned += WATER_TURN;
    }
    this.deflected = !this.live;
    this.place();
    if (this.live && world.shotBlocks(this)) return this.burst(world);
    const b = this.body;
    if (
      this.thrownFrom &&
      (b.x + b.w < world.camera.x - px(16) ||
        b.x > world.camera.right + px(16) ||
        b.y + b.h < world.camera.y - px(16) ||
        b.y > world.camera.bottom + px(16))
    )
      this.destroy();
  }

  /** Sends the drop outward from where he is now (MM-C25). */
  launch(): void {
    const ob = (this.owner as Player).body;
    this.thrownFrom = { x: ob.x + (ob.w >> 1), y: ob.y + (ob.h >> 1) };
  }

  private place(): void {
    const ob = (this.owner as Player).body;
    const c = this.thrownFrom ?? { x: ob.x + (ob.w >> 1), y: ob.y + (ob.h >> 1) };
    const b = this.body;
    b.x = c.x + Math.round(Math.cos(this.orbitAngle) * px(this.radius)) - (b.w >> 1);
    b.y = c.y + Math.round(Math.sin(this.orbitAngle) * px(this.radius)) - (b.h >> 1);
  }

  override render(r: Renderer, view: View): void {
    if (this.live) super.render(r, view);
  }
}

/* ---------- firing ---------- */

/** What firing needs from the hero (Classic Mega Man's def, or a variant's). */
export interface MMFire {
  p: Player;
  world: World;
  input: InputFrame;
  /** Units of the weapon now (WEAPON_UNITS when full). */
  energy(id: MMWeaponId): number;
  /** Spends `cost` units (always true, free, under Star: PS-C18). */
  spend(id: MMWeaponId, cost: number): boolean;
  /** Whether `cost` units are there (or Star). */
  has(id: MMWeaponId, cost: number): boolean;
  /** Where buster-placed shots leave (busterSpawn). Absent: Mega Man's MM_SHOT_PAD. */
  pad?: ShotPad;
}

/** His projectiles on screen, all kinds or only `filter`'s. */
export function countShots(world: World, p: Player, filter: (kind: string) => boolean = () => true): number {
  let n = 0;
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.owner === p && filter(e.kind)) n++;
  return n;
}
/** The 3-shot cap's count (MM-C19): every projectile but the exempt ones. */
export const capCount = (world: World, p: Player): number => countShots(world, p, (k) => !CAP_EXEMPT.has(k));
/** "1 non-buster" (MM-C22): his projectiles that are not buster or charge shots, nor debris. */
const nonBuster = (world: World, p: Player): number =>
  countShots(world, p, (k) => !BUSTER_KINDS.has(k) && k !== 'arm-debris');

/** The d-pad's up/down now: -1 up, 1 down, 0 neither. */
function upDown(input: InputFrame): -1 | 0 | 1 {
  return input.held('up') ? -1 : input.held('down') ? 1 : 0;
}

/**
 * The height above the feet (px, halves allowed) a buster-placed shot leaves from: on the ground
 * and in the air. Mega Man 13 / 17 (MM-C19); Proto Man and Break Man 9.5 / 15.5 (PM-13).
 */
export interface ShotPad {
  ground: number;
  air: number;
}
export const MM_SHOT_PAD: ShotPad = { ground: 13, air: 17 };

/**
 * Spawn point like the buster's (MM-C19): 19 px ahead of his centre, `pad` above his feet (13, or
 * 17 airborne, for Mega Man).
 */
export function busterSpawn(
  p: Player,
  spec: ProjectileSpec,
  pad: ShotPad = MM_SHOT_PAD,
): { x: number; y: number } {
  const b = p.body;
  const cx = b.x + (b.w >> 1);
  const muzzleY = b.y + b.h - px(b.onGround ? pad.ground : pad.air);
  return { x: cx + p.facing * px(19) - px(spec.w >> 1), y: muzzleY - px(spec.h >> 1) };
}

function shoot(f: MMFire, spec: ProjectileSpec, opts: ProjectileOptions = {}, at?: { x: number; y: number }) {
  const pos = at ?? busterSpawn(f.p, spec, f.pad);
  const s = new MMShot(pos.x, pos.y, f.p.facing, spec, f.p, opts);
  f.world.spawn(s);
  return s;
}

/** Eight-way aim (MM-C23): Up / Down straight, with left or right a diagonal, else ahead. */
function aim8(f: MMFire): ProjectileOptions {
  const ud = upDown(f.input);
  const dx = f.input.dirX;
  if (ud !== 0 && dx !== 0) return { vx: dx * MM_DIAGONAL, vy: ud * MM_DIAGONAL };
  if (ud !== 0) return { vx: 0, vy: ud * MM_SHOT_SPEED };
  return { vx: f.p.facing * MM_SHOT_SPEED, vy: 0 };
}

/** Forward, or a diagonal forward with Up or Down held (Pharaoh Shot). */
function aimForward(f: MMFire): ProjectileOptions {
  const ud = upDown(f.input);
  if (ud !== 0) return { vx: f.p.facing * MM_DIAGONAL, vy: ud * MM_DIAGONAL };
  return { vx: f.p.facing * MM_SHOT_SPEED, vy: 0 };
}

function centre(p: Player, spec: ProjectileSpec): { x: number; y: number } {
  const b = p.body;
  return { x: b.x + (b.w >> 1) - px(spec.w >> 1), y: b.y + (b.h >> 1) - px(spec.h >> 1) };
}

/** An empty brick touching his body on any side (Super Arm's lift, MM-C25), or null. */
export function touchingBrick(p: Player, world: World): { tx: number; ty: number } | null {
  const b = p.body;
  for (let ty = tileAt(b.y - 1); ty <= tileAt(b.y + b.h); ty++)
    for (let tx = tileAt(b.x - 1); tx <= tileAt(b.x + b.w); tx++) {
      const block = tileDef(world.map.get(tx, ty)).block;
      if (block?.kind === 'brick' && block.content === 'none') return { tx, ty };
    }
  return null;
}

/** Lifts the brick at (tx, ty) out of the map onto his head (MM-C25). */
export function liftBrick(p: Player, world: World, at: { tx: number; ty: number }): CarriedBrick {
  world.map.set(at.tx, at.ty, T.AIR);
  world.brickHp.delete(`${at.tx},${at.ty}`);
  const c = new CarriedBrick(p);
  world.spawn(c);
  world.audio.sfx('kick');
  return c;
}

/** The brick he carries, if any. */
export function carriedBrick(p: Player, world: World): CarriedBrick | null {
  for (const e of world.entities) if (e instanceof CarriedBrick && e.alive && e.owner === p) return e;
  return null;
}

/** Throws the carried brick (cost 8 on the throw, MM-C22). */
export function throwBrick(f: MMFire, c: CarriedBrick): boolean {
  if (!f.spend('super-arm', mmWeapon('super-arm').cost)) return false;
  c.destroy();
  const s = new ArmBrick(c.body.x, c.body.y, f.p.facing, SUPER_ARM_BRICK, f.p);
  f.world.spawn(s);
  f.world.audio.sfx('kick');
  return true;
}

/** The live balloon, if any. */
export function balloonOf(p: Player, world: World): PharaohBalloon | null {
  for (const e of world.entities) if (e instanceof PharaohBalloon && e.alive && e.owner === p) return e;
  return null;
}

/** Releases the balloon (MM-C25): medium or big fires a shot of that level (+8), else it vanishes. */
export function releaseBalloon(f: MMFire, bl: PharaohBalloon): void {
  bl.destroy();
  if (bl.level < 1 || !f.spend('pharaoh-shot', 8)) return;
  const spec = PHARAOH_SHOTS[bl.level] as ProjectileSpec;
  shoot(f, spec, aimForward(f));
  f.world.audio.sfx('charge-shot');
}

function drops(p: Player, world: World): WaterDrop[] {
  return world.entities.filter((e): e is WaterDrop => e instanceof WaterDrop && e.alive && e.owner === p);
}

/**
 * Fires weapon `id` on a press of its button (MM-C22..MM-C25). True when something fired (the
 * caller then roots him for a thrown weapon and shows the shoot pose). Super Arm, Charge Kick,
 * the Pharaoh balloon's release and Magma's charge are handled by the caller's hold logic.
 */
export function fireWeapon(f: MMFire, id: MMWeaponId): boolean {
  const { p, world } = f;
  const cost = mmWeapon(id).cost;
  switch (id) {
    case 'metal-blade': {
      if (capCount(world, p) >= 3 || !f.spend(id, cost)) return false;
      shoot(f, METAL_BLADE, aim8(f), centre(p, METAL_BLADE));
      world.audio.sfx('buster');
      return true;
    }
    case 'hard-knuckle': {
      if (nonBuster(world, p) >= 1 || !f.spend(id, cost)) return false;
      const pos = busterSpawn(p, HARD_KNUCKLE, f.pad);
      world.spawn(new KnuckleShot(pos.x, pos.y, p.facing, HARD_KNUCKLE, p, { vx: 0, vy: 0 }));
      // In the air he hangs still until it has appeared.
      if (!p.body.onGround) {
        p.root = KNUCKLE_APPEAR;
        p.rootFreeze = true;
      }
      world.audio.sfx('kick');
      return true;
    }
    case 'pharaoh-shot': {
      if (countShots(world, p, (k) => k !== 'pharaoh-balloon' && k !== 'arm-debris') >= 1) return false;
      if (!f.spend(id, cost)) return false;
      shoot(f, PHARAOH_SHOTS[0] as ProjectileSpec, aimForward(f));
      world.audio.sfx('buster');
      // With 4 units left the press also starts a balloon over his head.
      if (f.has(id, cost) && !balloonOf(p, world)) {
        const s = PHARAOH_BALLOONS[0] as ProjectileSpec;
        const b = p.body;
        world.spawn(
          new PharaohBalloon(b.x + (b.w >> 1) - px(s.w >> 1), b.y - px(15) - px(s.h), p.facing, s, p, {
            vx: 0,
            vy: 0,
          }),
        );
      }
      return true;
    }
    case 'flame-blast': {
      if (capCount(world, p) >= 3 || !f.spend(id, cost)) return false;
      const pos = busterSpawn(p, FLAME_BULLET, f.pad);
      world.spawn(new FlameBullet(pos.x, pos.y, p.facing, FLAME_BULLET, p));
      world.audio.sfx('fireball');
      return true;
    }
    case 'magma-bazooka': {
      if (nonBuster(world, p) >= 1 || !f.spend(id, cost)) return false;
      magmaVolley(f, MAGMA_SHOT);
      return true;
    }
    case 'water-shield': {
      const out = drops(p, world);
      if (out.length > 0) {
        // Once all eight are live a press sends them outward (no energy needed).
        if (out.length === WATER_DROPS && out.every((d) => d.live && !d.thrownFrom)) {
          for (const d of out) d.launch();
          world.audio.sfx('buster');
        }
        return false;
      }
      if (!f.spend(id, cost)) return false;
      const a0 = p.facing > 0 ? 0 : Math.PI;
      for (let i = 0; i < WATER_DROPS; i++) {
        const back = (i * 2 * Math.PI) / WATER_DROPS;
        world.spawn(new WaterDrop(p, a0 - back, back));
      }
      world.audio.sfx('swim');
      return true;
    }
    case 'screw-crusher': {
      if (capCount(world, p) >= 4 || !f.spend(id, cost)) return false;
      const b = p.body;
      const cx = b.x + (b.w >> 1);
      shoot(
        f,
        SCREW_CRUSHER,
        {},
        {
          x: cx + p.facing * px(24) - px(SCREW_CRUSHER.w >> 1),
          y: b.y + (b.h >> 1) - px(SCREW_CRUSHER.h >> 1),
        },
      );
      world.audio.sfx('buster');
      return true;
    }
    case 'super-arm':
    case 'charge-kick':
      return false;
  }
}

/** Magma Bazooka's three shots: forward, and up-forward and down-forward diagonals. */
export function magmaVolley(f: MMFire, spec: ProjectileSpec): void {
  const v = f.p.facing;
  shoot(f, spec, { vx: v * MM_SHOT_SPEED, vy: 0 });
  shoot(f, spec, { vx: v * MM_DIAGONAL, vy: -MM_DIAGONAL });
  shoot(f, spec, { vx: v * MM_DIAGONAL, vy: MM_DIAGONAL });
  f.world.audio.sfx(spec === MAGMA_CHARGED ? 'charge-shot' : 'fireball');
}

/** The Flower weapon's projectiles vanish on a hit (MM-C16): all his but buster shots. */
export function clearWeaponShots(p: Player, world: World): void {
  for (const e of world.entities) {
    if (!e.alive) continue;
    if (e instanceof CarriedBrick && e.owner === p) e.destroy();
    else if (e instanceof Projectile && e.owner === p && !BUSTER_KINDS.has(e.kind)) e.destroy();
  }
}

/** True while `b` overlaps any of `p`'s live projectiles of `kind` (tests, guards). */
export function touchesShot(
  world: World,
  p: Player,
  kind: string,
  b: { x: number; y: number; w: number; h: number },
) {
  return world.entities.some(
    (e) => e instanceof Projectile && e.alive && e.owner === p && e.kind === kind && overlaps(e.body, b),
  );
}

/** The tile x of a slide's front, for Charge Kick's brick strikes. */
export function frontTile(p: Player): { tx: number; ty: number } {
  const b = p.body;
  const x = p.facing > 0 ? b.x + b.w : b.x - 1;
  return { tx: tileAt(x), ty: tileAt(b.y + (b.h >> 1)) };
}
