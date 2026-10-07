import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { Rng } from '@engine/rng';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from '../scenes/game';
import { abilityHint } from '../scenes/hints';
import { CARD_GUARD_FRAMES } from '../scenes/message';
import { MiniGameMenuScene } from '../minigames/menu';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import { awardPrize } from './use';
import { drawSmb3Status, smb3Status, STATUS_BAR_Y } from '../hud/smb3-status';
import { BONUS_TITLES, type BonusKind, type BonusPrize } from './rules';

/** How a bonus game ended: what it gave (already applied), and whether the player gave up from its menu. */
export interface BonusResult {
  kind: BonusKind;
  /** Every prize won, in order (empty: nothing). Already given: items in the inventory, lives and coins counted. */
  prizes: BonusPrize[];
  gaveUp: boolean;
  /**
   * A choice was made (a chest opened, a card turned, a reel stopped): the bonus counts as used,
   * even when the player then gave up. False only for a Give up before any of that.
   */
  played: boolean;
}

/** The y of a game's line of hints, just above SMB3's status bar along the bottom. */
export const HINT_Y = STATUS_BAR_Y - 12;

/** Frames the game ignores input after it opens, so the press that opened it does nothing. */
export const BONUS_GUARD_FRAMES = 20;

/** `full` when it fits `cols` columns, else `bare` (the ability names without their keys). */
export function fitLine(full: string, bare: string, cols = 30): string {
  return full.length <= cols ? full : bare;
}

/**
 * What the three bonus games share: a seeded Rng (the rules replay from it), the menu (Continue /
 * Give up), the guard after opening, prizes given through `awardPrize` with a banner and the
 * announcer, and the end once the result card is closed with OK.
 */
export abstract class BonusScene implements Scene {
  protected t = 0;
  protected readonly rng: Rng;
  readonly prizes: BonusPrize[] = [];
  /** The banner under the game: its lines and the frame it went up. */
  protected banner: { lines: string[]; t: number } | null = null;
  /** The round is decided: the result card shows and OK ends it. */
  protected over: { lines: string[]; t: number } | null = null;
  private ended = false;
  /** A choice was made (BonusResult.played). */
  played = false;
  /**
   * Called once, at the first choice (before any prize is given or saved): the bonus spot closes
   * itself there, so reloading the page cannot replay it.
   */
  onPlayed: (() => void) | null = null;

  constructor(
    protected readonly game: Game,
    readonly kind: BonusKind,
    seed: number,
    private readonly onEnd: (result: BonusResult) => void,
  ) {
    this.rng = new Rng(seed);
  }

  get title(): string {
    return BONUS_TITLES[this.kind];
  }

  protected abstract music: string;
  /** Said when the game opens (after its title). */
  protected abstract intro(): string;
  /** One frame of play (after the guard, while not over and no menu is open). */
  protected abstract play(input: InputFrame): void;
  protected abstract draw(r: Renderer): void;
  /** Touch labels during play. */
  protected abstract playLabels(): TouchLabels;

  enter(): void {
    const audio = this.game.ctx.audio;
    audio.stopMusic();
    audio.playMusic(this.music);
    this.say(`${this.spokenTitle}. ${this.intro()}`);
  }

  get spokenTitle(): string {
    return this.title.charAt(0) + this.title.slice(1).toLowerCase();
  }

  protected say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  protected sfx(id: string): void {
    this.game.ctx.audio.sfx(id);
  }

  protected get reduceFlashing(): boolean {
    return this.game.ctx.reduceFlashing;
  }

  /** "OK (Z)" style hints: the ability, then its key when not on touch. */
  protected hint(ability: string, action: Action): string {
    return abilityHint(this.game, ability, action);
  }

  /** Gives `prize` now and shows and says what it did. */
  protected award(prize: BonusPrize): void {
    this.prizes.push(prize);
    const out = awardPrize(this.game, prize);
    this.banner = { lines: out.lines.map(fontText), t: this.t };
    this.say(out.said);
  }

  /** The round is decided: `lines` on the result card, said with how to go on. */
  protected finish(lines: string[]): void {
    if (this.over) return;
    this.over = { lines: lines.map(fontText), t: this.t };
    this.say(`${lines.join(' ')} OK to go on.`);
  }

  touchLabels(): TouchLabels {
    if (this.over)
      return { ...NO_TOUCH_BUTTONS, jump: this.t - this.over.t > CARD_GUARD_FRAMES ? 'OK' : null };
    return { ...this.playLabels(), start: 'MENU' };
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.ended) return;
    if (this.over) {
      if (this.t - this.over.t > CARD_GUARD_FRAMES && (input.pressed('jump') || input.pressed('start')))
        this.close(false);
      return;
    }
    // Once the outcome is decided (the chest is open, the last reel stopped, the board done) there
    // is no menu, so Give up cannot drop a prize still on its way.
    if (input.pressed('start') && !this.decided) {
      this.game.scenes.push(
        new MiniGameMenuScene(this.game, this.title, () => this.close(true), 'Leave with no more prizes'),
      );
      return;
    }
    if (this.t < BONUS_GUARD_FRAMES) return;
    this.play(input);
  }

  /** The first choice: `played`, and `onPlayed` once. */
  protected markPlayed(): void {
    if (this.played) return;
    this.played = true;
    this.onPlayed?.();
  }

  /** The outcome is settled: no Give-up menu from here on. */
  protected abstract get decided(): boolean;

  /** Ends the round once (the caller pops it). */
  private close(gaveUp: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.onEnd({ kind: this.kind, prizes: this.prizes.slice(), gaveUp, played: this.played });
  }

  render(r: Renderer): void {
    this.draw(r);
    const ctx = this.game.ctx;
    const font = ctx.assets.sheet('font');
    // SMB3's status bar along the bottom (no clock in a bonus game).
    drawSmb3Status(r, ctx.assets, smb3Status(this.game.state, null, null), this.t, ctx.reduceFlashing);
    if (this.over) {
      const lines = this.over.lines;
      const ok = fontText(`PRESS ${this.hint('OK', 'jump')}`);
      const all = [...lines, '', ...(this.t - this.over.t > CARD_GUARD_FRAMES ? [ok] : [])];
      // Low on the screen above the bar, so the board (or the chest and its prize) stays in view.
      drawTextBox(r, font, all, STATUS_BAR_Y - 4 - (all.length * 10 + 10));
    } else if (this.banner) {
      drawTextBox(r, font, this.banner.lines, STATUS_BAR_Y - 8 - (this.banner.lines.length * 10 + 10));
    }
  }
}

/** Centred lines in a white-rimmed black box from `y` (rows 10 px apart). */
export function drawTextBox(
  r: Renderer,
  font: Parameters<Renderer['text']>[0],
  lines: readonly string[],
  y: number,
): void {
  const cols = Math.max(...lines.map((l) => l.length), 8);
  const w = Math.min(SCREEN_W - 16, cols * 8 + 16);
  const h = lines.length * 10 + 10;
  const x = (SCREEN_W - w) >> 1;
  r.rect(x, y, w, h, '#fcfcfc');
  r.rect(x + 2, y + 2, w - 4, h - 4, '#000');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + 6 + i * 10));
}

/** A line of text centred on the screen. */
export function centred(r: Renderer, font: Parameters<Renderer['text']>[0], text: string, y: number): void {
  r.text(font, text, (SCREEN_W - text.length * 8) >> 1, y);
}
