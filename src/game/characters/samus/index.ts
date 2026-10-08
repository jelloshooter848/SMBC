import { px, tileAt } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { Bomb } from '../../entities/objects/bomb';
import { STAR_FRAMES } from '../../constants';
import { SAMUS_GUIDE } from './guide';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { BEAMS, ICE_BEAM, LONG_BEAM, MISSILE, POWER_BEAM, WAVE_BEAM } from './weapons';
import { has, isFound } from '../../items/flags';

/** Armoured bounty hunter: floaty cut-able jump with a somersault, arm cannon, morph ball. */
export const SAMUS_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x00180,
  walkAccel: 0x00100,
  runAccel: 0x00100,
  releaseDecel: 0x00180,
  skidDecel: 0x00300,
  maxWalk: 0x01400, // 1.25 px/f
  maxRun: 0x01400,
  skidTurnaround: 0x00900,
  jump: [{ maxVx: Infinity, initial: 0x04800, holdGravity: 0x00240, fallGravity: 0x00240 }], // apex ≈ 4.5 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: 'cut',
  instantAccel: false,
  coyoteFrames: 0,
  // Under water (0.4.25, TUNED by feel after Metroid's liquids): no stroke; she walks the bottom
  // and jumps off it about 9 tiles high, floating down slowly.
  swim: { mode: 'seabed', stroke: 0x03c00, gravity: 0x000c8, sinkMax: 0x01555 },
};

export const START_ENERGY = 30;
export const TANK_ENERGY = 30;
export const MAX_TANKS = 2;
/**
 * The campaign's Energy Tanks (decision 6, NES Metroid style): up to six reserve tanks of 10
 * energy each over the 30-energy bar, so six give today's maximum of 90.
 */
export const RESERVE_TANK_ENERGY = 10;
export const MAX_RESERVE_TANKS = 6;
export const MAX_MISSILES = 30;
const CONTACT_DAMAGE = 8;
const SHOOT_POSE_FRAMES = 12;
const MAX_MORPH_BOMBS = 3;
/** Bomb-jump kick when the ball sits in its own blast. */
const BOMB_JUMP_VY = 0x02800;

/** Scratch keys: varia, tanks, maxHp, beam (0..3), missiles, tool, ball, aimUp. */
export function maxHp(p: Player): number {
  return p.scratch.maxHp ?? START_ENERGY;
}
export function missiles(p: Player): number {
  return p.scratch.missiles ?? 0;
}
/** A beam without the Long Beam: it fizzles after about five tiles, as the Power Beam. */
const short = (spec: ProjectileSpec): ProjectileSpec => ({ ...spec, lifetime: POWER_BEAM.lifetime });
const SHORT_ICE = short(ICE_BEAM);
const SHORT_WAVE = short(WAVE_BEAM);
function beam(p: Player): ProjectileSpec {
  if (isFound(p)) {
    // Campaign: Ice and Wave are both kept and picked on the belt; the Long Beam gives range to
    // whichever is in use (docs/POWERUPS.md 5.4).
    const long = has(p, 'long-beam');
    const t = activeTool(p, tools(p))?.id;
    if (t === 'ice') return long ? ICE_BEAM : SHORT_ICE;
    if (t === 'wave') return long ? WAVE_BEAM : SHORT_WAVE;
    return long ? LONG_BEAM : POWER_BEAM;
  }
  return BEAMS[Math.min(BEAMS.length - 1, p.scratch.beam ?? 0)] as ProjectileSpec;
}

/**
 * Her reserve tanks for the HUD (small boxes above the EN number): `full` of `total` tanks hold
 * energy, `bar` is what the EN number shows. Hit points are her whole energy; the bar runs out
 * first and then a tank refills it.
 */
export function energyTanks(p: Player): { full: number; total: number; bar: number } | null {
  const total = p.scratch.tanks ?? 0;
  if (total <= 0) return null;
  const size = (maxHp(p) - START_ENERGY) / total;
  if (!(size > 0)) return null;
  const full = Math.max(0, Math.min(total, Math.floor((p.hp - 1) / size)));
  return { full, total, bar: Math.max(0, p.hp - full * size) };
}
function inBall(p: Player): boolean {
  return (p.scratch.ball ?? 0) > 0;
}

function tools(p: Player): ToolInfo[] {
  const missile: ToolInfo = {
    id: 'missile',
    icon: 'icon-missile',
    count: missiles(p),
    usable: missiles(p) > 0,
  };
  if (!isFound(p)) return [{ id: 'beam', icon: 'icon-beam', count: null, usable: true }, missile];
  // Campaign: WEAPON cycles the beam, Ice, Wave and missiles she has found.
  const list: ToolInfo[] = [{ id: 'beam', icon: 'icon-beam', count: null, usable: true }];
  if (has(p, 'ice-beam')) list.push({ id: 'ice', icon: 'icon-ice-beam', count: null, usable: true });
  if (has(p, 'wave-beam')) list.push({ id: 'wave', icon: 'icon-wave-beam', count: null, usable: true });
  if (has(p, 'missiles')) list.push(missile);
  return list;
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = p.scratch.varia ? 'samus-varia' : 'samus';
  if (p.star > 0) palette = `samus-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  const b = p.body;
  let name: string;
  let offsetY = 8;
  const shooting = p.attackTimer > 0;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if (inBall(p)) {
    // Rolls with the distance travelled.
    name = `ball-${(b.x >> 11) & 3}`;
    offsetY = 20;
  } else if (p.scratch.aimUp) name = 'aim-up';
  else if (!b.onGround) name = shooting || b.vx === 0 ? 'jump' : `spin-${(frame >> 2) & 3}`;
  else if (p.anim === 'walk' || p.anim === 'skid')
    name = shooting ? `walk-shoot-${p.walkFrame}` : `walk-${p.walkFrame}`;
  else name = shooting ? 'shoot' : 'idle';
  return { sheet: 'samus', palette, frame: name, flip: p.facing < 0, offsetX: 2, offsetY };
}

/** Room to stand up: the two tiles above the ball must be clear. */
function headRoom(p: Player, world: World): boolean {
  const b = p.body;
  const feet = b.y + b.h;
  const top = feet - px(24);
  for (const x of [b.x, b.x + b.w - 1])
    for (let y = top; y < feet - px(12); y += px(8))
      if (world.map.isSolid(tileAt(x), tileAt(y))) return false;
  return true;
}

function fire(p: Player, spec: ProjectileSpec, world: World): void {
  const b = p.body;
  const up = !!p.scratch.aimUp;
  let x: number;
  let y: number;
  const opts: { vx?: number; vy?: number } = {};
  if (up) {
    x = b.x + (b.w >> 1) - px(spec.w >> 1) + p.facing * px(2);
    y = b.y - px(spec.h);
    opts.vx = 0;
    opts.vy = -spec.speed;
  } else {
    x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
    y = b.y + px(6);
  }
  world.spawn(new Projectile(x, y, p.facing, spec, p, opts));
  p.attackTimer = SHOOT_POSE_FRAMES;
}

function fireBeam(p: Player, world: World): void {
  if (world.countProjectiles(p, 'beam') >= 2) return;
  fire(p, beam(p), world);
  world.audio.sfx('buster');
}

function fireMissile(p: Player, world: World): void {
  if (missiles(p) <= 0) {
    world.audio.sfx('bump');
    return;
  }
  p.scratch.missiles = missiles(p) - 1;
  fire(p, MISSILE, world);
  world.audio.sfx('missile');
}

function dropMorphBomb(p: Player, world: World): void {
  const out = world.entities.filter((e) => e instanceof Bomb && e.alive && e.owner === p).length;
  if (out >= MAX_MORPH_BOMBS) return;
  const b = p.body;
  world.spawn(
    new Bomb(b.x + (b.w >> 1), b.y + b.h, p, {
      fuse: 40,
      radiusPx: 12,
      amount: 1,
      hurtsPlayers: false,
      small: true,
      frames: ['morph-bomb-0', 'morph-bomb-1'],
      size: 8,
      onDetonate(w, cx, cy) {
        // Bomb jump: a ball sitting in its own blast gets kicked upward.
        if (!inBall(p) || p.dead) return;
        const pb = p.body;
        if (Math.abs(pb.x + (pb.w >> 1) - cx) <= px(12) && Math.abs(pb.y + pb.h - cy) <= px(16)) {
          pb.vy = -BOMB_JUMP_VY;
          pb.onGround = false;
          w.audio.sfx('jump-small');
        }
      },
    }),
  );
  world.audio.sfx('kick');
}

export const SAMUS: CharacterDef = {
  id: 'samus',
  name: 'Samus',
  hudName: 'SAMUS',
  movement: SAMUS_PROFILE,
  damage: {
    kind: 'hp',
    max: START_ENERGY + TANK_ENERGY * MAX_TANKS,
    hudStyle: 'number',
    invulnFrames: 40,
    knockback: { vx: 0x01000, vy: 0x02000 },
  },
  startHp: START_ENERGY,
  stomps: false,
  crouches: false,
  canBreakBricks: () => true, // bombs and missiles open blocks; so does a head bump here
  hitbox: (p) => (inBall(p) ? { w: 12, h: 12 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: (p) =>
    !p.scratch.varia
      ? 'mushroom'
      : (p.scratch.beam ?? 0) < BEAMS.length - 1
        ? 'flower'
        : (p.scratch.tanks ?? 0) < MAX_TANKS
          ? 'mushroom'
          : 'flower',
  jumpSfx: () => 'jump-big',
  portrait: { sheet: 'samus', palette: 'samus', frame: 'idle' },
  tools,
  energyTanks,
  devKit: () => ({
    varia: 1,
    tanks: MAX_TANKS,
    maxHp: START_ENERGY + TANK_ENERGY * MAX_TANKS,
    beam: BEAMS.length - 1,
    missiles: MAX_MISSILES,
  }),
  drop(rng, _enemy, killer) {
    const r = rng.int(12);
    if (r < 4) return 'energy-small';
    if (r === 4) return 'energy-large';
    // Campaign: missile packs only once she owns Missiles (decision 8).
    if (r < 7) return !killer || !isFound(killer) || has(killer, 'missiles') ? 'missile-pack' : null;
    return null;
  },
  guide: SAMUS_GUIDE,
  touchLabels(p) {
    // In the ball both buttons drop bombs (and A does nothing: canJump). Standing, B fires the
    // selected beam or missile and C always a missile; a missile button hides with none left.
    if (inBall(p)) return { attack: 'BOMB', special: 'BOMB', select: 'WEAPON' };
    const missile = missiles(p) > 0 ? 'MISSILE' : null;
    const missileSelected = activeTool(p, tools(p))?.id === 'missile';
    return { attack: missileSelected ? missile : 'SHOOT', special: missile, select: 'WEAPON' };
  },
  behaviour: {
    canJump: (p) => !inBall(p),
    // Character.getOnVine → setState("vine") replaces ST_BALL: she climbs standing.
    onGrabVine(p) {
      p.scratch.aimUp = 0;
      if (!inBall(p)) return;
      p.scratch.ball = 0;
      p.refitHitbox();
    },
    // She takes Castlevania stairs standing too (no morph ball on them).
    onGrabStairs(p) {
      if (!inBall(p)) return;
      p.scratch.ball = 0;
      p.refitHitbox();
    },
    update(p, input, world) {
      const b = p.body;
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.transition) {
        p.scratch.aimUp = 0;
        return;
      }
      // Morph ball: down curls up, up stands (when there is room).
      if (!inBall(p) && input.pressed('down') && b.onGround && !p.stairs) {
        p.scratch.ball = 1;
        p.scratch.aimUp = 0;
        p.refitHitbox();
      } else if (inBall(p) && input.pressed('up') && headRoom(p, world)) {
        p.scratch.ball = 0;
        p.refitHitbox();
      }
      if (inBall(p)) {
        if (input.pressed('attack') || input.pressed('special')) dropMorphBomb(p, world);
        return;
      }
      p.scratch.aimUp = input.held('up') ? 1 : 0;
      const missileSelected = activeTool(p, tools(p))?.id === 'missile';
      if (input.pressed('attack')) {
        if (missileSelected) fireMissile(p, world);
        else fireBeam(p, world);
      }
      if (input.pressed('special')) fireMissile(p, world);
    },
    onPickup(p, kind, world) {
      switch (kind) {
        case 'energy-small':
        case 'energy-large':
          if (p.hp >= maxHp(p)) return false;
          p.hp = Math.min(maxHp(p), p.hp + (kind === 'energy-small' ? 5 : 20));
          world.audio.sfx('pickup');
          return true;
        case 'missile-pack':
          if (missiles(p) >= MAX_MISSILES) return false;
          p.scratch.missiles = Math.min(MAX_MISSILES, missiles(p) + 2);
          world.audio.sfx('pickup');
          return true;
        default:
          return false;
      }
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom':
          if (!p.scratch.varia)
            p.scratch.varia = 1; // the Varia suit halves damage
          else if ((p.scratch.tanks ?? 0) < MAX_TANKS) {
            p.scratch.tanks = (p.scratch.tanks ?? 0) + 1;
            p.scratch.maxHp = START_ENERGY + TANK_ENERGY * p.scratch.tanks;
          }
          p.hp = maxHp(p);
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        case 'flower':
          if ((p.scratch.beam ?? 0) < BEAMS.length - 1) p.scratch.beam = (p.scratch.beam ?? 0) + 1;
          else p.scratch.missiles = Math.min(MAX_MISSILES, missiles(p) + 10);
          p.hp = maxHp(p);
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        case 'star':
          p.star = STAR_FRAMES;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.playMusic('star');
          break;
        case '1up':
          world.addLife(p.body.x, p.body.y - px(16));
          break;
      }
    },
    contactDamage() {
      return null;
    },
    onHurt(p, world) {
      p.hp -= p.scratch.varia ? CONTACT_DAMAGE / 2 : CONTACT_DAMAGE;
      if (p.hp <= 0) {
        p.hp = 0;
        return 'dead';
      }
      p.invuln = 40;
      world.audio.sfx('hit');
      return 'hurt';
    },
  },
};
