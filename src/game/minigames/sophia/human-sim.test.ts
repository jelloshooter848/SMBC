import { describe, expect, it } from 'vitest';
import { CAUTIOUS, CLUMSY, SHARP, type HumanOptions } from './bot';
import { botRun } from './harness';

/** Pass rate over seeds 1..n (the full round, or the dungeon alone). */
export function passRate(n: number, opts: Partial<HumanOptions>, full = true) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...opts, seed: i + 1 }, 40000, full));
  const passes = runs.filter((r) => r.result === 'pass');
  return { rate: passes.length / n, runs };
}

describe('Underworld: a human with 3 lives, the whole round (difficulty)', () => {
  // SOPHIA_SIM=30 pnpm vitest run sophia/human-sim --silent=false prints a fuller report.
  const n = Number(process.env.SOPHIA_SIM ?? 0);

  it('a sharp player gets through the whole round: the cavern, the dungeon, the guardian, the Plutonium Boss', () => {
    const r = botRun({ ...SHARP, seed: 1 });
    expect(r.result).toBe('pass');
    expect(r.parts.cavern).toBeGreaterThan(0);
    expect(r.parts.boss).toBeGreaterThan(0);
    expect(r.rooms).toEqual(
      expect.arrayContaining(['gate', 'hall', 'turrets', 'crossing', 'cache', 'ante', 'guardian', 'exit']),
    );
  }, 120_000);

  it('a cautious first-timer (late reactions, misjudged positions, pauses) passes at least 85% of 30 seeds, and not unscathed', () => {
    const { rate, runs } = passRate(30, CAUTIOUS);
    expect(rate).toBeGreaterThanOrEqual(0.85);
    // It plays it as a player would: every room, the cache behind the cracked wall included.
    expect(runs.filter((r) => r.rooms.includes('cache')).length).toBeGreaterThanOrEqual(25);
    expect(runs.reduce((a, r) => a + r.lost + r.tankHits, 0) / runs.length).toBeGreaterThan(1);
    // Nothing stuck: a run that does not pass ran out of lives.
    expect(runs.filter((r) => r.result === 'timeout')).toEqual([]);
  }, 1_200_000);

  it('a clumsy player sometimes wins and sometimes loses every life (over 30 seeds)', () => {
    const { rate, runs } = passRate(30, CLUMSY);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
    expect(runs.filter((r) => r.result === 'timeout')).toEqual([]);
  }, 1_200_000);

  it.runIf(n > 0)(
    'reports the pass rates',
    () => {
      const profiles: [string, Partial<HumanOptions>][] = [
        ['sharp', SHARP],
        ['reaction 12', { ...CAUTIOUS, reaction: 12 }],
        ['cautious (15)', CAUTIOUS],
        ['reaction 18', { ...CAUTIOUS, reaction: 18 }],
        ['clumsy', CLUMSY],
      ];
      for (const full of [false, true])
        for (const [name, o] of profiles) {
          const { rate, runs } = passRate(n, o, full);
          const where: Record<string, number> = {};
          for (const r of runs)
            for (const d of r.deaths)
              where[`${d.room}:${d.doing}`] = (where[`${d.room}:${d.doing}`] ?? 0) + 1;
          const fails: Record<string, number> = {};
          for (const r of runs)
            if (r.result !== 'pass')
              fails[`${r.result}@${r.where}`] = (fails[`${r.result}@${r.where}`] ?? 0) + 1;
          const secs = runs
            .filter((r) => r.result === 'pass')
            .map((r) => r.seconds)
            .sort((a, b) => a - b);
          const deaths = (runs.reduce((a, r) => a + r.deaths.length, 0) / runs.length).toFixed(1);
          const lost = (runs.reduce((a, r) => a + r.lost, 0) / runs.length).toFixed(1);
          const tank = (runs.reduce((a, r) => a + r.tankHits, 0) / runs.length).toFixed(1);
          console.log(
            `${full ? 'round' : 'dungeon'} ${name}: pass ${(rate * 100).toFixed(0)}% of ${n} (deaths a run ${deaths}; POW lost ${lost}; tank hits ${tank};`,
            `winning time median ${secs[secs.length >> 1] ?? '-'} s)`,
            JSON.stringify(where),
            JSON.stringify(fails),
          );
        }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
