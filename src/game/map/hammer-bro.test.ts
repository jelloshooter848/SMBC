import { describe, expect, it } from 'vitest';
import { WORLD_4 } from '@content/worldmap/world4';
import { GUARD_STEP_FRAMES, MapGuard, guardRoad } from './hammer-bro';

// The wandering Hammer Bro on World 4's map (docs/WORLD_MAP.md "The bonus spot and its Hammer
// Bro"): he walks tile by tile along the road to the bonus node, never onto 4-2's node.

describe('guardRoad', () => {
  it("is the road from 4-2 to the bonus node, without 4-2's own tile", () => {
    expect(guardRoad(WORLD_4, 'bonus-4')).toEqual([
      [4, 12],
      [4, 13],
      [3, 13],
      [2, 13],
    ]);
  });
});

describe('MapGuard', () => {
  const road = guardRoad(WORLD_4, 'bonus-4');

  it('starts on the road tile farthest from the hero', () => {
    expect(MapGuard.spawn(road, [4, 11], 1).tile).toEqual([2, 13]);
    expect(MapGuard.spawn(road, [2, 13], 1).tile).toEqual([4, 12]);
  });

  it('wanders one tile at a time along the road, staying on it', () => {
    const g = MapGuard.spawn(road, [4, 11], 7);
    const seen = new Set<string>();
    for (let i = 0; i < GUARD_STEP_FRAMES * 60; i++) {
      g.update();
      // Always on the road's line: on a tile, or between two neighbouring ones.
      const onRoad = road.some(
        ([x, y], k) =>
          (g.x === x * 16 && g.y === y * 16) ||
          (road[k + 1] !== undefined &&
            Math.min(x, road[k + 1]![0]) * 16 <= g.x &&
            g.x <= Math.max(x, road[k + 1]![0]) * 16 &&
            Math.min(y, road[k + 1]![1]) * 16 <= g.y &&
            g.y <= Math.max(y, road[k + 1]![1]) * 16),
      );
      expect(onRoad).toBe(true);
      if (g.x % 16 === 0 && g.y % 16 === 0) seen.add(`${g.x / 16},${g.y / 16}`);
    }
    // Over a minute he has been on every tile of the road.
    expect(seen.size).toBe(road.length);
  });

  it('touches the hero within about half a tile', () => {
    const g = MapGuard.spawn(road, [4, 11], 1);
    expect(g.touches(2 * 16, 13 * 16)).toBe(true);
    expect(g.touches(2 * 16 + 10, 13 * 16)).toBe(true);
    expect(g.touches(4 * 16, 11 * 16)).toBe(false);
  });

  it("never steps onto a blocked tile (the hero's tile and road)", () => {
    // The hero stands on the road's middle tile: the guard, spawned at the far end, never
    // reaches it or passes it, and is never even half on it.
    for (const seed of [1, 2, 3, 7, 99]) {
      const g = MapGuard.spawn(road, [3, 13], seed);
      const blocked = (x: number, y: number) => x === 3 && y === 13;
      for (let i = 0; i < GUARD_STEP_FRAMES * 60; i++) {
        g.update(blocked);
        expect(Math.abs(g.x - 3 * 16) >= 16 || Math.abs(g.y - 13 * 16) >= 16).toBe(true);
        expect(g.tile).not.toEqual([3, 13]);
      }
    }
  });

  it('stands still when every neighbour on the road is blocked', () => {
    const g = MapGuard.spawn(road, [4, 11], 1);
    const start = [g.x, g.y];
    for (let i = 0; i < GUARD_STEP_FRAMES * 20; i++) g.update(() => true);
    expect([g.x, g.y]).toEqual(start);
  });
});
