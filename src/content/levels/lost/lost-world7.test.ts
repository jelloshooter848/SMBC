import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// Landmarks of The Lost Levels World 7, checked against the original level data
// (levelDataLostLevels.xml, normal difficulty: tokens hidden on `normal` and helper-only pieces
// left out). Columns and rows are the XML's; piranhas sit one row below their token, on the pipe.

const dir = join(import.meta.dirname, 'world7');
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

describe('Lost Levels World 7: files and headers', () => {
  it('has exactly the areas of the original 7-1 to 7-4', () => {
    expect(
      readdirSync(dir)
        .filter((f) => f.endsWith('.map'))
        .sort(),
    ).toEqual(
      ['ll-7-1', 'll-7-1-bonus', 'll-7-1-bonus2', 'll-7-1-exit', 'll-7-2', 'll-7-2-bonus', 'll-7-3', 'll-7-4']
        .map((id) => `${id}.map`)
        .sort(),
    );
  });

  it.each([
    ['ll-7-1', 216, 'night', 400, null],
    ['ll-7-1-bonus', 32, 'underground', null, 'll-7-1'],
    ['ll-7-1-exit', 112, 'night', null, 'll-7-1'],
    ['ll-7-1-bonus2', 32, 'underground', null, 'll-7-1'],
    ['ll-7-2', 272, 'night', 400, null],
    ['ll-7-2-bonus', 16, 'underground', null, 'll-7-2'],
    ['ll-7-3', 336, 'snow', 400, null], // the original's gray platform skin
    ['ll-7-4', 256, 'castle', 400, null],
  ] as const)('%s: width %i, %s, time %s, parent %s', (id, width, theme, time, parent) => {
    const l = load(id);
    expect(l.id).toBe(id);
    expect(l.world).toBe(7);
    expect(l.width).toBe(width);
    expect(l.theme).toBe(theme);
    // Night and snow levels play the overworld tune.
    expect(l.music).toBe(['night', 'snow'].includes(theme) ? 'overworld' : theme);
    expect(l.time).toBe(time);
    expect(l.parent).toBe(parent);
  });

  it('chains 7-1 -> 7-2 -> 7-3 -> 7-4 -> 8-1 (no intros in between)', () => {
    const exits = (id: string) => zones(load(id), 'exit');
    expect(exits('ll-7-1')).toEqual([{ kind: 'exit', x: 202, next: 'll-7-2' }]);
    expect(exits('ll-7-2')).toEqual([{ kind: 'exit', x: 257, next: 'll-7-3' }]);
    expect(exits('ll-7-3')).toEqual([{ kind: 'exit', x: 316, next: 'll-7-4' }]);
    expect(exits('ll-7-4')).toEqual([{ kind: 'exit', x: 248, next: 'll-8-1' }]);
    for (const id of ['ll-7-1-bonus', 'll-7-1-exit', 'll-7-1-bonus2', 'll-7-2-bonus'])
      expect(exits(id)).toEqual([]);
  });

  it('every pipe target is a World 7 area and lands in the open (on a pipe when exiting one)', () => {
    const ids = readdirSync(dir).map((f) => f.replace(/\.map$/, ''));
    for (const id of ids) {
      for (const z of load(id).zones) {
        if (z.kind !== 'pipe') continue;
        expect(ids).toContain(z.target.level);
        const t = load(z.target.level);
        expect(z.target.x).toBeLessThan(t.width);
        expect(tile(t, z.target.x, z.target.y)).toBe(T.AIR);
        if (z.target.exitDir === 'up') expect(tile(t, z.target.x, z.target.y + 1)).toBe(T.PIPE_TL);
      }
    }
  });
});

describe('Lost Levels 7-1', () => {
  const l = load('ll-7-1');
  it('starts standing at 2,12 and has its checkpoint at 114 and the flagpole at 202', () => {
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(l.startMode).toBe('stand');
    expect(zones(l, 'checkpoint')).toEqual([{ kind: 'checkpoint', x: 114, y: 12 }]);
    expect(tile(l, 202, 2)).toBe(T.FLAG_BALL);
    expect(tile(l, 202, 12)).toBe(T.HARD);
  });
  it('has three pipes hanging from blocks, each with a piranha coming out of its rim', () => {
    for (const [x, y] of [
      [16, 7],
      [51, 8],
      [59, 9],
    ] as const) {
      expect(tile(l, x, y)).toBe(T.PIPE_BOTTOM_L);
      expect(tile(l, x + 1, y)).toBe(T.PIPE_BOTTOM_R);
    }
    expect(at(l, 'piranha-down')).toEqual([
      [16, 7],
      [51, 8],
      [59, 9],
    ]);
    expect(at(l, 'piranha')).toEqual([
      [16, 11],
      [48, 10],
      [55, 9],
      [89, 8],
      [117, 3],
      [140, 13],
      [163, 11],
    ]);
  });
  it('has chasing Hammer Bros, Buzzy Beetles and the rest of its enemies', () => {
    expect(at(l, 'hammer-bro-chase')).toEqual([
      [136, 8],
      [138, 12],
      [176, 8],
    ]);
    expect(at(l, 'buzzy')).toEqual([
      [178, 12],
      [180, 12],
    ]);
    expect(at(l, 'koopa-red')).toEqual([
      [26, 8],
      [29, 8],
      [157, 12],
    ]);
    expect(at(l, 'koopa-green')).toEqual([
      [54, 12],
      [128, 12],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([
      [110, 7],
      [113, 8],
    ]);
    expect(at(l, 'koopa-para-green')).toEqual([[177, 4]]);
    expect(count(l)).toEqual({
      'piranha-down': 3,
      piranha: 7,
      'hammer-bro-chase': 3,
      buzzy: 2,
      'koopa-red': 3,
      'koopa-green': 2,
      'koopa-para-red': 2,
      'koopa-para-green': 1,
    });
  });
  it('has the row of eleven ? blocks, the hidden 1-up, the star brick and two blasters', () => {
    for (let x = 128; x <= 138; x++) expect(tile(l, x, 9)).toBe(T.Q_COIN);
    expect(tile(l, 139, 5)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 91, 8)).toBe(T.BRICK_STAR);
    expect(tile(l, 55, 5)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 135, 5)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 87, 7)).toBe(T.BLASTER_TOP);
    expect(tile(l, 87, 8)).toBe(T.HARD);
    expect(tile(l, 189, 8)).toBe(T.BLASTER_TOP);
  });
  it('has leaping Cheep Cheeps from 73 to 106 and the pipe at 117 into the bonus room', () => {
    expect(zones(l, 'cheeps')).toEqual([{ kind: 'cheeps', x: 73, w: 33 }]);
    expect(zones(l, 'pipe')).toEqual([
      {
        kind: 'pipe',
        x: 117,
        y: 3,
        dir: 'down',
        target: { level: 'll-7-1-bonus', x: 1, y: 0, exitDir: 'none' },
      },
    ]);
    // The second bonus room returns the player out of this pipe.
    expect(tile(l, 163, 11)).toBe(T.PIPE_TL);
  });
});

describe('Lost Levels 7-1 sub-areas', () => {
  it('bonus room: falls in at 1 (scrolling: it is 32 wide), four hanging piranhas, side pipe onward', () => {
    const l = load('ll-7-1-bonus');
    expect(l.start).toEqual({ x: 1, y: 0 });
    expect(l.startMode).toBe('fall');
    expect(l.camera).toBe('scroll');
    expect(load('ll-7-1-bonus2').camera).toBe('scroll');
    expect(load('ll-7-2-bonus').camera).toBe('locked'); // one screen wide
    expect(at(l, 'piranha-down')).toEqual([
      [12, 8],
      [16, 8],
      [20, 8],
      [24, 8],
    ]);
    for (const x of [12, 16, 20, 24]) expect(tile(l, x, 8)).toBe(T.PIPE_BOTTOM_L);
    expect(zones(l, 'pipe')).toEqual([
      {
        kind: 'pipe',
        x: 29,
        y: 12,
        dir: 'right',
        target: { level: 'll-7-1-exit', x: 3, y: 10, exitDir: 'up' },
      },
    ]);
  });
  it('second overworld area: out of the pipe at 3, Goombas and Koopas, a pipe to the second bonus room', () => {
    const l = load('ll-7-1-exit');
    expect(l.start).toEqual({ x: 3, y: 10 });
    expect(l.startMode).toBe('pipe-exit');
    expect(tile(l, 3, 11)).toBe(T.PIPE_TL);
    expect(at(l, 'goomba')).toEqual([
      [40, 12],
      [41, 12],
    ]);
    expect(at(l, 'koopa-green').map((p) => p[0])).toEqual([54, 55, 57, 69, 70, 72]);
    expect(at(l, 'koopa-para-green')).toEqual([[32, 12]]);
    expect(tile(l, 90, 10)).toBe(T.BLASTER_TOP);
    expect(zones(l, 'pipe')).toEqual([
      {
        kind: 'pipe',
        x: 109,
        y: 9,
        dir: 'down',
        target: { level: 'll-7-1-bonus2', x: 1, y: 0, exitDir: 'none' },
      },
    ]);
  });
  it('second bonus room: the 10-coin brick and the side pipe back to 7-1 at 163', () => {
    const l = load('ll-7-1-bonus2');
    expect(tile(l, 28, 9)).toBe(T.BRICK_COINS10);
    expect(zones(l, 'pipe')).toEqual([
      { kind: 'pipe', x: 29, y: 12, dir: 'right', target: { level: 'll-7-1', x: 163, y: 10, exitDir: 'up' } },
    ]);
  });
});

describe('Lost Levels 7-2', () => {
  const l = load('ll-7-2');
  it('loops from 128 back to 64 over the whole height, with no checkpoints to pass', () => {
    expect(zones(l, 'loop')).toEqual([
      { kind: 'loop', x: 128, y0: 0, y1: 14, to: 64, checks: [], need: 'all' },
    ]);
  });
  it('has two identical pipes (51, 115) into the bonus room, which returns past the loop at 147', () => {
    expect(zones(l, 'pipe')).toEqual([
      {
        kind: 'pipe',
        x: 51,
        y: 4,
        dir: 'down',
        target: { level: 'll-7-2-bonus', x: 1, y: 0, exitDir: 'none' },
      },
      {
        kind: 'pipe',
        x: 115,
        y: 4,
        dir: 'down',
        target: { level: 'll-7-2-bonus', x: 1, y: 0, exitDir: 'none' },
      },
    ]);
    expect(zones(load('ll-7-2-bonus'), 'pipe')).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-7-2', x: 147, y: 10, exitDir: 'up' } },
    ]);
    expect(tile(l, 147, 11)).toBe(T.PIPE_TL);
    expect(zones(l, 'checkpoint')).toEqual([{ kind: 'checkpoint', x: 151, y: 12 }]);
  });
  it('has a Lakitu from 170 to 218, fire bars, a gliding paratroopa and falling lifts', () => {
    // Its end marker is lakituEndMiddle: it flies at mid height (mid=1).
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 170, y: 7, props: { end: 218, mid: 1 } });
    expect(at(l, 'firebar-ccw')).toEqual([
      [179, 9],
      [219, 9],
    ]);
    expect(at(l, 'firebar')).toEqual([[183, 9]]);
    expect(at(l, 'koopa-para-green-h')).toEqual([[209, 7]]);
    expect(at(l, 'lift-fall')).toEqual([
      [222, 7],
      [227, 8],
      [232, 9],
      [241, 9],
      [244, 6],
    ]);
    expect(at(l, 'lift-h')).toEqual([
      [21, 10],
      [28, 10],
      [44, 11],
      [85, 10],
      [92, 10],
      [108, 11],
    ]);
    expect(count(l)).toEqual({
      'lift-h': 6,
      'koopa-para-red': 6,
      piranha: 4,
      lakitu: 1,
      'koopa-para-green': 1,
      'firebar-ccw': 2,
      firebar: 1,
      'koopa-para-green-h': 1,
      'lift-fall': 5,
      'koopa-red': 2,
    });
    expect(tile(l, 32, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 96, 5)).toBe(T.Q_POWERUP);
  });
  it('keeps the mushroom stems that stand in the water line (water never covers a tile)', () => {
    for (let x = 35; x <= 38; x++) for (const y of [12, 13, 14]) expect(tile(l, x, y)).toBe(T.MUSHROOM_STEM);
    expect(tile(l, 34, 11)).toBe(T.MUSHROOM_TOP);
    expect(tile(l, 34, 12)).toBe(T.WATER);
    expect(tile(l, 39, 12)).toBe(T.WATER);
  });
});

describe('Lost Levels 7-3', () => {
  const l = load('ll-7-3');
  it('is a treetop level with seven green springboards', () => {
    expect(tile(l, 20, 13)).toBe(T.TREE_TOP);
    expect(tile(l, 21, 14)).toBe(T.TREE_TRUNK);
    expect(at(l, 'spring-green')).toEqual([
      [21, 12],
      [50, 12],
      [73, 12],
      [99, 8],
      [137, 8],
      [196, 12],
      [233, 12],
    ]);
    expect(at(l, 'spring')).toEqual([]);
  });
  it('has a balance lift, fire bars on blocks and piranhas, and the castle at the end', () => {
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 214,
      y: 5,
      props: { x2: 219, y2: 9, len: 4, top: 2 },
    });
    expect(at(l, 'firebar-ccw')).toEqual([[277, 9]]);
    expect(at(l, 'firebar')).toEqual([
      [282, 9],
      [305, 5],
    ]);
    for (const [x, y] of [
      [277, 9],
      [282, 9],
      [305, 5],
    ] as const)
      expect(tile(l, x, y)).toBe(T.HARD);
    expect(at(l, 'piranha')).toEqual([
      [117, 9],
      [122, 13],
      [127, 9],
      [188, 9],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([[290, 7]]);
    expect(at(l, 'koopa-para-green-h')).toEqual([[74, 4]]);
    expect(at(l, 'lift-fall')).toEqual([[158, 3]]);
    expect(tile(l, 165, 7)).toBe(T.Q_POWERUP);
    expect(zones(l, 'checkpoint')).toEqual([{ kind: 'checkpoint', x: 178, y: 12 }]);
    expect(tile(l, 315, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 318, y: 12 });
  });
});

describe('Lost Levels 7-4', () => {
  const l = load('ll-7-4');
  it('is a plain castle (no maze loops, no checkpoint) entered at 1,6', () => {
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(zones(l, 'loop')).toEqual([]);
    // LOCKED_CP="True": the halfway point at 86 is never used on normal.
    expect(zones(l, 'checkpoint')).toEqual([]);
  });
  it('has the hammer-throwing Bowser on the bridge, the axe and the chain', () => {
    expect(l.entities.filter((e) => e.type === 'bowser')).toEqual([
      { type: 'bowser', x: 231, y: 9, props: { attack: 'hammer' } },
    ]);
    expect(at(l, 'axe')).toEqual([[237, 8]]);
    for (let x = 224; x <= 236; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 236, 9)).toBe(T.CHAIN);
    expect(tile(l, 237, 10)).toBe(T.CASTLE_BRICK);
  });
  it('has ten Buzzy Beetles, three red Koopas, rising and falling lifts and fire bars', () => {
    expect(at(l, 'buzzy').map((p) => p[0])).toEqual([114, 116, 119, 121, 133, 135, 144, 146, 162, 164]);
    expect(at(l, 'koopa-red')).toEqual([
      [93, 5],
      [98, 5],
      [102, 5],
    ]);
    expect(at(l, 'lift-down')).toEqual([
      [49, 7],
      [59, 2],
      [59, 10],
      [69, 2],
      [69, 10],
    ]);
    expect(at(l, 'lift-up')).toEqual([
      [54, 4],
      [54, 12],
      [64, 4],
      [64, 12],
    ]);
    expect(at(l, 'lift-h')).toEqual([[31, 13]]);
    expect(at(l, 'firebar-ccw')).toEqual([
      [16, 5],
      [45, 13],
      [82, 6],
      [156, 6],
      [170, 6],
      [231, 10],
    ]);
    expect(at(l, 'firebar')).toEqual([[201, 13]]);
    expect(at(l, 'podoboo')).toEqual([[184, 12]]);
    expect(tile(l, 44, 9)).toBe(T.HIDDEN_POWERUP);
  });
});
