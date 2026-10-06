import type { Renderer } from '@engine/gfx/renderer';
import { DIR_VEC, HUD_H, ROOM_COLS, ROOM_H, ROOM_ROWS, ROOM_W, SIDE_DIR, TILE, type Side } from './geometry';
import { sideOf, tileAt, type Room, type TileKind } from './room';
import type { TdView } from './view';
import type { TopDownWorld } from './world';

/** Flat colours used when the tile art is missing. */
const PLACEHOLDER: Record<TileKind | 'door-open' | 'door-locked' | 'door-shut', string> = {
  floor: '#183c5c',
  'floor-alt': '#1c4870',
  wall: '#0c2440',
  block: '#4878a8',
  statue: '#7c7c7c',
  water: '#0058f8',
  stairs: '#404040',
  door: '#000000',
  exit: '#f8d878',
  'door-open': '#000000',
  'door-locked': '#ac7c00',
  'door-shut': '#5c5c5c',
};

type DoorLook = 'open' | 'locked' | 'shut';

/**
 * Draws one room's tiles with its top-left at (ox, oy). Edge walls use `wall-top` (north, flipped
 * for south) and `wall-top-side` (west, flipped for east), corners `wall-corner`, inner walls
 * `wall`. Doors are drawn for the north edge and flipped for the south; east and west use the
 * `-side` frames (made by rotation, frames.ts). A two-cell doorway (and exit) draws one 16-px door
 * centred across its cells, from the `-l` / `-r` halves (frames.ts).
 */
export function drawRoomTiles(
  r: Renderer,
  view: TdView,
  room: Room,
  door: (side: Side) => DoorLook,
  ox: number,
  oy: number,
): void {
  const pal = room.def.dark && view.sheets.tilesDark ? view.sheets.tilesDark : undefined;
  const sheet = view.sheet(view.sheets.tiles, pal);
  const put = (frame: string, x: number, y: number, fallback: string, fx = false, fy = false) => {
    if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y, fx, fy);
    else r.rect(x, y, TILE, TILE, fallback);
  };
  for (let row = 0; row < ROOM_ROWS; row++)
    for (let col = 0; col < ROOM_COLS; col++) {
      const x = ox + col * TILE;
      const y = oy + row * TILE;
      if (x <= -TILE || x >= ROOM_W || y <= -TILE || y >= 240) continue;
      const t = tileAt(room, col, row) as TileKind;
      const side = sideOf(col, row);
      switch (t) {
        case 'wall': {
          const left = col === 0;
          const right = col === ROOM_COLS - 1;
          const top = row === 0;
          const bottom = row === ROOM_ROWS - 1;
          if ((left || right) && (top || bottom)) put('wall-corner', x, y, PLACEHOLDER.wall, right, bottom);
          else if (side === 'n' || side === 's') put('wall-top', x, y, PLACEHOLDER.wall, false, side === 's');
          else if (side === 'w' || side === 'e') put('wall-top-side', x, y, PLACEHOLDER.wall, side === 'e');
          else put('wall', x, y, PLACEHOLDER.wall);
          break;
        }
        case 'door': {
          const s = side as Side;
          const name = `door-${door(s)}` as const;
          const cells = room.doorCells[s] ?? [];
          if (s === 'e' || s === 'w') put(`${name}-side`, x, y, PLACEHOLDER[name], s === 'e');
          else if (cells.length === 2)
            put(`${name}-${col === cells[0] ? 'l' : 'r'}`, x, y, PLACEHOLDER[name], false, s === 's');
          else put(name, x, y, PLACEHOLDER[name], false, s === 's');
          break;
        }
        case 'exit': {
          const f = view.reduceFlashing ? 'exit-0' : `exit-${(view.frame >> 4) & 1}`;
          const pair =
            tileAt(room, col - 1, row) === 'exit' ? 'r' : tileAt(room, col + 1, row) === 'exit' ? 'l' : null;
          put(pair ? `${f}-${pair}` : f, x, y, PLACEHOLDER.exit, false, side === 's');
          break;
        }
        default:
          put(t, x, y, PLACEHOLDER[t]);
      }
    }
}

/** How a doorway of the room on screen looks right now. */
function liveDoor(world: TopDownWorld, side: Side): DoorLook {
  const kind = world.room.doors[side];
  if (kind === 'locked' && !world.doorOpen(side)) return 'locked';
  if (kind === 'shutter' && !world.doorOpen(side)) return 'shut';
  return 'open';
}

/** How a doorway of a room being slid away from looks (its memory; shutters as last seen). */
function pastDoor(world: TopDownWorld, room: Room, side: Side, left: Side): DoorLook {
  const kind = room.doors[side];
  const st = world.state(room.id);
  if (kind === 'locked' && !st.unlocked.has(side)) return 'locked';
  if (kind === 'shutter' && side !== left && room.def.shutters && !st.met.has(room.def.shutters))
    return 'shut';
  return 'open';
}

/**
 * Draws the play area (y from HUD_H down): the room, its entities and the hero; during a slide,
 * the room left behind and the new one moving in together, the hero riding with the new one.
 */
export function renderWorld(r: Renderer, base: TdView, world: TopDownWorld): void {
  const dark = world.room.def.dark && base.sheets.tilesDark ? base.sheets.tilesDark : undefined;
  const view: TdView = {
    frame: base.frame,
    reduceFlashing: base.reduceFlashing,
    sheets: base.sheets,
    sheet: base.sheet,
    tilePalette: dark,
  };
  let ox = 0;
  let oy = HUD_H;
  const tr = world.transition;
  if (tr) {
    const v = DIR_VEC[SIDE_DIR[tr.side]];
    const span = v.dx !== 0 ? ROOM_W : ROOM_H;
    const shift = Math.round((tr.t / tr.frames) * span);
    drawRoomTiles(
      r,
      view,
      tr.from,
      (s) => pastDoor(world, tr.from, s, tr.side),
      -v.dx * shift,
      HUD_H - v.dy * shift,
    );
    ox = v.dx * (span - shift);
    oy = HUD_H + v.dy * (span - shift);
  }
  drawRoomTiles(r, view, world.room, (s) => liveDoor(world, s), ox, oy);
  const byLayer = (l: number) => world.entities.filter((e) => e.layer === l && !e.dead);
  for (const e of byLayer(0)) e.render(r, view, ox, oy);
  for (const e of byLayer(1)) e.render(r, view, ox, oy);
  world.hero.render(r, view, ox, oy);
  for (const e of byLayer(2)) e.render(r, view, ox, oy);
  for (const e of byLayer(3)) e.render(r, view, ox, oy);
}
