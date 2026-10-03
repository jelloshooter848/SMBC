import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import { DevMenuScene } from './dev';
import type { Game } from './game';

export class PauseScene extends MenuScene {
  constructor(game: Game) {
    super(game, 'PAUSE', [], null, true);
    this.rebuild();
  }

  private rebuild(): void {
    const game = this.game;
    const items: MenuItem[] = [
      { label: 'Continue', select: () => game.scenes.pop() },
      {
        label: 'Options',
        select: () => game.scenes.push(new OptionsScene(game, () => game.scenes.pop(), true)),
      },
    ];
    if (game.devMode)
      items.push({ label: 'Dev mode', select: () => game.scenes.push(new DevMenuScene(game, true)) });
    items.push({ label: 'Quit', select: () => (game.playtestDone ? game.playtestDone() : game.showTitle()) });
    this.setItems(items);
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    this.rebuild();
    super.enter();
  }
  exit(): void {
    this.game.ctx.audio.resume();
  }

  override update(input: Parameters<MenuScene['update']>[0]): void {
    // Returning from a sub-menu (dev mode off) must refresh the entries.
    if (this.items.some((i) => i.label === 'Dev mode') !== this.game.devMode) this.rebuild();
    // Start selects the highlighted entry (Continue by default), so a double tap of Start still resumes.
    super.update(input);
  }
}
