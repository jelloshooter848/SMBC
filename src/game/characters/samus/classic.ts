import { px, tileAt } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, CharacterGuide, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { Bowser } from '../../entities/enemies/bowser';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { SAMUS } from './index';
import {
  CLASSIC_DROPS,
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicDrop,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicPickup,
  classicRespawn,
  classicStarPaletteStep,
  hasAmmo,
  spendAmmo,
  type ClassicAmmo,
  type ClassicDropTable,
  type ClassicPowerKit,
} from '../classic/power';
import {
  CLASSIC_MAX_BOMBS,
  CLASSIC_MAX_SHOTS,
  ICE_BEAM_CLASSIC,
  LONG_BEAM_CLASSIC,
  MISSILE_CLASSIC,
  MISSILE_UP_CLASSIC,
  MUZZLE,
  SHOOT_POSE_MOVING,
  SHOOT_POSE_STILL,
  SHORT_BEAM_CLASSIC,
  WAVE_BEAM_CLASSIC,
} from './classic-weapons';
import { ClassicBomb } from './classic-bomb';
import { samusClassicGuide } from './classic-guide';

/**
 * Classic SMBC Samus (2026-10-07-samus-classic-smbc-rules.md, SA-C1..SA-C34), from Samus.as,
 * SamusShot.as and SamusBomb.as (SMBC 3.1.21). Built by `classicSamus(variant)` so Pit and Dark
 * Pit (2026-10-07-pit-build-classic-character.md, PI-1) can be the same hero with six rule
 * changes; `SAMUS_CLASSIC` is the factory's defaults.
 *
 * Scratch keys. Carried (kit): `missileUp` (the Missile upgrade, never lost), `missiles` (count),
 * `missileExp` (the Missile Expansion: cap 99, never lost), `classicAll` (the dev full kit, TG-44)
 * with `tool` (its Select: 0 Wave, 1 Ice). Per level: `_crouch`, `_ball`, `_aimUp`, `_flip` (the
 * somersault), `_takeoff` (feet y at a somersault-able take-off), `_screwSnd`, `_wave` (Wave
 * phase), `_still` (crouched without moving since, PI-15), `_g` / `_feet` (last frame's ground).
 */

/** The variant options (PI-1). Classic Samus uses the defaults. */
export interface ClassicSamusVariant {
  /** PI-7: the crouch lasts while Down is held on the ground, and walks and jumps (not latched). */
  crouchWalk: boolean;
  /** PI-8: Down held in the air shows the crouch pose and uses the crouch hitbox. */
  airCrouchPose: boolean;
  /** PI-13: no beam while the crouch pose shows (missiles still fire). */
  noBeamInCrouch: boolean;
  /** PI-9: no walking (or turning) on the ground while Up is held. */
  noWalkWhileAimUp: boolean;
  /** PI-17: false: never curls into the morph ball (so no bombs). */
  morphBall: boolean;
  /** PI-15: sideways shots on the ground, standing or walking: px above the feet. */
  standShotHeight: number;
  /** Every beam's sound (PI-22). */
  beamSfx: string;
}

export const SAMUS_VARIANT: ClassicSamusVariant = {
  crouchWalk: false,
  airCrouchPose: false,
  noBeamInCrouch: false,
  noWalkWhileAimUp: false,
  morphBall: true,
  standShotHeight: MUZZLE.stand,
  beamSfx: 'buster',
};

/**
 * SA-C3, SA-C6, SA-C7: instant 1.25 px/f walking (WALK_SPEED 185 clamped by vxMax 150) on the
 * ground, in the air (stopping when nothing is held) and in the ball; take-off 500 px/s less one
 * frame of gravity 700 (our move-then-gravity order); fall cap vyMaxPsv 450 as a clamp; the soft
 * cut fy .0001 a second (0.8577 a frame); no coyote time and no jump buffer.
 */
export const SAMUS_CLASSIC_PROFILE: MovementProfile = {
  minWalk: 0x01400,
  walkAccel: 0,
  runAccel: 0,
  releaseDecel: 0,
  skidDecel: 0,
  maxWalk: 0x01400,
  maxRun: 0x01400,
  skidTurnaround: 0,
  jump: [{ maxVx: Infinity, initial: 0x0411c, holdGravity: 0x0018e, fallGravity: 0x0018e }],
  maxFall: 0x03c00,
  fallReset: 0x03c00,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  swim: CLASSIC_SWIM.samus,
  softCut: 56210,
  airStop: true,
  jumpBuffer: false,
};

/** Missiles' caps (SA-C12): 40, and 99 with the Missile Expansion. */
export const MISSILE_CAP = 40;
export const MISSILE_EXP_CAP = 99;
/** The first Mushroom's missiles (CLASSIC_MISSILE_DEFAULT_AMMO). */
export const FIRST_MISSILES = 4;
/** The somersault starts 30 px above the take-off (FLIP_HEIGHT_DIST 60 Flash px, SA-C8). */
const FLIP_HEIGHT = 30;
/** Hitboxes (SA-C4, SA-C5): standing 12 x 24, crouched 12 x 15, ball 12 x 12. */
const STAND_H = 24;
const CROUCH_H = 15;
const BALL_H = 12;

const s = (p: Player) => p.scratch;
export const inBall = (p: Player): boolean => (p.scratch._ball ?? 0) > 0;
/** The crouch pose shows (a guide demo's `crouching` too). */
export const crouchPose = (p: Player): boolean => (p.scratch._crouch ?? 0) > 0 || p.crouching;
export const missileCap = (p: Player): number => (p.scratch.missileExp ? MISSILE_EXP_CAP : MISSILE_CAP);
/** Somersaulting (SA-C8). */
export const flipping = (p: Player): boolean => (p.scratch._flip ?? 0) > 0;
/** The Screw Attack: the Flower state and the somersault (SA-C24). */
export const screwAttack = (p: Player): boolean => flipping(p) && p.powerState === 'fire';

const MISSILE_AMMO: ClassicAmmo = { key: 'missiles', max: missileCap };

/** True when no solid tile overlaps the box (subpixels). */
function clear(world: World, x: number, y: number, w: number, h: number): boolean {
  for (let ty = tileAt(y); ty <= tileAt(y + h - 1); ty++)
    for (let tx = tileAt(x); tx <= tileAt(x + w - 1); tx++) if (world.map.isSolid(tx, ty)) return false;
  return true;
}

/** Room for her standing 12 x 24 body where her feet are (the crouch ends only then, SA-C4). */
function roomToStand(p: Player, world: World): boolean {
  const b = p.body;
  return clear(world, b.x, b.y + b.h - px(STAND_H), b.w, px(STAND_H));
}

/**
 * SA-C26: leaving the ball is refused while a solid tile overlaps the band from 15 px above the
 * ball's top to 5 px above its bottom (BALL_TOP_OFS 30, BALL_BOT_OFS 10 Flash px), in its width.
 */
function ballExitClear(p: Player, world: World): boolean {
  const b = p.body;
  const top = b.y - px(15);
  return clear(world, b.x, top, b.w, b.y + b.h - px(5) - top);
}

function setCrouch(p: Player, on: boolean): void {
  if (crouchPose(p) === on && !p.crouching) return;
  if (on) s(p)._crouch = 1;
  else delete s(p)._crouch;
  p.refitHitbox();
}

function endFlip(p: Player): void {
  delete s(p)._flip;
}

/** Into the ball (SA-C25): from a crouch on the ground she pops up 2.5 px and is airborne. */
function enterBall(p: Player): void {
  const b = p.body;
  const pop = b.onGround;
  delete s(p)._crouch;
  delete s(p)._aimUp;
  endFlip(p);
  s(p)._ball = 1;
  p.refitHitbox();
  if (pop) {
    b.y -= px(2.5);
    b.onGround = false;
  }
}

/** Out of the ball (SA-C26): Up stands aiming up, Jump in the jump pose; no jump speed. */
function exitBall(p: Player, world: World): boolean {
  if (!ballExitClear(p, world)) return false;
  const b = p.body;
  delete s(p)._ball;
  p.refitHitbox();
  if (b.onGround && clear(world, b.x, b.y - px(5), b.w, b.h)) {
    b.y -= px(5);
    b.onGround = false;
  }
  return true;
}

function shotsOut(p: Player, world: World): number {
  return world.countProjectiles(p, 'samus-shot');
}

/** The beam she fires now (SA-C11, SA-C18): short when small, Long, then Wave (or Ice: TG-44). */
function beamSpec(p: Player): ProjectileSpec {
  if (p.powerState === 'small') return SHORT_BEAM_CLASSIC;
  if (p.powerState !== 'fire') return LONG_BEAM_CLASSIC;
  return iceSelected(p) ? ICE_BEAM_CLASSIC : WAVE_BEAM_CLASSIC;
}

/** The dev full kit's Select (TG-44): Wave or Ice for the Flower beam. */
function devTools(p: Player): ToolInfo[] {
  if (!s(p).classicAll) return [];
  return [
    // The missile count rides with the beam icon (the slot hudAmmo uses otherwise).
    { id: 'wave', icon: 'icon-wave-beam', count: s(p).missiles ?? 0, usable: true },
    { id: 'ice', icon: 'icon-ice-beam', count: s(p).missiles ?? 0, usable: true },
  ];
}
function iceSelected(p: Player): boolean {
  return activeTool(p, devTools(p))?.id === 'ice';
}

/**
 * A new beam or missile from her muzzle (SA-C20): its centre ahead of her at the pose's height,
 * or above her moving up. `standY` is the standing height (PI-15).
 */
function spawnShot(p: Player, world: World, spec: ProjectileSpec, v: ClassicSamusVariant): Projectile {
  const b = p.body;
  const up = (s(p)._aimUp ?? 0) > 0;
  let cx: number;
  let cy: number;
  if (up) {
    cx = p.centerX + p.facing * px(MUZZLE.upAhead);
    cy = p.feetY - px(MUZZLE.up);
  } else {
    cx = p.centerX + p.facing * px(MUZZLE.ahead);
    let h: number;
    if (!b.onGround) h = MUZZLE.air;
    else if (crouchPose(p) && (!v.crouchWalk || (s(p)._still ?? 0) > 0)) h = MUZZLE.crouch;
    else h = v.standShotHeight;
    cy = p.feetY - px(h);
  }
  const x = cx - px(spec.w / 2);
  const y = cy - px(spec.h / 2);
  let waveSign: -1 | 1 = 1;
  if (spec.wave) {
    // SA-C22: each Wave shot starts the other way (the first of a level down, or right).
    waveSign = (s(p)._wave ?? 0) % 2 === 0 ? 1 : -1;
    s(p)._wave = (s(p)._wave ?? 0) + 1;
  }
  const pr = new Projectile(
    Math.round(x),
    Math.round(y),
    p.facing,
    spec,
    p,
    up ? { vx: 0, vy: -spec.speed, waveSign } : { waveSign },
  );
  world.spawn(pr);
  // SA-C14: the shooting pose (it blocks the somersault, SA-C8).
  const still = (b.onGround && b.vx === 0) || (!b.onGround && up);
  p.attackTimer = still ? SHOOT_POSE_STILL : SHOOT_POSE_MOVING;
  endFlip(p);
  return pr;
}

function fireBeam(p: Player, world: World, v: ClassicSamusVariant): void {
  if (shotsOut(p, world) >= CLASSIC_MAX_SHOTS) return;
  spawnShot(p, world, beamSpec(p), v);
  world.audio.sfx(v.beamSfx);
}

function fireMissile(p: Player, world: World, v: ClassicSamusVariant): void {
  if (!s(p).missileUp || shotsOut(p, world) >= CLASSIC_MAX_SHOTS) return;
  if (!hasAmmo(p, 'missiles', 1)) return;
  spendAmmo(p, 'missiles', 1);
  spawnShot(p, world, (s(p)._aimUp ?? 0) > 0 ? MISSILE_UP_CLASSIC : MISSILE_CLASSIC, v);
  world.audio.sfx('missile');
}

function layBomb(p: Player, world: World): void {
  const out = world.entities.filter((e) => e instanceof ClassicBomb && e.alive && e.owner === p).length;
  if (out >= CLASSIC_MAX_BOMBS) return;
  // SA-C27: centred on her centre x, 6 px above her feet, hanging there.
  world.spawn(new ClassicBomb(p.centerX, p.feetY - px(6), p));
  world.audio.sfx('kick');
}

/**
 * The somersault state (SA-C8; Samus.as checkState): ends on landing, below the line 30 px above
 * the take-off, with Up held or in the shooting pose; starts while rising above that line after a
 * take-off with a direction held, not shooting, not aiming up. The Screw Attack comes with it.
 */
function updateFlip(p: Player, input: InputFrame): void {
  const b = p.body;
  const t = s(p)._takeoff;
  if (b.onGround || t === undefined || inBall(p)) {
    endFlip(p);
    return;
  }
  const line = t - px(FLIP_HEIGHT);
  if (flipping(p) && p.feetY > line) endFlip(p);
  if (input.held('up') || p.attackTimer > 0) {
    endFlip(p);
    return;
  }
  if (!flipping(p) && p.feetY < line && b.vy < 0) {
    s(p)._flip = 1;
    // The Screw Attack sound plays once per jump (none exists yet: SA hints, sounds).
    if (p.powerState === 'fire') s(p)._screwSnd = 1;
  }
}

/** Ground and take-off bookkeeping, after this frame's movement. */
function trackJump(p: Player, input: InputFrame, world: World, v: ClassicSamusVariant): void {
  const b = p.body;
  const wasGround = (s(p)._g ?? 0) > 0;
  if (wasGround && !b.onGround && p.jumping && !p.launched) {
    // A jump's take-off frame: a somersault only after one with a direction held (SA-C8).
    const feet = s(p)._feet ?? p.feetY;
    if (input.dirX !== 0) s(p)._takeoff = feet;
    else delete s(p)._takeoff;
    delete s(p)._screwSnd;
    if (crouchPose(p) && !v.crouchWalk) {
      // Jump leaves the latched crouch (SA-C4): stand up (canJump checked the room).
      setCrouch(p, false);
      if (!clear(world, b.x, b.y, b.w, b.h)) b.y = (tileAt(b.y) + 1) * px(16);
    }
  }
  if (b.onGround) {
    s(p)._g = 1;
    s(p)._feet = p.feetY;
    delete s(p)._takeoff;
  } else delete s(p)._g;
}

/** Builds a Classic Samus def (PI-1): `variant` for Pit's rule changes, `palette` its look. */
export function classicSamus(
  opts: {
    base?: CharacterDef;
    variant?: Partial<ClassicSamusVariant>;
    /** Palette prefix: `<prefix>` small and Mushroom, `<prefix>-varia` with the Flower. */
    palette?: string;
    guide?: CharacterGuide;
    jumpSfx?: string;
  } = {},
): CharacterDef {
  const base = opts.base ?? SAMUS;
  const v: ClassicSamusVariant = { ...SAMUS_VARIANT, ...opts.variant };
  const prefix = opts.palette ?? 'samus';
  const kit: ClassicPowerKit = {
    response: CLASSIC_HIT_RESPONSES.samus as ClassicPowerKit['response'],
    // SA-C12: the first Mushroom gives Missiles with 4; a later one leaves the count alone.
    gainBig(p) {
      if (s(p).missileUp) return;
      s(p).missileUp = 1;
      s(p).missiles = FIRST_MISSILES;
    },
    // The Flower adds the Missile Expansion (never lost); the Long Beam, Wave Beam and Screw
    // Attack come and go with the state itself (SA-C11).
    gainFire(p) {
      if (!s(p).missileUp) {
        s(p).missileUp = 1;
        s(p).missiles = FIRST_MISSILES;
      }
      s(p).missileExp = 1;
    },
    // A Flower while she has the Flower: +4 missiles up to the cap.
    repeat: { ...MISSILE_AMMO, add: 4 },
  };
  const drops: ClassicDropTable = {
    ...(CLASSIC_DROPS.samus as ClassicDropTable),
    gate: (p: Player) => !!p.scratch.missileUp,
  };

  function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
    let palette = p.powerState === 'fire' ? `${prefix}-varia` : prefix;
    const star = classicStarPaletteStep(p, frame, reduceFlashing);
    // SA-C24: the Screw Attack flashes like the Star (the Star's palette wins); reduce: Varia.
    if (star !== null) palette = `samus-star-${star}`;
    else if (screwAttack(p) && !reduceFlashing) palette = `samus-star-${(frame >> 1) & 3}`;
    const b = p.body;
    const shooting = p.attackTimer > 0;
    let name: string;
    let offsetY = 8;
    if (p.dead) name = 'die';
    else if (p.hurtLock || p.anim === 'hurt') name = 'hurt';
    else if (inBall(p)) {
      name = `ball-${(b.x >> 11) & 3}`;
      offsetY = 20;
    } else if (crouchPose(p)) {
      name = shooting && !v.crouchWalk ? 'crouch-shoot' : 'crouch';
      offsetY = 32 - CROUCH_H;
    } else if ((s(p)._aimUp ?? 0) > 0) name = 'aim-up';
    else if (!b.onGround) name = flipping(p) ? `spin-${(frame >> 2) & 3}` : 'jump';
    else if (b.vx !== 0) name = shooting ? `walk-shoot-${p.walkFrame}` : `walk-${p.walkFrame}`;
    else name = shooting ? 'shoot' : 'idle';
    const sheet = name.startsWith('crouch') ? 'samus-classic' : 'samus';
    return { sheet, palette, frame: name, flip: p.facing < 0, offsetX: 2, offsetY };
  }

  const def: CharacterDef = {
    ...base,
    rules: 'classic',
    movement: SAMUS_CLASSIC_PROFILE,
    damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
    stomps: false,
    crouches: false,
    // SA-C29: her head bumps bricks and blocks in every state, never breaks them; not in the ball.
    canBreakBricks: () => false,
    headBumps: (p) => !inBall(p),
    hitbox: (p) => ({ w: 12, h: inBall(p) ? BALL_H : crouchPose(p) ? CROUCH_H : STAND_H }),
    sprite,
    blockPowerUp: classicBlockPowerUp,
    powerIcon: true,
    jumpSfx: () => opts.jumpSfx ?? 'jump-big',
    guide: opts.guide ?? samusClassicGuide(base.name),
    drawLook: (p, _frame, reduce) => classicLook(p, reduce, kit.response.look),
    starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
    drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, drops, 'enemy') : null),
    blockDrop: (rng, p, source) => classicDrop(rng, p, drops, source),
    hudAmmo: (p) =>
      p.scratch.missileUp && !p.scratch.classicAll
        ? { icon: 'icon-missile', count: p.scratch.missiles ?? 0 }
        : null,
    // TG-44: Flower state, Missiles with 99 and the Expansion, and Select between Wave and Ice.
    devKit: () => ({ missileUp: 1, missiles: MISSILE_EXP_CAP, missileExp: 1, classicAll: 1 }),
    tools: (p) => devTools(p),
    touchLabels(p) {
      if (inBall(p)) return { attack: 'BOMB', special: null, select: null };
      if (crouchPose(p) && v.noBeamInCrouch)
        return { attack: null, special: p.scratch.missileUp ? 'MISSILE' : null, select: null };
      return {
        attack: 'SHOOT',
        special: p.scratch.missileUp ? 'MISSILE' : null,
        select: p.scratch.classicAll ? 'BEAM' : null,
      };
    },
    behaviour: {
      // No jump in the ball (Jump leaves it, SA-C26), nor from a crouch with no room to stand.
      canJump: (p) => !inBall(p) && !(crouchPose(p) && !v.crouchWalk && !s(p)._roomOk),
      // She may always jump out of it ('canJump'; canJump above still checks the crouch's room).
      rooted(p, input) {
        const b = p.body;
        if (inBall(p) || !b.onGround) return false;
        if (v.noWalkWhileAimUp && input.held('up')) return 'canJump'; // PI-9 (and PI-M7)
        if (v.crouchWalk) return false; // PI-7
        // SA-C4: crouched, or Down held, she cannot walk; walking with Down up stands her up.
        if (input.held('down')) return 'canJump';
        return crouchPose(p) && !(input.dirX !== 0 && (s(p)._roomOk ?? 0) > 0) ? 'canJump' : false;
      },
      onGrabVine(p) {
        // Character.getOnVine: she climbs standing; the somersault and the ball end.
        delete s(p)._aimUp;
        delete s(p)._crouch;
        delete s(p)._ball;
        endFlip(p);
        p.refitHitbox();
      },
      onGrabStairs(p) {
        delete s(p)._crouch;
        delete s(p)._ball;
        endFlip(p);
        p.refitHitbox();
      },
      onLevelClear(p) {
        // SA-C31: the flagpole slide ends the Screw Attack; the axe leaves the ball.
        delete s(p)._crouch;
        delete s(p)._ball;
        delete s(p)._aimUp;
        endFlip(p);
        p.refitHitbox();
      },
      update(p, input, world) {
        const b = p.body;
        cycleTool(p, input, devTools(p), world);
        trackJump(p, input, world, v);
        if (classicBusy(p)) {
          // A hit ends the somersault (SA-C8 default) and the aim.
          endFlip(p);
          delete s(p)._aimUp;
          return;
        }
        if (inBall(p)) {
          if (input.pressed('up') || input.pressed('jump')) {
            if (exitBall(p, world) && input.pressed('up')) s(p)._aimUp = 1;
          } else if (input.pressed('attack')) layBomb(p, world);
          if (inBall(p)) return;
        }
        if (v.crouchWalk) {
          // PI-7, PI-8: the crouch pose while Down is held (in the air too with airCrouchPose).
          const want = input.held('down') && (b.onGround || v.airCrouchPose);
          if (want !== crouchPose(p) && (want || roomToStand(p, world))) {
            if (want && b.onGround && b.vx === 0) s(p)._still = 1;
            setCrouch(p, want);
          }
          if (!b.onGround || b.vx !== 0 || !crouchPose(p)) delete s(p)._still;
        } else if (input.pressed('down')) {
          if (crouchPose(p) && v.morphBall) enterBall(p);
          else if (!b.onGround && !crouchPose(p) && v.morphBall) enterBall(p);
          else if (b.onGround && !input.held('up') && !crouchPose(p)) {
            setCrouch(p, true);
            b.vx = 0;
          }
        } else if (crouchPose(p)) {
          // SA-C4: Up stands her up aiming; walking with Down released stands her up; off the
          // ground (a lift, a hit) she stands too. Always only where 12 x 24 fits.
          const leave = input.pressed('up') || !b.onGround || (input.dirX !== 0 && !input.held('down'));
          if (leave && roomToStand(p, world)) setCrouch(p, false);
        }
        // Room for the walk-out next frame (rooted runs before this frame's own update).
        if (crouchPose(p) && roomToStand(p, world)) s(p)._roomOk = 1;
        else delete s(p)._roomOk;
        if (inBall(p)) return;
        // Aiming up: Up held, not crouched (the crouch pose wins, PI-M7).
        if (input.held('up') && !crouchPose(p)) s(p)._aimUp = 1;
        else delete s(p)._aimUp;
        updateFlip(p, input);
        if (input.pressed('attack') && !(crouchPose(p) && v.noBeamInCrouch)) fireBeam(p, world, v);
        if (input.pressed('special')) fireMissile(p, world, v);
      },
      onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, kit),
      // SA-C24: the Screw Attack kills what it touches, armour included; never Bowser.
      contactDamage(p, e) {
        if (!screwAttack(p) || e instanceof Bowser) return null;
        return { kind: 'weapon', amount: 0, instant: true, pierce: 5, owner: p, dirX: p.facing };
      },
      onHurt(p, world, fromDir) {
        endFlip(p);
        delete s(p)._aimUp;
        // SA-C15: hit in the ball she stays in it; a crouch ends where there is room.
        if (crouchPose(p) && roomToStand(p, world)) delete s(p)._crouch;
        return classicOnHurt(p, world, fromDir, kit);
      },
      onPickup: (p, kind, world) => classicPickup(p, kind, world, { 'missile-pack': MISSILE_AMMO }),
      onRespawn: (p) => classicRespawn(p, {}),
    },
  };
  // A Classic def leaves out the Current HUD extras (TG-22); `tools` only lists the dev kit's.
  delete def.meter;
  delete def.hudExtra;
  delete def.reserve;
  delete def.startHp;
  delete def.energyTanks;
  return def;
}

/*
 * SA-C32 (Samus.as initiateNormalDeath, SamusGuts.as): six pieces from her anchor (centre x, feet),
 * the original's numbers halved for our 16 px tiles and taken per 60 fps frame: 1-3 right, 4-6
 * left, 5 px out; top 24 px up (vy -200 px/s, gravity 500 px/s²), middle 15 px (-200, 350),
 * bottom 6 px (-100, 150); 150 px/s sideways, gone 50 px out (MAX_X_DIST 100). The die timer is
 * DIE_TMR_DEL_NORMAL 3000 ms, DIE_TMR_DEL_PIT 2500 ms; SFX_SAMUS_DIE plays both ways.
 */
const PX_S = 0.5 / 60;
const PX_S2 = 0.5 / 3600;
const ROWS = [
  { y: 24, vy: -200, g: 500 },
  { y: 15, vy: -200, g: 350 },
  { y: 6, vy: -100, g: 150 },
] as const;
const SAMUS_DEATH: NonNullable<CharacterDef['deathBurst']> = {
  sheet: 'samus-classic',
  pieces: [1, -1].flatMap((side, s) =>
    ROWS.map((r, i) => ({
      frame: `guts-${s * 3 + i + 1}`,
      x: side * 5,
      y: r.y,
      vx: side * 150 * PX_S,
      vy: r.vy * PX_S,
      gravity: r.g * PX_S2,
      range: 50,
    })),
  ),
  jingle: 'samus-classic-death',
  frames: 180,
  pitFrames: 150,
};

export const SAMUS_CLASSIC: CharacterDef = {
  ...classicSamus(),
  deathBurst: SAMUS_DEATH,
  // The castle text's name (PM-M8): the original's default skin (BmdInfo.as).
  rescueName: 'the hatchling',
};
