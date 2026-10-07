import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import type { LevelData } from '@game/level/schema';
import { drops, dropSim } from './safety-floor-bot';

// The Safety floor assist over every bundled level: each hero dropped into each deadly pit and
// lava pool is caught at the rim (or on the lava) and walks or jumps back out onto real ground on
// at least one side; with the assist off the same drops still kill.

/** Drops a body wider than a tile has no way out of (one-tile shafts only). */
const WIDE_ONLY = new Set(['ll-11-4 lava@66']);

const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as (typeof CHARACTERS)[number];

/** Every bundled level once (copies such as 6-4 = 1-4 are swept once). */
function levels(): LevelData[] {
  const seen = new Set<string>();
  const out: LevelData[] = [];
  for (const id of levelIds()) {
    const l = getLevel(id);
    const key = `${l.width}:${l.theme}:${l.tiles.join(',')}:${JSON.stringify(l.zones)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

describe('Safety floor sweep: every bundled level', () => {
  const all = levels();

  it('finds the pits and lava pools to drop into', () => {
    const n = all.reduce((s, l) => s + drops(l).length, 0);
    expect(n).toBeGreaterThan(400);
    const lava = all.reduce((s, l) => s + drops(l).filter((d) => d.overLava).length, 0);
    expect(lava).toBeGreaterThan(20);
  });

  for (const id of ['mario', 'link', 'samus', 'simon', 'sophia']) {
    it(`${id}: caught at every rim and on every lava pool, then out onto the ground`, () => {
      const failures: string[] = [];
      for (const level of all) {
        for (const d of drops(level)) {
          // Simon's arc is fixed at take-off: out of a one-tile shaft (ll-3-4's holes through its
          // stacked floors) only straight up and back down, so he is left out of those.
          if (hero(id).movement.airControl === 'none' && d.width === 1) continue;
          // Sophia III's 19 px tank cannot leave a pool whose only ways up are one-tile shafts
          // (ll-11-4's lava pool under the lift at 66). The original widens such shafts for her
          // (its WideCharacter level variants, SO-45 to SO-48: a level-data change not made yet).
          if (id === 'sophia' && WIDE_ONLY.has(`${level.id} ${d.kind}@${d.x}`)) continue;
          const tag = `${id} ${level.id} ${d.kind}@${d.x} land ${d.land}`;
          let res = dropSim(level, hero(id), d, { safety: true, walkOut: true, dir: d.dirs[0] });
          if (res.died) {
            failures.push(`${tag}: died`);
            continue;
          }
          if (res.landedRow === null || res.landedRow > d.land) {
            failures.push(`${tag}: landed at ${res.landedRow}`);
            continue;
          }
          if (!res.out) res = dropSim(level, hero(id), d, { safety: true, walkOut: true, dir: d.dirs[1] });
          if (res.died || !res.out) failures.push(`${tag}: stuck${res.died ? ' (died)' : ''}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('assist off: the same drops still kill (small Mario)', () => {
    const survived: string[] = [];
    for (const level of all)
      for (const d of drops(level)) {
        const res = dropSim(level, hero('mario'), d, { safety: false });
        // A lift running through the pit can catch the drop: no fall there to begin with.
        if (!res.died && !res.onLift) survived.push(`${level.id} ${d.kind}@${d.x}`);
      }
    expect(survived).toEqual([]);
  });
});
