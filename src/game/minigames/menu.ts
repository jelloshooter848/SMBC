import type { Game } from '../scenes/game';
import { MenuScene, type MenuItem } from '../scenes/menu';
import { AssistOptionsScene } from '../scenes/options';

/*
 * The menu every mini game opens on MENU (MiniGameDef: "it owns its own menu"): Continue, Give up
 * and, while dev mode is on, the dev assists, as the pause menu offers them in campaign play
 * (no damage, infinite lives...; they live in GameContext.assist and every World reads them).
 */

/**
 * The dev rows a mini game's menu adds while dev mode is on: "Assists" (the dev assists screen,
 * changes apply at once). Empty with dev mode off.
 */
export function miniGameDevItems(game: Game): MenuItem[] {
  if (!game.devMode) return [];
  return [
    {
      label: 'Assists',
      select: () => game.scenes.push(new AssistOptionsScene(game, () => game.scenes.pop())),
      hint: 'Dev mode: no damage, infinite lives and the rest',
    },
  ];
}

/**
 * A mini game's menu: Continue, Give up (`giveUp` ends the round as 'quit'; `giveUpHint` says
 * what that means) and, in dev mode, Assists. Pauses the audio while open, sounds like pause.
 */
export class MiniGameMenuScene extends MenuScene {
  constructor(game: Game, title: string, giveUp: () => void, giveUpHint?: string) {
    super(
      game,
      title,
      [
        { label: 'Continue', select: () => game.scenes.pop() },
        {
          label: 'Give up',
          select: () => {
            game.scenes.pop();
            giveUp();
          },
          ...(giveUpHint ? { hint: giveUpHint } : {}),
        },
        ...miniGameDevItems(game),
      ],
      () => game.scenes.pop(),
      true,
    );
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    super.enter();
  }

  exit(): void {
    this.game.ctx.audio.resume();
  }
}
