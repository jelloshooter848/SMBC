import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { PowerUp } from '@game/entities/objects/powerup';
import { BalanceLift } from '@game/entities/objects/balance-lift';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world4', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/** Stand on the pipe whose top-left tile is (col, top) and press down; returns the transfer. */
function enterPipe(id: string, col: number, top: number) {
  const r = runSim({
    level: level(id),
    character: MARIO,
    script: none,
    maxFrames: 120,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) place(w, col, top, 10);
      return f > 2 ? ['down'] : [];
    },
  });
  expect(r.outcome).toBe('pipe');
  return r.events.find((e) => e.type === 'pipe');
}

describe('Lost Levels World 4 areas', () => {
  it('every area loads and runs 600 frames as Mario', () => {
    for (const id of ['ll-4-1', 'll-4-1-water', 'll-4-1-sky', 'll-4-2', 'll-4-2-bonus', 'll-4-3', 'll-4-4']) {
      const r = runSim({
        level: level(id),
        character: MARIO,
        script: none,
        maxFrames: 600,
        assist: { invulnerable: true },
      });
      expect(r.frames, id).toBe(600);
      expect(r.world.player.dead, id).toBe(false);
    }
  });
});

describe('Lost Levels 4-1', () => {
  it('the middle pipe on the ? block row at 152 drops into the water detour', () => {
    expect(enterPipe('ll-4-1', 152, 6)).toEqual({
      type: 'pipe',
      target: { level: 'll-4-1-water', x: 1, y: 1, exitDir: 'none' },
    });
  });

  it('the water detour swims back out through the side pipe to the pipe at 163', () => {
    const r = runSim({
      level: level('ll-4-1-water'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 75, 9, 4); // on the ledge in front of the pipe mouth at 77,8
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-4-1', x: 163, y: 10, exitDir: 'up' },
    });
  });

  it('a second Lakitu takes over from column 92 once the first stretch (19 to 50) is behind', () => {
    let lakitu: Lakitu | undefined;
    const r = runSim({
      level: level('ll-4-1'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 93, 13); // past column 92, where the second stretch starts
        lakitu ??= w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        return [];
      },
      until: () => lakitu !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    expect(lakitu?.alive).toBe(true);
    expect(lakitu?.leaving).toBe(false);
  });

  it('bumping the ? block at 124,9 releases a poison mushroom', () => {
    let poison: PowerUp | undefined;
    const r = runSim({
      level: level('ll-4-1'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 124, 13);
        poison ??= w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.item === 'poison');
        return f > 2 && f < 30 ? ['jump'] : [];
      },
      until: () => poison !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.map.get(124, 9)).not.toBe(T.Q_POISON);
  });
});

describe('Lost Levels 4-2', () => {
  it('the ground-level pipe at 172 leads into the bonus room', () => {
    expect(enterPipe('ll-4-2', 172, 13)).toEqual({
      type: 'pipe',
      target: { level: 'll-4-2-bonus', x: 1, y: 0, exitDir: 'none' },
    });
  });
});

describe('Lost Levels 4-3', () => {
  it('standing on a balance lift lowers it and raises its partner', () => {
    let lift: BalanceLift | undefined;
    let start: [number, number] | undefined;
    const r = runSim({
      level: level('ll-4-3'),
      character: MARIO,
      script: none,
      maxFrames: 90,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 44, 4, 8); // bring the camera (and the lifts) along
        lift ??= w.entities.find((e): e is BalanceLift => e instanceof BalanceLift);
        const p = lift?.platforms;
        if (p && !start) {
          start = [toPx(p[0].body.y), toPx(p[1].body.y)];
          place(w, 44, 5, 8); // on the left platform (44,5); its partner hangs at 50,9
        }
        return [];
      },
    });
    const [left, right] = (lift as BalanceLift).platforms as NonNullable<BalanceLift['platforms']>;
    expect(start).toEqual([5 * 16, 9 * 16]);
    const sank = toPx(left.body.y) - 5 * 16;
    expect(sank).toBeGreaterThan(16);
    expect(9 * 16 - toPx(right.body.y)).toBe(sank); // the rope pulls the partner up as far
    expect(r.world.player.dead).toBe(false);
  });
});

describe('Lost Levels 4-4', () => {
  it('the axe drops Bowser and the castle exit leads to 5-1', () => {
    const r = runSim({
      level: level('ll-4-4'),
      character: MARIO,
      script: none,
      maxFrames: 1200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 205, 9, 0);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-5-1' });
  });
});
