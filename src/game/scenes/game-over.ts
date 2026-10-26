import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { menuTouchLabels, NO_TOUCH_BUTTONS } from '../touch-labels';

/**
 * How long GAME OVER shows before the continue prompt: the original's
 * InformativeBlackScreen.END_DUR_GAME_OVER_MARIO (4500 ms, the length of the SMB game-over tune).
 */
export const GAME_OVER_CARD_FRAMES = 270;

/**
 * GAME OVER, then "CONTINUE?" with YES / NO, as in the original's InformativeBlackScreen
 * (SCREEN_TYPE_GAME_OVER): durTmrLsr swaps the GAME OVER text for CONTINUE, YES and NO with the
 * selector on YES; up/down toggles (setNewSelection) and jump or pause chooses (makeSelection).
 * YES continues (`onContinue`); NO goes back to the title (EventManager.restartGame).
 *
 * A Classic mode run (BUG-05, owner): CONTINUE and MAIN MENU in place of the question and its
 * YES / NO. Both keep the run: CONTINUE plays on at once, MAIN MENU goes to the CLASSIC menu,
 * where the set's Continue goes on from the same point (the game over wrote its slot there).
 */
export class GameOverScene implements Scene {
  private t = 0;
  private _prompting = false;
  private _yes = true;
  constructor(
    private readonly game: Game,
    private readonly onContinue: (() => void) | null = null,
    /** A Classic mode run's choices: CONTINUE / MAIN MENU (BUG-05). */
    private readonly classic = false,
  ) {}

  /** The two choices as said (YES / NO, or a Classic run's CONTINUE / MAIN MENU). */
  private get choices(): [string, string] {
    return this.classic ? ['Continue', 'Main menu'] : ['Yes', 'No'];
  }

  /** The CONTINUE prompt is up. */
  get prompting(): boolean {
    return this._prompting;
  }
  /** YES is selected. */
  get yes(): boolean {
    return this._yes;
  }

  /** Nothing to press until CONTINUE? shows; then A answers it. */
  touchLabels(): TouchLabels {
    return this._prompting ? menuTouchLabels(false) : NO_TOUCH_BUTTONS;
  }

  enter(): void {
    this.game.ctx.audio.playJingle('game-over');
    this.game.deps.announcer?.say('Game over.');
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    this.t++;
    if (!this._prompting) {
      // No input until the card's timer ends (the original only reads buttons in CONTINUE_SELECT).
      if (this.t >= GAME_OVER_CARD_FRAMES) this.showPrompt();
      return;
    }
    // Any player may answer (co-op shares the run).
    const pressed = (a: 'up' | 'down' | 'jump' | 'start') => inputs.some((f) => f.pressed(a));
    if (pressed('up') || pressed('down')) {
      this._yes = !this._yes;
      this.game.ctx.audio.sfx('select');
      this.game.deps.announcer?.say(this.choices[this._yes ? 0 : 1]);
    } else if (pressed('jump') || pressed('start')) {
      if (this._yes && this.onContinue) {
        this.game.ctx.audio.sfx('coin');
        this.onContinue();
      } else {
        this.game.ctx.audio.sfx('select');
        // NO: a Classic mode run goes back to the CLASSIC menu, on its own set; everything else to the title.
        // v0.4.73 items 63 / 64: a dev START page start goes back to Dev > Level select.
        if (this.game.classicRun) this.game.showClassicMenu(this.game.runSet);
        else if (this.game.levelSelectBack) this.game.backToLevelSelect();
        else this.game.showTitle();
      }
    }
  }

  private showPrompt(): void {
    if (!this.onContinue) {
      // v0.4.73 items 63 / 64: a dev START page start goes back to Dev > Level select.
      if (this.game.levelSelectBack) this.game.backToLevelSelect();
      else this.game.showTitle();
      return;
    }
    this._prompting = true;
    this._yes = true;
    this.game.deps.announcer?.say(
      this.classic
        ? 'Continue or main menu? Both keep your run. Continue. Up and down to choose, OK to confirm.'
        : 'Continue? Yes. Up and down to choose, OK to confirm.',
    );
  }

  render(r: Renderer): void {
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    if (!this._prompting) {
      r.text(font, 'GAME OVER', 92, 112);
      return;
    }
    if (this.classic) {
      r.text(font, 'CONTINUE', 96, 104);
      r.text(font, 'MAIN MENU', 96, 120);
      r.text(font, '>', 82, this._yes ? 104 : 120);
      return;
    }
    r.text(font, 'CONTINUE?', 92, 96);
    r.text(font, 'YES', 112, 120);
    r.text(font, 'NO', 112, 136);
    r.text(font, '>', 98, this._yes ? 120 : 136);
  }
}
