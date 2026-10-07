import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { World } from '../world/world';

/** Frames a card ignores input for, so a press meant for the level doesn't skip it. */
export const CARD_GUARD_FRAMES = 30;

/**
 * Whether a card `t` frames old should go on: any player newly pressed one of `keys` (a button
 * held since before the card does not count) once the guard is over, or the timeout ran out.
 */
export function cardContinues(
  t: number,
  timeout: number,
  inputs: readonly InputFrame[],
  keys: readonly Action[],
): boolean {
  if (t >= timeout) return true;
  return t > CARD_GUARD_FRAMES && inputs.some((i) => keys.some((k) => i.pressed(k)));
}

/** Centered lines of text on black; continues on `keys` (any player) or after a timeout. */
export class MessageScene implements Scene {
  private t = 0;
  private done = false;
  constructor(
    private readonly game: Game,
    private readonly lines: string[],
    private readonly next: () => void,
    private readonly timeout = 600,
    private readonly keys: readonly Action[] = ['start', 'jump'],
  ) {}

  /** One OK button: A if it continues the message, else B, else Start. */
  touchLabels(): TouchLabels {
    const key = (['jump', 'attack', 'start'] as const).find((k) => this.keys.includes(k));
    return key ? { ...NO_TOUCH_BUTTONS, [key]: 'OK' } : NO_TOUCH_BUTTONS;
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    if (cardContinues(++this.t, this.timeout, inputs, this.keys)) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    const y0 = 120 - (this.lines.length * 12) / 2;
    this.lines.forEach((l, i) => r.text(font, l, 128 - (l.length * 8) / 2, y0 + i * 12));
  }
}

/** CardScene options beyond the endings' defaults (the captive heroes' dialogue, free-hero.ts). */
export interface CardOptions {
  /** What goes on (default Start and B); the dialogue adds A (OK). */
  keys?: readonly Action[];
  /**
   * Over a level, draw the lines in a dark box at the bottom of the screen instead of the
   * castle text spot, so they stay readable over a busy room (World.castleText is left alone).
   */
  panel?: boolean;
  /**
   * With `panel`: a continue prompt (the ability's name, e.g. "OK") at the box's bottom right. A
   * function is asked again every frame drawn, so "OK (Z)" becomes "OK" when the player picks up
   * the touch pad mid-dialogue.
   */
  prompt?: string | (() => string);
  /** With `panel`: the box goes near the top, under the HUD (the tutorial's Toad), not the bottom. */
  top?: boolean;
  /**
   * Draw the `panel` box with no level (`world` null): over whatever scene is beneath (the world
   * map), which keeps rendering. Without it a card with no world draws on black as before.
   */
  overlay?: boolean;
  /**
   * Keys that close the card another way (the story cards' BACK: 'attack'), once the guard is
   * over: `onSkip` is called instead of the card's `next`. Default none.
   */
  skipKeys?: readonly Action[];
  onSkip?: () => void;
}

/**
 * A closing card (the Lost Levels' endings): its lines drawn where the castle's text goes
 * (World.castleText), over the level when given its `world` so the HUD keeps showing the score,
 * as in the SMB 8-4 ending; else on black. Start or B (attack, the card's "PUSH BUTTON B")
 * from any player continues, or the timeout. With `panel` the lines go in a box over the level.
 */
export class CardScene implements Scene {
  readonly translucent: boolean;
  private t = 0;
  private done = false;
  constructor(
    private readonly game: Game,
    readonly lines: readonly string[],
    private readonly next: () => void,
    private readonly world: World | null = null,
    private readonly timeout = 1800,
    opts: CardOptions = {},
  ) {
    this.keys = opts.keys ?? ['start', 'attack'];
    this.panel = opts.panel === true && (world !== null || opts.overlay === true);
    this.prompt = opts.prompt ?? '';
    this.top = opts.top === true;
    this.skipKeys = opts.onSkip ? (opts.skipKeys ?? []) : [];
    this.onSkip = opts.onSkip ?? null;
    this.translucent = world !== null || this.panel;
    if (world && !this.panel) world.castleText = [...lines];
  }

  private readonly keys: readonly Action[];
  private readonly panel: boolean;
  private readonly prompt: string | (() => string);
  private readonly top: boolean;
  private readonly skipKeys: readonly Action[];
  private readonly onSkip: (() => void) | null;

  /**
   * B goes on (the card's "PUSH BUTTON B"); Start does too, but one button is enough. A when it
   * goes on too. With skip keys, B reads BACK when it is one of them.
   */
  touchLabels(): TouchLabels {
    const ok = { ...NO_TOUCH_BUTTONS, [this.keys.includes('jump') ? 'jump' : 'attack']: 'OK' };
    return this.skipKeys.includes('attack') ? { ...ok, attack: 'BACK' } : ok;
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    if (this.onSkip && cardContinues(this.t, Infinity, inputs, this.skipKeys)) {
      this.done = true;
      this.onSkip();
      return;
    }
    if (cardContinues(this.t, this.timeout, inputs, this.keys)) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    if (this.panel) {
      const prompt = typeof this.prompt === 'function' ? this.prompt() : this.prompt;
      const rows = this.lines.length + (prompt ? 1 : 0);
      const h = rows * 10 + 12;
      const y = this.top ? 40 : SCREEN_H - 12 - h;
      r.rect(12, y, SCREEN_W - 24, h, '#fcfcfc');
      r.rect(14, y + 2, SCREEN_W - 28, h - 4, '#000');
      this.lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + 7 + i * 10));
      // The prompt shows once the card takes input (after the guard).
      if (prompt && this.t > CARD_GUARD_FRAMES)
        r.text(font, prompt, SCREEN_W - 20 - prompt.length * 8, y + 7 + this.lines.length * 10);
      return;
    }
    if (this.world) return; // the level beneath draws the lines (World.castleText)
    r.clear('#000');
    this.lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, 80 + i * 16));
  }
}
