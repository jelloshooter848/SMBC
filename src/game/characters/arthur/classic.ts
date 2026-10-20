import { px } from '@engine/math/units';
import type { Rng } from '@engine/rng';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile } from '../../entities/projectiles/projectile';
import type { PickupKind } from '../../entities/objects/pickup';
import { BrickPiece, Flash } from '../../entities/effects/effects';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import {
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicPickup,
  classicRespawn,
  classicStarPaletteStep,
  type ClassicPowerKit,
} from '../classic/power';
import { ARTHUR_CLASSIC_GUIDE } from './classic-guide';
import {
  ARTHUR_SHOT_KINDS,
  ARTHUR_WEAPONS,
  ArthurBolt,
  ArthurTorch,
  BOLT_AHEAD,
  MAGIC_COOLDOWN,
  MAGIC_WINDUP,
  WEAPONS,
  WEAPON_NAMES,
  type ArthurWeaponId,
} from './classic-weapons';

/**
 * Sir Arthur, a Classic-only hero (bug-reports/2026-10-19-arthur-build-classic-character.md,
 * AR-1..AR-31, owner-approved with every recommended D-AR answer; TG-41). He was never in SMBC
 * 3.1.21 (`notInOriginal`), so his rules come from Ghosts 'n Goblins with Super Ghouls 'n Ghosts'
 * double jump, magic and down-throw; every number is a tuning value. Armour is the Mushroom (no
 * size change), Gold armour the Fire Flower, his boxers the small state; one hit takes all the
 * armour (Lose Everything), the next one leaves a heap of bones. A slow walk, a committed jump with
 * one redirectable second jump, one weapon at a time (lance, dagger, torch, axe) swapped by the
 * pots enemies drop.
 */

/** Walk 1.25 px/f, instant start and stop (AR-5, D-AR-9). */
export const ARTHUR_WALK = 0x01400;
/** The take-off (AR-5): apex 68 px, 52 f in the air, with gravity 0x00355. */
export const ARTHUR_JUMP = 0x05380;
const GRAVITY = 0x00355;
/** Fall cap 5.8333 px/f, a clamp. */
const MAX_FALL = 0x05d55;

export const ARTHUR_CLASSIC_PROFILE: MovementProfile = {
  // Instant speed: the ramp fields are never read with instantAccel.
  minWalk: ARTHUR_WALK,
  walkAccel: ARTHUR_WALK,
  runAccel: ARTHUR_WALK,
  releaseDecel: ARTHUR_WALK,
  skidDecel: ARTHUR_WALK,
  skidTurnaround: ARTHUR_WALK,
  maxWalk: ARTHUR_WALK,
  maxRun: ARTHUR_WALK,
  jump: [{ maxVx: Infinity, initial: ARTHUR_JUMP, holdGravity: GRAVITY, fallGravity: GRAVITY }],
  maxFall: MAX_FALL,
  fallReset: MAX_FALL,
  runTimerFrames: 0,
  // The committed jump (AR-6): the take-off vx is kept to landing, no turning in the air.
  airControl: 'none',
  turnInAir: false,
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  jumpBuffer: false,
  // One second jump, taking the direction held then (AR-7, D-AR-2).
  airJumps: 1,
  swim: CLASSIC_SWIM.arthur,
};

/** A ground throw roots him this long (AR-8). */
export const THROW_ROOT = 12;
/** The throw pose shows this long. */
const THROW_POSE = 12;
/**
 * Where a weapon leaves (AR-10): px ahead of his centre, px above his feet. The report's 18 (9
 * crouched) sends a standing lance (16 to 20 px up) over every 14 px Goomba and Buzzy and 16 px
 * Koopa, against its own acceptance checks (a Goomba dies to one lance, a Koopa to two): tuned
 * (D-AR-12) to 12 (crouched 6), so a standing throw meets SMB-height enemies.
 */
export const THROW_AHEAD = 11;
export const THROW_UP = 12;
export const THROW_UP_CROUCH = 6;
/** One kill in 8 drops a pot (AR-21, D-AR-7). */
export const POT_RATE = 1 / 8;
export const POT_OF: Readonly<Record<ArthurWeaponId, PickupKind>> = {
  lance: 'pot-lance',
  dagger: 'pot-dagger',
  torch: 'pot-torch',
  axe: 'pot-axe',
};

/*
 * Scratch keys. `weapon` (index into ARTHUR_WEAPONS) and the dev kit flag are carried to the next
 * level; a death wipes them (he starts every life with the lance, AR-10). The `_` keys are per
 * World: `_rt` root frames left, `_pose` throw pose frames left, `_pd` the pose is a down-throw,
 * `_delay` frames to the next throw, `_mw` magic wind-up frames left, `_mcd` magic cooldown,
 * `_aj` air jumps left last frame, `_spr` on a spring launch's way up.
 */
const FULL_KIT = 'arthurAll';
const fullKit = (p: Player): boolean => (p.scratch[FULL_KIT] ?? 0) > 0;

export function weaponOf(p: Player): ArthurWeaponId {
  const i = p.scratch.weapon ?? 0;
  return ARTHUR_WEAPONS[i] ?? 'lance';
}

/** Swaps the weapon (a pot, or Select under the full kit) and says so (AR-21, AR-27). */
function setWeapon(p: Player, world: World, id: ArthurWeaponId): void {
  p.scratch.weapon = ARTHUR_WEAPONS.indexOf(id);
  world.events.push({ type: 'say', text: WEAPON_NAMES[id] });
}

/** The world each player last updated in (rooted runs in Player.update, which has none). */
const worlds = new WeakMap<Player, World>();

/** His thrown weapons on screen (AR-11's caps). */
function shotsOut(p: Player, world: World): number {
  let n = 0;
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.owner === p && ARTHUR_SHOT_KINDS.has(e.kind)) n++;
  return n;
}

/** A throw may start now: the delay has passed and the cap allows (AR-13). */
function canThrow(p: Player): boolean {
  if ((p.scratch._delay ?? 0) > 0 || (p.scratch._mw ?? 0) > 0) return false;
  const world = worlds.get(p);
  const cap = WEAPONS[weaponOf(p)].cap[p.powerState] ?? 1;
  return !world || shotsOut(p, world) < cap;
}

/** Lightning may start now: Gold armour, on the ground, not cooling down (AR-19). */
function canCast(p: Player): boolean {
  return (
    p.powerState === 'fire' && p.body.onGround && (p.scratch._mcd ?? 0) <= 0 && (p.scratch._mw ?? 0) <= 0
  );
}

/** Throws the current weapon (AR-10..AR-14); `downward`: Down + Attack in the air. */
function throwWeapon(p: Player, world: World, downward: boolean): void {
  const w = WEAPONS[weaponOf(p)];
  const goldArmour = p.powerState === 'fire';
  const spec = downward ? (goldArmour ? w.goldDown : w.steelDown) : goldArmour ? w.gold : w.steel;
  let x: number;
  let y: number;
  let opts: { vx?: number; vy?: number } = {};
  if (downward) {
    // Under his feet, straight down: lance and dagger at their speed, torch and axe dropped.
    x = p.centerX - px(spec.w >> 1);
    y = p.feetY;
    opts = { vx: 0, vy: w.id === 'lance' || w.id === 'dagger' ? spec.speed : 0 };
  } else {
    const cx = p.centerX + p.facing * px(THROW_AHEAD);
    const cy = p.feetY - px(p.crouching ? THROW_UP_CROUCH : THROW_UP);
    x = cx - px(spec.w >> 1);
    y = cy - px(spec.h >> 1);
  }
  const shot =
    w.id === 'torch'
      ? new ArthurTorch(x, y, p.facing, spec, p, opts)
      : new Projectile(x, y, p.facing, spec, p, opts);
  world.spawn(shot);
  world.audio.sfx('fireball');
  const s = p.scratch;
  s._delay = w.delay;
  s._pose = THROW_POSE;
  s._pd = downward ? 1 : 0;
  // On the ground he stops while throwing; in the air the arc is unchanged (AR-8).
  s._rt = p.body.onGround ? THROW_ROOT - 1 : 0;
}

/** The wind-up's spark, kept to remove it when a hit cancels the magic. */
const sparks = new WeakMap<Player, Flash>();

function cancelMagic(p: Player): void {
  p.scratch._mw = 0;
  sparks.get(p)?.destroy();
  sparks.delete(p);
}

/** The bolts strike (AR-19): two columns, ahead of and behind his centre. */
function castLightning(p: Player, world: World): void {
  sparks.delete(p);
  for (const dir of [1, -1] as const)
    world.spawn(new ArthurBolt(p.centerX + dir * px(BOLT_AHEAD), p.feetY, world, p));
  world.audio.sfx('magic');
}

/** The armour bursts off (AR-17): four pieces in the armour's colour, cosmetic. */
function burstArmour(p: Player, world: World, goldArmour: boolean): void {
  const b = p.body;
  const cx = b.x + (b.w >> 1);
  const cy = b.y + px(8);
  const pieces: readonly [number, number, number][] = [
    [-0x01000, -0x03000, 0],
    [0x01000, -0x03000, 1],
    [-0x02000, -0x02000, 1],
    [0x02000, -0x02000, 0],
  ];
  for (const [vx, vy, f] of pieces)
    world.spawn(new BrickPiece(cx - px(4), cy, vx, vy, `arthur-fx:${goldArmour ? 'gold-' : ''}piece-${f}`));
  world.audio.sfx('break');
}

const KIT: ClassicPowerKit = {
  response: CLASSIC_HIT_RESPONSES.arthur as ClassicPowerKit['response'],
};

/** His drops (AR-21): one kill in 8 drops a pot of a weapon he does not hold, picked evenly. */
export function arthurPotDrop(rng: Rng, p: Player): PickupKind | null {
  if (!rng.chance(POT_RATE)) return null;
  const held = weaponOf(p);
  const others = ARTHUR_WEAPONS.filter((w) => w !== held);
  return POT_OF[others[rng.int(others.length)] ?? 'dagger'];
}

const POT_WEAPON: Partial<Record<PickupKind, ArthurWeaponId>> = {
  'pot-lance': 'lance',
  'pot-dagger': 'dagger',
  'pot-torch': 'torch',
  'pot-axe': 'axe',
};

/** The pose name (without the `boxers-` prefix), AR-29. */
function poseOf(p: Player): string {
  const s = p.scratch;
  if (p.anim === 'climb') return `climb-${p.walkFrame & 1}`;
  if ((s._mw ?? 0) > 0) return 'magic';
  if ((s._pose ?? 0) > 0 || p.anim === 'attack') {
    if (p.crouching) return 'crouch-throw';
    return s._pd ? 'throw-down' : 'throw';
  }
  if (p.crouching) return 'crouch';
  if (!p.body.onGround || p.anim === 'swim') return 'jump';
  if (p.anim === 'walk' || p.anim === 'skid') return `walk-${p.walkFrame % 3}`;
  return 'stand';
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let power = p.powerState;
  // The power-up freeze (PS-C4): the armour clanks on, the old look and the new every 4 f.
  const t = p.transition;
  if (t && t.kind === 'freeze' && !p.hurtLock && !reduceFlashing && ((t.t >> 2) & 1) === 0)
    power = power === 'fire' ? 'big' : power === 'big' ? 'small' : power;
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  const palette = star !== null ? `arthur-star-${star}` : power === 'fire' ? 'arthur-gold' : 'arthur';
  let name: string;
  if (p.dead) name = 'bones';
  else if (p.hurtLock || p.anim === 'hurt') name = 'boxers-hurt';
  else name = (power === 'small' ? 'boxers-' : '') + poseOf(p);
  return {
    sheet: 'arthur',
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.crouching && !p.dead ? 16 : 8,
  };
}

/**
 * CharacterBehaviour.rooted (AR-8, AR-19): a ground throw holds him 12 f, the magic's wind-up its
 * 40; `true`, so he cannot jump out of either. It also roots him on the press frame of a throw or
 * cast that will start.
 */
function rooted(p: Player, input: InputFrame): boolean {
  if (classicBusy(p)) return false;
  const s = p.scratch;
  if ((s._rt ?? 0) > 0 || (s._mw ?? 0) > 0) return true;
  if (input.pressed('attack') && canThrow(p)) return true;
  return input.pressed('special') && canCast(p);
}

function tick(p: Player, key: string): void {
  const v = p.scratch[key] ?? 0;
  if (v > 0) p.scratch[key] = v - 1;
}

export const ARTHUR_CLASSIC: CharacterDef = {
  // The original's level flags (G-010): Not in 3.1.21: helped like Simon (a fixed jump arc). level/layers.ts lays its pieces by them.
  levelFlags: { horz: true },
  id: 'arthur',
  name: 'Arthur',
  hudName: 'ARTHUR',
  rules: 'classic',
  // He was never in SMBC 3.1.21 (owner rule; the dev-menu toggle is a later change).
  notInOriginal: true,
  movement: ARTHUR_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  // His head only bumps (BR-C3); his weapons strike blocks.
  canBreakBricks: () => false,
  // 12 x 24, crouched 12 x 16, the same in armour, gold and boxers (AR-3, D-AR-3).
  hitbox: (p) => (p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: classicBlockPowerUp,
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'arthur', palette: 'arthur', frame: 'stand' },
  // No size change, so the HUD shows the Mushroom or Fire Flower (PS-C26).
  powerIcon: true,
  guide: ARTHUR_CLASSIC_GUIDE,
  // TG-44, AR-22: Gold armour (the dev select's top state) and Select cycles the four weapons.
  devKit: () => ({ [FULL_KIT]: 1 }),
  drop: (rng, _e, killer) => (killer ? arthurPotDrop(rng, killer) : null),
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  // AR-27: the weapon he holds, after the power icon.
  hudExtra: (p) => WEAPON_NAMES[weaponOf(p)].toUpperCase(),
  // Death (AR-15): he crumbles into a heap of bones where he stands.
  deathHop: { freeze: 1, vy: 0, gravity: 0, maxFall: 0, frames: 180, pitFrames: 180 },
  touchLabels: (p) => ({
    attack: 'THROW',
    special: p.powerState === 'fire' ? 'MAGIC' : null,
    select: fullKit(p) ? 'WEAPON' : null,
  }),
  behaviour: {
    update(p, input, world) {
      worlds.set(p, world);
      const s = p.scratch;
      const b = p.body;
      for (const k of ['_rt', '_pose', '_delay', '_mcd']) tick(p, k);
      // The second jump turns him to the direction held (AR-7); the shared code set its vx.
      const airJump = !b.onGround && !p.hurtLock && p.airJumpsLeft < (s._aj ?? 0);
      if (airJump && input.dirX !== 0) p.facing = input.dirX;
      // No second jump on a spring launch's way up (AR-7); it is back from the launch's apex.
      if (p.launched && !b.onGround) {
        s._spr = 1;
        p.airJumpsLeft = 0;
      } else if (s._spr) {
        s._spr = 0;
        if (!b.onGround) p.airJumpsLeft = ARTHUR_CLASSIC_PROFILE.airJumps ?? 0;
      }
      s._aj = p.airJumpsLeft;
      p.attackTimer = s._pose ?? 0;
      if (classicBusy(p)) {
        s._rt = 0;
        s._pose = 0;
        cancelMagic(p);
        return;
      }
      if (fullKit(p) && input.pressed('select')) {
        const next = ARTHUR_WEAPONS[(ARTHUR_WEAPONS.indexOf(weaponOf(p)) + 1) % ARTHUR_WEAPONS.length];
        if (next) setWeapon(p, world, next);
        world.audio.sfx('select');
      }
      if ((s._mw ?? 0) > 0) {
        s._mw = (s._mw ?? 0) - 1;
        if (s._mw === 0) {
          castLightning(p, world);
          s._mcd = MAGIC_COOLDOWN;
        }
        return;
      }
      if (input.pressed('special') && canCast(p)) {
        s._mw = MAGIC_WINDUP;
        world.audio.sfx('charge');
        const spark = new Flash(
          p.centerX + p.facing * px(5) - px(3),
          p.feetY - px(38),
          'arthur-fx',
          'spark',
          MAGIC_WINDUP,
        );
        sparks.set(p, spark);
        world.spawn(spark);
        return;
      }
      if (input.pressed('attack') && canThrow(p)) throwWeapon(p, world, !b.onGround && input.held('down'));
      p.attackTimer = s._pose ?? 0;
    },
    rooted,
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
    contactDamage: () => null,
    onHurt(p, world, fromDir) {
      const was = p.powerState;
      p.scratch._rt = 0;
      p.scratch._pose = 0;
      cancelMagic(p);
      const r = classicOnHurt(p, world, fromDir, KIT);
      // The weapon stays (AR-17); only the armour goes.
      if (r === 'hurt') burstArmour(p, world, was === 'fire');
      return r;
    },
    onPickup(p, kind, world) {
      const w = POT_WEAPON[kind];
      if (!w) return classicPickup(p, kind, world, {});
      // A pot is always taken and swaps the weapon (AR-21); shots in the air keep flying.
      setWeapon(p, world, w);
      world.audio.sfx('powerup');
      return true;
    },
    onGrabVine: (p) => {
      p.scratch._pose = 0;
      cancelMagic(p);
    },
    onLevelClear: (p) => {
      p.scratch._pose = 0;
      cancelMagic(p);
    },
    onRespawn: (p) => classicRespawn(p, {}),
  },
};
