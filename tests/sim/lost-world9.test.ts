import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Piranha } from '@game/entities/enemies/piranha';
import { Projectile } from '@game/entities/projectiles/projectile';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world9', `${id}.map`), 'utf8'),
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

describe('Lost Levels World 9 areas', () => {
  it.each(['ll-9-1-exit', 'll-9-1', 'll-9-2', 'll-9-3', 'll-9-3-sky', 'll-9-4'])(
    '%s loads and runs 600 frames as Mario',
    (id) => {
      const r = runSim({ level: level(id), character: MARIO, script: none, maxFrames: 600 });
      expect(r.outcome).toBe('timeout');
      expect(r.frames).toBe(600);
    },
  );
});

describe('Lost Levels 9-1', () => {
  it('the pipe in the starting room drops into the flooded main area at 1,3', () => {
    const r = runSim({
      level: level('ll-9-1-exit'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 23, 9, 8);
        return ['down'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-9-1', x: 1, y: 3, exitDir: 'none' },
    });
  });

  it('the main area is water: Mario swims, and the chasing Hammer Bro at 124 walks at him', () => {
    let bro: HammerBro | undefined;
    let startX = NaN;
    const r = runSim({
      level: level('ll-9-1'),
      character: MARIO,
      script: none,
      maxFrames: 90,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 112, 13);
        if (!bro) {
          bro = w.entities.find((e): e is HammerBro => e instanceof HammerBro);
          if (bro) startX = toPx(bro.body.x);
        }
        return [];
      },
    });
    expect(r.world.waterTop).toBeLessThan(Infinity);
    expect(bro?.chase).toBe(true);
    expect(startX - toPx((bro as HammerBro).body.x)).toBeGreaterThanOrEqual(20);
  });

  // Blocked by the converter: the flag ball at 166,2 is overwritten by water (see lost-world9.test.ts).
  it.skip('touching the flagpole at 166 clears 9-1 and leads to 9-2', () => {
    const r = runSim({
      level: level('ll-9-1'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 163, 8);
        return ['right'];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-9-2' });
  });
});

describe('Lost Levels 9-2', () => {
  it('the hanging piranha at 22 comes down out of its rim and goes back in', () => {
    const l = level('ll-9-2');
    expect(l.tiles[5 * l.width + 22]).toBe(T.PIPE_BOTTOM_L);
    let plant: Piranha | undefined;
    let maxH = 0;
    let backIn = false;
    runSim({
      level: l,
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 12, 13); // far enough to the left that it is not shy
        plant ??= w.entities.find((e): e is Piranha => e instanceof Piranha && e.hanging);
        if (plant) {
          const h = toPx(plant.body.h);
          if (h > 0) expect(toPx(plant.body.y)).toBe(6 * 16); // hangs from the rim's bottom edge
          if (maxH >= 24 && h === 0) backIn = true;
          maxH = Math.max(maxH, h);
        }
        return [];
      },
    });
    expect(plant).toBeDefined();
    expect(toPx((plant as Piranha).body.x) + 6).toBe(23 * 16);
    expect(maxH).toBe(24);
    expect(backIn).toBe(true);
  });
});

describe('Lost Levels 9-3', () => {
  it('the Bowser at 183 (no bridge, no axe) throws hammers and breathes no fire', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('ll-9-3'),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 172, 13);
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
    expect(bowser?.attack).toBe('hammer');
    expect(hammers).toBeGreaterThanOrEqual(3);
    expect(flames).toBe(0);
  });

  it('the pipe at 148 leads up into the coin heaven, and falling off it returns to 9-3 at 98', () => {
    const down = runSim({
      level: level('ll-9-3'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 148, 9, 8);
        return ['down'];
      },
    });
    expect(down.outcome).toBe('pipe');
    expect(down.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-9-3-sky', x: 1, y: 12 },
    });
    const fall = runSim({
      level: level('ll-9-3-sky'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      start: { x: 1, y: 12, mode: 'stand' },
      controller: (w, f) => {
        if (f === 0) place(w, 76, 13);
        return ['right'];
      },
    });
    expect(fall.outcome).toBe('pipe');
    expect(fall.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-9-3', x: 98, y: 0, exitDir: 'fall' },
    });
  });

  it('the flagpole at 214 clears 9-3 and leads to 9-4', () => {
    const r = runSim({
      level: level('ll-9-3'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 211, 13);
        return f > 2 && f < 40 ? ['right', 'jump'] : ['right'];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-9-4' });
  });
});

describe('Lost Levels 9-4', () => {
  it('swimming into the flagpole at 113 clears the last level and ends the game', () => {
    const r = runSim({
      level: level('ll-9-4'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 110, 8);
        return ['right'];
      },
    });
    expect(r.world.waterTop).toBeLessThan(Infinity);
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'end' });
  });
});
