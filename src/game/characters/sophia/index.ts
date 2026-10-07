import { px } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, SpriteSpec } from '../character';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { STAR_FRAMES } from '../../constants';
import { activeTool, type ToolInfo } from '../toolbelt';
import { SOPHIA_GUIDE } from './guide';
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
  MISSILE_SIDE,
  SHOT_SPEED,
  SOPHIA_PROFILE,
  TANK_H,
  TANK_W,
  TRIPLE_COST,
  TRIPLE_DROP,
  TRIPLE_MAX,
  TRIPLE_REPEAT,
  TRIPLE_START,
} from './profile';
import { becomeUpright, driveSophia, hasHover, holdsAway } from './drive';
import { CEIL, FLOOR, LEFT, RIGHT, SOUNDS, sophiaState, type SophiaState } from './state';
import { CannonShot, HomingMissile, nearestHomingTarget, SOPHIA_SHEET, TripleMissile } from './weapons';

/*
 * Sophia III, the tank from Blaster Master (bug-reports/2026-10-07-sophia-build-classic-
 * character.md), on our current systems: power states Normal / Hyper / Crusher stored as
 * small / big / fire; she never shrinks and cannot stomp. Her driving is her own (drive.ts).
 * Kit in `p.scratch` (it travels with her): `hasTriple`, `triple`, `hasHoming`, `homing`, `tool`
 * (the selected missile). Everything else lives in her state (state.ts) and starts afresh in each
 * area: the hover bar is full at every level start (SO-27).
 */

/** The cannon's level: 0 Normal, 1 Hyper, 2 Crusher. */
export const cannonLevel = (p: Player): number =>
  p.powerState === 'fire' ? 2 : p.powerState === 'big' ? 1 : 0;

/** Her missile weapons, in belt order. */
function tools(p: Player): ToolInfo[] {
  const out: ToolInfo[] = [];
  const free = p.star > 0;
  if (p.scratch.hasTriple) {
    const n = p.scratch.triple ?? 0;
    out.push({
      id: 'triple',
      icon: 'icon-triple',
      sheet: SOPHIA_SHEET,
      count: n,
      usable: free || n >= TRIPLE_COST,
    });
  }
  if (p.scratch.hasHoming) {
    const n = p.scratch.homing ?? 0;
    out.push({ id: 'homing', icon: 'icon-homing', sheet: SOPHIA_SHEET, count: n, usable: free || n >= 1 });
  }
  return out;
}

/** Unit vectors along her heading and away from her surface. */
function axes(p: Player, st: SophiaState): { ax: number; ay: number; nx: number; ny: number } {
  const d = st.surface === FLOOR || st.surface === CEIL ? p.facing : st.dir;
  switch (st.surface) {
    case CEIL:
      return { ax: d, ay: 0, nx: 0, ny: 1 };
    case LEFT:
      return { ax: 0, ay: d, nx: 1, ny: 0 };
    case RIGHT:
      return { ax: 0, ay: d, nx: -1, ny: 0 };
    default:
      return { ax: d, ay: 0, nx: 0, ny: -1 };
  }
}

/**
 * Where a shot leaves the cannon (SO-28): ahead, 6 px in front of the anchor (the middle of her
 * underside) and 12.5 px up from it; raised, 4 px behind it and 25 px up, "up" being away from
 * the surface.
 */
function muzzle(
  p: Player,
  st: SophiaState,
  raised: boolean,
): { x: number; y: number; vx: number; vy: number } {
  const b = p.body;
  const { ax, ay, nx, ny } = axes(p, st);
  const half = px(TANK_H) >> 1;
  const ancX = b.x + (b.w >> 1) - nx * half;
  const ancY = b.y + (b.h >> 1) - ny * half;
  if (raised)
    return {
      x: ancX - ax * px(4) + nx * px(25),
      y: ancY - ay * px(4) + ny * px(25),
      vx: nx * SHOT_SPEED,
      vy: ny * SHOT_SPEED,
    };
  return {
    x: ancX + ax * px(6) + nx * px(12.5),
    y: ancY + ay * px(6) + ny * px(12.5),
    vx: ax * SHOT_SPEED,
    vy: ay * SHOT_SPEED,
  };
}

/** The cannon is pointing away from the surface (up held for 9 frames, SO-28). */
const raised = (st: SophiaState): boolean => st.raise >= CANNON_RAISE_FRAMES;

function fireCannon(p: Player, st: SophiaState, world: World): void {
  if (world.countProjectiles(p, 'sophia-cannon') >= MAX_CANNON_SHOTS) return;
  const lvl = cannonLevel(p);
  const m = muzzle(p, st, raised(st));
  world.spawn(new CannonShot(m.x, m.y, m.vx, m.vy, lvl, p));
  world.audio.sfx(SOUNDS.shoot[lvl] as string);
  p.attackTimer = 8;
}

function fireMissile(p: Player, st: SophiaState, world: World): void {
  const t = activeTool(p, tools(p));
  if (!t || !t.usable) return;
  const free = p.star > 0;
  const m = muzzle(p, st, raised(st));
  if (t.id === 'triple') {
    // One volley at a time (MAX_MISSILES_ON_SCREEN counts volleys).
    if (world.countProjectiles(p, 'sophia-missile') > 0) return;
    const len = Math.hypot(m.vx, m.vy) || 1;
    const ax = m.vx / len;
    const ay = m.vy / len;
    for (const side of [0, -MISSILE_SIDE, MISSILE_SIDE])
      world.spawn(new TripleMissile(m.x, m.y, ax, ay, side, p));
    if (!free) p.scratch.triple = Math.max(0, (p.scratch.triple ?? 0) - TRIPLE_COST);
  } else {
    if (world.countProjectiles(p, 'sophia-homing') >= MAX_HOMING_OUT) return;
    if (!nearestHomingTarget(world, m.x, m.y)) return;
    world.spawn(new HomingMissile(m.x, m.y, p));
    if (!free) p.scratch.homing = Math.max(0, (p.scratch.homing ?? 0) - 1);
  }
  world.audio.sfx(SOUNDS.missile);
  p.attackTimer = 8;
}

/** A Flower while already Crusher, or a drop: ammo for the selected missile weapon. */
function addAmmo(p: Player, triple: number, homing: number): boolean {
  const t = activeTool(p, tools(p));
  if (!t) return false;
  if (t.id === 'homing') {
    if ((p.scratch.homing ?? 0) >= HOMING_MAX) return false;
    p.scratch.homing = Math.min(HOMING_MAX, (p.scratch.homing ?? 0) + homing);
  } else {
    if ((p.scratch.triple ?? 0) >= TRIPLE_MAX) return false;
    p.scratch.triple = Math.min(TRIPLE_MAX, (p.scratch.triple ?? 0) + triple);
  }
  return true;
}

/** A transient scratch flag: 1 while `on`, removed otherwise (so it never travels in the kit). */
function flag(p: Player, key: string, on: boolean): void {
  if (on) p.scratch[key] = 1;
  else delete p.scratch[key];
}

/** Back upright and every jump state ended (a hit, a vine, the flagpole). */
function settle(p: Player, st: SophiaState): void {
  if (st.surface !== FLOOR || st.turn) becomeUpright(p, st);
  st.push = null;
  st.squat = 0;
  st.engaged = false;
  st.hovering = false;
  st.coasting = false;
}

const HULL: Record<string, string> = { small: 'sophia', big: 'sophia-hyper', fire: 'sophia-crusher' };

function tankFrame(p: Player, st: SophiaState): string {
  const b = p.body;
  if (st.surface === FLOOR && !st.turn) {
    if (st.hovering) return `hover-${(st.roll >> 1) & 1}`;
    if (!b.onGround && p.inWater) return `swim-${(st.roll >> 2) & 1}`;
    if (!b.onGround) return 'jump';
  }
  if (st.raise >= CANNON_RAISE_FRAMES) return 'aim-up';
  if (st.raise > 0) return 'aim-diag';
  const speed = Math.abs(st.surface === LEFT || st.surface === RIGHT ? b.vy : b.vx);
  if (speed === 0) return 'idle';
  const rate = speed < 0x00555 ? 6 : speed < 0x01000 ? 4 : 3;
  return `drive-${Math.floor(st.roll / rate) & 3}`;
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const st = sophiaState(p);
  let palette = HULL[p.powerState] ?? 'sophia';
  if (p.transition) {
    // The power-up freeze: the hull flickers between the old colour and the new one.
    const old = p.powerState === 'fire' ? 'sophia-hyper' : 'sophia';
    if (!reduceFlashing && (p.transition.t >> 2) & 1) palette = old;
  } else if (p.star > 0) palette = `sophia-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  else if (p.invuln > 0) palette = `sophia-hurt-${reduceFlashing ? 1 : (frame >> 1) % 3}`;
  if (p.dead) {
    if (st.boomFrom < 0) st.boomFrom = frame;
    const t = frame - st.boomFrom;
    // Her explosion replaces the tank; a pit death shows nothing.
    const name = t < 16 && p.body.y < px(240) ? `boom-${t >> 2}` : 'none';
    return { sheet: SOPHIA_SHEET, palette, frame: name, flip: false, offsetX: 0, offsetY: 0, rotate: 0 };
  }
  st.boomFrom = -1;
  const name = p.vine ? 'idle' : tankFrame(p, st);
  const spec: SpriteSpec = {
    sheet: SOPHIA_SHEET,
    palette,
    frame: name,
    flip: false,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
  };
  // On a vine she is drawn nose up (SO-43); her box stays upright.
  if (p.vine) {
    spec.rotate = 270;
    return spec;
  }
  switch (st.surface) {
    case CEIL:
      spec.flipY = true;
      spec.flip = p.facing < 0;
      break;
    case LEFT:
      // Wheels on the left: a quarter turn clockwise; nose up flipped first.
      spec.rotate = 90;
      spec.flip = st.dir < 0;
      break;
    case RIGHT:
      spec.rotate = 270;
      spec.flip = st.dir > 0;
      break;
    default:
      spec.flip = p.facing < 0;
  }
  return spec;
}

export const SOPHIA: CharacterDef = {
  id: 'sophia',
  name: 'Sophia III',
  hudName: 'SOPHIA',
  movement: SOPHIA_PROFILE,
  damage: { kind: 'powerup', states: ['small', 'big', 'fire'] },
  stomps: false,
  crouches: false,
  noHurtBlink: true,
  canBreakBricks: () => false,
  hitbox(p) {
    const st = sophiaState(p);
    const turned = st.surface === LEFT || st.surface === RIGHT || st.vineBox || p.vine !== null;
    return turned ? { w: TANK_H, h: TANK_W } : { w: TANK_W, h: TANK_H };
  },
  sprite,
  blockPowerUp: (p) => (p.powerState === 'small' ? 'mushroom' : 'flower'),
  jumpSfx: () => SOUNDS.jump,
  portrait: { sheet: SOPHIA_SHEET, palette: 'sophia', frame: 'idle' },
  tools,
  meter(p) {
    if (!hasHover(p)) return null;
    return { value: sophiaState(p).cells, max: HOVER_CELLS, colour: '#e40058', label: 'H' };
  },
  devKit: () => ({ hasTriple: 1, triple: TRIPLE_MAX, hasHoming: 1, homing: HOMING_MAX }),
  drop(rng, _enemy, killer) {
    // SO-25: a 25% roll, only while she owns a missile weapon; the item is ammo for it.
    if (!killer || !(killer.scratch.hasTriple || killer.scratch.hasHoming)) return null;
    return rng.int(4) === 0 ? 'missile-pack' : null;
  },
  guide: SOPHIA_GUIDE,
  touchLabels(p) {
    const t = activeTool(p, tools(p));
    return {
      attack: 'SHOOT',
      special: t && t.usable ? (t.id === 'homing' ? 'HOMING' : 'MISSILE') : null,
      // The missiles switch with down + special, not Select.
      select: null,
    };
  },
  behaviour: {
    drive: driveSophia,
    update(p: Player, input: InputFrame, world: World) {
      const st = sophiaState(p);
      st.waterTop = world.waterTop;
      if (p.transition) return;
      // The cannon rises while "up" (away from the surface) is held; not off the floor in water.
      // A shot fires up once "up" has been held for 9 frames before it (SO-28).
      const up = holdsAway(p, input) && !(p.inWater && !p.body.onGround && st.surface === FLOOR);
      if (!up) st.raise = 0;
      if (st.turn) return; // inputs are locked through a turn (SO-8)
      if (input.pressed('attack')) fireCannon(p, st, world);
      if (up) st.raise = Math.min(st.raise + 1, CANNON_RAISE_FRAMES);
      if (input.pressed('special')) {
        const belt = tools(p);
        if (input.held('down') && belt.length > 1) {
          p.scratch.tool = ((p.scratch.tool ?? 0) + 1) % belt.length;
          world.audio.sfx(SOUNDS.select);
        } else fireMissile(p, st, world);
      }
      if (st.hovering && world.frame % 8 === 0) world.audio.sfx(SOUNDS.hover);
      // Shown to the training tracker (MoveStats.seen); gone again when it ends.
      flag(p, 'hover', st.hovering);
      flag(p, 'climb', st.surface !== FLOOR);
    },
    onPowerUp(p, kind, world) {
      const st = sophiaState(p);
      switch (kind) {
        case 'mushroom':
        case 'flower': {
          if (p.powerState === 'small') {
            // Any power-up taken while Normal acts as a Mushroom: Hyper, and the hover.
            p.powerState = 'big';
            st.cells = HOVER_CELLS;
            p.startTransition('grow');
          } else if (kind === 'mushroom') st.cells = HOVER_CELLS;
          else if (p.powerState === 'big') {
            p.powerState = 'fire';
            if (!p.scratch.hasTriple && !p.scratch.hasHoming) {
              p.scratch.hasTriple = 1;
              p.scratch.triple = TRIPLE_START;
            }
            p.startTransition('grow');
          } else addAmmo(p, TRIPLE_REPEAT, HOMING_REPEAT);
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        }
        case 'star':
          p.star = STAR_FRAMES;
          st.cells = HOVER_CELLS;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.playMusic('star');
          break;
        case '1up':
          world.addLife(p.body.x, p.body.y - px(16));
          break;
      }
    },
    onPickup(p, kind, world) {
      if (kind !== 'missile-pack') return false;
      if (!addAmmo(p, TRIPLE_DROP, HOMING_DROP)) return false;
      world.audio.sfx(SOUNDS.pickup);
      return true;
    },
    contactDamage() {
      return null;
    },
    onHurt(p, world, fromDir = 1) {
      if (p.powerState === 'small') return 'dead';
      const st = sophiaState(p);
      // Lose Everything: straight to Normal; the missiles and their ammo are kept (SO-23).
      p.powerState = p.powerState === 'fire' && world.assist.fireRevertsToBig ? 'big' : 'small';
      const onSurface = st.surface !== FLOOR || st.turn !== null;
      settle(p, st);
      // On a wall or ceiling she lets go instead of being pushed.
      if (!onSurface) p.body.vx = fromDir * (p.body.vx === 0 ? DRIVE_MAX : HURT_PUSH_SLOW);
      p.invuln = HURT_INVULN;
      world.audio.sfx(SOUNDS.hurt);
      return 'hurt';
    },
    onGrabVine(p) {
      const st = sophiaState(p);
      settle(p, st);
      // Nose up on the vine: the turned box (keeping her feet), which fits its one-tile holes.
      st.vineBox = true;
      p.refitHitbox();
    },
    onGrabStairs(p) {
      settle(p, sophiaState(p));
    },
    onLevelClear(p) {
      settle(p, sophiaState(p));
    },
    onRespawn(p) {
      const st = sophiaState(p);
      settle(p, st);
      st.cells = HOVER_CELLS;
      p.refitHitbox();
    },
  },
};
