import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';

/*
 * The Castlevania HUD on a black band over the top two rows: PLAYER and ENEMY bars (16 segments
 * each), the time, the hearts and the sub-weapon box.
 */

/** Segments in each bar. */
export const BAR_SEGMENTS = 16;
/** Height of the HUD band (px). */
export const HUD_H = 30;
export const BAR_X = 64;
export const PLAYER_Y = 6;
export const ENEMY_Y = 17;
/** Bar colours: Simon's, the enemy's, an empty segment. */
export const PLAYER_COLOR = '#fca044';
export const ENEMY_COLOR = '#f83800';
export const EMPTY_COLOR = '#503000';

export interface CastleHudState {
  /** Simon's hit points out of `maxHp`. */
  hp: number;
  maxHp: number;
  /** The enemy bar's segments lit (0..16). */
  enemy: number;
  hearts: number;
  /** Seconds left, or null to leave the time out. */
  time: number | null;
  /** The sub-weapon's items-sheet frame, or null for an empty box. */
  sub: string | null;
}

const pad = (n: number, w: number) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

function bar(r: Renderer, y: number, lit: number, color: string): void {
  for (let i = 0; i < BAR_SEGMENTS; i++) r.rect(BAR_X + i * 4, y, 3, 7, i < lit ? color : EMPTY_COLOR);
}

/** Draws the HUD band. */
export function drawCastleHud(r: Renderer, assets: AssetRegistry, s: CastleHudState): void {
  const font = assets.sheet('font');
  r.rect(0, 0, 256, HUD_H, '#000');
  r.text(font, 'PLAYER', 8, PLAYER_Y);
  r.text(font, 'ENEMY', 8, ENEMY_Y);
  bar(r, PLAYER_Y, Math.ceil((Math.max(0, s.hp) * BAR_SEGMENTS) / s.maxHp), PLAYER_COLOR);
  bar(r, ENEMY_Y, s.enemy, ENEMY_COLOR);
  if (s.time !== null) {
    r.text(font, 'TIME', 144, PLAYER_Y);
    r.text(font, pad(s.time, 4), 184, PLAYER_Y);
  }
  // The sub-weapon box, then the hearts.
  r.rect(144, ENEMY_Y - 2, 28, 12, '#f83800');
  r.rect(145, ENEMY_Y - 1, 26, 10, '#000');
  const items = assets.sheet('items');
  if (s.sub && items.frames.has(s.sub)) r.sprite(items, s.sub, 150, ENEMY_Y);
  if (items.frames.has('heart-small')) r.sprite(items, 'heart-small', 184, ENEMY_Y);
  else r.rect(184, ENEMY_Y, 8, 8, '#f83800');
  r.text(font, `-${pad(s.hearts, 2)}`, 192, ENEMY_Y);
}
