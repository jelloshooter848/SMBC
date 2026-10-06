import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';

// The Lost Levels' coin heavens (area TYPE="coinHeaven" in levelDataLostLevels.xml) are skinned
// by the original's TG_COIN_HEAVEN / TG_COIN_HEAVEN_GRAY theme groups, which draw every
// groundNormal tile as the cloud block: floors, ledges and 9-3's cloud ceiling alike. The counts
// are the groundNormal cells visible on normal difficulty.

const load = (world: number, id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, `world${world}`, `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const count = (l: LevelData, id: number) => Array.from(l.tiles).filter((t) => t === id).length;

const HEAVENS: [number, string, number, number][] = [
  // world, area, cloud blocks in all, cloud blocks on the floor row (13)
  [2, 'll-2-1-sky', 99, 83],
  [3, 'll-3-1-sky', 99, 83],
  [4, 'll-4-1-sky', 99, 83],
  [5, 'll-5-1-sky', 111, 95],
  [8, 'll-8-3-sky', 111, 95],
  [9, 'll-9-3-sky', 240, 60],
  [10, 'll-10-1-sky', 85, 70],
  [11, 'll-11-1-sky', 85, 70],
  [12, 'll-12-1-sky', 85, 70],
  [13, 'll-13-2-sky', 85, 70],
];

describe('Lost Levels coin heavens stand on cloud blocks', () => {
  it.each(HEAVENS)('world %i %s: clouds instead of ground', (world, id, all, floor) => {
    const l = load(world, id);
    expect(count(l, T.GROUND)).toBe(0);
    expect(count(l, T.CLOUD_BLOCK)).toBe(all);
    let row = 0;
    for (let x = 0; x < l.width; x++) if (tile(l, x, 13) === T.CLOUD_BLOCK) row++;
    expect(row).toBe(floor);
    // The vine comes up through the gap at column 4, with clouds on both sides.
    expect(tile(l, 3, 13)).toBe(T.CLOUD_BLOCK);
    expect(tile(l, 4, 13)).toBe(T.AIR);
    expect(tile(l, 5, 13)).toBe(T.CLOUD_BLOCK);
  });
  it('keeps the bricks of a coin heaven as bricks', () => {
    expect(count(load(2, 'll-2-1-sky'), T.BRICK)).toBe(8);
    expect(count(load(3, 'll-3-1-sky'), T.BRICK)).toBe(8);
  });
  it("9-3's gray coin heaven: the cloud bank over the coins is clouds too", () => {
    const l = load(9, 'll-9-3-sky');
    for (const [x, y] of [
      [32, 2],
      [47, 9],
      [60, 5],
    ] as const)
      expect(tile(l, x, y)).toBe(T.CLOUD_BLOCK);
  });
});
