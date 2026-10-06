import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { worldLabel } from '@game/hud/world-label';
import type { LevelData } from '@game/level/schema';

// The Lost Levels World C (stored as world 12). Values checked against levelDataLostLevels.xml
// (normal difficulty, classic-hero layer).
const dir = join(import.meta.dirname, 'world12');
const load = (id: string): LevelData => parseTextMap(readFileSync(join(dir, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
/** Entities of one type, left to right (grid markers and entity lines together). */
const of = (l: LevelData, type: string) =>
  l.entities.filter((e) => e.type === type).sort((a, b) => a.x - b.x || a.y - b.y);
const at = (l: LevelData, type: string) => of(l, type).map((e) => [e.x, e.y]);

describe('Lost Levels World C (12): every area', () => {
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith('.map'))
    .map((f) => f.slice(0, -4))
    .sort();
  it('has the expected areas, each parsing to 15 rows', () => {
    expect(ids).toEqual(['ll-12-1', 'll-12-1-bonus', 'll-12-1-sky', 'll-12-2', 'll-12-3', 'll-12-4']);
    for (const id of ids) {
      const l = load(id);
      expect(l.height).toBe(15);
      expect(l.world).toBe(12);
    }
    expect(worldLabel(12)).toBe('C');
  });

  it('uses the original theme table: night for the normal and bridge stages, gray (snow) for C-3', () => {
    // GameSuperMarioBros.as (Lost Levels pack): world 12 normal/platform/cheepCheep -> night, 12-3a -> gray (our snow);
    // coin heaven, pipe bonus and castle keep their general themes. Music stays overworld.
    const themes = Object.fromEntries(ids.map((id) => [id, load(id).theme]));
    expect(themes).toEqual({
      'll-12-1': 'night',
      'll-12-1-bonus': 'underground',
      'll-12-1-sky': 'overworld',
      'll-12-2': 'night',
      'll-12-3': 'snow',
      'll-12-4': 'castle',
    });
    for (const id of ['ll-12-1', 'll-12-2', 'll-12-3']) expect(load(id).music).toBe('overworld');
  });

  it('has no checkpoints: every World C level is LOCKED_CP', () => {
    for (const id of ids) expect(load(id).zones.filter((z) => z.kind === 'checkpoint')).toEqual([]);
  });

  it('chains C-1 to C-4 and on to D-1', () => {
    const exits = ['ll-12-1', 'll-12-2', 'll-12-3', 'll-12-4'].map(
      (id) => load(id).zones.find((z) => z.kind === 'exit') as { next: string },
    );
    expect(exits.map((z) => z.next)).toEqual(['ll-12-2', 'll-12-3', 'll-12-4', 'll-13-1']);
  });
});

describe('C-1 (ll-12-1): pipes, hanging piranhas, poison and a chasing Hammer Bro', () => {
  const l = load('ll-12-1');
  it('is a 240-wide overworld stage with 400 seconds', () => {
    expect(l.width).toBe(240);
    expect(l.theme).toBe('night');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(l.startMode).toBe('stand');
  });
  it('has eight upright and eight hanging piranhas, each in its own pipe', () => {
    expect(of(l, 'piranha').map((e) => e.x)).toEqual([35, 40, 86, 96, 100, 131, 217, 219]);
    const down = at(l, 'piranha-down');
    expect(down).toEqual([
      [33, 8],
      [46, 8],
      [76, 7],
      [104, 8],
      [121, 10],
      [123, 10],
      [126, 9],
      [180, 8],
    ]);
    for (const [x, y] of down) {
      expect(tile(l, x as number, y as number)).toBe(T.PIPE_BOTTOM_L);
      expect(tile(l, (x as number) + 1, y as number)).toBe(T.PIPE_BOTTOM_R);
    }
  });
  it('has a poison ? block at 39 and a poison brick at 81', () => {
    expect(tile(l, 39, 9)).toBe(T.Q_POISON);
    expect(tile(l, 81, 9)).toBe(T.BRICK_POISON);
    expect(tile(l, 82, 5)).toBe(T.Q_POWERUP);
    expect(tile(l, 38, 7)).toBe(T.HIDDEN_1UP);
    expect(tile(l, 102, 5)).toBe(T.BRICK_STAR);
    expect(tile(l, 183, 5)).toBe(T.BRICK_COINS10);
  });
  it('has paratroopas, one Goomba and a chasing Hammer Bro at 170', () => {
    expect(of(l, 'koopa-para-green')).toHaveLength(8);
    expect(at(l, 'koopa-para-green-h')).toEqual([[150, 11]]);
    expect(at(l, 'koopa-para-red')).toEqual([[192, 9]]);
    expect(at(l, 'goomba')).toEqual([[214, 8]]);
    expect(at(l, 'hammer-bro-chase')).toEqual([[170, 12]]);
    expect(of(l, 'hammer-bro')).toHaveLength(0);
  });
  it('links the bonus pipe at 96, the vine at 197 and ends at the flagpole at 229', () => {
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 96,
      y: 10,
      dir: 'down',
      target: { level: 'll-12-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(tile(l, 197, 5)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 197,
      y: 5,
      target: { level: 'll-12-1-sky', x: 4, y: 14 },
    });
    expect(tile(l, 229, 2)).toBe(T.FLAG_BALL);
    expect(tile(l, 229, 12)).toBe(T.HARD);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 228, next: 'll-12-2' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 232, y: 12 });
  });
  it('bonus room: drop in at column 1, leave by the side pipe to the pipe at 131', () => {
    const b = load('ll-12-1-bonus');
    expect(b.width).toBe(32);
    expect(b.theme).toBe('underground');
    expect(b.startMode).toBe('fall');
    expect(b.camera).toBe('scroll'); // 32 wide: it scrolls
    expect(b.parent).toBe('ll-12-1');
    expect(b.time).toBeNull();
    expect(tile(b, 20, 9)).toBe(T.BRICK_COINS10);
    expect(b.zones).toContainEqual({
      kind: 'pipe',
      x: 29,
      y: 12,
      dir: 'right',
      target: { level: 'll-12-1', x: 131, y: 10, exitDir: 'up' },
    });
    expect(tile(l, 131, 11)).toBe(T.PIPE_TL);
  });
  it('coin heaven: climb in at 4, ride the lift and drop back next to the pipe at 131', () => {
    const s = load('ll-12-1-sky');
    expect(s.width).toBe(80);
    expect(s.startMode).toBe('climb');
    expect(s.entities).toContainEqual({ type: 'vine', x: 4, y: 14, props: { len: 8 } });
    expect(s.entities).toContainEqual({ type: 'lift-right', x: 16, y: 10, props: { len: 4 } });
    expect(s.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-12-1', x: 130, y: 0 } });
    expect(tile(l, 130, 13)).toBe(T.GROUND);
  });
});

describe('C-2 (ll-12-2): treetop bridges with flying Bloopers, cheeps and bullets', () => {
  const l = load('ll-12-2');
  it('is 208 wide with railed bridges and treetops', () => {
    expect(l.width).toBe(208);
    expect(l.theme).toBe('night');
    for (let x = 31; x <= 44; x++) expect(tile(l, x, 12)).toBe(T.BRIDGE);
    expect(tile(l, 30, 12)).toBe(T.HARD);
    expect(tile(l, 45, 12)).toBe(T.HARD);
    expect(tile(l, 50, 13)).toBe(T.TREE_TOP);
    expect(tile(l, 49, 14)).toBe(T.TREE_TRUNK);
  });
  it('has three Bloopers in the air, red paratroopas and a red Koopa on the bridge', () => {
    expect(at(l, 'blooper')).toEqual([
      [21, 5],
      [47, 9],
      [65, 5],
    ]);
    expect(at(l, 'koopa-para-red')).toEqual([
      [17, 6],
      [121, 6],
    ]);
    expect(at(l, 'koopa-para-green-h')).toEqual([[73, 7]]);
    expect(at(l, 'koopa-red')).toEqual([[42, 11]]);
  });
  it('has a green springboard at 131 and the lifts, including one balance pair', () => {
    expect(at(l, 'spring-green')).toEqual([[131, 12]]);
    expect(tile(l, 131, 13)).toBe(T.TREE_TOP);
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 137, y: 13, props: { len: 4, range: 3 } });
    expect(l.entities).toContainEqual({ type: 'lift-v', x: 160, y: 10, props: { len: 4, range: 6, dx: -8 } });
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 166,
      y: 5,
      props: { x2: 171, y2: 9, len: 4, top: 2 },
    });
  });
  it('has leaping cheeps from 16 to 79, Bullet Bills from 132 to 175, and the exit at 192', () => {
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 16, w: 63 });
    expect(l.zones).toContainEqual({ kind: 'bullets', x: 132, w: 43 });
    expect(tile(l, 138, 9)).toBe(T.Q_POWERUP);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 192, next: 'll-12-3' });
    expect(tile(l, 193, 2)).toBe(T.FLAG_BALL);
  });
});

describe('C-3 (ll-12-3): green springboards, Lakitu and fire bars on treetops', () => {
  const l = load('ll-12-3');
  it('is 336 wide', () => {
    expect(l.width).toBe(336);
    expect(l.theme).toBe('snow');
    expect(l.time).toBe(400);
  });
  it('has seven green springboards, each standing on a treetop', () => {
    const springs = at(l, 'spring-green');
    expect(springs).toEqual([
      [21, 12],
      [50, 12],
      [73, 12],
      [99, 8],
      [137, 8],
      [196, 12],
      [233, 12],
    ]);
    for (const [x, y] of springs) expect(tile(l, x as number, (y as number) + 1)).toBe(T.TREE_TOP);
    expect(of(l, 'spring')).toHaveLength(0);
  });
  it('has a mid-screen Lakitu from 138 to 175 (lakituEndMiddle) and four red piranhas', () => {
    expect(l.entities).toContainEqual({ type: 'lakitu', x: 138, y: 7, props: { end: 175, mid: 1 } });
    expect(of(l, 'piranha').map((e) => e.x)).toEqual([117, 122, 127, 188]);
  });
  it('has fire bars on blocks near the end, a falling lift and a balance lift', () => {
    expect(at(l, 'firebar-ccw')).toEqual([[277, 9]]);
    expect(at(l, 'firebar')).toEqual([
      [282, 9],
      [305, 5],
    ]);
    for (const [x, y] of [
      [277, 9],
      [282, 9],
      [305, 5],
    ])
      expect(tile(l, x as number, y as number)).toBe(T.HARD);
    expect(l.entities).toContainEqual({ type: 'lift-fall', x: 158, y: 3, props: { len: 4 } });
    expect(l.entities).toContainEqual({
      type: 'balance',
      x: 214,
      y: 5,
      props: { x2: 219, y2: 9, len: 4, top: 2 },
    });
    expect(at(l, 'koopa-para-red')).toEqual([[290, 4]]);
  });
  it('ends at the big castle', () => {
    expect(tile(l, 315, 2)).toBe(T.FLAG_BALL);
    expect(l.zones).toContainEqual({ kind: 'exit', x: 316, next: 'll-12-4' });
    expect(l.entities).toContainEqual({ type: 'decor-castle-big', x: 318, y: 12 });
  });
});

describe('C-4 (ll-12-4): the castle with elevator shafts, Buzzy Beetles and a hammer Bowser', () => {
  const l = load('ll-12-4');
  it('is a 256-wide castle with 300 seconds and no maze loops', () => {
    expect(l.width).toBe(256);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(l.zones.filter((z) => z.kind === 'loop')).toHaveLength(0);
  });
  it('has the elevator shafts: five falling and four rising three-segment lifts', () => {
    expect(at(l, 'lift-down')).toEqual([
      [49, 7],
      [59, 2],
      [59, 10],
      [69, 2],
      [69, 10],
    ]);
    expect(at(l, 'lift-up')).toEqual([
      [54, 4],
      [54, 12],
      [64, 4],
      [64, 12],
    ]);
    for (const e of [...of(l, 'lift-down'), ...of(l, 'lift-up')]) expect(e.props).toEqual({ len: 3, dx: -4 });
    expect(l.entities).toContainEqual({ type: 'lift-h', x: 31, y: 13, props: { len: 4, range: 3, dx: -8 } });
  });
  it('has ten Buzzy Beetles, three red Koopas, a podoboo and eight fire bars', () => {
    expect(at(l, 'buzzy')).toEqual([
      [114, 12],
      [116, 12],
      [119, 12],
      [121, 12],
      [133, 12],
      [135, 12],
      [144, 12],
      [146, 12],
      [162, 9],
      [164, 9],
    ]);
    expect(at(l, 'koopa-red')).toEqual([
      [93, 5],
      [98, 5],
      [102, 5],
    ]);
    expect(at(l, 'podoboo')).toEqual([[184, 12]]);
    expect(of(l, 'firebar-ccw').map((e) => e.x)).toEqual([16, 22, 45, 82, 156, 170, 231]);
    expect(at(l, 'firebar')).toEqual([[201, 13]]);
    expect(tile(l, 44, 9)).toBe(T.HIDDEN_POWERUP);
  });
  it('ends with a hammer-throwing Bowser on the bridge, a fire bar in the bridge and the axe', () => {
    expect(l.entities).toContainEqual({ type: 'bowser', x: 231, y: 9, props: { attack: 'hammer' } });
    expect(of(l, 'bowser')).toHaveLength(1);
    for (let x = 224; x <= 236; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(tile(l, 236, 9)).toBe(T.CHAIN);
    expect(l.entities).toContainEqual({ type: 'axe', x: 237, y: 8 });
    expect(l.zones).toContainEqual({ kind: 'exit', x: 248, next: 'll-13-1' });
  });
});
