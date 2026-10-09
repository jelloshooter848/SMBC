import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Goomba } from '@game/entities/enemies/goomba';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { BILL_STAGE } from '@game/tutorial/heroes/bill';
import { lessonTargets } from '@game/tutorial/heroes/common';
import { controls } from '../stage-controls';

/* Bill's stage bot (0.4.38): its sim (tests/sim/training-bill.test.ts) and the browser play-test use it. */

const S = BILL_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Bill's bot: reads the current lesson and plays it as a player would. */
export function billBot(): (s: HeroStageScene) => Action[] {
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    switch (lessonId(s)) {
      case 'rifle':
        if (c.standAt(4)) c.press('attack', 10);
        break;
      case 'aim': {
        const [up] = lessonTargets(s.world, 'aim');
        // Under the high target, aiming straight up; then up and ahead, walking on under the ledge.
        if (up && up.taken === 0) {
          if (c.goTo(S.upTarget, 2)) {
            out.push('up');
            c.press('attack', 8);
          }
        } else if (cx < S.upTarget * 16 + 60) {
          out.push('right', 'up');
          c.press('attack', 8);
        } else c.goTo(S.upTarget + 1);
        break;
      }
      case 'prone':
        if (c.standAt(S.turret - 4)) out.push('down');
        break;
      case 'shoot-down': {
        // Over the ditch in a jump, aiming down at the enemy in it (steering over it); missed, a
        // jump back the other way.
        const g = w.entities.find((e) => e instanceof Goomba && e.alive);
        const gx = g ? toPx(g.body.x) + 8 : cx;
        if (!b.onGround) {
          out.push('down');
          if (Math.abs(gx - cx) > 6) out.push(gx > cx ? 'right' : 'left');
          c.press('attack', 4);
        } else if (cx > (S.ditch.to + 1) * 16) {
          if (c.goTo(S.ditch.to + 1, 4)) c.press('jump', 4);
          else if (cx < (S.ditch.to + 2) * 16) out.push('jump');
        } else if (cx < (S.ditch.from - 1) * 16) c.goTo(S.ditch.from - 1);
        else {
          out.push('right');
          c.press('jump', 4);
        }
        break;
      }
      case 'medal':
        c.takeFrom(S.medalBlock);
        break;
      case 'machine-gun':
        if (!has('machine-gun')) c.takeFrom(S.gunBlock);
        else if (c.standAt(S.gunBlock.x + 2)) out.push('attack');
        break;
      case 'laser':
        if (!has('laser')) c.takeFrom(S.laserBlock);
        else if (c.standAt(S.laserTargets[0] - 3)) c.press('attack', 20);
        break;
      case 'flame-gun':
        if (!has('flame-gun')) c.takeFrom(S.flameBlock);
        else if (c.standAt(S.toughTarget - 3)) c.press('attack', 15);
        break;
      case 'spread-gun':
        if (!has('spread-gun')) c.takeFrom(S.spreadBlock);
        else if (c.standAt(S.spreadTargets[0] - 8)) c.press('attack', 20);
        break;
      default:
        if (cx < (S.flag - 3) * 16) c.goTo(S.flag);
        else {
          out.push('right');
          if (b.onGround || b.vy < 0) out.push('jump');
        }
    }
    return out;
  };
}
