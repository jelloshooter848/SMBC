import type { BotPlan } from '../../topdown/bot';
import { PushBlock } from '../../topdown/entity';
import { TILE } from '../../topdown/geometry';
import type { TopDownWorld } from '../../topdown/world';

const blockAt = (w: TopDownWorld, x: number, y: number) =>
  w.entities.some((e) => e instanceof PushBlock && !e.moving && e.x === x && e.y === y);

/**
 * A full run of the Shadow Keep for the bot (topdown/bot.ts): used by the tests and handy for
 * tuning in the browser. Rooms in keep order (dungeon.ts); the bats, shutters and armory rooms
 * are passed twice, so their plans look at what Link has found.
 *
 *   start → bats → cellar (boomerang) → bats → blocks → knights (key) → shutters (heart
 *   container) → armory (bombs; bomb the cracked wall) → shrine (shield) → armory → shutters →
 *   switch → keeper → exit
 */
export const KEEP_PLAN: Readonly<Record<string, BotPlan>> = {
  start: [{ do: 'leave', side: 'n' }],
  bats: (w) =>
    w.inv.has('boomerang')
      ? [{ do: 'fight' }, { do: 'leave', side: 'w' }]
      : [{ do: 'fight' }, { do: 'leave', side: 'e' }],
  cellar: [{ do: 'chest' }, { do: 'fight' }, { do: 'leave', side: 'w' }],
  blocks: [
    // From above the loose block, push it down two tiles, then from its left onto the plate.
    {
      do: 'push',
      dir: 'down',
      from: { x: 7 * TILE, y: 2 * TILE },
      until: (w) => blockAt(w, 7 * TILE, 5 * TILE),
    },
    { do: 'push', dir: 'right', from: { x: 6 * TILE, y: 5 * TILE }, until: (w) => w.met('plates') },
    { do: 'leave', side: 'n' },
  ],
  knights: [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'e' }],
  shutters: (w) =>
    w.inv.has('bomb')
      ? [{ do: 'leave', side: 'e' }]
      : [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'n' }],
  armory: (w) =>
    w.hero.shield
      ? [{ do: 'leave', side: 's' }]
      : [
          { do: 'fight' },
          { do: 'chest' },
          {
            do: 'bomb',
            from: { x: TILE, y: 5 * TILE },
            dir: 'left',
            hide: { x: 2 * TILE, y: 2 * TILE },
            until: (w) => w.doorOpen('w'),
          },
          { do: 'leave', side: 'w' },
        ],
  shrine: [{ do: 'chest' }, { do: 'leave', side: 'e' }],
  switch: [
    { do: 'fight' },
    { do: 'goto', x: 8 * TILE, y: 4 * TILE },
    { do: 'pickup' },
    { do: 'leave', side: 'n' },
  ],
  keeper: [{ do: 'fight' }, { do: 'leave', side: 'e' }],
  exit: [{ do: 'goto', x: 7.5 * TILE, y: 0 }],
};
