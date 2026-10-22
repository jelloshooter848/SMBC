import type { Renderer } from '@engine/gfx/renderer';
import { FONT_COLOURS } from '@content/sprites/font';
import { MenuScene } from '../scenes/menu';
import type { Game } from '../scenes/game';
import { CreditsScene } from '../scenes/credits';

/**
 * MOCKUP (claude/mockups-0471, item 1): Options > About. What left the title: the version, MADE
 * BY and the Exploding Rabbit credit (the legal credit), plus the fan-project note and the full
 * credits roll one press away.
 */
const LINES: readonly (readonly [string, 'gold' | 'grey' | null])[] = [
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
  ['ORIGINAL ART AND MUSIC.', 'grey'],
];

export class AboutScene extends MenuScene {
  private readonly version = `VERSION ${__APP_VERSION__}`.toUpperCase();
  constructor(game: Game, onBack: () => void) {
    super(game, 'ABOUT', [], onBack);
    this.entryTitle = 'About';
    this.setItems([
      {
        label: 'Credits',
        select: () => game.scenes.push(new CreditsScene(game, [], () => game.scenes.pop())),
        hint: 'The full credits roll',
      },
      { label: 'Back', select: onBack },
    ]);
  }

  override render(r: Renderer): void {
    const a = this.game.ctx.assets;
    r.clear('#000');
    const font = a.sheet('font');
    const c = (s: string, y: number, colour: 'gold' | 'grey' | null = null) =>
      r.text(colour ? a.sheet('font', FONT_COLOURS[colour]) : font, s, Math.round(128 - (s.length * 8) / 2), y);
    c(this.title, 24);
    LINES.forEach(([s, colour], i) => s && c(s, 44 + i * 10, colour));
    c(this.version, 44 + LINES.length * 10 + 4, 'grey');
    this.items.forEach((it, i) => {
      const y = 182 + i * 14;
      if (i === this.index) r.text(font, '>', 76, y);
      r.text(font, it.label.toUpperCase(), 88, y);
    });
  }
}
