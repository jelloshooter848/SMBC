import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Lift } from '@game/entities/objects/lift';
import type { Entity } from '@game/entities/entity';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';
import { toPx } from '@engine/math/units';

// The original's half-tile nudges and lift anchor (Crossover 3.1.21, com/smbc/level/Level.as):
// - `shiftRight` / `shiftUp` move an object TILE_SIZE*.5 right / up once it is placed (lines
//   1254-1257): 16 Flash px, 8 px here. Enemies sit on the cell's bottom centre (1249-1251).
// - a lift (Platform) is placed at `currentX + TILE_SIZE/2`, `currentY` (1205-1207) and its HRect
//   is centred on that x with its top on y: the lift is centred on its cell.
// The converter writes these as `dx` / `dy` px props on the entity lines.

const centreX = (e: Entity) => toPx(e.body.x + e.body.w / 2);

/** Spawn everything on the first screens and return the world after one frame. */
function spawnAt(level: LevelData, x: number, y = 12): World {
  return runSim({ level, character: MARIO, script: { steps: [] }, maxFrames: 1, start: { x, y } }).world;
}

describe('shiftRight / shiftUp props on the generated maps', () => {
  it('1-1: the four shifted Goombas are entity lines with dx=8', () => {
    const l = getLevel('1-1');
    const shifted = l.entities.filter((e) => e.type === 'goomba' && e.props?.dx === 8).map((e) => e.x);
    expect(shifted).toEqual([52, 98, 115, 175]);
    // Unshifted ones stay grid markers.
    expect(l.entities).toContainEqual({ type: 'goomba', x: 22, y: 12 });
  });

  it('ll-2-3: the red Paratroopa over the gap at 65,11 is half a tile higher', () => {
    expect(getLevel('ll-2-3').entities).toContainEqual({
      type: 'koopa-para-red',
      x: 65,
      y: 11,
      props: { dy: -8 },
    });
  });

  it('lifts carry the offset that centres them on their cell (plus the shifts)', () => {
    const l = getLevel('ll-7-2');
    const lift = (x: number) => l.entities.find((e) => e.type === 'lift-h' && e.x === x)?.props;
    // width 4, no shift: 8 - 4*4 = -8; width 4 with shiftRight: -8 + 8 = 0 (no prop).
    expect(lift(21)).toEqual({ len: 4, range: 3, dx: -8 });
    expect(lift(28)).toEqual({ len: 4, range: 3, dx: -8 });
    expect(lift(44)).toEqual({ len: 4, range: 3 });
    // 1-2's rising lifts: width 6 with shiftUp.
    expect(getLevel('1-2').entities).toContainEqual({
      type: 'lift-up',
      x: 156,
      y: 5,
      props: { len: 6, dx: -16, dy: -8 },
    });
  });
});

describe('the world places shifted spawns where the original does', () => {
  it('1-1: the Goomba at 52 is centred on its cell edge (848), its neighbour at 51 on its cell (824)', () => {
    const w = spawnAt(getLevel('1-1'), 40);
    const xs = w.entities.filter((e) => e instanceof Goomba).map(centreX);
    // One frame of walking left is all they moved.
    expect(xs.some((x) => Math.abs(x - 848) <= 1)).toBe(true);
    expect(xs.some((x) => Math.abs(x - 824) <= 1)).toBe(true);
  });

  it('dx / dy move an enemy by that many pixels', () => {
    const rows = Array.from({ length: 13 }, () => '.'.repeat(32));
    const level = parseTextMap(
      [
        'id: t',
        'start: 2,12',
        '',
        '[tiles]',
        ...rows,
        '#'.repeat(32),
        '#'.repeat(32),
        '',
        '[entities]',
        'koopa-para-red 10 8',
        'koopa-para-red 14 8 dx=8 dy=-8',
      ].join('\n'),
    );
    const w = spawnAt(level, 2);
    const [a, b] = w.entities.filter((e): e is Koopa => e instanceof Koopa);
    expect(a && b).toBeTruthy();
    expect(toPx(b!.body.x) - toPx(a!.body.x)).toBe(4 * 16 + 8);
    expect(toPx(b!.body.y) - toPx(a!.body.y)).toBe(-8);
  });

  it('ll-7-2: lifts are centred on their cell, a shiftRight one on its right edge', () => {
    const w = spawnAt(getLevel('ll-7-2'), 36, 9);
    const lifts = w.entities.filter((e): e is Lift => e instanceof Lift);
    const near = (cx: number) => lifts.find((l) => Math.abs(centreX(l) - cx) <= 16);
    // Sideways lifts swing around their spawn point; one frame in they have moved < 1 px.
    for (const [cx, top] of [
      [28 * 16 + 8, 10 * 16],
      [44 * 16 + 16, 11 * 16],
    ] as const) {
      const l = near(cx);
      expect(l, `lift at ${cx}`).toBeDefined();
      expect(Math.abs(centreX(l!) - cx)).toBeLessThanOrEqual(1);
      expect(toPx(l!.body.y)).toBe(top);
    }
  });

  it('1-2: the rising width-6 lifts are centred on 156 and half a tile up', () => {
    const level = getLevel('1-2');
    const spec = level.entities.find((e) => e.type === 'lift-up' && e.x === 156 && e.y === 5);
    const lift = new Lift('lift-up', spec!.x, spec!.y, spec!.props ?? {});
    expect(centreX(lift)).toBe(156 * 16 + 8);
    expect(toPx(lift.body.y)).toBe(5 * 16 - 8);
  });
});
