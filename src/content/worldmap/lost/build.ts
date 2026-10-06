import type { MapNode, PageId } from '@game/map/types';

/*
 * Helpers for the Lost Levels map pages (docs/WORLD_MAP.md): page ids 'll-1'..'ll-9' then
 * 'll-10'..'ll-13' for worlds A-D, labels 'LOST 1'..'LOST 9', 'LOST A'..'LOST D', group 'll'.
 */

/** World number (1-13, as the level files number them) to its page id. */
export const lostPageId = (w: number): PageId => `ll-${w}`;

/** World number (1-13) to its header label: worlds 10-13 are A-D. */
export const lostLabel = (w: number): string => `LOST ${w <= 9 ? w : 'ABCD'[w - 10]}`;

/** Node id of the warp back to the Warp Zone hub; every page has one. */
export const HUB_WARP = 'hub';

/**
 * The standard node set of Lost Levels world `w` (1-13): start, ll-W-1..ll-W-3, the ll-W-4 castle
 * and a warp back to the hub. Node ids are the main level ids, so a level id finds its node.
 */
export function lostNodes(
  w: number,
  start: [number, number],
  levels: [[number, number], [number, number], [number, number], [number, number]],
  hub: [number, number],
): MapNode[] {
  return [
    { id: 'start', kind: 'start', x: start[0], y: start[1] },
    ...levels.map(([x, y], i): MapNode => ({
      id: `ll-${w}-${i + 1}`,
      kind: i === 3 ? 'castle' : 'level',
      level: `ll-${w}-${i + 1}`,
      x,
      y,
    })),
    { id: HUB_WARP, kind: 'warp', to: 'hub', label: 'RETURN TO WARP ZONE', x: hub[0], y: hub[1] },
  ];
}

/** The id fields every Lost Levels page shares, from its world number (1-13). */
export const lostPageIds = (w: number) => ({ id: lostPageId(w), label: lostLabel(w), group: 'll' }) as const;
