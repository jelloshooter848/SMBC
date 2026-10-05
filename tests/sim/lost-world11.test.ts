import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import { BalanceLift } from '@game/entities/objects/balance-lift';
import { Spring } from '@game/entities/objects/spring';
import type { Lift } from '@game/entities/objects/lift';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// The Lost Levels World B (stored as World 11).
const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world11', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/** Stand on a pipe top and press down; returns the pipe event. */
function enterPipeDown(id: string, col: number, top: number) {
  const r = runSim({
    level: level(id),
    character: MARIO,
    script: none,
    maxFrames: 120,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) place(w, col, top, 8);
      return ['down'];
    },
  });
  expect(r.outcome).toBe('pipe');
  return r.events.find((e) => e.type === 'pipe');
}

describe('Lost Levels World B areas', () => {
  it.each([
    'll-11-1',
    'll-11-1-sky',
    'll-11-2-intro',
    'll-11-2',
    'll-11-2-exit',
    'll-11-3',
    'll-11-4',
    'll-11-4-exit',
  ])('%s loads and runs 600 frames as Mario', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
    // The intro walks Mario into its pipe on its own; everything else just runs.
    if (id.endsWith('-intro')) expect(r.outcome).toBe('pipe');
    else expect(r.frames).toBe(600);
  });
});

describe('Lost Levels B-1', () => {
  it('the green springboard at 129 throws Mario off the top of the screen and he comes back down', () => {
    const l = level('ll-11-1');
    l.entities = l.entities.filter((e) => e.type === 'spring-green' || e.type.startsWith('decor'));
    let spring: Spring | undefined;
    let launched = false;
    let minFeet = Infinity;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 900,
      controller: (w, f) => {
        if (f === 0) place(w, 129, 10, 1);
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) launched = true;
        const b = w.player.body;
        if (launched) minFeet = Math.min(minFeet, toPx(b.y + b.h));
        return launched ? ['jump'] : [];
      },
      until: (w, f) => launched && f > 60 && w.player.body.onGround,
    });
    expect(spring?.green).toBe(true);
    expect(launched).toBe(true);
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(false);
    expect(minFeet).toBeLessThan(0); // the feet leave the top of the screen
  });
});

describe('Lost Levels B-2', () => {
  it('the side pipe at the end of the water leads to the flagpole area', () => {
    const r = runSim({
      level: level('ll-11-2'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 172, 9, 0);
        return ['right'];
      },
    });
    expect(r.world.waterTop).toBeLessThan(Infinity);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-11-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
  });
});

describe('Lost Levels B-3', () => {
  const billsSeen = (col: number, floor: number): number => {
    const seen = new Set<number>();
    runSim({
      level: level('ll-11-3'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, col, floor);
        for (const e of w.entities) if (e instanceof BulletBill) seen.add(e.id);
        return [];
      },
    });
    return seen.size;
  };

  it('Bullet Bills fly in over the treetops between 137 and 181, and not before', () => {
    expect(billsSeen(157, 5)).toBeGreaterThan(0);
    expect(billsSeen(128, 5)).toBe(0);
  });

  it('the balance lift at 27/31 sinks under Mario while its partner rises', () => {
    let pair: BalanceLift | undefined;
    let start: [number, number] | undefined;
    runSim({
      level: level('ll-11-3'),
      character: MARIO,
      script: none,
      maxFrames: 80,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 18, 9); // on the treetop at 16-20, so the lift spawns
        pair ??= w.entities.find((e): e is BalanceLift => e instanceof BalanceLift);
        if (pair?.platforms && !start) {
          const [left, right] = pair.platforms;
          start = [toPx(left.body.y), toPx(right.body.y)];
          const b = w.player.body;
          b.x = left.body.x + px(8);
          b.y = left.body.y - b.h - px(1);
          b.vy = 0x01000;
        }
        return [];
      },
    });
    const [left, right] = (pair as BalanceLift).platforms as [Lift, Lift];
    expect(toPx(left.body.x) >> 4).toBe(27);
    expect(toPx(right.body.x) >> 4).toBe(31);
    const [l0, r0] = start as [number, number];
    const sunk = toPx(left.body.y) - l0;
    expect(sunk).toBeGreaterThan(8);
    expect(r0 - toPx(right.body.y)).toBe(sunk);
  });
});

describe('Lost Levels B-4', () => {
  it('the piranha pipes at 97, 129 and 161 lead back to the pipe at 19', () => {
    for (const col of [97, 129, 161]) {
      expect(enterPipeDown('ll-11-4', col, 10)).toEqual({
        type: 'pipe',
        target: { level: 'll-11-4', x: 19, y: 10, exitDir: 'up' },
      });
    }
  });

  it('the pipe at 193 leads to the warp room, whose pipe (labelled D) warps to D-1', () => {
    expect(enterPipeDown('ll-11-4', 193, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-11-4-exit', x: 3, y: 10, exitDir: 'up' },
    });
    expect(enterPipeDown('ll-11-4-exit', 22, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-13-1', x: 2, y: 12 },
    });
  });

  it('the axe drops the bridge and leads on to C-1', () => {
    const r = runSim({
      level: level('ll-11-4'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 237, 9, 0);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-12-1' });
  });
});
