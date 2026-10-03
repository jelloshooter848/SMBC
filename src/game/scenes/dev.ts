import { MenuScene } from './menu';
import { DevLevelSelectScene } from './dev-level-select';
import type { Game } from './game';

/** Developer tools menu. More test tools go here as rows. */
export class DevMenuScene extends MenuScene {
  constructor(game: Game) {
    super(game, 'DEV MODE', [], () => game.scenes.pop());
    this.setItems([
      {
        label: 'Level select',
        select: () => game.scenes.push(new DevLevelSelectScene(game, () => game.scenes.pop())),
      },
      {
        label: 'Dev mode off',
        select: () => {
          const s = game.deps.settings;
          if (s) {
            s.dev = false;
            game.deps.applySettings?.();
          }
          game.showTitle();
        },
        hint: 'Hides developer mode until the code is entered again',
      },
      { label: 'Back', select: () => game.scenes.pop() },
    ]);
  }
}
