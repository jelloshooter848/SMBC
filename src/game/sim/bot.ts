import type { Action } from '@engine/input/actions';
import { tileAt } from '@engine/math/units';
import type { World } from '../world/world';
import { Enemy } from '../entities/enemies/enemy';

export interface BotState {
  jumpHold: number;
  retreat: number;
  stuckFrames: number;
  lastX: number;
}

export function newBot(): BotState {
  return { jumpHold: 0, retreat: 0, stuckFrames: 0, lastX: -1 };
}

/**
 * A simple reactive controller: runs right, jumps over walls, gaps and enemies, and backs up
 * when stuck. Good enough to clear flat SMB1 levels, and a useful regression driver because
 * it reacts to the simulated world rather than replaying a fixed script.
 */
export function autoPlayer(world: World, bot: BotState): Action[] {
  const p = world.player;
  const b = p.body;
  const map = world.map;
  const col = tileAt(b.x + b.w);
  const feetRow = tileAt(b.y + b.h - 1);
  const out: Action[] = ['attack'];

  if (bot.retreat > 0) {
    bot.retreat--;
    out.push('left');
    return out;
  }
  out.push('right');

  // Stuck against something for a while: back up to get a running start.
  if (b.x === bot.lastX) bot.stuckFrames++;
  else bot.stuckFrames = 0;
  bot.lastX = b.x;
  if (bot.stuckFrames > 30) {
    bot.retreat = 48;
    bot.stuckFrames = 0;
  }

  let wantJump = false;
  // Wall ahead at foot level or one above: jump late when slow, earlier at speed.
  const reach = Math.abs(b.vx) >= p.profile.maxWalk ? 2 : 1;
  for (let d = 1; d <= reach; d++) {
    if (map.isSolid(col + d, feetRow) || map.isSolid(col + d, feetRow - 1)) wantJump = true;
  }
  // Gap ahead: no ground under the next few columns.
  let ground = false;
  for (let d = 1; d <= 2 && !ground; d++) {
    for (let r = feetRow + 1; r <= feetRow + 3; r++) {
      const c = map.collisionAt(col + d, r);
      if (c === 'solid' || c === 'top') {
        ground = true;
        break;
      }
    }
  }
  if (!ground && b.onGround) wantJump = true;
  // Enemy close ahead.
  for (const e of world.entities) {
    if (!(e instanceof Enemy) || !e.alive || !e.contactHurts) continue;
    const dx = e.body.x - (b.x + b.w);
    if (dx > -8 * 256 && dx < 40 * 256 && Math.abs(e.body.y - b.y) < 32 * 256) wantJump = true;
  }
  if (wantJump && b.onGround) bot.jumpHold = 22;
  if (bot.jumpHold > 0) {
    bot.jumpHold--;
    out.push('jump');
  }
  return out;
}
