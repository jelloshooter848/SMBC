import { px } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import { MARIO_PROFILE } from './profile';
import type { Player } from '../../entities/player';
import { Projectile, FIREBALL } from '../../entities/projectiles/projectile';
import { STAR_FRAMES } from '../../constants';

const STATES = ['small', 'big', 'fire'] as const;

function prefix(p: Player): 'small' | 'big' {
  return p.powerState === 'small' ? 'small' : 'big';
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const big = prefix(p) === 'big';
  let palette = p.powerState === 'fire' ? 'mario-fire' : 'mario';
  if (p.star > 0) {
    const flash = reduceFlashing ? 0 : (frame >> 1) & 3;
    palette = `mario-star-${flash}`;
  }
  let name: string;
  const pre = prefix(p);
  if (p.transition) {
    // Growth/shrink flicker: small / mid / big every 4 frames (shrink has no mid frame).
    const step = (p.transition.t >> 2) % 3;
    name =
      p.transition.kind === 'grow'
        ? (['small-idle', 'grow-mid', 'big-idle'][step] as string)
        : step === 1
          ? 'small-idle'
          : 'big-idle';
    return {
      sheet: 'mario',
      palette,
      frame: name,
      flip: p.facing < 0,
      offsetX: 2,
      offsetY: name === 'small-idle' ? 0 : 16,
    };
  }
  if (p.dead) return { sheet: 'mario', palette, frame: 'small-die', flip: false, offsetX: 2, offsetY: 0 };
  switch (p.anim) {
    case 'walk':
      name = `${pre}-walk-${p.walkFrame}`;
      break;
    case 'skid':
      name = `${pre}-skid`;
      break;
    case 'jump':
      name = `${pre}-jump`;
      break;
    case 'crouch':
      name = big ? 'big-crouch' : 'small-crouch';
      break;
    case 'climb':
      name = `${pre}-climb-${(frame >> 3) & 1}`;
      break;
    case 'attack':
      name = big ? 'big-throw' : 'small-idle';
      break;
    case 'swim':
      name = `${pre}-swim-${(frame >> 3) & 1}`;
      break;
    default:
      name = `${pre}-idle`;
  }
  // Big sprites are 32 tall over a 24-tall hitbox (crouching: 16-tall hitbox, sprite still 32).
  const offsetY = big ? (p.crouching ? 16 : 8) : 0;
  return { sheet: 'mario', palette, frame: name, flip: p.facing < 0, offsetX: 2, offsetY };
}

export const MARIO: CharacterDef = {
  id: 'mario',
  name: 'Mario',
  hudName: 'MARIO',
  movement: MARIO_PROFILE,
  damage: { kind: 'powerup', states: STATES },
  stomps: true,
  crouches: true,
  canBreakBricks: (p) => p.powerState !== 'small',
  hitbox: (p) => (p.powerState === 'small' || p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: (p) => (p.powerState === 'small' ? 'mushroom' : 'flower'),
  jumpSfx: (p) => (p.powerState === 'small' ? 'jump-small' : 'jump-big'),
  portrait: { sheet: 'mario', palette: 'mario', frame: 'small-idle' },
  behaviour: {
    update(p, input, world) {
      if (p.powerState !== 'fire' || p.crouching || p.transition) return;
      if (input.pressed('attack') && world.countProjectiles(p, 'fireball') < 2) {
        const b = p.body;
        const x = p.facing > 0 ? b.x + b.w : b.x - px(8);
        world.spawn(new Projectile(x, b.y + px(8), p.facing, FIREBALL, p));
        world.audio.sfx('fireball');
        p.attackTimer = 8;
      }
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom':
          if (p.powerState === 'small') {
            p.powerState = 'big';
            p.startTransition('grow');
          }
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        case 'flower':
          if (p.powerState === 'small') {
            p.powerState = 'big';
            p.startTransition('grow');
          } else if (p.powerState === 'big') {
            p.powerState = 'fire';
            p.startTransition('grow');
          }
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
      if (p.powerState === 'small') return 'dead';
      p.powerState = p.powerState === 'fire' && world.assist.fireRevertsToBig ? 'big' : 'small';
      p.startTransition('shrink');
      p.invuln = 150;
      world.audio.sfx('pipe');
      return 'hurt';
    },
  },
};
