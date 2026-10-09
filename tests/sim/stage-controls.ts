import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { HeroItem } from '@game/entities/objects/hero-item';
import { T } from '@game/level/tiles';
import type { HeroStageScene } from '@game/tutorial/hero-stage';

/*
 * A stage bot's controls (0.4.37; its own module since 0.4.38, free of the test runner, so a
 * browser play-test can load the very bots the sims use): walk, stand, pick a tool, press now and
 * then, take an item out of a block.
 */

/**
 * A bot's controls for this frame (pushing into `out`): walk to a column (hopping a step in the
 * way), stand at one facing right, pick a belt tool, press a button now and then, and take an
 * item out of a ? block (bump it, then touch the item from the side the hero is on).
 */
const stands = new WeakMap<HeroStageScene, { col: number; back: boolean }>();
/** Frames a hero who can't steer in the air (Simon) backs off a step for a run-up at it. */
const runUps = new WeakMap<HeroStageScene, number>();

export function controls(s: HeroStageScene, out: Action[]) {
  const w = s.world;
  const p = w.player;
  const b = p.body;
  const cx = toPx(p.centerX);
  // The screen never scrolls back left: a column behind its left edge is as near as he gets.
  const pinned = toPx(b.x) - w.camera.pxX < 4;
  const goTo = (col: number, slack = 3): boolean => {
    const dx = col * 16 + 8 - cx;
    if (Math.abs(dx) <= slack || (dx < 0 && pinned)) return Math.abs(b.vx) < 0x100 && b.onGround;
    const dir = dx > 0 ? 1 : -1;
    out.push(dir > 0 ? 'right' : 'left');
    // A hop over a step: a full one (JUMP held while rising).
    if (!b.onGround && b.vy < 0) out.push('jump');
    const ahead = Math.floor((dir > 0 ? toPx(b.x + b.w) + 1 : toPx(b.x) - 1) / 16);
    const feet = Math.floor((toPx(b.y + b.h) - 1) / 16);
    if (p.def.movement.airControl !== 'none') {
      if (b.onGround && w.map.isSolid(ahead, feet) && (w.frame & 3) === 0) out.push('jump');
      return false;
    }
    // No steering in the air: a step is taken with a walking jump a few pixels before it, and from
    // a standstill against it he first backs off for a run-up.
    const back = runUps.get(s) ?? 0;
    if (back > 0) {
      runUps.set(s, back - 1);
      out.pop();
      out.push(dir > 0 ? 'left' : 'right');
      return false;
    }
    if (!b.onGround) return false;
    const soon = Math.floor((dir > 0 ? toPx(b.x + b.w) + 12 : toPx(b.x) - 12) / 16);
    const fast = Math.abs(b.vx) >= (p.def.movement.maxWalk * 3) >> 2;
    if (w.map.isSolid(soon, feet) && fast) out.push('jump');
    else if (w.map.isSolid(ahead, feet) && !fast) runUps.set(s, 14);
    return false;
  };
  /**
   * Stand at column `col` facing right: reached from the left, so he arrives facing right (from
   * the right he first walks a little past it; the screen's left edge just turns him).
   */
  const standAt = (col: number): boolean => {
    const target = col * 16 + 8;
    let st = stands.get(s);
    if (!st || st.col !== col) stands.set(s, (st = { col, back: false }));
    if (cx > target + 12 && !pinned) st.back = true;
    if (st.back) {
      if (cx > target - 10 && !pinned) {
        goTo(col - 1, 2);
        return false;
      }
      st.back = false;
    }
    if (cx < target - 12) {
      goTo(col, 2);
      return false;
    }
    if (p.facing < 0) {
      out.push('right');
      return false;
    }
    return b.onGround;
  };
  const tool = (): string | undefined => {
    const tools = p.def.tools?.(p) ?? [];
    const n = tools.length;
    if (!n) return undefined;
    return tools[(((p.scratch.tool ?? 0) % n) + n) % n]?.id;
  };
  const pick = (id: string): boolean => {
    if (tool() === id) return true;
    if ((w.frame & 7) === 0) out.push('select');
    return false;
  };
  const press = (a: Action, every = 12): void => {
    if (w.frame % every === 0) out.push(a);
  };
  /** Bump the ? block at (x, y), then take its item: true once neither is left. */
  const takeFrom = (blk: { x: number; y: number }, up = false): boolean => {
    const used = w.map.get(blk.x, blk.y) !== T.Q_POWERUP;
    const item = w.entities.find((e) => e instanceof HeroItem && e.alive);
    // A full jump: JUMP held while rising.
    if (!b.onGround && b.vy < 0) out.push('jump');
    if (!used) {
      if (!b.onGround) {
        if (up) out.push('up');
        const dx = blk.x * 16 + 8 - cx;
        if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
        return false;
      }
      // Standing on top of it: off it first, to come up under it.
      if (toPx(b.y + b.h) <= blk.y * 16 && Math.abs(cx - (blk.x * 16 + 8)) < 20) {
        goTo(blk.x + 2);
        return false;
      }
      if (goTo(blk.x)) press('jump', 4);
      return false;
    }
    if (!item) return true;
    const side = cx <= blk.x * 16 + 8 ? -2 : 2;
    if (!b.onGround) {
      out.push(side < 0 ? 'right' : 'left');
      return false;
    }
    if (goTo(blk.x + side)) press('jump', 4);
    return false;
  };
  return { w, p, b, cx, goTo, standAt, tool, pick, press, takeFrom };
}
