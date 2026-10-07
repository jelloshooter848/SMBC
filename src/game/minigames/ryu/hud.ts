import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';

/*
 * The Ninja Gaiden HUD on a black band over the top two rows, in its three lines:
 *   SCORE-000000      STAGE-6-2
 *   TIMER-150  [box]  NINJA-████████████████
 *   P-03 ✦-10  [box]  ENEMY-████████████████
 * The ninpo box (the art in hand) spans the lower two lines; the spirit points sit beside the
 * lives (P) under the timer. The bars have 16 segments each. No point popups float up: the
 * stage's World has `scorePopups: false`, and the score lives up here.
 */

/** Segments in each bar. */
export const BAR_SEGMENTS = 16;
/** Height of the HUD band (px); everything is drawn above y 30 (the top banner slot's box). */
export const HUD_H = 32;
/** The three lines' tops (px). */
export const LINE_0 = 2;
export const LINE_1 = 12;
export const LINE_2 = 21;
export const BAR_X = 160;
/** The ninpo box (spans lines 1 and 2). */
export const BOX = { x: 88, y: 10, w: 20, h: 20 } as const;
/** Bar colours: Ryu's, the enemy's, an empty segment. */
export const NINJA_COLOR = '#fca044';
export const ENEMY_COLOR = '#f83800';
export const EMPTY_COLOR = '#503000';
/** The spirit-points mark's colour. */
export const SPIRIT_COLOR = '#fca044';

export interface NgHudState {
  score: number;
  /** "6-2". */
  stage: string;
  /** Lives left (P). */
  lives: number;
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

/** The spirit mark before the points: a small flame. */
function spirit(r: Renderer, x: number, y: number): void {
  r.rect(x + 3, y, 2, 2, SPIRIT_COLOR);
  r.rect(x + 2, y + 2, 4, 2, SPIRIT_COLOR);
  r.rect(x + 1, y + 4, 6, 3, SPIRIT_COLOR);
  r.rect(x + 3, y + 5, 2, 2, '#000');
}

/** Draws the HUD band. */
export function drawNgHud(r: Renderer, assets: AssetRegistry, s: NgHudState): void {
  const font = assets.sheet('font');
  r.rect(0, 0, 256, HUD_H, '#000');
  r.text(font, `SCORE-${pad(s.score, 6)}`, 8, LINE_0);
  r.text(font, `STAGE-${s.stage}`, 120, LINE_0);
  r.text(font, `TIMER-${pad(s.time, 3)}`, 8, LINE_1);
  r.text(font, `P-${pad(s.lives, 2)}`, 8, LINE_2);
  spirit(r, 44, LINE_2);
  r.text(font, `-${pad(s.ninpo, 2)}`, 52, LINE_2);
  // The ninpo box: the art in hand.
  r.rect(BOX.x, BOX.y, BOX.w, BOX.h, ENEMY_COLOR);
  r.rect(BOX.x + 1, BOX.y + 1, BOX.w - 2, BOX.h - 2, '#000');
  const items = assets.sheet('items');
  if (s.art && items.frames.has(s.art)) r.sprite(items, s.art, BOX.x + 6, BOX.y + 6);
  r.text(font, 'NINJA-', 112, LINE_1);
  r.text(font, 'ENEMY-', 112, LINE_2);
  bar(r, LINE_1, Math.ceil((Math.max(0, s.hp) * BAR_SEGMENTS) / s.maxHp), NINJA_COLOR);
  bar(r, LINE_2, s.enemy, ENEMY_COLOR);
}
