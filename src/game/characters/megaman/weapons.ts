import type { ProjectileSpec } from '../../entities/projectiles/projectile';

/** One entry of the arm-cannon arsenal, unlocked in this order by fire flowers. */
export interface WeaponDef {
  id: string;
  /** Its campaign item id (src/game/items/catalog.ts). */
  item: string;
  name: string;
  icon: string;
  /** Energy spent per shot (each weapon holds 28). */
  cost: number;
  /** Sprite palette while selected. */
  palette: string;
  /** HUD bar colour. */
  colour: string;
  spec: ProjectileSpec;
}

export const WEAPON_ENERGY = 28;

const base: Omit<ProjectileSpec, 'kind' | 'speed' | 'w' | 'h' | 'frames' | 'frameRate'> = {
  damage: 'weapon',
  amount: 1,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  sheet: 'items',
};

/** Spinning blade: aimed in eight directions, cuts through bricks. */
export const SAW_DISC: ProjectileSpec = {
  ...base,
  kind: 'saw',
  speed: 0x03000,
  hitsTiles: true,
  piercesTiles: true,
  breaksBricks: true,
  pierce: true,
  lifetime: 90,
  w: 14,
  h: 14,
  frames: ['saw-disc-0', 'saw-disc-1'],
  frameRate: 2,
};

/** Circles the player, swatting enemy shots, until thrown. */
export const LEAF_GUARD: ProjectileSpec = {
  ...base,
  kind: 'leaf',
  speed: 0x03000,
  orbit: { radius: 20, step: 12 },
  blocks: true,
  pierce: true,
  lifetime: 240,
  w: 12,
  h: 12,
  frames: ['leaf'],
  frameRate: 1,
};

/** Fire that runs along the ground and drops off ledges. */
export const FLAME_WAVE: ProjectileSpec = {
  ...base,
  kind: 'flame',
  speed: 0x02000,
  hitsTiles: true,
  gravity: 0x00400,
  pierce: true,
  lifetime: 60,
  w: 14,
  h: 12,
  frames: ['flame-wave-0', 'flame-wave-1'],
  frameRate: 3,
};

/** Slow fist that turns toward the nearest enemy. */
export const HOMING_KNUCKLE: ProjectileSpec = {
  ...base,
  kind: 'knuckle',
  speed: 0x01800,
  amount: 3,
  homing: { turn: 0x00200, maxSpeed: 0x02000 },
  lifetime: 180,
  w: 12,
  h: 12,
  frames: ['knuckle'],
  frameRate: 1,
};

/** Near-instant horizontal beam across the screen. */
export const BOLT: ProjectileSpec = {
  ...base,
  kind: 'bolt',
  speed: 0x0c000, // 12 px/f, under the 16 px collision limit
  amount: 2,
  pierce: true,
  lifetime: 40,
  w: 24,
  h: 8,
  frames: ['bolt-0', 'bolt-1'],
  frameRate: 2,
};

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'saw',
    item: 'saw-disc',
    name: 'Saw Disc',
    icon: 'icon-saw',
    cost: 2,
    palette: 'megaman-saw',
    colour: '#bcbcbc',
    spec: SAW_DISC,
  },
  {
    id: 'leaf',
    item: 'leaf-guard',
    name: 'Leaf Guard',
    icon: 'icon-leaf',
    cost: 4,
    palette: 'megaman-leaf',
    colour: '#58d854',
    spec: LEAF_GUARD,
  },
  {
    id: 'flame',
    item: 'flame-wave',
    name: 'Flame Wave',
    icon: 'icon-flame',
    cost: 3,
    palette: 'megaman-flame',
    colour: '#f87858',
    spec: FLAME_WAVE,
  },
  {
    id: 'knuckle',
    item: 'homing-knuckle',
    name: 'Homing Knuckle',
    icon: 'icon-knuckle',
    cost: 4,
    palette: 'megaman-knuckle',
    colour: '#f878f8',
    spec: HOMING_KNUCKLE,
  },
  {
    id: 'bolt',
    item: 'bolt',
    name: 'Bolt',
    icon: 'icon-bolt',
    cost: 5,
    palette: 'megaman-bolt',
    colour: '#f8d878',
    spec: BOLT,
  },
];

/** Rush Coil is on the belt too; it spends its own energy. */
export const RUSH = { id: 'rush', icon: 'icon-rush', cost: 3, palette: 'megaman-rush', colour: '#f83800' };
