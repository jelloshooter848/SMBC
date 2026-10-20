import { px } from '@engine/math/units';
import { BILL_SMBC_CANVAS } from '@content/sprites/smbc-bill';
import { canvasOffsets } from '@content/sprites/smbc-anchor';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, CharacterGuide, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import { cycleTool, toolIndex, type ToolInfo } from '../toolbelt';
import {
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicHurtPaletteStep,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicRespawn,
  classicStarPaletteStep,
  type ClassicPowerKit,
} from '../classic/power';
import { BILL } from './index';
import { CLASSIC_HURT, CLASSIC_WALK_ANIM, WALK_ABCB, walkPose } from '../classic/anim';
import { BillShot, billShotsOut, CLASSIC_GUNS, clearBillShots, type ClassicGunId } from './classic-weapons';

/**
 * Classic SMBC Bill (bug-reports/2026-10-07-bill-classic-smbc-rules.md, BI-C1..BI-C32): the
 * original's Bill.as with its default settings (POWERUP MODE Classic, When Hit = Lose Everything,
 * Machine Gun and Spread). Units: velocity 1/4096 px/f, positions subpixels, frames at 60 fps.
 */

/** The Customize Weapons choices (BI-C2): the Mushroom gun and the Flower gun. */
export type ClassicBillWeapon = Exclude<ClassicGunId, 'rifle'>;
export const CLASSIC_FIRST_GUN: ClassicBillWeapon = 'mg';
export const CLASSIC_SECOND_GUN: ClassicBillWeapon = 'spread';
/** With the dev full kit (TG-44) Select cycles the Attack gun in this order. */
export const CLASSIC_KIT_CYCLE: readonly ClassicBillWeapon[] = ['spread', 'laser', 'flare', 'mg'];

/** BI-C6, BI-C7, BI-C10, BI-C11: instant 1.25 px/f walk, the original's fixed jump, floor jump in water. */
export const BILL_CLASSIC_PROFILE: MovementProfile = {
  // Unused with instantAccel (BI-C6).
  minWalk: 0x01400,
  walkAccel: 0x01400,
  runAccel: 0x01400,
  releaseDecel: 0x01400,
  skidDecel: 0x01400,
  maxWalk: 0x01400, // WALK_SPEED 150: 1.25 px/f
  maxRun: 0x01400,
  skidTurnaround: 0x01400,
  // jumpPwr 550 (4.583 px/f) less one frame of gravity 1000 (0.1389 px/f²): our player moves
  // before gravity, the original after; with this the arcs match frame for frame (73 px, 66 f).
  jump: [{ maxVx: Infinity, initial: 0x0471c, holdGravity: 0x00239, fallGravity: 0x00239 }],
  maxFall: 0x05000, // vyMaxPsv 600: 5.0 px/f, a clamp
  fallReset: 0x05000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  swim: CLASSIC_SWIM.bill,
};

/** Frames the torso holds the shooting pose after a shot (SHOOT_TMR 250 ms; BI-C30). */
export const SHOOT_POSE_FRAMES = 15;
/** Machine Gun: a repeat tick every 110 ms = 6.6 frames, remainder kept (BI-C21). */
const MG_TICK_TENTHS = 66;
/** Timer shots before the Machine Gun skips one tick (MAX_M_SHOTS_BEFORE_DELAY). */
const MG_BURST = 6;

/* ---------- weapons by state (BI-C1, BI-C2) ---------- */

const fullKit = (p: Player): boolean => !!p.scratch.classicAll;

/** The gun Attack fires now. */
export function attackGun(p: Player): ClassicGunId {
  if (p.powerState === 'fire') {
    if (fullKit(p)) return CLASSIC_KIT_CYCLE[toolIndex(p, kitTools(p))] ?? CLASSIC_SECOND_GUN;
    return p.scratch.swap ? CLASSIC_FIRST_GUN : CLASSIC_SECOND_GUN;
  }
  if (p.powerState === 'big') return CLASSIC_FIRST_GUN;
  return 'rifle';
}

/** The gun Special fires now (only with the Flower), or null. */
export function specialGun(p: Player): ClassicGunId | null {
  if (p.powerState !== 'fire') return null;
  if (fullKit(p)) return 'mg';
  return p.scratch.swap ? CLASSIC_SECOND_GUN : CLASSIC_FIRST_GUN;
}

/** The dev full kit's belt (TG-44): only while it is carried and Bill has the Flower. */
function kitTools(p: Player): ToolInfo[] {
  if (!fullKit(p) || p.powerState !== 'fire') return [];
  return CLASSIC_KIT_CYCLE.map((id) => ({
    id,
    icon: CLASSIC_GUNS[id].icon,
    count: null,
    usable: true,
  }));
}

/* ---------- aim and muzzle (BI-C3, BI-C4, BI-C25) ---------- */

type Pose = 'ground' | 'prone' | 'somersault' | 'fall';
interface Aim {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

function pose(p: Player): Pose {
  if (p.crouching) return 'prone';
  if (p.body.onGround) return 'ground';
  return p.scratch._somersault ? 'somersault' : 'fall';
}

/** The aim from the d-pad: Up wins over Down; Down alone aims down only in a somersault. */
export function classicAim(p: Player, input: InputFrame): Aim {
  const f = p.facing;
  if (p.crouching) return { x: f, y: 0 };
  const up = input.held('up');
  const down = !up && input.held('down');
  const dx = input.dirX;
  if (up) return dx === 0 ? { x: 0, y: -1 } : { x: f, y: -1 };
  if (down && dx !== 0) return { x: f, y: 1 };
  if (down && pose(p) === 'somersault') return { x: 0, y: 1 };
  return { x: f, y: 0 };
}

type AimKey = 'up' | 'diagUp' | 'fwd' | 'diagDown' | 'down';
/** Muzzle points [forward, up] in px from the body centre and feet (BillBullet.OFS_ARR halved). */
const MUZZLE: Readonly<Record<Pose, Partial<Record<AimKey, readonly [number, number]>>>> = {
  ground: { up: [4.5, 46.5], diagUp: [13.5, 34.5], fwd: [17.5, 22.5], diagDown: [15, 13] },
  prone: { fwd: [18, 7.5] },
  somersault: { up: [0, 22.5], diagUp: [9.5, 19.5], fwd: [12.5, 12.5], diagDown: [9.5, 3], down: [0, 0] },
  fall: { up: [0, 39], diagUp: [12.5, 30.5], fwd: [12.5, 22.5], diagDown: [12.5, 13] },
};

function aimKey(a: Aim): AimKey {
  if (a.y < 0) return a.x === 0 ? 'up' : 'diagUp';
  if (a.y > 0) return a.x === 0 ? 'down' : 'diagDown';
  return 'fwd';
}

/** Where a shot with aim `a` starts: its centre, in subpixels (BI-C25). */
export function muzzle(p: Player, a: Aim): { x: number; y: number } {
  const row = MUZZLE[pose(p)];
  const [fwd, up] = row[aimKey(a)] ?? row.fwd ?? [17.5, 22.5];
  const b = p.body;
  return {
    x: b.x + (b.w >> 1) + Math.round(p.facing * fwd * px(1)),
    y: b.y + b.h - Math.round(up * px(1)),
  };
}

/* ---------- firing (BI-C16..BI-C24) ---------- */

/** Spread fan indexes in firing order (BI-C22). */
const FAN = [0, 1, -1, -2, 2] as const;
/** Sideways speed per fan step: straight 0.5 px/f; diagonal 0.4167 px/f per axis (k = ±1, ±2). */
const FAN_STRAIGHT = 0x00800;
const FAN_DIAG = [0, 0x006ab, 0x00d55] as const;
/** Laser segment spacing: 13 px straight, 9 px per axis on a diagonal; segments switch on 3 px behind the muzzle. */
const LASER_STEP = 13;
const LASER_STEP_DIAG = 9;
const LASER_APPEAR = 3;
const LASER_SEGMENTS = 4;

function spawn(
  world: World,
  p: Player,
  gun: ClassicGunId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  opts?: ConstructorParameters<typeof BillShot>[6],
): void {
  world.spawn(new BillShot(gun, x, y, p, vx, vy, opts));
}

const SFX: Readonly<Record<ClassicGunId, string>> = {
  rifle: 'buster',
  mg: 'buster',
  spread: 'spread',
  laser: 'laser',
  flare: 'fireball',
};

/** Fires `gun` once with the current aim if its cap allows. True when anything was fired. */
export function classicFire(p: Player, gun: ClassicGunId, a: Aim, world: World): boolean {
  const g = CLASSIC_GUNS[gun];
  const out = billShotsOut(world, p);
  const m = muzzle(p, a);
  const diag = a.x !== 0 && a.y !== 0;
  const s = diag ? g.diag : g.straight;
  const vx = a.x * s;
  const vy = a.y * s;
  switch (gun) {
    case 'rifle':
    case 'mg':
    case 'flare': {
      if (out >= g.cap) return false;
      if (gun === 'flare') {
        // Facing right the fireball starts at -1 rad and turns clockwise; facing left at -π/2,
        // counter-clockwise (the original's `flareAngle *= Math.PI / 2` on -1; Open question 4).
        const right = p.facing > 0;
        spawn(world, p, gun, m.x, m.y, vx, vy, {
          flare: { angle: right ? -1 : -Math.PI / 2, spin: right ? 1 : -1 },
        });
      } else spawn(world, p, gun, m.x, m.y, vx, vy);
      break;
    }
    case 'spread': {
      const n = Math.min(FAN.length, Math.max(0, g.cap - out));
      if (n === 0) return false;
      for (let i = 0; i < n; i++) {
        const k = FAN[i] as number;
        const back = px(3 * Math.abs(k));
        let svx = vx;
        let svy = vy;
        if (diag) {
          const d = Math.sign(k) * (FAN_DIAG[Math.abs(k)] as number);
          svx = vx - a.x * a.y * d;
          svy = vy + d;
        } else if (a.y === 0) svy = k * FAN_STRAIGHT;
        else svx = k * FAN_STRAIGHT;
        spawn(world, p, gun, m.x - a.x * back, m.y - a.y * back, svx, svy);
      }
      break;
    }
    case 'laser': {
      clearBillShots(world, p);
      const step = diag ? LASER_STEP_DIAG : LASER_STEP;
      for (let i = 0; i < LASER_SEGMENTS; i++) {
        const back = px(step * i);
        // Frames until this segment reaches 3 px behind the muzzle on its moving axes.
        const dormant = i === 0 ? 0 : Math.ceil(((step * i - LASER_APPEAR) * 4096) / s);
        spawn(world, p, gun, m.x - a.x * back, m.y - a.y * back, vx, vy, { dormant });
      }
      break;
    }
  }
  world.audio.sfx(SFX[gun]);
  p.attackTimer = SHOOT_POSE_FRAMES;
  return true;
}

/* ---------- Machine Gun timer (BI-C21) ---------- */

function stopMg(p: Player): void {
  delete p.scratch._mgOn;
  delete p.scratch._mgT;
  delete p.scratch._mgN;
  delete p.scratch._mgBurst;
}

/** A press of the button holding `gun` (1 Attack, 2 Special). */
function press(p: Player, gun: ClassicGunId, btn: 1 | 2, a: Aim, world: World): void {
  classicFire(p, gun, a, world);
  if (gun !== 'mg') return;
  p.scratch._mgOn = btn;
  p.scratch._mgT = 0;
  p.scratch._mgN = 0;
  p.scratch._mgBurst = 0;
}

function mgTick(p: Player, input: InputFrame, a: Aim, world: World): void {
  const btn = p.scratch._mgOn;
  if (!btn) return;
  const name = btn === 1 ? 'attack' : 'special';
  const gun = btn === 1 ? attackGun(p) : specialGun(p);
  if (!input.held(name) || gun !== 'mg') return stopMg(p);
  const t = (p.scratch._mgT ?? 0) + 1;
  p.scratch._mgT = t;
  const due = (p.scratch._mgN ?? 0) + 1;
  if (t * 10 < MG_TICK_TENTHS * due) return;
  p.scratch._mgN = due;
  const burst = p.scratch._mgBurst ?? 0;
  if (billShotsOut(world, p) >= CLASSIC_GUNS.mg.cap) p.scratch._mgBurst = 0;
  else if (burst < MG_BURST) {
    classicFire(p, 'mg', a, world);
    p.scratch._mgBurst = burst + 1;
  } else p.scratch._mgBurst = 0;
}

/* ---------- power states (BI-C12..BI-C14) ---------- */

const KIT: ClassicPowerKit = {
  response: CLASSIC_HIT_RESPONSES.bill as ClassicPowerKit['response'],
  // A new Flower puts its gun on Attack (BI-C1); losing it ends the swap.
  gainFire: (p) => {
    delete p.scratch.swap;
    delete p.scratch.tool;
  },
  loseBig: (p) => {
    delete p.scratch.swap;
    stopMg(p);
  },
};

/** BI-C15: the death throw (DIE_BOOST 300, gravity 1000, 1500 ms after landing, 6000 ms at most). */
const DEATH_THROW: NonNullable<CharacterDef['deathThrow']> = {
  vx: 0x01400,
  vy: 0x02800,
  gravity: 0x00239,
  maxFall: 0x05000,
  afterLand: 90,
  maxFrames: 360,
  dir: (p) =>
    p.scratch._dieDir === 1 || p.scratch._dieDir === -1 ? p.scratch._dieDir : (-p.facing as -1 | 1),
};

/* ---------- looks (BI-C30) ---------- */

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const step =
    classicStarPaletteStep(p, frame, reduceFlashing) ??
    classicHurtPaletteStep(p, frame, reduceFlashing, KIT.response.look);
  const palette = step === null ? 'bill' : `bill-star-${step}`;
  const b = p.body;
  const ax = p.scratch.aimX ?? p.facing;
  const ay = p.scratch.aimY ?? 0;
  const shooting = p.attackTimer > 0;
  // R1: every pose from his Classic sheet at the original sizes (smbc-bill.ts).
  let name: string;
  if (p.dead) name = 'die';
  else if (p.crouching) name = 'prone';
  else if (p.anim === 'climb') name = `climb-${(frame >> 3) & 1}`;
  else if (!b.onGround) {
    if (p.scratch._somersault)
      name = shooting && ay !== 0 ? (ay < 0 ? 'aim-diag-up' : 'aim-diag-down') : `spin-${(frame >> 2) & 3}`;
    else if (ay < 0) name = ax === 0 ? 'aim-up' : 'aim-diag-up';
    else if (ay > 0) name = 'aim-diag-down';
    else if (p.inWater) name = 'shoot';
    // F2: a walk off a ledge falls upright, legs split (the original's torso and legs `fall`).
    else name = shooting ? 'fall-shoot' : 'fall';
  } else if (ay < 0 && ax === 0) name = 'aim-up';
  else if (ay < 0) name = 'aim-diag-up';
  else if (ay > 0)
    name = 'aim-diag-down'; // walking with Down + a direction
  else if (p.anim === 'walk' || p.anim === 'skid')
    name = `${shooting ? 'walk-shoot' : 'walk'}-${walkPose(p, WALK_ABCB)}`;
  else name = shooting ? 'shoot' : 'idle';
  const box = BILL_CLASSIC.hitbox(p);
  return {
    sheet: 'bill-classic',
    palette,
    frame: name,
    flip: p.facing < 0,
    ...canvasOffsets(BILL_SMBC_CANVAS, box.w, box.h),
  };
}

/* ---------- guide and touch (TG-22, BI-C31) ---------- */

export const BILL_CLASSIC_GUIDE: CharacterGuide = {
  tagline: 'Classic: two guns, slow shots',
  controls: [
    { action: 'left/right', does: 'Walk. He starts and stops at once.' },
    { action: 'jump', does: 'A fixed somersault jump. Under water only from the floor.' },
    {
      action: 'attack',
      touch: 'SHOOT',
      does: 'Fire the gun in hand. Shots fly through ground and open blocks.',
    },
    { action: 'up', does: 'Aim up, diagonally while walking.' },
    {
      action: 'down',
      does: 'Lie flat when still. With a direction: walk and aim down. Somersault: aim down.',
    },
    { action: 'special', touch: 'GUN', does: 'With the Fire Flower: fire the other gun.' },
    { action: 'select', touch: 'SWAP', does: 'With the Fire Flower: swap the two guns.' },
  ],
  powerups: [
    { item: 'mushroom', does: 'The Machine Gun. Hold to keep firing.' },
    { item: 'flower', does: 'The Spread too, five shots in a fan.' },
    { item: 'star', does: 'Invincible for a few seconds.' },
    { item: 'drops', does: 'None.' },
  ],
  tips: [
    'Any hit takes both guns and leaves the rifle. A hit with only the rifle is fatal.',
    'Standing shots fly over a Goomba: lie flat or aim down.',
    'Buzzy Beetles and Bullet Bills shrug off bullets.',
  ],
  demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
};

/* ---------- the def ---------- */

export const BILL_CLASSIC: CharacterDef = {
  // The castle text's name (PM-M8): the original's default skin (BmdInfo.as).
  rescueName: 'your buddy',
  id: BILL.id,
  name: BILL.name,
  hudName: BILL.hudName,
  portrait: BILL.portrait,
  ...(BILL.music ? { music: BILL.music } : {}),
  rules: 'classic',
  movement: BILL_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  crouchNeedsNoDirection: true,
  // BI-C28: his head bumps bricks, never breaks them.
  canBreakBricks: () => false,
  // BI-C9: prone 12 × 15 (the original's 13.5 × 15 at our width); standing 12 × 24.
  hitbox: (p) => (p.crouching ? { w: 12, h: 15 } : { w: 12, h: 24 }),
  // F2: the original's HRect (31.5 standing, 16.25 in the somersault, 15 prone), legs' walk
  // (4 x 115 ms), and walking while he shoots.
  hurtbox: (p) => ({
    w: CLASSIC_HURT.w,
    h: p.crouching
      ? CLASSIC_HURT.bill.prone
      : !p.body.onGround && p.scratch._somersault
        ? CLASSIC_HURT.bill.jump
        : CLASSIC_HURT.bill.stand,
  }),
  walkAnim: CLASSIC_WALK_ANIM.bill,
  attackKeepsMotion: true,
  sprite,
  blockPowerUp: classicBlockPowerUp,
  jumpSfx: () => 'jump-small',
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  // BI-C13: the original Bill has no DROP_ARR.
  drop: () => null,
  deathThrow: DEATH_THROW,
  tools: kitTools,
  devKit: () => ({ classicAll: 1 }),
  guide: BILL_CLASSIC_GUIDE,
  touchLabels(p) {
    const s = specialGun(p);
    return {
      attack: 'SHOOT',
      special: s ? CLASSIC_GUNS[s].label : null,
      select: p.powerState === 'fire' ? (fullKit(p) ? 'WEAPON' : 'SWAP') : null,
    };
  },
  behaviour: {
    update(p, input, world) {
      // BI-C4: a somersault from a jump or a spring launch until landing.
      if (p.body.onGround || p.vine) delete p.scratch._somersault;
      else if (p.jumping || p.launched) p.scratch._somersault = 1;
      const a = classicAim(p, input);
      p.scratch.aimX = a.x;
      p.scratch.aimY = a.y;
      if (classicBusy(p) || p.stun > 0) return;
      if (p.powerState === 'fire' && input.pressed('select')) {
        if (fullKit(p)) cycleTool(p, input, kitTools(p), world);
        else {
          p.scratch.swap = p.scratch.swap ? 0 : 1;
          world.audio.sfx('select');
        }
        stopMg(p);
      }
      const atk = attackGun(p);
      const spc = specialGun(p);
      const pressedAttack = input.pressed('attack');
      const pressedSpecial = spc !== null && input.pressed('special');
      // A Machine Gun press restarts its timer; otherwise the running timer ticks.
      const mgPress = (pressedAttack && atk === 'mg') || (pressedSpecial && spc === 'mg');
      if (!mgPress) mgTick(p, input, a, world);
      if (pressedAttack) press(p, atk, 1, a, world);
      if (pressedSpecial && spc) press(p, spc, 2, a, world);
    },
    // BI-C5: no shots or jumps on a vine; a climb ends the somersault.
    vineTick: (p) => {
      delete p.scratch._somersault;
      stopMg(p);
    },
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
    contactDamage: () => null,
    onHurt(p, world, fromDir) {
      stopMg(p);
      const r = classicOnHurt(p, world, fromDir ?? 1, KIT);
      if (r === 'dead') p.scratch._dieDir = fromDir ?? -p.facing;
      return r;
    },
    onRespawn: (p) => classicRespawn(p, {}),
  },
};
