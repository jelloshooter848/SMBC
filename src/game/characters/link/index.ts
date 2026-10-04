import { px } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile, SWORD_BEAM, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { Bomb } from '../../entities/objects/bomb';
import { STAR_FRAMES } from '../../constants';
import { LINK_GUIDE } from './guide';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';

/** Sword-and-shield adventurer: fixed-height jump, no run, hearts, sword melee and a down-thrust. */
export const LINK_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x00180,
  walkAccel: 0x00140,
  runAccel: 0x00140,
  releaseDecel: 0x00200,
  skidDecel: 0x00300,
  maxWalk: 0x01800, // 1.5 px/f
  maxRun: 0x01800,
  skidTurnaround: 0x00900,
  jump: [{ maxVx: Infinity, initial: 0x04c00, holdGravity: 0x00280, fallGravity: 0x00280 }], // apex ≈ 4.5 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: false,
  coyoteFrames: 0,
};

export const MAX_HEARTS = 8;
export const MAX_MAGIC = 32;
export const MAX_BOMBS = 8;
const ATTACK_FRAMES = 12;
const THROW_FRAMES = 10;
/** Spell costs (magic points) and durations (frames). */
export const JUMP_SPELL = { cost: 8, frames: 600, boost: 1.25 };
export const SHIELD_SPELL = { cost: 8, frames: 600 };
export const FIRE_SPELL = { cost: 4 };

/** Thrown with C: flies out, turns back after a bit and stuns whatever it clips. */
export const BOOMERANG: ProjectileSpec = {
  kind: 'boomerang',
  damage: 'boomerang',
  amount: 1,
  speed: 0x03000,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: 300,
  w: 8,
  h: 8,
  sheet: 'items',
  frames: ['boomerang-0', 'boomerang-1', 'boomerang-2', 'boomerang-3'],
  frameRate: 2,
  pierce: true,
  returns: { after: 36 },
};

function maxHp(p: Player): number {
  return p.scratch.maxHp ?? 6;
}
function magic(p: Player): number {
  return p.scratch.magic ?? MAX_MAGIC;
}
function bombs(p: Player): number {
  return p.scratch.bombs ?? 0;
}

/** Shield up: standing or walking on the ground, not swinging, crouching or hurt. */
function shieldUp(p: Player): boolean {
  return (
    p.body.onGround &&
    p.attackTimer === 0 &&
    !p.crouching &&
    p.stun === 0 &&
    !p.scratch.throwT &&
    !p.transition
  );
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = p.scratch.beam ? 'link-red' : p.scratch.tunic ? 'link-white' : 'link';
  if (p.star > 0) palette = `link-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  let name: string;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if (p.scratch.downThrust) name = 'down-thrust';
  else if (p.scratch.upThrust) name = 'up-thrust';
  else if ((p.scratch.throwT ?? 0) > 0) name = 'throw';
  else if (p.attackTimer > 0) {
    if (p.crouching) name = 'crouch-attack';
    else name = p.attackTimer > 8 ? 'attack-0' : p.attackTimer > 3 ? 'attack-1' : 'attack-2';
  } else {
    switch (p.anim) {
      case 'walk':
        name = `walk-${p.walkFrame}`;
        break;
      case 'skid':
        name = `walk-1`;
        break;
      case 'jump':
        name = 'jump';
        break;
      case 'crouch':
        name = 'crouch';
        break;
      case 'climb':
        name = `climb-${(frame >> 3) & 1}`;
        break;
      default:
        name = shieldUp(p) ? 'block' : 'idle';
    }
  }
  return {
    sheet: 'link',
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.crouching ? 16 : 8,
  };
}

function tools(p: Player): ToolInfo[] {
  return [
    { id: 'boomerang', icon: 'icon-boomerang', count: null, usable: !p.scratch.boomerangOut },
    { id: 'bomb', icon: 'icon-bomb', count: bombs(p), usable: bombs(p) > 0 },
    { id: 'jump', icon: 'icon-jump', count: null, usable: magic(p) >= JUMP_SPELL.cost },
    { id: 'shield', icon: 'icon-shield', count: null, usable: magic(p) >= SHIELD_SPELL.cost },
    { id: 'fire', icon: 'icon-fire', count: null, usable: magic(p) >= FIRE_SPELL.cost },
  ];
}

function spendMagic(p: Player, cost: number, world: World): boolean {
  if (magic(p) < cost) {
    world.audio.sfx('bump');
    return false;
  }
  p.scratch.magic = magic(p) - cost;
  world.audio.sfx('magic');
  return true;
}

function useTool(p: Player, world: World): void {
  const t = activeTool(p, tools(p));
  if (!t) return;
  const b = p.body;
  switch (t.id) {
    case 'boomerang': {
      if (world.countProjectiles(p, 'boomerang') > 0) return;
      const x = p.facing > 0 ? b.x + b.w : b.x - px(8);
      world.spawn(new Projectile(x, b.y + px(8), p.facing, BOOMERANG, p));
      world.audio.sfx('boomerang');
      p.scratch.throwT = THROW_FRAMES;
      break;
    }
    case 'bomb': {
      if (bombs(p) <= 0) {
        world.audio.sfx('bump');
        return;
      }
      p.scratch.bombs = bombs(p) - 1;
      world.spawn(new Bomb(b.x + (b.w >> 1) + p.facing * px(10), b.y + b.h, p));
      world.audio.sfx('kick');
      p.scratch.throwT = THROW_FRAMES;
      break;
    }
    case 'jump':
      if (spendMagic(p, JUMP_SPELL.cost, world)) p.scratch.jumpSpell = JUMP_SPELL.frames;
      break;
    case 'shield':
      if (spendMagic(p, SHIELD_SPELL.cost, world)) p.scratch.shieldSpell = SHIELD_SPELL.frames;
      break;
    case 'fire':
      if (p.scratch.fireSpell) return;
      if (spendMagic(p, FIRE_SPELL.cost, world)) p.scratch.fireSpell = 1;
      break;
  }
}

/** The Jump spell raises every jump tier's takeoff speed while it lasts. */
function applyJumpSpell(p: Player): void {
  const want = (p.scratch.jumpSpell ?? 0) > 0;
  const base = p.def.movement.jump[0]?.initial ?? 0;
  const boosted = (p.profile.jump[0]?.initial ?? 0) !== base; // profiles are rebuilt per level
  if (boosted === want) return;
  p.profile = {
    ...p.profile,
    jump: p.def.movement.jump.map((t) => ({
      ...t,
      initial: want ? Math.round(t.initial * JUMP_SPELL.boost) : t.initial,
    })),
  };
}

export const LINK: CharacterDef = {
  id: 'link',
  name: 'Link',
  hudName: 'LINK',
  movement: LINK_PROFILE,
  damage: {
    kind: 'hp',
    max: 6,
    hudStyle: 'hearts',
    invulnFrames: 60,
    knockback: { vx: 0x01800, vy: 0x02800 },
  },
  stomps: false,
  crouches: true,
  canBreakBricks: () => true,
  hitbox: (p) => (p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: (p) =>
    !p.scratch.tunic || maxHp(p) < MAX_HEARTS * 2 || p.hp < maxHp(p) ? 'mushroom' : 'flower',
  jumpSfx: () => 'jump-big',
  portrait: { sheet: 'link', palette: 'link', frame: 'idle' },
  tools,
  meter: (p) => ({ value: magic(p), max: MAX_MAGIC, colour: '#3cbcfc', label: 'M' }),
  devKit: () => ({ maxHp: MAX_HEARTS * 2, tunic: 1, beam: 1, bombs: MAX_BOMBS, magic: MAX_MAGIC }),
  drop(rng) {
    const r = rng.int(16);
    if (r < 4) return 'bomb';
    if (r < 8) return 'magic-small';
    if (r === 8) return 'heart-small';
    return null;
  },
  guide: LINK_GUIDE,
  behaviour: {
    update(p, input, world) {
      const b = p.body;
      if (p.scratch.jumpSpell) p.scratch.jumpSpell--;
      if (p.scratch.shieldSpell) p.scratch.shieldSpell--;
      if (p.scratch.throwT) p.scratch.throwT--;
      applyJumpSpell(p);
      p.scratch.boomerangOut = world.countProjectiles(p, 'boomerang') > 0 ? 1 : 0;
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.transition) {
        p.activeMelee = null;
        p.scratch.upThrust = 0;
        return;
      }
      if (input.pressed('special') && p.attackTimer === 0) useTool(p, world);
      // Down-thrust: hold down in the air; the sword box sits under the feet.
      const thrusting = !b.onGround && input.held('down') && p.attackTimer === 0;
      p.scratch.downThrust = thrusting ? 1 : 0;
      if (thrusting) {
        p.activeMelee = { x: b.x + px(2), y: b.y + b.h, w: px(8), h: px(8) };
        return;
      }
      if (input.pressed('attack') && p.attackTimer === 0 && !p.scratch.throwT) {
        p.attackTimer = ATTACK_FRAMES;
        world.audio.sfx('sword');
        if (!b.onGround && input.held('up')) p.scratch.upThrust = 1;
        else {
          const beam = (p.scratch.beam && p.hp >= maxHp(p)) || p.scratch.fireSpell;
          if (beam && world.countProjectiles(p, 'sword-beam') < 1) {
            const x = p.facing > 0 ? b.x + b.w : b.x - px(16);
            world.spawn(new Projectile(x, b.y + px(8), p.facing, SWORD_BEAM, p));
            p.scratch.fireSpell = 0;
          }
        }
      }
      if (p.attackTimer === 0) p.scratch.upThrust = 0;
      if (p.attackTimer >= 3 && p.attackTimer <= 8) {
        if (p.scratch.upThrust) {
          p.activeMelee = { x: b.x + px(2), y: b.y - px(10), w: px(8), h: px(10) };
        } else {
          const y = b.y + (p.crouching ? px(8) : px(10));
          p.activeMelee =
            p.facing > 0
              ? { x: b.x + b.w, y, w: px(14), h: px(6) }
              : { x: b.x - px(14), y, w: px(14), h: px(6) };
        }
      } else p.activeMelee = null;
    },
    onMeleeHit(p) {
      if (p.scratch.downThrust) p.stompBounce();
    },
    blocks(p, proj) {
      // The shield covers the front: anything flying toward Link from the side he faces.
      return shieldUp(p) && proj.body.vx * p.facing < 0;
    },
    onPickup(p, kind, world) {
      switch (kind) {
        case 'bomb':
          if (bombs(p) >= MAX_BOMBS) return false;
          p.scratch.bombs = bombs(p) + 1;
          break;
        case 'magic-small':
        case 'magic-large':
          if (magic(p) >= MAX_MAGIC) return false;
          p.scratch.magic = Math.min(MAX_MAGIC, magic(p) + (kind === 'magic-small' ? 8 : MAX_MAGIC));
          break;
        case 'heart-small':
          if (p.hp >= maxHp(p)) return false;
          p.hp = Math.min(maxHp(p), p.hp + 1);
          break;
      }
      world.audio.sfx('pickup');
      return true;
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom':
          // A heart container, and the white tunic that softens blows.
          p.scratch.maxHp = Math.min(MAX_HEARTS * 2, maxHp(p) + 2);
          p.scratch.tunic = 1;
          p.hp = maxHp(p);
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        case 'flower':
          p.scratch.beam = 1;
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
      // White tunic / Shield spell: every other hit glances off.
      const protectedHit = p.scratch.tunic || (p.scratch.shieldSpell ?? 0) > 0;
      if (protectedHit && !p.scratch.halfHit) {
        p.scratch.halfHit = 1;
        p.invuln = 60;
        world.audio.sfx('bump');
        return 'hurt';
      }
      p.scratch.halfHit = 0;
      p.hp -= 1;
      if (p.hp <= 0) {
        p.hp = 0;
        return 'dead';
      }
      p.invuln = 60;
      world.audio.sfx('hit');
      return 'hurt';
    },
  },
};
