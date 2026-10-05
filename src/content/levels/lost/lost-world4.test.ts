import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels World 4, checked against tools/levelgen/source/levelDataLostLevels.xml (normal
// difficulty). Positions are XML columns/rows; piranhas sit on the pipe's top-left tile (the
// token is one row above it in the XML).

const load = (id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'world4', `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const count = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type).length;
/** Positions of one entity type, sorted by column then row (grid markers and entity lines mixed). */
const at = (l: LevelData, type: string) =>
  l.entities
    .filter((e) => e.type === type)
    .map((e) => [e.x, e.y])
    .sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
const pipes = (l: LevelData) => l.zones.filter((z): z is Zone & { kind: 'pipe' } => z.kind === 'pipe');

describe('Lost Levels 4-1', () => {
  const l = load('ll-4-1');
  it('is a 216-wide overworld with a 400 timer, starting on the ground at 2,12', () => {
    expect(l.width).toBe(216);
    expect(l.theme).toBe('overworld');
    expect(l.music).toBe('overworld');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(l.startMode).toBe('stand');
  });
  it('has two Lakitus (19 to 50, 92 to 180), ten piranhas, a goomba and a springboard', () => {
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 19, y: 0, props: { end: 50 } });
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 92, y: 0, props: { end: 180 } });
    expect(count(l, 'lakitu')).toBe(2);
    expect(at(l, 'piranha')).toEqual([
      [26, 11],
      [31, 13],
      [53, 9],
      [126, 8],
      [152, 6],
      [154, 6],
      [156, 6],
      [163, 11],
      [171, 10],
      [176, 9],
    ]);
    expect(at(l, 'goomba')).toEqual([[189, 4]]);
    expect(at(l, 'spring')).toEqual([[74, 11]]);
  });
  it('has a poison ? block at 124,9, a 10-coin brick, a hidden 1-up and the vine brick at 170,5', () => {
    expect(tile(l, 124, 9)).toBe(T.Q_POISON);
    expect(tile(l, 35, 9)).toBe(T.BRICK_COINS10);
    expect(tile(l, 107, 9)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 68, 10)).toBe(T.Q_POWERUP);
    expect(tile(l, 170, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 170,
      y: 5,
      target: { level: 'll-4-1-sky', x: 4, y: 14 },
    });
  });
  it('the middle of three pipes at 152 leads underwater; the water exit comes back up at 163', () => {
    expect(tile(l, 152, 6)).toBe(T.PIPE_TL);
    expect(pipes(l)).toEqual([
      {
        kind: 'pipe',
        x: 152,
        y: 6,
        dir: 'down',
        target: { level: 'll-4-1-water', x: 1, y: 1, exitDir: 'none' },
      },
    ]);
    const w = load('ll-4-1-water');
    expect(w.width).toBe(80);
    expect(w.theme).toBe('water');
    expect(w.parent).toBe('ll-4-1');
    expect(w.time).toBeNull();
    expect(w.startMode).toBe('fall');
    expect(at(w, 'blooper')).toEqual([
      [39, 5],
      [45, 9],
      [66, 7],
    ]);
    expect(at(w, 'buzzy')).toEqual([
      [37, 12],
      [46, 9],
    ]);
    expect(pipes(w)).toEqual([
      { kind: 'pipe', x: 77, y: 8, dir: 'right', target: { level: 'll-4-1', x: 163, y: 10, exitDir: 'up' } },
    ]);
    expect(tile(l, 163, 11)).toBe(T.PIPE_TL);
  });
  it('the coin heaven has a rightward lift and drops back into 4-1 at column 98', () => {
    const s = load('ll-4-1-sky');
    expect(s.width).toBe(120);
    expect(s.startMode).toBe('climb');
    expect(s.start).toEqual({ x: 4, y: 14 });
    expect(s.entities).toContainEqual({ type: 'lift-right', x: 17, y: 10, props: { len: 6 } });
    expect(s.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-4-1', x: 98, y: 0 } });
    expect(tile(l, 98, 13)).toBe(T.GROUND);
  });
  it('ends at the flagpole at 199 with the small castle and goes on to 4-2', () => {
    expect(tile(l, 199, 2)).toBe(T.FLAG_BALL);
    expect(tile(l, 199, 12)).toBe(T.HARD);
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 204, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 200, next: 'll-4-2' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 114 });
  });
});

describe('Lost Levels 4-2', () => {
  const l = load('ll-4-2');
  it('is a 224-wide overworld with Lakitu from 62 to 111', () => {
    expect(l.width).toBe(224);
    expect(l.theme).toBe('overworld');
    expect(l.time).toBe(400);
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 62, y: 0, props: { end: 111 } });
  });
  it('has two Hammer Bros, beetles, koopas, a gliding paratroopa and a springboard', () => {
    expect(at(l, 'hammer-bro')).toEqual([
      [151, 12],
      [174, 7],
    ]);
    expect(count(l, 'hammer-bro-chase')).toBe(0);
    expect(at(l, 'buzzy')).toEqual([
      [41, 12],
      [42, 12],
    ]);
    expect(count(l, 'goomba')).toBe(2);
    expect(count(l, 'koopa-green')).toBe(6);
    expect(at(l, 'koopa-red')).toEqual([
      [65, 4],
      [140, 12],
    ]);
    expect(l.entities).toContainEqual({ type: 'koopa-para-green-h', x: 194, y: 3 });
    expect(at(l, 'spring')).toEqual([[56, 12]]);
  });
  it('has seven blaster barrels, a star brick and a poison ? block', () => {
    expect(Array.from(l.tiles).filter((t) => t === T.BLASTER_TOP)).toHaveLength(7);
    for (const [x, y] of [
      [25, 8],
      [17, 9],
      [22, 10],
      [17, 11],
      [123, 11],
      [22, 12],
      [131, 12],
    ] as const)
      expect(tile(l, x, y)).toBe(T.BLASTER_TOP);
    expect(tile(l, 29, 10)).toBe(T.BRICK_STAR);
    expect(tile(l, 131, 9)).toBe(T.Q_POISON);
    expect(tile(l, 142, 11)).toBe(T.BRICK_COINS10);
  });
  it('the ground-level pipe at 172 leads to a bonus room that comes out of the pipe at 179', () => {
    expect(at(l, 'piranha')).toEqual([
      [117, 8],
      [172, 13],
      [174, 13],
      [179, 11],
    ]);
    expect(tile(l, 172, 13)).toBe(T.PIPE_TL);
    expect(pipes(l)).toEqual([
      {
        kind: 'pipe',
        x: 172,
        y: 13,
        dir: 'down',
        target: { level: 'll-4-2-bonus', x: 1, y: 0, exitDir: 'none' },
      },
    ]);
    const b = load('ll-4-2-bonus');
    expect(b.width).toBe(16);
    expect(b.theme).toBe('underground');
    expect(b.camera).toBe('locked');
    expect(tile(b, 1, 9)).toBe(T.HIDDEN_POISON);
    expect(tile(b, 3, 2)).toBe(T.BRICK_POWERUP);
    expect(pipes(b)).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-4-2', x: 179, y: 10, exitDir: 'up' } },
    ]);
  });
  it('ends at the flagpole at 206 and goes on to 4-3', () => {
    expect(tile(l, 206, 2)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 206, next: 'll-4-3' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 210, y: 12 });
  });
});

describe('Lost Levels 4-3', () => {
  const l = load('ll-4-3');
  it('is a 200-wide giant mushroom level', () => {
    expect(l.width).toBe(200);
    expect(l.theme).toBe('overworld');
    expect(tile(l, 61, 9)).toBe(T.MUSHROOM_TOP);
    expect(tile(l, 62, 10)).toBe(T.MUSHROOM_STEM);
  });
  it('has two balance lifts, three falling and three swaying lifts', () => {
    expect(l.entities.filter((e) => e.type === 'balance')).toEqual([
      { type: 'balance', x: 44, y: 5, props: { x2: 50, y2: 9, len: 6, top: 2 } },
      { type: 'balance', x: 118, y: 6, props: { x2: 123, y2: 9, len: 6, top: 2 } },
    ]);
    expect(at(l, 'lift-fall')).toEqual([
      [31, 6],
      [113, 8],
      [145, 4],
    ]);
    expect(at(l, 'lift-h')).toEqual([
      [38, 7],
      [56, 6],
      [90, 13],
    ]);
  });
  it('has four red paratroopas, a red koopa, two springboards and Bullet Bills from 108 to 157', () => {
    expect(at(l, 'koopa-para-red')).toEqual([
      [60, 7],
      [74, 7],
      [162, 8],
      [166, 9],
    ]);
    expect(at(l, 'koopa-red')).toEqual([[141, 12]]);
    expect(at(l, 'spring')).toEqual([
      [26, 12],
      [83, 12],
    ]);
    expect(l.zones).toContainEqual({ kind: 'bullets', x: 108, w: 49 });
    expect(tile(l, 90, 9)).toBe(T.Q_POWERUP);
  });
  it('ends at the flagpole at 185 by the big castle and goes on to 4-4', () => {
    expect(tile(l, 185, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 188, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 186, next: 'll-4-4' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 98 });
  });
});

describe('Lost Levels 4-4', () => {
  const l = load('ll-4-4');
  it('is a 224-wide castle with a 300 timer and no maze', () => {
    expect(l.width).toBe(224);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([]);
  });
  it('has nine fire bars (two long), three lifts, a Podoboo and two piranhas', () => {
    expect(at(l, 'firebar')).toEqual([
      [39, 9],
      [59, 11],
      [100, 9],
      [128, 9],
    ]);
    expect(l.entities).toContainEqual({ type: 'firebar-ccw', x: 20, y: 9, props: { len: 12 } });
    expect(l.entities).toContainEqual({ type: 'firebar-ccw', x: 53, y: 7, props: { len: 12 } });
    expect(count(l, 'firebar-ccw')).toBe(5);
    expect(l.entities).toContainEqual({ type: 'lift-v', x: 61, y: 10, props: { len: 4, range: 6 } });
    expect(l.entities).toContainEqual({ type: 'lift-fall', x: 92, y: 6, props: { len: 4 } });
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 172, y: 12, props: { len: 4, range: 3 } });
    expect(at(l, 'podoboo')).toEqual([[188, 12]]);
    expect(at(l, 'piranha')).toEqual([
      [124, 6],
      [164, 12],
    ]);
  });
  it('has goombas, koopas and a Hammer Bro inside the castle', () => {
    expect(count(l, 'goomba')).toBe(4);
    expect(count(l, 'koopa-green')).toBe(6);
    expect(at(l, 'koopa-red')).toEqual([[22, 8]]);
    expect(at(l, 'hammer-bro')).toEqual([[109, 12]]);
    expect(tile(l, 143, 5)).toBe(T.HIDDEN_POWERUP);
  });
  it('ends with fire-only Bowser on the bridge, the axe and the exit to 5-1', () => {
    expect(l.entities).toContainEqual({ type: 'bowser', x: 199, y: 9 });
    expect(l.entities).toContainEqual({ type: 'axe', x: 205, y: 8 });
    for (let x = 192; x <= 204; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 216, next: 'll-5-1' });
  });
});
