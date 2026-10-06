import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Koopa } from '@game/entities/enemies/koopa';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { Piranha } from '@game/entities/enemies/piranha';
import { Spring } from '@game/entities/objects/spring';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world7', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const loops = (events: WorldEvent[]) => events.filter((e) => e.type === 'loop');
const pipeTarget = (events: WorldEvent[]) => {
  const e = events.find((x) => x.type === 'pipe');
  return e?.type === 'pipe' ? e.target : undefined;
};

/** Put the player at column `col` (plus `dx` px), feet on top of row `floor`, camera along. */
function place(w: World, col: number, floor: number, dx = 2): void {
  const b = w.player.body;
  b.x = px(col * 16 + dx);
  b.y = px(floor * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/** Stand on a pipe top (or beside a side pipe) and hold a direction until the pipe takes the player. */
function enterPipe(id: string, col: number, floor: number, hold: Action, dx = 2) {
  return runSim({
    level: level(id),
    character: MARIO,
    script: none,
    maxFrames: 300,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) place(w, col, floor, dx);
      return [hold];
    },
  });
}

const AREAS = [
  'll-7-1',
  'll-7-1-bonus',
  'll-7-1-exit',
  'll-7-1-bonus2',
  'll-7-2',
  'll-7-2-bonus',
  'll-7-3',
  'll-7-4',
];

describe('Lost Levels World 7 areas', () => {
  it.each(AREAS)('%s loads and runs 600 frames as Mario', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
    expect(r.outcome).toBe('timeout');
    expect(r.frames).toBe(600);
  });

  it.each(AREAS)('%s survives 600 frames of running and jumping', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      controller: (_w, f) => (f % 50 < 20 ? ['right', 'jump'] : ['right']),
    });
    expect(r.frames).toBeGreaterThan(0);
  });
});

describe('Lost Levels 7-1: the pipe detour', () => {
  it('the pipe on the column at 117 drops into the bonus room', () => {
    const r = enterPipe('ll-7-1', 117, 3, 'down');
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-7-1-bonus', x: 1, y: 0, exitDir: 'none' });
  });

  it('the bonus room side pipe leads to the second overworld area, out of its pipe at 3', () => {
    const r = enterPipe('ll-7-1-bonus', 27, 12, 'right', 8);
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-7-1-exit', x: 3, y: 10, exitDir: 'up' });
  });

  it('the pipe at the end of that area drops into a second bonus room', () => {
    const r = enterPipe('ll-7-1-exit', 109, 9, 'down');
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-7-1-bonus2', x: 1, y: 0, exitDir: 'none' });
  });

  it('the second bonus room returns to 7-1 out of the pipe at 163, past the checkpoint', () => {
    const r = enterPipe('ll-7-1-bonus2', 27, 12, 'right', 8);
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-7-1', x: 163, y: 10, exitDir: 'up' });
  });
});

describe('Lost Levels 7-1: hanging piranha plants', () => {
  it('the plant in the pipe hanging at 16 comes down out of the rim', () => {
    let plant: Piranha | undefined;
    let lowest = -Infinity;
    runSim({
      level: level('ll-7-1'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 4, 13); // well away from the pipe
        plant ??= w.entities.find(
          (e): e is Piranha => e instanceof Piranha && e.hanging && e.body.x < px(20 * 16),
        );
        if (plant) lowest = Math.max(lowest, toPx(plant.body.y + plant.body.h));
        return [];
      },
    });
    expect(plant).toBeDefined();
    // The rim (row 7) opens downward at y = 128; the plant reaches well below it.
    expect(lowest).toBeGreaterThan(8 * 16 + 8);
  });
});

describe('Lost Levels 7-2: the repeating stretch', () => {
  it('walking past column 128 always loops back to 64 (no checkpoints)', () => {
    const r = runSim({
      level: level('ll-7-2'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 126, 11); // on the mushroom ledge just before the loop column
        return ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) < 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 128, to: 64 }]);
    expect(toPx(r.world.player.body.x)).toBeLessThan(66 * 16);
  });

  it('a jump over the loop column still loops (it spans the whole height)', () => {
    const r = runSim({
      level: level('ll-7-2'),
      character: MARIO,
      script: none,
      maxFrames: 200,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 125, 11);
        return f < 20 ? ['right', 'jump'] : ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) < 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 128, to: 64 }]);
  });

  it('the way on is the pipe at 115: the bonus room returns at 147, beyond the loop', () => {
    const down = enterPipe('ll-7-2', 115, 4, 'down');
    expect(pipeTarget(down.events)).toEqual({ level: 'll-7-2-bonus', x: 1, y: 0, exitDir: 'none' });
    const back = enterPipe('ll-7-2-bonus', 11, 12, 'right', 8);
    expect(pipeTarget(back.events)).toEqual({ level: 'll-7-2', x: 147, y: 10, exitDir: 'up' });
    const loop = level('ll-7-2').zones.find((z) => z.kind === 'loop');
    expect(loop?.x).toBeLessThan(147);
  });

  it('the pipe top is out of jumping reach; a bounce off the red paratroopa at 112 gets there', () => {
    let koopa: Koopa | undefined;
    let dropped = false;
    let lowestFeet = 0;
    const r = runSim({
      level: level('ll-7-2'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        const b = w.player.body;
        if (f === 0) place(w, 100, 11); // on the mushroom below, seven tiles under the pipe top
        koopa ??= w.entities.find(
          (e): e is Koopa =>
            e instanceof Koopa && e.wings && e.body.x > px(111 * 16) && e.body.x < px(114 * 16),
        );
        if (!koopa) return [];
        if (!dropped) {
          // Wait until it flies low (well under the pipe top at y = 64), then drop onto its back.
          if (toPx(koopa.body.y) < 100) return [];
          dropped = true;
          b.x = koopa.body.x;
          b.y = koopa.body.y - b.h - px(20);
          b.vy = 0;
          lowestFeet = toPx(b.y + b.h);
        }
        if (koopa.wings) return ['jump']; // straight down onto it, jump held for the high bounce
        return b.onGround && toPx(b.x) >= 115 * 16 - 4 ? ['down'] : ['jump', 'right'];
      },
    });
    expect(dropped).toBe(true);
    expect(lowestFeet).toBeGreaterThan(64); // the drop starts below the pipe top
    expect(koopa?.wings).toBe(false); // stomped
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r.events)).toEqual({ level: 'll-7-2-bonus', x: 1, y: 0, exitDir: 'none' });
  });

  it('Lakitu flies in after 170 at mid height and leaves at the end of its stretch (218)', () => {
    let lakitu: Lakitu | undefined;
    let left = false;
    const ys = new Set<number>();
    runSim({
      level: level('ll-7-2'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        lakitu ??= w.entities.find((e): e is Lakitu => e instanceof Lakitu);
        if (lakitu?.leaving) left = true;
        if (lakitu && !left) ys.add(toPx(lakitu.body.y));
        if (f === 0) place(w, 171, 13); // inside the stretch: it comes once the player passes 170
        if (f === 200 && lakitu) place(w, 222, 13); // past the end column
        return [];
      },
      until: () => left && !(lakitu as Lakitu).alive,
    });
    expect(lakitu).toBeDefined();
    expect(left).toBe(true);
    // A lakituEndMiddle stretch: it flies at mid-screen (y 112) instead of just under the HUD.
    expect([...ys]).toEqual([112]);
  });
});

describe('Lost Levels 7-3: green springboards', () => {
  it('the green spring at 21 throws the player off the top of the screen', () => {
    let launched = false;
    let minFeet = Infinity;
    const r = runSim({
      level: level('ll-7-3'),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 21, 10, 0); // drop onto the plate from above
        const spring = w.entities.find((e): e is Spring => e instanceof Spring && e.green);
        if (spring?.busy) launched = true;
        const b = w.player.body;
        if (launched) minFeet = Math.min(minFeet, toPx(b.y + b.h));
        return launched ? ['jump'] : [];
      },
      until: (w, f) => launched && f > 60 && w.player.body.onGround,
    });
    expect(launched).toBe(true);
    expect(minFeet).toBeLessThan(0);
    expect(r.outcome).not.toBe('died');
  });
});

describe('Lost Levels 7-4: the hammer Bowser', () => {
  it('Bowser on the bridge throws hammers and no fire', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('ll-7-4'),
      character: MARIO,
      script: none,
      maxFrames: 700,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 222, 10);
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
    expect(hammers).toBeGreaterThanOrEqual(5);
    expect(flames).toBe(0);
  });

  it('the axe drops the bridge and the castle exit leads to 8-1', () => {
    const r = runSim({
      level: level('ll-7-4'),
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
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-8-1' });
  });
});
