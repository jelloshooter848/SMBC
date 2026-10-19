import { px } from '@engine/math/units';
import type { CharacterBehaviour, CharacterDef, CharacterGuide } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { InertiaProfile, MovementProfile, RiseJump } from '../profile';
import { MARIO, MARIO_PALETTES, plumberSprite, plumberTouchLabels, type PlumberPalettes } from './index';
import { MARIO_PROFILE } from './profile';
import { Projectile } from '../../entities/projectiles/projectile';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import {
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicRespawn,
  type ClassicPowerKit,
} from '../classic/power';
import {
  CLASSIC_FIREBALL_AHEAD,
  CLASSIC_FIREBALL_UP,
  CLASSIC_THROW_FRAMES,
  FIREBALL_CLASSIC,
} from './classic-weapons';
import { plumberClassicGuide } from './classic-guide';

/**
 * Classic SMBC Mario and Luigi (2026-10-07-mario-luigi-classic-smbc-rules.md, ML-C1..ML-C28).
 * Constants from Mario.as, Luigi.as and MarioBase.as (SMBC 3.1.21): Flash px/s ÷ 120 = px/f,
 * px/s² ÷ 7200 = px/f², Flash px ÷ 2 = px, and a per-second factor f is f^(1/60) a frame, written
 * as a 16.16 integer. Velocities in 1/4096 px/f.
 */

/** One plumber's numbers (ML-C3, ML-C7). */
export interface PlumberConstants {
  /** AX_DEFAULT, AX_RUN. */
  accel: number;
  runAccel: number;
  /** FX_WALK, FX_RUN_CROUCH, FX_SKID as 16.16 per-frame factors. */
  release: number;
  brake: number;
  skid: number;
  /** JUMP_SPEED_NORMAL / RUN; JUMP_HEIGHT_NORMAL / RUN / MIN (px). */
  standSpeed: number;
  runSpeed: number;
  standCap: number;
  runCap: number;
  minLine: number;
  /** GRAVITY; VY_MAX_PSV_NORMAL. */
  gravity: number;
  maxFall: number;
  /** FY as a 16.16 factor; absent: none (Luigi's FY = 1). */
  softCut?: number;
}

/** MarioBase's shared horizontal numbers (ML-C3). */
const WALK = 0x01755; // 175 px/s: 1.4583 px/f, also JUMP_HEIGHT_RUN_SPEED
const RUN = 0x02800; // 300: 2.5 px/f
const RUN_TO_WALK = 61399; // FX_RUN_TO_WALK .02 per second
const STOP_SNAP = 0x00555; // 40: 0.3333 px/f, also SKID_THRESHOLD

export const MARIO_CONSTANTS: PlumberConstants = {
  accel: 0x000c7, // 350
  runAccel: 0x000c7, // 350
  release: 62767, // .075
  brake: 62344, // .05
  skid: 61816, // .03
  standSpeed: 0x03555, // 400
  runSpeed: 0x03800, // 420
  standCap: 42, // 84
  runCap: 56, // 112
  minLine: 19, // 38
  gravity: 0x00355, // 1500
  maxFall: 0x05000, // 600
  softCut: 52057, // FY .000001
};

/** The profile a plumber's constants make: the rise path, with no SMB1 leftovers (ML-C28). */
export function plumberClassicProfile(c: PlumberConstants): MovementProfile {
  const rise: RiseJump = {
    tiers: [
      { maxVx: WALK, speed: c.standSpeed, cap: c.standCap },
      { maxVx: Infinity, speed: c.runSpeed, cap: c.runCap },
    ],
    minLine: c.minLine,
    gravity: c.gravity,
    headBump: 0x00d55, // CIELING_DISPLACE 100: 0.8333 px/f down
  };
  const inertia: InertiaProfile = {
    accel: c.accel,
    runAccel: c.runAccel,
    release: c.release,
    brake: c.brake,
    skid: c.skid,
    runToWalk: RUN_TO_WALK,
    stopSnap: STOP_SNAP,
    skidPose: STOP_SNAP,
  };
  return {
    // Tier-path fields: required by the type, never read on the rise path (one neutral tier).
    minWalk: 0,
    walkAccel: c.accel,
    runAccel: c.runAccel,
    releaseDecel: 0,
    skidDecel: 0,
    skidTurnaround: 0,
    jump: [{ maxVx: Infinity, initial: c.standSpeed, holdGravity: c.gravity, fallGravity: c.gravity }],
    runTimerFrames: 0,
    variableJump: false,
    instantAccel: false,
    airControl: 'full',
    // Read on the rise path.
    maxWalk: WALK,
    maxRun: RUN,
    maxFall: c.maxFall,
    fallReset: c.maxFall,
    canRun: true,
    coyoteFrames: 0,
    crossGapMinVx: MARIO_PROFILE.crossGapMinVx,
    swim: CLASSIC_SWIM.mario,
    rise,
    inertia,
    ...(c.softCut !== undefined ? { softCut: c.softCut } : {}),
    turnInAir: false,
    jumpBuffer: false,
    stompBounce: 0x02800, // bouncePwr 300: 2.5 px/f
    crouchJump: true,
  };
}

export const MARIO_CLASSIC_PROFILE = plumberClassicProfile(MARIO_CONSTANTS);

/**
 * Mario's and Luigi's Classic behaviour: the Fire Flower's fireballs (ML-C19, ML-C20), the shared
 * Classic power states with the grow and shrink animations and 60-frame freezes (ML-C16, ML-C17).
 */
export function plumberClassicBehaviour(kit: ClassicPowerKit): CharacterBehaviour {
  return {
    update(p, input, world) {
      if (classicBusy(p)) return;
      // Not in the crouch pose (on the ground or in a crouch-jump); a vine never gets here.
      if (p.powerState !== 'fire' || p.crouching) return;
      if (!input.pressed('attack') || world.countProjectiles(p, 'fireball') >= 2) return;
      const s = FIREBALL_CLASSIC;
      const cx = p.centerX + p.facing * px(CLASSIC_FIREBALL_AHEAD);
      const cy = p.feetY - px(CLASSIC_FIREBALL_UP);
      world.spawn(new Projectile(cx - px(s.w >> 1), cy - px(s.h >> 1), p.facing, s, p));
      world.audio.sfx('fireball');
      p.attackTimer = CLASSIC_THROW_FRAMES;
    },
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, kit),
    contactDamage: () => null,
    onHurt: (p, world, fromDir) => classicOnHurt(p, world, fromDir, kit),
    onRespawn: (p) => classicRespawn(p, {}),
  };
}

/** What differs between the two plumbers' Classic defs. */
export interface PlumberClassicParts {
  base: CharacterDef;
  constants: PlumberConstants;
  palettes: PlumberPalettes;
  guide: CharacterGuide;
}

/** Builds a Classic plumber def on its Current def (same id, name, art and music; TG-18). */
export function plumberClassic(parts: PlumberClassicParts): CharacterDef {
  const kit: ClassicPowerKit = {
    grows: true,
    response:
      CLASSIC_HIT_RESPONSES[parts.base.id] ?? (CLASSIC_HIT_RESPONSES.mario as ClassicPowerKit['response']),
  };
  const def: CharacterDef = {
    ...parts.base,
    rules: 'classic',
    movement: plumberClassicProfile(parts.constants),
    damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
    stomps: true,
    crouches: true,
    canBreakBricks: (p) => p.powerState !== 'small',
    sprite: (p, frame, reduceFlashing) => plumberSprite(p, frame, reduceFlashing, parts.palettes),
    blockPowerUp: classicBlockPowerUp,
    powerIcon: true,
    behaviour: plumberClassicBehaviour(kit),
    touchLabels: plumberTouchLabels,
    guide: parts.guide,
    drawLook: (p, _frame, reduce) => classicLook(p, reduce, kit.response.look),
    starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
    // TG-44: the plumbers carry one weapon, so the full kit is just the top power state (TG-8).
    devKit: () => ({}),
    // ML-C18: DIE_FREEZE_TMR_DUR 250 ms, DIE_JUMP_PWR 500, DIE_GRAVITY 1200, VY_MAX_PSV 540, die timer 3000 ms.
    deathHop: { freeze: 15, vy: 0x042ab, gravity: 0x002ab, maxFall: 0x04800, frames: 195, pitFrames: 180 },
    // ML-C26: the walk at vxMax, then FX_DUNGEON_GOT_AXE .0001 with the stop snap.
    axeWalk: { speed: WALK, stop: 56210, snap: STOP_SNAP },
    seaFloorSafe: true,
  };
  // A Classic def leaves out the Current HUD extras (TG-22).
  delete def.tools;
  delete def.meter;
  delete def.hudExtra;
  delete def.reserve;
  delete def.startHp;
  delete def.drop;
  return def;
}

export const MARIO_CLASSIC: CharacterDef = plumberClassic({
  base: MARIO,
  constants: MARIO_CONSTANTS,
  palettes: MARIO_PALETTES,
  guide: plumberClassicGuide('Mario', 'a sharp rocket jump'),
});
