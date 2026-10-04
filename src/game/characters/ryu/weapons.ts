import type { ProjectileSpec } from '../../entities/projectiles/projectile';

/** A ninpo art on the belt. `cost` is ninpo points; `spec` is null for non-projectile arts. */
export interface NinpoArt {
  id: string;
  name: string;
  icon: string;
  cost: number;
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
  w: 8,
  h: 8,
  sheet: 'items',
  frameRate: 2,
};

/** Plain shuriken, straight and fast. */
export const THROWING_STAR: ProjectileSpec = {
  ...base,
  kind: 'throwing-star',
  speed: 0x04000,
  frames: ['throwing-star-0', 'throwing-star-1'],
};

/** Big spinning blade that comes back through everything. */
export const WINDMILL: ProjectileSpec = {
  ...base,
  kind: 'windmill',
  speed: 0x03000,
  amount: 2,
  hitsTiles: false,
  pierce: true,
  returns: { after: 40 },
  lifetime: 300,
  w: 16,
  h: 16,
  frames: ['windmill-0', 'windmill-1', 'windmill-2', 'windmill-3'],
};

/** One of three flames circling the ninja. */
export const FIRE_WHEEL: ProjectileSpec = {
  ...base,
  kind: 'fire-wheel',
  speed: 0x03000,
  hitsTiles: false,
  pierce: true,
  orbit: { radius: 22, step: 8 },
  blocks: true,
  lifetime: 240,
  w: 12,
  h: 12,
  frames: ['fire-wheel-0', 'fire-wheel-1'],
  frameRate: 4,
};

export const NINPO_ARTS: readonly NinpoArt[] = [
  { id: 'throwing-star', name: 'Throwing Star', icon: 'icon-star', cost: 3, spec: THROWING_STAR },
  { id: 'windmill', name: 'Windmill Shuriken', icon: 'icon-windmill', cost: 5, spec: WINDMILL },
  { id: 'fire-wheel', name: 'Fire Wheel', icon: 'icon-fire-wheel', cost: 5, spec: FIRE_WHEEL },
  { id: 'slash', name: 'Jump and Slash', icon: 'icon-slash', cost: 5, spec: null },
];
