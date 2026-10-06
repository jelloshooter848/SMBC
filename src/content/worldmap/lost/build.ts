import type { MapNode, MapNodeKind, WorldExit, WorldMapPage } from '@game/map/types';

/*
 * Shapes for the Lost Levels map pages, ahead of the engine change that gives pages string ids.
 *
 * TODO(H0): these mirror the contract the engine change is adding (string page ids 'll-1'..'ll-13',
 * labels, group 'll', warp nodes, exit conditions). When it lands, replace the local types below
 * with the ones from @game/map/types and drop the `world` / `toWorld` number placeholders.
 */

/** Page id of a Lost Levels map page: 'll-1'..'ll-9', then 'll-10'..'ll-13' for worlds A-D. */
export type LostPageId = `ll-${number}`;

/** Save conditions that open a road or a warp (TODO(H0): the engine's condition type). */
export type MapCondition =
  | 'll9' // World 9: Lost Levels 8-4 cleared without a warp zone
  | 'llLetters'; // Worlds A-D: the Lost Levels beaten 8 times

/** Kinds of node on a Lost Levels page: the SMB kinds plus a warp spot (TODO(H0)). */
export type LostNodeKind = MapNodeKind | 'warp';

export interface LostNode extends Omit<MapNode, 'kind'> {
  kind: LostNodeKind;
  /** Warp nodes only: where they lead, another page or the Warp Zone hub. */
  to?: LostPageId | 'hub';
  /** Warp nodes only: the condition that opens them; absent = always open. */
  requires?: MapCondition;
}

/** The road off the page to the next world (TODO(H0): `toWorld` is a placeholder for `to`). */
export interface LostExit extends WorldExit {
  to: LostPageId;
  requires?: MapCondition;
}

export interface LostMapPage extends Omit<WorldMapPage, 'nodes' | 'exits'> {
  id: LostPageId;
  /** Shown in the map header and the Worlds menu: 'LOST 1'..'LOST 9', 'LOST A'..'LOST D'. */
  label: string;
  group: 'll';
  nodes: LostNode[];
  exits: LostExit[];
}

/** World number (1-13, as the level files number them) to its page id. */
export const lostPageId = (w: number): LostPageId => `ll-${w}`;

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
): LostNode[] {
  return [
    { id: 'start', kind: 'start', x: start[0], y: start[1] },
    ...levels.map(([x, y], i): LostNode => ({
      id: `ll-${w}-${i + 1}`,
      kind: i === 3 ? 'castle' : 'level',
      level: `ll-${w}-${i + 1}`,
      x,
      y,
    })),
    { id: HUB_WARP, kind: 'warp', to: 'hub', x: hub[0], y: hub[1] },
  ];
}

/** The id fields every Lost Levels page shares, from its world number (1-13). */
export const lostPageIds = (w: number) =>
  ({
    id: lostPageId(w),
    label: lostLabel(w),
    group: 'll',
    world: w, // TODO(H0): numeric placeholder; drop once pages are keyed by `id`.
  }) as const;
