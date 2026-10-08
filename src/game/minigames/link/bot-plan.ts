import type { BotPlan } from '../../topdown/bot';
import { PushBlock } from '../../topdown/entity';
import { TILE } from '../../topdown/geometry';
import type { TopDownWorld } from '../../topdown/world';

const blockAt = (w: TopDownWorld, x: number, y: number) =>
  w.entities.some((e) => e instanceof PushBlock && !e.moving && e.x === x && e.y === y);

/**
 * A full run of the Shadow Keep for the bot (topdown/bot.ts): used by the tests and handy for
 * tuning in the browser. Rooms in keep order (dungeon.ts); rooms passed more than once have plans
 * that look at what Link has found.
 *
 *   start → bats (key) → start → map hall (unlock; the map) → cellar (boomerang) → map hall →
 *   shutters → compass → shutters → blocks → knights (key) → armory (bombs; bomb the cracked
 *   wall) → shrine (white sword) → armory → knights (unlock) → switch → keeper (heart container) →
 *   triforce
 */
export const KEEP_PLAN: Readonly<Record<string, BotPlan>> = {
  start: (w) => [{ do: 'leave', side: w.keys > 0 ? 'n' : 'w' }],
  bats: [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'e' }],
  map: (w) =>
    w.inv.has('boomerang')
      ? [{ do: 'leave', side: 'n' }]
      : [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'w' }],
  cellar: [{ do: 'chest' }, { do: 'fight' }, { do: 'leave', side: 'e' }],
  shutters: (w) =>
    w.found.has('compass') ? [{ do: 'leave', side: 'w' }] : [{ do: 'fight' }, { do: 'leave', side: 'e' }],
  compass: [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'w' }],
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
  knights: (w) =>
    w.inv.has('bomb')
      ? [{ do: 'leave', side: 'e' }]
      : [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'n' }],
  armory: (w) =>
    w.swordBeam
      ? [{ do: 'leave', side: 's' }]
      : [
          { do: 'fight' },
          { do: 'chest' },
          {
            do: 'bomb',
            from: { x: 2 * TILE, y: 5 * TILE },
            dir: 'left',
            hide: { x: 3 * TILE, y: 2 * TILE },
            until: (w) => w.doorOpen('w'),
          },
          { do: 'leave', side: 'w' },
        ],
  shrine: [{ do: 'chest' }, { do: 'leave', side: 'e' }],
  switch: [
    { do: 'fight' },
    { do: 'goto', x: 8 * TILE, y: 5 * TILE },
    { do: 'pickup' },
    { do: 'leave', side: 'n' },
  ],
  keeper: [{ do: 'fight' }, { do: 'pickup' }, { do: 'leave', side: 'n' }],
  triforce: [{ do: 'pickup' }],
};

/**
 * The same run for a player who never finds the secret: bombs from the armory's chest, then
 * straight back down, no shrine and no white sword (difficulty tuning, human-sim.test.ts).
 */
export const KEEP_PLAN_NO_SHRINE: Readonly<Record<string, BotPlan>> = {
  ...KEEP_PLAN,
  armory: (w) =>
    w.inv.has('bomb')
      ? [{ do: 'leave', side: 's' }]
      : [{ do: 'fight' }, { do: 'chest' }, { do: 'leave', side: 's' }],
};
