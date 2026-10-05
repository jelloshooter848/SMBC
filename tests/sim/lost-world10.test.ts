import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { PowerUp } from '@game/entities/objects/powerup';
import { Projectile } from '@game/entities/projectiles/projectile';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// The Lost Levels World A (stored as World 10).
const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world10', `${id}.map`), 'utf8'),
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

describe('Lost Levels World A areas', () => {
  it.each([
    'll-10-1',
    'll-10-1-sky',
    'll-10-1-bonus',
    'll-10-2-intro',
    'll-10-2',
    'll-10-2-exit',
    'll-10-3',
    'll-10-4',
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

describe('Lost Levels A-1', () => {
  it('the poison mushroom from the ? block at 61 shrinks big Mario', () => {
    const l = level('ll-10-1');
    expect(l.tiles[9 * l.width + 61]).toBe(T.Q_POISON);
    l.entities = l.entities.filter((e) => e.type.startsWith('decor'));
    let poison: PowerUp | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      maxFrames: 900,
      controller: (w, f) => {
        if (f === 0) place(w, 61, 13, 3);
        poison ??= w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.item === 'poison');
        const b = w.player.body;
        if (!poison) return f < 30 ? ['jump'] : []; // one full jump into the block
        // Walk into it once it has dropped to the floor.
        const dx = toPx(poison.body.x) - toPx(b.x);
        return dx > 2 ? ['right'] : dx < -2 ? ['left'] : [];
      },
      until: (w) => w.player.powerState !== 'big' || w.player.dead,
    });
    expect(poison?.item).toBe('poison');
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.powerState).toBe('small');
  });

  it('the chasing Hammer Bros walk at the player from the start', () => {
    let bro: HammerBro | undefined;
    let startX = NaN;
    runSim({
      level: level('ll-10-1'),
      character: MARIO,
      script: none,
      maxFrames: 90,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 52, 13); // the Hammer Bro on the blocks at 58 is on screen
        if (!bro) {
          bro = w.entities.find((e): e is HammerBro => e instanceof HammerBro);
          if (bro) startX = toPx(bro.body.x);
        }
        return [];
      },
    });
    expect(bro?.chase).toBe(true);
    expect(startX - toPx((bro as HammerBro).body.x)).toBeGreaterThanOrEqual(20);
  });

  it('the pipe at 130 leads to the bonus room, whose side pipe returns to the pipe at 147', () => {
    expect(enterPipeDown('ll-10-1', 130, 3)).toEqual({
      type: 'pipe',
      target: { level: 'll-10-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    const r = runSim({
      level: level('ll-10-1-bonus'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: ['right'] }] },
      maxFrames: 400,
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-10-1', x: 147, y: 10, exitDir: 'up' },
    });
  });
});

describe('Lost Levels A-2', () => {
  it('the intro walks into the side pipe to the underground main area', () => {
    const r = runSim({ level: level('ll-10-2-intro'), character: MARIO, script: none, maxFrames: 600 });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-10-2', x: 2, y: 3, exitDir: 'none' },
    });
  });

  it('the side pipe at 171 leads to the flagpole area', () => {
    const r = runSim({
      level: level('ll-10-2'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 170, 10);
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-10-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
  });

  it('the warp-zone pipe at 214 (labelled B) warps to the start of B-1', () => {
    expect(enterPipeDown('ll-10-2', 214, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-11-1', x: 2, y: 12 },
    });
  });

  it('the flagpole area clears A-2 and goes on to A-3', () => {
    const r = runSim({
      level: level('ll-10-2-exit'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 23, 13);
        // Run right and jump once past the hidden block at 26,9, into the pole at 28.
        return toPx(w.player.body.x) >= 432 ? ['right', 'jump'] : ['right'];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-10-3' });
  });
});

describe('Lost Levels A-3', () => {
  it('the warp-zone pipe at 246 (labelled C) warps to the start of C-1', () => {
    expect(enterPipeDown('ll-10-3', 246, 10)).toEqual({
      type: 'pipe',
      target: { level: 'll-12-1', x: 2, y: 12 },
    });
  });
});

describe('Lost Levels A-4', () => {
  it('Bowser throws hammers and no fire', () => {
    let bowser: Bowser | undefined;
    const seen = new Set<number>();
    let hammers = 0;
    let flames = 0;
    runSim({
      level: level('ll-10-4'),
      character: MARIO,
      script: none,
      maxFrames: 500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 161, 10);
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

  it('the axe drops the bridge and leads on to B-1', () => {
    const r = runSim({
      level: level('ll-10-4'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 173, 9, 0);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-11-1' });
  });
});
