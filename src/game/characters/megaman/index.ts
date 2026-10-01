import { px } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import { Projectile, BUSTER, CHARGED_BUSTER } from '../../entities/projectiles/projectile';
import { STAR_FRAMES } from '../../constants';

/** Robot boy: instant acceleration, tall cut-able jump, slide, arm cannon, hit-point bar. */
export const MEGAMAN_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x01600,
  walkAccel: 0x01600,
  runAccel: 0x01600,
  releaseDecel: 0x01600,
  skidDecel: 0x01600,
  maxWalk: 0x01600, // 1.375 px/f
  maxRun: 0x01600,
  skidTurnaround: 0,
  jump: [{ maxVx: Infinity, initial: 0x05800, holdGravity: 0x00380, fallGravity: 0x00380 }], // apex ≈ 4.3 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: 'cut',
  instantAccel: true,
  coyoteFrames: 0,
  slide: { speed: 0x02800, frames: 26, hitboxH: 12 },
};

const MAX_HP = 28;
const HIT_DAMAGE = 4;
const CHARGE_FRAMES = 40;
const SHOOT_POSE_FRAMES = 16;

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = 'megaman';
  const charging = (p.scratch.chargeT ?? 0) > 12;
  if (charging) palette = `megaman-charge-${reduceFlashing ? 0 : (frame >> 2) % 3}`;
  if (p.star > 0) palette = `megaman-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  let name: string;
  const shooting = p.attackTimer > 0;
  if (p.dead || p.anim === 'hurt') name = 'hurt';
  else if (p.sliding > 0) name = 'slide';
  else {
    switch (p.anim) {
      case 'walk':
      case 'skid':
        name = shooting ? `walk-shoot-${p.walkFrame}` : `walk-${p.walkFrame}`;
        break;
      case 'jump':
        name = shooting ? 'jump-shoot' : 'jump';
        break;
      case 'climb':
        name = `climb-${(frame >> 3) & 1}`;
        break;
      case 'attack':
        name = 'shoot';
        break;
      default:
        name = shooting ? 'shoot' : charging ? 'charge-0' : (frame & 255) < 8 ? 'idle-blink' : 'idle';
    }
  }
  return {
    sheet: 'megaman',
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.sliding > 0 ? 20 : 10,
  };
}

function fire(p: Player, world: Parameters<CharacterDef['behaviour']['update']>[2], charged: boolean): void {
  const b = p.body;
  const spec = charged ? CHARGED_BUSTER : BUSTER;
  const x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
  world.spawn(new Projectile(x, b.y + px(8), p.facing, spec, p));
  world.audio.sfx('buster');
  p.attackTimer = SHOOT_POSE_FRAMES;
}

export const MEGAMAN: CharacterDef = {
  id: 'megaman',
  name: 'Mega Man',
  hudName: 'MEGA',
  movement: MEGAMAN_PROFILE,
  damage: {
    kind: 'hp',
    max: MAX_HP,
    hudStyle: 'bar',
    invulnFrames: 60,
    knockback: { vx: 0x00800, vy: 0x01800 },
  },
  stomps: false,
  crouches: false,
  canBreakBricks: () => true,
  hitbox: (p) => (p.sliding > 0 ? { w: 12, h: 12 } : { w: 12, h: 22 }),
  sprite,
  blockPowerUp: (p) => (p.scratch.charge ? 'mushroom' : 'flower'),
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'megaman', palette: 'megaman', frame: 'idle' },
  behaviour: {
    update(p, input, world) {
      if (p.stun > 0 || p.sliding > 0) {
        p.scratch.chargeT = 0;
        return;
      }
      if (input.pressed('attack') && world.countProjectiles(p, 'buster') < 3) fire(p, world, false);
      if (p.scratch.charge) {
        if (input.held('attack')) {
          p.scratch.chargeT = (p.scratch.chargeT ?? 0) + 1;
          if (p.scratch.chargeT === 16) world.audio.sfx('charge');
        } else {
          if ((p.scratch.chargeT ?? 0) >= CHARGE_FRAMES) fire(p, world, true);
          p.scratch.chargeT = 0;
        }
      }
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom':
          p.hp = MAX_HP;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        case 'flower':
          p.scratch.charge = 1;
          p.hp = MAX_HP;
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
      p.hp -= HIT_DAMAGE;
      if (p.hp <= 0) {
        p.hp = 0;
        return 'dead';
      }
      p.invuln = 60;
      p.scratch.chargeT = 0;
      world.audio.sfx('hit');
      return 'hurt';
    },
  },
};
