import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { worldLabel } from '@game/hud/world-label';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels World B (stored as World 11; the HUD shows "B"). Every value below was checked
// against levelDataLostLevels.xml on normal difficulty (classic-hero tokens only).
const dir = join(import.meta.dirname, 'world11');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
/** Positions of one entity type as sorted "x,y" strings. */
const where = (l: LevelData, type: string) =>
  l.entities
    .filter((e) => e.type === type)
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((e) => `${e.x},${e.y}`);
const zones = <K extends Zone['kind']>(l: LevelData, kind: K) =>
  l.zones.filter((z): z is Zone & { kind: K } => z.kind === kind);
const exitOf = (l: LevelData) => zones(l, 'exit')[0];

describe('Lost Levels World B files', () => {
  it('has the eight areas of B-1 to B-4', () => {
    expect(readdirSync(dir).sort()).toEqual([
      'll-11-1-sky.map',
      'll-11-1.map',
      'll-11-2-exit.map',
      'll-11-2-intro.map',
      'll-11-2.map',
      'll-11-3.map',
      'll-11-4-exit.map',
      'll-11-4.map',
    ]);
    expect(worldLabel(11)).toBe('B');
  });

  it('every target resolves inside World B or is the exit to C-1 or the warp to D-1', () => {
    const ids = readdirSync(dir).map((f) => f.replace(/\.map$/, ''));
    const outside = new Set<string>();
    for (const id of ids) {
      for (const z of load(id).zones) {
        const target = z.kind === 'pipe' || z.kind === 'vine' || z.kind === 'pit' ? z.target.level : null;
        const next = z.kind === 'exit' ? z.next : null;
        for (const t of [target, next]) if (t && !ids.includes(t)) outside.add(t);
      }
    }
    expect([...outside].sort()).toEqual(['ll-12-1', 'll-13-1']);
    expect(['ll-11-1', 'll-11-2-exit', 'll-11-3', 'll-11-4'].map((id) => exitOf(load(id))?.next)).toEqual([
      'll-11-2-intro',
      'll-11-3',
      'll-11-4',
      'll-12-1',
    ]);
  });
});

describe('Lost Levels World B rules', () => {
  it('has no checkpoints (every level is LOCKED_CP), locked 16-wide bonus rooms and area-type themes', () => {
    const themes: Record<string, string> = {};
    for (const f of readdirSync(dir)) {
      const l = load(f.replace(/\.map$/, ''));
      expect(zones(l, 'checkpoint')).toEqual([]);
      if (l.id.endsWith('-bonus')) expect([l.width, l.camera]).toEqual([16, 'locked']);
      themes[l.id] = l.theme;
    }
    // World B has no night/snow entry in the Lost Levels theme table.
    expect(themes).toEqual({
      'll-11-1': 'overworld',
      'll-11-1-sky': 'overworld',
      'll-11-2': 'water',
      'll-11-2-exit': 'overworld',
      'll-11-2-intro': 'overworld',
      'll-11-3': 'overworld',
      'll-11-4': 'castle',
      'll-11-4-exit': 'overworld',
    });
  });
});

describe('Lost Levels B-1', () => {
  it('is 216 wide with a green springboard at 129 and a poison ? block at 151', () => {
    const l = load('ll-11-1');
    expect(l.width).toBe(216);
    expect(l.theme).toBe('overworld');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(where(l, 'spring-green')).toEqual(['129,12']);
    expect(where(l, 'spring')).toEqual([]);
    expect(tile(l, 151, 5)).toBe(T.Q_POISON);
    expect(tile(l, 134, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 70, 8)).toBe(T.Q_POWERUP);
    expect(tile(l, 35, 9)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 121, 5)).toBe(T.BRICK_STAR);
    expect(tile(l, 52, 9)).toBe(T.BRICK_COINS10);
  });

  it('has the enemies of the original on the classic-hero layout', () => {
    const l = load('ll-11-1');
    expect(where(l, 'goomba')).toEqual(['20,12', '21,12', '113,12', '114,12', '167,4', '168,4', '188,6']);
    expect(where(l, 'koopa-green')).toEqual([
      '38,7',
      '94,12',
      '97,12',
      '98,12',
      '111,12',
      '148,12',
      '151,7',
      '157,9',
    ]);
    expect(where(l, 'koopa-para-green')).toEqual(['71,10', '74,12', '124,12', '166,12', '171,8']);
    expect(where(l, 'koopa-para-green-h')).toEqual(['179,7']);
    expect(where(l, 'piranha')).toEqual([
      '32,10',
      '37,8',
      '57,8',
      '87,10',
      '102,7',
      '141,9',
      '172,9',
      '181,9',
    ]);
    // The pipe at 172 is the classic hero's; the helper pipe at 175 and its ground are left out.
    expect(tile(l, 172, 9)).toBe(T.PIPE_TL);
    expect(tile(l, 175, 9)).toBe(T.AIR);
  });

  it('has a vine to the coin heaven and the flagpole at 199', () => {
    const l = load('ll-11-1');
    expect(tile(l, 89, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 89,
      y: 5,
      target: { level: 'll-11-1-sky', x: 4, y: 14 },
    });
    const sky = load('ll-11-1-sky');
    expect(sky.startMode).toBe('climb');
    expect(sky.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-11-1', x: 114, y: 0 } });
    expect(tile(l, 199, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 199, next: 'll-11-2-intro' });
  });
});

describe('Lost Levels B-2', () => {
  it('walks into the intro pipe and swims a 176-wide sea of cheeps and Bloopers', () => {
    const intro = load('ll-11-2-intro');
    expect(intro.zones).toContainEqual({
      kind: 'pipe',
      x: 10,
      y: 12,
      dir: 'right',
      target: { level: 'll-11-2', x: 2, y: 1, exitDir: 'none' },
    });
    const l = load('ll-11-2');
    expect(l.width).toBe(176);
    expect(l.theme).toBe('water');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 1 });
    expect(where(l, 'cheep-grey')).toHaveLength(12);
    expect(where(l, 'cheep-red')).toEqual(['41,10', '56,11', '63,4', '90,5', '96,5', '120,8', '147,8']);
    expect(where(l, 'blooper')).toEqual(['34,7', '54,7', '70,6', '105,8', '119,6', '164,7']);
    expect(where(l, 'koopa-para-green')).toEqual(['47,4']);
    expect(where(l, 'koopa-para-green-h')).toEqual(['96,7']);
    expect(where(l, 'koopa-para-red')).toEqual(['171,6']);
    expect(where(l, 'koopa-green')).toEqual(['60,12', '108,12']);
    expect(l.entities).toContainEqual({ type: 'firebar-ccw', x: 151, y: 7, props: { len: 12 } });
    expect(where(l, 'lift-up')).toEqual(['126,3', '126,9']);
  });

  it('leaves the water through the side pipe at 173 to the flagpole area', () => {
    const l = load('ll-11-2');
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 173,
      y: 8,
      dir: 'right',
      target: { level: 'll-11-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    const exit = load('ll-11-2-exit');
    expect(exit.startMode).toBe('pipe-exit');
    expect(tile(exit, 3, 11)).toBe(T.PIPE_TL);
    expect(exitOf(exit)).toEqual({ kind: 'exit', x: 28, next: 'll-11-3' });
  });
});

describe('Lost Levels B-3', () => {
  it('is 216 wide on a 300 clock with three green springboards and Bullet Bills from 137 to 181', () => {
    const l = load('ll-11-3');
    expect(l.width).toBe(216);
    expect(l.theme).toBe('overworld');
    expect(l.time).toBe(300);
    expect(where(l, 'spring-green')).toEqual(['66,12', '101,12', '135,12']);
    expect(l.zones).toContainEqual({ kind: 'bullets', x: 137, w: 44 });
    expect(where(l, 'koopa-para-red')).toEqual(['24,9', '29,8', '75,9']);
    expect(where(l, 'koopa-para-green-h')).toEqual(['80,10', '166,3']);
    expect(where(l, 'koopa-red')).toEqual(['190,4']);
    expect(where(l, 'piranha')).toEqual(['92,9', '97,5']);
    expect(tile(l, 45, 3)).toBe(T.Q_POWERUP);
    expect(tile(l, 124, 8)).toBe(T.BRICK_POWERUP);
  });

  it('has two balance lifts, falling, sliding and rising lifts on the platforms', () => {
    const l = load('ll-11-3');
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 27,
      y: 7,
      props: { x2: 31, y2: 10, len: 4, top: 2 },
    });
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 140,
      y: 5,
      props: { x2: 145, y2: 9, len: 4, top: 2 },
    });
    expect(where(l, 'lift-fall')).toEqual(['36,5', '52,5']);
    expect(where(l, 'lift-h')).toEqual(['44,6', '107,5', '124,13', '150,5']);
    expect(where(l, 'lift-v')).toEqual(['56,8']);
    // Platform tops (treetops; the original's art is per-world, the shape here has wide trunks).
    expect(tile(l, 16, 9)).toBe(T.TREE_TOP);
    expect(tile(l, 17, 10)).toBe(T.TREE_TRUNK);
  });

  it('has the flagpole at 200', () => {
    const l = load('ll-11-3');
    expect(tile(l, 200, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 201, next: 'll-11-4' });
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 203, y: 12 });
  });
});

describe('Lost Levels B-4', () => {
  it('is a 256-wide castle with six fire bars, a hammer-throwing Bowser and the axe at 237', () => {
    const l = load('ll-11-4');
    expect(l.width).toBe(256);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(where(l, 'firebar')).toEqual(['35,8', '81,8', '113,8', '145,8', '177,8', '203,9']);
    expect(where(l, 'firebar-ccw')).toEqual(['45,9']);
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 66, y: 10, props: { len: 4, range: 3 } });
    expect(tile(l, 34, 10)).toBe(T.BRICK_POWERUP);
    expect(l.entities).toContainEqual({ type: 'bowser', x: 231, y: 9, props: { attack: 'hammer' } });
    expect(where(l, 'axe')).toEqual(['237,8']);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 248, next: 'll-12-1' });
  });

  it('three of its four piranha pipes lead back to the start pipe; the one at 193 leads to the warp room', () => {
    const l = load('ll-11-4');
    expect(where(l, 'piranha')).toEqual(['19,11', '97,10', '129,10', '161,10', '193,10']);
    expect(tile(l, 19, 11)).toBe(T.PIPE_TL);
    const pipes = zones(l, 'pipe').map((z) => [
      z.x,
      z.target.level,
      z.target.x,
      z.target.y,
      z.target.exitDir,
    ]);
    expect(pipes).toEqual([
      [97, 'll-11-4', 19, 10, 'up'],
      [129, 'll-11-4', 19, 10, 'up'],
      [161, 'll-11-4', 19, 10, 'up'],
      [193, 'll-11-4-exit', 3, 10, 'up'],
    ]);
  });

  it('the warp room after 193 holds the pipe to D-1', () => {
    const l = load('ll-11-4-exit');
    expect(l.width).toBe(32);
    expect(l.parent).toBe('ll-11-4');
    expect(l.startMode).toBe('pipe-exit');
    expect(l.start).toEqual({ x: 3, y: 10 });
    expect(where(l, 'piranha')).toEqual(['3,11']);
    expect(tile(l, 22, 10)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 22,
      y: 10,
      dir: 'down',
      target: { level: 'll-13-1', x: 2, y: 12 },
    });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'warp', x: 16, w: 16, worlds: [13] }));
    expect(worldLabel(13)).toBe('D');
  });
});
