import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { Goomba } from '@game/entities/enemies/goomba';
import { HeroItem } from '@game/entities/objects/hero-item';
import { activeTool } from '@game/characters/toolbelt';
import { T } from '@game/level/tiles';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { LINK_STAGE } from '@game/tutorial/heroes/link';

/* Link's stage bot: its sim (tests/sim/training-link.test.ts) and the early-block sim use it. */

const S = LINK_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Link's bot: reads the current lesson and plays it as a player would. */
export function linkBot(): (s: HeroStageScene) => Action[] {
  let bombAt = -1;
  let swung = 0;
  return (s) => {
    const w = s.world;
    const p = w.player;
    const b = p.body;
    const cx = toPx(p.centerX);
    const out: Action[] = [];
    const tools = p.def.tools?.(p) ?? [];
    const tool = activeTool(p, tools)?.id;
    /** Walk to column `col`'s centre (within 3 px), true once there and still. */
    const goTo = (col: number, slack = 3): boolean => {
      const dx = col * 16 + 8 - cx;
      if (Math.abs(dx) <= slack) return Math.abs(b.vx) < 0x100 && b.onGround;
      const dir = dx > 0 ? 1 : -1;
      out.push(dir > 0 ? 'right' : 'left');
      // A step in the way (out of the dip): hop it.
      const ahead = Math.floor((dir > 0 ? toPx(b.x + b.w) + 1 : toPx(b.x) - 1) / 16);
      const feet = Math.floor((toPx(b.y + b.h) - 1) / 16);
      if (b.onGround && w.map.isSolid(ahead, feet) && (w.frame & 3) === 0) out.push('jump');
      return false;
    };
    /** Stand at column `col` (within 6 px) facing right: true once there, still. */
    const standAt = (col: number): boolean => {
      const dx = col * 16 + 8 - cx;
      if (Math.abs(dx) > 6) return goTo(col, 6);
      if (p.facing < 0) {
        out.push('right');
        return false;
      }
      return b.onGround && Math.abs(b.vx) < 0x100;
    };
    /** Picks belt tool `id` (a press of TOOLS every few frames). */
    const pick = (id: string): boolean => {
      if (tool === id) return true;
      if ((w.frame & 7) === 0) out.push('select');
      return false;
    };
    const press = (a: Action, every = 12) => {
      if (w.frame % every === 0) out.push(a);
    };
    /** Open the block at (x, y) with an up-thrust, then take its item from the left side. */
    const takeFrom = (blk: { x: number; y: number }): void => {
      const used = w.map.get(blk.x, blk.y) !== T.Q_POWERUP;
      const item = w.entities.find((e) => e instanceof HeroItem && e.alive);
      if (!used) {
        if (!b.onGround) {
          out.push('up');
          const dx = blk.x * 16 + 8 - cx;
          if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
          return;
        }
        if (goTo(blk.x)) press('jump', 4);
        return;
      }
      if (!item) return;
      // From whichever side he is on (the screen does not scroll back left).
      const side = cx <= blk.x * 16 + 8 ? -2 : 2;
      if (!b.onGround) {
        out.push(side < 0 ? 'right' : 'left');
        return;
      }
      if (goTo(blk.x + side)) press('jump', 4);
    };
    const taken = (id: string) =>
      s.director.lesson?.item !== id || !s.director.lines()[0]?.startsWith('OPEN');
    switch (lessonId(s)) {
      case 'sword':
        if (goTo(S.sword - 1, 6)) press('attack', 16);
        break;
      case 'shield':
        // Stand still a few steps from the shooter, facing it.
        if (cx < (S.shooter - 5) * 16) out.push('right');
        break;
      case 'down-thrust': {
        const g = w.entities.find((e): e is Goomba => e instanceof Goomba && e.alive);
        if (!g) {
          out.push('right');
          break;
        }
        const gx = toPx(g.body.x + (g.body.w >> 1));
        if (!b.onGround) {
          if (cx < gx - 2) out.push('right');
          else if (cx > gx + 2) out.push('left');
          if (b.vy > 0) out.push('down');
          break;
        }
        if (goTo(S.dip.from - 1, 4)) press('jump', 6);
        break;
      }
      case 'up-thrust':
        if (!b.onGround) {
          out.push('up');
          const dx = S.brick.x * 16 + 8 - cx;
          if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
        } else if (goTo(S.brick.x)) press('jump', 6);
        break;
      case 'boomerang':
        if (!b.onGround) {
          if (b.vy >= 0 && b.vy < 0x400) out.push('special');
          break;
        }
        if (w.entities.some((e) => e.alive && e.kind === 'boomerang')) break;
        if (standAt(S.ledge.from - 1)) press('jump', 30);
        break;
      case 'heart-container':
        takeFrom(S.heartBlock);
        break;
      case 'bomb':
        if (!taken('bomb-bag') || !p.scratch['has-bomb-bag']) {
          takeFrom(S.bombBlock);
          break;
        }
        if (!pick('bomb')) break;
        if (bombAt < 0 || w.frame - bombAt > 150) {
          if (standAt(S.bombTarget - 2)) {
            out.push('special');
            bombAt = w.frame;
          }
        } else goTo(S.bombTarget - 6, 4);
        break;
      case 'shield-spell':
        if (!p.scratch['has-shield-spell']) {
          takeFrom(S.shieldBlock);
          break;
        }
        if (pick('shield') && !p.scratch.shieldSpell) press('special', 10);
        break;
      case 'jump-spell':
        if (!p.scratch['has-jump-spell']) {
          takeFrom(S.jumpBlock);
          break;
        }
        if (!p.scratch.jumpSpell) {
          if (pick('jump')) press('special', 10);
          break;
        }
        if (!b.onGround) {
          out.push('right');
          break;
        }
        if (goTo(S.wall.from - 2)) press('jump', 4);
        break;
      case 'blue-ring':
        if (!p.scratch.tunic) {
          takeFrom(S.ringBlock);
          break;
        }
        // Down off the block, then stand and let the walkers bump him.
        goTo(S.ringBlock.x + 3, 6);
        break;
      case 'fire-spell':
        if (!p.scratch['has-fire-spell']) {
          takeFrom(S.fireBlock);
          break;
        }
        if (!standAt(S.ditch.from - 2)) break;
        if (!p.scratch.fireSpell) {
          if (pick('fire')) press('special', 10);
          break;
        }
        press('attack', 20);
        break;
      case 'magical-sword':
        if (!p.scratch.beam) {
          takeFrom(S.swordBlock);
          break;
        }
        if (standAt(S.swordTarget - 4) && ++swung % 24 === 0) out.push('attack');
        break;
      default:
        out.push('right');
        if (b.onGround && cx >= (S.flag - 3) * 16) out.push('jump');
    }
    return out;
  };
}
