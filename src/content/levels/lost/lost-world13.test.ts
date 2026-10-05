import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { worldLabel } from '@game/hud/world-label';
import type { LevelData } from '@game/level/schema';

// The Lost Levels World D (stored as world 13), the last world. Values checked against
// levelDataLostLevels.xml (normal difficulty, classic-hero layer).
const dir = join(import.meta.dirname, 'world13');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
/** Entities of one type, left to right (grid markers and entity lines together). */
const of = (l: LevelData, type: string) =>
  l.entities.filter((e) => e.type === type).sort((a, b) => a.x - b.x || a.y - b.y);
const at = (l: LevelData, type: string) => of(l, type).map((e) => [e.x, e.y]);

describe('Lost Levels World D (13): every area', () => {
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.map'))
    .map((f) => f.slice(0, -4))
    .sort();
  it('has the expected areas, each parsing to 15 rows', () => {
    expect(ids).toEqual([
      'll-13-1',
      'll-13-1-bonus',
      'll-13-2',
      'll-13-2-bonus',
      'll-13-2-sky',
      'll-13-3',
      'll-13-4',
      'll-13-4-bonus',
      'll-13-4-end',
      'll-13-4-exit',
    ]);
    for (const id of ids) {
      const l = load(id);
      expect(l.height).toBe(15);
      expect(l.world).toBe(13);
    }
    expect(worldLabel(13)).toBe('D');
  });

  it('uses the original theme table: snow for the normal stages, but D-4 outdoors is plain overworld', () => {
    // GameSuperMarioBros.as (Lost Levels pack): world 13 normal -> snow, "13-4b" -> overworld.
    const themes = Object.fromEntries(ids.map((id) => [id, load(id).theme]));
    expect(themes).toEqual({
      'll-13-1': 'snow',
      'll-13-1-bonus': 'underground',
      'll-13-2': 'snow',
      'll-13-2-bonus': 'underground',
      'll-13-2-sky': 'overworld',
      'll-13-3': 'snow',
      'll-13-4': 'castle',
      'll-13-4-bonus': 'underground',
      'll-13-4-end': 'castle',
      'll-13-4-exit': 'overworld',
    });
    for (const id of ['ll-13-1', 'll-13-2', 'll-13-3']) expect(load(id).music).toBe('overworld');
  });

  it('has no checkpoints: every World D level is LOCKED_CP', () => {
    for (const id of ids) expect(load(id).zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
  });

  it('only bonus rooms wider than one screen scroll', () => {
    expect(load('ll-13-1-bonus').camera).toBe('locked');
    expect(load('ll-13-2-bonus').camera).toBe('locked');
    expect(load('ll-13-4-bonus').camera).toBe('scroll');
  });

  it('chains D-1 to D-3 by flagpoles; D-4 runs through four areas and ends the game', () => {
    const next = (id: string) => (load(id).zones.find((z) => z.kind === 'exit') as { next: string }).next;
    expect(['ll-13-1', 'll-13-2', 'll-13-3'].map(next)).toEqual(['ll-13-2', 'll-13-3', 'll-13-4']);
    // Only the last area of D-4 has an exit; the others are left through pipes.
    expect(
      ['ll-13-4', 'll-13-4-exit', 'll-13-4-bonus'].map((id) => load(id).zones.some((z) => z.kind === 'exit')),
    ).toEqual([false, false, false]);
    expect(next('ll-13-4-end')).toBe('end');
  });

  it('every pipe, vine and pit leads to an area of this world', () => {
    for (const id of ids) {
      for (const z of load(id).zones) {
        if (z.kind === 'pipe' || z.kind === 'vine' || z.kind === 'pit') expect(ids).toContain(z.target.level);
      }
    }
  });
});

describe('D-1 (ll-13-1): chasing Hammer Bros, Buzzy Beetles and poison bricks', () => {
  const l = load('ll-13-1');
  it('is a 216-wide overworld stage', () => {
    expect(l.width).toBe(216);
    expect(l.theme).toBe('snow');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
  });
  it('has four chasing Hammer Bros and no plain ones', () => {
    expect(at(l, 'hammer-bro-chase')).toEqual([
      [24, 8],
      [25, 12],
      [143, 8],
      [150, 12],
    ]);
    expect(of(l, 'hammer-bro')).toHaveLength(0);
    expect(tile(l, 24, 9)).toBe(T.BRICK);
    expect(tile(l, 143, 9)).toBe(T.HARD);
  });
  it('has the ground enemies, a springboard and the piranhas (three hanging)', () => {
    expect(at(l, 'buzzy')).toEqual([
      [73, 12],
      [97, 12],
      [99, 12],
    ]);
    expect(at(l, 'koopa-green')).toEqual([
      [74, 12],
      [75, 12],
    ]);
    expect(at(l, 'goomba')).toEqual([
      [85, 12],
      [86, 12],
      [88, 12],
    ]);
    expect(at(l, 'spring')).toEqual([[14, 12]]);
    expect(of(l, 'piranha').map((e) => e.x)).toEqual([73, 105, 115, 130, 183]);
    expect(at(l, 'piranha-down')).toEqual([
      [88, 10],
      [164, 10],
      [173, 10],
    ]);
    for (const [x, y] of at(l, 'piranha-down'))
      expect(tile(l, x as number, y as number)).toBe(T.PIPE_BOTTOM_L);
  });
  it('has two poison bricks and a hidden 1-up', () => {
    expect(tile(l, 59, 6)).toBe(T.BRICK_POISON);
    expect(tile(l, 105, 5)).toBe(T.BRICK_POISON);
    expect(tile(l, 60, 2)).toBe(T.HIDDEN_1UP);
  });
  it('the pipe at 73 leads to the bonus room, which returns to the pipe at 115', () => {
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 73,
      y: 7,
      dir: 'down',
      target: { level: 'll-13-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    const b = load('ll-13-1-bonus');
    expect(b.width).toBe(16);
    expect(b.startMode).toBe('fall');
    expect(tile(b, 11, 10)).toBe(T.BRICK_POISON);
    expect(b.zones).toContainEqual({
      kind: 'pipe',
      x: 13,
      y: 12,
      dir: 'right',
      target: { level: 'll-13-1', x: 115, y: 10, exitDir: 'up' },
    });
    expect(tile(l, 115, 11)).toBe(T.PIPE_TL);
  });
  it('ends at the flagpole at 199', () => {
    expect(tile(l, 199, 2)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 199, next: 'll-13-2' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 203, y: 12 });
  });
});

describe('D-2 (ll-13-2): hanging piranhas, a high pipe and a vine', () => {
  const l = load('ll-13-2');
  it('is 192 wide', () => {
    expect(l.width).toBe(192);
    expect(l.theme).toBe('snow');
  });
  it('has six hanging and four upright piranhas', () => {
    expect(at(l, 'piranha-down')).toEqual([
      [59, 10],
      [73, 10],
      [78, 8],
      [82, 8],
      [86, 8],
      [118, 10],
    ]);
    expect(at(l, 'piranha')).toEqual([
      [118, 3],
      [131, 11],
      [141, 13],
      [149, 13],
    ]);
  });
  it('enters the bonus room from the top of the floating pipe at 118', () => {
    expect(tile(l, 118, 3)).toBe(T.PIPE_TL);
    expect(tile(l, 118, 10)).toBe(T.PIPE_BOTTOM_L);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 118,
      y: 3,
      dir: 'down',
      target: { level: 'll-13-2-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(load('ll-13-2-bonus').zones).toContainEqual({
      kind: 'pipe',
      x: 13,
      y: 12,
      dir: 'right',
      target: { level: 'll-13-2', x: 131, y: 10, exitDir: 'up' },
    });
  });
  it('has the vine at 147 to the coin heaven, which drops back at 114', () => {
    expect(tile(l, 147, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 147,
      y: 5,
      target: { level: 'll-13-2-sky', x: 4, y: 14 },
    });
    const s = load('ll-13-2-sky');
    expect(s.startMode).toBe('climb');
    expect(s.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-13-2', x: 114, y: 0 } });
    expect(tile(l, 114, 13)).toBe(T.GROUND);
  });
  it('has Koopas dropping in from the sky, paratroopas, a springboard and the exit at 177', () => {
    expect(at(l, 'koopa-green')).toEqual([
      [106, 8],
      [107, 8],
      [109, 8],
    ]);
    expect(at(l, 'koopa-red')).toEqual([[31, 4]]);
    expect(of(l, 'koopa-para-green')).toHaveLength(5);
    expect(at(l, 'koopa-para-red')).toEqual([
      [141, 8],
      [150, 8],
    ]);
    expect(at(l, 'spring')).toEqual([[164, 11]]);
    expect(tile(l, 106, 10)).toBe(T.BLASTER_TOP);
    expect(tile(l, 106, 12)).toBe(T.BLASTER_TOP);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 177, next: 'll-13-3' });
  });
});

describe('D-3 (ll-13-3): chasing Hammer Bros in front of castle walls', () => {
  const l = load('ll-13-3');
  it('is 232 wide', () => {
    expect(l.width).toBe(232);
    expect(l.theme).toBe('snow');
  });
  it('keeps the Hammer Bros that stand in front of the walls, with the wall tiles behind them', () => {
    expect(at(l, 'hammer-bro-chase')).toEqual([
      [58, 12],
      [65, 12],
      [90, 4],
      [93, 8],
      [144, 12],
      [175, 12],
      [184, 12],
    ]);
    for (const x of [58, 65, 144, 184]) {
      expect(tile(l, x, 12)).toBe(T.WALL);
      expect(tile(l, x, 13)).toBe(T.GROUND);
    }
    expect(tile(l, 49, 7)).toBe(T.WALL_TOP);
    expect(tile(l, 175, 12)).toBe(T.AIR);
  });
  it('has a 10-coin brick inside a wall, a mushroom brick, a red Koopa and a springboard', () => {
    expect(tile(l, 134, 10)).toBe(T.BRICK_COINS10);
    expect(tile(l, 28, 9)).toBe(T.BRICK_POWERUP);
    expect(at(l, 'koopa-red')).toEqual([[131, 4]]);
    expect(at(l, 'spring')).toEqual([[129, 12]]);
    expect(at(l, 'piranha')).toEqual([
      [39, 10],
      [147, 10],
    ]);
    expect(at(l, 'koopa-para-green')).toEqual([[195, 11]]);
  });
  it('ends at the big castle', () => {
    expect(tile(l, 217, 2)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 219, next: 'll-13-4' });
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 221, y: 12 });
  });
});

describe('D-4 (ll-13-4 ... ll-13-4-end): the last castle', () => {
  it('starts in a castle that is left through the pipe at 103', () => {
    const l = load('ll-13-4');
    expect(l.width).toBe(112);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 103,
      y: 9,
      dir: 'down',
      target: { level: 'll-13-4-exit', x: 3, y: 10, exitDir: 'up' },
    });
    expect(l.entities).toContainEqual({ type: 'firebar', x: 17, y: 9, props: { len: 12 } });
    expect(at(l, 'firebar-ccw')).toEqual([
      [25, 9],
      [37, 9],
    ]);
    expect(at(l, 'firebar')).toEqual([
      [17, 9],
      [75, 13],
    ]);
    expect(of(l, 'piranha').map((e) => e.x)).toEqual([3, 47, 59, 103]);
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 53, w: 6 });
    expect(l.entities).toContainEqual({ type: 'lift-fall', x: 64, y: 9, props: { len: 4 } });
    expect(tile(l, 26, 8)).toBe(T.HIDDEN_POWERUP);
    expect(of(l, 'bowser')).toHaveLength(0);
  });
  it('the outdoor stretch rises out of a pipe and leads to the bonus pipe at 85', () => {
    const l = load('ll-13-4-exit');
    expect(l.width).toBe(96);
    expect(l.theme).toBe('overworld');
    expect(l.parent).toBe('ll-13-4');
    expect(l.time).toBeNull();
    expect(l.startMode).toBe('pipe-exit');
    expect(l.start).toEqual({ x: 3, y: 10 });
    expect(tile(l, 3, 11)).toBe(T.PIPE_TL);
    expect(at(l, 'hammer-bro-chase')).toEqual([[16, 10]]);
    expect(l.entities).toContainEqual({ type: 'piranha', x: 16, y: 11, props: { red: 1 } });
    expect(at(l, 'blooper')).toEqual([
      [44, 11],
      [51, 5],
    ]);
    expect(tile(l, 60, 10)).toBe(T.HIDDEN_POISON);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 85,
      y: 6,
      dir: 'down',
      target: { level: 'll-13-4-bonus', x: 1, y: 0, exitDir: 'none' },
    });
  });
  it('the bonus room leads into the last castle area', () => {
    const l = load('ll-13-4-bonus');
    expect(l.theme).toBe('underground');
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 29,
      y: 12,
      dir: 'right',
      target: { level: 'll-13-4-end', x: 3, y: 10, exitDir: 'up' },
    });
  });
  it('the last area has a fake Bowser, a wrong pipe back to the start, the real Bowser, the axe and the princess', () => {
    const l = load('ll-13-4-end');
    expect(l.width).toBe(128);
    expect(l.theme).toBe('castle');
    expect(l.parent).toBe('ll-13-4');
    expect(l.startMode).toBe('pipe-exit');
    expect(l.start).toEqual({ x: 3, y: 10 });
    // Both Bowsers throw hammers on normal difficulty. The one at 20 is the XML's enemyBowserFake;
    // the real one stands on the bridge.
    expect(of(l, 'bowser')).toEqual([
      { type: 'bowser', x: 20, y: 9, props: { attack: 'hammer', fake: 1 } },
      { type: 'bowser', x: 103, y: 9, props: { attack: 'hammer' } },
    ]);
    for (let x = 96; x <= 108; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 108, 9)).toBe(T.CHAIN);
    expect(l.entities).toContainEqual({ type: 'axe', x: 109, y: 8 });
    expect(l.entities).toContainEqual({ type: 'firebar', x: 103, y: 6 });
    expect(l.entities).toContainEqual({ type: 'princess', x: 121, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 120, next: 'end' });
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 38,
      y: 11,
      dir: 'down',
      target: { level: 'll-13-4', x: 3, y: 10, exitDir: 'up' },
    });
    expect(tile(load('ll-13-4'), 3, 11)).toBe(T.PIPE_TL);
    expect(at(l, 'hammer-bro-chase')).toEqual([[59, 9]]);
    expect(of(l, 'blooper')).toHaveLength(3);
    expect(l.entities).toContainEqual({ type: 'lift-v', x: 69, y: 10, props: { len: 4, range: 6 } });
    for (let x = 16; x <= 31; x++) expect(tile(l, x, 5)).toBe(x === 27 ? T.Q_POWERUP : T.Q_COIN);
  });
});
