import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { px, toPx } from '@engine/math/units';
import type { LevelData, Theme } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A 32-wide area with a row of waves at row 2 over open space and two ground rows. */
const flooded = (theme: Theme): LevelData =>
  parseTextMap(
    [
      'id: t',
      `theme: ${theme}`,
      'time: 300',
      'start: 4,12',
      '',
      '[tiles]',
      '.'.repeat(32),
      '.'.repeat(32),
      'w'.repeat(32),
      ...Array.from({ length: 10 }, () => '.'.repeat(32)),
      '#'.repeat(32),
      '#'.repeat(32),
    ].join('\n'),
  );

const lost = (world: number, id: string): LevelData =>
  parseTextMap(
    readFileSync(
      join(import.meta.dirname, `../../src/content/levels/lost/world${world}`, `${id}.map`),
      'utf8',
    ),
    id,
  );

/** Tap jump every 16 frames for 240 frames; returns the highest the player's feet got (px). */
function highestFeet(level: LevelData): { top: number; swam: boolean } {
  let top = Infinity;
  let swam = false;
  runSim({
    level,
    character: MARIO,
    script: none,
    maxFrames: 240,
    assist: { invulnerable: true },
    controller: (w, f) => {
      const b = w.player.body;
      top = Math.min(top, toPx(b.y + b.h));
      swam ||= w.player.inWater;
      return f % 16 < 2 ? ['jump'] : [];
    },
  });
  return { top, swam };
}

describe('Lost Levels skins keep physics apart from the look', () => {
  it.each(['water', 'overworld-water', 'water-gray', 'castle-water'] as const)(
    '%s: tapping jump swims up past the height of any jump',
    (theme) => {
      const { top, swam } = highestFeet(flooded(theme));
      expect(swam).toBe(true);
      expect(top).toBeLessThan(5 * 16);
    },
  );

  it.each([
    'overworld',
    'mushroom',
    'mushroom-red',
    'clouds',
    'clouds-overworld',
    'castle-overworld',
  ] as const)('%s: the same waves are scenery, Mario only jumps', (theme) => {
    const { top, swam } = highestFeet(flooded(theme));
    expect(swam).toBe(false);
    expect(top).toBeGreaterThan(6 * 16);
  });

  it('the overworld-look water of 9-2 still swims: Mario floats down slowly and strokes up', () => {
    const level = lost(9, 'll-9-2');
    expect(level.theme).toBe('overworld-water');
    let sinkFrom = 0;
    let sinkTo = 0;
    let strokeTop = Infinity;
    const r = runSim({
      level,
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        const b = w.player.body;
        if (f === 0) {
          // Open water over the ground before the first pipe.
          b.x = px(5 * 16);
          b.y = px(6 * 16);
          b.vy = 0;
        }
        if (f === 1) sinkFrom = toPx(b.y);
        if (f === 41) sinkTo = toPx(b.y);
        if (f >= 60) strokeTop = Math.min(strokeTop, toPx(b.y));
        return f >= 60 && f % 12 < 2 ? ['jump'] : [];
      },
    });
    expect(r.world.waterTop).toBeLessThan(Infinity);
    expect(r.world.player.inWater).toBe(true);
    // A fall would cover far more than 40px in 40 frames; sinking in water is slow.
    expect(sinkTo - sinkFrom).toBeGreaterThan(0);
    expect(sinkTo - sinkFrom).toBeLessThan(40);
    // Strokes lift him above where he sank to.
    expect(strokeTop).toBeLessThan(sinkTo);
  });

  it('9-4 in gray swims too, and 9-3 drawn under the daylight sky is a dry castle', () => {
    const gray = runSim({ level: lost(9, 'll-9-4'), character: MARIO, script: none, maxFrames: 2 });
    expect(gray.world.waterTop).toBeLessThan(Infinity);
    const castle = runSim({ level: lost(9, 'll-9-3'), character: MARIO, script: none, maxFrames: 2 });
    expect(castle.world.waterTop).toBe(Infinity);
    expect(castle.world.level.music).toBe('castle');
  });

  it('8-4b, drawn as the castle, is still swum through', () => {
    const level = lost(8, 'll-8-4-water');
    expect(level.theme).toBe('castle-water');
    const r = runSim({ level, character: MARIO, script: none, maxFrames: 150 });
    expect(r.world.waterTop).toBeLessThan(Infinity);
    expect(r.world.player.inWater).toBe(true);
    expect(r.world.level.music).toBe('water');
  });
});
