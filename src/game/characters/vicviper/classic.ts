import { px, velToSub } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import { FLY_SHIP_X } from '@content/sprites/vicviper';
import { HUD_BOTTOM } from '../../hud/hud';
import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import { MARIO } from '../mario';
import { moveX, moveY } from '../../entities/body';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { TileMap } from '../../world/tilemap';
import {
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
  type ClassicDropTable,
  type ClassicPowerKit,
} from '../classic/power';
import { VIC_GUIDE } from './classic-guide';
import { fire, keepEscort, recordTrail, SHIELD_HP } from './classic-weapons';

/**
 * Vic Viper, a Classic-only hero (bug-reports/2026-10-07-vicviper-build-classic-character.md, VV-1..
 * VV-32, with the owner-approved answers of docs/classic/VIC_VIPER.md for every VV-M item; TG-41).
 * The cut Gradius prototype of SMBC 3.1.21, built from its uncompiled VicViper.as:
 *
 * - Flight (VV-5, VV-6): gravity off, 8 directions at a fixed speed, no acceleration, through the
 *   shared tile collision; no jump, run or crouch. It is the behaviour's `drive` (the shared walking
 *   code never runs for it).
 * - Auto-scroll (VV-9..VV-12, CharacterDef.autoScroll): the screen moves right at 0.833 px/f and
 *   carries the ship; left adds the scroll speed back (VV-7, VV-M13: kept as coded).
 * - Edges (VV-M11, VV-M12): held 3 px inside the right edge and below the screen top; pinned
 *   against a wall by the left edge, it is pushed out (up, down or past it), as in the original;
 *   only with no free place at all is it squashed.
 * - Bullet (VV-14, VV-15), no stomp (VV-26), no head bump and hidden blocks stay hidden (VV-25),
 *   mid-air pipes (VV-27), no vines (VV-M16), springs are solid (VV-30).
 * - The Gradius power bar (VV-20..VV-22, VV-M1..VV-M9): capsules move the light, POWER (Jump or
 *   Special) takes it: Speed Up, Missile, Double, Laser, Option, Shield.
 *
 * Power bar state lives in `p.scratch` (carried from area to area, wiped on death, VV-19):
 * `vvSel` the lit slot (0 none, 1..6), and each power-up's level: `vvSpeed` (0..5), `vvMissile`
 * (0/1), `vvDouble` (0..2), `vvLaser` (0..2), `vvOption` (0..4), `vvShield` (0/1) with its pieces'
 * hits left `vvShieldTop` / `vvShieldBot`.
 */

/** MOVEMENT_SPEED 200 Flash px/s: 1.667 px/f (VV-5). */
export const FLY_SPEED = 0x01aab;
/** Each Speed Up adds 0.333 px/f (VV-M4), up to 5. */
export const SPEED_STEP = 0x00555;
/** Left adds back the scroll speed while the screen scrolls: 2.5 px/f (VV-5). */
export const LEFT_EXTRA = 0x00d55;
/** Level.SCROLL_SPEED_AUTO 100 Flash px/s: 0.833 px/f (VV-9). */
export const AUTO_SCROLL = 0x00d55;
/** The shared water sink cap, 250 Flash px/s (VV-17). */
export const WATER_SINK = 0x02155;
/** Kept this far inside the camera's right edge (VV-M11). */
export const RIGHT_MARGIN = 3;
/** The hitbox, the same in every state (VV-3). */
export const VIC_HITBOX = { w: 15, h: 10 } as const;

/** The power bar's slots in order (VV-20) with their caps (powerLevelIsAvailable, VV-21). */
export const VIC_BAR = [
  { key: 'vvSpeed', cell: 'SP', name: 'SPEED', spoken: 'Speed Up', max: 5 },
  // Six letters at most in the HUD (POWER_BAR.nameX), so MISSILE is shortened there.
  { key: 'vvMissile', cell: 'MS', name: 'MISSL', spoken: 'Missile', max: 1 },
  { key: 'vvDouble', cell: 'DB', name: 'DOUBLE', spoken: 'Double', max: 2 },
  { key: 'vvLaser', cell: 'LS', name: 'LASER', spoken: 'Laser', max: 2 },
  { key: 'vvOption', cell: 'OP', name: 'OPTION', spoken: 'Option', max: 4 },
  { key: 'vvShield', cell: '?', name: 'SHIELD', spoken: 'Shield', max: 1 },
] as const;
/** A capsule with every slot maxed scores this (VV-M2). */
export const MAXED_CAPSULE_SCORE = 1000;

/** No jump (VV-8): one tier of zeros. Walking numbers only matter to the scripted clears. */
export const VIC_PROFILE: MovementProfile = {
  ...MARIO.movement,
  minWalk: 0,
  maxWalk: FLY_SPEED,
  maxRun: FLY_SPEED,
  canRun: false,
  jump: [{ maxVx: FLY_SPEED, initial: 0, holdGravity: 0, fallGravity: 0 }],
  swim: undefined,
  slide: undefined,
  coyoteFrames: 0,
};

/** The ship's flight speed now (VV-M4). */
export function flySpeed(p: Player): number {
  return FLY_SPEED + Math.min(5, p.scratch.vvSpeed ?? 0) * SPEED_STEP;
}

/** Whether bar slot `slot` (1..6) can still be taken (VV-21). */
export function slotAvailable(p: Player, slot: number): boolean {
  const s = VIC_BAR[slot - 1];
  return !!s && (p.scratch[s.key] ?? 0) < s.max;
}

/**
 * One capsule (VV-21, VV-M2): the light moves to the next available slot, wrapping from the last to
 * SPEED UP; with every slot maxed it scores 1000 instead.
 */
export function addCapsule(p: Player, world: World): void {
  const sel = p.scratch.vvSel ?? 0;
  for (let k = 1; k <= VIC_BAR.length; k++) {
    const slot = ((sel + k - 1) % VIC_BAR.length) + 1;
    if (slotAvailable(p, slot)) {
      p.scratch.vvSel = slot;
      world.audio.sfx('capsule');
      // The bar's new text, read out (POWER is the ability's name).
      world.events.push({ type: 'say', text: `${VIC_BAR[slot - 1]?.spoken ?? ''} lit. POWER to take it.` });
      return;
    }
  }
  world.addScore(MAXED_CAPSULE_SCORE, p.body.x, p.body.y - px(16));
}

/**
 * POWER (VV-M1): the lit slot's next level, then the bar empties. Double and Laser replace each
 * other (VV-M6). Nothing lit: nothing happens. Returns whether a power-up was taken.
 */
export function spendPower(p: Player, world: World): boolean {
  const s = p.scratch;
  const sel = s.vvSel ?? 0;
  if (!sel || !slotAvailable(p, sel)) return false;
  const slot = VIC_BAR[sel - 1] as (typeof VIC_BAR)[number];
  s[slot.key] = (s[slot.key] ?? 0) + 1;
  if (slot.key === 'vvDouble') s.vvLaser = 0;
  if (slot.key === 'vvLaser') s.vvDouble = 0;
  if (slot.key === 'vvShield') {
    s.vvShieldTop = SHIELD_HP;
    s.vvShieldBot = SHIELD_HP;
  }
  s.vvSel = 0;
  world.audio.sfx('item-get');
  world.events.push({ type: 'say', text: `${slot.spoken} taken.` });
  return true;
}

/**
 * The ship has no push: a survived hit only sets the 75-frame invulnerability at 65 % opacity
 * (the shared Classic states and Lose Everything; the bar and power-ups are kept, VV-19).
 */
const KIT: ClassicPowerKit = {
  response: {
    kind: 'push',
    vx: 0,
    from: 'source',
    lock: { frames: 0 },
    invuln: CLASSIC_PUSH_INVULN,
    look: { alpha: true },
  },
};

/** Capsules drop from kills, broken bricks and coin blocks at the shared rates (VV-M3, PS-C15). */
const VIC_DROPS: ClassicDropTable = { sources: ['enemy', 'brick', 'coin'], items: [['power-capsule', 1]] };

/** Frames the nose takes to tilt one step further (VV art `up` / `down`, 4 frames each). */
const TILT_STEP = 4;

/** VV-5: one frame of flight. Always handled (the shared movement never runs). */
function fly(p: Player, input: InputFrame, map: TileMap): true {
  const b = p.body;
  const s = p.scratch;
  if (p.stun > 0) p.stun--;
  const free = p.hurtLock === null && p.stun === 0;
  const held = (a: 'left' | 'right' | 'up' | 'down') => free && input.held(a);
  const speed = flySpeed(p);
  let vx = 0;
  if (held('right') && !held('left')) vx = speed;
  else if (held('left') && !held('right')) vx = -(speed + (s._scroll ? LEFT_EXTRA : 0));
  let vy = 0;
  if (held('up') && !held('down')) vy = -speed;
  else if (held('down') && !held('up')) vy = speed;
  if (p.inWater && vy > WATER_SINK) vy = WATER_SINK;
  p.facing = 1;
  p.crouching = false;
  p.jumping = false;
  b.vx = vx;
  b.vy = 0;
  // Where the feet were before this frame's move (a springboard's solid box reads it).
  b.prevBottom = b.y + b.h;
  p.fallSpeed = 0;
  moveX(b, map, velToSub(vx));
  // Blocks are plain ceiling from below (no bump callback) and hidden blocks are not there (VV-25).
  if (vy !== 0) moveY(b, map, velToSub(vy), { ignoreHidden: true });
  b.onGround = false;
  // The nose tilts while Up or Down is held, and levels out again.
  const want = vy < 0 ? -2 * TILT_STEP : vy > 0 ? 2 * TILT_STEP : 0;
  const t = s._tilt ?? 0;
  s._tilt = t + Math.sign(want - t);
  p.anim = vx !== 0 || vy !== 0 ? 'walk' : 'idle';
  return true;
}

/** The pose frame name for the tilt (VV art `normal`, `up`, `down`). */
function pose(p: Player): string {
  const t = p.scratch._tilt ?? 0;
  const step = Math.min(2, Math.ceil(Math.abs(t) / TILT_STEP));
  if (step === 0) return 'normal';
  return `${t < 0 ? 'up' : 'down'}-${step}`;
}

/** The palette for the power state (VV-M10): red small, blue Mushroom, gold Flower. */
function statePalette(state: string): string {
  return state === 'big' ? 'vicviper-mushroom' : state === 'fire' ? 'vicviper-flower' : 'vicviper';
}

/** Draw offsets (px left of and above the hitbox): the hitbox sits centred on the ship's hull (VV-3). */
const SHIP_DX = FLY_SHIP_X + 8;
const SHIP_DY = 4;
const BOOM_FRAMES = 4;
const BOOM_RATE = 6;

function vicSprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const s = p.scratch;
  if (p.dead) {
    // The death burst (VV art `deathExplosion`), then nothing.
    s._boom ??= frame;
    const n = Math.floor((frame - s._boom) / BOOM_RATE);
    return {
      sheet: 'vicviper',
      palette: 'vicviper',
      frame: n < BOOM_FRAMES ? `boom-${n}` : 'none',
      flip: false,
      offsetX: 5,
      offsetY: 7,
    };
  }
  delete s._boom;
  let palette = statePalette(p.powerState);
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  if (star !== null) palette = `vicviper-star-${star}`;
  else if (p.transition && !reduceFlashing && (frame >> 2) % 2 === 1) {
    // Gaining or losing the Mushroom: the trim flashes between the two looks (VV-M10).
    palette = statePalette(p.powerState === 'small' ? 'big' : 'small');
  }
  const flame = (s.vvSpeed ?? 0) > 0 ? 'fast' : 'slow';
  return {
    sheet: 'vicviper',
    palette,
    frame: `fly-${pose(p)}-${flame}-${(frame >> 1) & 3}`,
    flip: false,
    offsetX: SHIP_DX,
    offsetY: SHIP_DY,
  };
}

/** Room above the hitbox the Shield's top piece takes (VV-M9: 1 px above, a 13 px box centred). */
const SHIELD_ROOM = 8;

/**
 * The right and top edges (VV-M11): the hitbox stays 3 px inside the camera's right edge and below
 * the HUD's rows. Moved with tile collision, so it never ends inside a wall.
 */
function holdOnScreen(p: Player, world: World): void {
  const b = p.body;
  const map = world.map;
  const right = world.camera.right - px(RIGHT_MARGIN);
  if (b.x + b.w > right) moveX(b, map, right - (b.x + b.w));
  // Below the HUD's rows (M11), with room for the Shield's top piece while it lasts: no flying
  // over a level's ceiling in the HUD lane.
  const top =
    world.camera.y +
    px(HUD_BOTTOM + ((p.scratch.vvShieldTop ?? 0) > 0 && p.scratch.vvShield ? SHIELD_ROOM : 0));
  if (b.y < top) moveY(b, map, top - b.y, { ignoreHidden: true });
}

export const VICVIPER_CLASSIC: CharacterDef = {
  id: 'vicviper',
  name: 'Vic Viper',
  // VV-M24: VIC_VIPER is too wide beside the coins.
  hudName: 'VIPER',
  // Toad: THANK YOU VIPER! (VV-M24).
  thanksName: 'VIPER',
  rules: 'classic',
  movement: VIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: false,
  canBreakBricks: () => false,
  headBumps: () => false,
  passesHiddenBlocks: true,
  flies: true,
  pipesAirborne: true,
  // VV-M12: the original never kills a pinned ship (Level.scrollScreen carries it with no hit
  // test, then groundHT pushes it out of the ground), so the ship is put free instead; with no
  // free place within reach it is still squashed.
  autoScroll: { speed: AUTO_SCROLL, pinned: 'eject' },
  hitbox: () => VIC_HITBOX,
  sprite: vicSprite,
  blockPowerUp: classicBlockPowerUp,
  // The Fire Flower comes out of a block as a power capsule (VV-M3).
  powerUpArt: (kind) =>
    kind === 'flower' ? { sheet: 'vicviper', frames: ['capsule-0', 'capsule-1'] } : null,
  jumpSfx: () => '',
  portrait: { sheet: 'vicviper', palette: 'vicviper', frame: 'portrait' },
  powerIcon: true,
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, VIC_DROPS, 'enemy') : null),
  blockDrop: (rng, p, source) => classicDrop(rng, p, VIC_DROPS, source),
  // The ship's burst stays where it was hit (no hop), then the usual wait.
  deathHop: { freeze: 1, vy: 0, gravity: 0, maxFall: 0, frames: 195, pitFrames: 180 },
  powerBar: (p) => {
    const sel = p.scratch.vvSel ?? 0;
    return {
      slots: VIC_BAR.map((s, i) => ({ label: s.cell, available: slotAvailable(p, i + 1) })),
      selected: sel,
      name: sel ? (VIC_BAR[sel - 1]?.name ?? '') : '',
    };
  },
  guide: VIC_GUIDE,
  touchLabels: () => ({ attack: 'SHOOT', jump: 'POWER', special: 'POWER', select: null }),
  // TG-44: `&kit=full` gives a spent kit to try every power-up (Speed Up 2, Missile, Laser, two
  // Options, the Shield).
  // The How to play demo shows the ship as it starts, not the spent kit.
  guideKit: () => ({}),
  devKit: () => ({
    vvSpeed: 2,
    vvMissile: 1,
    vvLaser: 1,
    vvOption: 2,
    vvShield: 1,
    vvShieldTop: SHIELD_HP,
    vvShieldBot: SHIELD_HP,
  }),
  behaviour: {
    drive: (p, input, map) => fly(p, input, map),
    update(p, input, world) {
      holdOnScreen(p, world);
      // Left is faster only while the screen scrolls (VV-5).
      p.scratch._scroll = world.heroScrolled || world.camera.auto ? 1 : 0;
      recordTrail(p, world);
      keepEscort(p, world);
      if (classicBusy(p)) return;
      if (input.pressed('attack')) fire(p, world);
      if (input.pressed('jump') || input.pressed('special')) spendPower(p, world);
    },
    onPowerUp(p, kind, world) {
      classicOnPowerUp(p, kind, world, KIT);
      // Every Flower is a capsule too (VV-M3): one step on the bar.
      if (kind === 'flower') addCapsule(p, world);
    },
    contactDamage: () => null,
    onHurt: (p, world, fromDir) => classicOnHurt(p, world, fromDir, KIT),
    onPickup(p, kind, world) {
      if (kind !== 'power-capsule') return classicPickup(p, kind, world, {});
      addCapsule(p, world);
      return true;
    },
    onRespawn: (p) => classicRespawn(p, {}),
    canGrabVine: () => false,
  },
};
