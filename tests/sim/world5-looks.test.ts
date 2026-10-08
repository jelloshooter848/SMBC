import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import type { LevelData } from '@game/level/schema';
import { runSim } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { drops, dropSim } from './safety-floor-bot';

/*
 * World 5 as Simon's world, Transylvania (0.4.28): its looks are skin only, so every hero plays
 * each World 5 level in its campaign look exactly as without it. Checked with real inputs for
 * every hero: a run-and-jump bot across each level (with the Safety floor on and off) traces the
 * same frames, and the Safety floor sweep's drops into every pit end the same, the five heroes the
 * bundled sweep covers (safety-floor-sweep.test.ts) caught and out onto the ground. 5-2's water
 * area, the underground lake, is no water theme: every hero still swims there (its `swim: true`).
 */

const IDS = ['5-1', '5-1-bonus', '5-2', '5-2-sky', '5-2-water', '5-3'];
const SWEPT = new Set(['mario', 'link', 'samus', 'simon', 'sophia']);

/** The level as the campaign plays it, and the classic level. */
const both = (id: string): [LevelData, LevelData] => [campaignLevel(getLevel(id)), getLevel(id)];

/** Hold right and run; jump in 24-frame presses every 48 frames, as a player charging ahead. */
const charge = (_: unknown, f: number): Action[] =>
  f % 48 < 24 ? ['right', 'run', 'jump'] : ['right', 'run'];

function trace(level: LevelData, hero: (typeof CHARACTERS)[number], safetyFloor: boolean) {
  const at: string[] = [];
  let swam = false;
  const r = runSim({
    level,
    character: hero,
    script: { steps: [] },
    controller: charge,
    maxFrames: 1500,
    assist: { safetyFloor, infiniteLives: true },
    until: (w, f) => {
      swam ||= w.player.inWater;
      if (f % 10 === 0) at.push(`${f}:${w.player.body.x}:${w.player.body.y}`);
      return false;
    },
  });
  expect(at.length).toBeGreaterThan(10);
  return { outcome: r.outcome, frames: r.frames, x: r.playerX, y: r.playerY, at, swam };
}

describe("World 5's looks play exactly as the classic levels, for every hero", () => {
  for (const id of IDS)
    it.each(CHARACTERS.map((c) => [c.id, c] as const))(`${id}: %s charges through the same`, (_, hero) => {
      const [camp, classic] = both(id);
      expect(camp.theme).not.toBe(classic.theme);
      for (const safety of [true, false]) {
        const t = trace(camp, hero, safety);
        expect(t).toEqual(trace(classic, hero, safety));
        // the underground lake swims for every hero, as the classic water area does
        if (id === '5-2-water') expect(t.swam, `${hero.id} swims`).toBe(true);
      }
    });

  for (const id of IDS)
    it(`${id}: every hero's drops into its pits end the same; the swept heroes walk out`, () => {
      const [camp, classic] = both(id);
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

describe("5-2's underground lake: every hero drops in and swims", () => {
  it.each(CHARACTERS.map((c) => [c.id, c] as const))('%s swims in the campaign lake', (_, hero) => {
    const r = runSim({
      level: campaignLevel(getLevel('5-2-water')),
      character: hero,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 900,
      until: (w, f) => f > 10 && w.player.body.onGround,
    });
    expect(r.world.player.inWater, hero.id).toBe(true);
    expect(Number.isFinite(r.world.waterTop)).toBe(true);
  });
});
