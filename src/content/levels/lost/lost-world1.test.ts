import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels, World 1, converted from levelDataLostLevels.xml (normal difficulty). Every value
// below was checked against the original XML tokens, not just copied from the generated maps.

const dir = join(import.meta.dirname, 'world1');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const ofType = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type);
const at = (l: LevelData, type: string) => ofType(l, type).map((e) => [e.x, e.y]);
const pipeAt = (l: LevelData, x: number) => l.zones.find((z) => z.kind === 'pipe' && z.x === x);
const exitOf = (l: LevelData) => l.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');

const AREAS = [
  'll-1-1',
  'll-1-1-bonus',
  'll-1-2-intro',
  'll-1-2',
  'll-1-2-warp',
  'll-1-2-exit',
  'll-1-2-under',
  'll-1-2-bonus',
  'll-1-3',
  'll-1-4',
];

describe('Lost Levels World 1: files', () => {
  it('has exactly the expected areas, all parsing to 15 rows', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.map'));
    expect(files.map((f) => f.replace(/\.map$/, '')).sort()).toEqual([...AREAS].sort());
    for (const id of AREAS) {
      const l = load(id);
      expect(l.id).toBe(id);
      expect(l.height).toBe(15);
      expect(l.world).toBe(1);
    }
  });

  it('themes follow the original Lost Levels table: World 1 has no night or snow', () => {
    const themes: Record<string, string> = {
      'll-1-1': 'overworld',
      'll-1-1-bonus': 'underground',
      'll-1-2-intro': 'overworld',
      'll-1-2': 'underground',
      'll-1-2-warp': 'overworld',
      'll-1-2-exit': 'overworld',
      'll-1-2-under': 'underground',
      'll-1-2-bonus': 'underground',
      'll-1-3': 'overworld',
      'll-1-4': 'castle',
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
    expect(load('ll-1-2-bonus').camera).toBe('scroll');
  });

  it('has no checkpoint in its castle (LOCKED_CP)', () => {
    expect(load('ll-1-4').zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
  });

  it('sub-areas inherit the clock and name their parent; main areas carry the XML TIME', () => {
    const main: Record<string, number> = { 'll-1-1': 400, 'll-1-2': 400, 'll-1-3': 400, 'll-1-4': 300 };
    for (const id of AREAS) {
      const l = load(id);
      if (main[id]) {
        expect(l.time).toBe(main[id]);
        expect(l.parent).toBeNull();
      } else {
        expect(l.time).toBeNull();
        expect(l.parent).toBe(id.split('-').slice(0, 3).join('-'));
      }
    }
  });

  it('every pipe, vine and pit target in World 1 resolves to a map (or to another world)', () => {
    const lost = join(import.meta.dirname);
    const exists = (id: string) =>
      readdirSync(lost)
        .filter((d) => d.startsWith('world'))
        .some((d) => existsSync(join(lost, d, `${id}.map`)));
    const outside: string[] = [];
    for (const id of AREAS) {
      for (const z of load(id).zones) {
        if (z.kind !== 'pipe' && z.kind !== 'vine' && z.kind !== 'pit') continue;
        if (z.target.level.startsWith('ll-1-')) expect(exists(z.target.level)).toBe(true);
        else outside.push(z.target.level);
      }
    }
    // The three warp pipes of 1-2 leave the world.
    expect(outside.sort()).toEqual(['ll-2-1', 'll-3-1', 'll-4-1']);
  });
});

describe('Lost Levels 1-1', () => {
  const l = load('ll-1-1');
  it('is a 208-wide overworld level starting on the ground at 2,12', () => {
    expect(l.width).toBe(208);
    expect(l.theme).toBe('overworld');
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(l.startMode).toBe('stand');
  });
  it('has two poison ? blocks (28,9 and 90,9) next to ordinary ones', () => {
    expect(tile(l, 28, 9)).toBe(T.Q_POISON);
    expect(tile(l, 90, 9)).toBe(T.Q_POISON);
    expect(tile(l, 27, 9)).toBe(T.Q_COIN);
    expect(tile(l, 89, 9)).toBe(T.Q_COIN);
    expect(
      Array.from(l.tiles).filter((t) => t === T.Q_POISON || t === T.BRICK_POISON || t === T.HIDDEN_POISON),
    ).toHaveLength(2);
  });
  it('has the item blocks of the original', () => {
    expect(tile(l, 19, 9)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 43, 8)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 58, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 72, 9)).toBe(T.BRICK_COINS10);
    expect(tile(l, 149, 9)).toBe(T.Q_POWERUP);
    expect(tile(l, 76, 5)).toBe(T.BRICK_COIN);
  });
  it('has its enemies where the XML puts them', () => {
    expect(at(l, 'goomba')).toEqual([
      [69, 4],
      [46, 12],
      [47, 12],
      [102, 12],
      [103, 12],
      [170, 12],
    ]);
    expect(at(l, 'koopa-red')).toEqual([
      [88, 4],
      [20, 8],
      [150, 12],
      [161, 12],
    ]);
    expect(ofType(l, 'koopa-green')).toHaveLength(9);
    expect(ofType(l, 'koopa-para-green').map((e) => e.x)).toEqual([16, 71, 123]);
    expect(ofType(l, 'piranha').map((e) => e.x)).toEqual([32, 39, 45, 123, 128, 142, 147, 163]);
    // Piranhas in the two ground-level pipes sit on the pipe tops at row 13.
    expect(l.entities).toContainEqual({ type: 'piranha', x: 32, y: 13 });
    expect(tile(l, 32, 13)).toBe(T.PIPE_TL);
    // Hard-only extras (Lakitu, hanging piranhas) are not in the normal game.
    expect(ofType(l, 'lakitu')).toHaveLength(0);
    expect(ofType(l, 'piranha-down')).toHaveLength(0);
  });
  it('has the bonus pipe at 128, the return pipe at 163, the checkpoint and the flag at 188', () => {
    expect(pipeAt(l, 128)).toEqual({
      kind: 'pipe',
      x: 128,
      y: 9,
      dir: 'down',
      target: { level: 'll-1-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(tile(l, 163, 11)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 98 });
    expect(tile(l, 188, 2)).toBe(T.FLAG_BALL);
    expect(tile(l, 188, 12)).toBe(T.HARD);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 188, next: 'll-1-2-intro' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 192, y: 12 });
  });
});

describe('Lost Levels 1-1 bonus room', () => {
  const l = load('ll-1-1-bonus');
  it('drops you in, hides a poison mushroom at 1,9 and leads back to the pipe at 163', () => {
    expect(l.width).toBe(16);
    expect(l.theme).toBe('underground');
    expect(l.startMode).toBe('fall');
    expect(tile(l, 1, 9)).toBe(T.HIDDEN_POISON);
    expect(tile(l, 3, 2)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 4, 6)).toBe(T.HIDDEN_COIN);
    expect(l.zones).toEqual([
      { kind: 'pipe', x: 13, y: 12, dir: 'right', target: { level: 'll-1-1', x: 163, y: 10, exitDir: 'up' } },
    ]);
  });
});

describe('Lost Levels 1-2', () => {
  it('the intro walks into the side pipe and 1-2 starts with the drop from the ceiling', () => {
    const intro = load('ll-1-2-intro');
    expect(intro.startMode).toBe('autowalk');
    expect(intro.zones).toEqual([
      { kind: 'pipe', x: 10, y: 12, dir: 'right', target: { level: 'll-1-2', x: 1, y: 3, exitDir: 'none' } },
    ]);
    const l = load('ll-1-2');
    expect(l.width).toBe(224);
    expect(l.theme).toBe('underground');
    expect(l.start).toEqual({ x: 1, y: 3 });
    expect(l.startMode).toBe('fall');
  });

  const l = load('ll-1-2');
  it('has ten piranhas, five falling lifts, two rising lifts, a Buzzy Beetle and a paratroopa', () => {
    expect(ofType(l, 'piranha').map((e) => e.x)).toEqual([36, 49, 102, 108, 112, 117, 121, 131, 191, 196]);
    expect(at(l, 'lift-fall')).toEqual([
      [67, 11],
      [75, 10],
      [83, 9],
      [91, 8],
      [152, 9],
    ]);
    expect(ofType(l, 'lift-up')).toEqual([
      { type: 'lift-up', x: 158, y: 5, props: { len: 6 } },
      { type: 'lift-up', x: 158, y: 13, props: { len: 6 } },
    ]);
    expect(l.entities).toContainEqual({ type: 'buzzy', x: 53, y: 12 });
    expect(at(l, 'goomba')).toEqual([
      [43, 12],
      [44, 12],
    ]);
    expect(ofType(l, 'koopa-green').map((e) => e.x)).toEqual([140, 141, 143]);
    expect(at(l, 'koopa-para-green')).toEqual([[16, 11]]);
  });
  it('has the 1-up/mushroom brick row, the star brick and the vine brick', () => {
    expect([60, 61, 62, 63].map((x) => tile(l, x, 2))).toEqual([
      T.BRICK_1UP,
      T.BRICK_POWERUP,
      T.BRICK_1UP,
      T.BRICK_POWERUP,
    ]);
    expect(tile(l, 31, 2)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 107, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 53, 4)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 98 });
  });
  it('splits its warp zone in three: a vine to the World 3 pipe, a pipe to the World 4 room, World 2 at the end', () => {
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 53,
      y: 4,
      target: { level: 'll-1-2-warp', x: 4, y: 14 },
    });
    expect(pipeAt(l, 191)).toEqual({
      kind: 'pipe',
      x: 191,
      y: 11,
      dir: 'down',
      target: { level: 'll-1-2-under', x: 1, y: 3, exitDir: 'none' },
    });
    expect(pipeAt(l, 214)).toEqual({
      kind: 'pipe',
      x: 214,
      y: 10,
      dir: 'down',
      target: { level: 'll-2-1', x: 2, y: 12 },
    });
    expect(tile(l, 214, 10)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({
      kind: 'warp',
      x: 208,
      w: 16,
      worlds: [2],
      text: 'WELCOME TO WARP ZONE!',
    });
  });
  it('leaves through the side pipe at 170 to the exit area, whose flag ends the stage', () => {
    expect(pipeAt(l, 170)).toEqual({
      kind: 'pipe',
      x: 170,
      y: 9,
      dir: 'right',
      target: { level: 'll-1-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    const exit = load('ll-1-2-exit');
    expect(exit.width).toBe(40);
    expect(exit.startMode).toBe('pipe-exit');
    expect(exit.start).toEqual({ x: 3, y: 10 });
    expect(tile(exit, 3, 11)).toBe(T.PIPE_TL);
    expect(exit.entities).toContainEqual({ type: 'piranha', x: 3, y: 11 });
    expect(tile(exit, 28, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(exit)).toEqual({ kind: 'exit', x: 28, next: 'll-1-3' });
  });
  it('vine area: climb up into treetops with the World 3 pipe', () => {
    const w = load('ll-1-2-warp');
    expect(w.width).toBe(64);
    expect(w.startMode).toBe('climb');
    expect(w.start).toEqual({ x: 4, y: 14 });
    expect(w.entities).toContainEqual({ type: 'vine', x: 4, y: 14, props: { len: 8 } });
    expect(tile(w, 5, 13)).toBe(T.TREE_TOP);
    expect(w.zones).toEqual([
      { kind: 'pipe', x: 54, y: 10, dir: 'down', target: { level: 'll-3-1', x: 2, y: 12 } },
      { kind: 'warp', x: 48, w: 16, worlds: [3], text: 'WELCOME TO WARP ZONE!' },
    ]);
  });
  it('underground room: a bonus pipe at 51 and the World 4 pipe behind a brick wall', () => {
    const u = load('ll-1-2-under');
    expect(u.width).toBe(96);
    expect(u.theme).toBe('underground');
    expect(u.start).toEqual({ x: 1, y: 3 });
    expect(u.startMode).toBe('fall');
    expect(tile(u, 11, 9)).toBe(T.Q_POWERUP);
    expect(at(u, 'lift-fall')).toEqual([
      [17, 9],
      [34, 9],
    ]);
    expect(ofType(u, 'piranha').map((e) => e.x)).toEqual([20, 26, 40, 51]);
    expect(u.entities).toContainEqual({ type: 'koopa-red', x: 55, y: 12 });
    for (let x = 64; x <= 78; x++) for (let y = 2; y <= 12; y++) expect(tile(u, x, y)).toBe(T.BRICK);
    expect(u.zones).toEqual([
      {
        kind: 'pipe',
        x: 51,
        y: 11,
        dir: 'down',
        target: { level: 'll-1-2-bonus', x: 1, y: 0, exitDir: 'none' },
      },
      { kind: 'pipe', x: 86, y: 10, dir: 'down', target: { level: 'll-4-1', x: 2, y: 12 } },
      { kind: 'warp', x: 80, w: 16, worlds: [4], text: 'WELCOME TO WARP ZONE!' },
    ]);
  });
  it('bonus room: 32 wide with a blaster, back into 1-2 at the pipe at 131', () => {
    const b = load('ll-1-2-bonus');
    expect(b.width).toBe(32);
    expect(tile(b, 16, 12)).toBe(T.BLASTER_TOP);
    expect(tile(b, 26, 5)).toBe(T.BRICK_COINS10);
    expect(b.zones).toEqual([
      { kind: 'pipe', x: 29, y: 12, dir: 'right', target: { level: 'll-1-2', x: 131, y: 10, exitDir: 'up' } },
    ]);
    expect(tile(l, 131, 11)).toBe(T.PIPE_TL);
  });
});

describe('Lost Levels 1-3', () => {
  const l = load('ll-1-3');
  it('is 184 wide treetops with three balance lifts and two sliding lifts', () => {
    expect(l.width).toBe(184);
    expect(l.theme).toBe('overworld');
    expect(tile(l, 39, 5)).toBe(T.TREE_TOP);
    expect(tile(l, 40, 6)).toBe(T.TREE_TRUNK);
    expect(ofType(l, 'balance')).toEqual([
      { type: 'balance', x: 26, y: 6, props: { x2: 32, y2: 9, len: 6, top: 2 } },
      { type: 'balance', x: 89, y: 6, props: { x2: 93, y2: 9, len: 6, top: 2 } },
      { type: 'balance', x: 138, y: 5, props: { x2: 145, y2: 10, len: 6, top: 2 } },
    ]);
    expect(ofType(l, 'lift-h')).toEqual([
      { type: 'lift-h', x: 71, y: 9, props: { len: 6, range: 3 } },
      { type: 'lift-h', x: 134, y: 6, props: { len: 6, range: 3 } },
    ]);
  });
  it('has Bloopers in the sky, red Koopas and a red paratroopa', () => {
    expect(at(l, 'blooper')).toEqual([
      [57, 6],
      [83, 4],
    ]);
    expect(at(l, 'koopa-red')).toEqual([
      [45, 4],
      [118, 8],
      [51, 11],
      [53, 11],
      [100, 12],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([[63, 10]]);
    expect(tile(l, 118, 5)).toBe(T.Q_POWERUP);
  });
  it('ends at the flag at 169 in front of the big castle', () => {
    expect(l.zones).toContainEqual({ kind: 'checkpoint', x: 98 });
    expect(tile(l, 169, 2)).toBe(T.FLAG_BALL);
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 171, y: 12 });
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 169, next: 'll-1-4' });
  });
});

describe('Lost Levels 1-4', () => {
  const l = load('ll-1-4');
  it('is a 160-wide castle with a 300 clock, starting on the step at 1,6', () => {
    expect(l.width).toBe(160);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.start).toEqual({ x: 1, y: 6 });
  });
  it('has nine fire bars (four clockwise, five counter-clockwise)', () => {
    expect(at(l, 'firebar')).toEqual([
      [19, 5],
      [53, 9],
      [91, 9],
      [101, 9],
    ]);
    expect(at(l, 'firebar-ccw')).toEqual([
      [37, 5],
      [44, 9],
      [68, 5],
      [76, 5],
      [84, 5],
    ]);
  });
  it('has a fire-breathing Bowser on the 13-tile bridge, the axe, and leads to 2-1', () => {
    expect(ofType(l, 'bowser')).toEqual([{ type: 'bowser', x: 135, y: 9 }]);
    expect(l.entities).toContainEqual({ type: 'axe', x: 141, y: 8 });
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 137, y: 6, props: { len: 4, range: 3 } });
    for (let x = 128; x <= 140; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 140, 9)).toBe(T.CHAIN);
    expect(l.entities).toContainEqual({ type: 'koopa-green', x: 82, y: 7 });
    expect(tile(l, 30, 5)).toBe(T.Q_POWERUP);
    expect(l.zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 152, next: 'll-2-1' });
  });
});
