import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world6', `${id}.map`), 'utf8'),
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

/**
 * Stop the run right after a maze teleport (the sim moves world events into its result); jumps
 * the test itself makes by placing the player before frame `from` do not count.
 */
const teleported = (from: number) => {
  let prev: number | null = null;
  return (w: World, f: number) => {
    const x = toPx(w.player.body.x);
    const jumped = f > from && prev !== null && Math.abs(x - prev) > 48;
    prev = x;
    return jumped;
  };
};

describe('Lost Levels World 6 areas', () => {
  it('every area loads and runs 600 frames as Mario', () => {
    for (const id of ['ll-6-1', 'll-6-1-water', 'll-6-2', 'll-6-2-exit', 'll-6-3', 'll-6-4']) {
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

  it('the 6-2 intro walks into its pipe and on into the water level', () => {
    const r = runSim({ level: level('ll-6-2-intro'), character: MARIO, script: none, maxFrames: 600 });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-6-2', x: 2, y: 1 },
    });
  });
});

describe('Lost Levels 6-1', () => {
  it('the pipe at 156 drops into the water detour', () => {
    const r = runSim({
      level: level('ll-6-1'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 156, 12, 10);
        return f > 2 ? ['down'] : [];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-6-1-water', x: 2, y: 1, exitDir: 'none' },
    });
  });

  it('the water detour comes back up out of the pipe at 211, past the pit', () => {
    const r = runSim({
      level: level('ll-6-1-water'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 76, 9, 0); // on the ledge right in front of the mouth at 77,8
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-6-1', x: 211, y: 10, exitDir: 'up' },
    });
    const back = runSim({
      level: level('ll-6-1'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      start: { x: 211, y: 10, mode: 'pipe-exit' },
    });
    const b = back.world.player.body;
    expect(b.onGround).toBe(true);
    expect(toPx(b.y + b.h)).toBe(11 * 16); // standing on the pipe top
  });

  it('its Hammer Bros are the plain kind (no chasers on normal) and throw hammers', () => {
    const seen = new Set<number>();
    let hammers = 0;
    const bros = new Set<HammerBro>();
    runSim({
      level: level('ll-6-1'),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 100, 13);
        for (const e of w.entities) if (e instanceof HammerBro) bros.add(e);
        for (const e of w.entities) {
          if (!(e instanceof Projectile) || seen.has(e.id) || e.spec.kind !== 'hammer') continue;
          seen.add(e.id);
          hammers++;
        }
        return [];
      },
    });
    expect(bros.size).toBeGreaterThan(0);
    for (const b of bros) expect(b.chase).toBe(false);
    expect(hammers).toBeGreaterThan(0);
  });
});

describe('Lost Levels 6-4: the castle maze', () => {
  it('the low route through column 160 skips ahead from 208 to 272', () => {
    const r = runSim({
      level: level('ll-6-4'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 158, 13); // lower corridor, before the checkpoint at 160 (rows 11-12)
        if (f === 30) place(w, 205, 13); // further along the lower corridor
        return ['right'];
      },
      until: teleported(31),
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 208, to: 272 }]);
    expect(toPx(r.world.player.body.x)).toBeGreaterThanOrEqual(271 * 16);
  });

  it('the high route through column 224 loops back from 272 to 208', () => {
    const r = runSim({
      level: level('ll-6-4'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 223, 5, 6); // the upper ledge at 224-227, before its checkpoint
        if (f === 30) place(w, 270, 13); // the floor in front of column 272
        return ['right'];
      },
      until: teleported(31),
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 272, to: 208 }]);
    expect(toPx(r.world.player.body.x)).toBeLessThan(211 * 16);
  });

  it('nothing happens at 208 without passing a checkpoint first', () => {
    const r = runSim({
      level: level('ll-6-4'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 205, 13);
        return ['right'];
      },
    });
    expect(loops(r.events)).toEqual([]);
    expect(toPx(r.world.player.body.x)).toBeGreaterThan(210 * 16);
  });

  it('Bowser throws hammers and no fire', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('ll-6-4'),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 317, 10);
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
});
