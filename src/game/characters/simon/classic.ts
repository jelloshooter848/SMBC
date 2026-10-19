import { px } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { PickupKind } from '../../entities/objects/pickup';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { beltButton, toolButton } from '../../touch-labels';
import {
  CLASSIC_DROPS,
  CLASSIC_PUSH_INVULN,
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
  hasAmmo,
  spendAmmo,
  type ClassicAmmo,
  type ClassicPowerKit,
} from '../classic/power';
import { SIMON, SIMON_TOOL_LABELS } from './index';
import { SIMON_CLASSIC_GUIDE } from './classic-guide';
import { startStopwatch, stopwatchRunning } from '../classic/freeze';
import {
  ACTION_FRAMES,
  AXE_CLASSIC,
  ClassicCross,
  CROSS_CLASSIC,
  DAGGER_CLASSIC,
  HIT_FREEZE,
  HolyWaterBottle,
  HOLY_WATER_CLASSIC,
  SHOT_CAP,
  SIMON_SHOT_KINDS,
  STOPWATCH_COST,
  STOPWATCH_FRAMES,
  THROW_AHEAD,
  THROW_AT,
  THROW_UP,
  THROW_UP_CROUCH,
  WHIP_DAMAGE,
  WHIP_LIVE_FROM,
  WHIP_NEAR,
  WHIP_REACH,
  WHIP_Y,
} from './classic-weapons';

/**
 * Classic SMBC Simon (bug-reports/2026-10-07-simon-classic-smbc-rules.md, SI-C1..SI-C32): the
 * original's default Simon (Classic power-ups, Lose Everything, start weapon Axe, extra weapon
 * Cross, Classic Special Input off). Constants from Simon.as (SMBC 3.1.21); velocities in 1/4096
 * px/f. Take-offs are the original's less one frame of gravity, because our player moves before
 * gravity and the original adds it first (SI-C5).
 */

/** Walk 150 px/s: 1.25 px/f, instant start and stop (SI-C3). */
const WALK = 0x01400;

export const SIMON_CLASSIC_PROFILE: MovementProfile = {
  // Instant speed: the ramp fields are never read with instantAccel.
  minWalk: WALK,
  walkAccel: WALK,
  runAccel: WALK,
  releaseDecel: WALK,
  skidDecel: WALK,
  skidTurnaround: WALK,
  maxWalk: WALK,
  maxRun: WALK,
  // jumpPwr 565 (4.708 px/f) less one frame of gravity 1500 (0.2083 px/f²); a fixed arc (SI-C5).
  jump: [{ maxVx: Infinity, initial: 0x04800, holdGravity: 0x00355, fallGravity: 0x00355 }],
  // vyMaxPsv 2000: 16.67 px/f, a clamp.
  maxFall: 0x10aab,
  fallReset: 0x10aab,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  // One air jump, the ground jump's strength again (SI-C7).
  airJumps: 1,
  swim: CLASSIC_SWIM.simon,
  turnInAir: false,
  jumpBuffer: false,
  airStop: true,
};

/** Hearts: 10 at the start of a life, 99 at most (SI-C11). */
export const START_HEARTS = 10;
export const MAX_HEARTS = 99;
const START_KIT = { hearts: START_HEARTS } as const;
const HEARTS: ClassicAmmo = { key: 'hearts', max: MAX_HEARTS };

/** A sub-weapon (SI-C21..SI-C25). `spec` null: the Stopwatch, which acts on the press. */
export interface ClassicSubWeapon {
  id: string;
  name: string;
  icon: string;
  cost: number;
  spec: ProjectileSpec | null;
}

export const CLASSIC_SUB_WEAPONS: readonly ClassicSubWeapon[] = [
  { id: 'hand-axe', name: 'Axe', icon: 'icon-axe', cost: 1, spec: AXE_CLASSIC },
  { id: 'cross', name: 'Cross', icon: 'icon-cross', cost: 2, spec: CROSS_CLASSIC },
  { id: 'dagger', name: 'Dagger', icon: 'icon-dagger', cost: 1, spec: DAGGER_CLASSIC },
  { id: 'holy-water', name: 'Holy Water', icon: 'icon-holy-water', cost: 1, spec: HOLY_WATER_CLASSIC },
  { id: 'stopwatch', name: 'Stopwatch', icon: 'icon-watch', cost: STOPWATCH_COST, spec: null },
];
/** The Customize Weapons defaults (SI-C26): C throws the start weapon, Select the extra one. */
export const START_WEAPON = 'hand-axe';
export const EXTRA_WEAPON = 'cross';
const weaponById = (id: string) => CLASSIC_SUB_WEAPONS.find((w) => w.id === id) as ClassicSubWeapon;

/** The dev `&kit=full` key (TG-44): all five sub-weapons, Select picks C's. */
const FULL_KIT = 'classicAll';
const fullKit = (p: Player) => (p.scratch[FULL_KIT] ?? 0) > 0;

function tools(p: Player): ToolInfo[] {
  if (!fullKit(p)) return [];
  const h = p.scratch.hearts ?? 0;
  return CLASSIC_SUB_WEAPONS.map((w) => ({
    id: w.id,
    icon: w.icon,
    count: h,
    usable: p.star > 0 || h >= w.cost,
  }));
}

/** The weapon C uses: the start weapon, or with the full kit the one Select picked. */
function specialWeapon(p: Player): ClassicSubWeapon {
  if (!fullKit(p)) return weaponById(START_WEAPON);
  return weaponById(activeTool(p, tools(p))?.id ?? START_WEAPON);
}

/*
 * Transient scratch (`_` keys are not carried to the next level): `_act` 1 whip / 2 throw, `_af`
 * frames since the press, `_ac` a whip started crouching, `_aw` the thrown weapon's index, `_g`
 * on the ground last frame, `_aj` air jumps left last frame, `_ln` spring-launched last frame.
 */
const WHIP = 1;
const THROW = 2;

function endAction(p: Player): void {
  p.scratch._act = 0;
  p.scratch._af = 0;
  p.attackTimer = 0;
  p.activeMelee = null;
}

/** Every enemy and enemy projectile in the level stops for 180 f; Lakitu resists (SI-C25; classic/freeze.ts). */
function stopwatch(p: Player, world: World): void {
  if (stopwatchRunning(world)) return;
  if (!spendAmmo(p, 'hearts', STOPWATCH_COST)) return;
  startStopwatch(world, STOPWATCH_FRAMES);
}

/** This player's sub-weapons on screen (bottles and flames too), for the shot cap (SI-C19). */
function shotsOut(p: Player, world: World): number {
  let n = 0;
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.owner === p && SIMON_SHOT_KINDS.has(e.kind)) n++;
  return n;
}
const capOf = (p: Player) => SHOT_CAP[p.powerState] ?? 1;

/** C or Select: start a throw if it is affordable and the cap allows (SI-C18); the Stopwatch acts now. */
function startThrow(p: Player, w: ClassicSubWeapon, world: World): void {
  if (!w.spec) return stopwatch(p, world);
  if (!hasAmmo(p, 'hearts', w.cost) || shotsOut(p, world) >= capOf(p)) return;
  p.scratch._act = THROW;
  p.scratch._af = 0;
  p.scratch._aw = CLASSIC_SUB_WEAPONS.indexOf(w);
}

/** Frame 14 of a throw: the weapon appears if the hearts and the cap still allow (SI-C18, SI-C20). */
function release(p: Player, world: World): void {
  const w = CLASSIC_SUB_WEAPONS[p.scratch._aw ?? 0];
  const s = w?.spec;
  if (!w || !s) return;
  if (!hasAmmo(p, 'hearts', w.cost) || shotsOut(p, world) >= capOf(p)) return;
  spendAmmo(p, 'hearts', w.cost);
  const cx = p.centerX + p.facing * px(THROW_AHEAD);
  const cy = p.feetY - px(p.crouching ? THROW_UP_CROUCH : THROW_UP);
  const x = cx - px(s.w >> 1);
  const y = cy - px(s.h >> 1);
  const shot =
    s === CROSS_CLASSIC
      ? new ClassicCross(x, y, p.facing, p)
      : s === HOLY_WATER_CLASSIC
        ? new HolyWaterBottle(x, y, p.facing, p)
        : new Projectile(x, y, p.facing, s, p);
  world.spawn(shot);
  world.audio.sfx(w.id === 'dagger' ? 'buster' : 'boomerang');
}

/** The whip box this frame (SI-C15): from his centre and feet, mirrored when facing left. */
function whipBox(p: Player) {
  const [top, bottom] = p.scratch._ac ? WHIP_Y.crouch : WHIP_Y.stand;
  const near = px(WHIP_NEAR);
  const far = px(WHIP_REACH[p.powerState] ?? 36);
  const w = far - near;
  const x = p.facing > 0 ? p.centerX + near : p.centerX - far;
  return { x, y: p.feetY - px(top), w, h: px(top - bottom) };
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  const palette = star === null ? 'simon' : `simon-star-${star}`;
  const act = p.scratch._act ?? 0;
  const t = p.scratch._af ?? 0;
  let name: string;
  let sheet = 'simon';
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt' || p.hurtLock) name = 'hurt';
  else if (act === THROW) name = p.crouching ? 'crouch' : 'throw';
  else if (act === WHIP) {
    // Whip hangs behind, waves, then strikes; the art closest to each reach.
    if (t < 7) name = 'whip-0';
    else if (t < WHIP_LIVE_FROM) name = 'whip-1';
    else if (p.powerState === 'fire') {
      // The Flame Whip's own 64-wide strike, reaching its full 51 px (sprites/simon-flame.ts).
      sheet = 'simon-flame';
      name = p.scratch._ac ? 'crouch-whip-flame' : 'whip-flame';
    } else name = (p.scratch._ac ? 'crouch-' : '') + (p.powerState === 'small' ? 'whip-chain' : 'whip-star');
  } else if (p.crouching) name = 'crouch';
  else if (p.anim === 'swim') name = `swim-${(frame >> 3) & 1}`;
  else if (!p.body.onGround) name = 'jump';
  else if (p.anim === 'walk' || p.anim === 'skid') name = `walk-${p.walkFrame}`;
  else name = 'idle';
  return {
    sheet,
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.crouching ? 16 : 8,
  };
}

const KIT: ClassicPowerKit = {
  // PS-C10 Simon's push, with the hop's take-off less one frame of gravity (0x02800 - 0x355, SI-C13).
  response: {
    kind: 'push',
    vx: 0x01400,
    from: 'source',
    vy: 0x024ab,
    faceSource: true,
    lock: { untilLand: true },
    invuln: CLASSIC_PUSH_INVULN,
    look: { alpha: true, from: 'land' },
  },
  // A Fire Flower in the Fire Flower state: +5 hearts (SI-C12).
  repeat: { ...HEARTS, add: 5 },
};

const PICKUPS: Partial<Record<PickupKind, ClassicAmmo>> = { 'heart-small': HEARTS, 'heart-large': HEARTS };

/**
 * CharacterBehaviour.rooted (SI-C4, 'canJump'): runs before movement, so it also roots him on the press
 * frame of a whip or throw (frame 0) and lets him go on frame 21. A jump frees him.
 */
function rooted(p: Player, input: InputFrame): boolean {
  if (input.pressed('jump') || classicBusy(p)) return false;
  const s = p.scratch;
  if (s._act) return (s._af ?? 0) + 1 < ACTION_FRAMES;
  if (input.pressed('attack')) return true;
  // A throw roots him only if it starts (affordable, under the cap: startThrow's own test).
  const starts = (w: ClassicSubWeapon) => {
    const world = worlds.get(p);
    return w.spec !== null && hasAmmo(p, 'hearts', w.cost) && (!world || shotsOut(p, world) < capOf(p));
  };
  if (input.pressed('special')) return starts(specialWeapon(p));
  if (input.pressed('select') && !fullKit(p) && p.powerState === 'fire')
    return starts(weaponById(EXTRA_WEAPON));
  return false;
}

/** The world each player last updated in (rooted runs in Player.update, which has none). */
const worlds = new WeakMap<Player, World>();

/** Remembers this frame's ground, air-jump and spring state, to see next frame's jumps. */
function remember(p: Player): void {
  p.scratch._g = p.body.onGround ? 1 : 0;
  p.scratch._aj = p.airJumpsLeft;
  p.scratch._ln = p.launched ? 1 : 0;
}

export const SIMON_CLASSIC: CharacterDef = {
  ...SIMON,
  rules: 'classic',
  movement: SIMON_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  // His head only bumps (SI-C27); the whip strikes the blocks it overlaps.
  canBreakBricks: () => false,
  meleeStrikesBlocks: true,
  sprite,
  blockPowerUp: classicBlockPowerUp,
  // No size change, so the HUD shows the Mushroom or Fire Flower (PS-C26).
  powerIcon: true,
  guide: SIMON_CLASSIC_GUIDE,
  tools,
  devKit: () => ({ [FULL_KIT]: 1, hearts: MAX_HEARTS }),
  drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, CLASSIC_DROPS.simon, 'enemy') : null),
  blockDrop: (rng, p, source) => classicDrop(rng, p, CLASSIC_DROPS.simon, source),
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  hudAmmo: (p) => (fullKit(p) ? null : { icon: 'heart-small', count: p.scratch.hearts ?? 0 }),
  touchLabels(p) {
    if (fullKit(p)) {
      const belt = tools(p);
      return {
        attack: 'WHIP',
        special: toolButton(belt, p, SIMON_TOOL_LABELS),
        select: beltButton(belt, 'TOOLS'),
      };
    }
    const extra = weaponById(EXTRA_WEAPON);
    return {
      attack: 'WHIP',
      special: hasAmmo(p, 'hearts', weaponById(START_WEAPON).cost) ? 'AXE' : null,
      select: p.powerState === 'fire' && hasAmmo(p, 'hearts', extra.cost) ? 'CROSS' : null,
    };
  },
  behaviour: {
    update(p, input, world) {
      classicStartKit(p, START_KIT);
      worlds.set(p, world);
      const s = p.scratch;
      const b = p.body;
      if (classicBusy(p)) {
        endAction(p);
        remember(p);
        return;
      }
      // A jump this frame: from the ground, in the air, or off a spring. He turns to the
      // direction held (SI-C2, SI-C29), and a jump ends a whip or throw (SI-C7, SI-C14).
      const groundJump = s._g === 1 && !b.onGround && b.vy < 0 && input.pressed('jump');
      const airJump = !b.onGround && p.airJumpsLeft < (s._aj ?? 0);
      const springOff = p.launched && !s._ln;
      if ((groundJump || airJump || springOff) && input.dirX !== 0) p.facing = input.dirX;
      if (groundJump || airJump) endAction(p);
      remember(p);
      if (s._act) {
        s._af = (s._af ?? 0) + 1;
        if ((s._af ?? 0) >= ACTION_FRAMES) endAction(p);
      }
      if (fullKit(p)) cycleTool(p, input, tools(p), world);
      if (!s._act) {
        // Attack (and Up + Attack: Classic Special Input is off) whips; C throws; Select with
        // the Fire Flower throws the extra weapon, or with the full kit picks C's (SI-C1, SI-C26).
        if (input.pressed('attack')) {
          s._act = WHIP;
          s._af = 0;
          s._ac = p.crouching && b.onGround ? 1 : 0;
          world.audio.sfx('whip');
        } else if (input.pressed('special')) startThrow(p, specialWeapon(p), world);
        else if (input.pressed('select') && !fullKit(p) && p.powerState === 'fire')
          startThrow(p, weaponById(EXTRA_WEAPON), world);
      }
      const t = s._af ?? 0;
      if (s._act === WHIP) p.activeMelee = t >= WHIP_LIVE_FROM ? whipBox(p) : null;
      else p.activeMelee = null;
      if (s._act === THROW && t === THROW_AT) release(p, world);
      p.attackTimer = s._act ? ACTION_FRAMES - t : 0;
    },
    // On the ground he is rooted for the whole whip or throw, unless he jumps out of it (SI-C4).
    rooted: (p, input) => (rooted(p, input) ? 'canJump' : false),
    meleeDamage: (p) => ({
      kind: 'sword',
      amount: WHIP_DAMAGE[p.powerState] ?? 200,
      owner: p,
      dirX: p.facing,
      stopFrames: HIT_FREEZE,
    }),
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
    contactDamage: () => null,
    onHurt(p, world, fromDir) {
      endAction(p);
      return classicOnHurt(p, world, fromDir, KIT);
    },
    onPickup: (p, kind, world) => classicPickup(p, kind, world, PICKUPS),
    onRespawn: (p) => classicRespawn(p, START_KIT),
  },
};
// A Classic def leaves out the Current HUD extras (TG-22); `tools` lists only the dev full kit.
delete SIMON_CLASSIC.meter;
delete SIMON_CLASSIC.hudExtra;
delete SIMON_CLASSIC.reserve;
delete SIMON_CLASSIC.startHp;
