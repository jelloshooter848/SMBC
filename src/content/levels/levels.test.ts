import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';

const root = join(import.meta.dirname);
const files: { world: string; file: string; path: string }[] = [];
for (const world of readdirSync(root).filter((d) => d.startsWith('world'))) {
  for (const file of readdirSync(join(root, world)).filter((f) => f.endsWith('.map'))) {
    files.push({ world, file, path: join(root, world, file) });
  }
}

function load(id: string): LevelData {
  const f = files.find((x) => x.file === `${id}.map`);
  if (!f) throw new Error(`missing ${id}.map`);
  return parseTextMap(readFileSync(f.path, 'utf8'), id);
}

const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];

describe('bundled levels parse', () => {
  it.each(files.map((f) => [f.file, f.path]))('%s', (_name, path) => {
    const lvl = parseTextMap(readFileSync(path as string, 'utf8'));
    expect(lvl.width).toBeGreaterThan(15);
    expect(lvl.height).toBe(15);
  });
});

describe('World 1-1 landmarks', () => {
  const l = load('1-1');
  it('starts with the first ? block at column 16, four tiles above the ground', () => {
    expect(tile(l, 16, 9)).toBe(T.Q_COIN);
    expect(tile(l, 21, 9)).toBe(T.Q_POWERUP);
    expect(tile(l, 22, 5)).toBe(T.Q_COIN);
  });
  it('has pipes of height 2, 3, 4, 4 and the bonus pipe is enterable', () => {
    expect(tile(l, 28, 11)).toBe(T.PIPE_TL);
    expect(tile(l, 38, 10)).toBe(T.PIPE_TL);
    expect(tile(l, 46, 9)).toBe(T.PIPE_TL);
    expect(tile(l, 57, 9)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 57, y: 9, dir: 'down' }));
  });
  it('has the hidden 1-up at column 64 and three pits', () => {
    expect(tile(l, 64, 9)).toBe(T.HIDDEN_1UP);
    for (const x of [69, 70, 86, 87, 88, 153, 154]) expect(tile(l, x, 13)).toBe(T.AIR);
    expect(tile(l, 68, 13)).toBe(T.GROUND);
    expect(tile(l, 71, 13)).toBe(T.GROUND);
  });
  it('has the star brick at 101 and the flagpole at 198', () => {
    expect(tile(l, 101, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 198, 12)).toBe(T.HARD);
    expect(tile(l, 198, 11)).toBe(T.FLAG_SHAFT);
    expect(tile(l, 198, 1)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 198, next: '1-2' });
  });
  it('has 16 goombas and 1 koopa', () => {
    expect(l.entities.filter((e) => e.type === 'goomba')).toHaveLength(16);
    expect(l.entities.filter((e) => e.type === 'koopa-green')).toHaveLength(1);
  });
  it('ends with the 8-step staircase', () => {
    expect(tile(l, 188, 5)).toBe(T.HARD);
    expect(tile(l, 189, 5)).toBe(T.HARD);
    expect(tile(l, 181, 12)).toBe(T.HARD);
    expect(tile(l, 181, 11)).toBe(T.AIR);
  });
});
