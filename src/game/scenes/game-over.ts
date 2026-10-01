import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

export class GameOverScene implements Scene {
  private t = 0;
  constructor(private readonly game: Game) {}

  enter(): void {
    this.game.ctx.audio.playJingle('game-over');
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.t >= 300 || (this.t > 60 && (input.pressed('start') || input.pressed('jump'))))
      this.game.showTitle();
  }

  render(r: Renderer): void {
    r.clear('#000');
    r.text(this.game.ctx.assets.sheet('font'), 'GAME OVER', 92, 112);
  }
}
