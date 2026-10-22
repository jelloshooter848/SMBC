import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { FONT_COLOURS } from '@content/sprites/font';
import type { ClassicFileRef } from '../original-files';
import { fontText, wrapText } from '../hud/text';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { Game } from './game';
import { abilityHint } from './hints';
import { boxGrowth, drawMushroom } from './menu-box';
import { demoUnder, type DemoBackdrop } from './original-box-menu';
import type { ClassicFilesScene } from './original-files-menu';
import { MAP_SETS, type MapSet } from './original-game';
import { DEFAULT_SELECT_THEME, drawPanel } from './select-grid';

/*
 * v0.4.73 (owner-approved PR 2): a CLEARED file's level replay, in the Classic style (orange boxes
 * over the CLASSIC title's 1-1 demo, the mushroom cursor, the original's box sounds):
 * - after a set's credits and cheat cards, its file box on the CLEARED file with a message box
 *   over it (clearedNote);
 * - picking a CLEARED file: the first time any is picked, the instructions (once, shared by every
 *   file); then the world box, the level box (true level starts only), the Classic hero select
 *   (Game.replaySelect) and the level, with the file's rules;
 * - a death in it: the death box (RETRY, SELECT CHARACTER, RETURN TO MENU); a clear: back to
 *   that world's level box (Game.leaveReplay).
 * Every box is read out and waits for a press (never a timer), BACK steps back one box, and with
 * Reduce flashing a box is open at once. Nothing here writes the file.
 */

/** A note box's text columns (the widest line a Classic box holds, with its margins). */
export const NOTE_COLS = 26;
/** Frames before a page takes a press (so the press that opened it does not close it). */
export const NOTE_GUARD_FRAMES = 30;
const NOTE_LINE = 12;
const NOTE_PAD = 6;
const NOTE_MARGIN = 10;
/** Where a note box is centred over the file box (screen px). */
const NOTE_CY = 140;

export interface NoteOptions {
  /** After the last page's OK (the box has gone). */
  onDone: () => void;
  /** BACK (the box has gone); without it BACK closes the box as OK does. */
  onBack?: () => void;
  /** The box drawn under this one (the file box). */
  under?: Scene | null;
  /** Said before the first page ("Replay"). */
  lead?: string;
}

/**
 * A Classic message box: pages of words (wrapped to fit), each read out, an OK row with the
 * mushroom cursor, OK for the next page, BACK to step back. Over the CLASSIC title (its demo
 * plays on) and the box it was opened from, which stays in view under it.
 */
export class ClassicNoteScene implements Scene {
  readonly translucent = true;
  private page = 0;
  private age = 0;
  private t = 0;
  private readonly over: DemoBackdrop | null;

  constructor(
    private readonly game: Game,
    /** Each page as read out; shown upper-cased in the font. */
    readonly pages: readonly string[],
    private readonly opts: NoteOptions,
  ) {
    this.over = demoUnder(game);
  }

  /** The page shown now, as drawn (wrapped). */
  get lines(): string[] {
    return wrapText(fontText(this.pages[this.page] ?? ''), NOTE_COLS);
  }

  get pageIndex(): number {
    return this.page;
  }

  /** How far the box has grown open (1 at once with Reduce flashing). */
  get openness(): number {
    return boxGrowth(this.age, this.game.ctx.reduceFlashing);
  }

  /** It takes a press now. */
  get interactive(): boolean {
    return this.age > NOTE_GUARD_FRAMES;
  }

  enter(): void {
    this.say(this.opts.lead);
  }

  private say(lead?: string): void {
    const g = this.game;
    const more = this.page < this.pages.length - 1;
    const ok = `${abilityHint(g, 'OK', 'jump')} to ${more ? 'go on' : 'continue'}`;
    const back = this.opts.onBack ? `, ${abilityHint(g, 'BACK', 'attack')} to go back` : '';
    const n = this.pages.length > 1 ? `Page ${this.page + 1} of ${this.pages.length}. ` : '';
    g.deps.announcer?.say(`${lead ? `${lead}. ` : ''}${n}${this.pages[this.page] ?? ''} ${ok}${back}.`);
  }

  touchLabels(): TouchLabels {
    if (!this.interactive) return NO_TOUCH_BUTTONS;
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    this.over?.tickDemo();
    this.t++;
    this.age++;
    for (const f of inputs) f.consumeJumpBuffer();
    if (!this.interactive) return;
    const pressed = (...keys: ('jump' | 'start' | 'attack' | 'select')[]) =>
      inputs.some((i) => keys.some((k) => i.pressed(k)));
    if (pressed('attack', 'select')) {
      this.game.ctx.audio.sfx('bump');
      this.close();
      (this.opts.onBack ?? this.opts.onDone)();
    } else if (pressed('jump', 'start')) {
      this.game.ctx.audio.sfx('coin');
      if (this.page < this.pages.length - 1) {
        this.page++;
        this.age = NOTE_GUARD_FRAMES - 10;
        this.say();
        return;
      }
      this.close();
      this.opts.onDone();
    }
  }

  private close(): void {
    if (this.game.scenes.top === this) this.game.scenes.pop();
  }

  render(r: Renderer): void {
    this.opts.under?.render(r);
    const game = this.game;
    const calm = game.ctx.reduceFlashing;
    const lines = this.lines;
    const cols = Math.max(4, ...lines.map((l) => l.length));
    const w = cols * 8 + NOTE_MARGIN * 2;
    const h = (lines.length + 2) * NOTE_LINE + NOTE_PAD * 2;
    const x = Math.round(128 - w / 2);
    const y = Math.max(0, Math.round(NOTE_CY - h / 2));
    const grow = this.openness;
    const gw = Math.max(2, Math.round(w * grow));
    const gh = Math.max(2, Math.round(h * grow));
    drawPanel(r, Math.round(128 - gw / 2), Math.round(y + h / 2 - gh / 2), gw, gh, DEFAULT_SELECT_THEME);
    if (grow < 1) return;
    const assets = game.ctx.assets;
    const plain = assets.sheet('font');
    lines.forEach((l, i) => r.text(plain, l, x + NOTE_MARGIN, y + NOTE_PAD + i * NOTE_LINE + 2));
    const oy = y + NOTE_PAD + (lines.length + 1) * NOTE_LINE + 2;
    const label = 'OK';
    const lx = Math.round(128 - (label.length * 8) / 2) + 6;
    drawMushroom(r, lx - 12, oy, this.t, calm);
    r.text(assets.sheet('font', DEFAULT_SELECT_THEME.tintFont), label, lx, oy);
    if (!this.opts.under) {
      const back = abilityHint(game, 'BACK', 'attack');
      const bx = Math.round(128 - (back.length * 8) / 2);
      r.text(assets.sheet('font', FONT_COLOURS.black), back, bx + 1, 231);
      r.text(plain, back, bx, 230);
    }
  }
}

const setOf = (id: ClassicFileRef['set']): MapSet =>
  MAP_SETS.find((m) => m.id === id) ?? (MAP_SETS[0] as MapSet);

/**
 * B: the message after a beaten set's credits and cheat cards, over its file box (focused on the
 * file): "YOU BEAT <SET>! FILE N IS CLEARED.", then how to replay. `saved` false: storage did not
 * take the CLEARED file; its last run is kept in it.
 */
export function clearedNote(
  game: Game,
  files: ClassicFilesScene,
  ref: ClassicFileRef,
  saved: boolean,
): ClassicNoteScene {
  const beat = `You beat ${setOf(ref.set).label}!`;
  const pages = saved
    ? [`${beat} File ${ref.slot} is cleared.`, 'Pick a cleared file to replay any level of this map set.']
    : [
        `${beat} File ${ref.slot} could not be saved as cleared.`,
        'Its last run is kept in it, so nothing is lost.',
      ];
  return new ClassicNoteScene(game, pages, {
    under: files,
    onDone: () => files.comeBack(),
  });
}
