import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';

/*
 * The Castlevania HUD on a black band over the top two rows, in its three lines:
 *   SCORE-000000 TIME 0300 STAGE 18
 *   PLAYER ████████████████ [box] ♥-05
 *   ENEMY  ████████████████ [box] P-03
 * The PLAYER and ENEMY bars have 16 segments each; the sub-weapon box spans the two bar lines,
 * the hearts sit beside it on the PLAYER line and the lives (P) on the ENEMY line.
 */

/** Segments in each bar. */
export const BAR_SEGMENTS = 16;
/** Height of the HUD band (px). */
export const HUD_H = 32;
/** The three lines' tops (px). */
export const SCORE_Y = 3;
export const PLAYER_Y = 13;
export const ENEMY_Y = 22;
export const BAR_X = 56;
/** The sub-weapon box (spans the PLAYER and ENEMY lines). */
export const BOX = { x: 128, y: 11, w: 28, h: 20 } as const;
/** Hearts and lives column. */
export const COUNT_X = 164;
/** Bar colours: Simon's, the enemy's, an empty segment. */
export const PLAYER_COLOR = '#fca044';
export const ENEMY_COLOR = '#f83800';
export const EMPTY_COLOR = '#503000';

export interface CastleHudState {
  score: number;
  /** Seconds left, or null to leave the time out. */
  time: number | null;
  /** The stage number (STAGE 18: Dracula's). */
  stage: number;
  /** Simon's hit points out of `maxHp`. */
  hp: number;
  maxHp: number;
  /** The enemy bar's segments lit (0..16). */
  enemy: number;
  hearts: number;
  /** The sub-weapon's items-sheet frame, or null for an empty box. */
  sub: string | null;
  /** Lives left (P). */
  lives: number;
}

const pad = (n: number, w: number) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

function bar(r: Renderer, y: number, lit: number, color: string): void {
  for (let i = 0; i < BAR_SEGMENTS; i++) r.rect(BAR_X + i * 4, y, 3, 7, i < lit ? color : EMPTY_COLOR);
}

/** Draws the HUD band. */
export function drawCastleHud(r: Renderer, assets: AssetRegistry, s: CastleHudState): void {
  const font = assets.sheet('font');
  r.rect(0, 0, 256, HUD_H, '#000');
  // Line 1: score, time, stage.
  r.text(font, `SCORE-${pad(s.score, 6)}`, 4, SCORE_Y);
  if (s.time !== null) {
    r.text(font, 'TIME', 108, SCORE_Y);
    r.text(font, pad(s.time, 4), 148, SCORE_Y);
  }
  r.text(font, 'STAGE', 188, SCORE_Y);
  r.text(font, pad(s.stage, 2), 236, SCORE_Y);
  // Lines 2 and 3: the bars.
  r.text(font, 'PLAYER', 4, PLAYER_Y);
  r.text(font, 'ENEMY', 4, ENEMY_Y);
  bar(r, PLAYER_Y, Math.ceil((Math.max(0, s.hp) * BAR_SEGMENTS) / s.maxHp), PLAYER_COLOR);
  bar(r, ENEMY_Y, s.enemy, ENEMY_COLOR);
  // The sub-weapon box over both bar lines.
  r.rect(BOX.x, BOX.y, BOX.w, BOX.h, ENEMY_COLOR);
  r.rect(BOX.x + 1, BOX.y + 1, BOX.w - 2, BOX.h - 2, '#000');
  const items = assets.sheet('items');
  if (s.sub && items.frames.has(s.sub)) r.sprite(items, s.sub, BOX.x + 6, BOX.y + 6);
  // The hearts, then the lives.
  if (items.frames.has('heart-small')) r.sprite(items, 'heart-small', COUNT_X, PLAYER_Y);
  else r.rect(COUNT_X, PLAYER_Y, 8, 8, ENEMY_COLOR);
  r.text(font, `-${pad(s.hearts, 2)}`, COUNT_X + 8, PLAYER_Y);
  r.text(font, `P-${pad(s.lives, 2)}`, COUNT_X, ENEMY_Y);
}
