import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SOPHIA } from '@game/characters/sophia';
import { CEIL, sophiaState } from '@game/characters/sophia/state';
import { toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

/*
 * v0.4.72 38a: with Wall Climb (the Crusher) Sophia III drove down a pit's wall and wrapped
 * round its bottom onto the underside of the stage's bottom row (y = 240), then drove along
 * below the screen alive, or looped between the wall and that underside. The original's walls
 * go on below the screen: she drives off the bottom and dies in the pit. canGrip already keeps
 * the ceiling grip off the bottom row; the floor-wrap and wall-wrap turns keep off it too.
 */

interface Trace {
  under: boolean;
  maxY: number;
  minXBelow: number;
}

function drive(level: LevelData, rules: 'classic' | 'campaign', x: number, y: number, frames = 900) {
  const t: Trace = { under: false, maxY: 0, minXBelow: Infinity };
  let onCeil = false;
  const r = runSim({
    level,
    character: SOPHIA,
    rules,
    script: { steps: [] },
    maxFrames: frames,
    start: { x, y },
    state: { powerState: 'fire', kit: {} },
    controller: (w: World, f: number): Action[] => {
      const p = w.player;
      const st = sophiaState(p);
      const py = toPx(p.body.y);
      t.maxY = Math.max(t.maxY, py);
      if (st.surface === CEIL && py >= 232) t.under = true;
      if (py >= 232) t.minXBelow = Math.min(t.minXBelow, toPx(p.body.x));
      if (f < 30) return [];
      if (st.surface === CEIL) onCeil = true;
      // Right and down off the ledge, down the wall; then, if she ever got under, left along it.
      return onCeil ? ['left'] : ['right', 'down'];
    },
  });
  return { r, t };
}

describe('Sophia III: Wall Climb never wraps under the stage (38a)', () => {
  for (const rules of ['classic', 'campaign'] as const)
    it(`${rules}: down 1-1's first pit wall she falls and dies below the stage`, () => {
      const { r, t } = drive(getLevel('1-1'), rules, 64, 12);
      expect(t.under).toBe(false);
      expect(r.outcome).toBe('died');
      expect(t.maxY).toBeGreaterThan(240);
      // Never driven along below the screen (the bug reached x = 855 going left).
      expect(t.minXBelow).toBeGreaterThan(1090);
    });

  it('a floor only one row deep: driving off its ledge does not wrap down onto its face', () => {
    const W = 40;
    const rows = Array.from({ length: 14 }, () => '.'.repeat(W));
    const level = parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 4,13',
        '',
        '[tiles]',
        ...rows,
        '#'.repeat(10) + '.'.repeat(4) + '#'.repeat(W - 14),
      ].join('\n'),
    );
    const { r, t } = drive(level, 'classic', 6, 13, 600);
    expect(t.under).toBe(false);
    expect(r.outcome).toBe('died');
  });

  it('a pit wall that ends above the bottom still wraps round onto its underside', () => {
    // A ledge three tiles deep standing over open air (a floating platform's right end).
    const W = 40;
    const rows = Array.from({ length: 15 }, () => '.'.repeat(W));
    for (const y of [8, 9, 10]) rows[y] = '#'.repeat(12) + '.'.repeat(W - 12);
    const level = parseTextMap(['id: t', 'time: 300', 'start: 4,7', '', '[tiles]', ...rows].join('\n'));
    let got = false;
    runSim({
      level,
      character: SOPHIA,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 200,
      state: { powerState: 'fire', kit: {} },
      controller: (w: World, f: number): Action[] => {
        if (sophiaState(w.player).surface === CEIL && toPx(w.player.body.y) === 176) got = true;
        return f < 30 ? [] : ['right', 'down'];
      },
    });
    expect(got).toBe(true);
  });
});
