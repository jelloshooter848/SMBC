import { describe, expect, it } from 'vitest';
import { CAUTIOUS, CLUMSY, SHARP, type BotOptions } from './bot';
import { botRun } from './harness';

/** Pass rate over seeds 1..n. */
export function passRate(n: number, opts: Partial<BotOptions>) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...opts, seed: i + 1 }));
  const passes = runs.filter((r) => r.result === 'pass');
  return { rate: passes.length / n, runs };
}

describe('Jungle Assault: a human with 3 lives (difficulty)', () => {
  // BILL_SIM=1 pnpm vitest run bill/human-sim --silent=false prints a fuller report.
  const report = Number(process.env.BILL_SIM ?? 0) > 0;

  it('a sharp player gets through with lives to spare', () => {
    const r = botRun(SHARP);
    expect(r.result).toBe('pass');
    expect(r.deaths.length).toBeLessThanOrEqual(1);
    expect(r.stuck).toBe(false);
  }, 60_000);

  it('a cautious first-timer (late reactions, misjudged positions and jumps, pauses) passes at least 85% of 30 seeds, and plays honestly', () => {
    const { rate, runs } = passRate(30, CAUTIOUS);
    expect(rate).toBeGreaterThanOrEqual(0.85);
    // A stuck bot is not stage difficulty: none ever is.
    expect(runs.filter((r) => r.stuck)).toEqual([]);
    // It takes the falcons a player would (the spread gun most runs) and drops through ledges.
    expect(runs.filter((r) => r.weapons.includes('S')).length).toBeGreaterThanOrEqual(24);
    expect(runs.filter((r) => r.drops > 0).length).toBeGreaterThanOrEqual(10);
    // Not unscathed either.
    expect(runs.reduce((a, r) => a + r.deaths.length, 0)).toBeGreaterThan(5);
  }, 600_000);

  it('a clumsy player sometimes wins and sometimes loses every life (over 30 seeds)', () => {
    const { rate, runs } = passRate(30, CLUMSY);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
    expect(runs.filter((r) => r.stuck)).toEqual([]);
  }, 600_000);

  it.runIf(report)(
    'reports the pass rates',
    () => {
      const profiles: [string, Partial<BotOptions>][] = [
        ['sharp', SHARP],
        ['reaction 12', { ...CAUTIOUS, reaction: 12 }],
        ['cautious (15)', CAUTIOUS],
        ['reaction 18', { ...CAUTIOUS, reaction: 18 }],
        ['clumsy', CLUMSY],
      ];
      for (const [name, o] of profiles) {
        const { rate, runs } = passRate(30, o);
        const where: Record<string, number> = {};
        for (const r of runs)
          for (const d of r.deaths)
            where[`${d.phase}:${d.cause.split(' ')[0]}`] =
              (where[`${d.phase}:${d.cause.split(' ')[0]}`] ?? 0) + 1;
        const secs = runs
          .filter((r) => r.result === 'pass')
          .map((r) => r.seconds)
          .sort((a, b) => a - b);
        const deaths = (runs.reduce((a, r) => a + r.deaths.length, 0) / runs.length).toFixed(1);
        console.log(
          `${name}: pass ${(rate * 100).toFixed(0)}% of 30 (deaths a run ${deaths}; winning time median ${secs[secs.length >> 1] ?? '-'} s)`,
          JSON.stringify(where),
        );
      }
      expect(report).toBe(true);
    },
    3_600_000,
  );
});
