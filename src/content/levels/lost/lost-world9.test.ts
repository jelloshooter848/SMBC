import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels World 9 (a short bonus world: 9-4 ends the game). Every value below was checked
// against levelDataLostLevels.xml on normal difficulty (classic-hero tokens only).
const dir = join(import.meta.dirname, 'world9');
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

describe('Lost Levels World 9 files', () => {
  it('has exactly the six areas of 9-1 to 9-4', () => {
    expect(readdirSync(dir).sort()).toEqual([
      'll-9-1-start.map',
      'll-9-1.map',
      'll-9-2.map',
      'll-9-3-sky.map',
      'll-9-3.map',
      'll-9-4.map',
    ]);
  });

  it('every pipe, vine and pit target and every exit stays inside World 9 (9-4 ends the game)', () => {
    const ids = readdirSync(dir).map((f) => f.replace(/\.map$/, ''));
    for (const id of ids) {
      const l = load(id);
      for (const z of l.zones) {
        if (z.kind === 'pipe' || z.kind === 'vine' || z.kind === 'pit') expect(ids).toContain(z.target.level);
        if (z.kind === 'exit') expect([...ids, 'end']).toContain(z.next);
      }
    }
    expect(['ll-9-1', 'll-9-2', 'll-9-3', 'll-9-4'].map((id) => exitOf(load(id))?.next)).toEqual([
      'll-9-2',
      'll-9-3',
      'll-9-4',
      'end',
    ]);
  });
});

describe('Lost Levels World 9 rules', () => {
  it('has no checkpoints (every level is LOCKED_CP) and keeps the area-type themes', () => {
    const themes: Record<string, string> = {};
    for (const f of readdirSync(dir)) {
      const l = load(f.replace(/\.map$/, ''));
      expect(zones(l, 'checkpoint')).toEqual([]);
      themes[l.id] = l.theme;
    }
    // The Lost Levels theme table: World 9's water areas are flooded overworld (9-4 in gray),
    // 9-3 a castle under the daylight sky, its coin heaven gray (our snow palette).
    expect(themes).toEqual({
      'll-9-1-start': 'overworld',
      'll-9-1': 'overworld-water',
      'll-9-2': 'overworld-water',
      'll-9-3': 'castle-overworld',
      'll-9-3-sky': 'snow',
      'll-9-4': 'water-gray',
    });
    // Each keeps its area type's music: water, castle, and the overworld tune in the sky.
    expect(load('ll-9-1').music).toBe('water');
    expect(load('ll-9-2').music).toBe('water');
    expect(load('ll-9-3').music).toBe('castle');
    expect(load('ll-9-3-sky').music).toBe('overworld');
    expect(load('ll-9-4').music).toBe('water');
  });
});

describe('Lost Levels 9-1', () => {
  it('starts in a short overworld room whose pipe at 23 drops into the flooded main area', () => {
    const l = load('ll-9-1-start');
    expect(l.width).toBe(32);
    expect(l.theme).toBe('overworld');
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(tile(l, 23, 9)).toBe(T.PIPE_TL);
    expect(where(l, 'piranha')).toEqual(['23,9']);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 23,
      y: 9,
      dir: 'down',
      target: { level: 'll-9-1', x: 1, y: 3, exitDir: 'none' },
    });
  });

  it('is a 184-wide water level with Lakitu, paratroopas, a chasing Hammer Bro and Buzzy Beetles', () => {
    const l = load('ll-9-1');
    expect(l.width).toBe(184);
    expect(l.theme).toBe('overworld-water');
    expect(l.music).toBe('water');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 1, y: 3 });
    expect(l.startMode).toBe('fall');
    // lakituEndMiddle at 150: this Lakitu flies at mid-screen.
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 86, y: 0, props: { end: 150, mid: 1 } });
    expect(where(l, 'koopa-para-red')).toEqual(['18,7', '36,7']);
    expect(where(l, 'koopa-para-green')).toEqual(['153,7', '156,4']);
    expect(where(l, 'koopa-para-green-h')).toEqual(['78,9', '83,9']);
    expect(where(l, 'koopa-green')).toEqual(['92,12', '93,12', '95,12']);
    expect(where(l, 'goomba')).toEqual(['102,12', '103,12']);
    expect(where(l, 'hammer-bro-chase')).toEqual(['124,12']);
    expect(where(l, 'buzzy')).toEqual(['142,12', '144,12']);
    expect(where(l, 'blooper')).toEqual(['130,10', '137,6']);
    expect(where(l, 'piranha')).toEqual(['3,11', '45,8', '68,9']);
    expect(where(l, 'lift-down')).toEqual(['33,5', '33,13']);
  });

  it('has two hanging pipes with upside-down piranhas, the flagpole at 166', () => {
    const l = load('ll-9-1');
    for (const [x, y] of [
      [40, 8],
      [54, 9],
    ] as const) {
      expect(tile(l, x, y)).toBe(T.PIPE_BOTTOM_L);
      expect(tile(l, x + 1, y)).toBe(T.PIPE_BOTTOM_R);
      expect(tile(l, x, y - 1)).toBe(T.PIPE_BL);
    }
    expect(where(l, 'piranha-down')).toEqual(['40,8', '54,9']);
    for (let y = 3; y <= 11; y++) expect(tile(l, 166, y)).toBe(T.FLAG_SHAFT);
    expect(tile(l, 166, 12)).toBe(T.HARD);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 166, next: 'll-9-2' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 170, y: 12 });
  });

  // XML 9-1 area b cell 166,2 and 9-2 area a cell 152,2 are "flagPoleTop()wavesDay": the ball wins.
  it('keeps the flagpole balls of 9-1 (166,2) and 9-2 (152,2) above the water line', () => {
    expect(tile(load('ll-9-1'), 166, 2)).toBe(T.FLAG_BALL);
    expect(tile(load('ll-9-2'), 152, 2)).toBe(T.FLAG_BALL);
  });
});

describe('Lost Levels 9-2', () => {
  it('is a 168-wide water level of pipes: six upright and six hanging piranhas, Lakitu to 78', () => {
    const l = load('ll-9-2');
    expect(l.width).toBe(168);
    expect(l.theme).toBe('overworld-water');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(where(l, 'piranha')).toEqual(['13,9', '65,7', '74,10', '86,11', '92,7', '109,3']);
    expect(where(l, 'piranha-down')).toEqual(['22,5', '33,8', '43,6', '61,4', '71,5', '101,7']);
    for (const e of l.entities.filter((e) => e.type === 'piranha-down')) {
      expect(tile(l, e.x, e.y)).toBe(T.PIPE_BOTTOM_L);
      expect(tile(l, e.x + 1, e.y)).toBe(T.PIPE_BOTTOM_R);
    }
    for (const e of l.entities.filter((e) => e.type === 'piranha')) expect(tile(l, e.x, e.y)).toBe(T.PIPE_TL);
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 16, y: 0, props: { end: 78, mid: 1 } });
    for (let y = 3; y <= 11; y++) expect(tile(l, 152, y)).toBe(T.FLAG_SHAFT);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 152, next: 'll-9-3' });
  });
});

describe('Lost Levels 9-3', () => {
  it('is a 232-wide castle-tiled stage with a spring, a hammer-throwing Bowser and no axe', () => {
    const l = load('ll-9-3');
    expect(l.width).toBe(232);
    expect(l.theme).toBe('castle-overworld');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    // enemyBowserFake: a plain fight, not a bridge boss.
    expect(l.entities).toContainEqual({ type: 'bowser', x: 183, y: 8, props: { attack: 'hammer', fake: 1 } });
    expect(where(l, 'axe')).toEqual([]);
    expect(where(l, 'spring')).toEqual(['66,12']);
    expect(where(l, 'firebar-ccw')).toEqual([]);
    expect(where(l, 'podoboo')).toEqual([]);
    expect(tile(l, 120, 12)).toBe(T.LAVA);
  });

  it('has a vine brick at 82 and a pipe at 148, both leading to the coin heaven', () => {
    const l = load('ll-9-3');
    expect(tile(l, 82, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 82,
      y: 5,
      target: { level: 'll-9-3-sky', x: 4, y: 14 },
    });
    expect(tile(l, 148, 9)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 148,
      y: 9,
      dir: 'down',
      target: { level: 'll-9-3-sky', x: 1, y: 12, exitDir: 'none' },
    });
  });

  it('ends at the flagpole at 214 and goes on to 9-4', () => {
    const l = load('ll-9-3');
    expect(tile(l, 214, 2)).toBe(T.FLAG_BALL);
    for (let y = 3; y <= 11; y++) expect(tile(l, 214, y)).toBe(T.FLAG_SHAFT);
    // Castle-type area with a flagpole: the clear walk ends at the castle door (219 - 6).
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 213, next: 'll-9-4' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 217, y: 12 });
  });

  it('coin heaven: climb in at 4,14, fall off back into 9-3 at column 98', () => {
    const l = load('ll-9-3-sky');
    expect(l.width).toBe(80);
    expect(l.parent).toBe('ll-9-3');
    expect(l.start).toEqual({ x: 4, y: 14 });
    expect(l.startMode).toBe('climb');
    // Its floor is the gray coin heaven's cloud blocks (TG_COIN_HEAVEN_GRAY), not ground.
    expect(tile(l, 1, 13)).toBe(T.CLOUD_BLOCK);
    expect(l.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-9-3', x: 98, y: 0 } });
  });
});

describe('Lost Levels 9-4', () => {
  it('is a short 128-wide water stage that ends the game at the flagpole at 113', () => {
    const l = load('ll-9-4');
    expect(l.width).toBe(128);
    expect(l.theme).toBe('water-gray');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(where(l, 'goomba')).toEqual(['19,12']);
    expect(where(l, 'koopa-green')).toEqual(['23,12']);
    expect(where(l, 'buzzy')).toEqual(['27,12']);
    expect(where(l, 'koopa-para-green')).toEqual(['34,12']);
    expect(where(l, 'hammer-bro-chase')).toEqual(['39,11']);
    expect(where(l, 'blooper')).toEqual(['53,8']);
    expect(where(l, 'koopa-para-red')).toEqual(['66,8']);
    expect(where(l, 'podoboo')).toEqual(['73,11']);
    expect(tile(l, 113, 2)).toBe(T.FLAG_BALL);
    expect(tile(l, 113, 12)).toBe(T.HARD);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 113, next: 'end' });
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 115, y: 12 });
  });
});
