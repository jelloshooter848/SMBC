import type { ProjectileSpec } from '../../entities/projectiles/projectile';

/** A sub-weapon on the belt. `cost` is in hearts. */
export interface SubWeapon {
  id: string;
  /** Its campaign item id (src/game/items/catalog.ts). */
  item: string;
  name: string;
  icon: string;
  cost: number;
  /** Projectile fired, or null for an instant effect (stopwatch). */
  spec: ProjectileSpec | null;
}

const base: Omit<ProjectileSpec, 'kind' | 'frames' | 'speed'> = {
  damage: 'weapon',
  amount: 1,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 16,
  h: 8,
  sheet: 'items',
  frameRate: 3,
};

/** Fast and straight. */
export const DAGGER: ProjectileSpec = {
  ...base,
  kind: 'dagger',
  speed: 0x05000,
  frames: ['dagger'],
  frameRate: 1,
};

/** Lobbed high in an arc, ignoring walls and floors. */
export const HAND_AXE: ProjectileSpec = {
  ...base,
  kind: 'hand-axe',
  speed: 0x01800,
  vy: -0x05800,
  gravity: 0x00280,
  hitsTiles: false,
  pierce: true,
  lifetime: 150,
  w: 16,
  h: 16,
  frames: ['hand-axe-0', 'hand-axe-1', 'hand-axe-2', 'hand-axe-3'],
};

/** Flame left where the flask shatters. */
export const HOLY_FIRE: ProjectileSpec = {
  ...base,
  kind: 'holy-water',
  speed: 0,
  hitsTiles: false,
  pierce: true,
  lifetime: 60,
  w: 16,
  h: 12,
  frames: ['holy-fire-0', 'holy-fire-1'],
  frameRate: 4,
};

/** Tossed in a short arc; bursts into flame on landing. */
export const HOLY_WATER: ProjectileSpec = {
  ...base,
  kind: 'holy-water',
  speed: 0x01800,
  vy: -0x02000,
  gravity: 0x00400,
  arc: true,
  w: 8,
  h: 8,
  frames: ['holy-water'],
  frameRate: 1,
  spawnOnLand: HOLY_FIRE,
};

/** Spins out and comes back. */
export const CROSS: ProjectileSpec = {
  ...base,
  kind: 'cross',
  speed: 0x03000,
  amount: 2,
  hitsTiles: false,
  pierce: true,
  returns: { after: 30 },
  lifetime: 300,
  w: 16,
  h: 16,
  frames: ['cross-0', 'cross-1', 'cross-2', 'cross-3'],
};

export const SUB_WEAPONS: readonly SubWeapon[] = [
  { id: 'dagger', item: 'dagger', name: 'Dagger', icon: 'icon-dagger', cost: 1, spec: DAGGER },
  { id: 'hand-axe', item: 'axe', name: 'Axe', icon: 'icon-axe', cost: 1, spec: HAND_AXE },
  {
    id: 'holy-water',
    item: 'holy-water',
    name: 'Holy Water',
    icon: 'icon-holy-water',
    cost: 1,
    spec: HOLY_WATER,
  },
  { id: 'cross', item: 'cross', name: 'Cross', icon: 'icon-cross', cost: 1, spec: CROSS },
  { id: 'stopwatch', item: 'stopwatch', name: 'Stopwatch', icon: 'icon-watch', cost: 5, spec: null },
];

/** Whip reach in px per upgrade level (leather, chain, morning star). */
export const WHIP_REACH = [16, 24, 32] as const;
export const WHIP_FRAMES = ['whip-leather', 'whip-chain', 'whip-star'] as const;
