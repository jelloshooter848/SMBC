import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Goomba } from '@game/entities/enemies/goomba';
import { RushCoil } from '@game/entities/objects/rush-coil';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { MEGAMAN_STAGE } from '@game/tutorial/heroes/megaman';
import { controls } from '../stage-controls';

/* Megaman's stage bot: its sim (tests/sim/training-megaman.test.ts) and the early-block sim use it. */

const S = MEGAMAN_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Mega Man's bot: reads the current lesson and plays it as a player would. */
export function megamanBot(): (s: HeroStageScene) => Action[] {
  let charge = 0;
  let sawAt = -1;
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    switch (lessonId(s)) {
      case 'shoot':
        if (c.standAt(4)) c.press('attack', 10);
        break;
      case 'slide':
        if (cx < S.tunnel.from * 16 - 40) out.push('right');
        else if (b.onGround && p.sliding === 0) {
          out.push('down');
          if (p.facing < 0) out.push('right');
          else c.press('jump', 4);
        } else out.push('right');
        break;
      case 'helmet':
        c.takeFrom(S.helmetBlock);
        break;
      case 'charge':
        if (!c.standAt(33)) break;
        charge++;
        if (charge % 70 < 55) out.push('attack');
        break;
      case 'bricks': {
        const brick = w.map.isSolid(43, S.roof.top);
        if (!b.onGround) {
          // Through the hole, then onto the roof.
          if (toPx(b.y + b.h) < S.roof.top * 16 - 2) out.push('right');
          if (b.vy < 0) out.push('jump');
          break;
        }
        if (toPx(b.y + b.h) <= S.roof.top * 16) break;
        if (c.goTo(43, 2)) c.press('jump', brick ? 6 : 4);
        break;
      }
      case 'saw':
        if (!has('saw-disc')) {
          c.takeFrom(S.sawBlock);
          break;
        }
        if (!c.standAt(53)) break;
        if (sawAt < 0 || w.frame - sawAt > 60) {
          out.push('up', 'right', 'special');
          sawAt = w.frame;
        }
        break;
      case 'saw-up':
        // Straight up from under the cloud.
        if (!c.pick('saw') || !c.standAt(S.cloud.x)) break;
        if (sawAt < 0 || w.frame - sawAt > 60) {
          out.push('up', 'special');
          sawAt = w.frame;
        }
        break;
      case 'pierce':
        // A full charge from in front of the pipe, through it and the row.
        if (!c.standAt(S.pipe - 3)) break;
        charge++;
        if (charge % 70 < 55) out.push('attack');
        break;
      case 'leaf': {
        if (!has('leaf-guard')) {
          c.takeFrom(S.leafBlock);
          break;
        }
        if (!c.pick('leaf')) break;
        const orbiting = w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'leaf');
        if (!orbiting) {
          if (b.onGround) c.press('special', 10);
          break;
        }
        if (cx < (S.shooter - 3) * 16) out.push('right');
        break;
      }
      case 'rush': {
        if (!has('rush-coil')) {
          c.takeFrom(S.rushBlock);
          break;
        }
        const coil = w.entities.find((e): e is RushCoil => e instanceof RushCoil && e.alive);
        if (!b.onGround) {
          if (b.vy < 0) out.push('jump');
          // Launched: over the wall's top, then onto it.
          if (toPx(b.y + b.h) < S.wall.top * 16 - 2) out.push('right');
          else if (coil && !coil.springing) {
            const dx = toPx(coil.body.x + (coil.body.w >> 1)) - cx;
            if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
          }
          break;
        }
        if (!c.pick('rush')) break;
        if (!coil) {
          if (c.standAt(79)) c.press('special', 10);
          break;
        }
        // Hop up onto him.
        c.press('jump', 6);
        break;
      }
      case 'flame':
        if (!has('flame-wave')) {
          c.takeFrom(S.flameBlock);
          break;
        }
        if (c.pick('flame') && c.standAt(S.trench.from - 1)) c.press('special', 40);
        break;
      case 'knuckle':
        if (!has('homing-knuckle')) {
          c.takeFrom(S.knuckleBlock);
          break;
        }
        if (c.pick('knuckle') && c.standAt(106)) c.press('special', 50);
        break;
      case 'bolt': {
        if (!has('bolt')) {
          c.takeFrom(S.boltBlock);
          break;
        }
        if (!c.pick('bolt') || !c.standAt(119)) break;
        // Fire once two enemies are close together ahead.
        const near = w.entities.filter(
          (e) => e instanceof Goomba && e.alive && toPx(e.body.x) - cx < 150 && toPx(e.body.x) > cx,
        );
        if (near.length >= 2) c.press('special', 20);
        break;
      }
      default:
        // On right, hopping the used blocks of the row (0.4.46), then a jump at the flagpole.
        if (cx < (S.flag - 3) * 16) {
          c.goTo(S.flag);
          break;
        }
        out.push('right');
        if (b.onGround) out.push('jump');
        else if (b.vy < 0) out.push('jump');
    }
    return out;
  };
}
