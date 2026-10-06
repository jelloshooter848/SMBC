import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { worldLabel } from '@game/hud/world-label';
import type { LevelData, Zone } from '@game/level/schema';

// The Lost Levels World A (stored as World 10; the HUD shows "A"). Every value below was checked
// against levelDataLostLevels.xml on normal difficulty (classic-hero tokens only).
const dir = join(import.meta.dirname, 'world10');
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

describe('Lost Levels World A files', () => {
  it('has the eight areas of A-1 to A-4', () => {
    expect(readdirSync(dir).sort()).toEqual([
      'll-10-1-bonus.map',
      'll-10-1-sky.map',
      'll-10-1.map',
      'll-10-2-exit.map',
      'll-10-2-intro.map',
      'll-10-2.map',
      'll-10-3.map',
      'll-10-4.map',
    ]);
    expect(worldLabel(10)).toBe('A');
    expect(load('ll-10-1').world).toBe(10);
  });

  it('every target resolves inside World A or is a warp/exit to the start of B-1 or C-1', () => {
    const ids = readdirSync(dir).map((f) => f.replace(/\.map$/, ''));
    const outside = new Set<string>();
    for (const id of ids) {
      for (const z of load(id).zones) {
        const target = z.kind === 'pipe' || z.kind === 'vine' || z.kind === 'pit' ? z.target.level : null;
        const next = z.kind === 'exit' ? z.next : null;
        for (const t of [target, next]) if (t && !ids.includes(t)) outside.add(t);
      }
    }
    expect([...outside].sort()).toEqual(['ll-11-1', 'll-12-1']);
    expect(['ll-10-1', 'll-10-2-exit', 'll-10-3', 'll-10-4'].map((id) => exitOf(load(id))?.next)).toEqual([
      'll-10-2-intro',
      'll-10-3',
      'll-10-4',
      'll-11-1',
    ]);
  });
});

describe('Lost Levels World A rules', () => {
  it('has no checkpoints (every level is LOCKED_CP), locked 16-wide bonus rooms and area-type themes', () => {
    const themes: Record<string, string> = {};
    for (const f of readdirSync(dir)) {
      const l = load(f.replace(/\.map$/, ''));
      expect(zones(l, 'checkpoint')).toEqual([]);
      if (l.id.endsWith('-bonus')) expect([l.width, l.camera]).toEqual([16, 'locked']);
      themes[l.id] = l.theme;
    }
    // The Lost Levels theme table: World A's normal areas are orange giant-mushroom land, its
    // platform areas clouds, 10-2c clouds over overworld ground (10-2a is plain overworld).
    expect(themes).toEqual({
      'll-10-1': 'mushroom',
      'll-10-1-bonus': 'underground',
      'll-10-1-sky': 'overworld',
      'll-10-2': 'underground',
      'll-10-2-exit': 'clouds-overworld',
      'll-10-2-intro': 'overworld',
      'll-10-3': 'clouds',
      'll-10-4': 'castle',
    });
    // The skins keep the overworld tune.
    for (const id of ['ll-10-1', 'll-10-2-exit', 'll-10-3']) expect(load(id).music).toBe('overworld');
  });
});

describe('Lost Levels A-1', () => {
  it('is 224 wide with four chasing Hammer Bros and lots of Koopas', () => {
    const l = load('ll-10-1');
    expect(l.width).toBe(224);
    expect(l.theme).toBe('mushroom');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(where(l, 'hammer-bro-chase')).toEqual(['58,8', '61,4', '129,8', '133,4']);
    expect(where(l, 'hammer-bro')).toEqual([]);
    expect(where(l, 'koopa-red')).toHaveLength(11);
    expect(where(l, 'koopa-green')).toHaveLength(11);
    expect(where(l, 'koopa-para-green')).toEqual(['22,12', '147,7', '151,7', '155,7']);
    expect(where(l, 'piranha')).toEqual(['45,13', '110,10', '130,3', '132,13', '147,11', '163,13']);
    expect(where(l, 'spring')).toEqual(['179,12']);
    expect(l.entities).toContainEqual({ type: 'lift-fall', x: 203, y: 5, props: { len: 4 } });
  });

  it('has poison ? blocks at 61 and 120, two hanging piranhas and the item blocks of the original', () => {
    const l = load('ll-10-1');
    expect(tile(l, 61, 9)).toBe(T.Q_POISON);
    expect(tile(l, 120, 10)).toBe(T.Q_POISON);
    expect(where(l, 'piranha-down')).toEqual(['48,7', '163,10']);
    expect(tile(l, 48, 7)).toBe(T.PIPE_BOTTOM_L);
    expect(tile(l, 164, 10)).toBe(T.PIPE_BOTTOM_R);
    expect(tile(l, 17, 5)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 52, 2)).toBe(T.BRICK_1UP);
    expect(tile(l, 156, 8)).toBe(T.BRICK_POWERUP);
    expect(tile(l, 182, 7)).toBe(T.BRICK_COINS10);
  });

  it('links the vine at 37 to the sky and the pipe at 130 to the bonus room, which returns at 147', () => {
    const l = load('ll-10-1');
    expect(tile(l, 37, 4)).toBe(T.BRICK_VINE);
    expect(l.zones).toContainEqual({
      kind: 'vine',
      x: 37,
      y: 4,
      target: { level: 'll-10-1-sky', x: 4, y: 14 },
    });
    expect(tile(l, 130, 3)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 130,
      y: 3,
      dir: 'down',
      target: { level: 'll-10-1-bonus', x: 1, y: 0, exitDir: 'none' },
    });
    expect(tile(l, 147, 11)).toBe(T.PIPE_TL);
    const bonus = load('ll-10-1-bonus');
    expect(bonus.theme).toBe('underground');
    expect(bonus.startMode).toBe('fall');
    expect(tile(bonus, 11, 10)).toBe(T.BRICK_POISON);
    expect(tile(bonus, 4, 10)).toBe(T.BRICK_POWERUP);
    expect(bonus.zones).toContainEqual({
      kind: 'pipe',
      x: 13,
      y: 12,
      dir: 'right',
      target: { level: 'll-10-1', x: 147, y: 10, exitDir: 'up' },
    });
    const sky = load('ll-10-1-sky');
    expect(sky.startMode).toBe('climb');
    expect(sky.entities).toContainEqual({ type: 'lift-right', x: 16, y: 10, props: { len: 4 } });
    expect(sky.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: 'll-10-1', x: 50, y: 0 } });
  });

  it('has the flagpole at 209', () => {
    const l = load('ll-10-1');
    expect(tile(l, 209, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 209, next: 'll-10-2-intro' });
    expect(l.entities).toContainEqual({ type: 'decor-castle', x: 213, y: 12 });
  });
});

describe('Lost Levels A-2', () => {
  it('walks from the intro into the side pipe and drops into the generated underground main area', () => {
    const intro = load('ll-10-2-intro');
    expect(intro.startMode).toBe('autowalk');
    expect(intro.zones).toContainEqual({
      kind: 'pipe',
      x: 10,
      y: 12,
      dir: 'right',
      target: { level: 'll-10-2', x: 2, y: 3, exitDir: 'none' },
    });
    const l = load('ll-10-2');
    expect(l.width).toBe(224);
    expect(l.theme).toBe('underground');
    expect(l.time).toBe(400);
    expect(l.start).toEqual({ x: 2, y: 3 });
    expect(l.startMode).toBe('fall');
  });

  it('has falling lifts, a balance-free lift shaft at 134, floor piranhas and a chasing Hammer Bro', () => {
    const l = load('ll-10-2');
    expect(where(l, 'lift-fall')).toEqual(['27,11', '33,11', '38,9', '43,8', '53,9', '113,6']);
    expect(where(l, 'lift-down')).toEqual(['134,5', '134,13']);
    expect(where(l, 'lift-h')).toEqual(['70,13']);
    expect(where(l, 'piranha')).toEqual(['85,13', '88,13', '91,13', '94,13', '124,13', '130,13', '168,10']);
    expect(where(l, 'piranha-down')).toEqual(['122,7']);
    expect(where(l, 'hammer-bro-chase')).toEqual(['150,12']);
    expect(where(l, 'spring')).toEqual(['16,12']);
    expect(tile(l, 126, 9)).toBe(T.BRICK_STAR);
    expect(tile(l, 16, 2)).toBe(T.BRICK_1UP);
  });

  it('leaves through the side pipe at 171 to the flagpole area, or warps from 214 to B-1', () => {
    const l = load('ll-10-2');
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 171,
      y: 9,
      dir: 'right',
      target: { level: 'll-10-2-exit', x: 3, y: 10, exitDir: 'up' },
    });
    expect(tile(l, 214, 10)).toBe(T.PIPE_TL);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 214,
      y: 10,
      dir: 'down',
      target: { level: 'll-11-1', x: 2, y: 12 },
    });
    expect(l.zones).toContainEqual({
      kind: 'warp',
      x: 208,
      w: 16,
      worlds: [11],
      text: 'WELCOME TO WARP ZONE!',
    });
    expect(worldLabel(11)).toBe('B');
    const exit = load('ll-10-2-exit');
    expect(exit.startMode).toBe('pipe-exit');
    expect(exit.start).toEqual({ x: 3, y: 10 });
    expect(tile(exit, 3, 11)).toBe(T.PIPE_TL);
    expect(exitOf(exit)).toEqual({ kind: 'exit', x: 28, next: 'll-10-3' });
  });
});

describe('Lost Levels A-3', () => {
  it('is 256 wide with leaping cheeps from 17 to 135, a Blooper in the air and red paratroopas', () => {
    const l = load('ll-10-3');
    expect(l.width).toBe(256);
    expect(l.theme).toBe('clouds');
    expect(l.time).toBe(400);
    expect(l.zones).toContainEqual({ kind: 'cheeps', x: 17, w: 118 });
    expect(where(l, 'blooper')).toEqual(['70,7']);
    expect(where(l, 'koopa-para-red')).toEqual(['133,6', '158,6']);
    expect(where(l, 'koopa-para-green-h')).toEqual(['104,7']);
    expect(where(l, 'spring')).toEqual(['156,12']);
    expect(tile(l, 76, 3)).toBe(T.HIDDEN_POWERUP);
    expect(tile(l, 161, 2)).toBe(T.FLAG_BALL);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 162, next: 'll-10-4' });
  });

  it('has a warp zone past the castle whose pipe at 246 leads to C-1', () => {
    const l = load('ll-10-3');
    expect(tile(l, 246, 10)).toBe(T.PIPE_TL);
    expect(where(l, 'piranha')).toEqual(['227,11']);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 246,
      y: 10,
      dir: 'down',
      target: { level: 'll-12-1', x: 2, y: 12 },
    });
    expect(l.zones).toContainEqual(expect.objectContaining({ kind: 'warp', x: 240, w: 16, worlds: [12] }));
    expect(worldLabel(12)).toBe('C');
  });
});

describe('Lost Levels A-4', () => {
  it('is a 192-wide castle on a 300 clock with five fire bars and seven podoboos', () => {
    const l = load('ll-10-4');
    expect(l.width).toBe(192);
    expect(l.theme).toBe('castle');
    expect(l.time).toBe(300);
    expect(l.start).toEqual({ x: 1, y: 6 });
    expect(where(l, 'firebar-ccw')).toEqual(['18,10']);
    expect(where(l, 'firebar')).toEqual(['24,13', '30,10', '46,6', '56,12']);
    expect(l.entities).toContainEqual({ type: 'firebar', x: 30, y: 10, props: { len: 12 } });
    expect(where(l, 'podoboo')).toEqual(['22,12', '59,12', '89,12', '93,12', '97,12', '102,12', '107,12']);
    expect(where(l, 'koopa-red')).toEqual(['79,4']);
    for (const [x, y] of [
      [118, 9],
      [128, 12],
      [147, 12],
    ] as const)
      expect(tile(l, x, y)).toBe(T.BLASTER_TOP);
    expect(tile(l, 25, 9)).toBe(T.Q_POWERUP);
  });

  it('ends with a hammer-throwing Bowser at 167, the axe at 173 and leads on to B-1', () => {
    const l = load('ll-10-4');
    expect(l.entities).toContainEqual({ type: 'bowser', x: 167, y: 9, props: { attack: 'hammer' } });
    expect(where(l, 'axe')).toEqual(['173,8']);
    for (let x = 160; x <= 172; x++) expect(tile(l, x, 10)).toBe(T.BRIDGE);
    expect(exitOf(l)).toEqual({ kind: 'exit', x: 184, next: 'll-11-1' });
  });
});
