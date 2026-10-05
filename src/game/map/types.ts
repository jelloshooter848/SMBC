/**
 * World map (Super Mario World style): one page per world, nodes joined by paths. This file is
 * the shared contract between the map engine (src/game/map), the pages and their art
 * (src/content/worldmap) and the save files (src/engine/save/save-files.ts).
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
  | 'bowser'; // World 8

export type MapNodeKind = 'start' | 'level' | 'castle' | 'bonus';

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  /** Main level id ('1-2', not '1-2-intro'); absent for 'start'. */
  level?: string;
  /** Tile on the page's 16×15 grid (16 px tiles). */
  x: number;
  y: number;
  /** Bonus nodes only: the secret key that reveals them (in MapProgress.secrets). */
  unlock?: string;
}

export interface MapPath {
  from: string;
  to: string;
  /** Tiles from `from` to `to`, both ends included, each step one tile horizontally or vertically. */
  points: [number, number][];
}

/** The road off the page to another world, starting at a node (usually the castle). */
export interface WorldExit {
  from: string;
  toWorld: number;
  points: [number, number][];
  side: 'right' | 'left' | 'top';
}

/** Decorative animated thing on a page (drawn by src/content/worldmap/render.ts). */
export interface MapActor {
  type: string;
  x: number; // px
  y: number; // px
  props?: Record<string, number | string>;
}

export interface WorldMapPage {
  world: number;
  /** Shown in the map header, e.g. 'GRASS LAND'. */
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
  /** Main level ids cleared ('1-1', '1-2', ...). */
  cleared: string[];
  /** Worlds whose page is reachable (World 1 always; others by a castle clear or a warp). */
  worlds: number[];
  /** Secret keys found (reveal bonus nodes). */
  secrets: string[];
  /** Where the hero stands on the map. */
  position: { world: number; node: string };
}
