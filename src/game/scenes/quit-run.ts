import type { Renderer } from '@engine/gfx/renderer';
import { FONT_COLOURS } from '@content/sprites/font';
import { MenuScene } from './menu';
import type { Game } from './game';
import { abilityHint } from './hints';
import { drawMenuBox, type BoxRow } from './menu-box';

/*
 * O-16: leaving a Classic run asks first. The mid-run select's BACK and Pause > Quit open this
 * NO / YES card (NO first, as the original's Quit Game box puts CANCEL first: MenuBox.as
 * 320-330). YES goes to the CLASSIC menu; the run's save file was written before the select
 * and at the level's start (Game.keepResume), so quitting loses nothing.
 *
 * 0.4.72 (owner): the card is a CLASSIC box (menu-box.ts), not the see-through panel: the
 * question on the box's gold header row, the mushroom cursor on NO / YES, the promise on a line
 * of its own at the box's foot, the original's box sounds (as the CLASSIC
 * boxes set them) and the BACK line under it. It is drawn over whatever it opened on (the
 * select, the pause menu), which stays in view around it. It is drawn open at once (no growing
 * open), so the question is on screen the frame it is said.
 */

/**
 * Where the card's box is centred (screen px): over the select's name box, so its BACK line
 * falls in the open sky above the ground.
 */
export const QUIT_BOX_CY = 146;

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
    // The original's box sounds (MessageBoxSounds SN_CHANGE_SELECTION, SN_CANCEL_ITEM; RC-040).
    this.moveSfx = 'fireball';
    this.backSfx = 'bump';
  }

  /** The CLASSIC box over the scene under it (0.4.72), with the BACK line beneath. */
  override render(r: Renderer): void {
    const game = this.game;
    const calm = game.ctx.reduceFlashing;
    const rows: BoxRow[] = this.items.map((it) => ({ label: it.label }));
    const at = drawMenuBox(r, game.ctx.assets, rows, this.index, {
      cx: 128,
      cy: QUIT_BOX_CY,
      grow: 1,
      t: this.t,
      calm,
      header: this.title,
      ...(this.status ? { footer: this.status } : {}),
    });
    const back = abilityHint(game, 'BACK', this.backAction);
    const x = Math.round(128 - (back.length * 8) / 2);
    const y = at.y + at.h + 4;
    r.text(game.ctx.assets.sheet('font', FONT_COLOURS.black), back, x + 1, y + 1);
    r.text(game.ctx.assets.sheet('font'), back, x, y);
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
