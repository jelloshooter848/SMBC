import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import type { Game } from './game';
import { abilityHint } from './hints';
import { fontText } from '../hud/text';
import { cardContinues, CARD_GUARD_FRAMES } from './message';
import { NO_TOUCH_BUTTONS } from '../touch-labels';

/** The story a new campaign file opens with (owner brief for 0.5.0), one card per page. */
export const STORY_PAGES: readonly (readonly string[])[] = [
  ['BOWSER, KING OF THE KOOPAS,', 'HAS REACHED BEYOND THE', 'MUSHROOM KINGDOM.'],
  ['WITH DARK MAGIC HE HAS', 'BRAINWASHED THE HEROES OF', 'OTHER WORLDS AND HIDDEN', 'THEM ALONG YOUR ROAD.'],
  ['ONLY MARIO IS STILL FREE.', '', 'FIND THE LOST HEROES,', 'TALK TO THEM AND BREAK', 'THE SPELL!'],
];

/**
 * Pages of centred text on black, as the message cards: OK (or any player's) goes to the next
 * page once the card guard is over, MENU skips the rest; each page also moves on by itself after
 * a long wait. Announced page by page.
 */
export class StoryScene implements Scene {
  private page = 0;
  private t = 0;
  private done = false;

  constructor(
    private readonly game: Game,
    private readonly pages: readonly (readonly string[])[],
    private readonly next: () => void,
    private readonly timeout = 900,
  ) {}

  enter(): void {
    this.announce();
  }

  private announce(): void {
    const lines = this.pages[this.page] ?? [];
    const last = this.page === this.pages.length - 1;
    this.game.deps.announcer?.say(
      `${lines.filter(Boolean).join(' ')} ${last ? 'OK to begin.' : 'OK for more, menu to skip.'}`,
    );
  }

  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', start: 'SKIP' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    if (this.t > CARD_GUARD_FRAMES && inputs.some((i) => i.pressed('start'))) return this.finish();
    if (!cardContinues(this.t, this.timeout, inputs, ['jump', 'attack'])) return;
    this.game.ctx.audio.sfx('select');
    if (this.page + 1 >= this.pages.length) return this.finish();
    this.page++;
    this.t = 0;
    this.announce();
  }

  private finish(): void {
    this.done = true;
    this.next();
  }

  render(r: Renderer): void {
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    const lines = this.pages[this.page] ?? [];
    const y0 = 104 - (lines.length * 14) / 2;
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, y0 + i * 14));
    const last = this.page === this.pages.length - 1;
    if (this.t > CARD_GUARD_FRAMES && (this.t >> 5) % 2 === 0) {
      const go = fontText(`${abilityHint(this.game, last ? 'OK' : 'NEXT', 'jump')}`);
      r.text(font, go, 128 - go.length * 4, 184);
    }
    if (!last) {
      const skip = fontText(abilityHint(this.game, 'SKIP', 'start'));
      r.text(font, skip, 248 - skip.length * 8, 216);
    }
  }
}
