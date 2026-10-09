import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Goomba } from '@game/entities/enemies/goomba';
import { Firebar } from '@game/entities/enemies/firebar';
import { HeroItem } from '@game/entities/objects/hero-item';
import { T } from '@game/level/tiles';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { SIMON_STAGE } from '@game/tutorial/heroes/simon';
import { controls } from '../stage-controls';

/* Simon's stage bot (0.4.38): its sim (tests/sim/training-simon.test.ts) and the browser play-test use it. */

const S = SIMON_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/**
 * Simon's own way to an item on top of its block: he can't steer in the air, so he walks at it from
 * a couple of blocks back and jumps on the way, arcing over the block through the item.
 */
function simonTake(s: HeroStageScene, out: Action[], blk: { x: number; y: number }): boolean {
  const c = controls(s, out);
  const { w, b, cx } = c;
  const used = w.map.get(blk.x, blk.y) !== T.Q_POWERUP;
  const item = w.entities.find((e) => e instanceof HeroItem && e.alive);
  if (!used) {
    // Up on the ledge: off it first (to the right), to come up under the block.
    if (b.onGround && toPx(b.y + b.h) <= blk.y * 16) c.goTo(blk.x + 3, 2);
    else if (c.goTo(blk.x, 2)) c.press('jump', 4);
    return false;
  }
  if (!item) return true;
  if (!b.onGround) return false;
  // Up on the block's ledge: walk into it.
  if (toPx(b.y + b.h) <= blk.y * 16) {
    c.goTo(blk.x, 2);
    return false;
  }
  // The block's ledge, and the side to take a run at it from: the left, unless the screen's edge
  // leaves no room there for a run-up (then the right).
  let left = blk.x;
  let right = blk.x;
  while (w.map.isSolid(left - 1, blk.y)) left--;
  while (w.map.isSolid(right + 1, blk.y)) right++;
  const dir = left * 16 - 22 - 20 - 6 >= w.camera.pxX ? 1 : -1;
  // The take-off point: clear of the ledge's end on the way up, landing on the ledge.
  const run = dir > 0 ? left * 16 - 22 : (right + 1) * 16 + 22;
  const key = dir > 0 ? 'right' : 'left';
  // Walking at it: on to the take-off point, and the jump there (too slow by then: stop).
  if (b.vx * dir > 0) {
    if ((cx - run) * dir >= -2 && Math.abs(b.vx) >= 0x0f00) out.push(key, 'jump');
    else if ((cx - run) * dir < 8) out.push(key);
    return false;
  }
  // Too close (or past it): back up first, then walk at it.
  const back = run - dir * 20;
  if ((cx - back) * dir > -4) {
    // Back to the run-up's start (a plain walk: no hops over whatever lies beyond).
    if (Math.abs(cx - back) > 3) out.push(cx > back ? 'left' : 'right');
    else if (Math.abs(b.vx) < 0x100) out.push(key);
    return false;
  }
  out.push(key);
  return false;
}

/** Simon's bot: reads the current lesson and plays it as a player would. */
export function simonBot(): (s: HeroStageScene) => Action[] {
  let watchAt = -1;
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    /** Walk up against the low wall at `col`, then crack the whip. */
    const atWall = (col: number): void => {
      if (cx > col * 16) c.goTo(col - 2);
      else if (toPx(b.x + b.w) < col * 16 - 1) out.push('right');
      else if (b.onGround) c.press('attack', 24);
    };
    switch (lessonId(s)) {
      case 'whip':
        atWall(S.wallCandle);
        break;
      case 'stairs':
        // Walking at the foot holding UP gets him on.
        out.push('up', 'right');
        break;
      case 'committed-jump':
        out.push('right');
        // A walking jump from the edge.
        if (b.onGround && toPx(b.x + b.w) >= S.ditch.from * 16 - 4 && toPx(b.x) < S.ditch.from * 16)
          out.push('jump');
        break;
      case 'pot-roast':
        simonTake(s, out, S.roastBlock);
        break;
      case 'chain-whip':
        if (!has('chain-whip')) simonTake(s, out, S.chainBlock);
        else atWall(S.chainWall);
        break;
      case 'dagger':
        if (!has('dagger')) simonTake(s, out, S.daggerBlock);
        else if (c.standAt(S.daggerTarget - 3)) c.press('special', 20);
        break;
      case 'holy-water': {
        if (!has('holy-water')) {
          simonTake(s, out, S.waterBlock);
          break;
        }
        if (!c.pick('holy-water') || !c.standAt(S.pipe - 5)) break;
        const near = w.entities.some(
          (e) => e instanceof Goomba && e.alive && toPx(e.body.x) - cx < 44 && toPx(e.body.x) > cx,
        );
        if (near) c.press('special', 16);
        break;
      }
      case 'axe':
        if (!has('axe')) simonTake(s, out, S.axeBlock);
        else if (c.pick('hand-axe') && c.standAt(S.shelf.from - 3)) c.press('special', 40);
        break;
      case 'morning-star':
        if (!has('morning-star')) simonTake(s, out, S.starBlock);
        else atWall(S.starWall);
        break;
      case 'cross':
        if (!has('cross')) simonTake(s, out, S.crossBlock);
        else if (c.pick('cross') && c.standAt(S.crossTarget - 2)) c.press('special', 30);
        break;
      case 'shots':
        if (!has('double-shot')) simonTake(s, out, S.doubleBlock);
        else if (!has('triple-shot')) simonTake(s, out, S.tripleBlock);
        else if (c.pick('hand-axe') && c.standAt(S.tripleBlock.x + 2)) c.press('special', 14);
        break;
      case 'stopwatch': {
        if (!has('stopwatch')) {
          simonTake(s, out, S.watchBlock);
          break;
        }
        const bar = w.entities.find((e): e is Firebar => e instanceof Firebar && e.alive);
        const frozen = !!bar && bar.stunned > 0;
        if (frozen && watchAt >= 0) {
          out.push('right');
          break;
        }
        if (c.pick('stopwatch') && c.standAt(S.firebar.x - 6)) {
          out.push('special');
          watchAt = w.frame;
        }
        break;
      }
      default:
        out.push('right');
        if (b.onGround && cx >= (S.flag - 3) * 16) out.push('jump');
    }
    return out;
  };
}
