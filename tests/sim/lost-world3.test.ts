import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Cheep } from '@game/entities/enemies/cheep';
import { Blooper } from '@game/entities/enemies/blooper';
import { Spring } from '@game/entities/objects/spring';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World, WorldEvent } from '@game/world/world';

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/lost/world3', `${id}.map`), 'utf8'),
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

/** The level without its enemies (scenery and springs stay), starting on foot at col,row. */
function bare(id: string, col: number, row: number): LevelData {
  const l = level(id);
  l.entities = l.entities.filter((e) => e.type.startsWith('decor') || e.type.startsWith('spring'));
  l.start = { x: col, y: row };
  l.startMode = 'stand';
  return l;
}

/** Stand on the pipe whose left column is `col` (top at `top`) and press down. */
function downPipe(id: string, col: number, top: number) {
  return runSim({
    level: bare(id, col, top - 1),
    character: MARIO,
    script: none,
    maxFrames: 200,
    controller: (w, f) => {
      if (f === 0) place(w, col, top, 8);
      return f > 2 ? ['down'] : [];
    },
  });
}

const AREAS = [
  'll-3-1',
  'll-3-1-bonus',
  'll-3-1-sky',
  'll-3-1-bonus2',
  'll-3-1-exit',
  'll-3-2-intro',
  'll-3-2',
  'll-3-2-exit',
  'll-3-3',
  'll-3-4',
];

describe('Lost Levels World 3 areas', () => {
  it.each(AREAS)('%s loads and runs 600 frames as Mario', (id) => {
    const r = runSim({
      level: level(id),
      character: MARIO,
      script: none,
      maxFrames: 600,
      assist: { invulnerable: true },
    });
    if (id.endsWith('-intro')) {
      expect(r.outcome).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
        target: { level: 'll-3-2', x: 2, y: 1 },
      });
    } else {
      expect(r.frames).toBe(600);
      for (const v of [r.playerX, r.playerY]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('Lost Levels 3-1: the backwards warp zone', () => {
  it('the pipe past the castle at 246 warps back to 1-1', () => {
    const r = downPipe('ll-3-1', 246, 10);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-1-1', x: 2, y: 12 },
    });
  });

  it('the green springboard at 160 vaults Mario over the flagpole towards that warp', () => {
    let spring: Spring | undefined;
    let launched = false;
    let overPole = false;
    const r = runSim({
      level: bare('ll-3-1', 160, 8),
      character: MARIO,
      script: none,
      maxFrames: 900,
      controller: (w) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) launched = true;
        if (toPx(w.player.body.x) > 187 * 16) overPole = true;
        return launched ? ['jump', 'right', 'attack'] : [];
      },
      until: (w, f) => (overPole && w.player.body.onGround) || f > 880,
    });
    expect(spring?.green).toBe(true);
    expect(launched).toBe(true);
    expect(overPole).toBe(true);
    expect(r.events.filter((e) => e.type === 'exit')).toEqual([]); // the flag was not touched
    expect(r.world.player.dead).toBe(false);
  });

  it('the 32-wide bonus room leads to a warp room whose pipe also goes back to 1-1', () => {
    const r = runSim({
      level: level('ll-3-1-bonus'),
      character: MARIO,
      script: none,
      maxFrames: 1200,
      assist: { invulnerable: true },
      controller: (w) => {
        const b = w.player.body;
        const near = toPx(b.x) > 12 * 16 && toPx(b.x) < 16 * 16; // hop the blaster at 16
        return near && b.onGround ? ['right', 'jump'] : ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: 'll-3-1-exit', x: 3, y: 10, exitDir: 'up' },
    });

    const room = runSim({ level: level('ll-3-1-exit'), character: MARIO, script: none, maxFrames: 90 });
    const b = room.world.player.body;
    expect(toPx(b.y + b.h)).toBe(11 * 16); // risen out of the pipe at 3
    expect(b.x).toBeGreaterThanOrEqual(px(3 * 16));
    const warp = downPipe('ll-3-1-exit', 22, 10);
    expect(warp.outcome).toBe('pipe');
    expect(warp.events.find((e) => e.type === 'pipe')).toEqual({
      type: 'pipe',
      target: { level: 'll-1-1', x: 2, y: 12 },
    });
  });
});

describe('Lost Levels 3-1', () => {
  it('the pipe at 83 comes out of the pipe at 90 in the same level', () => {
    const r = downPipe('ll-3-1', 83, 11);
    expect(r.outcome).toBe('pipe');
    const target = { level: 'll-3-1', x: 90, y: 8, exitDir: 'up' as const };
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target });
    const out = runSim({
      level: level('ll-3-1'),
      character: MARIO,
      script: none,
      maxFrames: 90,
      assist: { invulnerable: true },
      start: { x: 90, y: 8, mode: 'pipe-exit' },
    });
    const b = out.world.player.body;
    expect(toPx(b.y + b.h)).toBe(9 * 16); // standing on top of the pipe at 90
    expect(b.x).toBeGreaterThanOrEqual(px(90 * 16));
    expect(b.x + b.w).toBeLessThanOrEqual(px(92 * 16));
  });

  it('its Hammer Bros are the ordinary kind that hold their ground', () => {
    const bros: HammerBro[] = [];
    runSim({
      level: level('ll-3-1'),
      character: MARIO,
      script: none,
      maxFrames: 150,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 14, 13);
        for (const e of w.entities) if (e instanceof HammerBro && !bros.includes(e)) bros.push(e);
        return [];
      },
    });
    expect(bros).toHaveLength(2);
    for (const b of bros) expect(b.chase).toBe(false);
  });
});

describe('Lost Levels 3-2', () => {
  it('is under water: Mario swims, and Cheep Cheeps and Bloopers come at him', () => {
    let cheep: Cheep | undefined;
    let blooper: Blooper | undefined;
    let swam = false;
    const r = runSim({
      level: level('ll-3-2'),
      character: MARIO,
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      controller: (w, f) => {
        cheep ??= w.entities.find((e): e is Cheep => e instanceof Cheep);
        blooper ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        if (w.player.inWater) swam = true;
        return f % 30 < 4 ? ['right', 'jump'] : ['right'];
      },
      until: () => swam && cheep !== undefined && blooper !== undefined,
    });
    expect(r.outcome).toBe('stopped');
    expect(Number.isFinite(r.world.waterTop)).toBe(true);
    expect(r.world.player.dead).toBe(false);
  });
});

describe('Lost Levels 3-4: the castle maze', () => {
  it('taking the lower corridor past column 32 skips from 63 to 127', () => {
    const r = runSim({
      level: level('ll-3-4'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 31, 13);
        if (f === 20) place(w, 61, 13); // still the lower corridor, after the checkpoint
        return ['right'];
      },
      until: (w, f) => f > 21 && toPx(w.player.body.x) > 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 63, to: 127 }]);
  });

  it('the upper corridor (any of its checkpoints) loops back from 127 to 63', () => {
    const r = runSim({
      level: level('ll-3-4'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 106, 6, 8); // on the ledge just before checkpoint column 107
        return ['right'];
      },
      until: (w, f) => f > 1 && toPx(w.player.body.x) < 100 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 127, to: 63 }]);
  });

  it('nothing happens at 63 without the lower checkpoint', () => {
    const r = runSim({
      level: level('ll-3-4'),
      character: MARIO,
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 60, 13);
        return ['right'];
      },
    });
    expect(loops(r.events)).toEqual([]);
    expect(toPx(r.world.player.body.x)).toBeGreaterThan(63 * 16);
  });

  it('the second maze: the high road past 175 skips from 193 to 263', () => {
    const r = runSim({
      level: level('ll-3-4'),
      character: MARIO,
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 173, 6);
        if (f === 30) place(w, 190, 5); // on the high ledge before 193
        return ['right'];
      },
      until: (w, f) => f > 31 && toPx(w.player.body.x) > 240 * 16,
    });
    expect(loops(r.events)).toEqual([{ type: 'loop', from: 193, to: 263 }]);
  });

  it('Bowser breathes fire (no hammers) and the axe leads on to 4-1', () => {
    let bowser: Bowser | undefined;
    const r = runSim({
      level: level('ll-3-4'),
      character: MARIO,
      script: none,
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 307, 9, 0);
        bowser ??= w.entities.find((e): e is Bowser => e instanceof Bowser);
        return [];
      },
    });
    expect(bowser?.attack).toBe('fire');
    expect(r.outcome).toBe('cleared');
    expect(r.events.find((e) => e.type === 'exit')).toEqual({ type: 'exit', next: 'll-4-1' });
  });
});
