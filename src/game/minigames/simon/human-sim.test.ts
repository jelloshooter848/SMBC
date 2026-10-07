import { describe, expect, it } from 'vitest';
import { CAUTIOUS, SHARP, type CautiousOptions } from './bot';
import { botRun } from './harness';

/** A clumsier first-timer: slower, misjudges more, pauses more. */
export const CLUMSY: Partial<CautiousOptions> = { reaction: 21, error: 10, pause: 0.01 };

/** Pass rate over seeds 1..n. */
export function passRate(n: number, opts: Partial<CautiousOptions> = {}) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...CAUTIOUS, ...opts, seed: i + 1 }));
  const passes = runs.filter((r) => r.result === 'pass');
  return { rate: passes.length / n, runs };
}

describe("Dracula's Castle: a cautious human (difficulty)", () => {
  // CV_SIM=30 pnpm vitest run simon/human-sim --silent=false prints a fuller report.
  const n = Number(process.env.CV_SIM ?? 0);

  it('a sharp player gets through unhurt, with time to spare', () => {
    const r = botRun(SHARP);
    expect(r.result).toBe('pass');
    expect(r.lost).toBeLessThanOrEqual(4);
    expect(r.secondsLeft).toBeGreaterThan(150);
  }, 60_000);

  it('a cautious first-timer (late reactions, misjudged distances and timing, pauses) usually wins, and not unscathed', () => {
    const { rate, runs } = passRate(8);
    expect(rate).toBeGreaterThanOrEqual(7 / 8);
    expect(runs.reduce((a, r) => a + r.lost, 0) / runs.length).toBeGreaterThan(4);
  }, 300_000);

  it('a clumsy player gets through now and then, and falls short now and then', () => {
    const { rate } = passRate(8, CLUMSY);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  }, 300_000);

  it.runIf(n > 0)(
    'reports the pass rate',
    () => {
      const profiles: [string, Partial<CautiousOptions>][] = [
        ['reaction 12', { reaction: 12 }],
        ['reaction 15', {}],
        ['reaction 18', { reaction: 18 }],
        ['clumsy', CLUMSY],
      ];
      for (const [name, o] of profiles) {
        const { rate, runs } = passRate(n, o);
        const fails: Record<string, number[]> = {};
        for (const [i, r] of runs.entries())
          if (r.result !== 'pass')
            (fails[r.bossHp === null ? `stage x${r.x}` : `boss at ${r.bossHp}`] ??= []).push(i + 1);
        const lost = (runs.reduce((a, r) => a + r.lost, 0) / n).toFixed(1);
        const boss = (runs.reduce((a, r) => a + r.bossLost, 0) / n).toFixed(1);
        const left = runs.map((r) => r.secondsLeft).sort((a, b) => a - b);
        console.log(
          `${name}: pass ${(rate * 100).toFixed(0)}% of ${n} (HP lost ${lost}, to Dracula ${boss};`,
          `seconds left: median ${left[left.length >> 1]}, lowest ${left[0]})`,
          JSON.stringify(fails),
        );
      }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
