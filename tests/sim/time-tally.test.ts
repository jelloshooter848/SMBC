import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { TALLY_PER_FRAME, type World } from '@game/world/world';

// After the flagpole, the time left turns into points (the original's StatManager
// convertTimeToScore: TIME_PT_VAL = ScoreValue.TIME_REMAINING = 50 points per unit). The original
// counts about 30 units a second; this remake deliberately counts TALLY_PER_FRAME (2) units a
// frame, and JUMP finishes the tally at once for the same points.

const level = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../src/content/levels/world1/1-1.map'), 'utf8'),
  '1-1',
);

const phase = (w: World): string | undefined =>
  (w as unknown as { clear: { phase: string } | null }).clear?.phase;

/**
 * Runs from just before 1-1's pole to the end; `skipAt` = the tally frame on which JUMP is
 * pressed again (never when absent). Returns the clock and score as the tally began, its
 * length in frames and the score once it ended.
 */
function tally(skipAt?: number): { startTime: number; startScore: number; frames: number; endScore: number } {
  let before = { time: 0, score: 0 };
  let start = { time: -1, score: 0 };
  let frames = 0;
  let endScore = -1;
  const r = runSim({
    level,
    character: MARIO,
    script: { steps: [] },
    controller: () => {
      const held: Action[] = ['right'];
      // JUMP held into the pole; released at the tally's start, pressed again at `skipAt`.
      if (start.time < 0 || (skipAt !== undefined && frames >= skipAt)) held.push('jump');
      return held;
    },
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
  expect(r.outcome).toBe('cleared');
  return { startTime: start.time, startScore: start.score, frames, endScore };
}

describe('level clear time tally', () => {
  it(`counts ${TALLY_PER_FRAME} units a frame, 50 points per unit`, () => {
    const t = tally();
    expect(TALLY_PER_FRAME).toBe(2);
    expect(t.startTime).toBeGreaterThan(300);
    // 400 units take about 3.3 s: half as many frames as units, plus the closing frame.
    expect(Math.abs(t.frames - Math.ceil(t.startTime / TALLY_PER_FRAME))).toBeLessThanOrEqual(2);
    expect(t.frames).toBeLessThan(220);
    expect(t.endScore - t.startScore).toBe(t.startTime * 50);
  });

  it('JUMP finishes the tally at once for the same points', () => {
    const full = tally();
    const skipped = tally(10);
    expect(skipped.startTime).toBe(full.startTime);
    expect(skipped.frames).toBeLessThanOrEqual(13);
    expect(skipped.endScore).toBe(full.endScore);
    expect(skipped.endScore - skipped.startScore).toBe(skipped.startTime * 50);
  });

  it('holding JUMP into the pole does not skip (only a fresh press does)', () => {
    let frames = 0;
    let started = false;
    runSim({
      level,
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right', 'jump'] }] },
      maxFrames: 3000,
      start: { x: 194, y: 12, mode: 'stand' },
      until: (w) => {
        if (phase(w) === 'countdown') {
          started = true;
          frames++;
        }
        return false;
      },
    });
    expect(started).toBe(true);
    expect(frames).toBeGreaterThan(100);
  });

  it('never lets the score pass 9999999 (StatManager.SCORE_MAX), run out or skipped', () => {
    for (const skip of [false, true]) {
      let max = 0;
      const r = runSim({
        level,
        character: MARIO,
        state: { score: 9_990_000 },
        script: { steps: [] },
        controller: (w) =>
          phase(w) !== 'countdown' ? ['right', 'jump'] : skip && w.frame % 2 ? ['jump'] : [],
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
    }
  });
});
