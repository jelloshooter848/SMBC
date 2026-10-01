import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

/** Centered lines of text on black; continues on start/jump or after a timeout. */
export class MessageScene implements Scene {
  private t = 0;
  constructor(
    private readonly game: Game,
    private readonly lines: string[],
    private readonly next: () => void,
    private readonly timeout = 600,
  ) {}

  update(input: InputFrame): void {
    this.t++;
    if (this.t >= this.timeout || (this.t > 30 && (input.pressed('start') || input.pressed('jump'))))
      this.next();
  }

  render(r: Renderer): void {
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    const y0 = 120 - (this.lines.length * 12) / 2;
    this.lines.forEach((l, i) => r.text(font, l, 128 - (l.length * 8) / 2, y0 + i * 12));
  }
}
