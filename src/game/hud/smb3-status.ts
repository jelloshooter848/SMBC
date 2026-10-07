import { OffsetRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { SCREEN_H } from '@engine/viewport';
import { fxPalette } from '@content/sprites/palette-fx';
import type { GameState } from '../context';
import type { Player } from '../entities/player';
import { worldLabel } from './world-label';
import { pad } from './hud';

/*
 * SMB3's status bar, for the SMB3 pieces (Larry's airship, the Hammer Bro battle, the bonus
 * games): a black band along the bottom of the screen holding a framed panel (WORLD, the P-meter,
 * coins; the hero's badge with his lives, the score, the clock) and three end-card slots. SMB3
 * has no HUD across the top. Original art in SMB3's style, drawn from the pixel rows below; the
 * layout follows the NES game's arrangement (the colours are a guess: white frames on black).
 *
 * A scene using it draws its world SMB3_WORLD_SHIFT px higher (an OffsetRenderer), so the world's
 * rows 2-14 fill the screen above the bar and the bar covers none of the play; rows 0-1 (under
 * SMB1's HUD in the other levels) scroll off the top.
 */

/** The bar's height and top (screen px). */
export const STATUS_BAR_H = 32;
export const STATUS_BAR_Y = SCREEN_H - STATUS_BAR_H;
/** How far up an SMB3 piece draws its world, to make room for the bar. */
export const SMB3_WORLD_SHIFT = STATUS_BAR_H;
/** Arrows on the P-meter before its P. */
export const P_ARROWS = 6;

export interface Smb3Status {
  /** The world number (worldLabel's). */
  world: number;
  /** P-meter arrows lit (0..P_ARROWS; full lights the P). */
  pMeter: number;
  /** The hero's badge letter (SMB3's M or L). */
  initial: string;
  lives: number;
  score: number;
  coins: number;
  /** The clock (null: none, no digits). */
  time: number | null;
  /** The three end-card slots (null: empty). */
  cards: readonly (string | null)[];
}

const WHITE = '#fcfcfc';
const DIM = '#5c5c5c';

/** A P-meter arrow (7×7), the P badge (15×7) and the clock (7×7): `1` lit, `.` clear. */
const ARROW = ['11.....', '1111...', '111111.', '1111111', '111111.', '1111...', '11.....'];
const P_BADGE = [
  '.1111111111111.',
  '11....111111111',
  '11.11.111111111',
  '11....111111111',
  '11.11111111111.',
  '11.1111111111..',
  '.111111111.....',
];
const CLOCK = ['..111..', '.1.1.1.', '1..1..1', '1..111.', '1.....1', '.1...1.', '..111..'];

/** Draws `rows` at (x, y): each run of `1`s as one box of `colour`. */
function drawPixels(r: Renderer, rows: readonly string[], x: number, y: number, colour: string): void {
  rows.forEach((row, dy) => {
    let start = -1;
    for (let dx = 0; dx <= row.length; dx++) {
      const on = row[dx] === '1';
      if (on && start < 0) start = dx;
      else if (!on && start >= 0) {
        r.rect(x + start, y + dy, dx - start, 1, colour);
        start = -1;
      }
    }
  });
}

/** A 1-px frame (corners left open, SMB3's rounded look) around (x, y, w, h). */
function frame(r: Renderer, x: number, y: number, w: number, h: number): void {
  r.rect(x + 1, y, w - 2, 1, WHITE);
  r.rect(x + 1, y + h - 1, w - 2, 1, WHITE);
  r.rect(x, y + 1, 1, h - 2, WHITE);
  r.rect(x + w - 1, y + 1, 1, h - 2, WHITE);
}

/**
 * The bar: the black band, the panel and the card slots. The P blinks once full (held lit with
 * reduce flashing).
 */
export function drawSmb3Status(
  r: Renderer,
  assets: AssetRegistry,
  s: Smb3Status,
  frameNo: number,
  reduceFlashing: boolean,
): void {
  const font = assets.sheet('font');
  const y = STATUS_BAR_Y;
  r.rect(0, y, 256, STATUS_BAR_H, '#000');
  // The panel.
  frame(r, 4, y + 2, 172, 28);
  const row1 = y + 7;
  const row2 = y + 18;
  r.text(font, `WORLD ${worldLabel(s.world)}`, 9, row1);
  const lit = Math.max(0, Math.min(P_ARROWS, s.pMeter));
  for (let i = 0; i < P_ARROWS; i++) drawPixels(r, ARROW, 69 + i * 8, row1, i < lit ? WHITE : DIM);
  const pOn = lit >= P_ARROWS && (reduceFlashing || ((frameNo >> 3) & 1) === 0);
  drawPixels(r, P_BADGE, 118, row1, pOn ? WHITE : DIM);
  r.text(font, `$${pad(Math.min(99, s.coins), 2)}`, 143, row1);
  // The hero's badge: his letter on a white tab, then his lives.
  r.rect(9, row2 - 1, 10, 10, WHITE);
  r.text(assets.sheet('font', fxPalette('font', 'silhouette')), s.initial, 10, row2);
  r.text(font, `×${Math.min(99, Math.max(0, s.lives))}`, 21, row2);
  r.text(font, pad(s.score, 7), 61, row2);
  drawPixels(r, CLOCK, 125, row2, WHITE);
  if (s.time !== null) r.text(font, pad(s.time, 3), 135, row2);
  // The end-card slots.
  for (let i = 0; i < 3; i++) {
    const x = 180 + i * 25;
    r.rect(x, y + 2, 22, 28, DIM);
    r.rect(x + 1, y + 3, 20, 26, '#000');
    frame(r, x, y + 2, 22, 28);
    const card = s.cards[i];
    if (card) r.text(font, card.charAt(0), x + 7, y + 12);
  }
}

/** P-meter arrows for `p`'s speed: none at a walk or slower, all at full run speed. */
export function pMeter(p: Player | null): number {
  if (!p) return 0;
  const { maxWalk, maxRun } = p.profile;
  if (maxRun <= maxWalk) return 0;
  const k = (Math.abs(p.body.vx) - maxWalk) / (maxRun - maxWalk);
  return Math.max(0, Math.min(P_ARROWS, Math.floor(k * P_ARROWS + 1e-9)));
}

/** The bar's fields for the run `state` with player one `p` and the clock `time`. */
export function smb3Status(state: GameState, p: Player | null, time: number | null): Smb3Status {
  return {
    world: state.world,
    pMeter: pMeter(p),
    initial: state.character.hudName.charAt(0),
    lives: state.lives,
    score: state.score,
    coins: state.coins,
    time,
    cards: [null, null, null],
  };
}

/** Draws `world` moved up by SMB3_WORLD_SHIFT (its rows 2-14 above the bar). */
export function renderSmb3World(r: Renderer, world: { render(r: Renderer): void }): void {
  world.render(new OffsetRenderer(r, 0, -SMB3_WORLD_SHIFT));
}
