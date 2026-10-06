import { getLevel, levelIds } from '@content/levels';
import type { LevelData } from '../level/schema';

/**
 * Levels with more than one way out (Super Mario World's "secret exit" dots), found from the level
 * data: a main level counts when it, or one of its areas (levels whose `parent` leads to it), has
 * a warp zone, or a pipe, vine or pit that leads into another main level than its own and than
 * the one its normal exit leads to. Pipes between a level's own areas (8-4's maze) don't count.
 * Ids are main level ids ('1-2', Lost Levels 'll-5-1'), as map nodes name them.
 */
export function secretExitLevels(): ReadonlySet<string> {
  cached ??= secretExitsIn(levelIds().map((id) => getLevel(id)));
  return cached;
}

/** True when the main level `id` has a secret (alternate) exit; see secretExitLevels. */
export function hasSecretExit(id: string | undefined): boolean {
  return id !== undefined && secretExitLevels().has(id);
}

let cached: ReadonlySet<string> | undefined;

/**
 * The rule behind secretExitLevels, over any set of levels, given in play order (the main level
 * after a level is its next one when it has no flagpole exit).
 */
export function secretExitsIn(levels: readonly LevelData[]): Set<string> {
  const byId = new Map<string, LevelData>(levels.map((l) => [l.id, l]));
  const ids = levels.map((l) => l.id);
  const mainOf = (id: string): string => {
    let at = id;
    for (let hops = 0; hops < 8; hops++) {
      const parent = byId.get(at)?.parent;
      if (!parent || parent === at) return at;
      at = parent;
    }
    return at;
  };
  const families = new Map<string, LevelData[]>();
  for (const level of levels) {
    const main = mainOf(level.id);
    families.set(main, [...(families.get(main) ?? []), level]);
  }
  const mains = ids.filter((id) => mainOf(id) === id);

  const out = new Set<string>();
  for (const [main, family] of families) {
    const zones = family.flatMap((l) => l.zones);
    // Where the normal exit leads: the flagpole's `next`, else the next main level in order.
    const exit = zones.find((z) => z.kind === 'exit');
    const next = exit?.kind === 'exit' ? exit.next : mains[mains.indexOf(main) + 1];
    const elsewhere = zones.some((z) => {
      if (z.kind === 'warp') return true;
      if (z.kind !== 'pipe' && z.kind !== 'vine' && z.kind !== 'pit') return false;
      const to = mainOf(z.target.level);
      return to !== main && to !== next;
    });
    if (elsewhere) out.add(main);
  }
  return out;
}
