import type { ProjectileSpec } from '../../entities/projectiles/projectile';

const base: Omit<ProjectileSpec, 'kind' | 'frames'> = {
  damage: 'buster',
  amount: 1,
  speed: 0x04000,
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

/** Short-range starting shot: fizzles after about five tiles. */
export const POWER_BEAM: ProjectileSpec = {
  ...base,
  kind: 'beam',
  lifetime: 20,
  frames: ['beam-0', 'beam-1'],
  burstFrame: 'beam-1',
};

/** Same shot, full range. */
export const LONG_BEAM: ProjectileSpec = { ...POWER_BEAM, lifetime: null };

/** Freezes what it hits; a second shot shatters a frozen enemy. */
export const ICE_BEAM: ProjectileSpec = {
  ...base,
  kind: 'beam',
  damage: 'ice',
  frames: ['ice-beam-0', 'ice-beam-1'],
  burstFrame: 'ice-beam-1',
};

/** Snakes through walls and enemies. */
export const WAVE_BEAM: ProjectileSpec = {
  ...base,
  kind: 'beam',
  hitsTiles: false,
  piercesTiles: true,
  pierce: true,
  wave: { amplitude: 8, period: 24 },
  frames: ['wave-beam-0', 'wave-beam-1'],
};

/** Beam specs in upgrade order (scratch.beam indexes this). */
export const BEAMS: readonly ProjectileSpec[] = [POWER_BEAM, LONG_BEAM, ICE_BEAM, WAVE_BEAM];
export const BEAM_NAMES = ['Power Beam', 'Long Beam', 'Ice Beam', 'Wave Beam'] as const;

/** Limited ammo, heavy hit, opens bricks. */
export const MISSILE: ProjectileSpec = {
  ...base,
  kind: 'missile',
  damage: 'weapon',
  amount: 3,
  breaksBricks: true,
  w: 16,
  h: 8,
  frames: ['missile'],
  frameRate: 1,
  burstFrame: 'explosion-0',
};
