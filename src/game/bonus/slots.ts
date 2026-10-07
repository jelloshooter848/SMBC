import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { Game } from '../scenes/game';
import { BONUS_MUSIC, BONUS_SFX, drawItem, drawSlotPiece, SLOT_H, SLOT_W } from './art';
import { BonusScene, centred, fitLine, HINT_Y, type BonusResult } from './common';
import { SLOT_CELL, SLOT_LIVES, SLOT_STRIPS, SlotMachine, type SlotPicture } from './rules';

/** The window's left edge and the reels' top; the strips show between REEL_LEFT and REEL_RIGHT. */
export const WINDOW_X = 112;
export const REELS_Y = 88;
const REEL_LEFT = 32;
const REEL_RIGHT = 224;
/** Frames between the last reel stopping and the result. */
export const RESULT_DELAY = 40;

const NAMES: Readonly<Record<SlotPicture, string>> = {
  mushroom: 'Mushroom',
  flower: 'Fire Flower',
  star: 'Star',
};
const THIRDS = ['Top', 'Middle', 'Bottom'];

/**
 * SMB3's spade game: three reels (the top, middle and bottom thirds of a mushroom, fire flower or
 * star picture) scroll past a window; STOP halts them one at a time, top to bottom. A full picture
 * wins lives (mushroom 2, flower 3, star 5); a mismatch wins nothing. One try.
 */
export class SlotsScene extends BonusScene {
  protected music = BONUS_MUSIC.game;
  readonly machine: SlotMachine;
  private doneT: number | null = null;

  constructor(game: Game, seed: number, onEnd: (r: BonusResult) => void) {
    super(game, 'slots', seed, onEnd);
    this.machine = new SlotMachine(this.rng);
  }

  protected get decided(): boolean {
    return this.machine.done;
  }

  protected intro(): string {
    return `Three reels: the top, middle and bottom of a picture. ${this.hint('stop', 'jump')} stops them one at a time, top first. A full mushroom wins 2 lives, a flower 3, a star 5. One try.`;
  }

  protected playLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: this.machine.done ? null : 'STOP' };
  }

  protected play(input: InputFrame): void {
    const m = this.machine;
    m.tick();
    if (this.doneT !== null) {
      if (this.t - this.doneT === RESULT_DELAY) this.result();
      return;
    }
    if (input.pressed('jump')) this.stopReel();
  }

  /** Stops the next reel as STOP would. */
  stopReel(): void {
    const m = this.machine;
    const reel = m.next;
    const pic = m.stop();
    if (!pic) return;
    this.markPlayed();
    this.sfx(BONUS_SFX.stop);
    this.say(`${THIRDS[reel]}: ${NAMES[pic]}.`);
    if (m.done) this.doneT = this.t;
  }

  private result(): void {
    const prize = this.machine.prize();
    if (prize) {
      this.sfx(BONUS_SFX.win);
      this.award(prize);
      this.finish([
        `A FULL ${NAMES[this.machine.result() as SlotPicture].toUpperCase()}!`,
        ...(this.banner?.lines ?? []),
      ]);
    } else {
      this.sfx(BONUS_SFX.miss);
      this.finish(['NO MATCH. TOO BAD!']);
    }
  }

  protected draw(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    r.clear('#000');
    centred(r, font, 'SPADE GAME', 24);
    centred(r, font, 'STOP THE REELS TO', 44);
    centred(r, font, 'MAKE A PICTURE!', 56);
    const m = this.machine;
    // The machine's body behind the reels.
    r.rect(REEL_LEFT - 8, REELS_Y - 8, REEL_RIGHT - REEL_LEFT + 16, 3 * SLOT_H + 16, '#d82800');
    r.rect(REEL_LEFT - 4, REELS_Y - 4, REEL_RIGHT - REEL_LEFT + 8, 3 * SLOT_H + 8, '#000');
    for (let reel = 0; reel < 3; reel++) {
      const strip = SLOT_STRIPS[reel] as readonly SlotPicture[];
      const len = strip.length;
      const off = m.offsets[reel] as number;
      const y = REELS_Y + reel * SLOT_H;
      // Picture i sits at WINDOW_X when the offset is i × SLOT_CELL.
      const first = Math.floor((off - (WINDOW_X - REEL_LEFT)) / SLOT_CELL) - 1;
      const last = Math.ceil((off + (REEL_RIGHT - WINDOW_X)) / SLOT_CELL) + 1;
      for (let i = first; i <= last; i++) {
        const x = WINDOW_X + i * SLOT_CELL - off;
        if (x < REEL_LEFT || x + SLOT_W > REEL_RIGHT) continue; // only whole pictures
        drawSlotPiece(r, assets, strip[((i % len) + len) % len] as SlotPicture, reel, x, y);
      }
    }
    // The window: a white frame around the middle picture.
    const wx = WINDOW_X - 2;
    const wy = REELS_Y - 2;
    const ww = SLOT_W + 4;
    const wh = 3 * SLOT_H + 4;
    r.rect(wx, wy, ww, 2, '#fcfcfc');
    r.rect(wx, wy + wh - 2, ww, 2, '#fcfcfc');
    r.rect(wx, wy, 2, wh, '#fcfcfc');
    r.rect(wx + ww - 2, wy, 2, wh, '#fcfcfc');
    // Stopped reels are marked on the left.
    m.stopped.forEach((p, i) => {
      if (p) r.text(font, '>', REEL_LEFT - 20, REELS_Y + i * SLOT_H + 4);
    });
    // What each picture pays: its item and the lives.
    (Object.keys(SLOT_LIVES) as SlotPicture[]).forEach((p, i) => {
      const x = 44 + i * 64;
      drawItem(r, assets, p, x, 152);
      r.text(font, `${SLOT_LIVES[p]}UP`, x + 20, 156);
    });
    if (!m.done) {
      const full = `${this.hint('STOP', 'jump')} THE ${['TOP', 'MIDDLE', 'BOTTOM'][m.next]} REEL`;
      centred(r, font, fitLine(full, `STOP THE ${['TOP', 'MIDDLE', 'BOTTOM'][m.next]} REEL`), HINT_Y);
    }
  }
}
