import type { ClassicBlocks, ProjectileSpec } from '../../entities/projectiles/projectile';
import type { ClassicHitProps } from '../../rules/damage';
import { POWER_BEAM, ICE_BEAM, WAVE_BEAM, MISSILE } from './weapons';

/**
 * Classic SMBC Samus's shots (2026-10-07-samus-classic-smbc-rules.md SA-C17..SA-C23; SamusShot.as,
 * DamageValue.as). Speeds: Flash px/s ÷ 120 = px/f, in 1/4096 px/f. Damage in the original's units
 * (a Goomba has 250, a brick 125). Shots fired up use the `*_UP` bodies.
 */

/** SamusShot SPEED 500: 4.1667 px/f. */
const SPEED = 0x042ab;
/** The Wave Beam's 400: 3.3333 px/f. */
const WAVE_SPEED = 0x03555;
/** Beams and missiles share one cap (Samus.MAX_SHOTS_ON_SCREEN, SA-C17). */
export const CLASSIC_MAX_SHOTS = 3;
/** Bombs have their own (MAX_BOMBS_ON_SCREEN, SA-C17). */
export const CLASSIC_MAX_BOMBS = 3;
/** The short beam's range: 100 Flash px = 50 px, removed after 12 frames (SA-C18). */
export const SHORT_BEAM_FRAMES = 12;
/** A beam's burst shows 50 ms in place (SA-C19). */
const BURST_FRAMES = 3;

/**
 * Every beam or missile hit on a survivor (SA-C23, HP-C16): stopped 9 frames (SHOT_IMMOBILIZE_DUR
 * 150 ms), flashing 9, and no damage from anyone for 9. Armour plays the bullet-proof sound
 * (`bump` until it exists).
 */
const SHOT_HIT: ClassicHitProps = { stopFrames: 9, flashFrames: 9, invulnFrames: 9, blockedSfx: 'bump' };
/** Beams, the Ice Beam and missiles stop at any solid tile, striking a block they hit (BR-C16). */
const COLLIDE: ClassicBlocks = { ground: 'collide', afterBlock: 'end', strikesBlocks: true };
/** The Wave Beam passes ground and pipes but strikes (and ends at) bricks and blocks. */
const PASS: ClassicBlocks = { ground: 'pass', afterBlock: 'end', strikesBlocks: true };

const beamBase = {
  speed: SPEED,
  hitsTiles: true,
  piercesTiles: false,
  pierce: false,
  breaksBricks: false,
  endsOffTop: true,
  burstHold: BURST_FRAMES,
  classicBlocks: COLLIDE,
} as const;

/**
 * The Long Beam (Mushroom): 150, until off screen. Kind `samus-shot` for the shared cap. F2: the
 * original's beam (SamusShotMc `normal`), a 4 x 5 bolt (HRect 4 x 5) in red, orange and a green
 * core with a 7 x 8 burst (`normalEnd`), drawn in an 8 x 8 cell around its body.
 */
export const LONG_BEAM_CLASSIC: ProjectileSpec = {
  ...POWER_BEAM,
  ...beamBase,
  w: 4,
  h: 5,
  frames: ['classic-beam-0', 'classic-beam-1'],
  burstFrame: 'classic-beam-burst',
  burstMirrors: false,
  drawOffset: { x: -2, y: -1 },
  kind: 'samus-shot',
  amount: 150,
  lifetime: null,
  classicHit: SHOT_HIT,
};

/** Small Samus's beam: the same shot, removed after 12 frames (no burst). */
export const SHORT_BEAM_CLASSIC: ProjectileSpec = { ...LONG_BEAM_CLASSIC, lifetime: SHORT_BEAM_FRAMES };

/**
 * The Wave Beam (Flower, the Classic weapon): 225, 3.3333 px/f, ±15 px at 0.4167 rad a frame
 * (25 rad/s: a 15.08-frame period), across when fired up (SA-C22). Stops at the first enemy.
 */
export const WAVE_BEAM_CLASSIC: ProjectileSpec = {
  ...WAVE_BEAM,
  ...beamBase,
  kind: 'samus-shot',
  amount: 225,
  speed: WAVE_SPEED,
  lifetime: null,
  classicBlocks: PASS,
  wave: { amplitude: 15, period: (2 * Math.PI) / (25 / 60), vertical: true },
  // F2: the original's `wave`, 8 x 8 with a black outline, bursting as `waveEnd`; it comes only
  // with the Flower, whose Varia palette row turns the orange pink.
  sheet: 'smbc-shots',
  frames: ['wave-varia-0', 'wave-varia-1'],
  burstFrame: 'wave-varia-burst',
  classicHit: SHOT_HIT,
};

/**
 * The Ice Beam (only with `&kit=full`, TG-44, SA-C21): 125; the first hit on an unfrozen enemy
 * freezes it 360 frames (FREEZE_DUR 6000 ms) with no damage instead.
 */
export const ICE_BEAM_CLASSIC: ProjectileSpec = {
  ...ICE_BEAM,
  ...beamBase,
  kind: 'samus-shot',
  amount: 125,
  lifetime: null,
  classicHit: { ...SHOT_HIT, freezeFrames: 360 },
};

/** A missile (SA-C18): 400, pierces armour, ends in its explosion at once (no held burst). */
export const MISSILE_CLASSIC: ProjectileSpec = {
  ...MISSILE,
  // F2: the original's `missile`, 11 x 8 (HRect 10 x 7.5), its fins cyan.
  w: 10,
  h: 8,
  sheet: 'smbc-shots',
  frames: ['missile'],
  burstFrame: 'missile-burst',
  kind: 'samus-shot',
  amount: 400,
  speed: SPEED,
  hitsTiles: true,
  breaksBricks: false,
  endsOffTop: true,
  classicBlocks: COLLIDE,
  classicHit: { ...SHOT_HIT, pierce: 5 },
};

/** The missile fired up: its sprite turned to point up (8 x 16). */
export const MISSILE_UP_CLASSIC: ProjectileSpec = {
  ...MISSILE_CLASSIC,
  w: 8,
  h: 10,
  frames: ['missile-up'],
};

/** Bomb (SA-C27): 57-frame fuse, a 24 x 24 blast live 12 frames, then 12 frames of fading. */
export const BOMB_FUSE = 57;
export const BOMB_BLAST_PX = 24;
export const BOMB_LIVE = 12;
export const BOMB_FADE = 12;
/** 400 damage (no armour pierce); the 9-frame stop and flash, no invulnerability (SA-C23). */
export const BOMB_HIT: ClassicHitProps = { stopFrames: 9, flashFrames: 9 };
export const BOMB_DAMAGE = 400;
/** Bomb boost: Flash 230 up, less one frame of gravity (SA-C28): 1.8194 px/f. */
export const BOMB_BOOST_VY = 0x01d1c;

/** Muzzles (SA-C20, SamusShot.as): px from her centre x and from her feet. */
export const MUZZLE = {
  ahead: 12.5,
  stand: 22,
  crouch: 12.5,
  air: 15,
  upAhead: 2,
  up: 36,
} as const;

/** Shooting pose (SA-C14): 50 ms standing still or aiming up in the air, else 140 ms. */
export const SHOOT_POSE_STILL = 3;
export const SHOOT_POSE_MOVING = 8;
