import type { BotStep } from '../../topdown/bot';
import { PushBlock } from '../../topdown/entity';
import { TILE } from '../../topdown/geometry';
import type { TopDownWorld } from '../../topdown/world';

const blockAt = (w: TopDownWorld, x: number, y: number) =>
  w.entities.some((e) => e instanceof PushBlock && !e.moving && e.x === x && e.y === y);

/**
 * A full run of the Shadow Keep for the bot (topdown/bot.ts): used by the tests and handy for
 * tuning in the browser. Rooms in keep order (dungeon.ts).
 */
export const KEEP_PLAN: Readonly<Record<string, readonly BotStep[]>> = {
  start: [{ do: 'leave', side: 'n' }],
  bats: [{ do: 'fight' }, { do: 'leave', side: 'w' }],
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
  shutters: [{ do: 'fight' }, { do: 'leave', side: 'e' }],
  switch: [
    { do: 'fight' },
    { do: 'goto', x: 8 * TILE, y: 4 * TILE },
    { do: 'pickup' },
    { do: 'leave', side: 'n' },
  ],
  keeper: [{ do: 'fight' }, { do: 'leave', side: 'e' }],
  exit: [{ do: 'goto', x: 7.5 * TILE, y: 0 }],
};
