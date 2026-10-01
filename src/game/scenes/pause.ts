import { MenuScene } from './menu';
import { OptionsScene } from './options';
import type { Game } from './game';

export class PauseScene extends MenuScene {
  constructor(game: Game) {
    super(game, 'PAUSE', [], null, true);
    this.setItems([
      { label: 'Continue', select: () => game.scenes.pop() },
      {
        label: 'Options',
        select: () => game.scenes.push(new OptionsScene(game, () => game.scenes.pop(), true)),
      },
      { label: 'Quit', select: () => game.showTitle() },
    ]);
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    super.enter();
  }
  exit(): void {
    this.game.ctx.audio.resume();
  }

  override update(input: Parameters<MenuScene['update']>[0]): void {
    if (this.t > 10 && input.pressed('start')) {
      this.game.scenes.pop();
      return;
    }
    super.update(input);
  }
}
