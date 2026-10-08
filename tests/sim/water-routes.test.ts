import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { isSwimLevel } from '@game/level/schema';
import { runSim } from '@game/sim/headless';
import { toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { waterBot } from './water-bot';

// 0.4.25 (owner note 25): with every hero meeting water their own way (Mega Man and Samus walk
// the seabed with floaty jumps, the others swim with strokes of their own), every bundled level
// that swims stays passable for every hero, small and big: the water bot goes in at the level's
// start and comes out at its end (the side pipe out, or the exit line).

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Every level that swims, by id (the campaign's 2-2 is the same tiles with `swim: true`). */
const SWIM_LEVELS = levelIds().filter((id) => isSwimLevel(getLevel(id)));

// Sophia III drives her own water rules (her `drive`, unchanged here) and has her own
// completability search over every level (sophia-sweep.test.ts, sophia-routes.test.ts); the bot
// below plays the eight heroes who walk, jump and swim with the shared Player code.
const runs = CHARACTERS.filter((c) => !c.behaviour.drive).flatMap((c) =>
  (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((p) => [`${c.name} ${p}`, c, p] as const),
);

describe('water levels: every hero gets through', () => {
  it('finds the swimming levels', () => {
    expect(SWIM_LEVELS).toEqual(expect.arrayContaining(['2-2', '7-2', '8-4-water', 'll-9-1']));
  });

  it.each(SWIM_LEVELS)('%s', (id) => {
    const failures: string[] = [];
    for (const [name, c, power] of runs) {
      const r = runSim({
        level: getLevel(id),
        character: c,
        state: { powerState: power as 'small' },
        script: none,
        maxFrames: 6000,
        assist: { invulnerable: true },
        controller: waterBot(),
      });
      if (r.outcome !== 'pipe' && r.outcome !== 'cleared')
        failures.push(
          `${id} ${name}: ${r.outcome} at ${toPx(r.world.player.body.x) >> 4},${toPx(r.world.player.body.y) >> 4}`,
        );
    }
    expect(failures).toEqual([]);
  });
});
