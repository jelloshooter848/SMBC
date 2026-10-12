import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { type HeroStageScene } from '@game/tutorial/hero-stage';
import { LUIGI_STAGE } from '@game/tutorial/heroes/luigi';

/* Luigi's stage bot: its sim (tests/sim/training-luigi.test.ts) and the early-block sim use it. */

const S = LUIGI_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Luigi's bot: reads the current lesson and plays it as a player would. */
export function luigiBot(): (s: HeroStageScene) => Action[] {
  return (s) => {
    const w = s.world;
    const p = w.player;
    const b = p.body;
    const x = toPx(b.x);
    const out: Action[] = [];
    const jumpHeld = () => {
      if (b.onGround ? (w.frame & 1) === 0 : b.vy < 0) out.push('jump');
    };
    switch (lessonId(s)) {
      case 'high-jump':
        // A walk at the wall, and a full jump on the way.
        out.push('right');
        if (b.onGround && Math.abs(b.vx) < 0x1100) break;
        jumpHeld();
        break;
      case 'run':
        out.push('right', 'run');
        break;
      case 'slide':
        // Run, and let go about eight blocks before the strip's far end.
        if (x < S.strip.from * 16 - 100 || !b.onGround) out.push('right', 'run');
        break;
      case 'float': {
        if (!b.onGround) {
          out.push('right', 'run', 'jump');
          break;
        }
        // Climb out of the shallow ditch first, back to the run-up.
        if (toPx(b.y + b.h) > S.strip.top * 16) {
          out.push('right');
          jumpHeld();
          break;
        }
        out.push('right', 'run');
        if (toPx(b.x + b.w) >= S.wide.from * 16 - 6) out.push('jump');
        break;
      }
      default:
        out.push('right', 'run');
        if (b.onGround && toPx(b.x) >= (S.flag - 3) * 16) out.push('jump');
        else if (!b.onGround && b.vy < 0) out.push('jump');
    }
    return out;
  };
}
