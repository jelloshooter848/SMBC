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

/** Give up's hint in a round played for fun (Game.inRound), whatever the game. */
export const ROUND_GIVE_UP_HINT = 'Ends the round';

/**
 * A mini game's menu: Continue, Give up (`giveUp` ends the round as 'quit'; `campaignHint` says
 * what that means in campaign play; in a round for fun, `ROUND_GIVE_UP_HINT`, since the hero may
 * long be freed) and, in dev mode, Assists. Pauses the audio while open, sounds like pause.
 */
export class MiniGameMenuScene extends MenuScene {
  constructor(game: Game, title: string, giveUp: () => void, campaignHint?: string) {
    const giveUpHint = game.inRound ? ROUND_GIVE_UP_HINT : campaignHint;
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
