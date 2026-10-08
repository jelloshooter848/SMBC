import { describe, expect, it } from 'vitest';
import { parseTextMap, serializeTextMap } from './textmap';
import { T } from './tiles';
import { heroVariant } from './variants';

/*
 * A hero's level variant (Chapter 1 finishing pass: Sophia's variants): a `[variant <hero>]`
 * section of tile runs, laid when any player is that hero; campaign only unless marked `classic`.
 */

const map = (extra: string[]) =>
  [
    'id: 9-9',
    'start: 1,12',
    '',
    '[tiles]',
    ...Array.from({ length: 12 }, () => '................'),
    '.........$......',
    '################',
    '################',
    '',
    ...extra,
  ].join('\n');

const at = (l: { tiles: Uint16Array; width: number }, x: number, y: number) => l.tiles[y * l.width + x];

describe('[variant <hero>] sections', () => {
  it('parse into runs of tiles, campaign only unless marked classic', () => {
    const l = parseTextMap(
      map([
        '[variant sophia]',
        ';; a step by the pipe',
        '5 9 BB',
        '6 8 =',
        '[variant link classic]',
        '2 3 ?',
      ]),
    );
    expect(l.variants).toEqual([
      {
        hero: 'sophia',
        tiles: [
          { x: 5, y: 9, tiles: [T.HARD, T.HARD] },
          { x: 6, y: 8, tiles: [T.BRICK] },
        ],
      },
      { hero: 'link', classic: true, tiles: [{ x: 2, y: 3, tiles: [T.Q_COIN] }] },
    ]);
    // The map's own tiles are untouched: a variant is laid only when it is played.
    expect(at(l, 5, 9)).toBe(T.AIR);
  });

  it('`*N` repeats a run on N rows going down', () => {
    const l = parseTextMap(map(['[variant sophia]', '5 3 B. *3']));
    expect(l.variants?.[0]?.tiles).toEqual([3, 4, 5].map((y) => ({ x: 5, y, tiles: [T.HARD, T.AIR] })));
  });

  it('add and take out spawns: a marker in a run, `+ type x y [key=val]`, `- type x y`', () => {
    const l = parseTextMap(
      map(['[variant sophia classic]', '3 12 s', '3 13 B', '+ koopa-para-red 5 9 dx=8', '- goomba 7 12']),
    );
    expect(l.variants?.[0]).toEqual({
      hero: 'sophia',
      classic: true,
      tiles: [
        { x: 3, y: 12, tiles: [T.AIR] },
        { x: 3, y: 13, tiles: [T.HARD] },
      ],
      add: [
        { type: 'spring', x: 3, y: 12 },
        { type: 'koopa-para-red', x: 5, y: 9, props: { dx: 8 } },
      ],
      remove: [{ type: 'goomba', x: 7, y: 12 }],
    });
  });

  it('round-trip through serializeTextMap', () => {
    const l = parseTextMap(
      map([
        '[variant sophia]',
        '5 9 BB',
        '6 12 s',
        '+ koopa-para-red 5 9 dx=8',
        '- goomba 7 12',
        '[variant sophia classic]',
        '1 2 #',
      ]),
    );
    const text = serializeTextMap(l);
    expect(text).toContain(
      '[variant sophia]\n5 9 BB\n6 12 .\n+ spring 6 12\n+ koopa-para-red 5 9 dx=8\n- goomba 7 12',
    );
    expect(text).toContain('[variant sophia classic]\n1 2 #');
    expect(parseTextMap(text).variants).toEqual(l.variants);
  });

  it('reject what is not a run of map tiles inside the level', () => {
    expect(() => parseTextMap(map(['[variant sophia]', '5 9']))).toThrow(/expected "x y tiles/);
    expect(() => parseTextMap(map(['[variant sophia]', '5 9 B *0']))).toThrow(/expected "x y tiles/);
    expect(() => parseTextMap(map(['[variant sophia]', '5 9 B *7']))).toThrow(/outside the level/);
    expect(() => parseTextMap(map(['[variant sophia]', '5 9 @']))).toThrow(/not a tile/);
    expect(() => parseTextMap(map(['[variant sophia]', '- goomba 7 12 dx=8']))).toThrow(/"- type x y"/);
    expect(() => parseTextMap(map(['[variant sophia]', '15 9 BB']))).toThrow(/outside the level/);
    expect(() => parseTextMap(map(['[variant]', '5 9 B']))).toThrow(/unknown section/);
  });
});

describe('heroVariant', () => {
  const level = parseTextMap(
    map(['[variant sophia]', '4 9 BB', '8 13 B.', '[variant sophia classic]', '12 6 =']),
  );

  it('lays a hero’s runs when any player is that hero (campaign: every run)', () => {
    const v = heroVariant(level, ['mario', 'sophia'], true);
    expect(at(v, 4, 9)).toBe(T.HARD);
    expect(at(v, 5, 9)).toBe(T.HARD);
    expect(at(v, 12, 6)).toBe(T.BRICK);
    // Each tile as written: a `.` opens the floor (a piece the original leaves out for her).
    expect(at(v, 8, 13)).toBe(T.HARD);
    expect(at(v, 9, 13)).toBe(T.AIR);
    expect(at(v, 10, 13)).toBe(T.GROUND);
    expect(level.tiles).not.toBe(v.tiles);
    expect(at(level, 4, 9)).toBe(T.AIR);
    expect(at(level, 9, 13)).toBe(T.GROUND);
  });

  it('adds and takes out spawns', () => {
    const l = parseTextMap(map(['[variant sophia]', '3 12 s', '- goomba 7 12', '- goomba 9 9']));
    const withGoombas = {
      ...l,
      entities: [...l.entities, { type: 'goomba', x: 7, y: 12 }, { type: 'koopa-green', x: 7, y: 12 }],
    };
    expect(heroVariant(withGoombas, ['sophia'], true).entities).toEqual([
      { type: 'koopa-green', x: 7, y: 12 },
      { type: 'spring', x: 3, y: 12 },
    ]);
    expect(heroVariant(withGoombas, ['mario'], true).entities).toBe(withGoombas.entities);
  });

  it('outside the campaign lays only the runs marked classic', () => {
    const v = heroVariant(level, ['sophia'], false);
    expect(at(v, 4, 9)).toBe(T.AIR);
    expect(at(v, 12, 6)).toBe(T.BRICK);
  });

  it('is the level itself for other heroes, or a level without variants', () => {
    expect(heroVariant(level, ['mario'], true)).toBe(level);
    expect(heroVariant(level, ['mario', 'luigi'], false)).toBe(level);
    const plain = parseTextMap(map([]));
    expect(heroVariant(plain, ['sophia'], true)).toBe(plain);
  });

  it('is the same object each time for the same heroes and play', () => {
    expect(heroVariant(level, ['sophia'], true)).toBe(heroVariant(level, ['sophia', 'sophia'], true));
  });
});
