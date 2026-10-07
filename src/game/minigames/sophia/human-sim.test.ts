import { describe, expect, it } from 'vitest';
import { CAUTIOUS, CLUMSY, SHARP, type HumanOptions } from './bot';
import { botRun } from './harness';

/** Pass rate over seeds 1..n. */
export function passRate(n: number, opts: Partial<HumanOptions>) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...opts, seed: i + 1 }));
  const passes = runs.filter((r) => r.result === 'pass');
  return { rate: passes.length / n, runs };
}

describe('Underworld: a human with 3 lives (difficulty)', () => {
  // SOPHIA_SIM=30 pnpm vitest run sophia/human-sim --silent=false prints a fuller report.
  const n = Number(process.env.SOPHIA_SIM ?? 0);

  it('a cautious first-timer (late reactions, misjudged positions, pauses) passes at least 85% of 30 seeds, and not unscathed', () => {
    const { rate, runs } = passRate(30, CAUTIOUS);
    expect(rate).toBeGreaterThanOrEqual(0.85);
    // It plays it as a player would: every room, the cache behind the cracked wall included.
    expect(runs.filter((r) => r.rooms.includes('cache')).length).toBeGreaterThanOrEqual(27);
    expect(runs.reduce((a, r) => a + r.lost, 0) / runs.length).toBeGreaterThan(1);
    // Nothing stuck: a run that does not pass ran out of lives.
    expect(runs.filter((r) => r.result === 'timeout')).toEqual([]);
  }, 600_000);

  it('a clumsy player sometimes wins and sometimes loses every life (over 30 seeds)', () => {
    const { rate, runs } = passRate(30, CLUMSY);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
    expect(runs.filter((r) => r.result === 'timeout')).toEqual([]);
  }, 600_000);

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
      for (const [name, o] of profiles) {
        const { rate, runs } = passRate(n, o);
        const where: Record<string, number> = {};
        for (const r of runs)
          for (const d of r.deaths) where[`${d.room}:${d.doing}`] = (where[`${d.room}:${d.doing}`] ?? 0) + 1;
        const fails = runs
          .filter((r) => r.result !== 'pass')
          .map((r) => `${r.result}@${r.room}/${r.bossPhase}:${r.bossHp}`);
        const secs = runs
          .filter((r) => r.result === 'pass')
          .map((r) => r.seconds)
          .sort((a, b) => a - b);
        const deaths = (runs.reduce((a, r) => a + r.deaths.length, 0) / runs.length).toFixed(1);
        const lost = (runs.reduce((a, r) => a + r.lost, 0) / runs.length).toFixed(1);
        const boss = (runs.reduce((a, r) => a + r.bossLost, 0) / runs.length).toFixed(1);
        const gun = runs.map((r) => r.gunAtBoss ?? 0);
        console.log(
          `${name}: pass ${(rate * 100).toFixed(0)}% of ${n} (deaths a run ${deaths}; POW lost ${lost}, to the boss ${boss};`,
          `gun at the boss ${Math.min(...gun)}-${Math.max(...gun)}; winning time median ${secs[secs.length >> 1] ?? '-'} s)`,
          JSON.stringify(where),
          JSON.stringify(fails),
        );
      }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
