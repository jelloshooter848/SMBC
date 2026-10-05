import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import type { World } from '@game/world/world';

// After the flagpole, the time left turns into points (the original's StatManager
// convertTimeToScore / timeScoreConverterTmrLsr): one TIME unit per tick, TIME_PT_VAL =
// ScoreValue.TIME_REMAINING = 50 points each, about 30 units a second (one every two frames).

const level = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../src/content/levels/world1/1-1.map'), 'utf8'),
  '1-1',
);

const phase = (w: World): string | undefined =>
  (w as unknown as { clear: { phase: string } | null }).clear?.phase;

describe('level clear time tally', () => {
  it('counts the time down at 30 units a second, 50 points per unit', () => {
    let before = { time: 0, score: 0 };
    let start = { time: -1, score: 0 };
    let frames = 0;
    let endScore = -1;
    runSim({
      level,
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right', 'jump'] }] },
      maxFrames: 3000,
      start: { x: 194, y: 12, mode: 'stand' },
      until: (w) => {
        if (phase(w) === 'countdown') {
          if (start.time < 0) start = before;
          frames++;
        } else if (start.time < 0) before = { time: w.time ?? 0, score: w.state.score };
        else if (endScore < 0) endScore = w.state.score;
        return false;
      },
    });
    const startTime = start.time;
    const startScore = start.score;
    expect(startTime).toBeGreaterThan(300);
    // One unit every two frames: the whole tally takes twice as many frames as units.
    expect(Math.abs(frames - startTime * 2)).toBeLessThanOrEqual(2);
    expect(endScore - startScore).toBe(startTime * 50);
  });

  it('never lets the score pass 9999999 (StatManager.SCORE_MAX)', () => {
    let max = 0;
    const r = runSim({
      level,
      character: MARIO,
      state: { score: 9_990_000 },
      script: { steps: [{ frame: 0, hold: ['right', 'jump'] }] },
      maxFrames: 3000,
      start: { x: 194, y: 12, mode: 'stand' },
      until: (w) => {
        max = Math.max(max, w.state.score);
        return false;
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(max).toBe(9_999_999);
    expect(r.score).toBe(9_999_999);
  });
});
