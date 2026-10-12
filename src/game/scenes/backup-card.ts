import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { loadSave, type SaveSlot } from '@game/save/save-files';
import { encodeSaveCode } from '@game/save/save-code';
import { copyCode, COPY_STATUS, shareSave, SHARE_STATUS } from '@game/save/share-code';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { CARD_GUARD_FRAMES } from './message';
import { abilityHint } from './hints';
import { codeLines, shareEnv, spokenCode } from './save-codes';
import type { Game } from './game';

/** The card's choices, top to bottom. */
export const BACKUP_CHOICES = ['SHARE SAVE', 'COPY CODE', 'NOT NOW'] as const;

/**
 * "BACK UP YOUR GAME?" (0.4.44): over the map after a castle's first clear (campaign only, while
 * Options > Save files > Backup reminders is on; Game.offerBackup). SHARE SAVE and COPY CODE do
 * what they do in Options > Save files and leave the card up, saying what happened; NOT NOW (or B)
 * closes it, DONE once something was shared or copied. It waits for a press and is read out.
 */
export class BackupCardScene implements Scene {
  readonly translucent = true;
  index = 0;
  status = '';
  /** Something was shared or copied: the last choice reads DONE. */
  done = false;
  /** The browser refused to share or copy: the code, shown on the card to copy by hand. */
  shownCode: string | null = null;
  private t = 0;
  private busy = false;

  constructor(
    private readonly game: Game,
    readonly slot: SaveSlot,
  ) {}

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private label(i: number): string {
    return i === 2 && this.done ? 'DONE' : (BACKUP_CHOICES[i] as string);
  }

  enter(): void {
    this.say(
      `Back up your game? A save code keeps your file safe. Share save, copy code, or not now. ${this.label(this.index)}.`,
    );
  }

  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: this.done ? 'DONE' : 'NOT NOW' };
  }

  /** SHARE SAVE and COPY CODE run inside the confirm press's own event (iOS: Scene.gesture). */
  gesture(): (() => void) | null {
    if (this.t <= CARD_GUARD_FRAMES || this.busy || this.index > 1) return null;
    const what = this.index === 0 ? 'share' : 'copy';
    return () => {
      this.game.ctx.audio.sfx('coin');
      void this.act(what);
    };
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (++this.t <= CARD_GUARD_FRAMES) return;
    const any = (a: 'jump' | 'start' | 'attack' | 'select' | 'up' | 'down' | 'left' | 'right') =>
      inputs.some((i) => i.pressed(a));
    const audio = this.game.ctx.audio;
    // While the share sheet or clipboard is busy only NOT NOW works: a sheet that never answers
    // (it happens) must not hold the card, and the map, forever.
    if (this.busy) {
      if (any('attack') || any('select')) this.close();
      return;
    }
    if (any('up') || any('left') || any('down') || any('right')) {
      this.index = (this.index + (any('up') || any('left') ? 2 : 1)) % 3;
      audio.sfx('select');
      this.say(this.label(this.index));
    } else if (any('attack') || any('select')) this.close();
    else if (any('jump') || any('start')) {
      // SHARE / COPY already ran in the key's or button's own event (gesture).
      if (this.index < 2 && this.game.gestures.take()) return;
      audio.sfx('coin');
      if (this.index === 0) void this.act('share');
      else if (this.index === 1) void this.act('copy');
      else this.close();
    }
  }

  /** SHARE SAVE / COPY CODE with the file as saved (the castle's clear is already in it). */
  async act(what: 'share' | 'copy'): Promise<void> {
    const save = loadSave(this.slot);
    if (!save) {
      this.setStatus('NO FILE TO BACK UP');
      return;
    }
    this.busy = true;
    this.status = what === 'share' ? 'SHARING...' : '';
    try {
      const env = shareEnv(this.game);
      let failed: boolean;
      if (what === 'share') {
        const outcome = await shareSave(save, env);
        this.done ||= outcome === 'shared' || outcome === 'copied';
        failed = outcome === 'failed';
        this.setStatus(SHARE_STATUS[outcome]);
      } else {
        const ok = await copyCode(save, env);
        this.done ||= ok;
        failed = !ok;
        this.setStatus(ok ? COPY_STATUS.ok : COPY_STATUS.failed);
      }
      // The browser said no: the code goes on the card, to write down or copy by hand.
      if (failed && !this.shownCode) {
        this.shownCode = encodeSaveCode(save);
        this.say(`Your save code: ${spokenCode(this.shownCode)}.`);
      }
    } finally {
      this.busy = false;
    }
    if (this.done) this.index = 2;
  }

  private setStatus(text: string): void {
    this.status = text;
    this.say(this.done ? `${text}. Done.` : text);
  }

  private close(): void {
    this.game.ctx.audio.sfx('select');
    if (this.game.scenes.top === this) this.game.scenes.pop();
    this.say(this.done ? 'Done.' : 'Not now. Options, Save files has your save code any time.');
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    const x = 16;
    // With the code shown (the browser refused) it takes the subtitle's place, and the card
    // grows to hold it (up to five lines at 100%), centred.
    const lines = this.shownCode ? codeLines(this.shownCode) : [];
    const choicesAt = lines.length ? 30 + lines.length * 10 : 46;
    const h = choicesAt + 74;
    const y = lines.length ? 120 - (h >> 1) : 56;
    const w = 224;
    r.rect(x - 2, y - 2, w + 4, h + 4, '#fcfcfc');
    r.rect(x, y, w, h, '#000');
    const center = (s: string, ty: number) => r.text(font, s, 128 - s.length * 4, ty);
    center('BACK UP YOUR GAME?', y + 10);
    if (lines.length) lines.forEach((l, i) => center(l, y + 24 + i * 10));
    else center('A CODE KEEPS YOUR SAVE', y + 26);
    const y2 = y + choicesAt - 46;
    BACKUP_CHOICES.forEach((_, i) => {
      const label = this.label(i);
      const ty = y2 + 46 + i * 14;
      r.text(font, label, 80, ty);
      // A steady cursor: no blinking (Options > Video > Reduce flash or not).
      if (i === this.index) r.text(font, '>', 66, ty);
    });
    if (this.status) center(this.status.slice(0, 28), y2 + 92);
    center(abilityHint(this.game, 'OK', 'jump'), y2 + 106);
  }
}
