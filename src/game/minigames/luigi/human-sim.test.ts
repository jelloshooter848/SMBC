import { describe, expect, it } from 'vitest';
import { CAUTIOUS, CLUMSY, SHARP, type RaceBotOptions } from './bot';
import { raceRun } from './sim';

/** Races over seeds 1..n, Luigi racing on to his finish even when Mario wins. */
function races(n: number, opts: Partial<RaceBotOptions>) {
  const runs = Array.from({ length: n }, (_, i) => raceRun({ ...opts, seed: i + 1, rivalOn: true }));
  return { rate: runs.filter((r) => r.result === 'pass').length / n, runs };
}

describe('Mirror Race: a human against Luigi (difficulty)', () => {
  // LUIGI_SIM=1 pnpm vitest run luigi/human-sim --silent=false prints a fuller report.
  const report = Number(process.env.LUIGI_SIM ?? 0) > 0;

  it('a sharp player wins by well over a second and a half', () => {
    const r = raceRun({ ...SHARP, rivalOn: true });
    expect(r.result).toBe('pass');
    expect((r.luigiAt ?? 0) - (r.marioAt ?? Infinity)).toBeGreaterThan(90);
  });

  it('a cautious first-timer (late reactions, misjudged spacing and jumps, pauses, waits at plants) wins at least 85% of 30 races', () => {
    const { rate, runs } = races(30, CAUTIOUS);
    expect(rate).toBeGreaterThanOrEqual(0.85);
    // A stuck bot is not race difficulty, and Luigi always makes it to the pole.
    expect(runs.filter((r) => r.stuck)).toEqual([]);
    expect(runs.filter((r) => r.luigiAt === null)).toEqual([]);
    // It does meet the plants: it waits for some that are up.
    expect(runs.filter((r) => r.waited > 0).length).toBeGreaterThanOrEqual(20);
  }, 120_000);

  it('a clumsy player sometimes wins and sometimes loses (over 30 races)', () => {
    const { rate, runs } = races(30, CLUMSY);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
    expect(runs.filter((r) => r.stuck)).toEqual([]);
  }, 120_000);

  it.runIf(report)(
    'reports the win rates',
    () => {
      for (const [name, o] of [
        ['sharp', SHARP],
        ['cautious', CAUTIOUS],
        ['clumsy', CLUMSY],
      ] as const) {
        const { rate, runs } = races(30, o);
        const died = runs.filter((r) => r.died).map((r) => r.x);
        const lost = runs.filter((r) => r.result === 'fail' && !r.died).length;
        const won = runs.flatMap((r) => (r.marioAt !== null ? [r.marioAt] : [])).sort((a, b) => a - b);
        const luigi = runs.flatMap((r) => (r.luigiAt !== null ? [r.luigiAt] : [])).sort((a, b) => a - b);
        console.log(
          `${name}: win ${(rate * 100).toFixed(0)}% of 30 (died ${died.length} at px ${died.join(',')}; lost the race ${lost});`,
          `Mario's median ${((won[won.length >> 1] ?? 0) / 60).toFixed(1)} s, Luigi's ${((luigi[luigi.length >> 1] ?? 0) / 60).toFixed(1)} s`,
        );
      }
      expect(report).toBe(true);
    },
    600_000,
  );
});
