import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { Game } from '../scenes/game';
import { BONUS_MUSIC, BONUS_SFX, CARD_H, CARD_W, drawCard, drawItem } from './art';
import { BonusScene, centred, fitLine, HINT_Y, type BonusResult } from './common';
import {
  boardFaces,
  cardPrize,
  MEMORY_COLS,
  MEMORY_MISSES,
  MEMORY_ROWS,
  MemoryGame,
  NSPADE_BOARDS,
  type Card,
  type CardFace,
} from './rules';

/** Grid layout: left edge, top, and the distance between cards. */
export const GRID_X = 40;
export const GRID_Y = 48;
export const PITCH_X = 32;
export const PITCH_Y = 32;
/** Frames a miss stays face up before turning back. */
export const MISS_FRAMES = 50;

const FACE_NAMES: Readonly<Record<CardFace, string>> = {
  mushroom: 'Mushroom',
  flower: 'Fire Flower',
  star: 'Starman',
  '1up': '1-up',
  coin10: '10 coins',
  coin20: '20 coins',
};

/**
 * SMB3's N-spade: the file's board (one of a fixed set dealt in turn, rules.ts NSPADE_BOARDS), 3
 * rows of 6 face down, less the pairs found on earlier visits. Move the cursor (it passes over
 * the pairs already taken) and TURN two at a time; a matching pair wins its prize (items to the
 * inventory, 1-ups and coins at once) and stays
 * gone on the next visit (Game.bonus.spadeTaken, saved), until the board is cleared and the next
 * one comes. Two misses end it, as does clearing the board. A round for fun leaves the file's
 * board as it was.
 */
/**
 * The N-spade cursor's next spot from (col, row) one step along (dc, dr), passing over taken
 * cards. Left and right wrap round the row. Up and down go to the next row that way (wrapping)
 * with any card left: the same column if its card is there, else that row's nearest card (ties:
 * right). So every card left can always be reached.
 */
export function cursorStep(
  taken: (col: number, row: number) => boolean,
  col: number,
  row: number,
  dc: number,
  dr: number,
): [number, number] {
  if (dc) {
    for (let k = 1; k < MEMORY_COLS; k++) {
      const c = (col + dc * k + MEMORY_COLS * k) % MEMORY_COLS;
      if (!taken(c, row)) return [c, row];
    }
    return [col, row];
  }
  for (let k = 1; k < MEMORY_ROWS; k++) {
    const r = (row + dr * k + MEMORY_ROWS * k) % MEMORY_ROWS;
    if (!taken(col, r)) return [col, r];
    for (let d = 1; d < MEMORY_COLS; d++)
      for (const c of [col + d, col - d]) if (c >= 0 && c < MEMORY_COLS && !taken(c, r)) return [c, r];
  }
  return [col, row];
}

export class MemoryScene extends BonusScene {
  protected music = BONUS_MUSIC.game;
  readonly board: MemoryGame;
  col = 0;
  row = 0;
  /** The frame the last miss was shown, or null. */
  private missT: number | null = null;

  constructor(game: Game, seed: number, onEnd: (r: BonusResult) => void) {
    super(game, 'memory', seed, onEnd);
    const b = game.bonus;
    this.board = new MemoryGame(boardFaces(b.spadeBoard), b.spadeTaken);
    this.offTaken();
  }

  /** A card already taken (a pair found, on this visit or an earlier one): the cursor passes over it. */
  private taken(col: number, row: number): boolean {
    return this.board.cards[row * MEMORY_COLS + col]?.matched ?? true;
  }

  /** Moves the cursor off a taken card, to the next card left on the board in reading order. */
  private offTaken(): void {
    const n = MEMORY_COLS * MEMORY_ROWS;
    for (let k = 0; k < n; k++) {
      const i = (this.cursor + k) % n;
      if (this.board.cards[i]?.matched) continue;
      this.col = i % MEMORY_COLS;
      this.row = Math.floor(i / MEMORY_COLS);
      return;
    }
  }

  /** The cursor's next spot one step along (dc, dr), passing over taken cards (`cursorStep`). */
  private step(dc: number, dr: number): [number, number] {
    return cursorStep((c, r) => this.taken(c, r), this.col, this.row, dc, dr);
  }

  get cursor(): number {
    return this.row * MEMORY_COLS + this.col;
  }

  protected get decided(): boolean {
    return this.board.over;
  }

  protected intro(): string {
    return `${this.board.left} cards. Turn two at a time to find a pair; a pair wins its prize. Two misses end the game. Arrows move, ${this.hint('turn', 'jump')} turns a card. ${this.where()}`;
  }

  private where(): string {
    const c = this.board.cards[this.cursor] as Card;
    const state = c.gone ? 'gone' : c.up ? FACE_NAMES[c.face] : 'face down';
    return `Row ${this.row + 1}, card ${this.col + 1}, ${state}.`;
  }

  protected playLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: this.board.canFlip(this.cursor) ? 'TURN' : null };
  }

  protected play(input: InputFrame): void {
    const b = this.board;
    if (this.missT !== null) {
      if (this.t - this.missT < MISS_FRAMES) return;
      this.missT = null;
      b.hideMiss();
    }
    if (b.over) return this.decide();
    for (const [a, dc, dr] of [
      ['left', -1, 0],
      ['right', 1, 0],
      ['up', 0, -1],
      ['down', 0, 1],
    ] as const) {
      if (!input.pressed(a)) continue;
      [this.col, this.row] = this.step(dc, dr);
      this.sfx(BONUS_SFX.move);
      this.say(this.where());
      return;
    }
    if (input.pressed('jump')) this.turn(this.cursor);
  }

  /** Turns card `i` as TURN would on it. */
  turn(i: number): void {
    const b = this.board;
    const res = b.flip(i);
    if (res === 'invalid') {
      this.sfx(BONUS_SFX.miss);
      return;
    }
    this.markPlayed();
    this.sfx(BONUS_SFX.flip);
    const face = (b.cards[i] as Card).face;
    if (res === 'first') {
      this.say(`${FACE_NAMES[face]}. Find its pair.`);
      return;
    }
    if (res === 'match') {
      this.sfx(BONUS_SFX.win);
      this.keepPair();
      this.offTaken();
      this.award(cardPrize(face));
      if (!b.over) this.say(this.where());
      if (b.over) this.decide();
      return;
    }
    const left = MEMORY_MISSES - b.misses;
    this.say(`${FACE_NAMES[face]}. No match. ${left ? `${left} miss left.` : 'No misses left.'}`);
    this.missT = this.t;
  }

  /**
   * The pair just found stays gone on the next visit; a cleared board gives way to the next one.
   * Saved with the prize (awardPrize saves). Not in a round for fun.
   */
  private keepPair(): void {
    const pair = this.board.lastPair;
    if (this.game.inRound || !pair) return;
    const b = this.game.bonus;
    if (this.board.cleared) {
      b.spadeBoard = (b.spadeBoard + 1) % NSPADE_BOARDS.length;
      b.spadeTaken = [];
    } else b.spadeTaken = [...b.spadeTaken, ...pair].sort((x, y) => x - y);
  }

  private decide(): void {
    const n = this.prizes.length;
    this.finish(
      n === 0
        ? ['NO PAIRS THIS TIME.']
        : this.board.cleared
          ? ['EVERY PAIR FOUND!', `${n} PRIZES WON.`]
          : [n === 1 ? '1 PAIR FOUND.' : `${n} PAIRS FOUND.`],
    );
  }

  protected draw(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    r.clear('#000');
    // A green felt table with a spade-red rim.
    r.rect(16, 24, 224, 146, '#d82800');
    r.rect(20, 28, 216, 138, '#00a800');
    centred(r, font, 'N-SPADE', 8);
    const b = this.board;
    const left = MEMORY_MISSES - b.misses;
    centred(r, font, `MISSES LEFT ${left}`, 36);
    b.cards.forEach((c, i) => {
      // A pair found on an earlier visit is gone from the board.
      if (c.gone) return;
      const x = GRID_X + (i % MEMORY_COLS) * PITCH_X;
      const y = GRID_Y + Math.floor(i / MEMORY_COLS) * PITCH_Y;
      drawCard(r, assets, c.up ? c.face : null, x, y);
    });
    if (!this.over) {
      // The cursor: a white frame around the card (steady, never blinking).
      const x = GRID_X + this.col * PITCH_X - 3;
      const y = GRID_Y + this.row * PITCH_Y - 3;
      const w = CARD_W + 6;
      const h = CARD_H + 6;
      r.rect(x, y, w, 2, '#fcfcfc');
      r.rect(x, y + h - 2, w, 2, '#fcfcfc');
      r.rect(x, y, 2, h, '#fcfcfc');
      r.rect(x + w - 2, y, 2, h, '#fcfcfc');
    }
    // The prizes won so far, along the bottom of the table.
    b.found.forEach((f, i) => {
      const x = 28 + i * 20;
      if (f === 'coin10' || f === 'coin20') drawCard(r, assets, f, x, 144 - 8);
      else drawItem(r, assets, f, x, 144);
    });
    if (!this.over && !this.banner) {
      const full = `ARROWS MOVE  ${this.hint('TURN', 'jump')}`;
      centred(r, font, fitLine(full, 'ARROWS MOVE  TURN'), HINT_Y);
    }
  }
}
