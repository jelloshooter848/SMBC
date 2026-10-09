import type { LevelData } from '../level/schema';
import { T, tileDef } from '../level/tiles';
import type { World } from '../world/world';

/*
 * The secret house (design section 4): its door loads the side-view Top Secret Area, unchanged
 * but for its look (a cosy house inside, the level's campaign look) and one rule: its blocks
 * refill once per visit to the village, not on every entry. The village remembers which blocks
 * were opened during the visit (nothing is saved) and hands them to the level as it loads, which
 * lays them as used blocks. The next visit from the map starts with all five full.
 */

/** The secret that is set the first time the village is entered (the map label, the guard's hello). */
export const KAKARIKO = 'kakariko';
/** The level the secret house's door loads. */
export const SECRET_HOUSE_LEVEL = '2-top-secret';

/** The ? blocks of `level` that `world` has used up ("x,y"). */
export function openedBlocks(level: LevelData, world: World): string[] {
  const out: string[] = [];
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const was = level.tiles[y * level.width + x] ?? 0;
      if (tileDef(was).block?.kind !== 'question') continue;
      if (world.map.get(x, y) === T.USED) out.push(`${x},${y}`);
    }
  return out;
}

/** Lays the blocks opened earlier in the visit as used blocks. */
export function layUsedBlocks(world: World, used: Iterable<string>): void {
  for (const key of used) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    world.map.set(x, y, T.USED);
  }
}
