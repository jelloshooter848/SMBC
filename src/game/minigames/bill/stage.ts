/*
 * Jungle Assault's stage: an NES Contra stage 1-style jungle, built from spans (below) rather than
 * a level file, because Contra's ground is not SMB's: every grass ledge is a one-way floor (Bill
 * jumps up through it and drops down through it), the rock under a ledge is scenery, and the
 * river along the bottom is water Bill wades and dives in. Nothing here is in the level library,
 * the dev level select or the campaign.
 *
 * The map is 15 rows of 16 px. The river's surface is row 13's top (y 208); the ledge tiers are
 * rows 11, 9 and 7 (y 176, 144, 112), 32 px apart: one somersault jump apart. A bank (a floor
 * flush with the water, row 13) ends every stretch of river, and Bill climbs out onto it.
 *
 * The route (columns): the drop zone (0-29: a high ledge, a rifleman on the upper ledge, a
 * flying capsule) -> exploding bridge 1 (30-37) -> the first pillbox (on the lower ledge, 38-52) -> exploding
 * bridge 2 (53-60) -> tiers down to the river (61-89: a capsule, a wall gun on a crag) -> the
 * bank (90-96) and back up (a pop-up cannon) -> tiers and the second river (112-149: riflemen,
 * a bush sniper, a capsule) -> the second pillbox (the spread gun's) -> the last ledges (160-187:
 * a wall gun, a pop-up cannon, a capsule) -> the base floor and the defense wall (188-207, the
 * camera locks at 192) -> through the broken wall, a short drop into Red Falcon's lair (208-223,
 * the camera locks again).
 */

export const COLS = 224;
export const ROWS = 15;
export const TILE = 16;

/** Cell kinds. Floors: LEDGE and BRIDGE (one-way, droppable), BASE and LAIR_FLOOR (one-way, not). */
export const C = {
  AIR: 0,
  LEDGE: 1,
  ROCK: 2,
  BASE: 3,
  WATER: 4,
  DEEP: 5,
  BRIDGE: 6,
  LAIR_FLOOR: 7,
  LAIR_WALL: 8,
  LAIR_FLESH: 9,
} as const;
export type Cell = (typeof C)[keyof typeof C];

/** The river's surface (px): the top of row 13. */
export const WATER_Y = 13 * TILE;
/** Tier floor tops (px). */
export const TIER = { high: 7 * TILE, mid: 9 * TILE, low: 11 * TILE, bank: 13 * TILE } as const;
/** The base floor before the defense wall (px) and the lair's floor. */
export const BASE_Y = 12 * TILE;
export const LAIR_Y = 13 * TILE;
/** The camera's left edge (px) for the defense wall fight and for Red Falcon's lair. */
export const WALL_CAM = 192 * TILE;
export const LAIR_COL = 208;
export const LAIR_CAM = LAIR_COL * TILE;
/** The defense wall's face (px): Bill cannot pass it until it falls. */
export const WALL_X = 202 * TILE;
/** Where Bill starts (px: centre x, feet y). */
export const START = { x: 40, y: TIER.mid } as const;

export type WeaponId = 'M' | 'S' | 'L' | 'F' | 'R' | 'B';

/** Fixed foes and pickups, in stage order (x, y in px: the centre of the bottom edge, its feet). */
export type Placed =
  | { type: 'rifleman'; x: number; y: number; bush?: boolean }
  | { type: 'wall-gun'; x: number; y: number }
  | { type: 'cannon'; x: number; y: number }
  | { type: 'pillbox'; x: number; y: number; weapon: WeaponId }
  /** A capsule flies in from the left edge once Bill passes `x`, its flight line at `y`. */
  | { type: 'capsule'; x: number; y: number; weapon: WeaponId };

/** Running soldiers come in from the screen's edge while Bill is in columns x0..x1-1. */
export interface SoldierZone {
  x0: number;
  x1: number;
  /** Frames between soldiers (give or take a quarter, seeded). */
  every: number;
  /** Every `left`-th soldier comes from the left edge (0: never). */
  left: number;
}

export interface Bridge {
  /** First column, the number of 16-px segments, the floor row. */
  col: number;
  len: number;
  row: number;
}

export interface JungleStage {
  cells: Uint8Array;
  placed: Placed[];
  zones: SoldierZone[];
  bridges: Bridge[];
}

const at = (col: number, row: number) => row * COLS + col;

/** The stage, built once (cells are copied per round: bridges blow up). */
let built: JungleStage | null = null;
export function jungleStage(): JungleStage {
  if (built) return built;
  const cells = new Uint8Array(COLS * ROWS);
  const set = (x: number, y: number, c: Cell) => {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) cells[at(x, y)] = c;
  };
  // The river under everything up to the base.
  for (let x = 0; x < 188; x++) {
    set(x, 13, C.WATER);
    set(x, 14, C.DEEP);
  }
  const ledges: [row: number, x0: number, x1: number][] = [];
  const ledge = (row: number, x0: number, x1: number) => ledges.push([row, x0, x1]);
  const bank = (x0: number, x1: number) => {
    for (let x = x0; x < x1; x++) {
      set(x, 13, C.BASE);
      set(x, 14, C.ROCK);
    }
  };
  const bridges: Bridge[] = [];
  const bridge = (row: number, col: number, len: number) => bridges.push({ col, len, row });

  // The drop zone.
  ledge(9, 0, 30);
  ledge(7, 9, 16);
  ledge(11, 18, 28);
  bank(26, 30);
  bridge(9, 30, 8);
  // The first pillbox.
  bank(38, 42);
  ledge(9, 38, 53);
  ledge(11, 42, 50);
  bridge(9, 53, 8);
  // Tiers down to the river; the crag with the first wall gun.
  bank(61, 69);
  ledge(9, 61, 73);
  ledge(11, 67, 80);
  ledge(7, 83, 90);
  bank(90, 97);
  ledge(11, 93, 104);
  ledge(9, 100, 117);
  // Tiers and the second river.
  ledge(7, 112, 124);
  ledge(11, 115, 137);
  bank(117, 121);
  bank(146, 152);
  ledge(11, 150, 162);
  // The last ledges.
  ledge(9, 160, 190);
  ledge(7, 166, 174);

  // Rock under every ledge down to the river (scenery), then the ledges over it.
  for (const [row, x0, x1] of ledges)
    for (let x = x0; x < x1; x++) for (let y = row + 1; y < 13; y++) set(x, y, C.ROCK);
  for (const [row, x0, x1] of ledges) for (let x = x0; x < x1; x++) set(x, row, C.LEDGE);
  for (const b of bridges) for (let i = 0; i < b.len; i++) set(b.col + i, b.row, C.BRIDGE);

  // The base: a floor up to the wall and on through it, one row over the lair's.
  for (let x = 188; x < LAIR_COL; x++) {
    set(x, 12, C.BASE);
    set(x, 13, C.ROCK);
    set(x, 14, C.ROCK);
  }
  // Red Falcon's lair: organic walls behind, flesh overhead, a floor 16 px down.
  for (let x = LAIR_COL; x < COLS; x++) {
    for (let y = 0; y < 2; y++) set(x, y, C.LAIR_FLESH);
    for (let y = 2; y < 13; y++) set(x, y, C.LAIR_WALL);
    set(x, 13, C.LAIR_FLOOR);
    set(x, 14, C.LAIR_FLOOR);
  }

  const px = (col: number) => col * TILE + 8;
  const placed: Placed[] = [
    { type: 'capsule', x: px(6), y: 72, weapon: 'M' },
    { type: 'rifleman', x: px(13), y: TIER.high },
    { type: 'rifleman', x: px(44), y: TIER.mid, bush: true },
    // Down on the lower ledge: drop through to reach it.
    { type: 'pillbox', x: 47 * TILE + 8, y: TIER.low, weapon: 'R' },
    { type: 'capsule', x: px(64), y: 88, weapon: 'L' },
    { type: 'rifleman', x: px(77), y: TIER.low },
    { type: 'wall-gun', x: 84 * TILE, y: 10 * TILE },
    { type: 'capsule', x: px(99), y: 96, weapon: 'F' },
    { type: 'cannon', x: px(110), y: TIER.mid },
    { type: 'rifleman', x: px(121), y: TIER.high },
    { type: 'rifleman', x: px(130), y: TIER.low, bush: true },
    { type: 'pillbox', x: 157 * TILE, y: TIER.low, weapon: 'S' },
    { type: 'wall-gun', x: 167 * TILE, y: TIER.mid },
    { type: 'capsule', x: px(170), y: 80, weapon: 'B' },
    { type: 'cannon', x: px(183), y: TIER.mid },
  ];
  const zones: SoldierZone[] = [
    { x0: 4, x1: 29, every: 210, left: 0 },
    { x0: 38, x1: 53, every: 190, left: 0 },
    { x0: 61, x1: 82, every: 180, left: 3 },
    { x0: 93, x1: 137, every: 170, left: 4 },
    { x0: 150, x1: 186, every: 160, left: 3 },
  ];
  built = { cells, placed, zones, bridges };
  return built;
}

/** The stage drawn as text, a row a line (tests and tuning): the legend is the cell kinds. */
export function stageAscii(cells: Uint8Array = jungleStage().cells): string[] {
  const ch = ['.', '=', '#', '_', '~', 'w', '-', 'o', 'O', 'M'];
  const out: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let line = '';
    for (let x = 0; x < COLS; x++) line += ch[cells[at(x, y)] ?? 0];
    out.push(line);
  }
  return out;
}
