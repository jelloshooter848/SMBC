/**
 * World map (Super Mario World style): pages of nodes joined by paths. This file is the shared
 * contract between the map engine (src/game/map), the pages and their art (src/content/worldmap)
 * and the save files (src/game/save/save-files.ts). docs/WORLD_MAP.md explains how to add a page.
 */

/** Look of a map page; each has its own palette and scenery. */
export type MapTheme =
  | 'grass' // World 1
  | 'sea' // World 2
  | 'night' // World 3
  | 'mushroom' // World 4
  | 'sky' // World 5
  | 'snow' // World 6
  | 'coast' // World 7
  | 'bowser' // World 8
  | 'warp'; // Warp Zone hub

/**
 * A page's id: 'smb-1'..'smb-8' (Super Mario Bros. worlds), 'hub' (the Warp Zone) and
 * 'll-1'..'ll-13' (Lost Levels worlds 1-8, 9 and A-D). Saved in files; never rename one.
 */
export type PageId = string;

/**
 * The set of pages a page belongs to: page order (slides, the Worlds menu) and the start-node
 * "back" road only work within a group; travel between groups is by warp node (a fade).
 */
export type PageGroup = 'smb' | 'hub' | 'll';

/**
 * Something that must hold for a warp node to work or a world exit to open:
 * - 'gameCleared': SMB 8-4 beaten on this file (MapProgress.gameCleared);
 * - 'secret:<key>': the file has found secret <key> (MapProgress.secrets);
 * - 'll9': the file has cleared all 32 Lost Levels main levels 1-1 to 8-4 (World 9);
 * - 'llLetters': the file has cleared Lost 8-4 (worlds A-D);
 * - 'never': not yet (a future secret).
 */
export type MapCondition = 'gameCleared' | 'll9' | 'llLetters' | 'never' | `secret:${string}`;

export type MapNodeKind = 'start' | 'level' | 'castle' | 'bonus' | 'warp';

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  /**
   * Main level id ('1-2', not '1-2-intro'; Lost Levels 'll-1-2'); absent for 'warp'. A 'start'
   * node may carry one (World 1's start is Mario's tutorial stage '1-0'): it stays the page's
   * arrival node, JUMP on it enters the level, and its roads open once the level is cleared.
   */
  level?: string;
  /** Tile on the page's 16×15 grid (16 px tiles). */
  x: number;
  y: number;
  /**
   * The secret key that reveals the node (in MapProgress.secrets): required on bonus nodes,
   * optional on warp nodes (hidden until found); other kinds don't use it.
   */
  unlock?: string;
  /**
   * Warp nodes: the page jumping on it takes the hero to. A 'start' node may carry it too (and
   * the other warp fields): it stays the page's arrival node (arriving never warps), and JUMP
   * on it warps (the hub's centre: back to World 1). See rules.isWarpNode.
   */
  to?: PageId;
  /**
   * Warp nodes: the node arrived on (default: the target page's start node). Portals pair 1:1:
   * the node arrived on warps straight back here (pages.test.ts checks it) unless `oneWay`.
   */
  toNode?: string;
  /** Warp nodes: a one-way portal, exempt from the 1:1 pairing (none yet). */
  oneWay?: boolean;
  /** Warp nodes: what must hold for the warp to work (always works when absent). */
  requires?: MapCondition;
  /** Warp nodes: the hint line while it is locked ('LOST LEVELS - BEAT 8-4 TO UNLOCK'). */
  hint?: string;
  /** Warp nodes: the hint line while it is open ('LOST LEVELS'; default: the target page's title). */
  label?: string;
  /**
   * Level nodes hiding a captive hero (map/captives.ts): the side of the node its silhouette and
   * trophy stand on. Default: the right, or the left when a road leaves the node to the right.
   */
  heroSpot?: 'left' | 'right';
}

/**
 * Which way out of a level opens a road (Super Mario World's secret exits): 'normal' (the level's
 * flagpole or castle, recorded in MapProgress.cleared) or 'secret:<key>' (a secret exit, recorded
 * as the key in MapProgress.secrets; the level does not count as cleared).
 */
export type PathExit = 'normal' | `secret:${string}`;

export interface MapPath {
  from: string;
  to: string;
  /**
   * The exit of `from`'s level that opens this road (rules.pathExit). Default: 'secret:<key>' when
   * `to` is hidden by `unlock: '<key>'`, else 'normal'. Only roads leaving a node with a `level`
   * use it (a start's roads open with its level's normal clear, a warp node's while it works).
   */
  exit?: PathExit;
  /** Tiles from `from` to `to`, both ends included, each step one tile horizontally or vertically. */
  points: [number, number][];
}

/** The road off the page to the next page of the same group, starting at a node (usually the castle). */
export interface WorldExit {
  from: string;
  to: PageId;
  points: [number, number][];
  side: 'right' | 'left' | 'top';
  /** Opens only while this holds too (e.g. Lost Levels 8 → 9: 'll9'). */
  requires?: MapCondition;
  /**
   * The hint line while the hero stands on `from` and the exit is locked (at most 32 chars once
   * '{n}' is filled in with the condition's count, rules.exitHint).
   */
  hint?: string;
}

/** Decorative animated thing on a page (drawn by src/content/worldmap/render.ts). */
export interface MapActor {
  type: string;
  x: number; // px
  y: number; // px
  props?: Record<string, number | string>;
}

export interface WorldMapPage {
  id: PageId;
  group: PageGroup;
  /** Shown in the header's top right: 'WORLD 1', 'WARP ZONE', 'LOST A' (at most 10 chars). */
  label: string;
  /** Shown in the header's top left, e.g. 'GRASS LAND' (at most 20 chars). */
  title: string;
  theme: MapTheme;
  /** Song id to loop on this page. */
  music: string;
  /** 15 rows of 16 legend chars (see src/content/worldmap/render.ts). */
  tiles: string[];
  nodes: MapNode[];
  paths: MapPath[];
  exits: WorldExit[];
  actors: MapActor[];
}

/** The part of a save file the map rules read and write. */
export interface MapProgress {
  /** Main level ids cleared ('1-1', '1-2', ..., 'll-1-1'). */
  cleared: string[];
  /** Pages that are reachable ('smb-1' always; others by a castle clear, a warp pipe or a warp node). */
  pages: PageId[];
  /** Secret keys found (reveal bonus and warp nodes; `secret:<key>` conditions). */
  secrets: string[];
  /** Where the hero stands on the map. */
  position: { page: PageId; node: string };
  /** SMB 8-4 beaten on this file (the 'gameCleared' condition); absent counts as false. */
  gameCleared?: boolean;
}
