import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { px } from '@engine/math/units';
import { Goomba } from '@game/entities/enemies/goomba';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import { HAMMER, Projectile } from '@game/entities/projectiles/projectile';
import { Firework } from '@game/entities/effects/firework';
import type { Entity } from '@game/entities/entity';
import type { World } from '@game/world/world';

const level = (dir: string, id: string) =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels', dir, `${id}.map`), 'utf8'),
    id,
  );
const l11 = level('world1', '1-1');

const phase = (w: World): string | undefined =>
  (w as unknown as { clear: { phase: string } | null }).clear?.phase;

describe('flagpole touch clears the stage (EventManager.touchedFlagPole)', () => {
  it('removes every enemy and projectile within 2 tiles of the screen, and nothing further off', () => {
    let near: Entity[] = [];
    let far: Entity | null = null;
    let checked = false;
    runSim({
      level: l11,
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right', 'jump'] }] },
      maxFrames: 400,
      start: { x: 194, y: 12, mode: 'stand' },
      until: (w, f) => {
        if (f === 0) {
          const cam = w.camera;
          near = [
            new Goomba(px(190 * 16), px(12 * 16)),
            new BulletBill(px(204 * 16), px(3 * 16), -1), // still on screen at the touch at full bill speed
            new Projectile(px(191 * 16), px(2 * 16), 1, HAMMER, null),
            new Goomba(cam.right + px(20), px(4 * 16)), // just off screen, still on the stage
          ];
          far = new Goomba(cam.x - px(60), px(12 * 16)); // more than 2 tiles left of the screen
          far.despawnMargin = null; // so only the flag clear could remove it, not World.cull
          for (const e of [...near, far]) w.spawn(e);
        }
        if (phase(w) === 'slide') {
          checked = true;
          return true;
        }
        return false;
      },
    });
    expect(checked).toBe(true);
    for (const e of near) expect(e.alive, e.kind).toBe(false);
    expect(near.map((e) => e.kind)).toEqual(['goomba', 'bullet-bill', 'hammer', 'goomba']);
    expect((far as Entity | null)?.alive).toBe(true);
  });
});

/** Play to the 1-1 flag with `time` on the clock; what the flag sequence did. */
function flagRun(time: number) {
  let atTouch = -1;
  let scoreAfterTally = -1;
  const fireworks = new Set<Entity>();
  let flagFrames = 0;
  const r = runSim({
    level: l11,
    character: MARIO,
    script: { steps: [{ frame: 0, hold: ['right', 'jump'] }] },
    maxFrames: 3000,
    start: { x: 194, y: 12, mode: 'stand', time },
    until: (w) => {
      const ph = phase(w);
      if (ph === 'slide' && atTouch < 0) atTouch = w.time ?? 0;
      if (ph === 'flag') {
        if (scoreAfterTally < 0) scoreAfterTally = w.state.score;
        flagFrames++;
      }
      for (const e of w.entities) if (e instanceof Firework) fireworks.add(e);
      return false;
    },
  });
  return { atTouch, fireworks: [...fireworks], bonus: r.score - scoreAfterTally, flagFrames, r };
}

describe('fireworks after the tally (StatManager.timeScoreConverterTmrLsr, Level.raiseFlag)', () => {
  // The clock at the touch for a start of 400; shift the start to land on each last digit.
  const base = flagRun(400).atTouch;
  const startFor = (digit: number) => 400 - (((base % 10) - digit + 10) % 10);

  it.each([
    [6, 6],
    [3, 3],
    [1, 1],
    [5, 0],
    [0, 0],
    [8, 0],
  ])('time ending in %i at the touch sets off %i, 500 points each', (digit, n) => {
    const run = flagRun(startFor(digit));
    expect(run.atTouch % 10).toBe(digit);
    expect(run.r.outcome).toBe('cleared');
    expect(run.fireworks.length).toBe(n);
    expect(run.bonus).toBe(n * 500);
    // One every 400 ms (24 frames), the level ends 1 s after the last; 90 frames without any.
    expect(run.flagFrames).toBe(n ? 1 + n * 24 + 60 : 90);
  });

  it('places them over the castle flag at FireworkLocations', () => {
    const run = flagRun(startFor(6));
    const centres = run.fireworks.map((e) => [e.body.x / 256 + 8, e.body.y / 256 + 8]);
    // 1-1's castle (decor-castle 202 12): its flag starts at x 3264, y 136; pivot y = 120.
    expect(centres).toEqual([
      [3272 - 16, 120 - 64],
      [3272 - 48, 120 - 16],
      [3272 + 48, 120 - 48],
      [3272 + 48, 120],
      [3272, 120 - 48],
      [3272 - 48, 120 - 16],
    ]);
  });
});
