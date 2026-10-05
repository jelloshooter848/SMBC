import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// Landmarks of The Lost Levels World 8, checked against the original level data
// (levelDataLostLevels.xml, normal difficulty: tokens hidden on `normal` and helper-only pieces
// left out). Columns and rows are the XML's; piranhas sit one row below their token, on the pipe.

const dir = join(import.meta.dirname, 'world8');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const at = (l: LevelData, type: string) =>
  l.entities
    .filter((e) => e.type === type)
    .map((e) => [e.x, e.y])
    .sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
const count = (l: LevelData) => {
  const c: Record<string, number> = {};
  for (const e of l.entities) if (!e.type.startsWith('decor-')) c[e.type] = (c[e.type] ?? 0) + 1;
  return c;
};
const zones = (l: LevelData, kind: Zone['kind']) => l.zones.filter((z) => z.kind === kind);
const pipe = (
  x: number,
  y: number,
  dir: string,
  level: string,
  tx: number,
  ty: number,
  exitDir?: string,
) => ({
  kind: 'pipe',
  x,
  y,
  dir,
  target: exitDir ? { level, x: tx, y: ty, exitDir } : { level, x: tx, y: ty },
});

const AREAS = [
  'll-8-1',
  'll-8-1-water',
  'll-8-1-exit',
  'll-8-2',
  'll-8-2-warp',
  'll-8-2-bonus',
  'll-8-3',
  'll-8-3-sky',
  'll-8-4',
  'll-8-4-water',
  'll-8-4-end',
  'll-8-4-end2',
  'll-8-4-end3',
];

describe('Lost Levels World 8: files and headers', () => {
  it('has exactly the areas of the original 8-1 to 8-4', () => {
    expect(
      readdirSync(dir)
        .filter((f) => f.endsWith('.map'))
        .sort(),
    ).toEqual(AREAS.map((id) => `${id}.map`).sort());
  });

  it.each([
    ['ll-8-1', 232, 'snow', 400, null],
    ['ll-8-1-water', 80, 'water', null, 'll-8-1'],
    ['ll-8-1-exit', 32, 'snow', null, 'll-8-1'],
    // World 8's skins: orange giant-mushroom land for normal areas, clouds for platform areas.
    ['ll-8-2', 176, 'mushroom', 400, null],
    ['ll-8-2-warp', 40, 'clouds', null, 'll-8-2'],
    ['ll-8-2-bonus', 32, 'underground', null, 'll-8-2'],
    ['ll-8-3', 232, 'clouds', 400, null],
    ['ll-8-3-sky', 120, 'overworld', null, 'll-8-3'],
    ['ll-8-4', 96, 'castle', 400, null],
    ['ll-8-4-water', 48, 'water', null, 'll-8-4'],
    ['ll-8-4-end', 16, 'castle', null, 'll-8-4'],
    ['ll-8-4-end2', 208, 'castle', null, 'll-8-4'],
    ['ll-8-4-end3', 144, 'castle', null, 'll-8-4'],
  ] as const)('%s: width %i, %s, time %s, parent %s', (id, width, theme, time, parent) => {
    const l = load(id);
    expect(l.id).toBe(id);
    expect(l.world).toBe(8);
    expect(l.width).toBe(width);
    expect(l.theme).toBe(theme);
    // Night, snow, mushroom and cloud levels play the overworld tune.
    expect(l.music).toBe(['night', 'snow', 'mushroom', 'clouds'].includes(theme) ? 'overworld' : theme);
    expect(l.time).toBe(time);
    expect(l.parent).toBe(parent);
  });

  it('chains 8-1 -> 8-2 -> (vine area) 8-3 -> 8-4 -> the ending', () => {
    const exits = Object.fromEntries(AREAS.map((id) => [id, zones(load(id), 'exit')]));
    expect(exits).toEqual({
      'll-8-1': [{ kind: 'exit', x: 215, next: 'll-8-2' }],
      'll-8-1-water': [],
      'll-8-1-exit': [],
      'll-8-2': [],
      'll-8-2-warp': [{ kind: 'exit', x: 26, next: 'll-8-3' }],
      'll-8-2-bonus': [],
      'll-8-3': [{ kind: 'exit', x: 214, next: 'll-8-4' }],
      'll-8-3-sky': [],
      'll-8-4': [],
      'll-8-4-water': [],
      'll-8-4-end': [],
      'll-8-4-end2': [],
      'll-8-4-end3': [{ kind: 'exit', x: 136, next: 'end' }],
    });
  });

  it('the last area ends the game as 8-4 (its parent is what the ending scene receives)', () => {
    const l = load('ll-8-4-end3');
    expect(zones(l, 'exit')).toEqual([{ kind: 'exit', x: 136, next: 'end' }]);
    expect(l.parent ?? l.id).toBe('ll-8-4');
  });

  it('every pipe, vine and pit target in World 8 is an area here (bar the warp to 5-1) and lands in the open', () => {
    for (const id of AREAS) {
      for (const z of load(id).zones) {
        if (z.kind !== 'pipe' && z.kind !== 'vine' && z.kind !== 'pit') continue;
        if (z.target.level === 'll-5-1') continue; // World 5's start (checked with the warp below)
        expect(AREAS).toContain(z.target.level);
        const t = load(z.target.level);
        expect(z.target.x).toBeLessThan(t.width);
        expect(tile(t, z.target.x, z.target.y)).toBe(T.AIR);
        if (z.kind === 'pipe' && z.target.exitDir === 'up')
          expect(tile(t, z.target.x, z.target.y + 1)).toBe(T.PIPE_TL);
      }
    }
  });
});

describe('Lost Levels 8-1', () => {
  const l = load('ll-8-1');
  it('has a poison ? block, a poison brick, a hidden poison block and a hidden 1-up', () => {
    expect(tile(l, 32, 9)).toBe(T.Q_POWERUP);
    expect(tile(l, 40, 9)).toBe(T.Q_POISON);
    expect(tile(l, 169, 5)).toBe(T.BRICK_POISON);
    expect(tile(l, 162, 8)).toBe(T.HIDDEN_POISON);
    expect(tile(l, 155, 8)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 151, 9)).toBe(T.BRICK_POWERUP);
  });
  it('has five hanging pipes with piranhas and seven standing ones', () => {
    expect(at(l, 'piranha-down')).toEqual([
      [22, 5],
      [44, 9],
      [88, 10],
      [105, 10],
      [166, 9],
    ]);
    for (const [x, y] of at(l, 'piranha-down'))
      expect(tile(l, x as number, y as number)).toBe(T.PIPE_BOTTOM_L);
    expect(at(l, 'piranha')).toEqual([
      [21, 9],
      [117, 11],
      [142, 13],
      [176, 9],
      [183, 6],
      [190, 13],
      [201, 8],
    ]);
  });
  it('has three chasing Hammer Bros and its other enemies', () => {
    expect(at(l, 'hammer-bro-chase')).toEqual([
      [112, 12],
      [144, 7],
      [158, 4],
    ]);
    expect(at(l, 'buzzy').map((p) => p[0])).toEqual([29, 67, 69, 101]);
    expect(at(l, 'koopa-para-red')).toEqual([
      [78, 11],
      [81, 10],
      [84, 10],
      [131, 11],
    ]);
    expect(count(l)).toEqual({
      piranha: 7,
      'piranha-down': 5,
      'koopa-para-green': 2,
      'koopa-para-red': 4,
      'hammer-bro-chase': 3,
      buzzy: 4,
      goomba: 2,
      'koopa-green': 2,
      'koopa-red': 2,
    });
  });
  it('has a pipe at 176 down into the water detour, no checkpoint and the flagpole at 215', () => {
    expect(zones(l, 'pipe')).toEqual([pipe(176, 9, 'down', 'll-8-1-water', 2, 1, 'none')]);
    expect(zones(l, 'checkpoint')).toEqual([]); // LOCKED_CP="True"
    expect(tile(l, 215, 2)).toBe(T.FLAG_BALL);
  });
  it('water detour: drops in at 2,1 and leaves by the side pipe at 77', () => {
    const w = load('ll-8-1-water');
    expect(w.start).toEqual({ x: 2, y: 1 });
    expect(w.startMode).toBe('fall');
    expect(at(w, 'blooper')).toEqual([
      [25, 8],
      [39, 6],
    ]);
    expect(at(w, 'lift-up')).toEqual([
      [46, 3],
      [46, 9],
    ]);
    expect(at(w, 'koopa-green')).toEqual([[28, 12]]);
    expect(at(w, 'koopa-para-red')).toEqual([[69, 7]]);
    expect(zones(w, 'pipe')).toEqual([pipe(77, 8, 'right', 'll-8-1-exit', 3, 10, 'up')]);
  });
  it('exit area: a closed room whose only pipe warps back to 5-1', () => {
    const e = load('ll-8-1-exit');
    expect(e.start).toEqual({ x: 3, y: 10 });
    expect(e.startMode).toBe('pipe-exit');
    expect(zones(e, 'pipe')).toEqual([pipe(22, 10, 'down', 'll-5-1', 2, 12)]);
    expect(zones(e, 'warp')).toEqual([
      { kind: 'warp', x: 16, w: 16, worlds: [5], text: 'WELCOME TO WARP ZONE!' },
    ]);
    for (let y = 2; y <= 12; y++) expect(tile(e, 31, y)).toBe(T.HARD);
  });
});

describe('Lost Levels 8-2', () => {
  const l = load('ll-8-2');
  it('ends in a wall: the vine brick at 127 is the way to the flagpole area', () => {
    expect(tile(l, 127, 5)).toBe(T.BRICK_VINE);
    expect(zones(l, 'vine')).toEqual([
      { kind: 'vine', x: 127, y: 5, target: { level: 'll-8-2-warp', x: 4, y: 14 } },
    ]);
    for (let y = 2; y <= 12; y++) expect(tile(l, 175, y)).toBe(T.HARD);
    const v = load('ll-8-2-warp');
    expect(v.start).toEqual({ x: 4, y: 14 });
    expect(v.startMode).toBe('climb');
    expect(at(v, 'vine')).toEqual([[4, 14]]);
    expect(tile(v, 27, 2)).toBe(T.FLAG_BALL);
  });
  it('has five poison bricks, the star brick and a springboard', () => {
    for (const [x, y] of [
      [54, 9],
      [94, 8],
      [133, 8],
      [140, 8],
      [155, 8],
    ] as const)
      expect(tile(l, x, y)).toBe(T.BRICK_POISON);
    expect(tile(l, 121, 10)).toBe(T.BRICK_STAR);
    expect(tile(l, 34, 5)).toBe(T.BRICK_POWERUP);
    expect(at(l, 'spring')).toEqual([[101, 12]]);
  });
  it('has chasing Hammer Bros in front of the walls and Buzzy Beetles', () => {
    expect(at(l, 'hammer-bro-chase')).toEqual([
      [143, 12],
      [159, 12],
    ]);
    expect(at(l, 'buzzy').map((p) => p[0])).toEqual([47, 70, 71, 73, 74, 170]);
    expect(at(l, 'piranha')).toEqual([
      [27, 13],
      [43, 7],
      [83, 11],
      [170, 9],
    ]);
  });
  it('has the pipe at 170 into a bonus room that returns at 83', () => {
    expect(zones(l, 'pipe')).toEqual([pipe(170, 9, 'down', 'll-8-2-bonus', 1, 0, 'none')]);
    const b = load('ll-8-2-bonus');
    expect(zones(b, 'pipe')).toEqual([pipe(29, 12, 'right', 'll-8-2', 83, 10, 'up')]);
    expect(at(b, 'piranha-down').map((p) => p[0])).toEqual([12, 16, 20, 24]);
    expect(tile(l, 83, 11)).toBe(T.PIPE_TL);
    expect(zones(l, 'checkpoint')).toEqual([]); // LOCKED_CP="True"
    expect(b.camera).toBe('scroll'); // 32 wide
  });
});

describe('Lost Levels 8-3', () => {
  const l = load('ll-8-3');
  it('has Lakitu over the start, Hammer Bros among the walls and a balance lift', () => {
    // Its end marker is lakituEndMiddle: it flies at mid height (mid=1).
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 24, y: 0, props: { end: 55, mid: 1 } });
    expect(at(l, 'hammer-bro')).toEqual([
      [166, 12],
      [173, 12],
    ]);
    expect(at(l, 'hammer-bro-chase')).toEqual([
      [85, 12],
      [94, 12],
    ]);
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 189,
      y: 6,
      props: { x2: 194, y2: 9, len: 4, top: 2 },
    });
    expect(at(l, 'spring')).toEqual([
      [37, 12],
      [141, 12],
    ]);
    expect(tile(l, 60, 7)).toBe(T.WALL_TOP);
  });
  it('has the vine brick at 98 to the coin heaven, poison bricks and the star', () => {
    expect(tile(l, 98, 8)).toBe(T.BRICK_VINE);
    expect(zones(l, 'vine')).toEqual([
      { kind: 'vine', x: 98, y: 8, target: { level: 'll-8-3-sky', x: 4, y: 14 } },
    ]);
    for (const [x, y] of [
      [73, 9],
      [91, 8],
      [181, 8],
    ] as const)
      expect(tile(l, x, y)).toBe(T.BRICK_POISON);
    expect(tile(l, 95, 8)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 179, 8)).toBe(T.BRICK_COINS10);
    expect(tile(l, 116, 9)).toBe(T.BRICK_STAR);
  });
  it('coin heaven: a moving lift, and falling off the end lands back in 8-3 at 114', () => {
    const s = load('ll-8-3-sky');
    expect(s.startMode).toBe('climb');
    expect(at(s, 'lift-right')).toEqual([[16, 10]]);
    expect(zones(s, 'pit')).toEqual([{ kind: 'pit', x: 0, target: { level: 'll-8-3', x: 114, y: 0 } }]);
  });
  it('has no checkpoint and the flagpole at 214', () => {
    expect(zones(l, 'checkpoint')).toEqual([]); // LOCKED_CP="True"
    expect(tile(l, 214, 2)).toBe(T.FLAG_BALL);
  });
});

describe('Lost Levels 8-4', () => {
  it('first hall: loops from 88 to 24 on the floor; the pipe at 47 is the way on', () => {
    const l = load('ll-8-4');
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(zones(l, 'loop')).toEqual([
      { kind: 'loop', x: 88, y0: 10, y1: 12, to: 24, checks: [], need: 'all' },
    ]);
    expect(zones(l, 'pipe')).toEqual([pipe(47, 11, 'down', 'll-8-4-water', 3, 10, 'up')]);
    expect(at(l, 'firebar-ccw').map((p) => p[0])).toEqual([17, 25, 37, 81, 89]);
    expect(at(l, 'piranha')).toEqual([
      [47, 11],
      [51, 11],
      [59, 7],
      [67, 11],
    ]);
    expect(at(l, 'podoboo')).toEqual([[34, 12]]);
    expect(at(l, 'koopa-para-red')).toEqual([[44, 8]]);
    expect(tile(l, 28, 8)).toBe(T.HIDDEN_POISON);
    expect(tile(l, 92, 8)).toBe(T.HIDDEN_POISON);
  });
  it('water passage: Bloopers and fire bars, side pipe at 46 to a small room', () => {
    const l = load('ll-8-4-water');
    expect(l.startMode).toBe('pipe-exit');
    expect(at(l, 'blooper')).toEqual([
      [16, 11],
      [39, 9],
    ]);
    expect(at(l, 'firebar-ccw')).toEqual([
      [16, 7],
      [27, 9],
      [38, 6],
    ]);
    expect(zones(l, 'pipe')).toEqual([pipe(46, 9, 'right', 'll-8-4-end', 3, 10, 'up')]);
  });
  it('small room: the halfway area, but no checkpoint on normal, and a pipe into the maze', () => {
    const l = load('ll-8-4-end');
    // HW_AREA="c" with LOCKED_CP="True": the original only restarts here on easy and hard.
    expect(zones(l, 'checkpoint')).toEqual([]);
    expect(tile(l, 1, 9)).toBe(T.HIDDEN_POWERUP);
    expect(zones(l, 'pipe')).toEqual([pipe(10, 11, 'down', 'll-8-4-end2', 3, 10, 'up')]);
  });
  it('maze: the lower path at 48 skips to 112, the upper one at 112 loops back to 48', () => {
    const l = load('ll-8-4-end2');
    expect(zones(l, 'loop')).toEqual([
      { kind: 'loop', x: 48, y0: 10, y1: 12, to: 112, checks: [], need: 'all' },
      { kind: 'loop', x: 112, y0: 3, y1: 8, to: 48, checks: [], need: 'all' },
    ]);
    expect(zones(l, 'pipe')).toEqual([
      pipe(35, 11, 'down', 'll-8-4', 47, 10, 'up'),
      pipe(99, 11, 'down', 'll-8-4', 47, 10, 'up'),
      pipe(203, 9, 'right', 'll-8-4-end3', 3, 10, 'up'),
    ]);
    expect(l.entities).toContainEqual({ type: 'firebar-ccw', x: 53, y: 9, props: { len: 12 } });
    expect(l.entities).toContainEqual({ type: 'firebar-ccw', x: 117, y: 9, props: { len: 12 } });
    expect(at(l, 'piranha').map((p) => p[0])).toEqual([3, 19, 35, 67, 83, 99]);
    expect(at(l, 'blooper')).toEqual([
      [25, 12],
      [89, 12],
    ]);
    expect(at(l, 'koopa-para-green-h')).toEqual([
      [40, 8],
      [104, 8],
      [199, 8],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([[195, 8]]);
    expect(tile(l, 16, 9)).toBe(T.Q_POISON);
    expect(tile(l, 80, 9)).toBe(T.Q_POISON);
    expect(tile(l, 30, 8)).toBe(T.HIDDEN_POISON);
    expect(tile(l, 203, 5)).toBe(T.HIDDEN_POWERUP);
  });
  it('Bowser hall: a hammer-throwing false Bowser, then the real one on the bridge, and the axe', () => {
    const l = load('ll-8-4-end3');
    expect(l.entities.filter((e) => e.type === 'bowser')).toEqual([
      { type: 'bowser', x: 23, y: 9, props: { attack: 'hammer', fake: 1 } },
      { type: 'bowser', x: 119, y: 9, props: { attack: 'both' } },
    ]);
    expect(at(l, 'axe')).toEqual([[125, 8]]);
    for (let x = 112; x <= 124; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 124, 9)).toBe(T.CHAIN);
    // The false Bowser stands on solid floor, not on a bridge.
    expect(tile(l, 23, 10)).toBe(T.CASTLE_BRICK);
    expect(zones(l, 'pipe')).toEqual([pipe(14, 13, 'down', 'll-8-4', 47, 10, 'up')]);
    expect(at(l, 'piranha-down')).toEqual([[71, 9]]);
    expect(tile(l, 71, 9)).toBe(T.PIPE_BOTTOM_L);
    expect(at(l, 'firebar')).toEqual([[117, 5]]);
    expect(at(l, 'lift-fall')).toEqual([[67, 11]]);
    // The original ends 8-4 with Toad (its only princess is in D-4), so there is none here.
    expect(at(l, 'princess')).toEqual([]);
  });
});
