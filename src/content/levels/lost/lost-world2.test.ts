import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels, World 2, converted from levelDataLostLevels.xml (normal difficulty). Every value
// below was checked against the original XML tokens, not just copied from the generated maps.

const dir = join(import.meta.dirname, 'world2');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const ofType = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type);
const at = (l: LevelData, type: string) => ofType(l, type).map((e) => [e.x, e.y]);
const pipeAt = (l: LevelData, x: number) => l.zones.find((z) => z.kind === 'pipe' && z.x === x);
const exitOf = (l: LevelData) => l.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
const poisonTiles = (l: LevelData) =>
  Array.from(l.tiles)
    .map((t, i) => [t, i % l.width, Math.floor(i / l.width)] as const)
    .filter(([t]) => t === T.Q_POISON || t === T.BRICK_POISON || t === T.HIDDEN_POISON)
    .map(([t, x, y]) => [t, x, y]);

const AREAS = ['ll-2-1', 'll-2-1-bonus', 'll-2-1-sky', 'll-2-2', 'll-2-2-bonus', 'll-2-3', 'll-2-4'];

describe('Lost Levels World 2: files', () => {
  it('has exactly the expected areas, none of them night or snow', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.map'));
    expect(files.map((f) => f.replace(/\.map$/, '')).sort()).toEqual([...AREAS].sort());
    for (const id of AREAS) {
      const l = load(id);
      expect(l.id).toBe(id);
      expect(l.world).toBe(2);
      expect(['night', 'snow']).not.toContain(l.theme);
    }
  });

  it('sub-areas inherit the clock; main areas carry the XML TIME', () => {
    const main: Record<string, number> = { 'll-2-1': 400, 'll-2-2': 400, 'll-2-3': 400, 'll-2-4': 300 };
    for (const id of AREAS) {
      const l = load(id);
      expect(l.time).toBe(main[id] ?? null);
      expect(l.parent).toBe(main[id] ? null : id.split('-').slice(0, 3).join('-'));
    }
  });

  it('every pipe, vine and pit target resolves to a World 2 map', () => {
    for (const id of AREAS) {
      for (const z of load(id).zones) {
        if (z.kind !== 'pipe' && z.kind !== 'vine' && z.kind !== 'pit') continue;
        expect(existsSync(join(dir, `${z.target.level}.map`))).toBe(true);
      }
    }
  });

  it('poison mushrooms are only in the 2-1 ? block at 148,9 and the 2-2 bonus room', () => {
    for (const id of AREAS) {
      const expected =
        id === 'll-2-1' ? [[T.Q_POISON, 148, 9]] : id === 'll-2-2-bonus' ? [[T.HIDDEN_POISON, 1, 9]] : [];
      expect(poisonTiles(load(id))).toEqual(expected);
    }
  });
});

describe('Lost Levels 2-1', () => {
  const l = load('ll-2-1');
  it('is a 248-wide overworld level starting at 2,12', () => {
    expect(l.width).toBe(248);
    expect(l.theme).toBe('overworld');
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(l.startMode).toBe('stand');
  });
  it('has two green springboards', () => {
    expect(at(l, 'spring-green')).toEqual([
      [114, 10],
      [162, 11],
    ]);
    expect(ofType(l, 'spring')).toHaveLength(0);
    // Each sits on a mushroom cap or a block.
    expect(tile(l, 114, 11)).toBe(T.MUSHROOM_TOP);
    expect(tile(l, 162, 12)).toBe(T.HARD);
  });
  it('has its paratroopas, goombas and piranhas', () => {
    expect(at(l, 'koopa-para-green')).toEqual([
      [36, 8],
      [40, 8],
      [44, 8],
      [47, 8],
      [50, 8],
      [152, 12],
      [206, 6],
      [211, 3],
    ]);
    expect(at(l, 'koopa-para-green-h')).toEqual([
      [175, 8],
      [179, 7],
    ]);
    expect(at(l, 'goomba')).toEqual([
      [220, 3],
      [221, 3],
      [222, 3],
    ]);
    expect(ofType(l, 'piranha').map((e) => e.x)).toEqual([70, 77, 83, 90, 135]);
    expect(ofType(l, 'lift-h').map((e) => [e.x, e.y])).toEqual([
      [107, 12],
      [121, 12],
    ]);
  });
  it('has its item blocks, the vine to the sky and the bonus pipe', () => {
    expect(tile(l, 42, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 62, 5)).toBe(T.BRICK_STAR);
    expect(tile(l, 100, 2)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 194, 2)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 137, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 137,
      y: 5,
      target: { level: 'll-2-1-sky', x: 4, y: 14 },
    });
    expect(pipeAt(l, 70)).toEqual({
      kind: 'pipe',
      x: 70,
      y: 12,
      dir: 'down',
      target: { level: 'll-2-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(tile(l, 83, 11)).toBe(T.PIPE_TL);
  });
  it('has water over its pits and ends at the flag at 232 (walk to the door at 237)', () => {
    expect(tile(l, 30, 12)).toBe(T.WATER);
    expect(tile(l, 30, 13)).toBe(T.AIR);
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 130 });
    expect(tile(l, 232, 2)).toBe(T.FLAG_BALL);
    expect(tile(l, 232, 12)).toBe(T.HARD);
    // The exit zone is the castle door minus six (the flag walk ends 6 tiles right of it).
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 231, next: 'll-2-2' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 235, y: 12 });
  });
  it('bonus room: a hole in the floor at column 3 and a side pipe back to 83', () => {
    const b = load('ll-2-1-bonus');
    expect(tile(b, 3, 13)).toBe(T.AIR);
    expect(tile(b, 3, 14)).toBe(T.AIR);
    expect(tile(b, 11, 9)).toBe(T.BRICK_COINS10);
    expect(b.zones).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-2-1', x: 83, y: 10, exitDir: 'up' } },
    ]);
  });
  it('sky: climb in, ride the lift right and drop back into 2-1 at 146', () => {
    const s = load('ll-2-1-sky');
    expect(s.width).toBe(120);
    expect(s.startMode).toBe('climb');
    expect(s.entities).toEqual([
      { type: 'vine', x: 4, y: 14, props: { len: 8 } },
      { type: 'lift-right', x: 17, y: 10, props: { len: 6 } },
    ]);
    expect(s.zones).toEqual([{ kind: 'pit', x: 0, target: { level: 'll-2-1', x: 146, y: 0 } }]);
    expect(Array.from(s.tiles).filter((t) => t === T.COIN)).toHaveLength(73);
  });
});

describe('Lost Levels 2-2', () => {
  const l = load('ll-2-2');
  it('is a 272-wide overworld level full of Koopas and piranhas', () => {
    expect(l.width).toBe(272);
    expect(l.theme).toBe('overworld');
    expect(ofType(l, 'goomba')).toHaveLength(10);
    expect(ofType(l, 'koopa-green')).toHaveLength(17);
    expect(at(l, 'koopa-red')).toEqual([[225, 12]]);
    expect(ofType(l, 'koopa-para-green').map((e) => e.x)).toEqual([17, 74, 78, 116, 237]);
    expect(at(l, 'piranha')).toEqual([
      [19, 10],
      [26, 13],
      [32, 13],
      [55, 10],
      [96, 12],
      [169, 10],
      [179, 11],
      [190, 3],
      [217, 11],
    ]);
  });
  it('has the star and mushroom bricks, the bonus pipe at 169 and the flag at 262', () => {
    expect(tile(l, 125, 6)).toBe(T.BRICK_STAR);
    expect(tile(l, 173, 5)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 173, 9)).toBe(T.BRICK_COINS10);
    expect(pipeAt(l, 169)).toEqual({
      kind: 'pipe',
      x: 169,
      y: 10,
      dir: 'down',
      target: { level: 'll-2-2-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(load('ll-2-2-bonus').zones).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-2-2', x: 179, y: 10, exitDir: 'up' } },
    ]);
    expect(tile(l, 179, 11)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 130 });
    expect(tile(l, 262, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 262, next: 'll-2-3' });
  });
});

describe('Lost Levels 2-3', () => {
  const l = load('ll-2-3');
  it('is 192-wide treetops and bridges under leaping Cheep Cheeps', () => {
    expect(l.width).toBe(192);
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 15, w: 143 });
    expect(tile(l, 16, 10)).toBe(T.BRIDGE);
    expect(tile(l, 96, 13)).toBe(T.TREE_TOP);
  });
  it('has a Blooper in the air and a mix of Koopas', () => {
    expect(at(l, 'blooper')).toEqual([[95, 9]]);
    expect(at(l, 'koopa-green')).toEqual([
      [25, 8],
      [26, 8],
      [28, 8],
    ]);
    expect(at(l, 'koopa-red')).toEqual([
      [90, 11],
      [155, 11],
    ]);
    expect(at(l, 'koopa-para-green')).toEqual([[51, 9]]);
    expect(at(l, 'koopa-para-red')).toEqual([[65, 11]]);
    expect(at(l, 'koopa-para-green-h')).toEqual([
      [121, 7],
      [148, 9],
    ]);
    expect(tile(l, 80, 5)).toBe(T.Q_POWERUP);
  });
  it('ends at the flag at 177; the walk reaches the big castle door at 184', () => {
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 98 });
    expect(tile(l, 177, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 180, y: 12 });
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 178, next: 'll-2-4' });
  });
});

describe('Lost Levels 2-4', () => {
  const l = load('ll-2-4');
  it('is a 160-wide castle with a 300 clock', () => {
    expect(l.width).toBe(160);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.start).toEqual({ x: 1, y: 6 });
  });
  it('has seven fire bars, four Podoboos and a corridor of Goombas and Koopas', () => {
    expect(at(l, 'firebar')).toEqual([
      [56, 12],
      [76, 9],
      [91, 5],
      [109, 12],
    ]);
    expect(at(l, 'firebar-ccw')).toEqual([
      [80, 5],
      [85, 9],
      [103, 12],
    ]);
    expect(ofType(l, 'podoboo').map((e) => e.x)).toEqual([81, 98, 118, 123]);
    expect(at(l, 'goomba')).toEqual([
      [28, 12],
      [29, 12],
      [31, 12],
    ]);
    expect(at(l, 'koopa-green')).toEqual([
      [23, 5],
      [39, 12],
      [40, 12],
      [49, 12],
      [50, 12],
      [52, 12],
    ]);
    expect(tile(l, 66, 5)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 130, 6)).toBe(T.BRICK_COINS10);
  });
  it('has a fire-breathing Bowser, the axe, a lift over the lava and leads to 3-1', () => {
    expect(ofType(l, 'bowser')).toEqual([{ type: 'bowser', x: 135, y: 9 }]);
    expect(l.entities).toContainEqual({ type: 'axe', x: 141, y: 8 });
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 138, y: 5, props: { len: 4, range: 3 } });
    for (let x = 128; x <= 140; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 88 });
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 152, next: 'll-3-1' });
  });
});
