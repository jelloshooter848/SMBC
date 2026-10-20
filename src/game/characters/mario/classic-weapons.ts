import { FIREBALL, type ProjectileSpec } from '../../entities/projectiles/projectile';

/**
 * Classic SMBC's fireball (MarioFireBall.as; ML-C19, ML-C20), shared by Mario and Luigi. Flash
 * px/s ÷ 120 = px/f, px/s² ÷ 7200 = px/f²: X_SPEED 475, thrown already falling at VY_MAX_PSV 300,
 * GRAVITY 1350, BOUNCE_AMT 270. On flat ground it bounces 12.4 px high every 23 frames. Wall and
 * ceiling hits burst it. `amount` is the original's DamageValue.MARIO_FIRE_BALL (1000): the
 * Classic enemy-HP rules read it in original units (Bowser takes 5 in every form, armour stops it).
 * It never strikes bricks or ? blocks (doesntHitBricks): `classicBlocks` makes every block plain
 * ground to it (BR-C2).
 */
export const FIREBALL_CLASSIC: ProjectileSpec = {
  ...FIREBALL,
  amount: 1000,
  speed: 0x03f55, // 3.9583 px/f
  vy: 0x02800, // +2.5 px/f: thrown falling at its cap
  gravity: 0x00300, // 0.1875 px/f²
  maxFall: 0x02800, // 2.5 px/f
  bounceVy: -0x02400, // 2.25 px/f up off the top of the ground
  burstOnCeiling: true,
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: false },
  // The original's ball fills its 8 x 8 (MarioFireBallMc `start`, 4 spin frames) and bursts up
  // to 16 x 16 (`blowUp-3`), in red d82800 / orange fc9838 / white (F2: our own pixels).
  sheet: 'smbc-shots',
  frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
  burstFrame: 'fireball-burst',
};

/** Throw pose length (MarioBase: 75 ms; Current 8 frames). Cosmetic. */
export const CLASSIC_THROW_FRAMES = 5;
/** The fireball's centre: px ahead of the hero's centre (X_OFFSET 10 Flash px). */
export const CLASSIC_FIREBALL_AHEAD = 5;
/** The fireball's centre: px above the feet (Y_OFFSET 42 Flash px). */
export const CLASSIC_FIREBALL_UP = 21;
