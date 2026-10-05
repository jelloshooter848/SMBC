import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import type { LevelData, Zone } from '@game/level/schema';

// Who waits past the axe, checked against the original level data (levelDataSmb.xml and
// levelDataLostLevels.xml): `toad` tokens become Toad, `peach` the princess, and the Toad of a
// level that ends the game (Lost Levels 8-4) becomes the princess, as in the NES game.

const maps = new Map<string, string>();
const walk = (dir: string): void => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if (e.name.endsWith('.map')) maps.set(e.name.slice(0, -4), join(dir, e.name));
  }
};
walk(import.meta.dirname);
const load = (id: string): LevelData => parseTextMap(readFileSync(maps.get(id) as string, 'utf8'), id);
const at = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type).map((e) => [e.x, e.y]);
const exitOf = (l: LevelData) => l.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];

const TOADS: Record<string, number> = {
  '1-4': 153,
  '2-4': 153,
  '3-4': 153,
  '4-4': 313,
  '5-4': 153,
  '6-4': 153,
  '7-4': 345,
  'll-1-4': 153,
  'll-2-4': 153,
  'll-3-4': 319,
  'll-4-4': 217,
  'll-5-4': 217,
  'll-6-4': 345,
  'll-7-4': 249,
  'll-10-4': 185,
  'll-11-4': 249,
  'll-12-4': 249,
};
const PRINCESSES: Record<string, number> = { '8-4-end': 57, 'll-8-4-end3': 137, 'll-13-4-end': 121 };

describe('castle ends: Toad and the princess', () => {
  it.each(Object.entries(TOADS))('%s: Toad stands at column %i, one tile past the exit marker', (id, x) => {
    const l = load(id);
    expect(at(l, 'toad')).toEqual([[x, 12]]);
    expect(at(l, 'princess')).toEqual([]);
    expect(tile(l, x, 13)).toBe(T.CASTLE_BRICK);
    const exit = exitOf(l);
    expect(exit?.x).toBe(x - 1);
    expect(exit?.next).not.toBe('end');
  });

  it.each(Object.entries(PRINCESSES))('%s: the princess waits at column %i and the game ends', (id, x) => {
    const l = load(id);
    expect(at(l, 'princess')).toEqual([[x, 12]]);
    expect(at(l, 'toad')).toEqual([]);
    expect(exitOf(l)).toMatchObject({ x: x - 1, next: 'end' });
  });

  it('no other map has Toad or the princess', () => {
    const withNpc = [...maps.keys()].filter((id) => {
      const l = load(id);
      return l.entities.some((e) => e.type === 'toad' || e.type === 'princess');
    });
    expect(withNpc.sort()).toEqual([...Object.keys(TOADS), ...Object.keys(PRINCESSES)].sort());
  });
});
