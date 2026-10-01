import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

export class TitleScene implements Scene {
  private t = 0;
  constructor(private readonly game: Game) {}

  enter(): void {
    this.game.ctx.audio.playMusic('title');
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.t > 20 && (input.pressed('start') || input.pressed('jump') || input.pressed('attack'))) {
      this.game.ctx.audio.sfx('select');
      this.game.showCharacterSelect();
    }
  }

  render(r: Renderer): void {
    r.clear('#5c94fc');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    r.rect(0, 208, 256, 32, '#c84c0c');
    r.rect(32, 40, 192, 72, '#000');
    r.rect(34, 42, 188, 68, '#e45c10');
    r.text(font, 'SMB', 48, 52);
    r.text(font, 'CROSSOVER', 48, 68);
    r.text(font, 'FAN REBUILD', 48, 88);
    const mario = assets.sheet('mario', 'mario');
    r.sprite(mario, 'big-idle', 176, 60);
    if ((this.t >> 5) % 2 === 0) r.text(font, 'PRESS START', 84, 150);
    r.text(font, 'ORIGINAL ART AND MUSIC', 40, 184);
    r.text(font, 'NOT AFFILIATED WITH NINTENDO', 16, 196);
  }
}
