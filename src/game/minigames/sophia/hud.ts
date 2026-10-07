import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { HUD_H } from '../../topdown/geometry';
import { drawPiece, LOOK } from './art';
import { GUN_LEVELS } from './jason';

/** What the overhead HUD shows. */
export interface BmHudData {
  /** GUN meter level (1-8) and POW bars (0-max). */
  gun: number;
  pow: number;
  powMax: number;
  /** Lives in reserve (REST). */
  rest: number;
  /** The dungeon's map: rooms seen and the one Jason is in. */
  map: {
    cols: number;
    rows: number;
    visited: readonly (readonly [number, number])[];
    here: readonly [number, number];
  };
  /** The area's name over the map. */
  title: string;
}

/** Where the meters stand: GUN's and POW's columns, the bars' top and each segment's height. */
export const GUN_X = 12;
export const POW_X = 44;
export const METER_TOP = 16;
export const SEGMENT = 5;
const MAP_X = 96;
const MAP_Y = 20;
const CELL_W = 16;
const CELL_H = 8;

/**
 * Blaster Master's overhead HUD in the band over the room: the two upright meters on the left,
 * GUN (8 segments, lit from the bottom up to its level; blue, the top two the wave's cyan) and
 * POW (8 bars of health; red, orange when low), each labelled; the area's name over a small map
 * of the rooms seen; REST and the grenade (endless, as in the original) on the right.
 */
export function drawBmHud(r: Renderer, font: SpriteSheet, sheet: SpriteSheet | null, hud: BmHudData): void {
  r.rect(0, 0, 256, HUD_H, '#000000');
  meter(r, font, 'GUN', GUN_X, hud.gun, GUN_LEVELS, (i) =>
    i >= 6 ? '#3cbcfc' : i >= 4 ? '#0078f8' : '#0058f8',
  );
  const low = hud.pow <= 2;
  meter(r, font, 'POW', POW_X, hud.pow, hud.powMax, () => (low ? '#fca044' : '#f83800'));
  // The map.
  r.text(font, hud.title, MAP_X, 6);
  const mw = hud.map.cols * CELL_W;
  const mh = hud.map.rows * CELL_H;
  r.rect(MAP_X - 1, MAP_Y - 1, mw + 2, mh + 2, '#404040');
  for (const [gx, gy] of hud.map.visited)
    r.rect(MAP_X + gx * CELL_W + 1, MAP_Y + gy * CELL_H + 1, CELL_W - 2, CELL_H - 2, '#007800');
  const [hx, hy] = hud.map.here;
  r.rect(MAP_X + hx * CELL_W + CELL_W / 2 - 2, MAP_Y + hy * CELL_H + CELL_H / 2 - 2, 4, 4, '#58f898');
  // REST and the grenade (endless).
  r.text(font, `REST ${hud.rest}`, 184, 10);
  r.text(font, 'GRENADE', 184, 28);
  drawPiece(r, sheet, 'grenade-0', 208, 42, 8, 8, LOOK.grenade);
}

/** An upright meter of `max` segments, `value` lit from the bottom, its label above. */
function meter(
  r: Renderer,
  font: SpriteSheet,
  label: string,
  x: number,
  value: number,
  max: number,
  color: (i: number) => string,
): void {
  r.text(font, label, x - 8, 4);
  for (let i = 0; i < max; i++) {
    const y = METER_TOP + (max - 1 - i) * SEGMENT;
    r.rect(x, y, 8, SEGMENT - 1, i < value ? color(i) : '#282828');
  }
}
