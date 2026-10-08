import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import type { LevelData } from '@game/level/schema';
import { runSim } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { drops, dropSim } from './safety-floor-bot';

/*
 * World 3 as Mega Man's world (0.4.26): its looks are skin only, so every hero plays each World 3
 * level in its campaign look exactly as in the classic level. Checked with real inputs for every
 * hero: a run-and-jump bot across each level (with the Safety floor on and off) traces the same
 * frames, and the Safety floor sweep's drops into every pit and lava pool end the same, the five
 * heroes the bundled sweep covers (safety-floor-sweep.test.ts) caught and out onto the ground.
 */

const IDS = ['3-1-bonus', '3-2', '3-3', '3-4'];
const SWEPT = new Set(['mario', 'link', 'samus', 'simon', 'sophia']);

/** Hold right and run; jump in 24-frame presses every 48 frames, as a player charging ahead. */
const charge = (_: unknown, f: number): Action[] =>
  f % 48 < 24 ? ['right', 'run', 'jump'] : ['right', 'run'];

function trace(level: LevelData, hero: (typeof CHARACTERS)[number], safetyFloor: boolean) {
  const at: string[] = [];
  const r = runSim({
    level,
    character: hero,
    script: { steps: [] },
    controller: charge,
    maxFrames: 1500,
    assist: { safetyFloor, infiniteLives: true },
    until: (w, f) => {
      if (f % 10 === 0) at.push(`${f}:${w.player.body.x}:${w.player.body.y}`);
      return false;
    },
  });
  expect(at.length).toBeGreaterThan(10);
  return { outcome: r.outcome, frames: r.frames, x: r.playerX, y: r.playerY, at };
}

describe("World 3's looks play exactly as the classic levels, for every hero", () => {
  for (const id of IDS)
    it.each(CHARACTERS.map((c) => [c.id, c] as const))(`${id}: %s charges through the same`, (_, hero) => {
      const classic = getLevel(id);
      const camp = campaignLevel(classic);
      expect(camp.theme).not.toBe(classic.theme);
      for (const safety of [true, false])
        expect(trace(camp, hero, safety)).toEqual(trace(classic, hero, safety));
    });

  for (const id of IDS)
    it(`${id}: every hero's drops into its pits and lava end the same; the swept heroes walk out`, () => {
      const classic = getLevel(id);
      const camp = campaignLevel(classic);
      // 3-2, 3-3 and 3-4 have pits or lava to drop into; the bonus room has none
      expect(drops(classic).length > 0, 'drops').toBe(id !== '3-1-bonus');
      const failures: string[] = [];
      for (const hero of CHARACTERS)
        for (const d of drops(classic)) {
          const tag = `${hero.id} ${id} ${d.kind}@${d.x}`;
          const run = (l: LevelData, dir: -1 | 1) =>
            dropSim(l, hero, d, { safety: true, walkOut: true, dir });
          const first = run(camp, d.dirs[0]);
          expect(first, tag).toEqual(run(classic, d.dirs[0]));
          if (!SWEPT.has(hero.id)) continue;
          const res = first.out || first.died ? first : run(camp, d.dirs[1]);
          if (res.died || !res.out) failures.push(`${tag}: ${res.died ? 'died' : 'stuck'}`);
        }
      expect(failures).toEqual([]);
    });
});
