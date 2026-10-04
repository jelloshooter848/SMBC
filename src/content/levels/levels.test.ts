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
    expect(tile(l, 64, 8)).toBe(T.HIDDEN_1UP);
    for (const x of [69, 70, 86, 87, 88, 153, 154]) expect(tile(l, x, 13)).toBe(T.AIR);
    expect(tile(l, 68, 13)).toBe(T.GROUND);
    expect(tile(l, 71, 13)).toBe(T.GROUND);
  });
  it('has the star brick at 101 and the flagpole at 198', () => {
    expect(tile(l, 101, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 198, 12)).toBe(T.HARD);
    expect(tile(l, 198, 11)).toBe(T.FLAG_SHAFT);
    expect(tile(l, 198, 2)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 198, next: '1-2-intro' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 82 });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 202, y: 12 });
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

describe('World 1 sub-areas and later stages follow the original layouts', () => {
  it('1-1 bonus room: fall in at column 1, walk out through the side pipe to the 2-tall pipe at 163', () => {
    const l = load('1-1-bonus');
    expect(l.startMode).toBe('fall');
    expect(l.camera).toBe('locked');
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 13,
      y: 12,
      dir: 'right',
      target: { level: '1-1', x: 163, y: 10, exitDir: 'up' },
    });
    const main = load('1-1');
    expect(tile(main, 163, 11)).toBe(T.PIPE_TL);
    expect(tile(main, 163, 10)).toBe(T.AIR);
  });
  it('1-2 intro walks into the side pipe and 1-2 starts with the drop from the ceiling', () => {
    const intro = load('1-2-intro');
    expect(intro.startMode).toBe('autowalk');
    expect(intro.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 10, y: 12, dir: 'right' }));
    const l = load('1-2');
    expect(l.startMode).toBe('fall');
    expect(l.start).toEqual({ x: 1, y: 3 });
    expect(l.width).toBe(192);
  });
  it('1-2 has the bonus pipe at 103, piranhas, elevators, the exit pipe at 166 and three warp pipes', () => {
    const l = load('1-2');
    expect(tile(l, 103, 10)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 103, y: 10, dir: 'down' }));
    expect(l.entities.filter((e) => e.type === 'piranha').map((e) => e.x)).toEqual([103, 109, 115]);
    expect(l.entities.filter((e) => e.type === 'lift-down')).toHaveLength(2);
    expect(l.entities.filter((e) => e.type === 'lift-up')).toHaveLength(2);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 166,
      y: 9,
      dir: 'right',
      target: { level: '1-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    const warps = l.zones.filter((z) => z.kind === 'pipe' && z.x >= 176).map((z) => z.x);
    expect(warps).toEqual([178, 182, 186]);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'warp', x: 176, worlds: [4, 3, 2] }));
  });
  it('1-2 exit area rises out of the pipe at 3 and ends at the flagpole at 22', () => {
    const l = load('1-2-exit');
    expect(l.startMode).toBe('pipe-exit');
    expect(l.start).toEqual({ x: 3, y: 10 });
    expect(tile(l, 3, 11)).toBe(T.PIPE_TL);
    expect(tile(l, 22, 2)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 22, next: '1-3' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 26, y: 12 });
  });
  it('1-3 is treetops with two red paratroopas, four lifts and the big castle', () => {
    const l = load('1-3');
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(tile(l, 26, 5)).toBe(T.TREE_TOP);
    expect(tile(l, 27, 6)).toBe(T.TREE_TRUNK);
    expect(l.entities.filter((e) => e.type === 'koopa-para-red').map((e) => e.x)).toEqual([74, 114]);
    expect(l.entities.filter((e) => e.type.startsWith('lift-'))).toHaveLength(4);
    expect(tile(l, 152, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 155, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 153, next: '1-4' });
  });
  it('1-4 has seven fire bars, a lift before the 13-tile bridge, Bowser at 136 and the axe at 141', () => {
    const l = load('1-4');
    expect(l.theme).toBe('castle');
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(l.entities.filter((e) => e.type === 'firebar')).toHaveLength(7);
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 136, y: 6, props: { len: 4, range: 3 } });
    for (let x = 128; x <= 140; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 140, 9)).toBe(T.CHAIN);
    expect(l.entities).toContainEqual({ type: 'bowser', x: 136, y: 9 });
    expect(l.entities).toContainEqual({ type: 'axe', x: 141, y: 8 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 152, next: '2-1' });
  });
});
