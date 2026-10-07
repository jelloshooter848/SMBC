import { describe, expect, it } from 'vitest';
import { CAUTIOUS, SHARP, type CautiousOptions } from './bot';
import { botRun } from './harness';

/** The art lantern's column (on the last wall's top) and the health lantern's (at its foot). */
const ART_LANTERN = 105;
const HEAL_LANTERN = 109;

/** A clumsier first-timer: slower, misjudges more, pauses more. */
export const CLUMSY: Partial<CautiousOptions> = { reaction: 21, error: 10, pause: 0.01 };

/** Pass rate over seeds 1..n. */
export function passRate(n: number, opts: Partial<CautiousOptions> = {}) {
  const runs = Array.from({ length: n }, (_, i) => botRun({ ...CAUTIOUS, ...opts, seed: i + 1 }));
  const passes = runs.filter((r) => r.result === 'pass');
  return { rate: passes.length / n, runs };
}

describe('Shadow Duel: a cautious human (difficulty)', () => {
  // RYU_SIM=30 pnpm vitest run ryu/human-sim --silent=false prints a fuller report.
  const n = Number(process.env.RYU_SIM ?? 0);

  it('a sharp player gets through, with time to spare', () => {
    const r = botRun(SHARP);
    expect(r.result).toBe('pass');
    expect(r.lost).toBeLessThanOrEqual(10);
    expect(r.secondsLeft).toBeGreaterThan(80);
    // It plays the stage as a player would: the last wall's art lantern (the windmill) and the
    // health lantern at its foot are broken on the way.
    expect(r.arts).toBe(2);
    expect(r.broke).toEqual(expect.arrayContaining([ART_LANTERN, HEAL_LANTERN]));
  }, 60_000);

  it('a cautious first-timer (late reactions, misjudged distances and timing, pauses) usually wins, and not unscathed', () => {
    const { rate, runs } = passRate(8);
    expect(rate).toBeGreaterThanOrEqual(7 / 8);
    // (with the windmill in hand: the pass rate counts what a player has at the Masked Ninja)
    expect(runs.filter((r) => r.arts === 2).length).toBeGreaterThanOrEqual(7);
    expect(runs.filter((r) => r.broke.includes(HEAL_LANTERN)).length).toBeGreaterThanOrEqual(6);
    expect(runs.reduce((a, r) => a + r.lost, 0) / runs.length).toBeGreaterThan(4);
  }, 300_000);

  it('a clumsy player usually gets through, and falls short now and then', () => {
    const n = 24;
    const { rate } = passRate(n, CLUMSY);
    const fails = Math.round((1 - rate) * n);
    expect(rate).toBeGreaterThanOrEqual(1 / 2);
    expect(fails).toBeGreaterThanOrEqual(2);
  }, 600_000);

  it.runIf(n > 0)(
    'reports the pass rate',
    () => {
      const profiles: [string, Partial<CautiousOptions>][] = [
        ['sharp', SHARP],
        ['reaction 12', { reaction: 12 }],
        ['reaction 15', {}],
        ['reaction 18', { reaction: 18 }],
        ['clumsy', CLUMSY],
      ];
      for (const [name, o] of profiles) {
        const { rate, runs } = passRate(n, o);
        const fails: Record<string, number[]> = {};
        for (const [i, r] of runs.entries())
          if (r.result !== 'pass') {
            const where = r.bossHp === null ? `stage x${r.x}${r.fell ? ' fell' : ''}` : `boss at ${r.bossHp}`;
            (fails[where] ??= []).push(i + 1);
          }
        const lost = (runs.reduce((a, r) => a + r.lost, 0) / n).toFixed(1);
        const boss = (runs.reduce((a, r) => a + r.bossLost, 0) / n).toFixed(1);
        const left = runs.map((r) => r.secondsLeft).sort((a, b) => a - b);
        const art = runs.filter((r) => r.arts === 2).length;
        const heal = runs.filter((r) => r.broke.includes(HEAL_LANTERN)).length;
        console.log(
          `${name}: pass ${(rate * 100).toFixed(0)}% of ${n} (HP lost ${lost}, to the Masked Ninja ${boss};`,
          `seconds left: median ${left[left.length >> 1]}, lowest ${left[0]}; windmill ${art}, health lantern ${heal})`,
          JSON.stringify(fails),
        );
      }
      expect(n).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
