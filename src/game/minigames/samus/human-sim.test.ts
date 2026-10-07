import { describe, expect, it } from 'vitest';
import { CAUTIOUS, SHARP, type CautiousOptions } from './bot';
import { botRun } from './harness';

/** A clumsier first-timer: slow to react, misjudges more, often lets go of jumps too early. */
export const CLUMSY: Partial<CautiousOptions> = { reaction: 21, error: 10, shortJump: 0.25, pause: 0.01 };

/** Pass rate over seeds 1..n, and the seconds left on the passes. */
export function passRate(n: number, opts: Partial<CautiousOptions> = {}) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...CAUTIOUS, ...opts, seed: i + 1 }));
  const passes = runs.filter((r) => r.result === 'pass');
  const left = passes.map((r) => r.secondsLeft).sort((a, b) => a - b);
  return { rate: passes.length / n, runs, left, median: left[left.length >> 1] ?? 0 };
}

describe('Zebes Escape: a cautious human (difficulty)', () => {
  // ZEBES_SIM=30 pnpm vitest run samus/human-sim --silent=false prints a fuller report.
  const n = Number(process.env.ZEBES_SIM ?? 0);

  it('a sharp player gets out with time to spare', () => {
    const r = botRun(SHARP);
    expect(r.result).toBe('pass');
    expect(r.secondsLeft).toBeGreaterThan(25);
  }, 60_000);

  it('a cautious first-timer (late reactions, misjudged take-offs, early jump releases, pauses) usually makes it, and not with ease', () => {
    const { rate, runs, median } = passRate(8);
    expect(rate).toBeGreaterThanOrEqual(7 / 8);
    // Most make it on their first life (three lives are a cushion, not the plan).
    const first = runs.filter((r) => r.result === 'pass' && r.livesLost === 0).length / runs.length;
    expect(first).toBeGreaterThanOrEqual(0.7);
    // Tense: the clock is a real pressure, and the creatures cost energy.
    expect(median).toBeLessThan(35);
    expect(runs.reduce((a, r) => a + r.lost, 0) / runs.length).toBeGreaterThan(8);
  }, 300_000);

  it('a clumsy player loses lives now and then (time or energy), but gets out in the end', () => {
    const { rate, runs } = passRate(8, CLUMSY);
    expect(runs.some((r) => r.livesLost > 0)).toBe(true);
    expect(rate).toBeGreaterThan(0);
  }, 300_000);

  it.runIf(n > 0)(
    'reports the pass rate',
    () => {
      const profiles: [string, Partial<CautiousOptions>][] = [
        ['reaction 12', { reaction: 12 }],
        ['reaction 15', {}],
        ['reaction 18', { reaction: 18 }],
        ['reaction 21', { reaction: 21 }],
        ['clumsy', CLUMSY],
      ];
      for (const [name, o] of profiles) {
        const { rate, runs, left, median } = passRate(n, o);
        const fails: Record<string, number[]> = {};
        for (const [i, r] of runs.entries())
          if (r.result !== 'pass') (fails[`time/energy at x${r.x} row ${r.row}`] ??= []).push(i + 1);
        const lost = (runs.reduce((a, r) => a + r.lost, 0) / n).toFixed(1);
        const first = runs.filter((r) => r.result === 'pass' && r.livesLost === 0).length;
        console.log(
          `${name}: pass ${(rate * 100).toFixed(0)}% of ${n}, on the first life ${((first / n) * 100).toFixed(0)}%`,
          `(seconds left: median ${median}, lowest ${left[0]}; energy lost ${lost})`,
          JSON.stringify(fails),
        );
      }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
