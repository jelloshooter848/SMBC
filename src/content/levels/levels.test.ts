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

describe('World 2 follows the original layouts', () => {
  it('2-1: forest level with a springboard, a vine to the sky and a bonus pipe', () => {
    const l = load('2-1');
    expect(l.width).toBe(224);
    expect(l.entities).toContainEqual({ type: 'spring', x: 188, y: 12 });
    expect(tile(l, 83, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({ kind: 'vine', x: 83, y: 5, target: { level: '2-1-sky', x: 4, y: 14 } });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 103, y: 9, dir: 'down' }));
    expect(l.zones).toContainEqual({ kind: 'exit', x: 200, next: '2-2-intro' });
    expect(l.entities.filter((e) => e.type === 'koopa-para-green')).toHaveLength(3);
    expect(l.entities.filter((e) => e.type === 'piranha')).toHaveLength(7);
    expect(l.decor.filter((d) => d.kind.startsWith('tree-'))).toHaveLength(29);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: -2, y: 12 });
  });
  it('2-1 sky: starts climbing the vine, and the clouds end in a drop back to 2-1', () => {
    const l = load('2-1-sky');
    expect(l.startMode).toBe('climb');
    expect(l.start).toEqual({ x: 4, y: 14 });
    expect(l.entities).toContainEqual({ type: 'vine', x: 4, y: 14, props: { len: 8 } });
    expect(l.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: '2-1', x: 162, y: 0 } });
    expect(tile(l, 20, 6)).toBe(T.COIN);
    expect(tile(l, 62, 13)).toBe(T.AIR);
  });
  it('2-2: a water level entered from the intro pipe, with cheep cheeps, bloopers and a side exit', () => {
    const intro = load('2-2-intro');
    expect(intro.startMode).toBe('autowalk');
    expect(intro.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 10, y: 12, dir: 'right' }));
    const l = load('2-2');
    expect(l.theme).toBe('water');
    expect(l.startMode).toBe('fall');
    expect(tile(l, 0, 2)).toBe(T.WATER);
    expect(tile(l, 150, 2)).toBe(T.WATER);
    expect(l.entities.filter((e) => e.type === 'cheep-red')).toHaveLength(6);
    expect(l.entities.filter((e) => e.type === 'cheep-grey')).toHaveLength(11);
    expect(l.entities.filter((e) => e.type === 'blooper')).toHaveLength(6);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 189,
      y: 8,
      dir: 'right',
      target: { level: '2-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    expect(load('2-2-exit').zones).toContainEqual({ kind: 'exit', x: 22, next: '2-3' });
  });
  it('2-3: treetop bridges with leaping cheep cheeps', () => {
    const l = load('2-3');
    expect(l.width).toBe(240);
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 9, w: 173 });
    expect(tile(l, 16, 10)).toBe(T.BRIDGE);
    expect(tile(l, 8, 13)).toBe(T.TREE_TOP);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 226, next: '2-4' });
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 228, y: 12 });
  });
  it('2-4: castle with podoboos, fire bars, elevators and Bowser', () => {
    const l = load('2-4');
    expect(l.theme).toBe('castle');
    expect(l.entities.filter((e) => e.type === 'podoboo').map((e) => e.x)).toEqual([16, 30]);
    expect(l.entities.filter((e) => e.type.startsWith('firebar'))).toHaveLength(6);
    expect(l.entities.filter((e) => e.type === 'lift-up')).toHaveLength(2);
    expect(l.entities.filter((e) => e.type === 'lift-down')).toHaveLength(2);
    expect(l.entities).toContainEqual({ type: 'bowser', x: 136, y: 9 });
    expect(l.entities).toContainEqual({ type: 'axe', x: 141, y: 8 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 152, next: '3-1' });
  });
});

describe('World 3 follows the original layouts', () => {
  it('3-1: a night level with two Hammer Bros, a springboard, a vine and a bonus pipe', () => {
    const l = load('3-1');
    expect(l.theme).toBe('night');
    expect(l.width).toBe(224);
    expect(l.entities.filter((e) => e.type === 'hammer-bro').map((e) => [e.x, e.y])).toEqual([
      [113, 8],
      [116, 12],
    ]);
    expect(l.entities).toContainEqual({ type: 'spring', x: 126, y: 12 });
    expect(tile(l, 131, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({ kind: 'vine', x: 131, y: 5, target: { level: '3-1-sky', x: 4, y: 14 } });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 38, y: 9, dir: 'down' }));
    expect(tile(l, 78, 12)).toBe(T.WATER); // water at the bottom of the pit
    expect(l.zones).toContainEqual({ kind: 'exit', x: 200, next: '3-2' });
    expect(l.entities.filter((e) => e.type === 'koopa-para-green')).toHaveLength(5);
  });
  it('3-1 sky: a 96-wide coin heaven that drops back into 3-1', () => {
    const l = load('3-1-sky');
    expect(l.width).toBe(96);
    expect(l.startMode).toBe('climb');
    expect(l.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: '3-1', x: 162, y: 0 } });
  });
  it('3-2: night with trees, ending at the small castle', () => {
    const l = load('3-2');
    expect(l.theme).toBe('night');
    expect(l.decor.some((d) => d.kind === 'tree-big')).toBe(true);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 209, next: '3-3' });
  });
  it('3-3: night treetops with two balance lifts and the big castle', () => {
    const l = load('3-3');
    expect(l.theme).toBe('night');
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 82,
      y: 6,
      props: { x2: 89, y2: 8, len: 6, top: 2 },
    });
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 137,
      y: 5,
      props: { x2: 141, y2: 8, len: 6, top: 2 },
    });
    expect(l.entities.filter((e) => e.type === 'lift-h')).toHaveLength(6);
    expect(l.entities).toContainEqual({ type: 'lift-fall', x: 61, y: 6, props: { len: 6 } });
    expect(tile(l, 84, 11)).toBe(T.TREE_TOP);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 154, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 152, next: '3-4' });
  });
  it('3-4: castle with six Podoboos, nine fire bars and Bowser', () => {
    const l = load('3-4');
    expect(l.theme).toBe('castle');
    expect(l.entities.filter((e) => e.type === 'podoboo').map((e) => e.x)).toEqual([
      16, 26, 88, 97, 103, 109,
    ]);
    expect(l.entities.filter((e) => e.type.startsWith('firebar'))).toHaveLength(9);
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 136, y: 6, props: { len: 4, range: 3 } });
    expect(l.entities).toContainEqual({ type: 'bowser', x: 136, y: 9 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 152, next: '4-1' });
  });
});

describe('World 4 follows the original layouts', () => {
  it('4-1: Lakitu over most of the level and a bonus pipe', () => {
    const l = load('4-1');
    expect(l.width).toBe(240);
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 19, y: 0, props: { end: 208 } });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 132, y: 9, dir: 'down' }));
    expect(l.zones).toContainEqual({ kind: 'exit', x: 225, next: '4-2-intro' });
  });
  it('4-2: Buzzy Beetles, a vine to the warp zone, a bonus pipe, the side exit and a warp to 5-1', () => {
    const l = load('4-2');
    expect(l.entities.filter((e) => e.type === 'buzzy').map((e) => [e.x, e.y])).toEqual([
      [154, 9],
      [83, 12],
      [88, 12],
      [179, 12],
    ]);
    expect(tile(l, 64, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({ kind: 'vine', x: 64, y: 5, target: { level: '4-2-warp', x: 4, y: 14 } });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 84, y: 10, dir: 'down' }));
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 187, y: 9, dir: 'right' }));
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 214,
      y: 10,
      dir: 'down',
      target: { level: '5-1', x: 2, y: 12 },
    });
    expect(load('4-2-exit').zones).toContainEqual({ kind: 'exit', x: 22, next: '4-3' });
  });
  it('4-2 warp: climb up from the vine to pipes for worlds 8, 7 and 6', () => {
    const l = load('4-2-warp');
    expect(l.startMode).toBe('climb');
    expect(
      l.zones.filter((z) => z.kind === 'pipe').map((z) => (z.kind === 'pipe' ? z.target.level : '')),
    ).toEqual(['8-1', '7-1', '6-1']);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'warp', worlds: [8, 7, 6] }));
    expect(tile(l, 30, 4)).toBe(T.MUSHROOM_TOP);
  });
  it('4-3: giant mushrooms with four balance lifts', () => {
    const l = load('4-3');
    expect(l.entities.filter((e) => e.type === 'balance')).toHaveLength(4);
    expect(l.entities).toContainEqual({ type: 'koopa-para-red', x: 36, y: 6 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 148, next: '4-4' });
  });
  it('4-4: a 320-wide castle maze with four loops and Bowser at the end', () => {
    const l = load('4-4');
    expect(l.width).toBe(320);
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([
      { kind: 'loop', x: 63, y0: 3, y1: 5, to: 127, checks: [{ x: 35, y0: 3, y1: 5 }], need: 'all' },
      { kind: 'loop', x: 127, y0: 10, y1: 12, to: 63, checks: [{ x: 99, y0: 10, y1: 12 }], need: 'all' },
      { kind: 'loop', x: 191, y0: 11, y1: 12, to: 255, checks: [{ x: 161, y0: 11, y1: 12 }], need: 'all' },
      { kind: 'loop', x: 255, y0: 3, y1: 9, to: 191, checks: [{ x: 239, y0: 3, y1: 9 }], need: 'all' },
    ]);
    expect(l.entities).toContainEqual({ type: 'bowser', x: 296, y: 9 });
    expect(l.entities).toContainEqual({ type: 'axe', x: 301, y: 8 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 312, next: '5-1' });
  });
});

describe('World 5 follows the original layouts', () => {
  it('5-1: three Bullet Bill blasters, paratroopas and a bonus pipe', () => {
    const l = load('5-1');
    for (const x of [111, 159, 170]) {
      expect(tile(l, x, 11)).toBe(T.BLASTER_TOP);
      expect(tile(l, x, 12)).toBe(T.BLASTER_BASE);
    }
    expect(l.entities.filter((e) => e.type === 'koopa-para-green')).toHaveLength(4);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 156, y: 7, dir: 'down' }));
    expect(l.zones).toContainEqual({ kind: 'exit', x: 199, next: '5-2' });
  });
  it('5-2: Hammer Bros, beetles, blasters, a springboard, an underwater detour and a coin heaven', () => {
    const l = load('5-2');
    expect(l.entities.filter((e) => e.type === 'hammer-bro').map((e) => [e.x, e.y])).toEqual([
      [124, 4],
      [81, 8],
      [120, 8],
      [45, 9],
    ]);
    expect(l.entities.filter((e) => e.type === 'buzzy').map((e) => e.x)).toEqual([136, 137, 138]);
    expect(l.entities).toContainEqual({ type: 'spring', x: 25, y: 12 });
    expect(tile(l, 17, 7)).toBe(T.BLASTER_TOP);
    expect(tile(l, 107, 11)).toBe(T.BLASTER_TOP);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 55,
      y: 10,
      dir: 'down',
      target: { level: '5-2-water', x: 1, y: 1, exitDir: 'none' },
    });
    expect(l.zones).toContainEqual({ kind: 'vine', x: 85, y: 5, target: { level: '5-2-sky', x: 4, y: 14 } });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 200, next: '5-3' });
    const water = load('5-2-water');
    expect(water.theme).toBe('water');
    expect(water.zones).toContainEqual({
      kind: 'pipe',
      x: 62,
      y: 8,
      dir: 'right',
      target: { level: '5-2', x: 115, y: 10, exitDir: 'up' },
    });
    expect(load('5-2-sky').entities).toContainEqual({ type: 'lift-right', x: 17, y: 10, props: { len: 6 } });
  });
  it('5-3: treetops under a stretch of Bullet Bills', () => {
    const l = load('5-3');
    expect(l.zones).toContainEqual({ kind: 'bullets', x: 0, w: 126 });
    expect(l.entities.filter((e) => e.type === 'koopa-para-red').map((e) => e.x)).toEqual([74, 114]);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 153, next: '5-4' });
  });
  it('5-4: castle with a long fire bar, Podoboos and Bowser', () => {
    const l = load('5-4');
    expect(l.entities).toContainEqual({ type: 'firebar-ccw', x: 23, y: 7, props: { len: 12 } });
    expect(l.entities.filter((e) => e.type === 'podoboo')).toHaveLength(6);
    expect(l.entities).toContainEqual({ type: 'bowser', x: 136, y: 9 });
    expect(l.entities).toContainEqual({ type: 'axe', x: 141, y: 8 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 152, next: '6-1' });
  });
});

describe('World 6 follows the original layouts', () => {
  it('6-1: a night level under Lakitu', () => {
    const l = load('6-1');
    expect(l.theme).toBe('night');
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 21, y: 0, props: { end: 170 } });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 188, next: '6-2' });
  });
  it('6-2: beetles, two bonus rooms, an underwater detour and a coin heaven', () => {
    const l = load('6-2');
    expect(l.entities.filter((e) => e.type === 'buzzy').map((e) => [e.x, e.y])).toEqual([
      [120, 4],
      [54, 12],
      [92, 12],
      [163, 12],
    ]);
    const pipeTo = (x: number) =>
      l.zones.find((z) => z.kind === 'pipe' && z.x === x && z.dir === 'down') as
        { target: { level: string } } | undefined;
    expect(pipeTo(19)?.target.level).toBe('6-2-bonus');
    expect(pipeTo(56)?.target.level).toBe('6-2-water');
    expect(pipeTo(153)?.target.level).toBe('6-2-bonus2');
    expect(load('6-2-bonus').zones).toContainEqual(
      expect.objectContaining({ kind: 'pipe', target: { level: '6-2', x: 35, y: 10, exitDir: 'up' } }),
    );
    expect(load('6-2-water').zones).toContainEqual(
      expect.objectContaining({ kind: 'pipe', target: { level: '6-2', x: 115, y: 10, exitDir: 'up' } }),
    );
    expect(load('6-2-bonus2').zones).toContainEqual(
      expect.objectContaining({ kind: 'pipe', target: { level: '6-2', x: 179, y: 10, exitDir: 'up' } }),
    );
    expect(l.zones).toContainEqual({ kind: 'vine', x: 81, y: 5, target: { level: '6-2-sky', x: 4, y: 14 } });
    expect(load('6-2-sky').zones).toContainEqual({
      kind: 'pit',
      x: 0,
      target: { level: '6-2', x: 162, y: 0 },
    });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 216, next: '6-3' });
  });
  it('6-3: snowy treetops with three balance lifts, springboards and Bullet Bills', () => {
    const l = load('6-3');
    expect(l.theme).toBe('snow');
    expect(l.entities.filter((e) => e.type === 'balance').map((e) => [e.x, e.props?.x2])).toEqual([
      [71, 75],
      [79, 82],
      [127, 130],
    ]);
    expect(l.entities.filter((e) => e.type === 'spring').map((e) => e.x)).toEqual([38, 116]);
    expect(l.zones).toContainEqual({ kind: 'bullets', x: 89, w: 33 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 168, next: '6-4' });
  });
  it('6-4: a castle whose Bowser throws hammers', () => {
    const l = load('6-4');
    expect(l.entities).toContainEqual({ type: 'bowser', x: 136, y: 9, props: { attack: 'hammer' } });
    expect(l.entities.filter((e) => e.type === 'podoboo').map((e) => e.x)).toEqual([27, 33, 131]);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 152, next: '7-1' });
  });
});

describe('World 7 follows the original layouts', () => {
  it('7-1: thirteen blaster barrels, four Hammer Bros, a beetle, a springboard and a bonus room', () => {
    const l = load('7-1');
    expect(Array.from(l.tiles).filter((t) => t === T.BLASTER_TOP)).toHaveLength(13);
    expect(l.entities.filter((e) => e.type === 'hammer-bro')).toHaveLength(4);
    expect(l.entities).toContainEqual({ type: 'buzzy', x: 169, y: 4 });
    expect(l.entities).toContainEqual({ type: 'spring', x: 151, y: 12 });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 93, y: 10, dir: 'down' }));
    expect(l.zones).toContainEqual({ kind: 'exit', x: 179, next: '7-2-intro' });
  });
  it('7-2: a water level with thirteen Bloopers and a side exit', () => {
    const l = load('7-2');
    expect(l.theme).toBe('water');
    expect(l.entities.filter((e) => e.type === 'blooper')).toHaveLength(13);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 189, y: 8, dir: 'right' }));
    expect(load('7-2-exit').zones).toContainEqual({ kind: 'exit', x: 22, next: '7-3' });
  });
  it('7-3: bridges with leaping Cheep Cheeps and two gliding paratroopas', () => {
    const l = load('7-3');
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 9, w: 173 });
    expect(l.entities.filter((e) => e.type === 'koopa-para-green-h').map((e) => [e.x, e.y])).toEqual([
      [137, 7],
      [153, 9],
    ]);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 226, next: '7-4' });
  });
  it('7-4: a 352-wide maze with all/any checkpoint loops and a hammer Bowser', () => {
    const l = load('7-4');
    expect(l.width).toBe(352);
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([
      {
        kind: 'loop',
        x: 79,
        y0: 3,
        y1: 5,
        to: 143,
        checks: [
          { x: 43, y0: 10, y1: 12 },
          { x: 60, y0: 7, y1: 9 },
        ],
        need: 'all',
      },
      {
        kind: 'loop',
        x: 143,
        y0: 3,
        y1: 12,
        to: 79,
        checks: [
          { x: 107, y0: 3, y1: 5 },
          { x: 123, y0: 3, y1: 5 },
          { x: 124, y0: 11, y1: 12 },
          { x: 135, y0: 10, y1: 12 },
        ],
        need: 'any',
      },
      {
        kind: 'loop',
        x: 208,
        y0: 3,
        y1: 5,
        to: 272,
        checks: [
          { x: 173, y0: 3, y1: 5 },
          { x: 191, y0: 7, y1: 9 },
        ],
        need: 'all',
      },
      {
        kind: 'loop',
        x: 272,
        y0: 3,
        y1: 9,
        to: 208,
        checks: [
          { x: 240, y0: 10, y1: 12 },
          { x: 254, y0: 3, y1: 5 },
          { x: 255, y0: 11, y1: 12 },
          { x: 269, y0: 7, y1: 9 },
        ],
        need: 'any',
      },
    ]);
    expect(l.entities).toContainEqual({ type: 'bowser', x: 328, y: 9, props: { attack: 'hammer' } });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 344, next: '8-1' });
  });
});

describe('World 8 follows the original layouts', () => {
  it('8-1: a 400-wide forest with four Buzzy Beetles and a bonus pipe', () => {
    const l = load('8-1');
    expect(l.width).toBe(400);
    expect(l.entities.filter((e) => e.type === 'buzzy').map((e) => e.x)).toEqual([18, 81, 254, 283]);
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'pipe', x: 104, y: 9, dir: 'down' }));
    expect(l.zones).toContainEqual({ kind: 'exit', x: 376, next: '8-2' });
  });
  it('8-2: Lakitu over the start, blasters, beetles and a springboard', () => {
    const l = load('8-2');
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 8, y: 0, props: { end: 40 } });
    expect(Array.from(l.tiles).filter((t) => t === T.BLASTER_TOP)).toHaveLength(10);
    expect(l.entities.filter((e) => e.type === 'buzzy')).toHaveLength(4);
    expect(l.entities.filter((e) => e.type === 'spring')).toHaveLength(1);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 216, next: '8-3' });
  });
  it('8-3: castle walls in the background, Hammer Bros and blasters', () => {
    const l = load('8-3');
    expect(Array.from(l.tiles).filter((t) => t === T.WALL_TOP)).toHaveLength(98);
    expect(Array.from(l.tiles).filter((t) => t === T.WALL)).toHaveLength(487);
    expect(l.entities.filter((e) => e.type === 'hammer-bro')).toHaveLength(5);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 218, next: '8-4' });
  });
  it('8-4: pipes back into the castle, edge loops, two cheep zones and the water detour', () => {
    const l = load('8-4');
    expect(l.width).toBe(331);
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([
      { kind: 'loop', x: 110, y0: 3, y1: 12, to: 37, checks: [], need: 'all' },
      { kind: 'loop', x: 180, y0: 3, y1: 12, to: 112, checks: [], need: 'all' },
      { kind: 'loop', x: 317, y0: 3, y1: 9, to: 253, checks: [], need: 'all' },
    ]);
    expect(l.zones.filter((z) => z.kind === 'cheeps')).toEqual([
      { kind: 'cheeps', x: 216, w: 15 },
      { kind: 'cheeps', x: 280, w: 15 },
    ]);
    const target = (x: number) =>
      (l.zones.find((z) => z.kind === 'pipe' && z.x === x) as { target: object } | undefined)?.target;
    for (const x of [51, 143, 223, 287])
      expect(target(x)).toEqual({ level: '8-4', x: 19, y: 10, exitDir: 'up' });
    expect(target(81)).toEqual({ level: '8-4', x: 126, y: 10, exitDir: 'up' });
    expect(target(163)).toEqual({ level: '8-4', x: 206, y: 10, exitDir: 'up' });
    for (const x of [239, 303]) expect(target(x)).toEqual({ level: '8-4-water', x: 3, y: 10, exitDir: 'up' });
    expect(load('8-4-water').zones).toContainEqual(
      expect.objectContaining({
        kind: 'pipe',
        x: 68,
        y: 8,
        dir: 'right',
        target: { level: '8-4-end', x: 3, y: 10, exitDir: 'up' },
      }),
    );
  });
  it('8-4 end: Bowser with hammers and fire, the axe, the princess and the end of the game', () => {
    const l = load('8-4-end');
    expect(l.entities).toContainEqual({ type: 'bowser', x: 40, y: 9, props: { attack: 'both' } });
    expect(l.entities).toContainEqual({ type: 'axe', x: 45, y: 8 });
    expect(l.entities).toContainEqual({ type: 'princess', x: 57, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 56, next: 'end' });
    expect(l.zones).toContainEqual(
      expect.objectContaining({
        kind: 'pipe',
        x: 10,
        y: 11,
        target: { level: '8-4', x: 19, y: 10, exitDir: 'up' },
      }),
    );
  });
});
