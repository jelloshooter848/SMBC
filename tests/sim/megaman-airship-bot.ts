import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import { Enemy } from '@game/entities/enemies/enemy';
import { Cannon } from '@game/entities/enemies/cannon';
import { ShieldJoe, Yoku, YOKU_WARN } from '@game/entities/enemies/wily-sky';
import { airshipBot, type AirshipBotOptions } from './airship-bot';

/*
 * A bot for Mega Man's airship deck (the Wily-sky remix, 4-2-airship's `[variant megaman]`): the
 * airship bot's way across (on with the screen, over walls and gaps, out of the way of shots),
 * the buster tapped at whatever is ahead at his height (`shoot`), and the stern's appearing-block
 * climb taken a block at a time: it waits on each support until the next block is up with time
 * to spare, then jumps from beside it and steers onto it, and from the last one onto the high
 * stern deck, where the airship bot takes the pipe.
 */

/** The high stern deck's first column and its surface row (4-2-airship.map). */
const STERN_X = 91;
const STERN_TOP = 8;
/** The lower stern deck's surface row, and where the climb starts. */
const LOWER_TOP = 13;
const CLIMB_FROM = 82;

export interface ShipBotOptions extends AirshipBotOptions {
  /** Tap the buster at what is ahead (Mega Man); off for a partner hero's geometry run. */
  shoot?: boolean;
}

export function megamanShipBot(opts: ShipBotOptions = {}): (w: World) => Action[] {
  const base = airshipBot(opts);
  let t = 0;
  let target: Yoku | 'stern' | null = null;
  /** Jump is pressed every other grounded frame, so each try is a fresh press. */
  let lastPress = false;
  return (w) => {
    t++;
    const p = w.player;
    const col = toPx(p.centerX) >> 4;
    const feet = toPx(p.body.y + p.body.h);
    const blocks = w.entities.filter((e): e is Yoku => e instanceof Yoku).sort((a, b) => a.ty - b.ty);
    if (
      col >= CLIMB_FROM &&
      col < STERN_X &&
      blocks.length &&
      !(feet <= STERN_TOP * 16 && col >= STERN_X - 1)
    )
      return climb(w, blocks);
    target = null;
    const acts = base(w);
    if (opts.shoot !== false && t % 6 === 0 && ahead(w)) acts.push('attack');
    return acts;
  };

  /** The order up: the block after the one he stands on (by height), then the stern deck. */
  function climb(w: World, blocks: Yoku[]): Action[] {
    const p = w.player;
    const b = p.body;
    const feet = toPx(b.y + b.h);
    const cx = toPx(p.centerX);
    // Blocks from the lowest (Y1) up.
    const order = [...blocks].sort((a, c) => c.ty - a.ty);
    if (b.onGround) {
      const on = order.findIndex((k) => k.ty * 16 === feet && Math.abs(k.tx * 16 + 8 - cx) <= 14);
      if (on >= 0) target = order[on + 1] ?? 'stern';
      else if (feet >= LOWER_TOP * 16) target = order[0] ?? 'stern';
    }
    if (!target) target = order[0] ?? 'stern';
    const tx = target === 'stern' ? STERN_X * 16 + 12 : target.tx * 16 + 8;
    const top = target === 'stern' ? STERN_TOP * 16 : target.ty * 16;
    const dx = tx - cx;
    const toward: Action = dx < 0 ? 'left' : 'right';
    const away: Action = dx < 0 ? 'right' : 'left';
    if (b.onGround) {
      // Wait for the block to be up with time to spare.
      if (target !== 'stern') {
        const left = target.on - target.phase(w.frame);
        if (!target.shown || left < YOKU_WARN + 20) return [];
      }
      // On the deck: from a step or two beside it. On a block (one tile wide): from where he is.
      const onBlock = feet < LOWER_TOP * 16;
      if (!onBlock && Math.abs(dx) > 28) return [toward];
      if (!onBlock && Math.abs(dx) < 16) return [away];
      lastPress = !lastPress;
      return lastPress ? ['jump', toward] : [toward];
    }
    // In the air: hold the jump; close in while below its top (never under it), then onto it.
    const acts: Action[] = ['jump'];
    if (feet > top - 2) {
      if (Math.abs(dx) > 22) acts.push(toward);
      else if (Math.abs(dx) < 14) acts.push(away);
    } else if (Math.abs(dx) > 2) acts.push(toward);
    return acts;
  }
}

/** Something to shoot within 10 tiles ahead, about his height (an enemy, a cannon, a guarded Joe). */
function ahead(w: World): boolean {
  const p = w.player;
  const y = toPx(p.body.y) + 8;
  const x = toPx(p.centerX);
  for (const e of w.entities) {
    if (!e.alive) continue;
    if (!(e instanceof Enemy) && !(e instanceof Cannon)) continue;
    if (e instanceof ShieldJoe && e.state === 'guard') continue;
    const ex = toPx(e.body.x + (e.body.w >> 1));
    const top = toPx(e.body.y);
    const dx = (ex - x) * p.facing;
    if (dx > 0 && dx < 160 && y >= top - 6 && y <= top + toPx(e.body.h) + 6) return true;
  }
  return false;
}
