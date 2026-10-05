import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Piranha } from '@game/entities/enemies/piranha';
import { Bowser } from '@game/entities/enemies/bowser';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world5', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const loops = (events: WorldEvent[]) => events.filter((e) => e.type === 'loop');

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
    start: { x: col, y: top - 1, mode: 'stand' }, // also off the vine in a climb-start area
    controller: (w, f) => {
      if (f === 0) place(w, col, top, 10);
      return f > 2 ? ['down'] : [];
    },
  });
  expect(r.outcome).toBe('pipe');
  return r.events.find((e) => e.type === 'pipe');
}

describe('Lost Levels World 5 areas', () => {
  it('every area loads and runs 600 frames as Mario', () => {
    for (const id of [
      'll-5-1',
      'll-5-1-bonus',
      'll-5-1-sky',
      'll-5-2',
      'll-5-2-warp',
      'll-5-2-exit',
      'll-5-3',
      'll-5-3-bonus',
      'll-5-4',
    ]) {
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

  it('the 5-2 intro walks into its pipe and on into the underground level', () => {
    const r = runSim({ level: level('ll-5-2-intro'), character: MARIO, script: none, maxFrames: 600 });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-5-2', x: 2, y: 3 },
    });
  });
});

describe('Lost Levels 5-1', () => {
  it('the piranha hanging from the pipe at 27 comes down out of its rim', () => {
    let plant: Piranha | undefined;
    let maxH = 0;
    runSim({
      level: level('ll-5-1'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 16, 13);
        plant ??= w.entities.find((e): e is Piranha => e instanceof Piranha && e.hanging);
        if (plant && toPx(plant.body.h) > 0) {
          // It hangs down from the bottom edge of the rim tile at row 10.
          expect(toPx(plant.body.y)).toBe(11 * 16);
          maxH = Math.max(maxH, toPx(plant.body.h));
        }
        return [];
      },
    });
    expect(plant).toBeDefined();
    expect(toPx((plant as Piranha).body.x) + 6).toBe(27 * 16 + 16); // centred on the 2-wide pipe
    expect(plant?.stompable).toBe(false);
    expect(maxH).toBe(24);
  });

  it('falling out of the coin heaven lands past the castle, at column 386', () => {
    const sky = runSim({
      level: level('ll-5-1-sky'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      start: { x: 97, y: 12, mode: 'stand' }, // on the last cloud ground instead of the vine
      controller: () => ['right'],
    });
    expect(sky.outcome).toBe('pipe');
    expect(sky.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-5-1', x: 386, y: 0, exitDir: 'fall' },
    });
    const main = runSim({
      level: level('ll-5-1'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      start: { x: 386, y: 0, mode: 'fall' },
    });
    const b = main.world.player.body;
    expect(main.world.player.dead).toBe(false);
    expect(b.onGround).toBe(true);
    expect(toPx(b.y + b.h)).toBe(13 * 16);
    expect(Math.floor(toPx(b.x) / 16)).toBe(386);
  });

  it('the warp zone pipe at 406 leads to 6-1', () => {
    expect(enterPipe('ll-5-1', 406, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-6-1', x: 2, y: 12 },
    });
  });
});

describe('Lost Levels 5-2', () => {
  it('the warp zone pipe at 214 leads to 7-1', () => {
    expect(enterPipe('ll-5-2', 214, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-7-1', x: 2, y: 12 },
    });
  });

  it('the pipe at the top of the vine leads to 8-1', () => {
    expect(enterPipe('ll-5-2-warp', 54, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-8-1', x: 2, y: 12 },
    });
  });

  it('the side pipe at 171 leads to the exit area', () => {
    const r = runSim({
      level: level('ll-5-2'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 170, 10, 0); // on the bricks in front of the mouth at 171,8-9
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-5-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
  });
});

describe('Lost Levels 5-3', () => {
  it('walking on past column 128 always sends the player back to 64', () => {
    let prev: number | null = null;
    const r = runSim({
      level: level('ll-5-3'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 126, 13); // on the treetop that spans 126-135
        return ['right'];
      },
      until: (w) => {
        const x = toPx(w.player.body.x);
        const jumped = prev !== null && Math.abs(x - prev) > 48;
        prev = x;
        return jumped;
      },
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 128, to: 64 }]);
    const x = toPx(r.world.player.body.x);
    expect(x).toBeGreaterThanOrEqual(63 * 16);
    expect(x).toBeLessThan(66 * 16);
  });

  it('the pipe at 38 is the way on: it leads to the bonus room, which comes out at 147', () => {
    expect(enterPipe('ll-5-3', 38, 4)).toEqual({
      type: 'pipe',
      target: { level: 'll-5-3-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    // The 32-wide room scrolls: drop in at column 1 and walk the whole floor to the side pipe.
    let camMax = 0;
    const r = runSim({
      level: level('ll-5-3-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      controller: (w) => {
        camMax = Math.max(camMax, toPx(w.camera.x));
        return ['right'];
      },
    });
    expect(camMax).toBeGreaterThan(0);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-5-3', x: 147, y: 10, exitDir: 'up' },
    });
  });
});

describe('Lost Levels 5-4', () => {
  it('Bowser only breathes fire', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('ll-5-4'),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 191, 10);
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
    expect(bowser?.attack).toBe('fire');
    expect(flames).toBeGreaterThan(0);
    expect(hammers).toBe(0);
  });
});
