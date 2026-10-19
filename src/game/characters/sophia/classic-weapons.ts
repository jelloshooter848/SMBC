import type { ProjectileSpec } from '../../entities/projectiles/projectile';
import { CANNON, HOMING, TRIPLE } from './weapons';

/*
 * Sophia III's Classic SMBC weapons (bug-reports/2026-10-07-sophia-build-classic-character.md,
 * SO-28 to SO-31): the Current shot classes with specs in the original's damage units
 * (DamageValue.as 81-84) for the Classic enemy-HP rules (HP-C5, HP-C12) and the Classic brick
 * rules (BR-C2, BR-C7 to BR-C9: a brick has 125 HP). Every hit flashes the enemy for 400 ms
 * (Sophia.as:362, HP-C16).
 */

/** The cannon's damage by level: Normal 100, Hyper 200, Crusher 300 (SO-28). */
export const CANNON_DAMAGE = [100, 200, 300] as const;
/** Both missiles: 400 each (SO-30, SO-31). */
export const MISSILE_DAMAGE = 400;
/** The Triple Missile's armour pierce (10: through armour, not through fire). */
export const TRIPLE_PIERCE = 10;
const FLASH = 24;

/** The cannon (SO-28, SO-29): stops at solid ground, ends at the first block it strikes. */
export const CANNON_CLASSIC: readonly ProjectileSpec[] = CANNON.map((s, lvl) => ({
  ...s,
  amount: CANNON_DAMAGE[lvl] as number,
  classicHit: { pierce: 0, flashFrames: FLASH },
  onBlocked: 'burst',
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
}));

/**
 * The Triple Missile (SO-30): passes ground, pipes and lifts, strikes bricks and item blocks and
 * ends there; pierce 10 hurts Buzzy Beetles and Bullet Bills. A `fireball` kind so fire (no
 * Classic HP: Podoboos, fire bars) stays immune.
 */
export const TRIPLE_CLASSIC: ProjectileSpec = {
  ...TRIPLE,
  damage: 'fireball',
  amount: MISSILE_DAMAGE,
  classicHit: { pierce: TRIPLE_PIERCE, flashFrames: FLASH },
  onBlocked: 'burst',
  classicBlocks: { ground: 'pass', afterBlock: 'end', strikesBlocks: true },
};

/** The Homing Missile (SO-31): no terrain at all; armour blocks it (it explodes, no damage). */
export const HOMING_CLASSIC: ProjectileSpec = {
  ...HOMING,
  amount: MISSILE_DAMAGE,
  classicHit: { pierce: 0, flashFrames: FLASH },
  onBlocked: 'burst',
  classicBlocks: { ground: 'none', afterBlock: 'continue', strikesBlocks: false },
};
