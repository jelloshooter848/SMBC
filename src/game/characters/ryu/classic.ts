import type { InputFrame } from '@engine/input/input-manager';
import { RYU_SMBC_CANVAS } from '@content/sprites/smbc-ryu';
import { canvasOffsets } from '@content/sprites/smbc-anchor';
import type { AABB } from '@engine/math/aabb';
import { px, velToSub } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile, WallClimbProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import { moveX, moveY } from '../../entities/body';
import { Lift } from '../../entities/objects/lift';
import { Projectile } from '../../entities/projectiles/projectile';
import { CLASSIC_RYU_WALL_HOPS, CLASSIC_SWIM } from '../../rules/classic-swim';
import { cycleTool, toolIndex, type ToolInfo } from '../toolbelt';
import { RYU } from './index';
import { RYU_CLASSIC_GUIDE } from './classic-guide';
import {
  CLASSIC_HURT,
  CLASSIC_WALK_ANIM,
  RYU_FLIP_FRAMES,
  RYU_FLIP_TICKS,
  WALK_RYU,
  walkPose,
} from '../classic/anim';
import {
  CLASSIC_ARTS,
  CLASSIC_JUMP_SLASH_DAMAGE,
  CLASSIC_SWORD_DAMAGE,
  CLASSIC_THROW_SPAWN,
  WindmillShot,
  type ClassicArt,
} from './classic-weapons';
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
  classicStartKit,
  spendAmmo,
  type ClassicAmmo,
  type ClassicPowerKit,
} from '../classic/power';
import { weaponOf } from '../classic/options';

/**
 * Classic SMBC Ryu (2026-10-07-ryu-classic-smbc-rules.md, RY-C1..RY-C38). Constants from Ryu.as
 * and RyuProjectile.as (SMBC 3.1.21): Flash px/s ÷ 120 = px/f, px/s² ÷ 7200 = px/f², Flash px ÷ 2
 * = px. Velocities in 1/4096 px/f; our jump take-offs are the original's less one frame of
 * gravity, because the original adds gravity before it moves (RY-C7).
 *
 * Scratch keys (carried): `ninpo`, `scroll` (the Fire Flower's Scroll: maximum 200, kept after a
 * hit), `classicAll` and `tool` (the dev full kit and its selected art, TG-44). Transient (`_…`):
 * the slash, throw, Jump Slash and lift states.
 */

/** The arts the Customize Weapons defaults give (GameSettings.as 227-228; RY-C2). */
export const CLASSIC_MAIN_ART: ClassicArt['id'] = 'shuriken';
export const CLASSIC_EXTRA_ART: ClassicArt['id'] = 'windmill';

/** Ninpo at the start of a life, the maximum, with the Scroll, and the repeat Flower's gift (RY-C18, RY-C19). */
export const CLASSIC_START_NINPO = 25;
export const CLASSIC_NINPO_MAX = 99;
export const CLASSIC_SCROLL_MAX = 200;
export const CLASSIC_FLOWER_NINPO = 15;

/** A slash and a throw last 14 frames (225 ms); the press is frame 1 (RY-C25, RY-C34). */
export const CLASSIC_SLASH_FRAMES = 14;
export const CLASSIC_THROW_FRAMES = 14;
/** The frame countdown (14 at the press) on which the throw spawns: frame 3 (RY-C34). */
const SPAWN_AT = CLASSIC_THROW_FRAMES - 2;
/** The sword's live frames 3-8 as countdown values (RY-C25). */
const LIVE_FROM = CLASSIC_SLASH_FRAMES - 2;
const LIVE_TO = CLASSIC_SLASH_FRAMES - 7;

/** Haggle Man's look on Ryu's slot (G-052, ryu/classic-haggleman.ts). */
export const HAGGLEMAN_ID = 'haggleman';
/**
 * The sword's live frames (countdown values, from and to): Ryu's frames 3-8, or Haggle Man's one
 * 45 ms animation step sooner (Ryu.as attackFramesHaggleManArr: attackStart and attack-2 in place
 * of attack-2 and attack-3), frames 1-5.
 */
export function slashLive(p: Player): readonly [number, number] {
  return p.def.id === HAGGLEMAN_ID ? [CLASSIC_SLASH_FRAMES, CLASSIC_SLASH_FRAMES - 4] : [LIVE_FROM, LIVE_TO];
}

/** Ryu's walk: 185 px/s, at once (RY-C4). */
export const CLASSIC_WALK = 0x018ab;

/** The wall climb (RY-C10..RY-C12): Ryu.as CLIMB_SPEED 120, CLIMB_TOP_OFS 20, CLIMB_BOT_OFS 25. */
export const RYU_WALL_CLIMB: WallClimbProfile = {
  speed: 0x01000,
  topProbe: 10,
  bottomProbe: 12.5,
  bottomSlack: 5,
  topJump: 5, // CLIMB_TOP_JUMP_OFS -10
  hopLow: CLASSIC_RYU_WALL_HOPS.low, // 300 px/s: about 15 px
  hopHigh: CLASSIC_RYU_WALL_HOPS.high, // 430 px/s: about 31 px
  regrab: 15, // CANCEL_GRAPPLE_TMR 250 ms
};

/** Ryu's Classic movement (RY-C4..RY-C7, RY-C17). */
export const RYU_CLASSIC_PROFILE: MovementProfile = {
  minWalk: CLASSIC_WALK,
  walkAccel: CLASSIC_WALK,
  runAccel: CLASSIC_WALK,
  releaseDecel: CLASSIC_WALK,
  skidDecel: CLASSIC_WALK,
  maxWalk: CLASSIC_WALK,
  maxRun: CLASSIC_WALK,
  skidTurnaround: CLASSIC_WALK,
  // 565 px/s less one frame of 1400 px/s²: apex about 55 px.
  jump: [{ maxVx: Infinity, initial: 0x04839, holdGravity: 0x0031c, fallGravity: 0x0031c }],
  maxFall: 0x05d55, // 700 px/s, a clamp
  fallReset: 0x05d55,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  swim: CLASSIC_SWIM.ryu,
  airStop: true,
  wallClimb: RYU_WALL_CLIMB,
};

/** The Scroll raises the maximum to 200 (RY-C18). */
export function classicNinpoMax(p: Player): number {
  return p.scratch.scroll ? CLASSIC_SCROLL_MAX : CLASSIC_NINPO_MAX;
}
const ninpo = (p: Player) => p.scratch.ninpo ?? 0;
const art = (id: ClassicArt['id']) => CLASSIC_ARTS.find((a) => a.id === id) as ClassicArt;
const fullKit = (p: Player) => (p.scratch.classicAll ?? 0) > 0;

function tools(p: Player): ToolInfo[] {
  if (!fullKit(p)) return [];
  return CLASSIC_ARTS.map((a) => ({ id: a.id, icon: a.icon, count: ninpo(p), usable: ninpo(p) >= a.cost }));
}

/** The main art (Special, Attack on a wall): the default, or the full kit's selected one. */
export function classicMainArt(p: Player): ClassicArt {
  if (fullKit(p)) return CLASSIC_ARTS[toolIndex(p, tools(p))] as ClassicArt;
  // Customize Weapons > Ryu start (FU-7c): CLASSIC_MAIN_ART by default.
  return art(weaponOf(p, 'ryuStart'));
}
/**
 * The extra art on Select: only with the Fire Flower, and not with the full kit (Select cycles).
 * Customize Weapons > Ryu extra (FU-7c): CLASSIC_EXTRA_ART by default.
 */
function extraArt(p: Player): ClassicArt | null {
  return p.powerState === 'fire' && !fullKit(p) ? art(weaponOf(p, 'ryuExtra')) : null;
}

const NINPO_AMMO: ClassicAmmo = { key: 'ninpo', max: classicNinpoMax };
const START = { ninpo: CLASSIC_START_NINPO };

const RYU_HIT = CLASSIC_HIT_RESPONSES.ryu as Extract<ClassicPowerKit['response'], { kind: 'push' }>;

/** Ryu's power row (RY-C18..RY-C22): a push until landing, the Scroll kept after a hit. */
export const RYU_CLASSIC_KIT: ClassicPowerKit = {
  // The shared row (PS-C10), with vy as our take-off: RY-C22 gives 385 px/s = 0x03355 and says
  // "our initial 0x03039, RY-C7" (Ryu.as 1267-1291: the original adds gravity before it moves,
  // ours after, so one frame of 0x0031C comes off as for every other launch of his body).
  response: { ...RYU_HIT, vy: 0x03355 - 0x0031c },
  gainFire: (p) => {
    p.scratch.scroll = 1;
  },
  repeat: { ...NINPO_AMMO, add: CLASSIC_FLOWER_NINPO },
};

/* ---------- the sword ---------- */

/** The sword's reach (RY-C25): x ahead of his centre, y above his feet, in px. */
export const CLASSIC_SWORD_REACH = {
  // The standing box's bottom edge is our sword's 13 px, not the original's 18.5 (Open question 6).
  stand: { x0: 8, x1: 32, y0: 13, y1: 25 },
  standLong: { x0: 8, x1: 45.5, y0: 9, y1: 25 },
  crouch: { x0: 8, x1: 32, y0: 11.5, y1: 19 },
  crouchLong: { x0: 8, x1: 47.5, y0: 3, y1: 19 },
} as const;

function swordBox(p: Player): AABB {
  const long = p.powerState !== 'small';
  const r = p.crouching
    ? long
      ? CLASSIC_SWORD_REACH.crouchLong
      : CLASSIC_SWORD_REACH.crouch
    : long
      ? CLASSIC_SWORD_REACH.standLong
      : CLASSIC_SWORD_REACH.stand;
  const cx = p.centerX;
  const x = p.facing > 0 ? cx + px(r.x0) : cx - px(r.x1);
  return { x, y: p.feetY - px(r.y1), w: px(r.x1 - r.x0), h: px(r.y1 - r.y0) };
}

/** The Jump Slash's box: his body, and 1 px past its sides and top (bricks touched, RY-C31). */
function spinBox(p: Player): AABB {
  const b = p.body;
  return { x: b.x - px(1), y: b.y - px(1), w: b.w + px(2), h: b.h + px(1) };
}

/* ---------- throws ---------- */

/** Starts a throw of `a` (RY-C32): refused by the one-per-type limit with no pose at all. */
function startThrow(p: Player, a: ClassicArt, world: World): void {
  if (!a.spec || world.countProjectiles(p, a.spec.kind) > 0) return;
  const s = p.scratch;
  s._throwT = CLASSIC_THROW_FRAMES;
  s._throwArt = CLASSIC_ARTS.indexOf(a);
  s._throwMode = p.wall ? 3 : p.body.onGround ? 1 : 2;
  if (s._throwMode === 1) p.body.vx = 0;
}

function endThrow(p: Player): void {
  p.scratch._throwT = 0;
  p.root = 0;
}

/** The throw's spawn frame (RY-C27, RY-C32, RY-C14): the limit again, then the ninpo. */
function spawnThrow(p: Player, input: InputFrame, world: World): void {
  const a = CLASSIC_ARTS[p.scratch._throwArt ?? 0] as ClassicArt;
  const spec = a.spec;
  if (!spec || world.countProjectiles(p, spec.kind) > 0) return;
  if (!spendAmmo(p, 'ninpo', a.cost)) return;
  let dir = p.facing;
  let at: { ahead: number; up: number };
  if (p.wall) {
    const away = input.dirX === -p.wall.dir;
    dir = away ? (-p.wall.dir as -1 | 1) : p.wall.dir;
    at = away ? CLASSIC_THROW_SPAWN.wallAway : CLASSIC_THROW_SPAWN.wallInto;
  } else if (!p.body.onGround) at = CLASSIC_THROW_SPAWN.air;
  else at = p.crouching ? CLASSIC_THROW_SPAWN.crouch : CLASSIC_THROW_SPAWN.stand;
  const cx = p.centerX + dir * px(at.ahead);
  const cy = p.feetY - px(at.up);
  const x = cx - px(spec.w >> 1);
  const y = cy - px(spec.h >> 1);
  if (a.id === 'windmill') world.spawn(new WindmillShot(x, y, dir, p));
  else world.spawn(new Projectile(x, y, dir, spec, p));
  world.audio.sfx(a.id === 'windmill' ? 'boomerang' : a.id === 'shuriken' ? 'buster' : 'magic');
}

/** Special or Select with art `a` (RY-C1): a throw, or the Jump Slash in the air. */
function useArt(p: Player, a: ClassicArt, world: World): void {
  if (a.spec) return startThrow(p, a, world);
  // The Jump Slash (RY-C31): airborne only, never on a wall, needs its ninpo first.
  if (p.body.onGround || p.wall || p.scratch._jslash) return;
  if (!spendAmmo(p, 'ninpo', a.cost)) return;
  p.scratch._jslash = 1;
  world.audio.sfx('sword');
}

/* ---------- lifts (RY-C15) ---------- */

/** He lets go when the lift's side or centre is more than this far from where he should be. */
const LIFT_MAX_DIST = 15;

function liftById(world: World, id: number): Lift | null {
  for (const e of world.entities) if (e instanceof Lift && e.alive && e.id === id) return e;
  return null;
}

/** Where he hangs on lift `l`'s side `dir`: flush, his centre on its centre. */
function liftSpot(p: Player, l: Lift, dir: -1 | 1): { x: number; y: number } {
  const b = p.body;
  const lb = l.body;
  return {
    x: dir > 0 ? lb.x - b.w : lb.x + lb.w,
    y: lb.y + (lb.h >> 1) - (b.h >> 1),
  };
}

/** Grabs the side of a lift he is pressing into (RY-C15). */
function grabLift(p: Player, dir: -1 | 0 | 1, world: World): void {
  if (dir === 0 || p.wallLock?.lift) return;
  const b = p.body;
  const step = Math.abs(velToSub(b.vx)) + px(1);
  for (const e of world.entities) {
    if (!(e instanceof Lift) || !e.alive) continue;
    const lb = e.body;
    if (b.y >= lb.y + lb.h || b.y + b.h <= lb.y) continue;
    const gap = dir > 0 ? lb.x - (b.x + b.w) : b.x - (lb.x + lb.w);
    if (gap > px(1) || gap < -step) continue;
    const at = liftSpot(p, e, dir);
    b.x = at.x;
    b.y = at.y;
    p.holdWall(dir, true);
    p.scratch._liftId = e.id;
    world.audio.sfx(p.def.jumpSfx(p));
    return;
  }
}

/** Keeps him on the lift's side; lets go when it is gone, too far, or a ceiling stops him. */
function rideLift(p: Player, world: World): void {
  const wall = p.wall as NonNullable<Player['wall']>;
  const l = liftById(world, p.scratch._liftId ?? -1);
  if (!l) {
    p.wall = null;
    return;
  }
  const b = p.body;
  const at = liftSpot(p, l, wall.dir);
  moveX(b, world.map, at.x - b.x);
  moveY(b, world.map, at.y - b.y);
  b.onGround = false;
  const far = Math.abs(b.x - at.x) > px(LIFT_MAX_DIST) || Math.abs(b.y - at.y) > px(LIFT_MAX_DIST);
  if (far || b.hitHead) p.wall = null;
}

/* ---------- behaviour ---------- */

function endAttacks(p: Player): void {
  p.attackTimer = 0;
  p.activeMelee = null;
  p.scratch._jslash = 0;
  endThrow(p);
}

/** An upward kick this frame bigger than this (velocity units) starts the flip. */
const FLIP_KICK = 0x01000;

/**
 * The flip (F2; Ryu.as startFlip from jump 857, the wall jump 839, an enemy bounce 1095 and a
 * spring 1299; FLIP_TMR 400 ms): every take-off that throws him up flips him for 24 frames, then
 * he falls upright. A new upward kick this frame is such a take-off; walking off a ledge is not.
 */
function trackFlip(p: Player): void {
  const b = p.body;
  const s = p.scratch;
  const lastVy = s._vy ?? 0;
  s._vy = b.vy;
  if (b.onGround || p.wall || p.inWater) {
    s._flipT = 0;
    return;
  }
  if ((s._flipT ?? 0) > 0) s._flipT = (s._flipT ?? 0) - 1;
  if (b.vy < 0 && b.vy < lastVy - FLIP_KICK && p.stun === 0 && !p.hurtLock) s._flipT = RYU_FLIP_FRAMES;
}

/** The flip's 5 frames at 33 ms: the tuck, then a whole turn of the spin. */
const FLIP_POSES = ['jump', 'spin-1', 'spin-2', 'spin-3', 'spin-0'] as const;
/** His pose in the air (F2): a flip frame while the flip lasts, else the upright `fall`. */
export function ryuAirPose(p: Player): string {
  const t = p.scratch._flipT ?? 0;
  if (p.inWater) return 'jump';
  if (t <= 0) return 'fall';
  const i = Math.floor((RYU_FLIP_FRAMES - t) / RYU_FLIP_TICKS) % FLIP_POSES.length;
  return FLIP_POSES[i] as string;
}

function update(p: Player, input: InputFrame, world: World): void {
  classicStartKit(p, START);
  const b = p.body;
  const s = p.scratch;
  const wasAir = s._air === 1;
  s._air = b.onGround ? 0 : 1;
  trackFlip(p);
  if (classicBusy(p)) return endAttacks(p);

  // Lifts: hold on to the one he is on, or grab one he presses into.
  if (p.wall?.lift) rideLift(p, world);
  else if (!p.wall && wasAir && !b.onGround && p.stun === 0) grabLift(p, input.dirX, world);

  // What landing, leaving the ground or a wall grab ends (RY-C1, RY-C10, RY-C31).
  if (s._jslash && (b.onGround || p.wall)) s._jslash = 0;
  if (p.attackTimer > 0) {
    const ends = s._slashAir ? b.onGround || p.wall !== null : !b.onGround;
    if (ends) {
      p.attackTimer = 0;
      p.root = 0;
    }
  }
  if ((s._throwT ?? 0) > 0) {
    const mode = s._throwMode ?? 1;
    const ends = mode === 1 ? !b.onGround : mode === 2 ? b.onGround : p.wall === null;
    if (ends) endThrow(p);
  }

  // A throw counts down and spawns on its third frame (RY-C34).
  if ((s._throwT ?? 0) > 0) {
    s._throwT = (s._throwT ?? 0) - 1;
    if (s._throwT === SPAWN_AT) spawnThrow(p, input, world);
  }

  // Buttons (RY-C1): nothing during a slash or a throw; no slash during the Jump Slash.
  const slashing = p.attackTimer > 0;
  const throwing = (s._throwT ?? 0) > 0;
  if (fullKit(p)) cycleTool(p, input, tools(p), world);
  if (!slashing && !throwing) {
    if (input.pressed('attack') && p.wall) startThrow(p, classicMainArt(p), world);
    else if (input.pressed('attack') && !s._jslash) {
      p.attackTimer = CLASSIC_SLASH_FRAMES;
      s._slashAir = b.onGround ? 0 : 1;
      if (b.onGround) b.vx = 0;
      world.audio.sfx('sword');
    } else if (input.pressed('special')) useArt(p, classicMainArt(p), world);
    else if (input.pressed('select')) {
      const extra = extraArt(p);
      if (extra) useArt(p, extra, world);
    }
  }
  // A ground slash or throw holds him still, a wall throw holds him on the wall (RY-C5, RY-C14):
  // the frames after this one that are still part of it.
  let hold = 0;
  if (p.attackTimer > 0 && !s._slashAir) hold = p.attackTimer - 1;
  if ((s._throwT ?? 0) > 0 && s._throwMode !== 2) hold = Math.max(hold, (s._throwT ?? 0) - 1);
  p.root = hold;

  // The published melee box: the Jump Slash's body, or the sword's live frames.
  const t = p.attackTimer;
  const [from, to] = slashLive(p);
  if (s._jslash) p.activeMelee = spinBox(p);
  else if (t > 0 && t <= from && t >= to) p.activeMelee = swordBox(p);
  else p.activeMelee = null;
}

function meleeDamage(p: Player, _e: unknown): DamageSource {
  const base = { owner: p, dirX: p.facing } as const;
  if (p.scratch._jslash) {
    // A Jump Slash with the Star is the plain Star kill (RY-C23).
    if (p.star > 0) return { ...base, kind: 'star', amount: 1 };
    return { ...base, kind: 'sword', amount: CLASSIC_JUMP_SLASH_DAMAGE, pierce: 0, blockedSfx: 'armour' };
  }
  return { ...base, kind: 'sword', amount: CLASSIC_SWORD_DAMAGE, pierce: 0, blockedSfx: 'armour' };
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  const palette = star === null ? 'ryu' : `ryu-star-${star}`;
  const b = p.body;
  const t = p.attackTimer;
  // R1: every pose from his Classic sheet at the original sizes (smbc-ryu.ts).
  let name: string;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if (p.scratch._jslash) name = `jslash-${(frame >> 1) & 3}`;
  else if ((p.scratch._throwT ?? 0) > 0) name = p.wall ? 'cling-throw' : 'throw';
  else if (p.wall) name = 'cling';
  // On a vine or the flagpole: the pole climb (climbPoleStart / climbPole-2), 115 ms a pose.
  else if (p.anim === 'climb') name = `climb-${Math.floor(frame / RYU_CLIMB_TICKS) & 1}`;
  else if (t > 0 && t <= slashLive(p)[0] && t >= slashLive(p)[1] && p.powerState !== 'small') {
    // The Sword Extension's wave on the hit frames (RY-C25); Reduce flashing holds its shimmer.
    const shimmer = reduceFlashing ? 0 : (frame >> 1) & 1;
    name = `${p.crouching ? 'crouch-slash-wave' : 'slash-wave'}-${shimmer}`;
  } else if (t > 0) {
    const windUp = t > slashLive(p)[0];
    name = p.crouching ? (windUp ? 'crouch-slash-0' : 'crouch-slash') : windUp ? 'slash-0' : 'slash-1';
  } else if (p.crouching) name = 'crouch';
  else if (!b.onGround) name = ryuAirPose(p);
  else if (p.anim === 'walk') name = `walk-${walkPose(p, WALK_RYU)}`;
  // standStart..standEnd at ANIM_SLOWEST 130 ms: the breath held on the middle three.
  else name = Math.floor(frame / RYU_BREATH_TICKS) % 5 >= 2 ? 'idle-1' : 'idle';
  const box = RYU_CLASSIC.hitbox(p);
  return {
    sheet: 'ryu-classic',
    palette,
    frame: name,
    flip: p.facing < 0,
    ...canvasOffsets(RYU_SMBC_CANVAS, box.w, box.h),
  };
}

/** The pole climb's 115 ms per pose (ANIM_VERY_SLOW): 6.9 game frames. */
const RYU_CLIMB_TICKS = 6.9;

/** The idle's 130 ms per frame (ANIM_SLOWEST, Ryu.as): 7.8 game frames. */
const RYU_BREATH_TICKS = 7.8;

export const RYU_CLASSIC: CharacterDef = {
  // The castle text's name (PM-M8): the original's default skin (BmdInfo.as).
  rescueName: 'Irene',
  ...RYU,
  rules: 'classic',
  // R1: the select screen and the intro card show his Classic art.
  portraitArt: { sheet: 'ryu-classic', palette: 'ryu', frame: 'portrait' },
  movement: RYU_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  // His head only bumps (RY-C35); not at all on a wall or in the Jump Slash.
  canBreakBricks: () => false,
  headBumps: (p) => p.wall === null && !p.scratch._jslash,
  meleeStrikesBlocks: true,
  // Ryu does not grow (RY-C18): Current's 12 x 24 body, 12 x 16 crouched.
  hitbox: (p) => (p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  // F2: the original's HRect (27 standing, 25 in the air, 15.75 crouched) and run (4 poses x 75 ms, R1).
  hurtbox: (p) => ({
    w: CLASSIC_HURT.w,
    h: p.crouching
      ? CLASSIC_HURT.ryu.crouch
      : p.body.onGround
        ? CLASSIC_HURT.ryu.stand
        : CLASSIC_HURT.ryu.air,
  }),
  walkAnim: CLASSIC_WALK_ANIM.ryu,
  sprite,
  blockPowerUp: classicBlockPowerUp,
  powerIcon: true,
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, RYU_CLASSIC_KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, CLASSIC_DROPS.ryu, 'enemy') : null),
  blockDrop: (rng, p, source) => classicDrop(rng, p, CLASSIC_DROPS.ryu, source),
  hudAmmo: (p) => (fullKit(p) ? null : { icon: 'ninpo-small', count: ninpo(p) }),
  tools,
  // TG-44: Mushroom and Flower (main.ts sets the power), the Scroll, 200 ninpo and every art.
  devKit: () => ({ classicAll: 1, scroll: 1, ninpo: CLASSIC_SCROLL_MAX }),
  guide: RYU_CLASSIC_GUIDE,
  touchLabels(p) {
    const extra = extraArt(p);
    return {
      attack: 'SLASH',
      special: classicMainArt(p).label,
      select: fullKit(p) ? 'NINPO' : extra ? extra.label : null,
    };
  },
  behaviour: {
    update,
    meleeDamage,
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, RYU_CLASSIC_KIT),
    contactDamage: () => null,
    onHurt: (p, world, fromDir) => {
      const r = classicOnHurt(p, world, fromDir, RYU_CLASSIC_KIT);
      if (r === 'hurt') {
        endAttacks(p);
        p.wall = null;
      }
      return r;
    },
    onPickup: (p, kind, world) =>
      classicPickup(p, kind, world, { 'ninpo-small': NINPO_AMMO, 'ninpo-large': NINPO_AMMO }),
    onRespawn: (p) => classicRespawn(p, START),
    onGrabVine: (p) => {
      endAttacks(p);
      p.wall = null;
    },
  },
};
// A Classic def leaves out the Current HUD extras (TG-22).
delete RYU_CLASSIC.meter;
delete RYU_CLASSIC.hudExtra;
delete RYU_CLASSIC.reserve;
delete RYU_CLASSIC.startHp;
