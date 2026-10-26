import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { AssistSettings } from '@engine/save/settings';
import { ADVANCED_OFF } from '../advanced-cheats';
import type { ClassicFileRef } from '../original-files';
import type { Game } from './game';
import { MenuScene, backToMenu, type MenuItem } from './menu';
import { demoUnder, renderBoxedMenu } from './original-box-menu';
import { assistItems } from './options';

/*
 * v0.4.73 (owner item 60): a CLEARED file's ADVANCED CHEATS page, unlocked by beating its map set
 * on Hard: every dev Assist (the same rows as dev mode's Assists page, each playing as it does
 * there), for that file's runs only. A Classic box with the original's box sounds: over the
 * CLASSIC title from the file's world box, or over the paused level from its pause menu. Each
 * change is kept with the file at once (Game.setAdvancedCheats) and read out; BACK goes back one
 * box. With dev mode on the dev Assists play instead (its line under the box says so).
 */

/** The row that opens it (the file's world box, its pause menu), next to Cheats. */
export function advancedCheatsItem(game: Game, ref: ClassicFileRef, onBack?: () => void): MenuItem {
  return {
    label: 'Advanced cheats',
    select: () => game.scenes.push(new AdvancedCheatsScene(game, ref, onBack ?? (() => backToMenu(game)))),
    hint: game.devMode
      ? "Every assist, for this file's runs. Dev mode's Assists play while dev mode is on"
      : "Every assist, for this file's runs only. You beat it on Hard",
  };
}

export class AdvancedCheatsScene extends MenuScene {
  private readonly values: AssistSettings;
  /** The CLEARED file this page was opened for (review fix 1: it never writes another). */
  private readonly fileId: string;
  private readonly over = demoUnder(this.game);

  constructor(
    game: Game,
    readonly ref: ClassicFileRef,
    onBack: () => void,
  ) {
    super(game, 'ADVANCED CHEATS', [], onBack, true);
    this.moveSfx = 'fireball';
    this.backSfx = 'bump';
    this.adjustSfx = 'coin';
    this.okAdjustSfx = 'coin';
    this.entryTitle = `Advanced cheats, file ${ref.slot}`;
    this.fileId = game.advancedCheatsId(ref) ?? '';
    this.values = { ...(game.advancedCheatsOf(ref)?.assist ?? ADVANCED_OFF) };
    this.setItems([
      ...assistItems(this.values, () => this.keep()),
      { label: 'Back', select: () => this.onBack?.() },
    ]);
    this.status = game.devMode ? 'DEV MODE: DEV ASSISTS PLAY' : `FILE ${ref.slot} ONLY`;
  }

  /** A change: kept with the file (this session at least, when storage refuses it). */
  private keep(): void {
    if (!this.game.setAdvancedCheats(this.ref, this.fileId, { assist: { ...this.values } }))
      this.game.ctx.audio.sfx('bump');
  }

  override update(input: InputFrame): void {
    this.over?.tickDemo();
    super.update(input);
  }

  override render(r: Renderer): void {
    // Over the paused level (the pause menu under it is not drawn): the level dimmed.
    if (!this.over) r.rect(0, 0, 256, 240, 'rgba(0,0,0,0.6)');
    renderBoxedMenu(r, this.game, {
      backAction: this.backAction,
      header: 'Advanced cheats',
      items: this.items,
      index: this.index,
      t: this.t,
      status: this.status,
      age: this.over ? this.t : null,
    });
  }
}
