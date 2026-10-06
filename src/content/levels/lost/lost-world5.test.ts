import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels World 5, checked against tools/levelgen/source/levelDataLostLevels.xml (normal
// difficulty). Upright piranhas sit on the pipe's top-left tile; hanging ones (piranha-down) on
// the bottom-left rim tile (D) of a pipe that hangs from above.

const load = (id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'world5', `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const count = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type).length;
/** Positions of one entity type, sorted by column then row (grid markers and entity lines mixed). */
const at = (l: LevelData, type: string) =>
  l.entities
    .filter((e) => e.type === type)
    .map((e) => [e.x, e.y])
    .sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
const pipes = (l: LevelData) => l.zones.filter((z): z is Zone & { kind: 'pipe' } => z.kind === 'pipe');

describe('Lost Levels 5-1', () => {
  const l = load('ll-5-1');
  it('is a 416-wide snowy overworld (World 5 normal areas) with a 400 timer', () => {
    expect(l.width).toBe(416);
    expect(l.theme).toBe('snow');
    expect(l.music).toBe('overworld');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
  });
  it('has six piranhas hanging from upside-down pipes, each on its D/G rim', () => {
    const hanging = [
      [27, 10],
      [41, 10],
      [46, 7],
      [50, 7],
      [54, 7],
      [189, 8],
    ];
    expect(at(l, 'piranha-down')).toEqual(hanging);
    for (const [x, y] of hanging as [number, number][]) {
      expect(tile(l, x, y)).toBe(T.PIPE_BOTTOM_L);
      expect(tile(l, x + 1, y)).toBe(T.PIPE_BOTTOM_R);
      expect(tile(l, x, y - 1)).toBe(T.PIPE_BL); // the pipe body above the rim
    }
    expect(Array.from(l.tiles).filter((t) => t === T.PIPE_BOTTOM_L)).toHaveLength(6);
  });
  it('has eleven upright piranhas, one right under the hanging pipe at 189', () => {
    expect(at(l, 'piranha')).toEqual([
      [87, 9],
      [101, 8],
      [115, 11],
      [189, 11],
      [197, 13],
      [201, 13],
      [211, 13],
      [237, 13],
      [265, 13],
      [352, 5],
      [387, 11],
    ]);
  });
  it('has beetles, goombas, koopas, paratroopas and three blaster barrels', () => {
    expect(at(l, 'buzzy')).toEqual([
      [17, 12],
      [20, 12],
      [23, 12],
      [26, 12],
      [219, 12],
    ]);
    expect(count(l, 'goomba')).toBe(5);
    expect(count(l, 'koopa-green')).toBe(9);
    expect(at(l, 'koopa-para-green')).toEqual([
      [63, 10],
      [95, 9],
      [211, 11],
      [316, 12],
      [319, 10],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([
      [290, 7],
      [293, 7],
      [301, 8],
    ]);
    for (const [x, y] of [
      [74, 10],
      [74, 12],
      [181, 11],
    ] as const)
      expect(tile(l, x, y)).toBe(T.BLASTER_TOP);
    expect(tile(l, 132, 5)).toBe(T.HIDDEN_1UP);
  });
  it('the pipe at 87 leads to a bonus room that comes back out of the pipe at 115', () => {
    expect(pipes(l)).toContainEqual({
      kind: 'pipe',
      x: 87,
      y: 9,
      dir: 'down',
      target: { level: 'll-5-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    const b = load('ll-5-1-bonus');
    expect(b.theme).toBe('underground');
    expect(tile(b, 3, 2)).toBe(T.BRICK_POWERUP);
    expect(tile(b, 12, 2)).toBe(T.BRICK_COINS10);
    expect(pipes(b)).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-5-1', x: 115, y: 10, exitDir: 'up' } },
    ]);
  });
  it('the vine at 299 climbs to a coin heaven that drops past the castle, at 386', () => {
    expect(tile(l, 299, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 299,
      y: 5,
      target: { level: 'll-5-1-sky', x: 4, y: 14 },
    });
    const s = load('ll-5-1-sky');
    expect(s.width).toBe(120);
    expect(s.theme).toBe('overworld'); // coin heaven: not a normal area
    expect(s.entities).toContainEqual({ type: 'lift-right', x: 16, y: 10, props: { len: 4 } });
    expect(s.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-5-1', x: 386, y: 0 } });
  });
  it('past the castle a warp zone pipe at 406 leads to 6-1', () => {
    expect(tile(l, 406, 10)).toBe(T.PIPE_TL);
    expect(pipes(l)).toContainEqual({
      kind: 'pipe',
      x: 406,
      y: 10,
      dir: 'down',
      target: { level: 'll-6-1', x: 2, y: 12 },
    });
    expect(l.zones).toContainEqual({
      kind: 'warp',
      x: 400,
      w: 16,
      worlds: [6],
      text: 'WELCOME TO WARP ZONE!',
    });
    expect(pipes(l)).toHaveLength(2);
  });
  it('ends at the flagpole at 361 and goes on to the 5-2 intro', () => {
    expect(tile(l, 361, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 365, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 361, next: 'll-5-2-intro' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 210, y: 12 });
  });
});

describe('Lost Levels 5-2', () => {
  const l = load('ll-5-2');
  it('starts in the intro, whose pipe drops into the underground level at 2,3', () => {
    const intro = load('ll-5-2-intro');
    expect(intro.startMode).toBe('autowalk');
    expect(pipes(intro)).toEqual([
      { kind: 'pipe', x: 10, y: 12, dir: 'right', target: { level: 'll-5-2', x: 2, y: 3, exitDir: 'none' } },
    ]);
    expect(intro.theme).toBe('overworld'); // 5-2a override
    expect(l.width).toBe(224);
    expect(l.theme).toBe('underground');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 3 });
    expect(l.startMode).toBe('fall');
  });
  it('has four hanging and six upright piranhas', () => {
    expect(at(l, 'piranha-down')).toEqual([
      [8, 6],
      [14, 10],
      [119, 10],
      [167, 7],
    ]);
    for (const [x, y] of at(l, 'piranha-down') as [number, number][])
      expect(tile(l, x, y)).toBe(T.PIPE_BOTTOM_L);
    expect(at(l, 'piranha')).toEqual([
      [41, 11],
      [78, 11],
      [92, 8],
      [108, 9],
      [110, 9],
      [160, 9],
    ]);
  });
  it('has red koopas, goombas, beetles and rising and falling lifts', () => {
    expect(at(l, 'koopa-red')).toEqual([
      [16, 12],
      [27, 8],
      [29, 8],
      [86, 8],
      [115, 12],
    ]);
    expect(count(l, 'goomba')).toBe(2);
    expect(at(l, 'buzzy')).toEqual([
      [87, 12],
      [89, 12],
    ]);
    expect(at(l, 'lift-up')).toEqual([
      [137, 6],
      [137, 14],
    ]);
    expect(at(l, 'lift-down')).toEqual([
      [141, 9],
      [146, 6],
      [146, 14],
    ]);
  });
  it('has poison in a ? block and two bricks, plus 1-up, star and coin bricks', () => {
    expect(tile(l, 23, 5)).toBe(T.Q_POISON);
    expect(tile(l, 68, 9)).toBe(T.BRICK_POISON);
    expect(tile(l, 89, 9)).toBe(T.BRICK_POISON);
    expect(tile(l, 95, 2)).toBe(T.BRICK_1UP);
    expect(tile(l, 76, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 2, 9)).toBe(T.HIDDEN_POWERUP);
    expect(Array.from(l.tiles).filter((t) => t === T.BRICK_COIN)).toHaveLength(9);
  });
  it('the side pipe at 171 leads to the exit area, which ends at the flagpole at 28', () => {
    expect(pipes(l)).toContainEqual({
      kind: 'pipe',
      x: 171,
      y: 9,
      dir: 'right',
      target: { level: 'll-5-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    const e = load('ll-5-2-exit');
    expect(e.theme).toBe('overworld'); // 5-2d override of the World 5 snow
    expect(e.startMode).toBe('pipe-exit');
    expect(tile(e, 3, 11)).toBe(T.PIPE_TL);
    expect(at(e, 'piranha')).toEqual([[3, 11]]);
    expect(e.zones).toContainEqual({ kind: 'exit', x: 28, next: 'll-5-3' });
  });
  it('warps: a pipe at 214 to 7-1, and a vine at 135 up to a pipe to 8-1', () => {
    expect(pipes(l)).toContainEqual({
      kind: 'pipe',
      x: 214,
      y: 10,
      dir: 'down',
      target: { level: 'll-7-1', x: 2, y: 12 },
    });
    expect(l.zones).toContainEqual({
      kind: 'warp',
      x: 208,
      w: 16,
      worlds: [7],
      text: 'WELCOME TO WARP ZONE!',
    });
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 135,
      y: 6,
      target: { level: 'll-5-2-warp', x: 4, y: 14 },
    });
    const w = load('ll-5-2-warp');
    expect(w.width).toBe(64);
    expect(w.theme).toBe('overworld'); // 5-2c override
    expect(tile(w, 0, 13)).toBe(T.TREE_TOP);
    expect(w.startMode).toBe('climb');
    expect(pipes(w)).toEqual([
      { kind: 'pipe', x: 54, y: 10, dir: 'down', target: { level: 'll-8-1', x: 2, y: 12 } },
    ]);
    expect(w.zones).toContainEqual({
      kind: 'warp',
      x: 48,
      w: 16,
      worlds: [8],
      text: 'WELCOME TO WARP ZONE!',
    });
    // No drop back: the vine area only leads on to World 8.
    expect(w.zones.filter((z) => z.kind === 'pit')).toEqual([]);
  });
});

describe('Lost Levels 5-3', () => {
  const l = load('ll-5-3');
  it('is a 272-wide treetop level whose first stretch repeats until a pipe is taken', () => {
    expect(l.width).toBe(272);
    expect(l.theme).toBe('overworld'); // a platform area: only World 5 normal areas are snowy
    expect(tile(l, 126, 13)).toBe(T.TREE_TOP);
    // Walking past 128 always moves the player back to 64 (no checkpoints).
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([
      { kind: 'loop', x: 128, y0: 0, y1: 14, to: 64, checks: [], need: 'all' },
    ]);
    // The pipes at 38 and 102 lead to the same bonus room, which exits at 147, past the loop.
    for (const x of [38, 102])
      expect(pipes(l)).toContainEqual({
        kind: 'pipe',
        x,
        y: 4,
        dir: 'down',
        target: { level: 'll-5-3-bonus', x: 1, y: 0, exitDir: 'none' },
      });
    const b = load('ll-5-3-bonus');
    expect(b.width).toBe(32);
    expect(b.theme).toBe('underground');
    expect(b.camera).toBe('scroll'); // wider than one screen
    expect(b.startMode).toBe('fall');
    expect(pipes(b)).toEqual([
      { kind: 'pipe', x: 29, y: 12, dir: 'right', target: { level: 'll-5-3', x: 147, y: 10, exitDir: 'up' } },
    ]);
    expect(tile(l, 147, 11)).toBe(T.PIPE_TL);
  });
  it('has ten piranhas, bloopers in the air, paratroopas, two balance lifts and nine more lifts', () => {
    expect(count(l, 'piranha')).toBe(10);
    expect(at(l, 'blooper')).toEqual([
      [45, 9],
      [109, 9],
      [193, 7],
    ]);
    expect(count(l, 'koopa-para-red')).toBe(5);
    expect(at(l, 'koopa-para-green-h')).toEqual([
      [53, 8],
      [117, 8],
    ]);
    expect(l.entities.filter((e) => e.type === 'balance')).toEqual([
      { type: 'balance', x: 167, y: 7, props: { x2: 172, y2: 9, len: 4, top: 2 } },
      { type: 'balance', x: 235, y: 7, props: { x2: 241, y2: 10, len: 4, top: 2 } },
    ]);
    expect(count(l, 'lift-h')).toBe(6);
    expect(at(l, 'lift-fall')).toEqual([
      [213, 7],
      [218, 5],
      [223, 5],
    ]);
    expect(tile(l, 70, 2)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 134, 2)).toBe(T.HIDDEN_POWERUP);
  });
  it('has Bullet Bills from 155 to 230 and ends at the flagpole at 253', () => {
    expect(l.zones).toContainEqual({ kind: 'bullets', x: 155, w: 75 });
    expect(tile(l, 253, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 257, y: 12 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 255, next: 'll-5-4' });
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 154, y: 9 });
  });
});

describe('Lost Levels 5-4', () => {
  const l = load('ll-5-4');
  it('is a 224-wide castle with a 300 timer, no maze and no checkpoint (LOCKED_CP)', () => {
    expect(l.width).toBe(224);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
    expect(l.zones.filter((z) => z.kind === 'loop')).toEqual([]);
  });
  it('has thirteen fire bars (one long), eight Podoboos and four lifts', () => {
    expect(at(l, 'firebar-ccw')).toEqual([
      [44, 12],
      [48, 9],
      [84, 8],
      [116, 9],
      [119, 9],
      [128, 9],
      [177, 9],
    ]);
    expect(count(l, 'firebar')).toBe(6);
    expect(l.entities).toContainEqual({ type: 'firebar', x: 140, y: 9, props: { len: 12 } });
    expect(at(l, 'podoboo').map(([x]) => x)).toEqual([22, 28, 74, 89, 101, 134, 147, 195]);
    expect(at(l, 'lift-fall')).toEqual([
      [18, 10],
      [70, 11],
      [77, 11],
    ]);
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 202, y: 6, props: { len: 4, range: 3 } });
    expect(tile(l, 44, 8)).toBe(T.BRICK_POWERUP);
  });
  it('ends with fire-only Bowser, the axe and the exit to 6-1', () => {
    expect(l.entities).toContainEqual({ type: 'bowser', x: 199, y: 9 });
    expect(l.entities).toContainEqual({ type: 'axe', x: 205, y: 8 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 216, next: 'll-6-1' });
  });
});
