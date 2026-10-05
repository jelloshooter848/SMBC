import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Princess } from '@game/entities/objects/princess';
import { Projectile } from '@game/entities/projectiles/projectile';
import { carryTime } from '@game/scenes/level';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string, world = 8): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, `../../src/content/levels/world${world}`, `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const loops = (events: WorldEvent[]) => events.filter((e) => e.type === 'loop');

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

describe('World 8-4: the last castle', () => {
  it('walking past column 110 loops back to 37 with no checkpoint needed', () => {
    const r = runSim({
      level: level('8-4'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 108, 13);
        return ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) < 60 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 110, to: 37 }]);
  });

  it('a wrong pipe leads back into the same castle', () => {
    const r = runSim({
      level: level('8-4'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 51, 11);
        return ['down'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '8-4', x: 19, y: 10, exitDir: 'up' },
    });
  });

  it('the final Bowser throws hammers and breathes fire', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('8-4-end'),
      character: MARIO,
      script: none,
      maxFrames: 700,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 28, 10);
        bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser);
        for (const e of w.entities) {
          if (!(e instanceof Projectile) || e.owner !== bowser || seen.has(e.id)) continue;
          seen.add(e.id);
          if (e.spec.kind === 'hammer') hammers++;
          if (e.spec.kind === 'bowser-flame') flames++;
        }
        return [];
      },
    });
    expect(bowser?.attack).toBe('both');
    expect(hammers).toBeGreaterThanOrEqual(5);
    expect(flames).toBeGreaterThan(0);
  });

  it('the axe ends the game: the exit leads to the ending, past the princess', () => {
    let princess: Princess | undefined;
    const r = runSim({
      level: level('8-4-end'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 45, 9, 0);
        princess ??= w.entities.find((e): e is Princess => e instanceof Princess);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'end' });
    expect(princess).toBeDefined();
  });
});

describe('the timer across areas of one stage', () => {
  it('carries the clock between areas of the same stage only', () => {
    expect(carryTime(level('1-1', 1), level('1-1-bonus', 1), 312)).toBe(312);
    expect(carryTime(level('1-1-bonus', 1), level('1-1', 1), 290)).toBe(290);
    expect(carryTime(level('8-4'), level('8-4-water'), 150)).toBe(150);
    expect(carryTime(level('1-1', 1), level('1-2', 1), 300)).toBeUndefined();
    expect(carryTime(level('1-1', 1), level('1-1-bonus', 1), null)).toBeUndefined();
  });

  it('a level entered with a carried clock keeps it instead of restarting at 400', () => {
    const fresh = runSim({ level: level('1-1', 1), character: MARIO, script: none, maxFrames: 1 });
    expect(fresh.world.time).toBe(400);
    const back = runSim({
      level: level('1-1', 1),
      character: MARIO,
      script: none,
      maxFrames: 1,
      start: { x: 163, y: 10, mode: 'pipe-exit', time: 287 },
    });
    expect(back.world.time).toBe(287);
  });
});

describe('World 8 areas', () => {
  it('every area loads and runs', () => {
    for (const id of ['8-1', '8-1-bonus', '8-2', '8-2-bonus', '8-3', '8-4', '8-4-water', '8-4-end']) {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 60 });
      expect(r.frames).toBe(60);
    }
  });
});
