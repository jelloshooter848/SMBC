import type { InputFrame } from '@engine/input/input-manager';
import { px } from '@engine/math/units';
import type { ProjectileSpec } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import { MM_HIT } from '../megaman/classic-weapons';
import type { RapidAim } from '../megaman/classic';

/**
 * Classic SMBC Bass's buster (bug-reports/2026-10-07-bass-build-classic-character.md, BA-19..BA-22):
 * the Bass Buster spec and its 7-way aim. His Robot Master weapons are Classic Mega Man's
 * (megaman/classic-weapons.ts, BA-23..BA-25).
 */

/** 580 px/s forward (4.8333 px/f) and 580 × 0.75 on each axis on a diagonal (3.625 px/f). */
export const BASS_SHOT_SPEED = 0x04d55;
export const BASS_DIAGONAL = 0x03a00;

/**
 * The Bass Buster (BA-19): 50 (the game's weakest weapon), 8 × 8, no gravity; stopped by solid
 * ground (unlike the Mega Buster), it strikes bricks and ? blocks and ends there, ends on any enemy
 * hit, and armour bounces it back harmless (MM-C19's deflect).
 */
export const BASS_BUSTER: ProjectileSpec = {
  kind: 'bass-buster',
  damage: 'buster',
  amount: 50,
  speed: BASS_SHOT_SPEED,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 8,
  h: 8,
  sheet: 'bass',
  frames: ['bass-buster'],
  frameRate: 1,
  classicHit: MM_HIT,
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
  onBlocked: 'deflect',
};

/** The shot cap: 3 small, 4 with the Mushroom or the Flower (BA-16, BA-19). */
export const BASS_CAP_SMALL = 3;
export const BASS_CAP_BIG = 4;

/** The auto-fire timer (BA-21): 75 ms as 2 counts a frame, a shot each time it reaches 9. */
export const BASS_FIRE_STEP = 2;
export const BASS_FIRE_EVERY = 9;

/** Aim directions (`p.scratch._aim`): the pose suffix of each (BA-32). */
export const AIM_FORWARD = 0;
export const AIM_UP = 1;
export const AIM_DIAG_UP = 2;
export const AIM_DIAG_DOWN = 3;
export const AIM_POSE = ['', '-up', '-diag-up', '-diag-down'] as const;

/**
 * Spawn offsets (BA-20), px from his centre line: ahead in his facing, and up from his feet on the
 * ground (in the air 4 px higher).
 */
const SPAWN: readonly { ahead: number; up: number }[] = [
  { ahead: 19, up: 13 },
  { ahead: 5, up: 23 },
  { ahead: 16, up: 20 },
  { ahead: 16, up: 6 },
];

/**
 * The 7-way aim (BA-20), read when each shot fires: Down (with or without left/right) down-forward,
 * Up with left/right up-forward, Up alone straight up, else forward. Fixed vectors, not a
 * normalised 8-way. Centred on the spawn point.
 */
export const bassAim: RapidAim = (p: Player, input: InputFrame, spec: ProjectileSpec) => {
  const up = input.held('up');
  const down = input.held('down');
  const side = input.dirX !== 0;
  const aim = down ? AIM_DIAG_DOWN : up ? (side ? AIM_DIAG_UP : AIM_UP) : AIM_FORWARD;
  const f = p.facing;
  const v = [
    { vx: f * BASS_SHOT_SPEED, vy: 0 },
    { vx: 0, vy: -BASS_SHOT_SPEED },
    { vx: f * BASS_DIAGONAL, vy: -BASS_DIAGONAL },
    { vx: f * BASS_DIAGONAL, vy: BASS_DIAGONAL },
  ][aim] as { vx: number; vy: number };
  const s = SPAWN[aim] as { ahead: number; up: number };
  const b = p.body;
  const cx = b.x + (b.w >> 1);
  const y = b.y + b.h - px(s.up + (b.onGround ? 0 : 4));
  return {
    aim,
    x: cx + f * px(s.ahead) - px(spec.w >> 1),
    y: y - px(spec.h >> 1),
    vx: v.vx,
    vy: v.vy,
  };
};
