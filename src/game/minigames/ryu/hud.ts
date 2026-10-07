import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';

/*
 * The Ninja Gaiden HUD on a black band over the top two rows: TIMER and the NINJA bar on the
 * first line, the ninpo box (the art in hand and the spirit points) and the ENEMY bar on the
 * second (16 segments each). No score: the stage's World has `scorePopups: false`.
 */

/** Segments in each bar. */
export const BAR_SEGMENTS = 16;
/** Height of the HUD band (px). */
export const HUD_H = 30;
export const LINE_1 = 6;
export const LINE_2 = 18;
export const BAR_X = 168;
/** Bar colours: Ryu's, the enemy's, an empty segment. */
export const NINJA_COLOR = '#fca044';
export const ENEMY_COLOR = '#f83800';
export const EMPTY_COLOR = '#503000';

export interface NgHudState {
  /** Ryu's hit points out of `maxHp`. */
  hp: number;
  maxHp: number;
  /** The enemy bar's segments lit (0..16). */
  enemy: number;
  /** Spirit points (ninpo). */
  ninpo: number;
  /** Seconds left. */
  time: number;
  /** The items-sheet icon of the art in hand, or null for an empty box. */
  art: string | null;
}

const pad = (n: number, w: number) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

function bar(r: Renderer, y: number, lit: number, color: string): void {
  for (let i = 0; i < BAR_SEGMENTS; i++) r.rect(BAR_X + i * 4, y, 3, 7, i < lit ? color : EMPTY_COLOR);
}

/** Draws the HUD band. */
export function drawNgHud(r: Renderer, assets: AssetRegistry, s: NgHudState): void {
  const font = assets.sheet('font');
  r.rect(0, 0, 256, HUD_H, '#000');
  r.text(font, `TIMER-${pad(s.time, 3)}`, 8, LINE_1);
  r.text(font, 'NINJA', 120, LINE_1);
  r.text(font, 'ENEMY', 120, LINE_2);
  bar(r, LINE_1, Math.ceil((Math.max(0, s.hp) * BAR_SEGMENTS) / s.maxHp), NINJA_COLOR);
  bar(r, LINE_2, s.enemy, ENEMY_COLOR);
  // The ninpo box: the art in hand, then the spirit points.
  r.rect(8, LINE_2 - 2, 12, 12, ENEMY_COLOR);
  r.rect(9, LINE_2 - 1, 10, 10, '#000');
  const items = assets.sheet('items');
  if (s.art && items.frames.has(s.art)) r.sprite(items, s.art, 10, LINE_2);
  r.text(font, `NINPO-${pad(s.ninpo, 2)}`, 24, LINE_2);
}
