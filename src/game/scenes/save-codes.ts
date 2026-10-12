import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import {
  listSaves,
  UNREADABLE,
  writeSave,
  type SaveFile,
  type SaveSlot,
  type SlotContents,
} from '@game/save/save-files';
import { encodeSaveCode, readSaveCode, summaryText, type CodeResult } from '@game/save/save-code';
import {
  browserShareEnv,
  copyCode,
  COPY_STATUS,
  shareSave,
  SHARE_STATUS,
  type ShareEnv,
} from '@game/save/share-code';
import { wrapText } from '../hud/text';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { MenuScene } from './menu';
import { CARD_GUARD_FRAMES } from './message';
import { abilityHint } from './hints';
import { CodeEntryPanel } from './code-entry';
import type { Game } from './game';

/*
 * Portable save codes in the menus (0.4.44, docs/SAVE_CODES.md): Options > Save files lists the
 * three campaign files; each has SHARE SAVE (the share sheet with a resume link), COPY CODE and
 * PASTE CODE (a text box, or the clipboard), and its code on screen. LoadCodeScene asks before a
 * code goes into a file (always, and names what it replaces); it also serves resume links.
 */

/** The share sheet and clipboard the game uses (a test's stand-in, else the browser's). */
export function shareEnv(game: Game): ShareEnv {
  return game.deps.shareEnv ?? browserShareEnv();
}

/** A slot's contents in a few words: 'WORLD 3, 4 HEROES', 'EMPTY' or 'UNREADABLE'. */
export function slotSummary(s: SlotContents): string {
  return s === null ? 'EMPTY' : s === UNREADABLE ? 'UNREADABLE' : summaryText(s);
}

/** Lines of a code, `groups` groups of five per line. */
export function codeLines(code: string, groups = 4): string[] {
  const parts = code.split('-');
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += groups) out.push(parts.slice(i, i + groups).join('-'));
  return out;
}

/** Spoken form of a code: its groups, letter by letter, so a screen reader spells it. */
export function spokenCode(code: string): string {
  return code
    .split('-')
    .map((g) => g.split('').join(' '))
    .join(', ');
}

const reminders = (game: Game) => game.deps.settings?.backupReminders !== false;

/** Options > Save files: the three files, BACKUP REMINDERS on or off, Back. */
export class SaveFilesOptions extends MenuScene {
  private saves: SlotContents[] = [];
  constructor(game: Game, onBack: () => void, translucent = false) {
    super(game, 'SAVE FILES', [], onBack, translucent);
    this.rebuild();
  }

  override enter(): void {
    this.rebuild();
    this.game.deps.announcer?.say('Save files. Share, copy or paste a save code for each file.');
    this.announce();
  }

  private rebuild(): void {
    const game = this.game;
    this.saves = listSaves();
    this.setItems([
      ...([1, 2, 3] as const).map((slot) => ({
        label: `File ${slot}`,
        value: () => slotSummary(this.saves[slot - 1] ?? null),
        select: () => this.openFile(slot),
        hint: 'Share save, copy code or paste code',
      })),
      {
        label: 'Backup reminders',
        value: () => (reminders(game) ? 'On' : 'Off'),
        adjust: () => {
          const s = game.deps.settings;
          if (!s) return;
          s.backupReminders = !reminders(game);
          game.deps.applySettings?.();
        },
        hint: 'After each castle, offer to back up your game',
      },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
  }

  private openFile(slot: SaveSlot): void {
    const scene = new FileCodeScene(
      this.game,
      slot,
      () => {
        this.game.scenes.pop();
        this.rebuild();
        this.announce();
      },
      this.translucent,
    );
    this.game.scenes.push(scene);
  }
}

/**
 * One file's code: SHARE SAVE, COPY CODE, PASTE CODE, Back, with the file's summary and its code
 * drawn below. Over a game (the pause menu's Options) PASTE CODE is offered only from the title,
 * so the file being played is never replaced under it.
 */
export class FileCodeScene extends MenuScene {
  save: SaveFile | null = null;
  contents: SlotContents = null;
  code = '';
  private busy = false;

  constructor(
    game: Game,
    readonly slot: SaveSlot,
    onBack: () => void,
    translucent = false,
  ) {
    super(game, `FILE ${slot}`, [], onBack, translucent);
    this.refresh();
    this.setItems([
      { label: 'Share save', select: () => void this.share(), hint: 'Send a link that loads this file' },
      { label: 'Copy code', select: () => void this.copy(), hint: 'Put the save code on the clipboard' },
      { label: 'Paste code', select: () => this.paste(), hint: `Load a save code into file ${slot}` },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
  }

  /** The file as stored now, and its code. */
  refresh(): void {
    this.contents = listSaves()[this.slot - 1] ?? null;
    this.save = this.contents && this.contents !== UNREADABLE ? this.contents : null;
    this.code = this.save ? encodeSaveCode(this.save) : '';
  }

  override enter(): void {
    this.refresh();
    const about = this.save
      ? `${summaryText(this.save)}. Save code: ${spokenCode(this.code)}.`
      : `${slotSummary(this.contents)}.`;
    this.game.deps.announcer?.say(`File ${this.slot}. ${about}`);
    this.announce();
  }

  private setStatus(text: string): void {
    this.status = text;
    this.game.deps.announcer?.say(text);
  }

  private noFile(): boolean {
    if (this.save) return false;
    this.game.ctx.audio.sfx('bump');
    this.setStatus(
      this.contents === UNREADABLE ? `FILE ${this.slot} IS UNREADABLE` : `FILE ${this.slot} IS EMPTY`,
    );
    return true;
  }

  async share(): Promise<void> {
    if (this.busy || this.noFile() || !this.save) return;
    this.busy = true;
    this.status = 'SHARING...';
    try {
      this.setStatus(SHARE_STATUS[await shareSave(this.save, shareEnv(this.game))]);
    } finally {
      this.busy = false;
    }
  }

  async copy(): Promise<void> {
    if (this.busy || this.noFile() || !this.save) return;
    this.busy = true;
    try {
      this.setStatus((await copyCode(this.save, shareEnv(this.game))) ? COPY_STATUS.ok : COPY_STATUS.failed);
    } finally {
      this.busy = false;
    }
  }

  paste(): void {
    if (this.translucent) {
      this.game.ctx.audio.sfx('bump');
      this.setStatus('PASTE CODES FROM THE TITLE');
      return;
    }
    this.status = '';
    this.game.scenes.push(
      new PasteCodeScene(this.game, this.slot, (loaded) => {
        this.refresh();
        if (loaded) this.status = `FILE ${this.slot} LOADED`;
        this.announce();
      }),
    );
  }

  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    const top = this.translucent ? 110 : 128;
    const summary = slotSummary(this.contents);
    r.text(font, summary, 128 - summary.length * 4, top);
    codeLines(this.code).forEach((line, i) => r.text(font, line, 128 - line.length * 4, top + 14 + i * 11));
  }
}

/**
 * PASTE CODE: the DOM text box (code-entry.ts) over the file's screen; the clipboard is read at
 * once when the browser allows it (a code found there goes straight on). A good code goes on to
 * LoadCodeScene's question; a bad one says why in the box. B (or CANCEL) goes back.
 */
export class PasteCodeScene implements Scene {
  readonly translucent = true;
  panel: CodeEntryPanel | null = null;
  private t = 0;
  private finished = false;

  constructor(
    private readonly game: Game,
    readonly slot: SaveSlot,
    private readonly done: (loaded: boolean) => void,
  ) {}

  enter(): void {
    const game = this.game;
    game.deps.announcer?.say(
      `Paste code into file ${this.slot}. Paste the save code, or the whole message with the link, into the text box, then Load.`,
    );
    const overlay = game.deps.overlay;
    if (!overlay || typeof document === 'undefined') return;
    const env = shareEnv(game);
    this.panel = new CodeEntryPanel(overlay, {
      title: `Paste code into file ${this.slot}`,
      ...(env.read ? { read: env.read } : {}),
      submit: (text) => this.submit(text),
      cancel: () => this.cancel(),
      say: (text) => game.deps.announcer?.say(text),
    });
    if (env.read) void this.panel.paste(true);
  }

  exit(): void {
    this.panel?.close();
    this.panel = null;
  }

  /** Text typed or pasted: an error message, or null when it was a code (the question follows). */
  submit(text: string): string | null {
    if (this.finished) return null;
    const r = readSaveCode(text, this.slot);
    if (!r.ok) {
      this.game.ctx.audio.sfx('bump');
      return r.message;
    }
    this.finished = true;
    this.game.scenes.pop();
    this.game.scenes.push(
      new LoadCodeScene(this.game, r, {
        slot: this.slot,
        done: (slot) => {
          this.game.scenes.pop();
          this.done(slot !== null);
        },
      }),
    );
    return null;
  }

  cancel(): void {
    if (this.finished) return;
    this.finished = true;
    this.game.scenes.pop();
    this.game.deps.announcer?.say('Cancelled.');
    this.done(false);
  }

  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, attack: 'CANCEL' };
  }

  update(input: InputFrame): void {
    if (++this.t < 6) return;
    if (input.pressed('attack') || input.pressed('select')) {
      if (this.panel) this.panel.cancel();
      else this.cancel();
    }
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    r.rect(16, 150, 224, 40, 'rgba(0,0,0,0.85)');
    const lines = ['PASTE THE CODE IN THE BOX', abilityHint(this.game, 'CANCEL', 'attack')];
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, 158 + i * 14));
  }
}

export interface LoadCodeOptions {
  /** The file the code goes into (PASTE CODE); without it the player picks one (a resume link). */
  slot?: SaveSlot;
  /** Over a game's panel rather than full screen. */
  translucent?: boolean;
  /** The file loaded, or null when nothing changed (cancelled, or the code was no good). */
  done: (slot: SaveSlot | null) => void;
}

type LoadMode = 'message' | 'pick' | 'confirm';

/**
 * "LOAD THIS SAVE? WORLD n, k HEROES": the file to load it into (each showing what it holds now),
 * then YES / NO (NO first), naming the file it replaces. Nothing is written before YES; NO or B
 * changes nothing. A code that is no good shows why. Every line waits for a press.
 */
export class LoadCodeScene implements Scene {
  mode: LoadMode = 'message';
  /** pick: 0-2 the files, 3 CANCEL. */
  index = 0;
  yes = false;
  lines: string[] = [];
  saves: SlotContents[] = [];
  private then: () => void = () => {};
  private t = 0;
  private target: SaveSlot = 1;

  constructor(
    private readonly game: Game,
    readonly result: CodeResult,
    private readonly opts: LoadCodeOptions,
  ) {}

  get translucent(): boolean {
    return this.opts.translucent === true;
  }

  enter(): void {
    this.saves = listSaves();
    const r = this.result;
    if (!r.ok) return this.message(wrapText(r.message, 26), () => this.opts.done(null));
    if (this.opts.slot) this.confirm(this.opts.slot);
    else this.pick(0);
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private get summary(): string {
    return this.result.ok ? summaryText(this.result.save) : '';
  }

  private message(lines: string[], then: () => void): void {
    this.mode = 'message';
    this.lines = lines;
    this.then = then;
    this.t = 0;
    this.say(`${lines.join(' ')}. ${abilityHint(this.game, 'OK', 'jump')}.`);
  }

  private pick(index: number): void {
    this.mode = 'pick';
    this.index = index;
    this.t = 0;
    this.say(`Load this save? ${this.summary}. Into which file? ${this.rowText()}`);
  }

  private confirm(slot: SaveSlot): void {
    this.mode = 'confirm';
    this.target = slot;
    this.yes = false;
    this.t = 0;
    const now = this.saves[slot - 1] ?? null;
    const replaces = now === null ? '' : ` File ${slot} has ${slotSummary(now)}. It will be replaced.`;
    this.say(`Load this save? ${this.summary} into file ${slot}.${replaces} No. Left and right to choose.`);
  }

  /** Screen-reader text for the highlighted file row. */
  rowText(): string {
    if (this.index === 3) return 'Cancel.';
    return `File ${this.index + 1}: ${slotSummary(this.saves[this.index] ?? null)}.`;
  }

  touchLabels(): TouchLabels {
    if (this.mode === 'message') return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' };
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (++this.t <= CARD_GUARD_FRAMES / 2) return;
    const audio = this.game.ctx.audio;
    const any = (a: 'jump' | 'start' | 'attack' | 'select' | 'up' | 'down' | 'left' | 'right') =>
      inputs.some((i) => i.pressed(a));
    const ok = any('jump') || any('start');
    const back = any('attack') || any('select');
    if (this.mode === 'message') {
      if (ok) {
        audio.sfx('select');
        this.then();
      }
      return;
    }
    if (this.mode === 'pick') {
      if (any('up') || any('down')) {
        this.index = (this.index + (any('up') ? 3 : 1)) % 4;
        audio.sfx('select');
        this.say(this.rowText());
      } else if (back || (ok && this.index === 3)) {
        audio.sfx('select');
        this.say('Cancelled. Nothing was changed.');
        this.opts.done(null);
      } else if (ok) {
        audio.sfx('select');
        this.confirm((this.index + 1) as SaveSlot);
      }
      return;
    }
    // confirm
    if (any('left') || any('right') || any('up') || any('down')) {
      this.yes = !this.yes;
      audio.sfx('select');
      this.say(this.yes ? 'Yes' : 'No');
    } else if (ok && this.yes) this.load();
    else if (ok || back) {
      audio.sfx('select');
      if (this.opts.slot) {
        this.say('Cancelled. Nothing was changed.');
        this.opts.done(null);
      } else this.pick(this.target - 1);
    }
  }

  /** YES: the code's file written into the slot, said, then done. */
  private load(): void {
    if (!this.result.ok) return;
    const slot = this.target;
    const now = Date.now();
    writeSave({ ...this.result.save, slot, created: now, updated: now });
    this.game.ctx.audio.sfx('1up');
    this.message([`SAVE LOADED INTO FILE ${slot}`], () => this.opts.done(slot));
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    if (this.translucent) r.rect(16, 24, 224, 192, 'rgba(0,0,0,0.85)');
    else r.clear('#000');
    const center = (s: string, y: number) => r.text(font, s, 128 - s.length * 4, y);
    if (this.mode === 'message') {
      const y0 = 112 - (this.lines.length * 12) / 2;
      this.lines.forEach((l, i) => center(l, y0 + i * 12));
      center(abilityHint(this.game, 'OK', 'jump'), 200);
      return;
    }
    center('LOAD THIS SAVE?', 40);
    center(this.summary, 56);
    if (this.mode === 'pick') {
      center('INTO WHICH FILE?', 80);
      for (let i = 0; i < 3; i++) {
        const y = 100 + i * 22;
        r.text(font, `FILE ${i + 1}`, 32, y);
        const s = slotSummary(this.saves[i] ?? null);
        r.text(font, s, 232 - s.length * 8, y + 10);
        if (this.index === i) r.text(font, '>', 20, y);
      }
      r.text(font, 'CANCEL', 32, 172);
      if (this.index === 3) r.text(font, '>', 20, 172);
    } else {
      const slot = this.target;
      center(`INTO FILE ${slot}`, 72);
      const now = this.saves[slot - 1] ?? null;
      if (now !== null) {
        center(`FILE ${slot} NOW HAS`, 96);
        center(slotSummary(now), 108);
        center('IT WILL BE REPLACED', 120);
      }
      r.text(font, 'YES', 88, 148);
      r.text(font, 'NO', 152, 148);
      r.text(font, '>', this.yes ? 76 : 140, 148);
    }
    center(`${abilityHint(this.game, 'OK', 'jump')}  ${abilityHint(this.game, 'BACK', 'attack')}`, 200);
  }
}
