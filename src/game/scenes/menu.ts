import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { menuTouchLabels } from '../touch-labels';
import { abilityHint } from './hints';

export interface MenuItem {
  label: string;
  /** Current value shown to the right, if any. */
  value?: () => string;
  /** Adjust with left/right. */
  adjust?: (dir: -1 | 1) => void;
  /** Activate with A/Start. */
  select?: () => void;
  /** Extra line read to screen readers. */
  hint?: string;
}

/** Short forms for long words in key and button names, used only when a name does not fit its row. */
const SHORT_WORDS: Record<string, string> = {
  LEFT: 'L',
  RIGHT: 'R',
  CONTROL: 'CTRL',
  ESCAPE: 'ESC',
  BACKSPACE: 'BKSP',
  DELETE: 'DEL',
  INSERT: 'INS',
  ENTER: 'ENT',
  ADD: '+',
  SUBTRACT: '-',
  MULTIPLY: '×',
  DIVIDE: '/',
  DECIMAL: '.',
  COMMA: ',',
  PERIOD: '.',
  SLASH: '/',
  EQUAL: 'EQ',
  MINUS: '-',
  QUOTE: "'",
  SEMICOLON: 'SEMI',
  BACKQUOTE: 'BKQT',
  BACKSLASH: 'BKSL',
  INTLBACKSLASH: 'INTL BKSL',
  INTLRO: 'INTL RO',
  INTLYEN: 'INTL YEN',
  BRACKETLEFT: 'L BRKT',
  BRACKETRIGHT: 'R BRKT',
  CAPSLOCK: 'CAPS',
  NUMLOCK: 'NUM LK',
  SCROLLLOCK: 'SCR LK',
  PRINTSCREEN: 'PRT SC',
  CONTEXTMENU: 'MENU',
  PAGEUP: 'PG UP',
  PAGEDOWN: 'PG DN',
  ARROWUP: 'UP',
  ARROWDOWN: 'DOWN',
  ARROWLEFT: 'LEFT',
  ARROWRIGHT: 'RIGHT',
  BUTTON: 'BTN',
  STICK: 'STK',
};

/**
 * A menu value upper-cased to fit `maxChars` columns: in full when it fits, else with its words
 * shortened ("RIGHT SHIFT" → "R SHIFT", "NUM ADD" → "NUM +"), and only cut as a last resort.
 */
export function fitMenuValue(value: string, maxChars: number): string {
  const full = value.toUpperCase();
  if (full.length <= maxChars) return full;
  const short = full
    .split(' ')
    .map((w) => SHORT_WORDS[w] ?? w)
    .join(' ');
  return short.slice(0, Math.max(0, maxChars));
}

/** Where a menu draws: full screen (title), or inside the see-through panel over the map or a level. */
interface MenuLayout {
  titleY: number;
  rowY: number;
  statusY: number;
  backY: number;
}
const FULL_SCREEN: MenuLayout = { titleY: 40, rowY: 64, statusY: 200, backY: 216 };
/** The see-through panel: 16..240 × 24..216, everything inside with 8px or more to spare. */
const PANEL = { x: 16, y: 24, w: 224, h: 192 } as const;
const IN_PANEL: MenuLayout = { titleY: 32, rowY: 52, statusY: 184, backY: 198 };
const ROW_H = 14;
const LABEL_X = 36;
const VALUE_RIGHT = 232;

/**
 * A generic vertical list menu drawn with the bitmap font. Used by the title, pause and
 * options screens. Up/down moves, left/right adjusts, A/Start selects, B/Select goes back.
 */
export class MenuScene implements Scene {
  translucent: boolean;
  protected index = 0;
  protected t = 0;
  protected items: MenuItem[] = [];
  protected status = '';
  /** Keeps a page of items scrolled into view. */
  private readonly visibleRows = 9;

  constructor(
    protected readonly game: Game,
    readonly title: string,
    items: MenuItem[],
    protected readonly onBack: (() => void) | null,
    translucent = false,
  ) {
    this.items = items;
    this.translucent = translucent;
  }

  enter(): void {
    this.announce();
  }

  protected announce(): void {
    const it = this.items[this.index];
    if (!it) return;
    const v = it.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`${it.label}${v}${it.hint ? `. ${it.hint}` : ''}`);
  }

  /** A picks the highlighted entry, or steps a setting that has no action (CHANGE). */
  touchLabels(): TouchLabels {
    const it = this.items[this.index];
    const a = !it || it.select ? 'OK' : it.adjust ? 'CHANGE' : null;
    return { ...menuTouchLabels(this.onBack !== null), jump: a };
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    this.index = Math.min(this.index, Math.max(0, items.length - 1));
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.t < 6) return;
    const n = this.items.length;
    if (!n) return;
    if (input.pressed('up')) {
      this.index = (this.index + n - 1) % n;
      this.game.ctx.audio.sfx('select');
      this.announce();
    } else if (input.pressed('down')) {
      this.index = (this.index + 1) % n;
      this.game.ctx.audio.sfx('select');
      this.announce();
    }
    const it = this.items[this.index] as MenuItem;
    if (input.pressed('left') && it.adjust) {
      it.adjust(-1);
      this.game.ctx.audio.sfx('select');
      this.announce();
    } else if (input.pressed('right') && it.adjust) {
      it.adjust(1);
      this.game.ctx.audio.sfx('select');
      this.announce();
    } else if (input.pressed('jump') || input.pressed('start')) {
      if (it.select) {
        this.game.ctx.audio.sfx('coin');
        it.select();
      } else if (it.adjust) {
        it.adjust(1);
        this.announce();
      }
    } else if ((input.pressed('attack') || input.pressed('select')) && this.onBack) {
      this.game.ctx.audio.sfx('select');
      this.onBack();
    }
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    const at = this.translucent ? IN_PANEL : FULL_SCREEN;
    if (!this.translucent) r.clear('#000');
    else r.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'rgba(0,0,0,0.85)');
    r.text(font, this.title, 128 - (this.title.length * 8) / 2, at.titleY);
    const first = Math.max(
      0,
      Math.min(this.index - Math.floor(this.visibleRows / 2), this.items.length - this.visibleRows),
    );
    const rows = this.items.slice(first, first + this.visibleRows);
    rows.forEach((it, i) => {
      const y = at.rowY + i * ROW_H;
      const sel = first + i === this.index;
      if (sel) r.text(font, '>', 24, y);
      const label = it.label.toUpperCase().slice(0, 14);
      r.text(font, label, LABEL_X, y);
      if (it.value) {
        // The value fits between the label (one column of space after it) and the right edge.
        const room = Math.floor((VALUE_RIGHT - LABEL_X) / 8) - label.length - 1;
        const v = fitMenuValue(it.value(), room);
        r.text(font, v, VALUE_RIGHT - v.length * 8, y);
      }
    });
    if (this.status)
      r.text(
        font,
        this.status.toUpperCase().slice(0, 28),
        128 - Math.min(28, this.status.length) * 4,
        at.statusY,
      );
    const back = this.onBack ? abilityHint(this.game, 'BACK', 'attack') : '';
    if (back && (this.t >> 5) % 2 === 0) r.text(font, back, 24, at.backY);
  }
}
