import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { DEFAULT_LEGEND, T, tileDef } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';
import { getLevel, levelIds } from '.';

// Owner design (2-1 coin heaven): past the end of the clouds an up-arrow of coins hints at
// something higher; a hidden vine block over the second to last cloud platform on the right
// grows a vine up to a Link-themed sky area (2-1-sky2) with captive Link, and a gap in its
// clouds drops back into 2-1 exactly where the coin heaven's own drop does. 0.4.24 rebuilds that
// area as a Zelda II palace on the clouds, Link held on the altar in the middle of its hall.

const load = (id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'world2', `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const coinsIn = (l: LevelData, x0: number, x1: number, y0: number, y1: number): string[] => {
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) row += tile(l, x, y) === T.COIN ? '$' : '.';
    rows.push(row);
  }
  return rows;
};
const cloudRun = (l: LevelData, y: number, x0: number, x1: number) => {
  for (let x = x0; x <= x1; x++) expect(tile(l, x, y), `${x},${y}`).toBe(T.CLOUD_BLOCK);
};

describe('the hidden vine block tile', () => {
  it('is a hidden block holding a vine, written `7` in maps', () => {
    expect(tileDef(T.HIDDEN_VINE).block).toEqual({ kind: 'hidden', content: 'vine' });
    expect(tileDef(T.HIDDEN_VINE).collision).toBe('none');
    expect(DEFAULT_LEGEND['7']).toBe(T.HIDDEN_VINE);
  });
});

describe('2-1 sky: the way up to the sky ruins', () => {
  const l = load('2-1-sky');

  it('an up-arrow of coins just past the end of the clouds', () => {
    expect(tile(l, 61, 13)).toBe(T.CLOUD_BLOCK);
    expect(coinsIn(l, 62, 66, 5, 10)).toEqual([
      '..$..', //
      '.$$$.',
      '$.$.$',
      '..$..',
      '..$..',
      '..$..',
    ]);
  });

  it('three small cloud platforms on the right; the hidden vine block is over the second to last', () => {
    cloudRun(l, 12, 65, 67);
    cloudRun(l, 11, 70, 72);
    cloudRun(l, 12, 75, 77);
    for (const x of [62, 63, 64, 68, 69, 73, 74, 78, 79])
      for (let y = 10; y <= 13; y++) {
        expect(tile(l, x, y), `${x},${y}`).not.toBe(T.CLOUD_BLOCK);
      }
    // Four rows above the platform: a normal jump bumps it, like any ? block over the ground.
    expect(tile(l, 71, 7)).toBe(T.HIDDEN_VINE);
    for (let y = 8; y <= 10; y++) expect(tile(l, 71, y)).toBe(T.AIR);
    expect(l.zones).toContainEqual({ kind: 'vine', x: 71, y: 7, target: { level: '2-1-sky2', x: 4, y: 14 } });
  });

  it('still drops back into 2-1 at column 162 anywhere off the clouds', () => {
    expect(l.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: '2-1', x: 162, y: 0 } });
    for (let x = 62; x < l.width; x++) expect(tile(l, x, 13), `${x}`).toBe(T.AIR);
  });
});

describe("2-1 sky palace (2-1-sky2): Link's palace on the clouds above the coin heaven", () => {
  const l = load('2-1-sky2');
  const solid = (x: number, y: number) => tileDef(tile(l, x, y) as number).collision === 'solid';

  it('is a 2-1 sub-area arrived at by climbing the vine, keeping the running clock', () => {
    expect(l.parent).toBe('2-1');
    expect([l.world, l.stage]).toEqual([2, 1]);
    expect(l.time).toBeNull();
    expect(l.startMode).toBe('climb');
    expect(l.start).toEqual({ x: 4, y: 14 });
    expect(l.entities).toContainEqual({ type: 'vine', x: 4, y: 14, props: { len: 8 } });
    expect(tile(l, 4, 13)).toBe(T.AIR); // the vine comes up through here
    cloudRun(l, 13, 0, 3);
    cloudRun(l, 13, 5, 14);
  });

  it('is in the level library like the other sub-areas', () => {
    expect(levelIds()).toContain('2-1-sky2');
    expect(getLevel('2-1-sky2').parent).toBe('2-1');
  });

  it('five screens: the landing, a sky stair of palace blocks, the gate, the hall and a balcony', () => {
    expect(l.width).toBe(80);
    // The stair: two floating runs of palace ledge blocks, each a step up, over open sky.
    for (let x = 16; x <= 20; x++) expect(tile(l, x, 12), `${x}`).toBe(T.USED);
    for (let x = 22; x <= 27; x++) expect(tile(l, x, 11), `${x}`).toBe(T.USED);
    for (const x of [15, 21, 28]) for (let y = 2; y <= 14; y++) expect(solid(x, y), `${x},${y}`).toBe(false);
    // The hall: palace masonry floor (broken by one two-wide gap) and a ceiling on rows 2-3.
    for (let x = 29; x <= 69; x++) {
      const gap = x === 40 || x === 41;
      expect(tile(l, x, 12), `${x}`).toBe(gap ? T.AIR : T.CASTLE_BRICK);
    }
    for (let x = 34; x <= 63; x++)
      for (const y of [2, 3]) expect(tile(l, x, y), `${x},${y}`).toBe(T.CASTLE_BRICK);
    for (let x = 0; x < l.width; x++) for (const y of [0, 1]) expect(tile(l, x, y), `${x},${y}`).toBe(T.AIR);
  });

  it('captive Link stands on the altar in the middle of the hall, three steps up, under the crest', () => {
    expect(l.entities).toContainEqual({ type: 'captive', x: 52, y: 8, props: { hero: 'link' } });
    // The altar: steps of palace ledge blocks, 8, 6 and 4 wide, centred on column 52.
    const steps: [number, number, number][] = [
      [11, 48, 55],
      [10, 49, 54],
      [9, 50, 53],
    ];
    for (const [y, x0, x1] of steps) {
      expect(tile(l, x0 - 1, y), `left of ${y}`).toBe(T.AIR);
      expect(tile(l, x1 + 1, y), `right of ${y}`).toBe(T.AIR);
      for (let x = x0; x <= x1; x++) expect(tile(l, x, y), `${x},${y}`).toBe(T.USED);
    }
    for (let y = 4; y <= 8; y++) expect(tile(l, 52, y), `above Link ${y}`).toBe(T.AIR);
    const look = l.campaignLook?.decor ?? [];
    expect(look).toContainEqual({ kind: 'zelda2-sky:crest', x: 50, y: 5 });
    expect(look).toContainEqual({ kind: 'zelda2-sky:statue', x: 47, y: 11 });
    expect(look).toContainEqual({ kind: 'zelda2-sky:statue-r', x: 56, y: 11 });
  });

  it('the campaign look dresses it as a Zelda II palace: gate, columns, banners, curtains, back wall', () => {
    expect(l.campaignLook).toMatchObject({ theme: 'zelda2', music: 'zelda2-field' });
    const kinds = new Set((l.campaignLook?.decor ?? []).map((d) => d.kind));
    for (const k of ['gate', 'column', 'column-broken', 'banner', 'curtain', 'wall', 'window', 'cloud-sea'])
      expect(kinds.has(`zelda2-sky:${k}`), k).toBe(true);
    // Outside the campaign it keeps plain ruins on the clouds (the classic decor sheet only).
    expect(l.decor.length).toBeGreaterThan(0);
    for (const d of l.decor) expect(d.kind, d.kind).not.toContain(':');
  });

  it('the way out: the balcony ends in a drop, signposted by a down-arrow of coins, into 2-1 at column 162', () => {
    expect(tile(l, 69, 12)).toBe(T.CASTLE_BRICK);
    for (let x = 70; x < l.width; x++)
      for (let y = 0; y <= 14; y++) expect(solid(x, y), `${x},${y}`).toBe(false);
    expect(coinsIn(l, 72, 76, 5, 10)).toEqual([
      '..$..', //
      '..$..',
      '..$..',
      '$.$.$',
      '.$$$.',
      '..$..',
    ]);
    expect(l.zones).toEqual([{ kind: 'pit', x: 0, target: { level: '2-1', x: 162, y: 0 } }]);
    expect(l.zones.filter((z) => z.kind === 'pit')).toEqual(
      load('2-1-sky').zones.filter((z) => z.kind === 'pit'),
    );
  });
});
