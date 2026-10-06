import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import {
  clearedMainLevels,
  eraseSave,
  highestWorld,
  listSaves,
  newSave,
  SAVE_SLOTS,
  UNREADABLE,
  writeSave,
  type SaveSlot,
  type SlotContents,
} from '@game/save/save-files';
import type { CharacterDef } from '../characters/character';
import { pad, SCORE_MAX } from '../hud/hud';
import { CharacterSelectScene } from './character-select';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { menuTouchLabels } from '../touch-labels';

/** Main levels on the map (1-1..8-4). */
export const MAIN_LEVEL_COUNT = 32;

type Mode = 'choose' | 'erase' | 'confirm';

const ROW_Y = [32, 78, 124] as const;
const ROW_H = 40;
const BOTTOM_Y = 176;

/**
 * Title → "Start game": three save files. A used file shows its hero(es), world reached, levels
 * cleared, lives and score (and a star once the game was beaten); an empty one says NEW GAME.
 * Picking an empty file goes through character select (player 2 may join) and creates it; a used
 * file opens its map. The bottom row erases a file (pick it, then confirm YES / NO).
 * A slot whose data can't be read shows UNREADABLE and must be erased before it is reused.
 * Up/down move, A/Start choose, B/Select back.
 */
export class FileSelectScene implements Scene {
  /** 0-2: the files; 3: the bottom row (ERASE FILE, or CANCEL while erasing). */
  index = 0;
  mode: Mode = 'choose';
  /** Confirm prompt: YES highlighted (NO by default). */
  yes = false;
  saves: SlotContents[] = [];
  private t = 0;

  constructor(
    private readonly game: Game,
    slot: SaveSlot = 1,
  ) {
    this.index = slot - 1;
  }

  enter(): void {
    this.saves = listSaves();
    this.t = 0;
    this.say(`Select a file. ${this.rowText()}`);
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private character(id: string | null): CharacterDef | null {
    if (id === null) return null;
    const chars = this.game.deps.characters;
    return chars.find((c) => c.id === id) ?? chars[0] ?? null;
  }

  /** Screen-reader text for the highlighted row. */
  rowText(): string {
    if (this.index === 3) return this.mode === 'choose' ? 'Erase file.' : 'Cancel.';
    const slot = this.index + 1;
    const s = this.saves[this.index];
    if (!s) return `File ${slot}. New game.`;
    if (s === UNREADABLE) return `File ${slot}: unreadable. Erase it to use this file.`;
    const c1 = this.character(s.character);
    const c2 = this.character(s.character2);
    const heroes = c2 ? `${c1?.name} and ${c2.name}` : `${c1?.name}`;
    return (
      `File ${slot}. ${heroes}. World ${highestWorld(s)}. ` +
      `${clearedMainLevels(s)} of ${MAIN_LEVEL_COUNT} levels cleared. ${s.lives} lives. Score ${s.score}.` +
      (s.gameCleared ? ' Game cleared.' : '')
    );
  }

  /** A picks (or answers the erase prompt), B goes back. */
  touchLabels(): TouchLabels {
    return menuTouchLabels(true);
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.t < 6) return;
    const audio = this.game.ctx.audio;
    const ok = input.pressed('jump') || input.pressed('start');
    const back = input.pressed('attack') || input.pressed('select');
    if (this.mode === 'confirm') {
      if (input.pressed('left') || input.pressed('right') || input.pressed('up') || input.pressed('down')) {
        this.yes = !this.yes;
        audio.sfx('select');
        this.say(this.yes ? 'Yes' : 'No');
      } else if (ok && this.yes) {
        const slot = (this.index + 1) as SaveSlot;
        eraseSave(slot);
        this.saves = listSaves();
        this.mode = 'choose';
        audio.sfx('break');
        this.say(`File ${slot} erased. ${this.rowText()}`);
      } else if (ok || back) {
        this.mode = 'erase';
        audio.sfx('select');
        this.say(`Erase which file? ${this.rowText()}`);
      }
      return;
    }
    if (input.pressed('up') || input.pressed('down')) {
      this.index = (this.index + (input.pressed('up') ? 3 : 1)) % 4;
      audio.sfx('select');
      this.say(this.rowText());
      return;
    }
    if (back) {
      audio.sfx('select');
      if (this.mode === 'erase') this.cancelErase();
      else this.game.showTitle();
      return;
    }
    if (!ok) return;
    if (this.index === 3) {
      audio.sfx('select');
      if (this.mode === 'erase') this.cancelErase();
      else if (this.saves.every((s) => s === null)) {
        audio.sfx('bump');
        this.say('No files to erase.');
      } else {
        this.mode = 'erase';
        this.index = Math.max(
          0,
          this.saves.findIndex((s) => s !== null),
        );
        this.say(`Erase which file? ${this.rowText()}`);
      }
      return;
    }
    const slot = (this.index + 1) as SaveSlot;
    const save = this.saves[this.index] ?? null;
    if (this.mode === 'erase') {
      if (!save) {
        audio.sfx('bump');
        this.say(`File ${slot} is empty.`);
        return;
      }
      this.mode = 'confirm';
      this.yes = false;
      audio.sfx('select');
      this.say(`Erase file ${slot}? No. Left and right to choose.`);
      return;
    }
    if (save === UNREADABLE) {
      audio.sfx('bump');
      this.say(`File ${slot} is unreadable. Erase it first.`);
      return;
    }
    audio.sfx('coin');
    if (save) this.game.openFile(slot, save);
    else this.newFile(slot);
  }

  private cancelErase(): void {
    this.mode = 'choose';
    this.index = 3;
    this.say(this.rowText());
  }

  /** Character select (P2 may join), then create the file and open it. */
  private newFile(slot: SaveSlot): void {
    const game = this.game;
    game.scenes.replace(
      new CharacterSelectScene(game, null, {
        onStart: (c, c2) => {
          const save = newSave(slot, c.id, c2?.id ?? null);
          writeSave(save);
          game.openFile(slot, save);
        },
        onBack: () => game.scenes.replace(new FileSelectScene(game, slot)),
      }),
    );
  }

  render(r: Renderer): void {
    r.clear('#000');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const blink = (this.t >> 4) % 2 === 0;
    const heading = this.mode === 'choose' ? 'SELECT A FILE' : 'ERASE WHICH FILE?';
    r.text(font, heading, 128 - heading.length * 4, 14);
    SAVE_SLOTS.forEach((slot, i) => {
      const y = ROW_Y[i] as number;
      const sel = i === this.index;
      const edge = sel ? (this.mode === 'choose' ? '#fcfcfc' : '#f83800') : '#3c3c3c';
      r.rect(20, y, 224, ROW_H, edge);
      r.rect(22, y + 2, 220, ROW_H - 4, '#0c1c48');
      if (sel && (blink || this.mode === 'confirm')) r.text(font, '>', 8, y + 16);
      r.text(font, `FILE ${slot}`, 84, y + 8);
      const s = this.saves[i];
      if (!s || s === UNREADABLE) {
        r.text(font, s ? 'UNREADABLE' : 'NEW GAME', 84, y + 24);
        return;
      }
      // Portraits stand on the row's floor; player 2 beside player 1.
      const heroes = [this.character(s.character), this.character(s.character2)];
      heroes.forEach((c, k) => {
        if (!c) return;
        const sheet = assets.sheet(c.portrait.sheet, c.portrait.palette);
        const f = sheet.frames.get(c.portrait.frame);
        const w = f?.w ?? 16;
        const h = f?.h ?? 16;
        r.sprite(sheet, c.portrait.frame, 40 + k * 24 - Math.round(w / 2), y + ROW_H - 4 - h);
      });
      const world = `WORLD ${highestWorld(s)}`;
      r.text(font, world, 236 - world.length * 8, y + 8);
      r.text(font, `${clearedMainLevels(s)}/${MAIN_LEVEL_COUNT}`, 84, y + 24);
      r.text(font, `×${Math.min(99, s.lives)}`, 132, y + 24);
      r.text(font, pad(Math.min(s.score, SCORE_MAX), 7), 180, y + 24);
      if (s.gameCleared) r.sprite(assets.sheet('items'), 'star-0', 152, y + 4);
    });
    if (this.mode === 'confirm') {
      const q = `ERASE FILE ${this.index + 1}?`;
      r.text(font, q, 128 - q.length * 4, BOTTOM_Y);
      r.text(font, 'YES', 88, BOTTOM_Y + 18);
      r.text(font, 'NO', 152, BOTTOM_Y + 18);
      if (blink) r.text(font, '>', this.yes ? 76 : 140, BOTTOM_Y + 18);
    } else {
      const label = this.mode === 'choose' ? 'ERASE FILE' : 'CANCEL';
      r.text(font, label, 128 - label.length * 4, BOTTOM_Y);
      if (this.index === 3 && blink) r.text(font, '>', 116 - label.length * 4, BOTTOM_Y);
    }
    if ((this.t >> 5) % 2 === 0) r.text(font, 'B: BACK', 24, 216);
  }
}
