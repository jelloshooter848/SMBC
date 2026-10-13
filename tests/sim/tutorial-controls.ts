import type { Action } from '@engine/input/actions';
import { tileAt, tileToSub, toPx } from '@engine/math/units';
import { LevelScene } from '@game/scenes/level';
import { Goomba } from '@game/entities/enemies/goomba';
import { PowerUp } from '@game/entities/objects/powerup';
import { MARIO_10 } from '@game/tutorial/mario-1-0';

/*
 * The 1-0 bot's controls (0.4.46: its own module, free of the test runner, so a browser play-test
 * can load the very bot the sims use; tutorial-bot.ts re-exports it).
 */

/*
 * A scripted Mario for 1-0 (0.4.36's layout, tutorial/mario-1-0.ts MARIO_10), reading the current
 * lesson: walks and hops the steps, sprints down the stretch until the bar fills and walks on,
 * takes a sprinting jump over each gap, stomps the Goomba, bumps the ? block, grows, takes the
 * pipe down and the side pipe up, walks on, bumps the hidden vine out and climbs it over the tall
 * wall, smashes up through the tunnel's bricks, and grabs the flagpole.
 */

const M = MARIO_10;

/** The bot's input for this frame (none while anything but the level is on top). */
export function tutorialBot(h: { top(): unknown }): Action[] {
  const top = h.top();
  if (!(top instanceof LevelScene)) return [];
  const d = top.tutorial;
  const w = top.world;
  const p = w.player;
  const b = p.body;
  const lesson = d?.lesson?.id ?? 'flag';
  const x = toPx(p.centerX);
  const out: Action[] = [];
  /** Walk to column `col`'s centre; true once there. */
  const goTo = (col: number, run = false): boolean => {
    const dx = col * 16 + 8 - x;
    if (Math.abs(dx) <= 3 && Math.abs(b.vx) < 256) return true;
    if (Math.abs(dx) > 3) out.push(dx > 0 ? 'right' : 'left');
    if (run) out.push('attack');
    return false;
  };
  /** Hold jump while rising (a full-height jump), press it on the ground. */
  const jump = () => {
    if (b.onGround ? (w.frame & 1) === 0 : b.vy < 0) out.push('jump');
  };
  const wallAhead = () => {
    const col = tileAt(b.x + b.w);
    const row = tileAt(b.y + b.h - 1);
    return w.map.isSolid(col + 1, row) || w.map.isSolid(col + 1, row - 1);
  };
  /** Sprint right and jump from the edge of the gap at column `edge`. */
  const leap = (edge: number) => {
    out.push('right', 'run');
    if ((b.onGround && toPx(b.x + b.w) >= edge * 16 - 4) || (!b.onGround && b.vy < 0)) out.push('jump');
  };
  switch (lesson) {
    case 'walk':
      goTo(11);
      break;
    case 'jump':
      out.push('right');
      if (wallAhead() || !b.onGround) jump();
      break;
    case 'sprint':
      out.push('right', 'run');
      break;
    case 'ease':
      out.push('right');
      break;
    case 'gap1':
      leap(M.gap1.x);
      break;
    case 'gap2':
      leap(M.gap2.x);
      break;
    case 'stomp': {
      const g = w.entities.find((e): e is Goomba => e instanceof Goomba && e.alive);
      if (!g) {
        out.push('right');
        break;
      }
      // Stop short of it, hop as it comes close, and come down on top of it.
      const gap = toPx(g.body.x + (g.body.w >> 1)) - x;
      if (!b.onGround) {
        if (b.vy < 0) out.push('jump');
        if (Math.abs(gap) > 2) out.push(gap > 0 ? 'right' : 'left');
      } else if (gap > 72) out.push('right');
      else if (b.vx > 0) out.push('left');
      else if (gap <= 30) jump();
      break;
    }
    case 'block':
      if (x < (M.coinBlock.x - 2) * 16) {
        out.push('right');
        if (wallAhead() || !b.onGround) jump();
        break;
      }
      if (goTo(M.coinBlock.x) || !b.onGround) jump();
      break;
    case 'grow': {
      const m = w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.alive);
      if (m) {
        goTo(Math.floor(toPx(m.body.x + (m.body.w >> 1)) / 16));
        break;
      }
      if (x < (M.mushroomBlock.x - 3) * 16) {
        out.push('right');
        if (wallAhead() || !b.onGround) jump();
        break;
      }
      if (goTo(M.mushroomBlock.x) || !b.onGround) jump();
      break;
    }
    case 'pipe':
      if (x < (M.pipe - 1) * 16) {
        out.push('right');
        if (wallAhead() || !b.onGround) jump();
        break;
      }
      if (b.y + b.h > tileToSub(11)) {
        // Hop onto the pipe.
        if (goTo(M.pipe - 1) || !b.onGround) jump();
        if (!b.onGround) out.push('right');
        break;
      }
      if (goTo(M.pipe) || x >= M.pipe * 16 + 4) out.push('down');
      break;
    case 'pipe-out':
      out.push('right');
      if ((wallAhead() && tileAt(b.x + b.w) < 11) || !b.onGround) jump();
      break;
    case 'secrets':
      out.push('right');
      break;
    case 'vine':
      // Under the empty-looking spot at the wall's foot, and up into it.
      if (goTo(M.vine.x) || !b.onGround) jump();
      break;
    case 'climb':
      if (p.vine) {
        // Up past the wall's top, let go of the stick, then step off to the right.
        if (b.y + b.h > tileToSub(M.vineWall.top) - 0x2000) out.push('up');
        else if ((w.frame & 3) !== 0) out.push('right');
        break;
      }
      // Just left of the block the vine grew from (in reach of it), jump to grab it.
      {
        const dx = M.vine.x * 16 - 5 - x;
        if (Math.abs(dx) > 1) out.push(dx > 0 ? 'right' : 'left');
        else if (Math.abs(b.vx) < 256 || !b.onGround) jump();
      }
      break;
    case 'slide': {
      // Still on the vine (a tip held him there): let go of RIGHT and press it again to step off.
      if (p.vine) {
        if ((w.frame & 3) !== 0) out.push('right');
        break;
      }
      const wall = M.lowWall.from * 16;
      const right = toPx(b.x + b.w);
      if (right > wall) {
        // Under it: crawl on (pushing right, DOWN let go: he stays down until there is room).
        out.push('right');
        break;
      }
      if (p.crouching && Math.abs(b.vx) < 0x100) {
        // Stopped short, ducking: stand, back off for a run-up.
        out.push('left');
        break;
      }
      if (!b.onGround) {
        out.push('right');
        break;
      }
      // A run at it from five tiles off, ducking just before it.
      const gap = wall - right;
      if (b.vx < 0 && gap < 80) out.push('left');
      else if (gap > 20) out.push('right', 'run');
      else if (b.vx >= 0x1000) out.push('down');
      else out.push('left');
      break;
    }
    case 'wall': {
      const col = M.bricks.to;
      const shut = w.map.isSolid(col, 9) || w.map.isSolid(col, 10);
      if (shut) {
        // Under the bricks: jump into them until the way up is open.
        if (goTo(col) || !b.onGround) jump();
        break;
      }
      // Up through the hole, then right onto the brick wall's top.
      if (b.onGround) {
        if (b.y + b.h <= tileToSub(M.brickWall.top)) out.push('right');
        else if (goTo(col)) jump();
        break;
      }
      if (b.vy < 0) out.push('jump');
      if (b.y + b.h < tileToSub(M.brickWall.top)) out.push('right');
      break;
    }
    case 'star': {
      // The Star out: after it (it bounces right); else up under the middle brick.
      const star = w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.alive);
      if (star) {
        const sx = toPx(star.body.x + (star.body.w >> 1));
        out.push(sx > x ? 'right' : 'left', 'run');
        if ((b.onGround && Math.abs(sx - x) < 24 && star.body.y < b.y) || (!b.onGround && b.vy < 0)) jump();
        break;
      }
      if (x < (M.starBrick.x - 3) * 16) {
        out.push('right');
        if (wallAhead() || !b.onGround) jump();
        break;
      }
      if (goTo(M.starBrick.x) || !b.onGround) jump();
      break;
    }
    case 'crowd':
      // A Star: straight through, running.
      out.push('right', 'run');
      if (p.star === 0) {
        const g = w.entities.some(
          (e) => e instanceof Goomba && e.alive && e.body.x > b.x && e.body.x - b.x < tileToSub(3),
        );
        if ((b.onGround && g) || (!b.onGround && b.vy < 0)) jump();
      }
      break;
    default:
      // The flag: run at it and jump.
      out.push('right', 'attack');
      if ((tileAt(b.x + b.w) >= M.flag - 2 && b.onGround) || (!b.onGround && b.vy < 0)) jump();
  }
  return out;
}
