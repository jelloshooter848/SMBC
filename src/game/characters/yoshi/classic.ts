import { px } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterBehaviour, CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile, SwimProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { MARIO_CONSTANTS } from '../mario/classic';
import {
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicRespawn,
  classicStarPaletteStep,
  classicStartKit,
  hasAmmo,
  spendAmmo,
  type ClassicPowerKit,
} from '../classic/power';
import {
  aimAngle,
  clearMouth,
  endTongue,
  ensureFx,
  mouthOf,
  startTongue,
  tongueOut,
  tongueTick,
} from '../classic/yoshi-tongue';
import { EGG_CAP, THROW_FRAMES, spit, throwEgg } from './classic-weapons';
import { YOSHI_CLASSIC_GUIDE } from './classic-guide';
import { MARIO_PROFILE } from '../mario/profile';

/**
 * Classic Yoshi, a Classic-only hero (bug-reports/2026-10-19-yoshi-build-classic-character.md,
 * Part A, YO-1..YO-30; owner-approved with the report's recommended answers YO-D1..YO-D9). Yoshi's
 * Island's moves at SMB's scale: a walk with no run, a flutter jump, a ground pound, the tongue
 * (catch, swallow and lay, spit) and eggs aimed with a sweeping cursor and thrown. Every number is
 * a tuning value (no original source: SMBC 3.1.21 has no Yoshi). Velocities in 1/4096 px/f.
 *
 * He plays on the tier path (Player.update) with the Classic plumbers' inertia, so the shared
 * floor-jump water rules (SW-C2), Player.root / rootFreeze (the pound's hang, the lay) and the
 * flutter (MovementProfile.flutter) all apply.
 */

/** One speed cap, between Mario's walk and run (YO-5). */
export const YOSHI_WALK = 0x01c00;
/** Jump take-off (YO-7). */
export const YOSHI_JUMP = 0x03400;
/** Flutter (YO-8): 40 frames, lift 0.125 px/f², held at a 0.5 px/f rise. */
export const YOSHI_FLUTTER = { frames: 40, lift: 0x00200, rise: 0x00800 } as const;
/** Ground pound (YO-9): hang, drop speed, landing recovery. */
export const POUND_HANG = 12;
export const POUND_VY = 0x06000;
export const POUND_RECOVER = 8;
/** Swallow and lay (YO-19). */
export const LAY_FRAMES = 20;
/** Egg caps (YO-12): small 3, Mushroom and Flower 6; start and death reset 3. */
export const EGGS_SMALL = 3;
export const EGGS_BIG = 6;
export const EGGS_START = 3;
/** The ground pound's bounce off an enemy (YO-9): bouncePwr 300, 2.5 px/f, jump held or not. */
export const POUND_BOUNCE = 0x02800;

/** The ground pound's feet (YO-9): 800 with pierce 10. */
export const POUND_DAMAGE = 800;

/** Water (YO-10): a Classic floor jumper with its own numbers. */
export const YOSHI_SWIM: SwimProfile = {
  stroke: 0x032e4, // 3.25 px/f less one frame of water gravity
  gravity: 0x0011c,
  sinkMax: 0x02155,
  floorJumpOnly: true,
  surfaceTest: 'top',
  noStomp: true,
  surface: { gravity: MARIO_CONSTANTS.gravity, fallMax: 0x04000 },
};

/**
 * YO-5, YO-7, YO-8: the tier path with Mario's inertia factors and one 1.75 px/f cap; one jump
 * tier held lighter while rising (about 65 px held, 16 px tapped), a soft cut on release.
 */
export const YOSHI_CLASSIC_PROFILE: MovementProfile = {
  minWalk: 0,
  walkAccel: MARIO_CONSTANTS.accel,
  runAccel: MARIO_CONSTANTS.accel,
  releaseDecel: 0,
  skidDecel: 0,
  skidTurnaround: 0,
  maxWalk: YOSHI_WALK,
  maxRun: YOSHI_WALK,
  jump: [
    { maxVx: Infinity, initial: YOSHI_JUMP, holdGravity: 0x00150, fallGravity: MARIO_CONSTANTS.gravity },
  ],
  maxFall: 0x04000,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: true,
  instantAccel: false,
  coyoteFrames: 0,
  inertia: {
    accel: MARIO_CONSTANTS.accel,
    runAccel: MARIO_CONSTANTS.accel,
    release: MARIO_CONSTANTS.release,
    brake: MARIO_CONSTANTS.brake,
    skid: MARIO_CONSTANTS.skid,
    runToWalk: 61399,
    stopSnap: 0x00555,
    skidPose: 0x00555,
  },
  softCut: 60000,
  turnInAir: false,
  jumpBuffer: false,
  // BUG-07 (owner decision): the campaign's held stomp bounce (Current Mario's).
  stompHeld: MARIO_PROFILE,
  swim: YOSHI_SWIM,
  flutter: YOSHI_FLUTTER,
};

/** The egg cap now (YO-12). */
export const eggCap = (p: Player): number => (p.powerState === 'small' ? EGGS_SMALL : EGGS_BIG);

const START_KIT = { eggs: EGGS_START } as const;

/** YO-12, YO-13: the kit row, and Simon's hit response row (PS-C10). */
const KIT: ClassicPowerKit = {
  response: CLASSIC_HIT_RESPONSES.simon as ClassicPowerKit['response'],
  gainBig: (p) => {
    p.scratch.eggs = Math.max(p.scratch.eggs ?? 0, EGGS_START);
  },
  // A hit takes the max of 6 (and the red eggs with the Flower): eggs above 3 are lost (YO-D4).
  loseBig: (p) => {
    p.scratch.eggs = Math.min(p.scratch.eggs ?? 0, EGGS_SMALL);
  },
  repeat: { key: 'eggs', max: eggCap, add: 3 },
};

/* ---------- state (p.scratch, `_` keys are not carried to the next level) ---------- */

/** 1 hang, 2 drop, 3 landing recovery. */
const pound = (p: Player): number => p.scratch._pound ?? 0;
const laying = (p: Player): boolean => (p.scratch._lay ?? 0) > 0;
const aiming = (p: Player): boolean => p.scratch._aim !== undefined;

function endPound(p: Player): void {
  const was = pound(p);
  delete p.scratch._pound;
  delete p.scratch._poundT;
  p.fallCap = 0;
  p.activeMelee = null;
  if (was === 1) {
    p.root = 0;
    p.rootFreeze = false;
  }
  if (was === 2) p.refitHitbox();
}

/** Everything in progress ends (a hit, a vine, a death). */
function resetMoves(p: Player): void {
  endPound(p);
  endTongue(p);
  clearMouth(p);
  delete p.scratch._aim;
  delete p.scratch._lay;
  delete p.scratch._throw;
}

/** The melee box of the pound's feet: from the feet down 8 px (YO-9). */
function feetBox(p: Player): { x: number; y: number; w: number; h: number } {
  const b = p.body;
  return { x: b.x, y: b.y + b.h - px(4), w: b.w, h: px(12) };
}

function eggsOut(p: Player, world: World): number {
  return world.countProjectiles(p, 'yoshi-egg');
}

function startPound(p: Player, world: World): void {
  p.scratch._pound = 1;
  p.scratch._poundT = POUND_HANG;
  p.root = POUND_HANG;
  p.rootFreeze = true;
  p.body.vx = 0;
  p.body.vy = 0;
  // A pound ends the flutter and uses it up (YO-9).
  p.flutterT = 0;
  p.flutterUsed = true;
  delete p.scratch._aim;
  world.audio.sfx('yoshi-pound-spin');
}

function poundTick(p: Player, world: World): void {
  const b = p.body;
  const ph = pound(p);
  if (ph === 1) {
    if ((p.scratch._poundT = (p.scratch._poundT ?? 1) - 1) > 0) return;
    p.scratch._pound = 2;
    p.refitHitbox();
    b.vy = p.inWater ? (p.profile.swim?.sinkMax ?? POUND_VY) : POUND_VY;
    p.fallCap = p.inWater ? 0 : POUND_VY;
    p.activeMelee = feetBox(p);
    return;
  }
  if (ph === 2) {
    b.vx = 0;
    if (p.inWater) p.fallCap = 0;
    if (b.onGround) {
      p.fallCap = 0;
      p.activeMelee = null;
      p.scratch._pound = 3;
      p.scratch._poundT = POUND_RECOVER;
      p.root = POUND_RECOVER;
      p.refitHitbox();
      world.audio.sfx('yoshi-pound');
      if (!world.ctx.reduceFlashing) world.shake(2, 1);
      return;
    }
    p.activeMelee = feetBox(p);
    return;
  }
  // Landing recovery: no control (Player.root), then done.
  if ((p.scratch._poundT = (p.scratch._poundT ?? 1) - 1) <= 0) endPound(p);
}

function yoshiUpdate(p: Player, input: InputFrame, world: World): void {
  if (classicBusy(p)) {
    delete p.scratch._aim;
    return;
  }
  classicStartKit(p, START_KIT);
  ensureFx(p, world);
  if ((p.scratch._throw ?? 0) > 0) p.scratch._throw = (p.scratch._throw ?? 1) - 1;
  tongueTick(p, world, 'hero');
  const b = p.body;
  // The flutter's kicks (YO-8).
  if (p.flutterT > 0 && p.flutterT % 8 === 1) world.audio.sfx('yoshi-flutter');

  // Ground pound (YO-9).
  if (pound(p) > 0) return poundTick(p, world);
  if (!b.onGround && input.pressed('down') && !p.launched) {
    endTongue(p);
    return startPound(p, world);
  }

  // Swallow and lay (YO-19): rooted, then an egg.
  if (laying(p)) {
    p.root = Math.max(p.root, 1);
    if ((p.scratch._lay = (p.scratch._lay ?? 1) - 1) > 0) return;
    delete p.scratch._lay;
    const fill = mouthOf(p);
    clearMouth(p);
    if (fill) world.addScore(fill.score, b.x, b.y);
    if ((p.scratch.eggs ?? 0) < eggCap(p)) p.scratch.eggs = (p.scratch.eggs ?? 0) + 1;
    world.audio.sfx('yoshi-lay');
    return;
  }
  const fill = mouthOf(p);
  if (fill && b.onGround && input.held('down')) {
    p.scratch._lay = LAY_FRAMES;
    p.root = LAY_FRAMES;
    delete p.scratch._aim;
    world.audio.sfx('yoshi-swallow');
    return;
  }

  // Attack: the tongue, or spit what is in the mouth (YO-15, YO-20).
  if (input.pressed('attack') && !p.crouching) {
    if (fill) {
      clearMouth(p);
      world.addScore(fill.score, b.x, b.y);
      spit(p, world, fill);
      world.audio.sfx('kick');
    } else if (!tongueOut(p)) startTongue(p, input.held('up'), world);
  }

  // Special: hold to aim, let go to throw (YO-21). Nothing with a full mouth or no eggs.
  if (aiming(p)) {
    if (input.held('down') || fill) delete p.scratch._aim;
    else if (input.held('special')) p.scratch._aim = (p.scratch._aim ?? 0) + 1;
    else {
      const deg = aimAngle(p) ?? 0;
      delete p.scratch._aim;
      if (eggsOut(p, world) < EGG_CAP && spendAmmo(p, 'eggs', 1)) {
        throwEgg(p, world, deg);
        p.scratch._throw = THROW_FRAMES;
        world.audio.sfx('yoshi-throw');
      }
    }
  } else if (
    input.held('special') &&
    !fill &&
    !p.crouching &&
    hasAmmo(p, 'eggs', 1) &&
    eggsOut(p, world) < EGG_CAP
  ) {
    p.scratch._aim = 1;
  }
}

/** Yoshi's palette: green, red with the Flower, light blue for player two; Star cycles. */
function palette(p: Player, frame: number, reduceFlashing: boolean): string {
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  if (star !== null) return `yoshi-star-${star}`;
  if (p.powerState === 'fire') return 'yoshi-flower';
  return p.index > 0 ? 'yoshi-p2' : 'yoshi';
}

function frameName(p: Player, frame: number): string {
  if (p.dead) return 'die';
  if (p.anim === 'climb' || p.vine) return `climb-${(frame >> 3) & 1}`;
  const ph = pound(p);
  if (ph === 1 || ph === 2) return 'pound';
  if (laying(p)) return 'lay';
  if (p.hurtLock || p.stun > 0) return 'hurt';
  if ((p.scratch._throw ?? 0) > 0) return 'throw';
  if (tongueOut(p)) return 'tongue';
  if (mouthOf(p)) return 'full';
  if (p.flutterT > 0) return `flutter-${(frame >> 2) & 1}`;
  if (p.crouching) return 'crouch';
  if (!p.body.onGround) return 'jump';
  if (aiming(p)) return 'aim';
  if (p.anim === 'walk' || p.anim === 'skid') return `walk-${p.walkFrame % 3}`;
  return 'stand';
}

export function yoshiSprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const hb = YOSHI_CLASSIC.hitbox(p);
  return {
    sheet: 'yoshi',
    palette: palette(p, frame, reduceFlashing),
    frame: frameName(p, frame),
    flip: p.facing < 0,
    offsetX: 3,
    offsetY: 32 - hb.h,
  };
}

const BEHAVIOUR: CharacterBehaviour = {
  update: yoshiUpdate,
  onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
  contactDamage: () => null,
  onHurt: (p, world, fromDir) => {
    resetMoves(p);
    return classicOnHurt(p, world, fromDir, KIT);
  },
  meleeDamage: (p) => ({
    kind: 'sword',
    amount: POUND_DAMAGE,
    pierce: 10,
    owner: p,
    dirX: p.facing,
  }),
  // The pound's feet hit an enemy: he bounces off and the pound ends (YO-9).
  onMeleeHit: (p) => {
    if (pound(p) !== 2) return;
    endPound(p);
    p.refitHitbox();
    // A fixed 2.5 px/f bounce, as before BUG-07: a pound is no stomp, and only a stomp takes
    // SMB1's held bounce (owner).
    p.stompBounce(POUND_BOUNCE);
  },
  canJump: (p) => pound(p) === 0 && !laying(p),
  onGrabVine: (p) => resetMoves(p),
  onLevelClear: (p) => resetMoves(p),
  onRespawn: (p) => {
    resetMoves(p);
    classicRespawn(p, START_KIT);
  },
};

/** Touch captions (YO-27): TONGUE or SPIT, EGG while there are eggs. */
function touchLabels(p: Player): ReturnType<NonNullable<CharacterDef['touchLabels']>> {
  return {
    attack: mouthOf(p) ? 'SPIT' : 'TONGUE',
    special: hasAmmo(p, 'eggs', 1) ? 'EGG' : null,
    select: null,
  };
}

export const YOSHI_CLASSIC: CharacterDef = {
  // The original's level flags (G-010): not in 3.1.21: his flutter needs no helper pieces. level/layers.ts lays its pieces by them.
  levelFlags: {},
  id: 'yoshi',
  name: 'Yoshi',
  hudName: 'YOSHI',
  rules: 'classic',
  notInOriginal: true,
  // He never rides the Classic mount (YM-3).
  rides: false,
  movement: YOSHI_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: true,
  crouches: true,
  // His head bumps, never breaks (BR-C3); eggs and the pound break bricks.
  canBreakBricks: () => false,
  meleeStrikesBlocks: true,
  hitbox: (p) =>
    p.crouching ? { w: 12, h: 16 } : (p.scratch._pound ?? 0) === 2 ? { w: 12, h: 20 } : { w: 12, h: 24 },
  sprite: yoshiSprite,
  blockPowerUp: classicBlockPowerUp,
  powerIcon: true,
  hudAmmo: (p) => ({
    icon: p.powerState === 'fire' ? 'icon-egg-red' : 'icon-egg',
    sheet: 'yoshi',
    count: p.scratch.eggs ?? 0,
  }),
  jumpSfx: () => 'yoshi-jump',
  portrait: { sheet: 'yoshi', palette: 'yoshi', frame: 'stand' },
  behaviour: BEHAVIOUR,
  guide: YOSHI_CLASSIC_GUIDE,
  touchLabels,
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  // TG-44: one weapon (eggs); the full kit is the Flower with a full egg count.
  devKit: () => ({ eggs: EGGS_BIG }),
  // The shared Classic death (Mario's hop, PS-C23).
  deathHop: { freeze: 15, vy: 0x042ab, gravity: 0x002ab, maxFall: 0x04800, frames: 195, pitFrames: 180 },
  seaFloorSafe: true,
};
