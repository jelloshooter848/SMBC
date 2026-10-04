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
import { BEAMS, MISSILE } from './weapons';

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
};

export const START_ENERGY = 30;
export const TANK_ENERGY = 30;
export const MAX_TANKS = 2;
export const MAX_MISSILES = 30;
const CONTACT_DAMAGE = 8;
const SHOOT_POSE_FRAMES = 12;
const MAX_MORPH_BOMBS = 3;
/** Bomb-jump kick when the ball sits in its own blast. */
const BOMB_JUMP_VY = 0x02800;

/** Scratch keys: varia, tanks, maxHp, beam (0..3), missiles, tool, ball, aimUp. */
function maxHp(p: Player): number {
  return p.scratch.maxHp ?? START_ENERGY;
}
function missiles(p: Player): number {
  return p.scratch.missiles ?? 0;
}
function beam(p: Player): ProjectileSpec {
  return BEAMS[Math.min(BEAMS.length - 1, p.scratch.beam ?? 0)] as ProjectileSpec;
}
function inBall(p: Player): boolean {
  return (p.scratch.ball ?? 0) > 0;
}

function tools(p: Player): ToolInfo[] {
  return [
    { id: 'beam', icon: 'icon-beam', count: null, usable: true },
    { id: 'missile', icon: 'icon-missile', count: missiles(p), usable: missiles(p) > 0 },
  ];
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
  devKit: () => ({
    varia: 1,
    tanks: MAX_TANKS,
    maxHp: START_ENERGY + TANK_ENERGY * MAX_TANKS,
    beam: BEAMS.length - 1,
    missiles: MAX_MISSILES,
  }),
  drop(rng) {
    const r = rng.int(12);
    if (r < 4) return 'energy-small';
    if (r === 4) return 'energy-large';
    if (r < 7) return 'missile-pack';
    return null;
  },
  guide: SAMUS_GUIDE,
  behaviour: {
    canJump: (p) => !inBall(p),
    update(p, input, world) {
      const b = p.body;
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.transition) {
        p.scratch.aimUp = 0;
        return;
      }
      // Morph ball: down curls up, up stands (when there is room).
      if (!inBall(p) && input.pressed('down') && b.onGround) {
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
