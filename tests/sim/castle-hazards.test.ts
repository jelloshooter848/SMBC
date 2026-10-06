import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Firebar } from '@game/entities/enemies/firebar';
import { Podoboo } from '@game/entities/enemies/podoboo';
import { toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

// Lava, fire bars and Podoboos against the original's Level.as/Scenery.as/Character.as (lava is
// scenery, death by the pit check), projectiles/FireBar.as and projectiles/LavaFireBall.as.

const levels = join(import.meta.dirname, '../../src/content/levels');
const load = (path: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(levels, path), 'utf8'), id);
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

const W = 40;
/** Floor at columns 0-9 and 21+, lava on row 13 between them with nothing below. */
const lavaPit = (): LevelData =>
  parseTextMap(
    [
      'id: t',
      'theme: castle',
      'time: 400',
      'start: 14,9',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '.'.repeat(W)),
      '#'.repeat(10) + '~'.repeat(11) + '#'.repeat(W - 21),
      '#'.repeat(10) + '.'.repeat(11) + '#'.repeat(W - 21),
    ].join('\n'),
  );

describe('lava', () => {
  it('is scenery: the player falls through it and dies off the screen, with no hop', () => {
    let diedAt = -1;
    let topAfterDeath = Infinity;
    let lowestAlive = 0;
    runSim({
      level: lavaPit(),
      character: MARIO,
      script: none,
      maxFrames: 300,
      controller: (w, f) => {
        const p = w.player;
        if (p.dead) {
          if (diedAt < 0) diedAt = f;
          topAfterDeath = Math.min(topAfterDeath, toPx(p.body.y));
        } else lowestAlive = Math.max(lowestAlive, toPx(p.body.y));
        return [];
      },
    });
    expect(diedAt).toBeGreaterThan(0);
    // Still alive with his top below the lava surface (row 13 = y 208) ...
    expect(lowestAlive).toBeGreaterThan(232);
    // ... and once dead he never comes back up into view.
    expect(topAfterDeath).toBeGreaterThanOrEqual(240);
  });
});

describe('fire bars (FireBar.as)', () => {
  /** `firebar` is the converter's fireBarLeft, `firebar-ccw` its fireBarRight. */
  const level = (): LevelData =>
    parseTextMap(
      [
        'id: t',
        'theme: castle',
        'time: 400',
        'start: 1,12',
        '',
        '[tiles]',
        ...Array.from({ length: 13 }, () => '.'.repeat(W)),
        '#'.repeat(W),
        '#'.repeat(W),
        '',
        '[entities]',
        'firebar 6 5',
        'firebar-ccw 10 5',
      ].join('\n'),
    );

  it('start pointing up; Left bars turn counter-clockwise, Right bars clockwise, at 106 degrees a second', () => {
    const seen = new Map<number, number[]>();
    runSim({
      level: level(),
      character: MARIO,
      script: none,
      maxFrames: 220,
      assist: { invulnerable: true },
      controller: (w) => {
        for (const e of w.entities) {
          if (!(e instanceof Firebar)) continue;
          const a = seen.get(toPx(e.body.x) >> 4) ?? [];
          a.push(e.angle);
          seen.set(toPx(e.body.x) >> 4, a);
        }
        return [];
      },
    });
    const left = seen.get(6) as number[];
    const right = seen.get(10) as number[];
    // Up is 3/4 of a turn with y down; increasing angles turn clockwise on screen.
    // (First seen after its first frame of turning.)
    expect(left[0]! + 322).toBe(49152);
    expect(right[0]! - 322).toBe(49152);
    const turned = (a: number[], n: number) => (a[n]! - a[0]! + 65536) % 65536;
    // 106 / 360 / 60 of a turn a frame.
    expect(turned(right, 1)).toBe(322);
    expect(turned(left, 1)).toBe(65536 - 322);
    // A whole turn takes 204 frames (3.40 s).
    expect(turned(right, 203)).toBeGreaterThan(65536 - 322);
    expect(turned(right, 204)).toBeLessThan(322);
  });
});

describe('Podoboos (LavaFireBall.as)', () => {
  it('rest below the screen, leap to about row 5.4 and fall at most 3.33 px per frame', () => {
    let pod: Podoboo | undefined;
    let top = Infinity;
    let fastestFall = 0;
    let firstLeap = -1;
    runSim({
      level: load('world3/3-4.map', '3-4'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        pod ??= w.entities.find((e): e is Podoboo => e instanceof Podoboo);
        if (pod) {
          if (pod.airborne && firstLeap < 0) firstLeap = f;
          top = Math.min(top, toPx(pod.body.y) - 2);
          fastestFall = Math.max(fastestFall, pod.body.vy);
        }
        return [];
      },
    });
    expect(pod).toBeDefined();
    // Sprite top peaks around y 87 (the original's 306 px rise from the screen's bottom).
    expect(top).toBeGreaterThanOrEqual(80);
    expect(top).toBeLessThanOrEqual(92);
    expect(fastestFall).toBe(0x03555);
  });
});
