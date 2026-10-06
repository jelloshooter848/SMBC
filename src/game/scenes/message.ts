import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from './game';
import type { World } from '../world/world';

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

/**
 * A closing card (the Lost Levels' endings): its lines drawn where the castle's text goes
 * (World.castleText), over the level when given its `world` so the HUD keeps showing the score,
 * as in the SMB 8-4 ending; else on black. Start or B (attack, the card's "PUSH BUTTON B")
 * from any player continues, or the timeout.
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
  ) {
    this.translucent = world !== null;
    if (world) world.castleText = [...lines];
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    const pushed = this.t > 30 && inputs.some((i) => i.pressed('start') || i.pressed('attack'));
    if (this.t >= this.timeout || pushed) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    if (this.world) return; // the level beneath draws the lines (World.castleText)
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    this.lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, 80 + i * 16));
  }
}
