import { MenuScene } from './menu';
import type { Game } from './game';

/*
 * O-16: leaving a Classic run asks first. The mid-run select's BACK and Pause > Quit open this
 * NO / YES card (NO first, as the original's Quit Game box puts CANCEL first: MenuBox.as
 * 320-330). YES goes to the CLASSIC menu; the run's save file was written before the select
 * and at the level's start (Game.keepResume), so quitting loses nothing.
 */

/** The question, and the line under it when the run is kept (Game.keepsResume: not dev, link or practice runs). */
export const QUIT_RUN_TITLE = 'QUIT TO THE CLASSIC MENU?';
export const QUIT_RUN_KEPT = 'YOUR RUN WAITS IN ITS FILE.';

export class QuitRunScene extends MenuScene {
  constructor(game: Game, onNo: () => void, onYes: () => void) {
    super(
      game,
      QUIT_RUN_TITLE,
      [
        { label: 'No', select: onNo },
        { label: 'Yes', select: onYes },
      ],
      onNo,
      true,
    );
    this.status = game.keepsResume ? QUIT_RUN_KEPT : '';
  }

  override enter(): void {
    const kept = this.status ? ' Your run waits in its file.' : '';
    // One line: the question, then the highlighted answer (NO); moving says "Yes" or "No".
    this.game.deps.announcer?.say(`Quit to the Classic menu?${kept} No`);
  }
}

/**
 * Opens the card over the current scene. NO (or BACK) closes it, saying so; YES leaves the run
 * for the CLASSIC menu.
 */
export function confirmQuitRun(game: Game, back = 'Back to the game.'): void {
  game.ctx.audio.sfx('pause');
  game.scenes.push(
    new QuitRunScene(
      game,
      () => {
        game.scenes.pop();
        game.deps.announcer?.say(back);
      },
      () => game.quitClassicRun(),
    ),
  );
}
