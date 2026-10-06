import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels, World 3, converted from levelDataLostLevels.xml (normal difficulty). Every value
// below was checked against the original XML tokens, not just copied from the generated maps.

const dir = join(import.meta.dirname, 'world3');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const ofType = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type);
const at = (l: LevelData, type: string) => ofType(l, type).map((e) => [e.x, e.y]);
const pipeAt = (l: LevelData, x: number) => l.zones.find((z) => z.kind === 'pipe' && z.x === x);
const exitOf = (l: LevelData) => l.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');

const AREAS = [
  'll-3-1',
  'll-3-1-bonus',
  'll-3-1-sky',
  'll-3-1-bonus2',
  'll-3-1-exit',
  'll-3-2-intro',
  'll-3-2',
  'll-3-2-exit',
  'll-3-3',
  'll-3-4',
];

describe('Lost Levels World 3: files', () => {
  it('has exactly the expected areas', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.map'));
    expect(files.map((f) => f.replace(/\.map$/, '')).sort()).toEqual([...AREAS].sort());
    for (const id of AREAS) {
      const l = load(id);
      expect(l.id).toBe(id);
      expect(l.world).toBe(3);
    }
  });

  it('themes follow the original Lost Levels table: normal and platform areas are snow, except 3-2a/3-2c', () => {
    const themes: Record<string, string> = {
      'll-3-1': 'snow',
      'll-3-1-bonus': 'underground',
      'll-3-1-sky': 'overworld',
      'll-3-1-bonus2': 'underground',
      'll-3-1-exit': 'snow',
      'll-3-2-intro': 'overworld',
      'll-3-2': 'water',
      'll-3-2-exit': 'overworld',
      'll-3-3': 'snow',
      'll-3-4': 'castle',
    };
    for (const id of AREAS) {
      const l = load(id);
      expect([id, l.theme]).toEqual([id, themes[id]]);
      // Night and snow keep the overworld music.
      if (l.theme === 'night' || l.theme === 'snow') expect(l.music).toBe('overworld');
    }
  });

  it('bonus rooms wider than one screen scroll; the 16-wide ones stay locked', () => {
    for (const id of AREAS.filter((a) => a.includes('-bonus'))) {
      const l = load(id);
      expect([id, l.camera]).toEqual([id, l.width > 16 ? 'scroll' : 'locked']);
    }
    expect(load('ll-3-1-bonus').camera).toBe('scroll');
  });

  it('has no checkpoint in its castle (LOCKED_CP)', () => {
    expect(load('ll-3-4').zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
  });

  it('sub-areas inherit the clock; main areas carry the XML TIME (400 even in the castle)', () => {
    const main: Record<string, number> = { 'll-3-1': 400, 'll-3-2': 400, 'll-3-3': 400, 'll-3-4': 400 };
    for (const id of AREAS) {
      const l = load(id);
      expect(l.time).toBe(main[id] ?? null);
      expect(l.parent).toBe(main[id] ? null : id.split('-').slice(0, 3).join('-'));
    }
  });

  it('every pipe, vine and pit target resolves (the backwards warps go to World 1)', () => {
    const lost = join(import.meta.dirname);
    const targets: string[] = [];
    for (const id of AREAS) {
      for (const z of load(id).zones) {
        if (z.kind !== 'pipe' && z.kind !== 'vine' && z.kind !== 'pit') continue;
        targets.push(z.target.level);
        const world = z.target.level.split('-')[1];
        expect(existsSync(join(lost, `world${world}`, `${z.target.level}.map`))).toBe(true);
      }
    }
    expect(targets.filter((t) => !t.startsWith('ll-3-'))).toEqual(['ll-1-1', 'll-1-1']);
  });

  it('the only poison mushroom is the ? block at 40,9 of 3-1', () => {
    for (const id of AREAS) {
      const l = load(id);
      const poison = Array.from(l.tiles).flatMap((t, i) =>
        t === T.Q_POISON || t === T.BRICK_POISON || t === T.HIDDEN_POISON
          ? [[i % l.width, Math.floor(i / l.width)]]
          : [],
      );
      expect(poison).toEqual(id === 'll-3-1' ? [[40, 9]] : []);
      expect(tile(load('ll-3-1'), 40, 9)).toBe(T.Q_POISON);
    }
  });
});

describe('Lost Levels 3-1', () => {
  const l = load('ll-3-1');
  it('is a 256-wide snow level starting at 2,12', () => {
    expect(l.width).toBe(256);
    expect(l.theme).toBe('snow');
    expect(l.start).toEqual({ x: 2, y: 12 });
  });
  it('has two ordinary (not chasing) Hammer Bros and a crowd of Koopas', () => {
    expect(at(l, 'hammer-bro')).toEqual([
      [26, 4],
      [24, 8],
    ]);
    expect(ofType(l, 'hammer-bro-chase')).toHaveLength(0);
    expect(at(l, 'koopa-red')).toEqual([
      [139, 8],
      [143, 8],
      [45, 12],
      [47, 12],
      [59, 12],
    ]);
    // 111 has the original's shiftRight: an entity line (dx=8), listed before the grid.
    expect(ofType(l, 'koopa-green').map((e) => e.x)).toEqual([111, 93, 110, 113]);
    expect(ofType(l, 'koopa-para-red').map((e) => [e.x, e.y])).toEqual([
      [57, 9],
      [95, 9],
      [99, 8],
      [103, 9],
      [127, 9],
    ]);
    expect(at(l, 'koopa-para-green-h')).toEqual([[156, 9]]);
    expect(ofType(l, 'piranha').map((e) => e.x)).toEqual([66, 83, 90, 129, 134, 138, 142, 227]);
  });
  it('has three blaster barrels, a green springboard and its item blocks', () => {
    expect(tile(l, 108, 11)).toBe(T.BLASTER_TOP);
    expect(tile(l, 121, 10)).toBe(T.BLASTER_TOP);
    expect(tile(l, 121, 12)).toBe(T.BLASTER_TOP);
    expect(Array.from(l.tiles).filter((t) => t === T.BLASTER_TOP)).toHaveLength(3);
    expect(at(l, 'spring-green')).toEqual([[160, 12]]);
    expect(tile(l, 27, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 44, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 112, 9)).toBe(T.Q_POWERUP);
    expect(tile(l, 87, 9)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 127, 5)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 83, 5)).toBe(T.BRICK_VINE);
  });
  it('links its pipes: two bonus rooms, a pipe-to-pipe hop and the vine to the sky', () => {
    expect(pipeAt(l, 66)).toEqual({
      kind: 'pipe',
      x: 66,
      y: 9,
      dir: 'down',
      target: { level: 'll-3-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(pipeAt(l, 83)).toEqual({
      kind: 'pipe',
      x: 83,
      y: 11,
      dir: 'down',
      target: { level: 'll-3-1', x: 90, y: 8, exitDir: 'up' },
    });
    expect(tile(l, 90, 9)).toBe(T.PIPE_TL);
    expect(pipeAt(l, 134)).toEqual({
      kind: 'pipe',
      x: 134,
      y: 10,
      dir: 'down',
      target: { level: 'll-3-1-bonus2', x: 1, y: 0, exitDir: 'none' },
    });
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 83,
      y: 5,
      target: { level: 'll-3-1-sky', x: 4, y: 14 },
    });
    expect(load('ll-3-1-bonus2').zones).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-3-1', x: 83, y: 10, exitDir: 'up' } },
    ]);
    expect(load('ll-3-1-sky').zones).toEqual([
      { kind: 'pit', x: 0, target: { level: 'll-3-1', x: 146, y: 0 } },
    ]);
  });
  it('flag at 186; past it, beyond the castle, a warp pipe back to World 1', () => {
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 97, y: 12 });
    expect(tile(l, 186, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 186, next: 'll-3-2-intro' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 190, y: 12 });
    expect(pipeAt(l, 246)).toEqual({
      kind: 'pipe',
      x: 246,
      y: 10,
      dir: 'down',
      target: { level: 'll-1-1', x: 2, y: 12 },
    });
    expect(tile(l, 246, 10)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({
      kind: 'warp',
      x: 240,
      w: 16,
      worlds: [1],
      text: 'WELCOME TO WARP ZONE!',
    });
  });
  it('the 32-wide bonus room leads to a backwards warp room whose only pipe goes to 1-1', () => {
    const b = load('ll-3-1-bonus');
    expect(b.width).toBe(32);
    expect(tile(b, 16, 12)).toBe(T.BLASTER_TOP);
    expect(b.zones).toEqual([
      {
        kind: 'pipe',
        x: 29,
        y: 12,
        dir: 'right',
        target: { level: 'll-3-1-exit', x: 3, y: 10, exitDir: 'up' },
      },
    ]);
    const e = load('ll-3-1-exit');
    expect(e.width).toBe(32);
    expect(e.startMode).toBe('pipe-exit');
    expect(e.start).toEqual({ x: 3, y: 10 });
    expect(tile(e, 3, 11)).toBe(T.PIPE_TL);
    expect(e.zones).toEqual([
      { kind: 'pipe', x: 22, y: 10, dir: 'down', target: { level: 'll-1-1', x: 2, y: 12 } },
      { kind: 'warp', x: 16, w: 16, worlds: [1], text: 'WELCOME TO WARP ZONE!' },
    ]);
    expect(exitOf(e)).toBeUndefined();
  });
});

describe('Lost Levels 3-2', () => {
  it('the intro pipe drops into the water level at 2,1', () => {
    const intro = load('ll-3-2-intro');
    expect(intro.startMode).toBe('autowalk');
    expect(intro.zones).toEqual([
      { kind: 'pipe', x: 10, y: 12, dir: 'right', target: { level: 'll-3-2', x: 2, y: 1, exitDir: 'none' } },
    ]);
  });
  const l = load('ll-3-2');
  it('is a 192-wide water level full of Cheep Cheeps and Bloopers', () => {
    expect(l.width).toBe(192);
    expect(l.theme).toBe('water');
    expect(l.music).toBe('water');
    expect(l.start).toEqual({ x: 2, y: 1 });
    expect(l.startMode).toBe('fall');
    for (const x of [0, 30, 100, 160]) expect(tile(l, x, 2)).toBe(T.WATER);
    expect(ofType(l, 'cheep-red')).toHaveLength(16);
    expect(ofType(l, 'cheep-grey')).toHaveLength(9);
    expect(ofType(l, 'blooper').map((e) => e.x)).toEqual([18, 30, 54, 63, 82, 100, 120, 136, 144, 164, 177]);
  });
  it('has Koopas walking the sea floor and a paratroopa underwater', () => {
    expect(at(l, 'koopa-red')).toEqual([
      [132, 8],
      [182, 12],
    ]);
    expect(at(l, 'koopa-green')).toEqual([[75, 9]]);
    expect(at(l, 'koopa-para-red')).toEqual([[107, 8]]);
  });
  it('leaves through the side pipe at 189 to the exit area', () => {
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 99, y: 12 });
    expect(pipeAt(l, 189)).toEqual({
      kind: 'pipe',
      x: 189,
      y: 8,
      dir: 'right',
      target: { level: 'll-3-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    const exit = load('ll-3-2-exit');
    expect(exit.startMode).toBe('pipe-exit');
    expect(tile(exit, 28, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(exit)).toEqual({ kind: 'exit', x: 28, next: 'll-3-3' });
  });
});

describe('Lost Levels 3-3', () => {
  const l = load('ll-3-3');
  it('is 200-wide treetops with two balance lifts and three falling lifts', () => {
    expect(l.width).toBe(200);
    expect(tile(l, 84, 13)).toBe(T.TREE_TOP);
    expect(ofType(l, 'balance')).toEqual([
      { type: 'balance', x: 60, y: 7, props: { x2: 65, y2: 12, len: 6, top: 2 } },
      { type: 'balance', x: 104, y: 11, props: { x2: 108, y2: 8, len: 6, top: 2 } },
    ]);
    expect(ofType(l, 'lift-fall')).toEqual([
      { type: 'lift-fall', x: 90, y: 6, props: { len: 6, dx: -16 } },
      { type: 'lift-fall', x: 139, y: 9, props: { len: 6, dx: -16 } },
      { type: 'lift-fall', x: 148, y: 8, props: { len: 6, dx: -16 } },
    ]);
  });
  it('has a green springboard, piranhas and Koopas', () => {
    expect(at(l, 'spring-green')).toEqual([[85, 12]]);
    expect(ofType(l, 'piranha').map((e) => [e.x, e.y])).toEqual([
      [55, 3],
      [74, 11],
      [80, 11],
      [145, 11],
      [164, 12],
      [170, 10],
    ]);
    expect(ofType(l, 'koopa-green')).toHaveLength(8);
    expect(at(l, 'koopa-red')).toEqual([
      [24, 4],
      [121, 8],
      [97, 12],
    ]);
    expect(at(l, 'koopa-para-green-h')).toEqual([[25, 3]]);
    expect(at(l, 'koopa-para-red')).toEqual([[126, 8]]);
    expect(tile(l, 100, 2)).toBe(T.HIDDEN_POWERUP);
  });
  it('ends at the flag at 186 in front of the big castle', () => {
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 114, y: 12 });
    expect(tile(l, 186, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 188, y: 12 });
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 186, next: 'll-3-4' });
  });
});

describe('Lost Levels 3-4', () => {
  const l = load('ll-3-4');
  it('is a 326-wide castle maze with two pairs of loops', () => {
    expect(l.width).toBe(326);
    expect(l.theme).toBe('castle');
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([
      { kind: 'loop', x: 63, y0: 9, y1: 12, to: 127, checks: [{ x: 32, y0: 10, y1: 12 }], need: 'all' },
      {
        kind: 'loop',
        x: 127,
        y0: 3,
        y1: 12,
        to: 63,
        checks: [
          { x: 96, y0: 3, y1: 4 },
          { x: 107, y0: 3, y1: 5 },
        ],
        need: 'any',
      },
      { kind: 'loop', x: 193, y0: 3, y1: 4, to: 263, checks: [{ x: 175, y0: 3, y1: 5 }], need: 'all' },
      {
        kind: 'loop',
        x: 263,
        y0: 3,
        y1: 12,
        to: 193,
        checks: [
          { x: 245, y0: 7, y1: 12 },
          { x: 253, y0: 10, y1: 12 },
          { x: 261, y0: 6, y1: 12 },
        ],
        need: 'any',
      },
    ]);
    expect(l.zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
  });
  it('has six piranhas, three Podoboos, six fire bars and two hidden mushrooms', () => {
    expect(ofType(l, 'piranha').map((e) => [e.x, e.y])).toEqual([
      [39, 10],
      [103, 10],
      [149, 9],
      [154, 9],
      [219, 9],
      [224, 9],
    ]);
    expect(ofType(l, 'podoboo').map((e) => e.x)).toEqual([73, 137, 299]);
    expect(at(l, 'firebar-ccw')).toEqual([
      [198, 5],
      [212, 9],
      [268, 5],
      [282, 9],
    ]);
    expect(at(l, 'firebar')).toEqual([
      [188, 5],
      [258, 5],
    ]);
    expect(tile(l, 78, 7)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 142, 7)).toBe(T.HIDDEN_POWERUP);
  });
  it('ends with a fire-breathing Bowser, the axe and the way to 4-1', () => {
    expect(ofType(l, 'bowser')).toEqual([{ type: 'bowser', x: 301, y: 9 }]);
    expect(l.entities).toContainEqual({ type: 'axe', x: 307, y: 8 });
    expect(ofType(l, 'lift-h')).toHaveLength(0);
    for (let x = 294; x <= 306; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 318, next: 'll-4-1' });
  });
});
