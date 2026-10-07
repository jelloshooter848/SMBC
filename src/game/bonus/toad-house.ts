import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { Game } from '../scenes/game';
import { wrapText } from '../hud/text';
import { BONUS_MUSIC, BONUS_SFX, drawChest, drawItem, drawToad } from './art';
import { BonusScene, centred, drawTextBox, fitLine, type BonusResult } from './common';
import { dealChests } from './rules';
import { ITEM_SPOKEN, type ItemId } from './items';

/** Toad's line (SMB3's, word for word). */
export const TOAD_LINE = 'PICK A BOX. ITS CONTENTS WILL HELP YOU ON YOUR WAY.';
/** Chests' left edges and the floor they stand on. */
export const CHEST_X: readonly number[] = [72, 120, 168];
const FLOOR_Y = 176;
const CHEST_Y = FLOOR_Y - 16;
/** Frames from the lid opening to the prize being given (it rises out meanwhile). */
export const OPEN_FRAMES = 40;

/**
 * SMB3's Toad House: Toad, three chests, pick one with left / right and OPEN. The chest opens, its
 * prize (mushroom 50%, fire flower 35%, star 15%, rolled from the seed as the house opens) rises
 * out and goes into the item inventory with a banner; then the result card and OK end it.
 */
export class ToadHouseScene extends BonusScene {
  protected music = BONUS_MUSIC.toadHouse;
  /** The three chests' contents, left to right. */
  readonly chests: ItemId[];
  cursor = 1;
  /** The chest opened and the frame it opened, or null while picking. */
  opened: { index: number; t: number } | null = null;

  constructor(game: Game, seed: number, onEnd: (r: BonusResult) => void) {
    super(game, 'toad-house', seed, onEnd);
    this.chests = dealChests(this.rng);
  }

  protected intro(): string {
    return `Toad: Pick a box. Its contents will help you on your way. Left and right to choose, ${this.hint('open', 'jump')} to open. Box 2 of 3.`;
  }

  protected playLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: this.opened ? null : 'OPEN' };
  }

  protected play(input: InputFrame): void {
    const o = this.opened;
    if (o) {
      if (this.t - o.t === OPEN_FRAMES) {
        const item = this.chests[o.index] as ItemId;
        this.award({ kind: 'item', item });
        this.sfx(BONUS_SFX.win);
      }
      if (this.t - o.t >= OPEN_FRAMES + 60) this.finish(this.banner?.lines ?? []);
      return;
    }
    const d = input.pressed('left') ? -1 : input.pressed('right') ? 1 : 0;
    if (d) {
      const next = this.cursor + d;
      if (next < 0 || next > 2) this.sfx(BONUS_SFX.miss);
      else {
        this.cursor = next;
        this.sfx(BONUS_SFX.move);
        this.say(`Box ${next + 1} of 3.`);
      }
      return;
    }
    if (input.pressed('jump')) this.open(this.cursor);
  }

  /** Opens chest `index` (tests call this as OPEN would). */
  open(index: number): void {
    if (this.opened) return;
    this.cursor = index;
    this.played = true;
    this.opened = { index, t: this.t };
    this.sfx(BONUS_SFX.open);
    this.say(`Box ${index + 1}: ${ITEM_SPOKEN[this.chests[index] as ItemId]}!`);
  }

  protected draw(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    // The house: a dark room, a striped curtain at the top and a wooden floor.
    r.clear('#000');
    for (let x = 0; x < 256; x += 16) r.rect(x, 0, 8, 12, '#d82800');
    r.rect(0, 12, 256, 2, '#fca044');
    r.rect(0, FLOOR_Y, 256, 240 - FLOOR_Y, '#7c3c00');
    for (let x = 0; x < 256; x += 32) r.rect(x, FLOOR_Y, 1, 240 - FLOOR_Y, '#4c1c00');
    r.rect(0, FLOOR_Y, 256, 2, '#c84c0c');
    // Toad's words, and Toad on the left facing the chests.
    drawTextBox(r, font, wrapText(TOAD_LINE, 26), 24);
    drawToad(r, assets, 32, FLOOR_Y - 24);
    // The hero waits on the right, facing left.
    const pic = this.game.state.character.portrait;
    const hero = assets.sheet(pic.sheet, pic.palette);
    const f = hero.frames.get(pic.frame);
    if (f) r.sprite(hero, pic.frame, 216, FLOOR_Y - f.h, true);
    const o = this.opened;
    CHEST_X.forEach((x, i) => {
      drawChest(r, assets, o?.index === i, x, CHEST_Y);
      if (o?.index !== i) return;
      const k = Math.min(1, (this.t - o.t) / OPEN_FRAMES);
      drawItem(r, assets, this.chests[i] as ItemId, x, CHEST_Y - 4 - Math.round(24 * k));
    });
    if (!o) {
      // The pointer over the chosen chest: a small down arrow that bobs (still with reduce flashing).
      const bob = this.reduceFlashing ? 0 : (this.t >> 4) % 2;
      const x = (CHEST_X[this.cursor] as number) + 4;
      const y = CHEST_Y - 14 + bob;
      r.rect(x, y, 8, 2, '#fcfcfc');
      r.rect(x + 1, y + 2, 6, 2, '#fcfcfc');
      r.rect(x + 3, y + 4, 2, 2, '#fcfcfc');
      const full = `LEFT/RIGHT CHOOSE  ${this.hint('OPEN', 'jump')}`;
      centred(r, font, fitLine(full, 'LEFT/RIGHT CHOOSE  OPEN'), 216);
    }
  }
}
