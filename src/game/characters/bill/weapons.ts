import type { ProjectileSpec } from '../../entities/projectiles/projectile';

export interface Gun {
  id: string;
  name: string;
  icon: string;
  /** Hold the button to keep firing every `auto` frames (0 = tap to fire). */
  auto: number;
  /** Shots allowed on screen. */
  maxOut: number;
  /** Shots fired per trigger, fanned by `fanDeg` each. */
  fan: number;
  fanDeg: number;
  spec: ProjectileSpec;
}

const base: Omit<ProjectileSpec, 'kind' | 'frames' | 'speed'> = {
  damage: 'buster',
  amount: 1,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 6,
  h: 6,
  sheet: 'items',
  frameRate: 2,
};

export const RIFLE_SHOT: ProjectileSpec = {
  ...base,
  kind: 'rifle',
  speed: 0x05000,
  frames: ['rifle-shot'],
  frameRate: 1,
};
export const MG_SHOT: ProjectileSpec = {
  ...base,
  kind: 'mg',
  speed: 0x06000,
  frames: ['mg-shot'],
  frameRate: 1,
};
export const SPREAD_SHOT: ProjectileSpec = {
  ...base,
  kind: 'spread',
  speed: 0x04000,
  w: 8,
  h: 8,
  frames: ['spread-shot-0', 'spread-shot-1'],
};
export const LASER_BEAM: ProjectileSpec = {
  ...base,
  kind: 'laser',
  damage: 'weapon',
  amount: 2,
  speed: 0x08000,
  pierce: true,
  hitsTiles: false,
  w: 24,
  h: 6,
  frames: ['laser-beam'],
  frameRate: 1,
};
export const FLAME_SHOT: ProjectileSpec = {
  ...base,
  kind: 'flame-gun',
  damage: 'weapon',
  amount: 2,
  speed: 0x02800,
  w: 12,
  h: 12,
  frames: ['flame-shot-0', 'flame-shot-1'],
  frameRate: 3,
};

/** Guns in unlock order; the rifle is always there. */
export const GUNS: readonly Gun[] = [
  { id: 'rifle', name: 'Rifle', icon: 'icon-rifle', auto: 0, maxOut: 4, fan: 1, fanDeg: 0, spec: RIFLE_SHOT },
  { id: 'mg', name: 'Machine Gun', icon: 'icon-mg', auto: 6, maxOut: 6, fan: 1, fanDeg: 0, spec: MG_SHOT },
  {
    id: 'spread',
    name: 'Spread Gun',
    icon: 'icon-spread',
    auto: 0,
    maxOut: 10,
    fan: 5,
    fanDeg: 15,
    spec: SPREAD_SHOT,
  },
  { id: 'laser', name: 'Laser', icon: 'icon-laser', auto: 0, maxOut: 1, fan: 1, fanDeg: 0, spec: LASER_BEAM },
  {
    id: 'flame-gun',
    name: 'Flame Thrower',
    icon: 'icon-flame-gun',
    auto: 0,
    maxOut: 2,
    fan: 1,
    fanDeg: 0,
    spec: FLAME_SHOT,
  },
];
