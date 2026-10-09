import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Goomba } from '@game/entities/enemies/goomba';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { RYU_STAGE } from '@game/tutorial/heroes/ryu';
import { controls } from '../stage-controls';

/* Ryu's stage bot (0.4.38): its sim (tests/sim/training-ryu.test.ts) and the browser play-test use it. */

const S = RYU_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Ryu's bot: reads the current lesson and plays it as a player would. */
export function ryuBot(): (s: HeroStageScene) => Action[] {
  let jumped = false;
  let drop = 0;
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    /** Up the shaft: jump at the right wall, then kick from wall to wall onto the roof. */
    const climb = (): void => {
      const feet = toPx(b.y + b.h);
      if (p.clinging) {
        // Holding on for the cling's lesson; then a fresh press kicks off (JUMP let go for a frame).
        if (!jumped && lessonId(s) === 'wall-jump') out.push('jump');
        out.push(p.facing > 0 ? 'right' : 'left');
      } else if (!b.onGround) {
        if (b.vy < 0) out.push('jump');
        // Over the roof: onto it; else on to the far wall.
        out.push(
          feet <= S.roof.top * 16 + 2 || cx > S.roof.from * 16 ? 'right' : p.facing > 0 ? 'right' : 'left',
        );
      } else if (cx < S.shaft.from * 16) out.push('right');
      else {
        out.push('right');
        if (!jumped) out.push('jump');
      }
    };
    // Holding into a block's side in a jump clings to it: let go to drop.
    const id = lessonId(s);
    if (p.clinging && id !== 'cling' && id !== 'wall-jump') drop = 16;
    if (drop > 0 && !b.onGround) {
      drop--;
      jumped = false;
      return [];
    }
    drop = 0;
    switch (id) {
      case 'slash':
        if (c.standAt(4)) c.press('attack', 8);
        break;
      case 'cling':
      case 'wall-jump':
        climb();
        break;
      case 'medicine':
        c.takeFrom(S.medicineBlock);
        break;
      case 'throwing-star':
        if (!has('throwing-star')) c.takeFrom(S.starBlock);
        else if (c.standAt(S.starTarget - 3)) c.press('special', 20);
        break;
      case 'ninpo-scroll':
        c.takeFrom(S.scrollBlock);
        break;
      case 'windmill':
        if (!has('windmill')) c.takeFrom(S.windmillBlock);
        else if (c.pick('windmill') && c.standAt(S.windmillTargets[0] - 3)) c.press('special', 60);
        break;
      case 'fire-wheel': {
        if (!has('fire-wheel')) {
          c.takeFrom(S.wheelBlock);
          break;
        }
        if (!c.pick('fire-wheel')) break;
        const flames = w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'fire-wheel');
        if (!flames) {
          if (c.standAt(S.wheelBlock.x + 2)) c.press('special', 10);
        } else if (cx < (S.shooter - 2) * 16) out.push('right');
        break;
      }
      case 'jump-slash': {
        if (!has('jump-slash')) {
          c.takeFrom(S.spinBlock);
          break;
        }
        if (!c.pick('slash')) break;
        const g = w.entities.find(
          (e): e is Goomba => e instanceof Goomba && e.alive && toPx(e.body.x) > cx - 8,
        );
        if (!b.onGround) {
          // Spinning down onto it: cast on the way down, steering at it.
          if (b.vy > 0 && !p.scratch.spin) out.push('special');
          if (g) out.push(toPx(g.body.x) + 8 > cx ? 'right' : 'left');
          break;
        }
        if (!c.standAt(S.pipe - 5)) break;
        // A jump as it comes near.
        if (g && toPx(g.body.x) - cx < 48) out.push('jump');
        break;
      }
      default:
        // On to the flagpole: over the pipe with a jump before it (pressed into its side in the air,
        // he would cling to it), and at the pole from close by.
        if (cx < (S.flag - 3) * 16) {
          out.push('right');
          const soon = Math.floor((toPx(b.x + b.w) + 14) / 16);
          if ((b.onGround && w.map.isSolid(soon, 11)) || (!b.onGround && b.vy < 0)) out.push('jump');
        } else {
          out.push('right');
          if (b.onGround || b.vy < 0) out.push('jump');
        }
    }
    jumped = out.includes('jump');
    return out;
  };
}
