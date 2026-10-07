import { describe, expect, it } from 'vitest';
import { CAUTIOUS, type CautiousOptions } from './bot';
import { botRun } from './harness';

/** Pass rate of the cautious human over seeds 1..n (`noSaw`: the capsule taken away first). */
export function cautiousPassRate(n: number, opts: Partial<CautiousOptions> = {}, noSaw = false) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...CAUTIOUS, ...opts, seed: i + 1 }, noSaw));
  const passed = runs.filter((r) => r.result === 'pass').length;
  return { rate: passed / n, runs };
}

describe('Station Escape: a cautious human (difficulty)', () => {
  // MM_SIM=40 pnpm vitest run megaman/human-sim --silent=false prints a fuller report.
  const n = Number(process.env.MM_SIM ?? 0);

  it('a cautious first-timer (late reactions, misjudged distances, pauses) usually wins, and not unscathed', () => {
    const { rate, runs } = cautiousPassRate(6);
    expect(rate).toBeGreaterThanOrEqual(5 / 6);
    // Some effort: the stage and Dark Mega Man still cost hit points.
    const avg = (k: 'lost' | 'bossLost') => runs.reduce((a, r) => a + r[k], 0) / runs.length;
    expect(avg('lost')).toBeGreaterThan(8);
    expect(avg('bossLost')).toBeGreaterThan(4);
  }, 120_000);

  it('without the Saw Disc (his weakness) the fight is clearly harder', () => {
    const saw = cautiousPassRate(6);
    const buster = cautiousPassRate(6, {}, true);
    const avg = (runs: { bossLost: number }[]) => runs.reduce((a, r) => a + r.bossLost, 0) / runs.length;
    expect(avg(buster.runs)).toBeGreaterThan(avg(saw.runs));
    expect(buster.rate).toBeLessThanOrEqual(saw.rate);
  }, 120_000);

  it.runIf(n > 0)(
    'reports the pass rate',
    () => {
      for (const noSaw of [false, true])
        for (const reaction of [12, 15, 18, 21]) {
          const { rate, runs } = cautiousPassRate(n, { reaction }, noSaw);
          const fails: Record<string, number[]> = {};
          for (const [i, r] of runs.entries()) {
            const where = r.bossHp === null ? `stage x${Math.round(r.x / 16)}` : `boss at ${r.bossHp}`;
            if (r.result !== 'pass') (fails[where] ??= []).push(i + 1);
          }
          const low = runs.filter((r) => r.result === 'pass' && r.hp <= 8).length;
          const avg = (k: 'lost' | 'bossLost') => (runs.reduce((a, r) => a + r[k], 0) / n).toFixed(1);
          console.log(
            `${noSaw ? 'buster only' : 'with the saw'}, reaction ${reaction}: pass ${(rate * 100).toFixed(0)}% of ${n}`,
            `(passes on 8 HP or less: ${low}; HP lost: ${avg('lost')}, to Dark Mega Man: ${avg('bossLost')})`,
            JSON.stringify(fails),
          );
        }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
