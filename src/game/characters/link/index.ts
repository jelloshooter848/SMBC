import { px } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import { Projectile, SWORD_BEAM } from '../../entities/projectiles/projectile';
import { STAR_FRAMES } from '../../constants';

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

const MAX_HEARTS = 8;
const ATTACK_FRAMES = 12;

function maxHp(p: Player): number {
  return p.scratch.maxHp ?? 6;
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = p.scratch.beam ? 'link-red' : 'link';
  if (p.star > 0) palette = `link-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  let name: string;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if (p.scratch.downThrust) name = 'down-thrust';
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
        name = 'idle';
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
  blockPowerUp: (p) => (maxHp(p) < MAX_HEARTS * 2 || p.hp < maxHp(p) ? 'mushroom' : 'flower'),
  jumpSfx: () => 'jump-big',
  portrait: { sheet: 'link', palette: 'link', frame: 'idle' },
  behaviour: {
    update(p, input, world) {
      const b = p.body;
      // Down-thrust: hold down in the air; the sword box sits under the feet.
      const thrusting = !b.onGround && input.held('down') && p.stun === 0 && p.attackTimer === 0;
      p.scratch.downThrust = thrusting ? 1 : 0;
      if (thrusting) {
        p.activeMelee = { x: b.x + px(2), y: b.y + b.h, w: px(8), h: px(8) };
        return;
      }
      if (input.pressed('attack') && p.attackTimer === 0 && p.stun === 0) {
        p.attackTimer = ATTACK_FRAMES;
        world.audio.sfx('sword');
        if (p.scratch.beam && p.hp >= maxHp(p) && world.countProjectiles(p, 'sword-beam') < 1) {
          const x = p.facing > 0 ? b.x + b.w : b.x - px(16);
          world.spawn(new Projectile(x, b.y + px(8), p.facing, SWORD_BEAM, p));
        }
      }
      if (p.attackTimer >= 3 && p.attackTimer <= 8) {
        const y = b.y + (p.crouching ? px(8) : px(10));
        p.activeMelee =
          p.facing > 0
            ? { x: b.x + b.w, y, w: px(14), h: px(6) }
            : { x: b.x - px(14), y, w: px(14), h: px(6) };
      } else p.activeMelee = null;
    },
    onMeleeHit(p) {
      if (p.scratch.downThrust) p.stompBounce();
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom':
          p.scratch.maxHp = Math.min(MAX_HEARTS * 2, maxHp(p) + 2);
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
