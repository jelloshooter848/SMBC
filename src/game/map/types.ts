/**
 * World map (Super Mario World style): pages of nodes joined by paths. This file is the shared
 * contract between the map engine (src/game/map), the pages and their art (src/content/worldmap)
 * and the save files (src/game/save/save-files.ts). docs/WORLD_MAP.md explains how to add a page.
 */

/** Look of a map page; each has its own palette and scenery. */
export type MapTheme =
  | 'grass' // World 1
  | 'sea' // the Lost Levels' sea worlds (World 2's until 0.4.24)
  | 'night' // World 3's until 0.4.26; the Lost Levels' night worlds
  | 'mushroom' // World 4's until 0.4.27; the Lost Levels' mushroom worlds
  | 'sky' // World 5's until 0.4.28; the Lost Levels' sky worlds
  | 'snow' // World 6's until 0.4.29; the Lost Levels' snow worlds
  | 'coast' // World 7's until 0.4.30
  | 'bowser' // World 8's until 0.4.31; the Lost Levels' World 8
  | 'warp' // Warp Zone hub
  | 'arena' // the Mini Game Arena
  | 'hyrule' // World 2 since 0.4.24: Link's Hyrule
  | 'megaman' // World 3 since 0.4.26: Mega Man's MEGA CITY
  | 'zebes' // World 4 since 0.4.27: Samus's PLANET ZEBES
  | 'transylvania' // World 5 since 0.4.28: Simon's TRANSYLVANIA
  | 'ninja' // World 6 since 0.4.29: Ryu's DRAGON VALLEY
  | 'contra' // World 7 since 0.4.30: Bill's GALUGA ISLAND
  | 'blaster'; // World 8 since 0.4.31: Sophia's BOWSER'S UNDERWORLD

/**
 * A page's id: 'smb-1'..'smb-8' (Super Mario Bros. worlds), 'hub' (the Warp Zone),
 * 'll-1'..'ll-13' (Lost Levels worlds 1-8, 9 and A-D) and 'arena' (the Mini Game Arena, off the
 * hub). Saved in files; never rename one.
 */
export type PageId = string;

/**
 * The set of pages a page belongs to (page order, the Worlds menu). 'smb' and 'll' are one story:
 * SMB World 8's castle road leads on to Lost World 1 (a slide, and back from its start); other
 * travel between groups is by warp node (a fade).
 */
export type PageGroup = 'smb' | 'hub' | 'll' | 'arena';

/**
 * Something that must hold for a warp node to work or a world exit to open:
 * - 'gameCleared': SMB 8-4 beaten on this file (MapProgress.gameCleared);
 * - 'secret:<key>': the file has found secret <key> (MapProgress.secrets);
 * - 'never': not yet (a future secret).
 * (0.4.7 dropped the Lost Levels' NES unlocks 'll9' and 'llLetters': in the campaign their worlds
 * open in order, each castle opening the next, docs/WORLD_MAP.md.)
 */
export type MapCondition = 'gameCleared' | 'never' | `secret:${string}`;

/**
 * 'game': a pad of the Mini Game Arena (src/game/arena): JUMP plays one round of its `game`, for
 * fun; nothing is saved. Walked to like any node.
 */
export type MapNodeKind = 'start' | 'level' | 'castle' | 'bonus' | 'warp' | 'game';

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
  /**
   * Bonus nodes: a wandering guard on the road to it (map/hammer-bro.ts). 'hammer-bro': once the
   * bonus has been used, a Hammer Bro walks that road; touching him starts a battle whose win
   * opens the bonus again (World 4's bonus spot, docs/WORLD_MAP.md).
   */
  guard?: 'hammer-bro';
  /** 'game' nodes: the arena game played there (src/game/arena ArenaGame.id, e.g. 'mini-luigi'). */
  game?: string;
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

/**
 * The road off the page to the next page, starting at a node (usually the castle). Exits lead to
 * a page of the same group, except SMB World 8's road on to Lost World 1 (the story goes on).
 */
export interface WorldExit {
  from: string;
  to: PageId;
  points: [number, number][];
  side: 'right' | 'left' | 'top';
  /** Opens only while this holds too (none does yet). */
  requires?: MapCondition;
  /** The hint line while the hero stands on `from` and the exit is locked (at most 32 chars). */
  hint?: string;
  /**
   * The world gate (docs/STORY.md 2.3b, campaign only): the hero (CharacterDef id) hidden in this
   * world, whom the file must have freed before the road opens (rules.gateHolds). SMB worlds 1-8
   * (World 8's is the rift on to Lost World 1).
   */
  gate?: string;
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
  /**
   * The file's freed heroes, for the world gates (WorldExit.gate). Not saved from here (the save
   * file has its own `freed`); absent means no gate holds (classic play, older tests).
   */
  freed?: readonly string[];
}
