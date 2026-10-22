import type { Renderer } from '@engine/gfx/renderer';
import { FONT_COLOURS, type FontColour } from '@content/sprites/font';
import { MenuScene } from './menu';
import type { Game } from './game';
import { CreditsScene } from './credits';
import { abilityHint } from './hints';

/**
 * The About page's lines (0.4.72, owner: title option A). What left the REMIX title (the version,
 * MADE BY and the Exploding Rabbit credit) lives here, with the fan-project note; the full
 * credits roll is one row away. Blank lines part the blocks.
 */
export const ABOUT_LINES: readonly (readonly [string, FontColour | null])[] = [
  ['SUPER MARIO BROS.', null],
  ['CROSSOVER: REMIX', null],
  ['', null],
  ['MADE BY JELLOSHOOTER848', 'gold'],
  ['', null],
  ['BASED ON SUPER MARIO BROS.', null],
  ['CROSSOVER BY JAY PAVLINA', null],
  ['AND EXPLODING RABBIT', null],
  ['', null],
  ['AN UNOFFICIAL FAN PROJECT.', 'grey'],
  // The one art exception is the Exploding Rabbit logo (docs/ART_EXCEPTIONS.md, the credits).
  // "EXCEPT THE EXPLODING RABBIT LOGO." alone is 33 columns, wider than the screen's 32.
  ['OUR OWN ART AND MUSIC, EXCEPT', 'grey'],
  ['THE EXPLODING RABBIT LOGO.', 'grey'],
];

/** What the screen reader says for the page's text (before the focused row). */
export const ABOUT_SAID =
  'About. Super Mario Bros. Crossover: REMIX. Made by jelloshooter848. ' +
  'Based on Super Mario Bros. Crossover by Jay Pavlina and Exploding Rabbit. ' +
  'An unofficial fan project. Our own art and music, except the Exploding Rabbit logo.';

const LINES_Y = 44;
const LINE_H = 10;
const ROWS_Y = 182;
const ROW_H = 14;
/** The BACK hint's line (MenuScene's full-screen backY). */
const BACK_Y = 216;

/** Options > About: the game's credit and version, a Credits row (the roll) and Back. */
export class AboutScene extends MenuScene {
  readonly version = `VERSION ${__APP_VERSION__}`.toUpperCase();

  constructor(game: Game, onBack: () => void) {
    super(game, 'ABOUT', [], onBack);
    this.setItems([
      { label: 'Credits', select: () => this.rollCredits(), hint: 'The full credits roll' },
      { label: 'Back', select: onBack },
    ]);
  }

  /** The credits roll over this page; at its end (OK) the page again, and the title's theme. */
  private rollCredits(): void {
    const game = this.game;
    game.scenes.push(
      new CreditsScene(game, [], () => {
        game.scenes.pop();
        game.ctx.audio.playMusic('title');
        this.announce();
      }),
    );
  }

  override enter(): void {
    const it = this.items[this.index];
    const row = it ? ` ${it.label}${it.hint ? `. ${it.hint}` : ''}` : '';
    this.game.deps.announcer?.say(`${ABOUT_SAID} Version ${__APP_VERSION__}.${row}`);
  }

  override render(r: Renderer): void {
    const a = this.game.ctx.assets;
    r.clear('#000');
    const font = a.sheet('font');
    const centre = (s: string, y: number, colour: FontColour | null = null) =>
      r.text(
        colour ? a.sheet('font', FONT_COLOURS[colour]) : font,
        s,
        Math.round(128 - (s.length * 8) / 2),
        y,
      );
    centre(this.title, 24);
    ABOUT_LINES.forEach(([s, colour], i) => {
      if (s) centre(s, LINES_Y + i * LINE_H, colour);
    });
    centre(this.version, LINES_Y + ABOUT_LINES.length * LINE_H + 4, 'grey');
    this.items.forEach((it, i) => {
      const y = ROWS_Y + i * ROW_H;
      if (i === this.index) r.text(font, '>', 76, y);
      r.text(font, it.label.toUpperCase(), 88, y);
    });
    // The BACK hint, blinking, where every Options page has it (MenuScene).
    if ((this.t >> 5) % 2 === 0) r.text(font, abilityHint(this.game, 'BACK', this.backAction), 24, BACK_Y);
  }
}
