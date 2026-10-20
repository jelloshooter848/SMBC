import { px } from '@engine/math/units';
import { JASON_SMBC_CANVAS, sophiaSmbcDef } from '@content/sprites/smbc-sophia';
import { JASON_H } from './profile';
import type { InputFrame } from '@engine/input/input-manager';
import type { TouchLabels } from '@engine/input/touch';
import type { CharacterBehaviour, CharacterDef, HurtResult, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { PickupKind } from '../../entities/objects/pickup';
import {
  CLASSIC_DROP_RATES,
  CLASSIC_POWER_SCORE,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicOnPowerUp,
  classicRespawn,
  classicStarPaletteStep,
  type ClassicPowerKit,
} from '../classic/power';
import { SOPHIA, cannonLevel, muzzle, raised, settle, sprite as currentSprite } from './index';
import { holdsAway } from './drive';
import {
  CANNON_RAISE_FRAMES,
  DRIVE_MAX,
  HOMING_DROP,
  HOMING_MAX,
  HOMING_REPEAT,
  HOVER_CELLS,
  HURT_INVULN,
  HURT_PUSH_SLOW,
  MAX_CANNON_SHOTS,
  MAX_HOMING_OUT,
  MIN_SPEED,
  MISSILE_SIDE,
  TRIPLE_COST,
  TRIPLE_DROP,
  TRIPLE_MAX,
  TRIPLE_REPEAT,
  TRIPLE_START,
} from './profile';
import { FLOOR, SOUNDS, sophiaState, type SophiaState } from './state';
import { CannonShot, HomingMissile, nearestHomingTarget, SOPHIA_SHEET, TripleMissile } from './weapons';
import { CANNON_CLASSIC, HOMING_CLASSIC, TRIPLE_CLASSIC } from './classic-weapons';
import { SOPHIA_CLASSIC_GUIDE } from './classic-guide';
import { sophiaCameraX } from './classic-camera';
import { afterLifts, classicDrive } from './classic-lifts';

/*
 * Sophia III under Classic SMBC rules (bug-reports/2026-10-07-sophia-build-classic-character.md,
 * SO-1 to SO-62). The report was written before our Current Sophia existed; she is the same tank
 * (id `sophia`), so this def keeps the Current one's driving (drive.ts: SO-6 to SO-21, SO-35 to
 * SO-37), art and shot classes and changes what Classic changes:
 * - power through the shared Classic helpers (PS-C3, PS-C4's 60-frame freeze, 720-frame Star);
 *   the Crusher alone gives Wall and Ceiling Climb (no campaign items);
 * - shots in the original's damage units (classic-weapons.ts) for the Classic HP and brick rules;
 * - Select swaps the two missiles (SO-32; no Jason, no down + special);
 * - drops by the original's rates, only ammo for the missile she owns (SO-25);
 * - a hit keeps the missiles, a death wipes them (SO-23, classicRespawn).
 * Kit in `p.scratch`: `hasTriple`, `triple`, `hasHoming`, `homing`, `sub` (1: Homing selected).
 */

/** The missile weapon she fires now (SO-32), or null with none. */
export function selectedMissile(p: Player): 'triple' | 'homing' | null {
  const t = !!p.scratch.hasTriple;
  const h = !!p.scratch.hasHoming;
  if (t && h) return p.scratch.sub ? 'homing' : 'triple';
  return t ? 'triple' : h ? 'homing' : null;
}

const ownsMissile = (p: Player): boolean => selectedMissile(p) !== null;

function fireCannon(p: Player, st: SophiaState, world: World): void {
  if (world.countProjectiles(p, 'sophia-cannon') >= MAX_CANNON_SHOTS) return;
  const lvl = cannonLevel(p);
  const m = muzzle(p, st, raised(st));
  world.spawn(new CannonShot(m.x, m.y, m.vx, m.vy, lvl, p, CANNON_CLASSIC[lvl]));
  world.audio.sfx(SOUNDS.shoot[lvl] as string);
  p.attackTimer = 8;
}

/** Special (SO-30, SO-31): a Triple volley (3 ammo) or one Homing Missile (1 ammo); free under Star. */
function fireMissile(p: Player, st: SophiaState, world: World): void {
  const sub = selectedMissile(p);
  if (!sub) return;
  const free = p.star > 0;
  const m = muzzle(p, st, raised(st));
  if (sub === 'triple') {
    if (!free && (p.scratch.triple ?? 0) < TRIPLE_COST) return;
    // One volley at a time (MAX_MISSILES_ON_SCREEN = 1 counts volleys).
    if (world.countProjectiles(p, 'sophia-missile') > 0) return;
    const len = Math.hypot(m.vx, m.vy) || 1;
    for (const side of [0, -MISSILE_SIDE, MISSILE_SIDE])
      world.spawn(new TripleMissile(m.x, m.y, m.vx / len, m.vy / len, side, p, TRIPLE_CLASSIC));
    if (!free) p.scratch.triple = (p.scratch.triple ?? 0) - TRIPLE_COST;
  } else {
    if (!free && (p.scratch.homing ?? 0) < 1) return;
    if (world.countProjectiles(p, 'sophia-homing') >= MAX_HOMING_OUT) return;
    if (!nearestHomingTarget(world, m.x, m.y)) return;
    world.spawn(new HomingMissile(m.x, m.y, p, HOMING_CLASSIC));
    if (!free) p.scratch.homing = (p.scratch.homing ?? 0) - 1;
  }
  world.audio.sfx(SOUNDS.missile);
  p.attackTimer = 8;
}

/** Ammo for the selected missile, capped (a repeat Flower, a drop). */
function addAmmo(p: Player, triple: number, homing: number): void {
  const sub = selectedMissile(p);
  if (sub === 'triple') p.scratch.triple = Math.min(TRIPLE_MAX, (p.scratch.triple ?? 0) + triple);
  else if (sub === 'homing') p.scratch.homing = Math.min(HOMING_MAX, (p.scratch.homing ?? 0) + homing);
}

/** SO-22's power row: the hover with Hyper, the Triple Missile the first time she reaches Crusher. */
const KIT: ClassicPowerKit = {
  // Her hit is her own (onHurt below); the row is here for the type only.
  response: { kind: 'freeze', frames: 0, invuln: HURT_INVULN, look: { paletteFlash: true } },
  gainBig(p) {
    sophiaState(p).cells = HOVER_CELLS;
  },
  gainFire(p) {
    if (p.scratch.hasTriple || p.scratch.hasHoming) return;
    p.scratch.hasTriple = 1;
    p.scratch.triple = Math.max(p.scratch.triple ?? 0, TRIPLE_START);
  },
};

/** The frames her Classic sheet draws (R1); the rest (her blasts) stay on the campaign sheet. */
const CLASSIC_FRAMES = new Set(Object.keys(sophiaSmbcDef.frames));

/**
 * The Classic Star cycle (PS-C19) on her hull; the poses are the Current sprite's, drawn from her
 * Classic sheet at the original sizes (R1). Jason's 18-row frames stand on his box's bottom.
 */
function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const spec = currentSprite(p, frame, reduceFlashing);
  const step = p.transition || p.dead ? null : classicStarPaletteStep(p, frame, reduceFlashing);
  if (step !== null) spec.palette = `sophia-star-${step}`;
  if (CLASSIC_FRAMES.has(spec.frame)) {
    spec.sheet = 'sophia-classic';
    if (spec.frame.startsWith('jason-')) spec.offsetY = JASON_SMBC_CANVAS.h - JASON_H;
  }
  return spec;
}

function touchLabels(p: Player): TouchLabels {
  const sub = selectedMissile(p);
  const usable =
    sub !== null &&
    (p.star > 0 ||
      (sub === 'triple' ? (p.scratch.triple ?? 0) >= TRIPLE_COST : (p.scratch.homing ?? 0) >= 1));
  return {
    attack: 'SHOOT',
    special: usable ? (sub === 'homing' ? 'HOMING' : 'MISSILE') : null,
    select: p.scratch.hasTriple && p.scratch.hasHoming ? 'SWAP' : null,
  };
}

const behaviour: CharacterBehaviour = {
  ...SOPHIA.behaviour,
  update(p: Player, input: InputFrame, world: World) {
    const st = sophiaState(p);
    st.waterTop = world.waterTop;
    st.levelH = world.heightPx;
    if (classicBusy(p)) return;
    // The cannon rises while "up" (away from the surface) is held, not off the floor in water.
    const up = holdsAway(p, input) && !(p.inWater && !p.body.onGround && st.surface === FLOOR);
    if (!up) st.raise = 0;
    // Inputs are locked through a turn; no weapons on a vine (SO-8).
    if (st.turn || p.vine) return;
    if (input.pressed('select') && p.scratch.hasTriple && p.scratch.hasHoming) {
      p.scratch.sub = p.scratch.sub ? 0 : 1;
      world.audio.sfx(SOUNDS.select);
    }
    if (input.pressed('attack')) fireCannon(p, st, world);
    if (up) st.raise = Math.min(st.raise + 1, CANNON_RAISE_FRAMES);
    if (input.pressed('special')) fireMissile(p, st, world);
    if (st.hovering && world.frame % 8 === 0) world.audio.sfx(SOUNDS.hover);
  },
  onPowerUp(p, kind, world) {
    const st = sophiaState(p);
    if ((kind === 'mushroom' || kind === 'flower') && p.powerState === 'fire') {
      // A repeat Flower (or a Mushroom acting as one): ammo for the selected missile, no freeze.
      world.addScore(CLASSIC_POWER_SCORE, p.body.x, p.body.y - px(16));
      world.audio.sfx('powerup');
      addAmmo(p, TRIPLE_REPEAT, HOMING_REPEAT);
    } else classicOnPowerUp(p, kind, world, KIT);
    // A Mushroom and a Star fill the hover bar (SO-24, SO-35).
    if (kind === 'mushroom' || kind === 'star') st.cells = HOVER_CELLS;
  },
  onPickup(p, kind, world) {
    // Always taken (PS-C17), capped at the maximum.
    if (kind === 'triple-ammo')
      p.scratch.triple = Math.min(TRIPLE_MAX, (p.scratch.triple ?? 0) + TRIPLE_DROP);
    else if (kind === 'homing-ammo')
      p.scratch.homing = Math.min(HOMING_MAX, (p.scratch.homing ?? 0) + HOMING_DROP);
    else return false;
    world.audio.sfx(SOUNDS.pickup);
    return true;
  },
  onHurt(p, world, fromDir = 1): HurtResult {
    // Lose Everything (SO-23): straight to Normal; the missiles and their ammo stay.
    if (p.powerState !== 'big' && p.powerState !== 'fire') return 'dead';
    const st = sophiaState(p);
    p.powerState = 'small';
    p.attackTimer = 0;
    p.scratch._hurtAt = p.frame;
    p.invuln = HURT_INVULN;
    world.audio.sfx(SOUNDS.hurt);
    // On a wall or ceiling, or mid-turn, she lets go instead of being pushed; she keeps control.
    const onSurface = st.surface !== FLOOR || st.turn !== null;
    settle(p, st);
    if (!onSurface) p.body.vx = fromDir * (p.body.vx === 0 ? DRIVE_MAX : HURT_PUSH_SLOW);
    return 'hurt';
  },
  canGrabVine: () => true,
  // SO-38: her drive and the lift ride (classic-lifts.ts).
  drive: classicDrive,
  afterLifts,
  onRespawn(p, world) {
    // A co-op drop-in (PS-C22): back small with nothing (the missiles go with a death, SO-23).
    classicRespawn(p, {});
    SOPHIA.behaviour.onRespawn?.(p, world);
  },
};

/** One drop roll (SO-25): only while she owns a missile, ammo for the selected one. */
function roll(p: Player, chance: number, r: { chance(p: number): boolean }): PickupKind | null {
  if (!ownsMissile(p) || !r.chance(chance)) return null;
  return selectedMissile(p) === 'homing' ? 'homing-ammo' : 'triple-ammo';
}

export const SOPHIA_CLASSIC: CharacterDef = {
  // The castle text's name (PM-M8): the original's default skin (BmdInfo.as).
  rescueName: 'your frog',
  ...SOPHIA,
  rules: 'classic',
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  blockPowerUp: classicBlockPowerUp,
  jumpSfx: () => SOUNDS.jump,
  sprite,
  behaviour,
  guide: SOPHIA_CLASSIC_GUIDE,
  touchLabels,
  powerIcon: true,
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  // SO-26, PS-C27: the selected missile's icon and count; nothing with no missile.
  hudAmmo(p) {
    const sub = selectedMissile(p);
    if (!sub) return null;
    return {
      icon: sub === 'homing' ? 'icon-homing' : 'icon-triple',
      sheet: SOPHIA_SHEET,
      count: p.scratch[sub] ?? 0,
    };
  },
  // A kill rolls here; a kill by her shot rolls again as her explosion ends (weapons.ts killBoom).
  drop: (rng, _enemy, killer) => (killer ? roll(killer, CLASSIC_DROP_RATES.enemy, rng) : null),
  blockDrop: (rng, p, source) => roll(p, CLASSIC_DROP_RATES[source], rng),
  // TG-44: both missiles, full; the Triple Missile selected first (SO-M9).
  devKit: () => ({ hasTriple: 1, triple: TRIPLE_MAX, hasHoming: 1, homing: HOMING_MAX }),
  // SO-43: after the castle axe she drives on at her top speed, then her floor friction is
  // FX_DUNGEON_GOT_AXE (1e-7 a second: x0.76441 a frame) down to her stop snap.
  axeWalk: { speed: DRIVE_MAX, stop: 50096, snap: MIN_SPEED },
  // SO-39: her corner turns ease the camera.
  cameraX: sophiaCameraX,
  // SO-5: the original's usesHorzObjs, usesVertObjs, isWideCharacter, isGoodSwimmer.
  levelFlags: { horz: true, vert: true, wide: true, goodSwimmer: true },
};
// A Classic def draws its ammo with hudAmmo, not a tool belt (TG-22).
delete SOPHIA_CLASSIC.tools;
