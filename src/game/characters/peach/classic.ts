import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile, RiseJump } from '../profile';
import type { Player } from '../../entities/player';
import type { Enemy } from '../../entities/enemies/enemy';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import { MARIO_CONSTANTS, plumberClassicProfile, type PlumberConstants } from '../mario/classic';
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
  carried,
  carryDrop,
  carryProfileFor,
  carryReset,
  carryRooted,
  carryStands,
  carryUpdate,
  carryVanish,
  lifting,
  throwing,
  type CarryProfile,
} from '../classic/carry';
import { PEACH_CLASSIC_GUIDE } from './classic-guide';

/**
 * Princess Peach, a Classic-only hero (bug-reports/2026-10-19-peach-build-classic-character.md,
 * PE-1..PE-27, every owner decision D-PE-1..D-PE-13 as recommended). She was never a hero in SMBC
 * 3.1.21, so her rules come from Super Mario Bros. 2 (USA) on Classic Mario's model: his walk, run,
 * inertia and rise path with lower caps (PE-5), a float (PE-6), the Power Squat (PE-8), and the shared
 * pluck, lift, carry, throw and ride system (characters/classic/carry.ts, PE-9..PE-14). Numbers
 * marked (T) in the report are tuning values for the owner's playtest.
 */

/** PE-5: Mario's numbers with lower rise caps and min line (T). */
export const PEACH_CONSTANTS: PlumberConstants = {
  ...MARIO_CONSTANTS,
  standCap: 40,
  runCap: 50,
  minLine: 16,
};

/** Float length (PE-6, T), the Power Squat's charge and its jump (PE-8, T). */
export const PEACH_FLOAT_FRAMES = 90;
export const PEACH_SQUAT_FRAMES = 60;
export const PEACH_SQUAT_TIER = { maxVx: Infinity, speed: 0x03555, cap: 72 } as const;

const PLUMBER = plumberClassicProfile(PEACH_CONSTANTS);
export const PEACH_CLASSIC_PROFILE: MovementProfile = {
  ...PLUMBER,
  swim: CLASSIC_SWIM.peach,
  float: { frames: PEACH_FLOAT_FRAMES },
};
const SQUAT_RISE: RiseJump = { ...(PLUMBER.rise as RiseJump), tiers: [{ ...PEACH_SQUAT_TIER }] };

/** The enemies she rides and lifts (PE-11): never spiky, plant, water or boss enemies. */
function liftable(e: Enemy): boolean {
  if (!e.alive) return false;
  return e.kind === 'goomba' || e.kind === 'koopa' || e.kind === 'bullet-bill' || e.kind === 'hammer-bro';
}

/** Her carry numbers (PE-9, PE-12, PE-14; all T). */
export const PEACH_CARRY: CarryProfile = {
  liftFrames: (p) => (p.powerState === 'fire' ? 10 : 20),
  carryCap: { stand: 32, run: 42 },
  carryRun: false,
  throwVx: 0x04000,
  throwVy: -0x01000,
  throwGravity: 0x00200,
  throwFall: 0x04000,
  enemyThrowVx: 0x03800,
  vegDamage: 400,
  enemyBossDamage: 1000,
  liftBricks: true,
  pierceVeg: (p) => p.powerState === 'fire',
  liftable,
  pluckTiles: new Set(['ground', 'hard', 'tree-top', 'mushroom-top', 'castle-brick']),
  watchAfter: 5,
  watchFrames: 300,
  powChance: 1 / 32,
  lieFrames: 300,
  throwPose: 10,
};

const KIT: ClassicPowerKit = {
  grows: true,
  response: CLASSIC_HIT_RESPONSES.peach as ClassicPowerKit['response'],
};

/** A charged Power Squat (PE-8). */
export const squatCharged = (p: Player): boolean => (p.scratch._sq ?? 0) >= PEACH_SQUAT_FRAMES;

/*
 * Transient scratch (`_` keys are not carried to the next level): `_sq` frames of the Power Squat's
 * charge, `_fl` floating at the last update, `_pluck` turnips in a row (PE-14), `_seen` the frame of
 * the last update (a gap means a pipe or a clear took her: what she carried is gone, PE-13).
 */
function update(
  p: Player,
  input: Parameters<CharacterDef['behaviour']['update']>[1],
  world: Parameters<CharacterDef['behaviour']['update']>[2],
): void {
  const s = p.scratch;
  if (classicBusy(p)) {
    s._seen = p.frame;
    return;
  }
  if (s._seen !== undefined && p.frame - s._seen > 1) carryVanish(p);
  s._seen = p.frame;
  carryUpdate(PEACH_CARRY, p, input, world);
  // The float's chirp (D-PE-11).
  if (p.floatT > 0 && !s._fl) world.audio.sfx('peach-float');
  s._fl = p.floatT > 0 ? 1 : 0;
  // The Power Squat (PE-8): Down held on the ground, standing still, hands free, out of the water.
  const charging =
    p.body.onGround && input.held('down') && input.dirX === 0 && !carried(p) && !p.inWater && !lifting(p);
  s._sq = charging ? Math.min((s._sq ?? 0) + 1, PEACH_SQUAT_FRAMES) : 0;
  const mode = carried(p) ? 'carry' : squatCharged(p) ? 'squat' : 'base';
  p.profile = carryProfileFor(PEACH_CARRY, PEACH_CLASSIC_PROFILE, p.profile, mode, SQUAT_RISE);
}

function palette(p: Player, frame: number, reduce: boolean): string {
  if (p.star > 0) return `peach-star-${reduce ? 0 : (frame >> 1) & 3}`;
  const base = p.powerState === 'fire' ? 'peach-flower' : 'peach';
  // A charged Power Squat flashes every 4 frames; steady with Reduce flashing.
  if (squatCharged(p)) return reduce || ((frame >> 2) & 1) === 0 ? 'peach-star-0' : base;
  return base;
}

/** Her frame now (PE-25), offset as Mario's (16 x 32 big frames over a 12 x 24 box). */
export function peachSprite(p: Player, frame: number, reduce: boolean): SpriteSpec {
  const pal = palette(p, frame, reduce);
  const flip = p.facing < 0;
  if (p.transition && p.transition.kind !== 'freeze') {
    const big = ((p.transition.t >> 2) & 1) === (p.transition.kind === 'grow' ? 1 : 0);
    return {
      sheet: 'peach',
      palette: pal,
      frame: big ? 'stand' : 'small-stand',
      flip,
      offsetX: 2,
      offsetY: big ? 16 : 0,
    };
  }
  const small = p.powerState === 'small';
  const pre = small ? 'small-' : '';
  const offsetY = small ? 0 : p.crouching ? 16 : 8;
  if (p.dead) return { sheet: 'peach', palette: pal, frame: `${pre}hurt`, flip, offsetX: 2, offsetY };
  const b = p.body;
  let anim = p.anim;
  // On a ridden enemy or a lift the body is grounded after the move: a ground pose.
  if ((anim === 'jump' || anim === 'swim') && b.onGround) anim = b.vx !== 0 ? 'walk' : 'idle';
  const held = carried(p) !== null;
  let name: string;
  let bob = 0;
  if (lifting(p)) name = `${pre}lift`;
  else if (throwing(p)) name = `${pre}throw`;
  else if (p.floatT > 0) {
    // Floating: the skirt flutters (hands free) or the carry pose, with a 1 px bob (sprite only).
    name = held ? `${pre}carry-jump` : `${pre}float-${(frame >> 3) & 1}`;
    bob = (frame >> 4) & 1;
  } else if (anim === 'climb') name = `${pre}climb-${(frame >> 3) & 1}`;
  else if (anim === 'crouch') name = small ? 'small-stand' : 'crouch';
  else if (anim === 'hurt') name = `${pre}hurt`;
  else if (held) {
    if (anim === 'walk' || anim === 'skid') name = `${pre}carry-walk-${p.walkFrame}`;
    else if (anim === 'jump' || anim === 'swim') name = `${pre}carry-jump`;
    else name = `${pre}carry`;
  } else if (anim === 'walk') name = `${pre}walk-${p.walkFrame}`;
  else if (anim === 'skid') name = `${pre}skid`;
  else if (anim === 'jump' || anim === 'swim') name = `${pre}jump`;
  else name = `${pre}stand`;
  return { sheet: 'peach', palette: pal, frame: name, flip, offsetX: 2, offsetY: offsetY - bob };
}

/** Touch captions (PE-23): RUN, or THROW while carrying; LIFT; no tools button. */
function peachTouchLabels(p: Player): ReturnType<NonNullable<CharacterDef['touchLabels']>> {
  return { attack: carried(p) ? 'THROW' : p.inWater ? null : 'RUN', special: 'LIFT', select: null };
}

export const PEACH_CLASSIC: CharacterDef = {
  id: 'peach',
  name: 'Peach',
  hudName: 'PEACH',
  rules: 'classic',
  notInOriginal: true,
  movement: PEACH_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  // BR-C3: only big Mario and Luigi break bricks with their heads.
  canBreakBricks: () => false,
  hitbox: (p) => (p.powerState === 'small' || p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite: peachSprite,
  blockPowerUp: classicBlockPowerUp,
  powerIcon: true,
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  portrait: { sheet: 'peach', palette: 'peach', frame: 'stand' },
  jumpSfx: (p) => (p.powerState === 'small' ? 'jump-small' : 'jump-big'),
  guide: PEACH_CLASSIC_GUIDE,
  touchLabels: peachTouchLabels,
  standsOnEnemies: (p, e) => carryStands(PEACH_CARRY, p, e),
  // TG-44: no tools and one kit; the full kit is just the top power state.
  devKit: () => ({}),
  // Mario's death hop (ML-C18) and walk to Toad (ML-C26).
  deathHop: { freeze: 15, vy: 0x042ab, gravity: 0x002ab, maxFall: 0x04800, frames: 195, pitFrames: 180 },
  axeWalk: { speed: 0x01755, stop: 56210, snap: 0x00555 },
  behaviour: {
    update,
    rooted: (p, input) => carryRooted(p, input),
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
    contactDamage: () => null,
    onHurt: (p, world, fromDir) => {
      const r = classicOnHurt(p, world, fromDir, KIT);
      if (r === 'dead') carryVanish(p);
      else carryDrop(p, world);
      p.scratch._sq = 0;
      return r;
    },
    onRespawn: (p) => {
      carryReset(p);
      classicRespawn(p, {});
    },
    onGrabVine: (p) => carryVanish(p),
    onGrabStairs: (p) => carryVanish(p),
    onLevelClear: (p) => carryVanish(p),
  },
};
