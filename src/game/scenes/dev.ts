import { MenuScene } from './menu';
import { DevLevelSelectScene } from './dev-level-select';
import { AssistOptionsScene } from './options';
import type { Game } from './game';

/**
 * Developer tools menu, reachable from the title and (translucently) from the pause menu.
 * More test tools go here as rows.
 */
export class DevMenuScene extends MenuScene {
  constructor(game: Game, fromPause = false) {
    super(game, 'DEV MODE', [], () => game.scenes.pop(), fromPause);
    const push = (s: MenuScene) => {
      s.translucent = this.translucent;
      game.scenes.push(s);
    };
    this.setItems([
      { label: 'Level select', select: () => push(new DevLevelSelectScene(game, () => game.scenes.pop())) },
      {
        label: 'Assists',
        select: () => push(new AssistOptionsScene(game, () => game.scenes.pop())),
        hint: 'Only active while dev mode is on',
      },
      {
        label: 'Dev mode off',
        select: () => {
          const s = game.deps.settings;
          if (s) {
            s.dev = false;
            game.deps.applySettings?.();
          }
          if (fromPause)
            game.scenes.pop(); // back to the pause menu, which rebuilds without the entry
          else game.showTitle();
        },
        hint: 'Hides developer mode until the code is entered again',
      },
      { label: 'Back', select: () => game.scenes.pop() },
    ]);
  }
}
