import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { passphraseOpens, type DevLock } from '../dev-lock';
import { abilityHint } from './hints';
import { CARD_GUARD_FRAMES } from './message';
import type { Game } from './game';

/*
 * The dev-mode passphrase prompt (0.5.0, game/dev-lock.ts): the title's developer code opens it
 * on a release build. Our own letters on screen, so keys, a gamepad and touch all work the same:
 * the d-pad (or a tap) picks a letter, OK types it, BACK deletes one (or closes the prompt when
 * nothing is typed), DONE (or MENU) checks the entry. The entry shows as stars and is never said
 * aloud or logged: the screen reader hears only the letter under the cursor and the count typed.
 */

/** The letters on offer, in rows of ten (the font has no lowercase; entries are checked in capitals). */
export const PASSPHRASE_ROWS: readonly string[] = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789-'];
/** The longest entry. */
export const PASSPHRASE_MAX = 32;

interface Cell {
  /** A letter, or the DELETE / DONE buttons. */
  key: string;
  label: string;
  row: number;
  x: number;
  y: number;
  w: number;
}

const GRID_X = 48;
const GRID_Y = 88;
const STEP_X = 16;
const STEP_Y = 18;

/** Every cell, in reading order: the letters, then DELETE and DONE on the last row. */
export function passphraseCells(): Cell[] {
  const cells: Cell[] = [];
  PASSPHRASE_ROWS.forEach((chars, row) => {
    [...chars].forEach((c, col) =>
      cells.push({ key: c, label: c, row, x: GRID_X + col * STEP_X, y: GRID_Y + row * STEP_Y, w: 8 }),
    );
  });
  const row = PASSPHRASE_ROWS.length;
  const y = GRID_Y + row * STEP_Y + 4;
  cells.push({ key: 'DELETE', label: 'DELETE', row, x: GRID_X, y, w: 48 });
  cells.push({ key: 'DONE', label: 'DONE', row, x: GRID_X + 6 * STEP_X, y, w: 32 });
  return cells;
}

const CELLS = passphraseCells();

/** How a cell is read out. */
function cellSaid(c: Cell): string {
  if (c.key === 'DELETE') return 'Delete';
  if (c.key === 'DONE') return 'Done';
  if (c.key === '-') return 'Dash';
  return c.key;
}

export class PassphraseScene implements Scene {
  /** The cell under the cursor. */
  index = 0;
  /** What is typed so far (shown as stars, never said or logged). */
  private entry = '';
  /** A check is running (WebCrypto is asynchronous). */
  checking = false;
  /** WRONG PASSPHRASE under the entry, until the next letter. */
  wrong = false;
  private t = 0;
  private unbindPointer: (() => void) | null = null;

  constructor(
    private readonly game: Game,
    private readonly lock: DevLock,
    /** The right passphrase was entered (the prompt is already closed). */
    private readonly onUnlock: () => void,
  ) {}

  /** The number of letters typed (the entry itself stays private). */
  get length(): number {
    return this.entry.length;
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  enter(): void {
    this.say(
      `Developer mode. Enter the passphrase. Directions choose a letter, ${abilityHint(this.game, 'OK', 'jump')} types it, ` +
        `${abilityHint(this.game, 'BACK', 'attack')} deletes, Done checks it. ${cellSaid(CELLS[this.index] as Cell)}.`,
    );
    this.bindPointer();
  }

  exit(): void {
    this.unbindPointer?.();
    this.unbindPointer = null;
  }

  /** None during the guard (the code's last press), then OK types, BACK deletes, MENU checks. */
  touchLabels(): TouchLabels {
    if (this.t < CARD_GUARD_FRAMES || this.checking) return NO_TOUCH_BUTTONS;
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: this.entry ? 'DELETE' : 'BACK', start: 'DONE' };
  }

  private move(to: number): void {
    if (to === this.index) return;
    this.index = to;
    this.game.ctx.audio.sfx('select');
    this.say(cellSaid(CELLS[to] as Cell));
  }

  /** The cell `dx` / `dy` away: left and right wrap in the row; up and down go to the nearest. */
  private neighbour(dx: number, dy: number): number {
    const cur = CELLS[this.index] as Cell;
    if (dx) {
      const row = CELLS.map((c, i) => ({ c, i })).filter((e) => e.c.row === cur.row);
      const at = row.findIndex((e) => e.i === this.index);
      return (row[(at + dx + row.length) % row.length] as { i: number }).i;
    }
    const rows = PASSPHRASE_ROWS.length + 1;
    const target = (cur.row + dy + rows) % rows;
    const cx = cur.x + cur.w / 2;
    let best = this.index;
    let bestD = Infinity;
    CELLS.forEach((c, i) => {
      if (c.row !== target) return;
      const d = Math.abs(c.x + c.w / 2 - cx);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  /** OK on cell `i`: type its letter, delete one, or check the entry. */
  private pick(i: number): void {
    const c = CELLS[i] as Cell;
    if (c.key === 'DELETE') return this.erase();
    if (c.key === 'DONE') return void this.check();
    if (this.entry.length >= PASSPHRASE_MAX) {
      this.game.ctx.audio.sfx('bump');
      return;
    }
    this.entry += c.key;
    this.wrong = false;
    this.game.ctx.audio.sfx('coin');
    this.say(`${this.entry.length} typed.`);
  }

  private erase(): void {
    if (!this.entry) {
      this.close();
      return;
    }
    this.entry = this.entry.slice(0, -1);
    this.game.ctx.audio.sfx('select');
    this.say(`Deleted. ${this.entry.length} typed.`);
  }

  private close(): void {
    this.game.ctx.audio.sfx('select');
    this.say('Closed.');
    this.game.scenes.pop();
  }

  /** Hashes the entry and compares it with the lock (scenes/../dev-lock.ts). */
  async check(): Promise<void> {
    if (this.checking) return;
    if (!this.entry) {
      this.game.ctx.audio.sfx('bump');
      this.say('Type the passphrase first.');
      return;
    }
    this.checking = true;
    const entry = this.entry;
    // No WebCrypto (an insecure page): nothing opens.
    const ok = await passphraseOpens(this.lock, entry).catch(() => false);
    this.checking = false;
    if (this.game.scenes.top !== this) return;
    if (ok) {
      this.entry = '';
      this.game.scenes.pop();
      this.onUnlock();
      return;
    }
    this.entry = '';
    this.wrong = true;
    this.game.ctx.audio.sfx('bump');
    this.say('Wrong passphrase.');
  }

  update(input: InputFrame): void {
    if (++this.t <= CARD_GUARD_FRAMES || this.checking) return;
    if (input.pressed('left')) return this.move(this.neighbour(-1, 0));
    if (input.pressed('right')) return this.move(this.neighbour(1, 0));
    if (input.pressed('up')) return this.move(this.neighbour(0, -1));
    if (input.pressed('down')) return this.move(this.neighbour(0, 1));
    if (input.pressed('jump')) return this.pick(this.index);
    if (input.pressed('attack') || input.pressed('select')) return this.erase();
    if (input.pressed('start')) return void this.check();
  }

  /** A tap or click at screen (x, y): on a cell it moves there and picks it. True when it hit one. */
  tapAt(x: number, y: number): boolean {
    if (this.t <= CARD_GUARD_FRAMES || this.checking) return false;
    const i = CELLS.findIndex((c) => x >= c.x - 4 && x < c.x + c.w + 4 && y >= c.y - 4 && y < c.y + 12);
    if (i < 0) return false;
    this.move(i);
    this.pick(i);
    return true;
  }

  private bindPointer(): void {
    const canvas = this.game.deps.canvas;
    const viewport = this.game.deps.viewport;
    if (!canvas || !viewport || this.unbindPointer) return;
    const down = (e: PointerEvent) => {
      if (this.game.scenes.top !== this) return;
      const s = viewport.toScreen(e.clientX, e.clientY);
      if (this.tapAt(s.x, s.y)) e.preventDefault();
    };
    canvas.addEventListener('pointerdown', down);
    this.unbindPointer = () => canvas.removeEventListener('pointerdown', down);
  }

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const text = (s: string, x: number, y: number) => r.text(font, s, x, y);
    const centre = (s: string, y: number) => text(s, Math.round(128 - (s.length * 8) / 2), y);
    r.clear('#000');
    centre('DEVELOPER MODE', 24);
    centre('ENTER THE PASSPHRASE', 40);
    // The entry, as stars, in a box.
    r.rect(40, 56, 176, 16, '#fcfcfc');
    r.rect(42, 58, 172, 12, '#000');
    // Up to 20 stars fit the box; a longer entry (up to 32) shows 16 and its length.
    const n = this.entry.length;
    const stars = n <= 20 ? '*'.repeat(n) : `${'*'.repeat(16)} ${n}`;
    text(stars, 48, 60);
    CELLS.forEach((c, i) => {
      if (i === this.index) r.rect(c.x - 3, c.y - 3, c.w + 6, 14, '#3cbcfc');
      text(c.label, c.x, c.y);
    });
    const hint = this.checking ? 'CHECKING...' : this.wrong ? 'WRONG PASSPHRASE' : '';
    if (hint) centre(hint, 196);
    if (this.t > CARD_GUARD_FRAMES) {
      centre(`${abilityHint(this.game, 'OK', 'jump')}: TYPE`, 208);
      centre(`${abilityHint(this.game, 'BACK', 'attack')}: DELETE`, 220);
    }
  }
}
