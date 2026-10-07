import { describe, expect, it } from 'vitest';
import { parseTextMap } from '../level/textmap';
import { T } from '../level/tiles';
import { TileMap } from './tilemap';
import { groundRow, groundSurface, RIM_SEARCH, rimRows, SafetyFloor } from './safety-floor';

/** A 15-row level from its bottom rows (padded with sky above), with optional zones and theme. */
function level(bottom: string[], opts: { zones?: string[]; theme?: string } = {}) {
  const width = (bottom[0] as string).length;
  const rows = [...Array.from({ length: 15 - bottom.length }, () => '.'.repeat(width)), ...bottom];
  const src = [
    'id: t',
    `theme: ${opts.theme ?? 'overworld'}`,
    'start: 0,12',
    '[tiles]',
    ...rows,
    ...(opts.zones ? ['[zones]', ...opts.zones] : []),
  ].join('\n');
  return parseTextMap(src, 't');
}

const rimsOf = (bottom: string[]) => Array.from(rimRows(new TileMap(level(bottom))));

describe('Safety floor: rim rows', () => {
  it('a simple gap: the floor sits at the ground surface on both sides (top of row 13)', () => {
    // prettier-ignore
    const rims = rimsOf([
      '#####...####',
      '#####...####',
    ]);
    expect(rims).toEqual([-1, -1, -1, -1, -1, 13, 13, 13, -1, -1, -1, -1]);
  });

  it('uneven sides: the LOWER of the two surfaces, so the hero can walk out on that side', () => {
    // A pipe (surface 11) left of the gap, ground (13) right: 13.
    // prettier-ignore
    const lowRight = level([
      '...##.......',
      '...##.......',
      '#####...####',
      '#####...####',
    ]);
    expect(groundSurface(new TileMap(lowRight), 4)).toBe(11);
    expect(rimRows(new TileMap(lowRight))[6]).toBe(13);
    // Steps up on both sides (surfaces 9 and 11): 11.
    // prettier-ignore
    const rims = rimsOf([
      '####........',
      '####........',
      '####...#####',
      '####...#####',
      '####...#####',
      '####...#####',
    ]);
    expect(rims.slice(4, 7)).toEqual([11, 11, 11]);
    expect(rims.slice(7, 10)).toEqual([-1, -1, -1]);
  });

  it('a wide void (no ground within RIM_SEARCH columns) uses the standard ground row', () => {
    const w = RIM_SEARCH + 4;
    // Ground at row 9 both sides, far apart: the floor is the ground row (13), not 9.
    // prettier-ignore
    const rims = rimsOf([
      `##${'.'.repeat(w)}##`,
      `##${'.'.repeat(w)}##`,
      `##${'.'.repeat(w)}##`,
      `##${'.'.repeat(w)}##`,
      `##${'.'.repeat(w)}##`,
      `##${'.'.repeat(w)}##`,
    ]);
    expect(rims.slice(2, 2 + w).every((r) => r === groundRow(15))).toBe(true);
    expect(groundRow(15)).toBe(13);
    // No ground at all (a sky area's void): the ground row too.
    expect(rimsOf(['........', '........']).every((r) => r === 13)).toBe(true);
    // A taller map's ground row is the row above its bottom row.
    expect(groundRow(32)).toBe(30);
  });

  it('a water level floors every run at the ground row (never across a flooded shaft)', () => {
    // prettier-ignore
    const bottom = [
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
    ];
    expect(rimRows(new TileMap(level(bottom)))[3]).toBe(11);
    expect(rimRows(new TileMap(level(bottom, { theme: 'water' })), true)[3]).toBe(13);
    const floor = new SafetyFloor(
      new TileMap(level(bottom, { theme: 'water' })),
      level(bottom, { theme: 'water' }),
    );
    expect(floor.rowAt(3)).toBe(13);
  });
});

describe('Safety floor: cells and the players’ view of the map', () => {
  it('the rim cell is one-way (top); the cells around it are untouched', () => {
    // prettier-ignore
    const lv = level([
      '#####...####',
      '#####...####',
    ]);
    const map = new TileMap(lv);
    const floor = new SafetyFloor(map, lv);
    const view = floor.view();
    expect(view.collisionAt(6, 13)).toBe('top');
    expect(view.collisionAt(6, 12)).toBe('none');
    expect(view.collisionAt(6, 14)).toBe('none');
    expect(view.isSolid(6, 13)).toBe(false); // never a wall from the side
    expect(view.blocksFromBelow(6, 13)).toBe(false); // nor a ceiling from below
    expect(view.collisionAt(2, 13)).toBe('solid');
    expect(map.collisionAt(6, 13)).toBe('none'); // the world's own map has no floor
    // The view shares the tiles: a brick broken in the map is gone in the view too.
    map.set(2, 13, T.AIR);
    expect(view.get(2, 13)).toBe(T.AIR);
  });

  it('a lava pool: the rim floor above it, and lava itself solid from above', () => {
    // 1-4's first pool: castle floor (surface 10) both sides, lava at row 12, open below.
    // prettier-ignore
    const lv = level([
      '####..####',
      '####..####',
      '####~~####',
      '####..####',
      '####..####',
    ]);
    const floor = new SafetyFloor(new TileMap(lv), lv);
    expect(floor.rowAt(4)).toBe(10);
    expect(floor.at(4, 12)).toBe(true);
    expect(floor.view().collisionAt(5, 12)).toBe('top');
    // Lava with ground under it (no pit) is still solid from above.
    // prettier-ignore
    const pool = level([
      '##~~##',
      '######',
    ]);
    const f2 = new SafetyFloor(new TileMap(pool), pool);
    expect(f2.rowAt(2)).toBe(-1);
    expect(f2.view().collisionAt(2, 13)).toBe('top');
  });

  it('no floor where something solid lies at or below the rim (a bridge); it appears once the bridge is gone', () => {
    // prettier-ignore
    const lv = level([
      '###.....###',
      '###.....###',
      '###-----###',
      '###.....###',
      '###.....###',
    ]);
    const map = new TileMap(lv);
    const floor = new SafetyFloor(map, lv);
    expect(floor.rowAt(5)).toBe(-1);
    map.set(5, 12, T.AIR);
    expect(floor.rowAt(5)).toBe(10);
    expect(floor.rowAt(4)).toBe(-1);
  });

  it('a live pit zone (a fall that leads somewhere) keeps its columns open; a sleeping campaign pit does not', () => {
    const bottom = ['#####........####', '#####........####'];
    const lv = level(bottom, { zones: ['pit 7 -> 1-1 10 0 w=3'] });
    const floor = new SafetyFloor(new TileMap(lv), lv);
    expect([5, 6, 7, 8, 9, 10, 11, 12].map((x) => floor.rowAt(x))).toEqual([13, 13, -1, -1, -1, 13, 13, 13]);
    expect(floor.at(8, 13)).toBe(false);
    // Without `w`: every column from x on.
    const all = level(bottom, { zones: ['pit 7 -> 1-1 10 0'] });
    const f2 = new SafetyFloor(new TileMap(all), all);
    expect([6, 7, 12].map((x) => f2.rowAt(x))).toEqual([13, -1, -1]);
    // `campaign`: asleep, so its fall kills like any other and the floor is there.
    const asleep = level(bottom, { zones: ['pit 7 -> 1-1 10 0 w=3 campaign'] });
    const f3 = new SafetyFloor(new TileMap(asleep), asleep);
    expect(f3.rowAt(8)).toBe(13);
  });

  it('nearest: the closest floored column to a spot, searching outward', () => {
    const lv = level(['#####...####', '#####...####']);
    const floor = new SafetyFloor(new TileMap(lv), lv);
    expect(floor.nearest(6)).toEqual({ tx: 6, row: 13 });
    expect(floor.nearest(2)).toEqual({ tx: 5, row: 13 });
    expect(floor.nearest(11)).toEqual({ tx: 7, row: 13 });
    const solid = level(['####', '####']);
    expect(new SafetyFloor(new TileMap(solid), solid).nearest(1)).toBeNull();
  });
});
