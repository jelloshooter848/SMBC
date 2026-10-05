import { describe, expect, it } from 'vitest';
import { parseTextMap, serializeTextMap, MapParseError } from './textmap';
import { T } from './tiles';

const small = (rows: string[], extra = '') =>
  [
    'id: 9-9',
    'name: TEST',
    'theme: overworld',
    'time: 300',
    'start: 1,12',
    '',
    '[tiles]',
    ...rows,
    extra,
  ].join('\n');

const rows15 = (fill = '................', last = '################') => [
  ...Array.from({ length: 13 }, () => fill),
  last,
  last,
];

describe('textmap parser', () => {
  it('parses header, tiles and ground', () => {
    const lvl = parseTextMap(small(rows15()));
    expect(lvl.id).toBe('9-9');
    expect(lvl.world).toBe(9);
    expect(lvl.width).toBe(16);
    expect(lvl.time).toBe(300);
    expect(lvl.tiles[13 * 16]).toBe(T.GROUND);
    expect(lvl.tiles[0]).toBe(T.AIR);
  });

  it('strips spaces and ;; comments so screens can be space separated', () => {
    const rows = rows15('........ ........ ;; two halves', '######## ########');
    const lvl = parseTextMap(small(rows));
    expect(lvl.width).toBe(16);
  });

  it('expands entity markers into spawns on air tiles', () => {
    const rows = rows15();
    rows[12] = '....g......k....';
    const lvl = parseTextMap(small(rows));
    expect(lvl.entities).toEqual([
      { type: 'goomba', x: 4, y: 12 },
      { type: 'koopa-green', x: 11, y: 12 },
    ]);
    expect(lvl.tiles[12 * 16 + 4]).toBe(T.AIR);
  });

  it('parses zones, entities and decor sections', () => {
    const extra = [
      '',
      '[entities]',
      'lift-h 5 8 len=3 range=4',
      '[zones]',
      'pipe 4 9 down -> 1-1-bonus 1 1 exit=none',
      'exit 12 next=1-2',
      'warp 2 8 worlds=4,3,2 text=WELCOME_TO_WARP_ZONE!',
      'checkpoint 7',
      '[decor]',
      'hill-big 0 12',
    ].join('\n');
    const lvl = parseTextMap(small(rows15(), extra));
    expect(lvl.entities[0]).toEqual({ type: 'lift-h', x: 5, y: 8, props: { len: 3, range: 4 } });
    expect(lvl.zones[0]).toEqual({
      kind: 'pipe',
      x: 4,
      y: 9,
      dir: 'down',
      target: { level: '1-1-bonus', x: 1, y: 1, exitDir: 'none' },
    });
    expect(lvl.zones[1]).toEqual({ kind: 'exit', x: 12, next: '1-2' });
    expect(lvl.zones[2]).toEqual({
      kind: 'warp',
      x: 2,
      w: 8,
      worlds: [4, 3, 2],
      text: 'WELCOME TO WARP ZONE!',
    });
    expect(lvl.decor).toEqual([{ kind: 'hill-big', x: 0, y: 12 }]);
  });

  it('parses and round-trips the bowser-fire zone', () => {
    const lvl = parseTextMap(small(rows15(), '\n[zones]\nbowser-fire 9'));
    expect(lvl.zones).toEqual([{ kind: 'bowser-fire', x: 9 }]);
    expect(serializeTextMap(lvl)).toContain('\nbowser-fire 9\n');
    expect(parseTextMap(serializeTextMap(lvl)).zones).toEqual(lvl.zones);
    expect(() => parseTextMap(small(rows15(), '\n[zones]\nbowser-fire'))).toThrow(/bowser-fire x/);
  });

  it('rejects ragged rows with a line number', () => {
    const rows = rows15();
    rows[3] = '...............'; // 15 wide
    expect(() => parseTextMap(small(rows))).toThrow(MapParseError);
    expect(() => parseTextMap(small(rows))).toThrow(/row 3 has 15 columns/);
  });

  it('rejects wrong row counts and unknown chars', () => {
    expect(() => parseTextMap(small(rows15().slice(1)))).toThrow(/expected 15 tile rows/);
    const rows = rows15();
    rows[0] = '@...............';
    expect(() => parseTextMap(small(rows))).toThrow(/unknown tile char "@"/);
  });

  it('round-trips through serializeTextMap', () => {
    const rows = rows15();
    rows[9] = '..=?M...........';
    rows[12] = '....g...........';
    const lvl = parseTextMap(small(rows, '\n[zones]\nexit 12 next=1-2\n[decor]\nbush-1 3 12'));
    const again = parseTextMap(serializeTextMap(lvl));
    expect(Array.from(again.tiles)).toEqual(Array.from(lvl.tiles));
    expect(again.entities).toEqual(lvl.entities);
    expect(again.zones).toEqual(lvl.zones);
    expect(again.decor).toEqual(lvl.decor);
  });
});
