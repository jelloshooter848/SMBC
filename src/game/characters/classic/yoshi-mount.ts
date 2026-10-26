import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { moveX, moveY } from '../../entities/body';
import { Entity, type View } from '../../entities/entity';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { CharacterBehaviour, CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { BlockStrike } from '../../rules/hooks';
import { isSwimLevel, type LevelData, type PipeDir, type Zone } from '../../level/schema';
import { getLevel } from '@content/levels';
import { T, tileDef } from '../../level/tiles';
import { Koopa } from '../../entities/enemies/koopa';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { BrickPiece } from '../../entities/effects/effects';
import { Flagpole } from '../../entities/objects/flagpole';
import { EGG_HATCH_FRAME, YoshiEgg } from '../../entities/objects/yoshi-egg';
import { MARIO_CLASSIC_PROFILE } from '../mario/classic';
import { FIREBALL_CLASSIC } from '../mario/classic-weapons';
import { classicBusy } from './power';
import {
  clearMouth,
  ensureFx,
  mouthOf,
  mouthPoint,
  startTongue,
  tongueOut,
  tongueTick,
} from './yoshi-tongue';

/**
 * The Classic Yoshi mount (bug-reports/2026-10-19-yoshi-build-classic-character.md Part B,
 * YM-1..YM-30; owner-approved with the recommended answers: off by default, M1 egg blocks, Yoshi's
 * own movement for every rider, Attack held runs and a press licks, the rider's own Special,
 * benched outside castles, water and bonus areas). Super Mario World's Yoshi: he swallows what
 * he licks, holds shells and spits them (a red shell as three fireballs), and runs off when the
 * pair is hit, the rider keeping their power.
 *
 * Nothing here runs unless the run's GameContext.classicYoshi is set (Dev menu's Yoshi mount, or a
 * dev `&yoshi=` start), which only a Classic-rules run outside the campaign has (YM-1, YM-2).
 *
 * The ride is a def overlay: `p.def` becomes `ridingDef(base)` (Classic Mario's profile without the
 * crouch, a 12 x 28 box, stomps Spinies, the tongue on Attack, the rider's Special) and goes back
 * on getting off. `p.scratch.yoshiRide` (carried to the next area and level, wiped by a death):
 * 1 riding, 2 benched (waiting outside a castle, water or bonus area).
 */

/** The pair's body (YM-10). */
export const PAIR_W = 12;
export const PAIR_H = 28;
/** A hit (YM-17): the rider thrown up 3 px/f, invulnerable 120 frames; Yoshi runs at 2 px/f. */
export const THROW_VY = 0x03000;
export const HIT_INVULN = 120;
export const FLEE_SPEED = 0x02000;
/** A shell held this long is swallowed (YM-15). */
export const SHELL_HOLD = 600;
/** After getting off on purpose, frames on the ground (beside him) before he can be mounted again. */
export const REMOUNT_WAIT = 30;
/** A freshly hatched Yoshi steps off his block at 1 px/f (tuning). */
export const WALK_OFF = 0x01000;
/** Kit key: 1 riding, 2 benched. */
export const RIDE_KEY = 'yoshiRide';

/** YM-9: Classic Mario's profile for every rider, without the crouch-jump. */
export const RIDE_PROFILE: MovementProfile = { ...MARIO_CLASSIC_PROFILE, crouchJump: undefined };

/** Heroes that never ride (YM-3): a def opts out with `rides: false`. */
export function mayRide(def: CharacterDef): boolean {
  return def.rides !== false && def.rules === 'classic';
}

/* ---------- areas (YM-4) ---------- */

/** Overworld, underground and athletic areas; never castles, water or bonus rooms. */
export function mountArea(world: World): boolean {
  return mountLevel(world.level);
}

/** The same test for a level by its data (mountArea's). */
export function mountLevel(l: LevelData): boolean {
  if (l.bonus || isSwimLevel(l) || l.theme.startsWith('castle')) return false;
  // The coin rooms under pipes and the vine cloud areas (`<level>-bonus`, `<level>-sky`).
  return !/-(bonus|sky)\d*$/.test(l.id);
}

/* ---------- riding state ---------- */

interface Ride {
  base: CharacterDef;
  mount: YoshiMount;
}
const RIDES = new WeakMap<Player, Ride>();

export function ridingOf(p: Player): Ride | null {
  return RIDES.get(p) ?? null;
}

/** The base def under the overlay (the def itself when not riding). */
export function baseOf(p: Player): CharacterDef {
  return RIDES.get(p)?.base ?? p.def;
}

/** Whether any player has a Yoshi in play (ridden, waiting, fleeing, benched; YM-5). */
function yoshiInPlay(world: World): boolean {
  if (world.entities.some((e) => e instanceof YoshiMount && e.alive && e.state !== 'gone')) return true;
  if (world.entities.some((e) => e instanceof MountEgg && e.alive)) return true;
  return world.players.some((p) => (p.scratch[RIDE_KEY] ?? 0) > 0);
}

function say(world: World, text: string): void {
  world.events.push({ type: 'say', text });
}

/** Gets `p` on `yoshi` (YM-10): the overlay def, the pair's box, feet where they were. */
export function mount(p: Player, yoshi: YoshiMount, world: World, quiet = false): void {
  if (RIDES.has(p) || !mayRide(p.def)) return;
  const base = p.def;
  RIDES.set(p, { base, mount: yoshi });
  p.def = ridingDef(base);
  p.profile = { ...RIDE_PROFILE, coyoteFrames: p.profile.coyoteFrames };
  p.crouching = false;
  p.activeMelee = null;
  p.sliding = 0;
  const b = p.body;
  const feet = yoshi.body.y + yoshi.body.h;
  b.x = yoshi.body.x + ((yoshi.body.w - b.w) >> 1);
  b.y = feet - b.h;
  p.refitHitbox();
  p.facing = yoshi.facing;
  p.scratch[RIDE_KEY] = 1;
  yoshi.state = 'ridden';
  yoshi.rider = p;
  ensureFx(p, world);
  if (!quiet) say(world, 'Riding Yoshi');
}

export type Dismount = 'off' | 'leap' | 'hit' | 'flag' | 'bench' | 'park' | 'death';

/** The screen reader's line when Yoshi is left outside a castle, water or bonus area (YM-7). */
export const WAITS_SAID = 'Yoshi waits outside';

/** Gets `p` off (YM-7, YM-17, YM-19, YM-21): the base def back first, then what `how` does. */
export function dismount(p: Player, world: World, how: Dismount, fromDir: -1 | 1 = 1): void {
  const ride = RIDES.get(p);
  if (!ride) return;
  RIDES.delete(p);
  const { base, mount: yoshi } = ride;
  p.def = base;
  p.profile = { ...base.movement, coyoteFrames: p.profile.coyoteFrames };
  p.refitHitbox();
  p.activeMelee = null;
  clearMouth(p);
  delete p.scratch._tongue;
  yoshi.rider = null;
  const b = p.body;
  yoshi.body.x = b.x + ((b.w - yoshi.body.w) >> 1);
  yoshi.body.y = b.y + b.h - yoshi.body.h;
  yoshi.facing = p.facing;
  switch (how) {
    case 'off':
    case 'leap': {
      delete p.scratch[RIDE_KEY];
      // The rider's own ground jump from the saddle (Super Mario World's jump off Yoshi).
      const m = base.movement;
      b.vy = -(m.rise ? (m.rise.tiers[0]?.speed ?? 0x03000) : (m.jump[0]?.initial ?? 0x03000));
      b.onGround = false;
      yoshi.body.vy = 0;
      yoshi.state = how === 'leap' ? 'drop' : 'wait';
      // A rider who got off on purpose does not land straight back on (YM-19).
      yoshi.leftBy = p;
      yoshi.leftT = 0;
      if (how === 'leap') yoshi.body.onGround = false;
      break;
    }
    case 'hit':
      delete p.scratch[RIDE_KEY];
      b.vy = -THROW_VY;
      b.onGround = false;
      p.invuln = HIT_INVULN;
      p.scratch._hurtAt = p.frame;
      yoshi.state = 'flee';
      yoshi.fleeDir = fromDir;
      yoshi.facing = fromDir;
      world.audio.sfx('yoshi-cry');
      say(world, 'Yoshi ran away');
      break;
    case 'flag':
      // He sits at the pole's base, where the rider's hop off the pole lands, and the rider gets
      // back on there (yoshiClearHop) to walk to the castle and ride on into the next level
      // (YM-21, YM-7). The clear sequence holds every entity still, so he is put there now.
      yoshi.state = 'wait';
      yoshi.body.vy = 0;
      atPoleBase(yoshi, world);
      break;
    case 'bench':
      p.scratch[RIDE_KEY] = 2;
      yoshi.state = 'gone';
      yoshi.destroy();
      break;
    case 'park':
      // v0.4.73 item 74 (Super Mario World): off at the way into a castle, water or bonus area,
      // Yoshi sitting there waiting; benched (2) for the areas beyond, as 'bench'.
      p.scratch[RIDE_KEY] = 2;
      yoshi.state = 'wait';
      yoshi.parked = true;
      yoshi.body.vy = 0;
      yoshi.body.vx = 0;
      // The caller says WAITS_SAID, once for every Yoshi left at the same way in.
      break;
    case 'death':
      yoshi.state = 'gone';
      yoshi.destroy();
      break;
  }
}

/**
 * Yoshi on the ground at the flagpole's base (YM-21): where the clear sequence's hop puts the
 * rider (World.updateClear: 10 px right of the pole's column, feet on the base block), facing
 * back at the pole. With no pole near (the axe), straight down to the floor under him.
 */
function atPoleBase(yoshi: YoshiMount, world: World): void {
  const b = yoshi.body;
  let pole: Flagpole | null = null;
  for (const e of world.entities)
    if (e instanceof Flagpole && (!pole || Math.abs(e.body.x - b.x) < Math.abs(pole.body.x - b.x))) pole = e;
  if (pole && Math.abs(pole.body.x - b.x) < px(64)) {
    b.x = tileToSub(pole.tx) + px(10);
    b.y = px(pole.baseY) - b.h;
    yoshi.facing = -1;
    b.onGround = true;
    return;
  }
  const map = world.map;
  const col = tileAt(b.x + (b.w >> 1));
  for (let ty = Math.max(0, tileAt(b.y + b.h - 1)); ty < world.level.height; ty++)
    if (map.isSolid(col, ty)) {
      b.y = tileToSub(ty) - b.h;
      b.onGround = true;
      return;
    }
}

/**
 * ClassicRulesHooks.clearHop (YM-21): the flagpole's clear sequence just hopped `p` off the
 * pole's foot; a rider who rode up to the pole lands back on the Yoshi sitting there, and the
 * pair walks to the castle.
 */
export function yoshiClearHop(world: World, p: Player): void {
  if (!world.ctx.classicYoshi || RIDES.has(p) || p.scratch[RIDE_KEY] !== 1 || !mayRide(p.def)) return;
  const yoshi = world.entities.find(
    (e): e is YoshiMount => e instanceof YoshiMount && e.alive && e.state === 'wait' && e.rider === null,
  );
  if (!yoshi) return;
  // v0.4.73 item 74: the next level is a castle (or water): he stays sitting at the pole's base
  // and the hero walks on alone, as Yoshi waits outside Super Mario World's castles.
  if (benchedLevel(world, world.clearNext())) {
    p.scratch[RIDE_KEY] = 2;
    yoshi.parked = true;
    if (!world.events.some((e) => e.type === 'say' && e.text === WAITS_SAID)) say(world, WAITS_SAID);
    return;
  }
  const facing = p.facing;
  mount(p, yoshi, world, true);
  p.facing = facing;
}

/**
 * Whether the level `id` (a pipe's, or the clear's next) is a castle, water or bonus area: one
 * the mount is benched for. The area being left, or an id that is no bundled level (the world
 * map, the run's end), is not.
 */
export function benchedLevel(world: World, id: string): boolean {
  if (id === world.level.id) return false;
  let l: LevelData;
  try {
    l = getLevel(id);
  } catch {
    return false;
  }
  return !mountLevel(l);
}

/** v0.4.73 item 74: the hop off Yoshi before going on into a pipe, in frames. */
export const PARK_HOP = 20;

/**
 * ClassicRulesHooks.pipeEntry (v0.4.73 item 74): a rider starting into a pipe to a castle, water
 * or bonus area gets off (Super Mario World): Yoshi sits at the pipe, the hero hops off and goes
 * in on foot. Coming back out into an allowed area he rejoins as before (yoshiWorldLoaded).
 */
export function yoshiPipeEntry(world: World, p: Player, z: Zone & { kind: 'pipe' }, dir: PipeDir): number {
  if (!world.ctx.classicYoshi || !benchedLevel(world, z.target.level)) return 0;
  // Every rider goes along (World.enterPipe takes the other players in too; a dev free-play
  // Classic run can have two): each Yoshi waits, side by side, and the line is said once.
  const hops = RIDES.has(p);
  let slot = 0;
  for (const o of [p, ...world.players.filter((q) => q !== p)]) {
    const ride = RIDES.get(o);
    if (!ride) continue;
    dismount(o, world, 'park');
    parkBeside(ride.mount, p, world, z, dir, slot++);
  }
  if (slot > 0) say(world, WAITS_SAID);
  return hops ? PARK_HOP : 0;
}

/**
 * Where Yoshi waits at a pipe: beside a down pipe on the floor, on the side the hero who went in
 * came from (his back), else on the pipe top at that edge; behind the hero at a side pipe, or the
 * nearest free spot further back. Facing it. `slot`: a second Yoshi (co-op) sits one place
 * further out.
 */
function parkBeside(
  yoshi: YoshiMount,
  p: Player,
  world: World,
  z: Zone & { kind: 'pipe' },
  dir: PipeDir,
  slot = 0,
): void {
  const b = yoshi.body;
  const map = world.map;
  const back = p.facing > 0 ? -1 : 1;
  yoshi.facing = -back as -1 | 1;
  const fits = (x: number, feet: number): boolean => {
    for (let tx = tileAt(x); tx <= tileAt(x + b.w - 1); tx++)
      for (let ty = tileAt(feet - b.h); ty <= tileAt(feet - 1); ty++) if (map.isSolid(tx, ty)) return false;
    return true;
  };
  const step = back * (b.w + px(4)) * slot;
  if (dir === 'down') {
    const x = (back < 0 ? tileToSub(z.x) - b.w - px(2) : tileToSub(z.x + 2) + px(2)) + step;
    // Down from the pipe top's row to the first floor under him.
    for (let ty = z.y; ty < world.level.height; ty++) {
      const solid = map.isSolid(tileAt(x), ty) || map.isSolid(tileAt(x + b.w - 1), ty);
      if (!solid) continue;
      if (ty > z.y && fits(x, tileToSub(ty))) {
        b.x = x;
        b.y = tileToSub(ty) - b.h;
        b.onGround = true;
        return;
      }
      break;
    }
    // A wall or a pit beside the pipe: he sits on the pipe top at that edge (a second one at the
    // other edge).
    const edge = slot % 2 === 0 ? back : -back;
    b.x = edge < 0 ? tileToSub(z.x) : tileToSub(z.x + 2) - b.w;
    b.y = tileToSub(z.y) - b.h;
    b.onGround = true;
    return;
  }
  // A side pipe: behind the hero, feet on his floor (where the pair stood, if a wall is there).
  const feet = p.body.y + p.body.h;
  const x0 = (back < 0 ? p.body.x - b.w - px(2) : p.body.x + p.body.w + px(2)) + step;
  // A wall right behind: the nearest free spot further back (up to 3 tiles), else beside the hero.
  b.x = p.body.x;
  for (let d = 0; d <= px(48); d += px(4))
    if (fits(x0 + back * d, feet)) {
      b.x = x0 + back * d;
      break;
    }
  b.y = feet - b.h;
  b.onGround = true;
}

/* ---------- the overlay def (YM-9..YM-16, YM-25) ---------- */

/** What Special does for a rider this frame (YM-13): its own, its Attack shot instead, or nothing. */
export type MountSpecial = 'own' | 'attack' | 'none';

/** The per-hero table (YM-13). Absent ids: their own Special. */
export const MOUNT_SPECIAL: Readonly<Record<string, (p: Player) => MountSpecial>> = {
  mario: (p) => (p.powerState === 'fire' ? 'attack' : 'none'),
  luigi: (p) => (p.powerState === 'fire' ? 'attack' : 'none'),
  samus: (p) => ((p.scratch.missiles ?? 0) > 0 ? 'own' : 'attack'),
  pit: (p) => ((p.scratch.missiles ?? 0) > 0 ? 'own' : 'attack'),
  darkpit: (p) => ((p.scratch.missiles ?? 0) > 0 ? 'own' : 'attack'),
  megaman: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  bass: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  protoman: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  breakman: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  rock: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  cutman: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  fireman: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  iceman: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  francesca: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  doropie: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  rokko: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
  bill: (p) => (p.powerState === 'fire' ? 'own' : 'attack'),
};

/** A look rides as its hero (CharacterDef.lookOf, #179): its own row, else its hero's. */
export function mountSpecial(base: CharacterDef, p: Player): MountSpecial {
  return (MOUNT_SPECIAL[base.id] ?? MOUNT_SPECIAL[base.lookOf ?? base.id])?.(p) ?? 'own';
}

/** The rider's input: Attack is Yoshi's; Special stays, or becomes the Attack shot (YM-12, YM-13). */
function riderInput(input: InputFrame, mode: MountSpecial): InputFrame {
  const map = (a: Action): Action | null => {
    if (a === 'attack') return mode === 'attack' ? 'special' : null;
    if (a === 'special') return mode === 'own' ? 'special' : null;
    return a;
  };
  return {
    held: (a) => {
      const m = map(a);
      return m !== null && input.held(m);
    },
    pressed: (a) => {
      const m = map(a);
      return m !== null && input.pressed(m);
    },
    released: (a) => {
      const m = map(a);
      return m !== null && input.released(m);
    },
    bufferedJump: (n) => input.bufferedJump(n),
    consumeJumpBuffer: () => input.consumeJumpBuffer(),
    dirX: input.dirX,
  };
}

/** Kicked shells and red fire (YM-15; the owner's Super Mario World spit). */
const MOUNT_FIRE: ProjectileSpec = {
  ...FIREBALL_CLASSIC,
  kind: 'yoshi-fire',
  gravity: 0,
  bounceVy: null,
  speed: 0x03000,
  vy: 0,
  burstOnCeiling: false,
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: false },
};

/**
 * Spits the shell in the mouth (YM-15): a green shell or a Buzzy Beetle's as a kicked shell, a red
 * one as three fireballs spreading out (Super Mario World's red shell).
 */
function spitShell(p: Player, world: World): void {
  const fill = mouthOf(p);
  if (!fill) return;
  clearMouth(p);
  const m = mouthPoint(p);
  if (fill.shell === 'red') {
    for (const vy of [-0x01000, 0, 0x01000]) {
      const s = MOUNT_FIRE;
      world.spawn(new Projectile(m.x - px(s.w >> 1), m.y - px(s.h >> 1), p.facing, s, p, { vy }));
    }
    world.audio.sfx('fireball');
    world.addScore(fill.score, p.body.x, p.body.y);
    return;
  }
  const k = new Koopa(0, 0, fill.shell ?? 'green');
  k.stopShell();
  const b = k.body;
  b.h = px(14);
  b.x = m.x - (b.w >> 1) + (p.facing > 0 ? 0 : -b.w);
  b.y = p.feetY - b.h;
  k.activated = true;
  k.currentFrame = fill.shell === 'buzzy' ? 'buzzy-shell' : 'shell';
  world.spawn(k);
  k.kick(p.facing, world);
}

function rideBehaviour(base: CharacterDef): CharacterBehaviour {
  const b = base.behaviour;
  const behaviour: CharacterBehaviour = {
    update(p, input, world) {
      ensureFx(p, world);
      // Down + Jump gets off: on the ground a hop, in the air a leap (YM-19).
      if (input.held('down') && input.pressed('jump')) {
        // The press already started the pair's jump this frame when on the ground.
        const ground = p.body.onGround || (p.riseY0 !== null && p.riseY0 - p.feetY < px(6) && p.body.vy < 0);
        dismount(p, world, ground ? 'off' : 'leap');
        return;
      }
      tongueTick(p, world, 'mount');
      const fill = mouthOf(p);
      if (fill && world.frame - fill.at >= SHELL_HOLD) {
        clearMouth(p);
        world.addScore(fill.score, p.body.x, p.body.y);
        world.audio.sfx('yoshi-swallow');
      }
      if (!classicBusy(p) && input.pressed('attack')) {
        if (mouthOf(p)) spitShell(p, world);
        else if (!tongueOut(p)) startTongue(p, input.held('up'), world);
      }
      b.update(p, riderInput(input, mountSpecial(base, p)), world);
      // Melee is put away while riding (YM-13, YM-D10).
      p.activeMelee = null;
    },
    onPowerUp: (p, kind, world) => b.onPowerUp(p, kind, world),
    contactDamage: (p, e, world) => b.contactDamage(p, e, world),
    // YM-17: the mount takes the hit; the rider keeps their power.
    onHurt: (p, world, fromDir) => {
      dismount(p, world, 'hit', fromDir ?? 1);
      return 'ignored';
    },
    canGrabVine: () => false,
    // The rider's own clear first (Samus, Peach, Arthur, the Warriors end their states), then off.
    onLevelClear: (p) => {
      b.onLevelClear?.(p);
      const ride = RIDES.get(p);
      if (ride) dismount(p, ride.mount.world, 'flag');
    },
  };
  // The rider's other hooks pass through (Attack and Special mapped as riderInput maps them).
  if (b.onPickup) behaviour.onPickup = b.onPickup;
  if (b.blocks) behaviour.blocks = b.blocks;
  if (b.onRespawn) behaviour.onRespawn = b.onRespawn;
  if (b.canJump) behaviour.canJump = b.canJump;
  if (b.afterLifts) behaviour.afterLifts = b.afterLifts;
  const rooted = b.rooted;
  if (rooted) behaviour.rooted = (p, input) => rooted(p, riderInput(input, mountSpecial(base, p)));
  return behaviour;
}

/**
 * The pair's look (YM-20): Yoshi, with the rider's own frame cut at the saddle drawn over his back
 * (drawn over, not under him as the report has it, so the rider's face stays in front of his neck).
 */
function pairSprite(base: CharacterDef, p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  if (p.dead) return base.sprite(p, frame, reduceFlashing);
  const rider = base.sprite(p, frame, reduceFlashing);
  let name = 'stand';
  if (tongueOut(p)) name = 'tongue';
  else if (mouthOf(p)) name = 'full';
  else if (!p.body.onGround) name = 'jump';
  else if (p.anim === 'walk' || p.anim === 'skid') name = `walk-${p.walkFrame % 3}`;
  return {
    sheet: 'yoshi',
    palette: p.index > 0 ? 'yoshi-p2' : 'yoshi',
    frame: name,
    flip: p.facing < 0,
    offsetX: 3,
    offsetY: 32 - PAIR_H,
    // Over the saddle: the rider's middle 4 px in from the cell's back edge, the cut 16 px under the
    // cell top (tuning).
    rider: {
      sheet: rider.sheet,
      palette: rider.palette,
      frame: rider.frame,
      flip: rider.flip,
      dx: 4,
      dy: 16,
    },
  };
}

const OVERLAYS = new WeakMap<CharacterDef, CharacterDef>();

/** The def a rider plays while on Yoshi (YM-9..YM-13, YM-25), one per base def. */
export function ridingDef(base: CharacterDef): CharacterDef {
  let d = OVERLAYS.get(base);
  if (d) return d;
  d = {
    ...base,
    movement: RIDE_PROFILE,
    crouches: false,
    stomps: true,
    stompsSpiky: true,
    rides: false,
    hitbox: () => ({ w: PAIR_W, h: PAIR_H }),
    sprite: (p, frame, reduce) => pairSprite(base, p, frame, reduce),
    behaviour: rideBehaviour(base),
    touchLabels: (p, world) => {
      const own = base.touchLabels?.(p, world) ?? {};
      const mode = mountSpecial(base, p);
      return {
        ...own,
        attack: mouthOf(p) ? 'SPIT' : 'TONGUE',
        special: mode === 'own' ? (own.special ?? null) : mode === 'attack' ? (own.attack ?? 'SHOOT') : null,
      };
    },
  };
  delete d.meleeStrikesBlocks;
  // The pair is hit on its own 12 x 28 body (not the rider's hurt box at its feet) and steps
  // Yoshi's 3-pose walk, not the rider's cycle.
  delete d.hurtbox;
  delete d.walkAnim;
  OVERLAYS.set(base, d);
  return d;
}

/* ---------- Yoshi himself ---------- */

/** Yoshi off the saddle (YM-6, YM-8, YM-17, YM-19). */
export class YoshiMount extends Entity {
  readonly kind = 'yoshi-mount';
  state: 'wait' | 'walk' | 'ridden' | 'flee' | 'drop' | 'gone' = 'wait';
  rider: Player | null = null;
  fleeDir: -1 | 1 = 1;
  /**
   * The rider who just got off with Down + Jump (YM-19): not remounted until they have landed
   * clear of his back, or stood REMOUNT_WAIT frames after landing. Null: anyone may get on.
   */
  leftBy: Player | null = null;
  leftT = 0;
  /**
   * Left waiting at the way into a castle, water or bonus area (v0.4.73 item 74): he sits there,
   * nobody gets back on in this area (the rider is benched, RIDE_KEY 2).
   */
  parked = false;
  /** Frames walking after the hatch, and the drop's carried speed (stepping off the block). */
  private walkT = 0;
  private stepVx = 0;
  constructor(
    x: number,
    feet: number,
    readonly world: World,
  ) {
    super(x, feet - px(24), 12, 24);
    this.despawnMargin = null;
    this.spriteOffsetX = 3;
    this.spriteOffsetY = 8;
  }

  update(world: World): void {
    const b = this.body;
    if (this.state === 'gone') return this.destroy();
    if (this.parked) return;
    if (this.state === 'ridden') {
      const p = this.rider;
      if (!p || p.dead || !world.players.includes(p)) {
        if (p?.dead) dismount(p, world, 'death');
        else this.destroy();
        return;
      }
      b.x = p.body.x;
      b.y = p.body.y + p.body.h - b.h;
      this.facing = p.facing;
      return;
    }
    if (this.state === 'flee') {
      b.vx = this.fleeDir * FLEE_SPEED;
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) this.fleeDir = -this.fleeDir as -1 | 1;
      this.facing = this.fleeDir;
    } else if (this.state === 'walk' || (this.state === 'drop' && this.stepVx !== 0)) {
      // Fresh from the egg on top of its block: he steps off toward the player and drops down,
      // so a hero on the ground can get on (tuning; he waits after 96 frames on a wide ledge).
      b.vx = this.state === 'walk' ? this.facing * WALK_OFF : this.stepVx;
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) this.facing = -this.facing as -1 | 1;
      if (this.state === 'walk' && ++this.walkT > 96) this.state = 'wait';
    }
    // Gravity (wait, walk, drop, flee).
    b.vy = Math.min(b.vy + 0x00355, 0x04000);
    moveY(b, world.map, b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy));
    if (b.onGround) {
      b.vy = 0;
      if (this.state === 'drop') {
        this.state = 'wait';
        this.stepVx = 0;
      }
    } else if (this.state === 'walk') {
      this.state = 'drop';
      this.stepVx = b.vx;
    }
    // Into a pit, or off the screen: lost (YM-8).
    const camL = world.camera.x - px(this.state === 'wait' ? 256 : 16);
    const camR = world.camera.right + px(16);
    if (this.isBelowLevel() || b.x + b.w < camL || (this.state === 'flee' && b.x > camR)) {
      this.state = 'gone';
      return this.destroy();
    }
    const left = this.leftBy;
    if (left && left.body.onGround) {
      const clear = left.body.x + left.body.w <= b.x || left.body.x >= b.x + b.w;
      if (clear || ++this.leftT >= REMOUNT_WAIT) this.leftBy = null;
    }
    // Landing on his back (re)mounts (YM-6, YM-17).
    for (const p of world.players) {
      if (p.dead || p.out || p === this.leftBy || RIDES.has(p) || !mayRide(p.def) || p.fallSpeed <= 0)
        continue;
      const pb = p.body;
      const feet = pb.y + pb.h;
      if (pb.x + pb.w <= b.x || pb.x >= b.x + b.w) continue;
      if (feet < b.y - px(2) || feet > b.y + px(12)) continue;
      mount(p, this, world);
      return;
    }
  }

  render(r: Renderer, view: View): void {
    if (this.state === 'ridden' || this.state === 'gone') return;
    const sheet = view.assets.sheet('yoshi');
    const frame =
      this.state === 'flee'
        ? 'tongue'
        : this.state === 'drop'
          ? 'jump'
          : this.state === 'walk'
            ? `walk-${(view.frame >> 3) % 3}`
            : 'sit';
    const x = this.screenX(view);
    const flip = this.facing < 0;
    const fx = flip ? toPx(this.body.x) - view.camX - (24 - 12 - 3) : x;
    r.sprite(sheet, frame, fx, this.screenY(), flip);
    if (this.state === 'flee' && (view.frame & 8) === 0)
      r.sprite(sheet, 'tear', fx + (flip ? 16 : 6), this.screenY() + 6);
  }
}

/** The mount's egg (YM-5): the Top Secret Area's egg's look and timing; it hatches a waiting Yoshi. */
export class MountEgg extends YoshiEgg {
  private n = 0;
  override update(world: World): void {
    if (++this.n < EGG_HATCH_FRAME) return super.update(world);
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const feet = b.y + b.h;
    const sx = cx - px(8);
    world.spawn(new BrickPiece(sx, b.y, -0x01000, -0x04000, 'items:egg-shell'));
    world.spawn(new BrickPiece(sx + px(8), b.y, 0x01000, -0x04000, 'items:egg-shell'));
    world.spawn(new BrickPiece(sx, b.y + px(8), -0x01000, -0x02800, 'items:egg-shell'));
    world.spawn(new BrickPiece(sx + px(8), b.y + px(8), 0x01000, -0x02800, 'items:egg-shell'));
    this.destroy();
    const y = new YoshiMount(cx - px(6), feet, world);
    y.facing = world.nearestPlayer(cx).centerX < cx ? -1 : 1;
    y.state = 'walk';
    world.spawn(y);
    world.audio.sfx('yoshi-hatch');
    say(world, 'Yoshi hatched');
  }
}

/* ---------- the Classic hooks (registry.ts) ---------- */

const EGG_BLOCKS = new WeakMap<World, string>();

/** The egg block of an area (YM-5), for tests: "tx,ty", or null. */
export function eggBlockOf(world: World): string | null {
  return EGG_BLOCKS.get(world) ?? null;
}

/**
 * ClassicRulesHooks.worldLoaded (YM-5, YM-7): with the mount on and an allowed area, marks the
 * area's first power-up ? block (lowest column, then lowest row; hidden blocks and power-up
 * bricks are left alone, so nothing looks different) and puts a carried rider back on Yoshi; in a
 * castle, water or bonus area a carried Yoshi waits outside (benched).
 */
export function yoshiWorldLoaded(world: World): void {
  const mode = world.ctx.classicYoshi;
  if (!mode) return;
  const allowed = mountArea(world);
  if (allowed) {
    const map = world.map;
    outer: for (let tx = 0; tx < world.level.width; tx++)
      for (let ty = 0; ty < world.level.height; ty++)
        if (map.get(tx, ty) === T.Q_POWERUP) {
          EGG_BLOCKS.set(world, `${tx},${ty}`);
          break outer;
        }
  }
  for (const p of world.players) {
    const carried = p.scratch[RIDE_KEY] ?? 0;
    const ride = carried > 0 || (mode === 'ride' && mayRide(p.def));
    if (!ride) continue;
    if (!allowed) {
      if (carried === 1) say(world, WAITS_SAID);
      p.scratch[RIDE_KEY] = 2;
      continue;
    }
    const y = new YoshiMount(p.body.x, p.body.y + p.body.h, world);
    y.facing = p.facing;
    world.spawn(y);
    mount(p, y, world);
  }
}

/**
 * 0.4.72 (Show hidden items, ClassicRulesHooks.blockShown): the area's egg block shows the egg
 * while a strike by `p` would give it (yoshiEggStrike's own test), else null.
 */
export function yoshiEggShown(world: World, tx: number, ty: number, p: Player): 'egg' | null {
  if (!world.ctx.classicYoshi || EGG_BLOCKS.get(world) !== `${tx},${ty}`) return null;
  if (world.map.get(tx, ty) !== T.Q_POWERUP) return null;
  return mayRide(p.def) && !RIDES.has(p) && !yoshiInPlay(world) ? 'egg' : null;
}

/**
 * Before World.strikeBlock's Classic strike (YM-5): the area's egg block, struck by a hero who may
 * ride while no Yoshi is in play, gives the egg instead of its Mushroom or Flower. Null: the usual
 * strike (always with the mount off).
 */
export function yoshiEggStrike(world: World, tx: number, ty: number, p: Player): BlockStrike | null {
  if (!world.ctx.classicYoshi) return null;
  if (EGG_BLOCKS.get(world) !== `${tx},${ty}`) return null;
  if (world.map.get(tx, ty) !== T.Q_POWERUP) return null;
  if (!mayRide(p.def) || RIDES.has(p) || yoshiInPlay(world)) return null;
  // The Top Secret Area's egg content does the bump, the used block and the sound; the egg it
  // spawns is swapped for the mount's.
  world.map.set(tx, ty, T.Q_EGG);
  const before = world.entities.length;
  world.bumpBlock(tx, ty, p, false);
  for (let i = before; i < world.entities.length; i++) {
    const e = world.entities[i];
    if (e instanceof YoshiEgg && !(e instanceof MountEgg)) world.entities[i] = new MountEgg(tx, ty);
  }
  if (tileDef(world.map.get(tx, ty)).block?.content === 'egg') world.map.set(tx, ty, T.USED);
  return { broken: false, bumped: true, hp: 0 };
}
