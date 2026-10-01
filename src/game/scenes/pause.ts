import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

export class PauseScene implements Scene {
  readonly translucent = true;
  private t = 0;
  constructor(private readonly game: Game) {}

  enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
  }
  exit(): void {
    this.game.ctx.audio.resume();
    this.game.ctx.audio.sfx('pause');
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.t > 10 && input.pressed('start')) this.game.scenes.pop();
  }

  render(r: Renderer): void {
    if ((this.t >> 4) % 2 === 0) r.text(this.game.ctx.assets.sheet('font'), 'PAUSE', 108, 112);
  }
}
