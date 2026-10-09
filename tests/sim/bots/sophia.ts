import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { T } from '@game/level/tiles';
import { activeTool } from '@game/characters/toolbelt';
import { sophiaState } from '@game/characters/sophia/state';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { SOPHIA_STAGE } from '@game/tutorial/heroes/sophia';
import { controls } from '../stage-controls';

/* Sophia's stage bot (0.4.38): its sim (tests/sim/training-sophia.test.ts) and the browser play-test use it. */

const S = SOPHIA_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Sophia III's bot: reads the current lesson and plays it as a player would. */
export function sophiaBot(): (s: HeroStageScene) => Action[] {
  let air = 0;
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const st = sophiaState(p);
    const front = toPx(b.x + b.w);
    air = b.onGround ? 0 : air + 1;
    /** A held jump (the whole rise). */
    const heldJump = (): void => {
      if (b.onGround || b.vy < 0) out.push('jump');
    };
    // Stuck to a block's underside after bumping it (Ceiling Climb): a jump drops her off it.
    if (st.surface === 3 && lessonId(s) !== 'ceiling-climb') {
      c.press('jump', 6);
      return out;
    }
    switch (lessonId(s)) {
      case 'drive-jump':
        out.push('right');
        if (front >= S.plateau.from * 16 - 30 || !b.onGround) heldJump();
        break;
      case 'cannon':
        // Through the hole once the brick is broken.
        if (!w.map.isSolid(S.brickWall.x, S.brickWall.brick)) out.push('right');
        else if (c.standAt(S.brickWall.x - 1)) c.press('attack', 10);
        break;
      case 'cannon-up':
        if (c.goTo(S.upTarget, 3)) {
          out.push('up');
          c.press('attack', 14);
        }
        break;
      case 'nose-drop':
        out.push('right');
        if (cx > (S.hole - 2) * 16) out.push('down');
        break;
      case 'jason': {
        if (!st.jason) {
          // Coins taken: back in already. Else park by the pit and send Jason.
          if (c.standAt(S.pit.x - 2)) c.press('select', 20);
          break;
        }
        const tank = st.jason.tank.body;
        const left = S.pit.coins.some((row) => w.map.get(S.pit.x, row) === T.COIN);
        // Into the pit for the coins, out again and back to the tank: UP beside it gets him in.
        if (left && cx < S.pit.x * 16 + 4) out.push('right');
        else if (left) break;
        else if (toPx(b.x) > toPx(tank.x + tank.w)) {
          out.push('left');
          if (b.onGround && toPx(b.y + b.h) > 192) out.push('jump');
          else if (!b.onGround && b.vy < 0) out.push('jump');
        } else out.push('up');
        break;
      }
      case 'power-capsule':
        c.takeFrom(S.capsuleBlock);
        break;
      case 'hover':
        out.push('right');
        // A jump from the edge, then a second press held: the hover across.
        if (b.onGround) {
          if (front >= S.ditch.from * 16 - 4) c.press('jump', 4);
        } else if (air < 12 || air > 16) out.push('jump');
        break;
      case 'crusher':
        if (p.powerState !== 'fire') c.takeFrom(S.crusherBlock);
        else if (c.standAt(S.toughTarget - 4)) c.press('attack', 20);
        break;
      case 'triple-missile':
        if (!p.scratch.hasTriple) c.takeFrom(S.missileBlock);
        else if (c.standAt(S.box.from - 4)) c.press('special', 40);
        break;
      case 'wall-climb':
        if (!p.scratch['has-wall-climb']) c.takeFrom(S.wallBlock);
        else out.push('right', 'up');
        break;
      case 'ceiling-climb':
        if (!p.scratch['has-ceiling-climb']) c.takeFrom(S.ceilingBlock);
        else if (st.surface === 3) out.push('right');
        else if (cx < (S.roof.from + 1) * 16) c.goTo(S.roof.from + 1);
        else heldJump();
        break;
      case 'homing-missile': {
        if (!p.scratch.hasHoming) {
          // The cannon opens it from below (a jump would grip it), then the item is taken.
          if (w.map.get(S.homingBlock.x, S.homingBlock.y) !== T.Q_POWERUP) c.takeFrom(S.homingBlock);
          else if (c.goTo(S.homingBlock.x, 3)) {
            out.push('up');
            c.press('attack', 14);
          }
          break;
        }
        const tool = activeTool(p, p.def.tools?.(p) ?? [])?.id;
        if (!c.standAt(S.ledge.from - 4)) break;
        if (tool !== 'homing') {
          out.push('down');
          c.press('special', 12);
        } else c.press('special', 30);
        break;
      }
      default:
        if (cx < (S.flag - 3) * 16) c.goTo(S.flag);
        else {
          out.push('right');
          heldJump();
        }
    }
    return out;
  };
}
