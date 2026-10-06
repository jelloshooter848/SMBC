import { ROOM_COLS, ROOM_ROWS, TILE, type Side } from './geometry';

/**
 * Text rooms. A room is 11 strings of 16 characters, one per tile, read like a map:
 *
 *   #######XX#######     # wall          . floor        : floor (alternate look)
 *   #..............#     B block         S statue       ~ water        = stairs
 *   #...BBBPBBB....#     O open door     L locked door  X shutter door E exit doorway
 *   #......o.......O     @ player start  P push block   o block plate  _ floor switch
 *   ...                  t torch (unlit) T torch (lit)  k key  h heart H heart container
 *                        f heart refill  c chest        C cracked wall
 *                        b bat           n knight       r rock-spitter
 *
 * A cracked wall (C) is a wall a blast opens (world.ts). On the border it is a doorway that
 * starts shut (door kind `cracked`); inside the room it is a wall cell that becomes floor.
 * A chest (c) holds what the room's `chests` list says, in reading order.
 * Doors sit on the border (not a corner); a door's side is the edge it is on, and every door cell
 * on one side has the same kind (north and south doorways are two cells wide, east and west one).
 * Everything after the tile itself (spawns: enemies, blocks, switches, pickups) stands on floor.
 * A game adds its own spawn characters with `extraLegend` (e.g. a boss).
 */

export type TileKind =
  'floor' | 'floor-alt' | 'wall' | 'cracked' | 'block' | 'statue' | 'water' | 'stairs' | 'door' | 'exit';
/** `cracked`: a doorway walled up with cracked stone until a blast opens it. */
export type DoorKind = 'open' | 'locked' | 'shutter' | 'cracked';
/**
 * A room condition: every enemy gone, every block plate held down by a block, every floor switch
 * pressed, every torch lit. Met once, it stays met for the run (the room remembers).
 */
export type Cond = 'clear' | 'plates' | 'switches' | 'torches';

export interface LegendEntry {
  tile: TileKind;
  door?: DoorKind;
  /** Spawn kind placed on this tile (see world.ts spawners). */
  spawn?: string;
}

export const LEGEND: Readonly<Record<string, LegendEntry>> = {
  '#': { tile: 'wall' },
  '.': { tile: 'floor' },
  ':': { tile: 'floor-alt' },
  B: { tile: 'block' },
  S: { tile: 'statue' },
  '~': { tile: 'water' },
  '=': { tile: 'stairs' },
  E: { tile: 'exit' },
  O: { tile: 'door', door: 'open' },
  L: { tile: 'door', door: 'locked' },
  X: { tile: 'door', door: 'shutter' },
  '@': { tile: 'floor', spawn: 'start' },
  P: { tile: 'floor', spawn: 'push-block' },
  o: { tile: 'floor', spawn: 'plate' },
  _: { tile: 'floor', spawn: 'switch' },
  t: { tile: 'floor', spawn: 'torch' },
  T: { tile: 'floor', spawn: 'torch-lit' },
  k: { tile: 'floor', spawn: 'key' },
  h: { tile: 'floor', spawn: 'heart' },
  H: { tile: 'floor', spawn: 'heart-container' },
  f: { tile: 'floor', spawn: 'refill' },
  c: { tile: 'floor', spawn: 'chest' },
  C: { tile: 'cracked' },
  b: { tile: 'floor', spawn: 'bat' },
  n: { tile: 'floor', spawn: 'knight' },
  r: { tile: 'floor', spawn: 'spitter' },
};

export interface RoomDef {
  id: string;
  /** The room's cell on the dungeon map (column, row); neighbours share an edge. */
  at: readonly [number, number];
  /** 11 rows of 16 characters (see LEGEND). */
  map: readonly string[];
  /** What opens this room's shutter doors. They stay open until the player has stepped in. */
  shutters?: Cond;
  /** Pickups in the room stay hidden until this is met (a key that appears when the room is clear). */
  reveal?: Cond;
  /** Music id while in this room (the game's default otherwise). */
  music?: string;
  /** Read to screen readers when the room is first entered. */
  hint?: string;
  /** Free-form flag a game may use (e.g. a darker palette for a boss room). */
  dark?: boolean;
  /** What each chest (c) holds, in reading order: an item id or a pickup kind (world.ts `grant`). */
  chests?: readonly string[];
}

export interface Spawn {
  kind: string;
  col: number;
  row: number;
  /** Top-left of the tile in room pixels. */
  x: number;
  y: number;
}

export interface Room {
  readonly id: string;
  readonly gx: number;
  readonly gy: number;
  readonly def: RoomDef;
  /** Row-major, ROOM_COLS × ROOM_ROWS. */
  readonly tiles: readonly TileKind[];
  readonly doors: Readonly<Partial<Record<Side, DoorKind>>>;
  /** Each doorway's cells along its edge (columns for north/south, rows for east/west). */
  readonly doorCells: Readonly<Partial<Record<Side, readonly number[]>>>;
  /** Spawns in reading order (left to right, top to bottom). */
  readonly spawns: readonly Spawn[];
  /** Where the player starts when the game starts in this room (tile top-left), if marked. */
  readonly start: { x: number; y: number } | null;
}

/** The edge a border cell is on, or null inside the room or on a corner. */
export function sideOf(col: number, row: number): Side | null {
  const top = row === 0;
  const bottom = row === ROOM_ROWS - 1;
  const left = col === 0;
  const right = col === ROOM_COLS - 1;
  if ((top || bottom) && (left || right)) return null;
  if (top) return 'n';
  if (bottom) return 's';
  if (left) return 'w';
  if (right) return 'e';
  return null;
}

export function isBorder(col: number, row: number): boolean {
  return row === 0 || col === 0 || row === ROOM_ROWS - 1 || col === ROOM_COLS - 1;
}

/** Parses one room; throws with the room id, row and column on any mistake. */
export function parseRoom(def: RoomDef, extraLegend: Readonly<Record<string, LegendEntry>> = {}): Room {
  const where = (r: number, c?: number) => `room "${def.id}" row ${r}${c === undefined ? '' : ` col ${c}`}`;
  if (def.map.length !== ROOM_ROWS)
    throw new Error(`room "${def.id}": ${def.map.length} rows, expected ${ROOM_ROWS}`);
  const tiles: TileKind[] = [];
  const doors: Partial<Record<Side, DoorKind>> = {};
  const doorCells: Partial<Record<Side, number[]>> = {};
  const spawns: Spawn[] = [];
  let start: { x: number; y: number } | null = null;
  def.map.forEach((line, row) => {
    if (line.length !== ROOM_COLS)
      throw new Error(`${where(row)}: ${line.length} columns, expected ${ROOM_COLS}`);
    for (let col = 0; col < ROOM_COLS; col++) {
      const ch = line[col] as string;
      const found = extraLegend[ch] ?? LEGEND[ch];
      if (!found) throw new Error(`${where(row, col)}: unknown character "${ch}"`);
      const side = sideOf(col, row);
      // A cracked wall on the border is a doorway a blast opens.
      const e: LegendEntry = found.tile === 'cracked' && side ? { tile: 'door', door: 'cracked' } : found;
      if (e.door) {
        if (!side)
          throw new Error(`${where(row, col)}: a door must be on an edge, not inside or on a corner`);
        const had = doors[side];
        if (had && had !== e.door)
          throw new Error(`${where(row, col)}: the ${side} doorway mixes ${had} and ${e.door} cells`);
        doors[side] = e.door;
        (doorCells[side] ??= []).push(side === 'n' || side === 's' ? col : row);
      } else if (isBorder(col, row) && e.tile !== 'wall' && e.tile !== 'exit') {
        throw new Error(`${where(row, col)}: the border must be wall, door or exit (got "${ch}")`);
      }
      tiles.push(e.tile);
      if (e.spawn === 'start') {
        if (start) throw new Error(`${where(row, col)}: a second player start`);
        start = { x: col * TILE, y: row * TILE };
      } else if (e.spawn) spawns.push({ kind: e.spawn, col, row, x: col * TILE, y: row * TILE });
    }
  });
  if (Object.values(doors).includes('shutter') && !def.shutters)
    throw new Error(`room "${def.id}": shutter doors need a \`shutters\` condition`);
  const chests = spawns.filter((s) => s.kind === 'chest').length;
  if (chests !== (def.chests?.length ?? 0))
    throw new Error(`room "${def.id}": ${chests} chests but ${def.chests?.length ?? 0} in \`chests\``);
  return { id: def.id, gx: def.at[0], gy: def.at[1], def, tiles, doors, doorCells, spawns, start };
}

export function tileAt(room: Room, col: number, row: number): TileKind | null {
  if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return null;
  return room.tiles[row * ROOM_COLS + col] ?? null;
}

/**
 * A whole dungeon: rooms keyed by id and by map cell. Checks that every door leads to a
 * neighbouring room with a doorway on the facing edge.
 */
export interface Dungeon {
  readonly rooms: ReadonlyMap<string, Room>;
  readonly startRoom: string;
  /** Map size in cells (for the minimap). */
  readonly cols: number;
  readonly rows: number;
  roomAt(gx: number, gy: number): Room | null;
}

const SIDE_STEP: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const FACING: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

export function neighbourCell(room: Room, side: Side): [number, number] {
  const [dx, dy] = SIDE_STEP[side];
  return [room.gx + dx, room.gy + dy];
}

export function buildDungeon(
  defs: readonly RoomDef[],
  extraLegend: Readonly<Record<string, LegendEntry>> = {},
): Dungeon {
  const rooms = new Map<string, Room>();
  const byCell = new Map<string, Room>();
  let startRoom: string | null = null;
  let cols = 0;
  let rows = 0;
  for (const d of defs) {
    const room = parseRoom(d, extraLegend);
    if (rooms.has(room.id)) throw new Error(`room "${room.id}" is defined twice`);
    const cell = `${room.gx},${room.gy}`;
    if (byCell.has(cell))
      throw new Error(`rooms "${byCell.get(cell)?.id}" and "${room.id}" share cell ${cell}`);
    rooms.set(room.id, room);
    byCell.set(cell, room);
    if (room.start) {
      if (startRoom) throw new Error(`rooms "${startRoom}" and "${room.id}" both have a player start`);
      startRoom = room.id;
    }
    cols = Math.max(cols, room.gx + 1);
    rows = Math.max(rows, room.gy + 1);
  }
  if (!startRoom) throw new Error('no room has a player start (@)');
  const roomAt = (gx: number, gy: number) => byCell.get(`${gx},${gy}`) ?? null;
  for (const room of rooms.values()) {
    for (const side of Object.keys(room.doors) as Side[]) {
      const [gx, gy] = neighbourCell(room, side);
      const next = roomAt(gx, gy);
      if (!next) throw new Error(`room "${room.id}": the ${side} door leads nowhere`);
      if (!next.doors[FACING[side]])
        throw new Error(`room "${room.id}": the ${side} door meets a wall in room "${next.id}"`);
      if (String(room.doorCells[side]) !== String(next.doorCells[FACING[side]]))
        throw new Error(`room "${room.id}": the ${side} door does not line up with room "${next.id}"'s`);
    }
  }
  return { rooms, startRoom, cols, rows, roomAt };
}
