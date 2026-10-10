import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Game } from '../scenes/game';
import { abilityHint } from '../scenes/hints';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import type { Page } from '../story/script';
import type { ShopEntry } from './shop';

/*
 * The shop's buy card (0.4.42): standing at a display table and pressing TALK shows the item's
 * name, what it does and its price, then asks BUY? YES / NO (left and right choose, OK answers,
 * BACK is NO). When it can't be bought (too few coins, owned, full, grow first) the shopkeeper
 * says why instead, and OK closes the card. It never goes on by itself.
 */

/** Frames the card ignores input for (a press meant for the table doesn't answer it). */
export const SHOP_CARD_GUARD = 16;
/** Characters a line of the card holds. */
const CARD_COLS = 28;

/** `text` cut into lines of at most `cols` characters, at spaces. */
export function wrap(text: string, cols = CARD_COLS): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > cols) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

const sentence = (t: string) => (t ? `${t[0]?.toUpperCase()}${t.slice(1)}.` : '');
const spoken = (page: Page) =>
  page
    .slice(2)
    .filter((l) => l)
    .join(' ')
    .toLowerCase()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

export class ShopCardScene implements Scene {
  readonly translucent = true;
  /** Asking BUY? YES / NO, or the shopkeeper saying why not. */
  readonly mode: 'ask' | 'say';
  /** 0: YES, 1: NO. */
  choice: 0 | 1 = 0;
  private t = 0;
  private done = false;

  constructor(
    private readonly game: Game,
    readonly entry: ShopEntry,
    /** The shopkeeper's words when it can't be bought; null to ask. */
    readonly reply: Page | null,
    private readonly answer: (yes: boolean) => void,
    /** The box at the bottom of the screen (the hero is in the top half). */
    private readonly bottom = true,
  ) {
    this.mode = reply ? 'say' : 'ask';
  }

  /** The card's lines as drawn (the YES / NO row included), for tests and the screen. */
  text(): string[] {
    const e = this.entry;
    const head = [
      fontText(e.name.toUpperCase()),
      ...wrap(fontText(e.does.toUpperCase())),
      e.mark ?? `${e.price} COINS`,
      '',
    ];
    if (this.reply) return [...head, ...this.reply];
    return [...head, `BUY?   ${this.choice === 0 ? '>' : ' '}YES   ${this.choice === 1 ? '>' : ' '}NO`];
  }

  enter(): void {
    const e = this.entry;
    const what = `${e.name}. ${sentence(e.does)} ${e.mark ? e.mark.toLowerCase() : `${e.price} coins`}.`;
    this.game.deps.announcer?.say(
      this.reply
        ? `${what} ${spoken(this.reply)}`
        : `${what} Buy? Left and right to choose, OK to confirm. Yes.`,
    );
  }

  touchLabels(): TouchLabels {
    if (this.mode === 'say') return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' };
  }

  update(input: InputFrame): void {
    if (this.done || ++this.t <= SHOP_CARD_GUARD) return;
    if (this.mode === 'ask') {
      if (input.pressed('left') || input.pressed('right') || input.pressed('up') || input.pressed('down')) {
        this.choice = this.choice === 0 ? 1 : 0;
        this.game.ctx.audio.sfx('select');
        this.game.deps.announcer?.say(this.choice === 0 ? 'Yes' : 'No');
        return;
      }
      if (input.pressed('attack')) return this.close(false);
      if (input.pressed('jump') || input.pressed('start')) return this.close(this.choice === 0);
      return;
    }
    if (input.pressed('jump') || input.pressed('start') || input.pressed('attack')) this.close(false);
  }

  private close(yes: boolean): void {
    this.done = true;
    this.game.scenes.pop();
    this.answer(yes);
  }

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const gold = assets.has('font') ? assets.sheet('font', 'font-gold') : font;
    const lines = this.text();
    const prompt = this.t > SHOP_CARD_GUARD ? fontText(abilityHint(this.game, 'OK', 'jump')) : '';
    const h = (lines.length + 1) * 10 + 12;
    const y = this.bottom ? SCREEN_H - 12 - h : 40;
    r.rect(12, y, SCREEN_W - 24, h, '#fcfcfc');
    r.rect(14, y + 2, SCREEN_W - 28, h - 4, '#000');
    lines.forEach((l, i) => {
      const sheet = i === 0 ? gold : font;
      r.text(sheet, l, (SCREEN_W - l.length * 8) >> 1, y + 7 + i * 10);
    });
    if (prompt) r.text(font, prompt, SCREEN_W - 20 - prompt.length * 8, y + 7 + lines.length * 10);
  }
}
