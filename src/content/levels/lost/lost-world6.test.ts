import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels World 6, checked against tools/levelgen/source/levelDataLostLevels.xml (normal
// difficulty). Upright piranhas sit on the pipe's top-left tile; hanging ones (piranha-down) on
// the bottom-left rim tile (D) of a pipe that hangs from above.

const load = (id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'world6', `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const count = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type).length;
/** Positions of one entity type, sorted by column then row (grid markers and entity lines mixed). */
const at = (l: LevelData, type: string) =>
  l.entities
    .filter((e) => e.type === type)
    .map((e) => [e.x, e.y])
    .sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
const pipes = (l: LevelData) => l.zones.filter((z): z is Zone & { kind: 'pipe' } => z.kind === 'pipe');

describe('Lost Levels 6-1', () => {
  const l = load('ll-6-1');
  it('is a 256-wide overworld (no night palette in The Lost Levels) starting at 2,12', () => {
    expect(l.width).toBe(256);
    expect(l.theme).toBe('overworld');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
  });
  it('has two Hammer Bros, three hanging and nine upright piranhas', () => {
    expect(at(l, 'hammer-bro')).toEqual([
      [73, 12],
      [107, 12],
    ]);
    expect(at(l, 'piranha-down')).toEqual([
      [101, 9],
      [141, 9],
      [224, 5],
    ]);
    for (const [x, y] of at(l, 'piranha-down') as [number, number][]) {
      expect(tile(l, x, y)).toBe(T.PIPE_BOTTOM_L);
      expect(tile(l, x + 1, y)).toBe(T.PIPE_BOTTOM_R);
    }
    expect(at(l, 'piranha')).toEqual([
      [80, 6],
      [103, 13],
      [141, 13],
      [156, 12],
      [198, 13],
      [211, 11],
      [226, 11],
      [230, 9],
      [234, 5],
    ]);
  });
  it('has goombas, koopas, a beetle, paratroopas, a lone blaster barrel and three lifts', () => {
    expect(count(l, 'goomba')).toBe(3);
    expect(count(l, 'koopa-green')).toBe(5);
    expect(at(l, 'buzzy')).toEqual([[16, 8]]);
    expect(at(l, 'koopa-para-green')).toEqual([
      [22, 8],
      [128, 12],
      [132, 12],
    ]);
    expect(tile(l, 88, 12)).toBe(T.BLASTER_TOP);
    expect(at(l, 'lift-fall')).toEqual([
      [160, 5],
      [168, 5],
    ]);
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 205, y: 13, props: { len: 4, range: 3 } });
  });
  it('has a row of ? blocks with a mushroom and poison, a star brick and a hidden 1-up', () => {
    expect(tile(l, 130, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 139, 5)).toBe(T.Q_POISON);
    expect(tile(l, 22, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 14, 9)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 21, 6)).toBe(T.HIDDEN_1UP);
  });
  it('the pipe at 156 detours underwater and comes back up out of the pipe at 211', () => {
    expect(pipes(l)).toEqual([
      {
        kind: 'pipe',
        x: 156,
        y: 12,
        dir: 'down',
        target: { level: 'll-6-1-water', x: 2, y: 1, exitDir: 'none' },
      },
    ]);
    const w = load('ll-6-1-water');
    expect(w.width).toBe(80);
    expect(w.theme).toBe('water');
    expect(w.parent).toBe('ll-6-1');
    expect(at(w, 'blooper')).toEqual([
      [25, 8],
      [39, 6],
    ]);
    expect(at(w, 'lift-up')).toEqual([
      [46, 3],
      [46, 9],
    ]);
    expect(w.entities).toContainEqual({ type: 'koopa-para-red', x: 69, y: 7 });
    expect(at(w, 'koopa-green')).toEqual([[28, 12]]);
    expect(pipes(w)).toEqual([
      { kind: 'pipe', x: 77, y: 8, dir: 'right', target: { level: 'll-6-1', x: 211, y: 10, exitDir: 'up' } },
    ]);
    expect(tile(l, 211, 11)).toBe(T.PIPE_TL);
  });
  it('ends at the flagpole at 244 and goes on to the 6-2 intro', () => {
    expect(tile(l, 244, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 248, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 244, next: 'll-6-2-intro' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 114 });
  });
});

describe('Lost Levels 6-2', () => {
  const l = load('ll-6-2');
  it('is a 192-wide water level entered from the intro pipe', () => {
    const intro = load('ll-6-2-intro');
    expect(pipes(intro)).toEqual([
      { kind: 'pipe', x: 10, y: 12, dir: 'right', target: { level: 'll-6-2', x: 2, y: 1, exitDir: 'none' } },
    ]);
    expect(l.width).toBe(192);
    expect(l.theme).toBe('water');
    expect(l.music).toBe('water');
    expect(l.time).toBe(400);
    expect(l.startMode).toBe('fall');
    expect(tile(l, 0, 2)).toBe(T.WATER);
  });
  it('is full of Cheep Cheeps and Bloopers, with koopas and six sinking lifts', () => {
    expect(count(l, 'cheep-red')).toBe(15);
    expect(count(l, 'cheep-grey')).toBe(7);
    expect(count(l, 'blooper')).toBe(11);
    expect(at(l, 'koopa-red')).toEqual([
      [114, 12],
      [158, 6],
    ]);
    expect(l.entities).toContainEqual({ type: 'koopa-para-green-h', x: 138, y: 8 });
    expect(l.entities).toContainEqual({ type: 'koopa-para-red', x: 180, y: 8 });
    expect(at(l, 'lift-down')).toEqual([
      [71, 5],
      [71, 10],
      [91, 6],
      [91, 12],
      [162, 4],
      [162, 9],
    ]);
  });
  it('the side pipe at 189 leads to the exit area and on to 6-3', () => {
    expect(pipes(l)).toEqual([
      {
        kind: 'pipe',
        x: 189,
        y: 8,
        dir: 'right',
        target: { level: 'll-6-2-exit', x: 3, y: 10, exitDir: 'up' },
      },
    ]);
    const e = load('ll-6-2-exit');
    expect(e.width).toBe(40);
    expect(e.zones).toContainEqual({ kind: 'exit', x: 28, next: 'll-6-3' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 114 });
  });
});

describe('Lost Levels 6-3', () => {
  const l = load('ll-6-3');
  it('is a 232-wide bridge level with leaping Cheep Cheeps from 16 to 192', () => {
    expect(l.width).toBe(232);
    expect(l.theme).toBe('overworld');
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 16, w: 176 });
    expect(tile(l, 128, 13)).toBe(T.TREE_TOP); // World 6 bridge areas keep the plain overworld
    expect(tile(l, 42, 10)).toBe(T.BRIDGE);
  });
  it('has red koopas and paratroopas but no lifts', () => {
    expect(at(l, 'koopa-red')).toEqual([
      [46, 7],
      [103, 9],
      [113, 9],
      [133, 9],
    ]);
    expect(at(l, 'koopa-para-green-h')).toEqual([
      [34, 9],
      [61, 9],
      [108, 9],
      [159, 8],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([
      [88, 10],
      [196, 8],
      [215, 4],
    ]);
    expect(l.entities.filter((e) => e.type.startsWith('lift-') || e.type === 'balance')).toEqual([]);
    expect(tile(l, 88, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 132, 9)).toBe(T.BRICK_POWERUP);
  });
  it('ends at the flagpole at 217 by the big castle and goes on to 6-4', () => {
    expect(tile(l, 217, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 220, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 218, next: 'll-6-4' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 129 });
  });
});

describe('Lost Levels 6-4', () => {
  const l = load('ll-6-4');
  it('is a 352-wide castle maze with four loops and no checkpoint (LOCKED_CP)', () => {
    expect(l.width).toBe(352);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(400);
    expect(l.zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([
      { kind: 'loop', x: 80, y0: 3, y1: 4, to: 144, checks: [{ x: 32, y0: 10, y1: 12 }], need: 'all' },
      {
        kind: 'loop',
        x: 144,
        y0: 3,
        y1: 12,
        to: 80,
        checks: [
          { x: 96, y0: 3, y1: 8 },
          { x: 140, y0: 6, y1: 12 },
        ],
        need: 'any',
      },
      { kind: 'loop', x: 208, y0: 10, y1: 12, to: 272, checks: [{ x: 160, y0: 11, y1: 12 }], need: 'all' },
      {
        kind: 'loop',
        x: 272,
        y0: 3,
        y1: 12,
        to: 208,
        checks: [
          { x: 224, y0: 3, y1: 4 },
          { x: 268, y0: 3, y1: 8 },
        ],
        need: 'any',
      },
    ]);
  });
  it('has six hanging piranhas and seven upright ones', () => {
    expect(at(l, 'piranha-down')).toEqual([
      [43, 10],
      [107, 10],
      [160, 10],
      [219, 6],
      [224, 10],
      [283, 6],
    ]);
    for (const [x, y] of at(l, 'piranha-down') as [number, number][])
      expect(tile(l, x, y)).toBe(T.PIPE_BOTTOM_L);
    expect(at(l, 'piranha')).toEqual([
      [24, 10],
      [88, 10],
      [152, 10],
      [164, 9],
      [166, 9],
      [228, 9],
      [230, 9],
    ]);
  });
  it('has two Hammer Bros, twelve fire bars, five Podoboos and seven lifts', () => {
    expect(at(l, 'hammer-bro')).toEqual([
      [56, 12],
      [120, 12],
    ]);
    expect(at(l, 'firebar')).toEqual([
      [176, 9],
      [240, 9],
    ]);
    expect(count(l, 'firebar-ccw')).toBe(10);
    expect(at(l, 'podoboo').map(([x]) => x)).toEqual([66, 130, 196, 260, 322]);
    expect(at(l, 'lift-down')).toEqual([
      [188, 5],
      [188, 13],
      [252, 5],
      [252, 13],
    ]);
    expect(at(l, 'lift-h')).toEqual([
      [182, 13],
      [246, 13],
      [297, 13],
    ]);
  });
  it('ends with a hammer-throwing Bowser, the axe and the exit to 7-1', () => {
    expect(l.entities).toContainEqual({ type: 'bowser', x: 327, y: 9, props: { attack: 'hammer' } });
    expect(l.entities).toContainEqual({ type: 'axe', x: 333, y: 8 });
    for (let x = 320; x <= 332; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 324, 4)).toBe(T.BRICK_COINS10);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 344, next: 'll-7-1' });
  });
});
