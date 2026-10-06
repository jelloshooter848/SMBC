import type { Renderer } from '@engine/gfx/renderer';
import { HUD_H } from './geometry';
import { drawFrame, fontOf, type TdView } from './view';
import type { TopDownWorld } from './world';

export interface TdHudData {
  /** Above the minimap (a dungeon's name). */
  title: string;
  /** Half hearts. */
  hp: number;
  maxHp: number;
  keys: number;
  /** Ammo counts beside the keys (bombs): the item's icon and how many. */
  counters: readonly { frame: string; count: number }[];
  map: {
    cols: number;
    rows: number;
    visited: readonly (readonly [number, number])[];
    here: readonly [number, number];
  };
  /** The item boxes, left to right: each named by its ability, with its icon (tile sheet) or empty. */
  boxes: readonly { label: string; frame: string | null }[];
}

/**
 * The HUD for a world: visited rooms on the map, the hero's hearts, keys and ammo, and the item
 * boxes the game names (e.g. the item slot labelled ITEM, then the sword).
 */
export function hudData(world: TopDownWorld, title: string, boxes: TdHudData['boxes']): TdHudData {
  const d = world.dungeon;
  const visited = world
    .visited()
    .map((id) => d.rooms.get(id))
    .filter((r) => r !== undefined)
    .map((r) => [r.gx, r.gy] as const);
  return {
    title,
    hp: world.hero.hp,
    maxHp: world.hero.maxHp,
    keys: world.keys,
    counters: world.inv.withAmmo().map((it) => ({ frame: it.icon, count: world.inv.count(it.id) })),
    map: {
      cols: Math.max(4, d.cols),
      rows: Math.max(4, d.rows),
      visited,
      here: [world.room.gx, world.room.gy],
    },
    boxes,
  };
}

export const MAP_X = 8;
export const MAP_Y = 20;
const CELL_W = 16;
const CELL_H = 8;
/** The counters column (keys, then ammo), the right-hand item box, and the life meter. */
export const COUNTERS_X = 76;
export const LAST_BOX_X = 152;
const BOX_STEP = 40;
export const HEARTS_X = 184;

/**
 * A Zelda-style HUD in the top 64 px: the dungeon's name over a small map (rooms seen in blue,
 * the current one with a green mark), the keys held and ammo counts, the item boxes named by
 * their abilities, and the life meter in whole, half and empty hearts (eight to a row).
 */
export function drawTdHud(r: Renderer, view: TdView, hud: TdHudData): void {
  const font = fontOf(view);
  const tiles = view.sheet(view.sheets.tiles);
  r.rect(0, 0, 256, HUD_H, '#000000');
  // Map.
  r.text(font, hud.title, MAP_X, 6);
  const mw = hud.map.cols * CELL_W;
  const mh = hud.map.rows * CELL_H;
  r.rect(MAP_X - 1, MAP_Y - 1, mw + 2, mh + 2, '#404040');
  for (const [gx, gy] of hud.map.visited)
    r.rect(MAP_X + gx * CELL_W + 1, MAP_Y + gy * CELL_H + 1, CELL_W - 2, CELL_H - 2, '#2038ec');
  const [hx, hy] = hud.map.here;
  r.rect(MAP_X + hx * CELL_W + CELL_W / 2 - 2, MAP_Y + hy * CELL_H + CELL_H / 2 - 2, 4, 4, '#00e800');
  // Keys, then ammo.
  const counters = [{ frame: 'key', count: hud.keys }, ...hud.counters];
  counters.forEach((c, i) => {
    const y = 20 + i * 16;
    drawFrame(r, tiles, c.frame, COUNTERS_X, y, c.frame === 'key' ? '#f8b800' : '#2038ec', { w: 8, h: 16 });
    r.text(font, `×${c.count}`, COUNTERS_X + 10, y + 4);
  });
  // Item boxes.
  hud.boxes.forEach((box, i) => {
    const bx = LAST_BOX_X - (hud.boxes.length - 1 - i) * BOX_STEP;
    r.text(font, box.label, bx + 12 - box.label.length * 4, 10);
    r.rect(bx, 22, 24, 30, '#2038ec');
    r.rect(bx + 2, 24, 20, 26, '#000000');
    if (box.frame) drawFrame(r, tiles, box.frame, bx + 8, 29, '#fcfcfc', { w: 8, h: 16 });
  });
  // Life.
  r.text(font, '-LIFE-', HEARTS_X + 8, 10);
  const hearts = Math.ceil(hud.maxHp / 2);
  for (let i = 0; i < hearts; i++) {
    const left = hud.hp - i * 2;
    const frame = left >= 2 ? 'heart' : left === 1 ? 'heart-half' : 'heart-empty';
    const x = HEARTS_X + (i % 8) * 8;
    const y = 30 + Math.floor(i / 8) * 10;
    const color = left >= 2 ? '#f83800' : left === 1 ? '#a81000' : '#404040';
    drawFrame(r, tiles, frame, x, y, color, { w: 7, h: 7 });
  }
}
