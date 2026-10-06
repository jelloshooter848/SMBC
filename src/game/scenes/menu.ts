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
    if (!this.translucent) r.clear('#000');
    else r.rect(16, 24, 224, 192, 'rgba(0,0,0,0.85)');
    r.text(font, this.title, 128 - (this.title.length * 8) / 2, 40);
    const first = Math.max(
      0,
      Math.min(this.index - Math.floor(this.visibleRows / 2), this.items.length - this.visibleRows),
    );
    const rows = this.items.slice(first, first + this.visibleRows);
    rows.forEach((it, i) => {
      const y = 64 + i * 14;
      const sel = first + i === this.index;
      if (sel) r.text(font, '>', 24, y);
      r.text(font, it.label.toUpperCase().slice(0, 14), 36, y);
      if (it.value) {
        const v = it.value().toUpperCase().slice(0, 10);
        r.text(font, v, 232 - v.length * 8, y);
      }
    });
    if (this.status)
      r.text(font, this.status.toUpperCase().slice(0, 28), 128 - Math.min(28, this.status.length) * 4, 200);
    const back = this.onBack ? abilityHint(this.game, 'BACK', 'attack') : '';
    if (back && (this.t >> 5) % 2 === 0) r.text(font, back, 24, 216);
  }
}
