import { describe, expect, it } from 'vitest';
import { appendFileSync, readFileSync } from 'node:fs';
import { reach } from './sophia-reach';

/*
 * The full completability sweep for Sophia III (0.4.11 review): every campaign level, searched
 * with the real game (sophia-reach.ts). Too slow for every run (minutes a level), so it is off
 * unless SOPHIA_SWEEP is set:
 *
 *   SOPHIA_SWEEP=1 [LVLS=1-1,4-4 | GROUP=<file of comma-separated ids>] [POWERS=small,big,fire]
 *   [BUDGET=20000] [OUT=<file>] pnpm vitest run tests/sim/sophia-sweep.test.ts
 *
 * One line a level goes to OUT (or the console). The levels it cannot finish are in
 * docs/HEROES.md (Sophia III: levels she cannot finish) with the reason.
 */

const SMB = ['1', '2', '3', '4', '5', '6', '7', '8'].flatMap((w) =>
  ['1', '2', '3', '4'].map((s) => `${w}-${s}`),
);
const LL = Array.from({ length: 13 }, (_, i) => String(i + 1)).flatMap((w) =>
  ['1', '2', '3', '4'].map((s) => `ll-${w}-${s}`),
);

function ids(): string[] {
  if (process.env.GROUP) return readFileSync(process.env.GROUP, 'utf8').trim().split(',');
  if (process.env.LVLS) return process.env.LVLS.split(',');
  return ['1-0', ...SMB, ...LL];
}

describe.skipIf(!process.env.SOPHIA_SWEEP)('Sophia III completability sweep', () => {
  it.each(ids())(
    '%s',
    (id) => {
      // Each power in turn (POWERS=small,big,fire) until one finishes the level.
      const powers = (process.env.POWERS ?? 'small').split(',');
      const out: string[] = [];
      let path = '';
      for (const power of powers) {
        const t = Date.now();
        const r = reach(id, power, Number(process.env.BUDGET ?? 20000));
        out.push(
          `${power}:${r.done ? (r.how ?? 'done') : `no(furthest ${r.furthest}, ${r.spots} spots, ${r.areas.join(' ')})`}:${Math.round((Date.now() - t) / 1000)}s`,
        );
        if (r.done) {
          path = r.path.join(' | ');
          break;
        }
      }
      const line = `REACH ${id} ${out.join(' ')}\n   ${path}\n`;
      if (process.env.OUT) appendFileSync(process.env.OUT, line);
      else console.log(line);
      expect(out.length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
