import type { Renderer } from '@engine/gfx/renderer';
import { packStore, type StoredPack } from '@engine/assets/idb';
import { download } from '@engine/assets/pack-loader';
import { packZips } from '@engine/assets/pack-zip';
import { readTouchFacts } from '@engine/input/touch-logic';
import {
  CHANGE_FAILURE_TEXT,
  MAX_BACKUP_CHARS,
  NOT_RESTORED_TEXT,
  REFUSAL_SAID,
  REFUSAL_TEXT,
  buildBackup,
  eraseGameData,
  parseBackup,
  replaceGameData,
  type Backup,
  type BackupRefusal,
  type ChangeFailure,
} from '@engine/save/backup';
import { onStaleStorage } from '@engine/save/storage';
import { wrapText } from '../hud/text';
import { MenuScene, type MenuItem } from './menu';
import type { Game } from './game';

/*
 * Options > Save data on the REMIX title (owner items 86-88): EXPORT BACKUP (one .json of every
 * game key, and each asset pack as <name>.zip when the player says YES), IMPORT BACKUP (checked
 * whole before anything changes, then REPLACE ALL DATA ON THIS DEVICE? with EXPORT FIRST) and
 * ERASE ALL DATA (two questions, the first offering a backup; packs only with a third). The
 * share sheet, the downloads and the file chooser run inside the press's own event (MenuItem
 * .gesture: iOS allows them only there). After an import or an erase, OK starts the game again
 * from its first screen, so nothing of the old state stays in memory.
 */

/** How the files reached the player. */
export type DeliverOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** The browser side of Save data (a test's stand-in, else browserSaveDataEnv). */
export interface SaveDataEnv {
  gameVersion: string;
  now(): Date;
  /** Hands `files` to the player: the share sheet on a phone that can share files, else downloads. */
  deliver(files: File[]): Promise<DeliverOutcome>;
  /** Opens the file chooser (in the press's own event); `onPicked` gets the file chosen. */
  pickFile(onPicked: (file: File) => void): void;
  /** The asset packs (IndexedDB). */
  packs: { list(): Promise<StoredPack[]>; clear(): Promise<void> };
  /** Starts the game again from its first screen (the page reloaded, without its link). */
  restart(): void;
}

let picker: HTMLInputElement | null = null;

/** The browser's: share sheet or downloads, a file input, packStore, a reload. */
export function browserSaveDataEnv(): SaveDataEnv {
  return {
    gameVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    now: () => new Date(),
    async deliver(files) {
      const nav = typeof navigator === 'undefined' ? undefined : navigator;
      // iPhone and other phones: the share sheet (Save to Files), called before any await.
      if (nav?.share && readTouchFacts().coarsePointer && nav.canShare?.({ files })) {
        try {
          await nav.share({ files, title: 'SMBC REMIX backup' });
          return 'shared';
        } catch (e) {
          if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
          // Refused (no gesture left, a type it will not take): downloads instead.
        }
      }
      try {
        downloadAll(files);
        return 'downloaded';
      } catch {
        return 'failed';
      }
    },
    pickFile(onPicked) {
      if (typeof document === 'undefined') return;
      picker?.remove();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      // In the page (iOS Safari opens a chooser more reliably for one that is), out of sight.
      input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
      input.onchange = () => {
        const f = input.files?.[0];
        input.remove();
        if (picker === input) picker = null;
        if (f) onPicked(f);
      };
      document.body.appendChild(input);
      picker = input;
      input.click();
    },
    packs: { list: () => packStore.list(), clear: () => packStore.clear() },
    restart() {
      // The page again from its start: its query (?dev=1) kept, its #link (a save link) dropped.
      location.replace(location.pathname + location.search);
    },
  };
}

/** Gap between downloads: one burst of several is blocked or cut short (Chrome's prompt, old iOS). */
export const DOWNLOAD_GAP_MS = 400;

/** Downloads `files` one after another, the first now (in the press's event), DOWNLOAD_GAP_MS apart. */
export function downloadAll(
  files: readonly File[],
  save: (name: string, blob: Blob) => void = download,
  gap = DOWNLOAD_GAP_MS,
): void {
  files.forEach((f, i) => {
    if (i === 0) save(f.name, f);
    else setTimeout(() => save(f.name, f), i * gap);
  });
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 'S'}`;
const pluralSaid = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The note under the page's rows, drawn and said. */
const NOTE = [
  'A BACKUP HOLDS EVERY SAVE,',
  'FILE, SETTING AND CUSTOM',
  'LEVEL ON THIS DEVICE.',
  'IMPORTING ONE DOES NOT',
  'RESTORE ASSET PACKS.',
];
const NOTE_SAID =
  'A backup holds every save, file, setting and custom level on this device. Importing one does not restore asset packs.';

/** Options > Save data. */
export class SaveDataOptions extends MenuScene {
  private readonly env: SaveDataEnv;
  /** The stored packs, listed on opening (null: still being read). */
  private packs: StoredPack[] | null = null;
  /** Their zips, made once the pack question is up (null: not ready yet). */
  private zips: { files: File[]; failed: string[] } | null = null;
  private zipping: Promise<void> | null = null;
  private busy = false;

  constructor(game: Game, onBack: () => void) {
    super(game, 'SAVE DATA', [], onBack);
    this.env = game.deps.saveDataEnv ?? browserSaveDataEnv();
    // MenuScene adds the period before the focused row.
    this.entryTitle = `Save data. ${NOTE_SAID.slice(0, -1)}`;
    this.setItems([
      {
        label: 'Export backup',
        select: () => this.startExport(),
        gesture: true,
        hint: 'Save every game file on this device to one backup file',
      },
      {
        label: 'Import backup',
        select: () => this.pick(),
        gesture: true,
        hint: 'Replace the data on this device with a backup file',
      },
      {
        label: 'Erase all data',
        select: () => this.askErase(),
        hint: 'Remove every save, file, setting and custom level from this device',
      },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
    void this.readPacks();
  }

  /** The packs are only listed on opening: they are zipped when the player is asked about them. */
  private async readPacks(): Promise<void> {
    this.packs = await this.env.packs.list().catch(() => [] as StoredPack[]);
  }

  /**
   * Zips the packs (once). A zip needs each file's CRC-32, so its bytes are read first, which is
   * async; the share sheet must still run in a press's own event, so the zips are made while the
   * pack question is up, and its YES hands over files already made.
   */
  private zipPacks(): Promise<void> {
    this.zipping ??= packZips(this.packs ?? []).then(({ zips, failed }) => {
      this.zips = {
        files: zips.map((z) => new File([z.bytes as BlobPart], z.fileName, { type: 'application/zip' })),
        failed,
      };
    });
    return this.zipping;
  }

  /** The status line (the question's too, when one is up) and the screen reader. */
  private tell(status: string, said: string, bump = false): void {
    if (bump) this.game.ctx.audio.sfx('bump');
    this.status = status;
    const top = this.game.scenes.top;
    if (top instanceof QuestionBox) top.note(status);
    this.game.deps.announcer?.say(said);
  }

  // ---- Export ----------------------------------------------------------------------------

  /** EXPORT BACKUP (and EXPORT FIRST): the pack question first when there are packs. */
  startExport(): void {
    if (!this.packs) {
      this.tell('ONE MOMENT', 'Reading the asset packs. Try again in a moment.', true);
      return;
    }
    const n = this.packs.length;
    if (n === 0) {
      this.exportNow(false);
      return;
    }
    void this.zipPacks();
    const answer = (withPacks: boolean): MenuItem => ({
      label: withPacks ? 'Yes' : 'No',
      gesture: true,
      select: () => {
        if (withPacks && !this.zips) {
          this.tell(
            'ONE MOMENT',
            'The asset packs are still being packed. Press YES again in a moment.',
            true,
          );
          return;
        }
        // The files go first, still inside the press's own event.
        this.exportNow(withPacks);
        this.game.scenes.pop();
      },
    });
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        `ALSO EXPORT ${plural(n, 'ASSET PACK')}?`,
        `Also export ${pluralSaid(n, 'asset pack')}?`,
        ['EACH PACK IS SAVED AS', 'ITS OWN .ZIP FILE.'],
        [answer(false), answer(true)],
        () => this.game.scenes.pop(),
      ),
    );
  }

  /** Builds the backup and hands it over at once (the share sheet needs the press's event). */
  private exportNow(withPacks: boolean): void {
    let backup: { text: string; fileName: string };
    try {
      backup = buildBackup({ gameVersion: this.env.gameVersion, now: this.env.now() });
    } catch {
      this.tell('STORAGE CANNOT BE READ', "Cannot read this device's storage, so no backup was made.", true);
      return;
    }
    const files = [new File([backup.text], backup.fileName, { type: 'application/json' })];
    const packs = withPacks && this.zips ? this.zips : null;
    if (packs) files.push(...packs.files);
    void this.env.deliver(files).then((outcome) => {
      if (outcome === 'cancelled') return this.tell('EXPORT CANCELLED', 'Export cancelled.');
      if (outcome === 'failed') return this.tell('EXPORT FAILED', 'The backup could not be saved.', true);
      const done = outcome === 'shared' ? 'BACKUP SHARED' : 'BACKUP SAVED';
      let said = outcome === 'shared' ? 'Backup shared.' : 'Backup saved.';
      if (packs) {
        said += ` With ${pluralSaid(packs.files.length, 'asset pack')}. Importing a backup does not restore asset packs: keep the pack zip files.`;
        if (packs.failed.length)
          said += ` ${pluralSaid(packs.failed.length, 'pack')} could not be read and ${packs.failed.length === 1 ? 'was' : 'were'} left out: ${packs.failed.join(', ')}.`;
      }
      if (outcome === 'downloaded' && files.length > 1)
        said += ` ${files.length} files will download, one after another.`;
      this.tell(packs?.failed.length ? `${plural(packs.failed.length, 'PACK')} LEFT OUT` : done, said);
    });
  }

  // ---- Import ----------------------------------------------------------------------------

  /** IMPORT BACKUP: the chooser, in this press's own event. */
  private pick(): void {
    if (this.busy) return;
    this.status = '';
    this.env.pickFile((file) => void this.readFile(file));
  }

  private refuse(reason: BackupRefusal): void {
    this.tell(REFUSAL_TEXT[reason], REFUSAL_SAID[reason], true);
  }

  /** The whole file checked first; only a good one gets the question. */
  async readFile(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (file.size > MAX_BACKUP_CHARS * 4) return this.refuse('too-big');
      let text: string;
      try {
        text = await file.text();
      } catch {
        return this.refuse('not-json');
      }
      const parsed = parseBackup(text, this.env.gameVersion);
      if (!parsed.ok) return this.refuse(parsed.reason);
      this.askReplace(parsed.backup);
    } finally {
      this.busy = false;
    }
  }

  private askReplace(b: Backup): void {
    const when = new Date(b.exportedAt);
    const day = Number.isNaN(when.getTime()) ? '' : when.toISOString().slice(0, 10);
    const keys = Object.keys(b.data).length;
    const box = new QuestionBox(
      this.game,
      'REPLACE ALL DATA ON THIS DEVICE?',
      `Replace all data on this device? The backup${day ? ` is from ${day},` : ''} game version ${b.gameVersion}, with ${pluralSaid(keys, 'item')}.`,
      [`BACKUP ${day}`.trim(), `VERSION ${b.gameVersion}`.slice(0, 28), plural(keys, 'ITEM')],
      [
        { label: 'No', select: () => this.backHere() },
        { label: 'Yes', select: () => this.applyImport(b) },
        {
          label: 'Export first',
          gesture: true,
          select: () => this.startExport(),
          hint: "Save a backup of this device's data first",
        },
      ],
      () => this.backHere(),
    );
    this.game.scenes.push(box);
  }

  private applyImport(b: Backup): void {
    this.game.scenes.pop();
    const r = replaceGameData(b.data);
    if (!r.ok) return this.failed(r.reason, r.restored, 'Nothing changed.');
    this.finish('BACKUP IMPORTED', 'Backup imported.', []);
  }

  /**
   * An import or erase that failed: why, said. `restored`: everything was put back (then
   * `nothing` is said); otherwise the player is told some data could not be put back, never
   * that nothing changed.
   */
  private failed(reason: ChangeFailure, restored: boolean, nothing: string): void {
    const why: Record<ChangeFailure, string> = {
      read: "This device's storage cannot be read.",
      quota: 'Not enough space on this device.',
      write: 'Storage refused the change.',
      changed: 'Another tab changed the data meanwhile. Close other tabs of the game and try again.',
    };
    if (restored) this.tell(CHANGE_FAILURE_TEXT[reason], `${why[reason]} ${nothing}`, true);
    else
      this.tell(
        NOT_RESTORED_TEXT,
        `${why[reason]} Some of this device's data could not be put back. Export a backup now if you can, and close other tabs of the game.`,
        true,
      );
  }

  /** Done: a card that waits for OK, then the game starts again from its first screen. */
  private finish(title: string, said: string, lines: string[]): void {
    // This tab's old state is stale now: it must not reload before OK (its writes stay refused).
    onStaleStorage(null);
    const restart = () => this.env.restart();
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        title,
        `${said} OK starts the game again from the title.`,
        [...lines, 'THE GAME STARTS AGAIN.'],
        [{ label: 'OK', select: restart }],
        restart,
      ),
    );
  }

  // ---- Erase -----------------------------------------------------------------------------

  private askErase(): void {
    if (this.busy) return;
    this.status = '';
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'ERASE ALL DATA?',
        'Erase all data? Every save, Classic file, setting and custom level on this device goes. Export a backup first?',
        ['EVERY SAVE, FILE, SETTING', 'AND CUSTOM LEVEL GOES.', '', 'EXPORT A BACKUP FIRST?'],
        [
          { label: 'No', select: () => this.backHere() },
          { label: 'Export backup first', gesture: true, select: () => this.startExport() },
          {
            label: 'Yes',
            select: () => {
              this.game.scenes.pop();
              this.askSure();
            },
          },
        ],
        () => this.backHere(),
      ),
    );
  }

  private askSure(): void {
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'ARE YOU SURE?',
        'Are you sure? This cannot be undone.',
        ['THIS CANNOT BE UNDONE.'],
        [
          { label: 'No', select: () => this.backHere() },
          {
            label: 'Yes, erase',
            select: () => {
              this.game.scenes.pop();
              const n = this.packs?.length ?? 0;
              if (n > 0) this.askPacks(n);
              else void this.erase(false);
            },
          },
        ],
        () => this.backHere(),
      ),
    );
  }

  private askPacks(n: number): void {
    const answer = (yes: boolean): MenuItem => ({
      label: yes ? 'Yes' : 'No',
      select: () => {
        this.game.scenes.pop();
        void this.erase(yes);
      },
    });
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        `ALSO ERASE ${plural(n, 'ASSET PACK')}?`,
        `Also erase ${pluralSaid(n, 'asset pack')}?`,
        ['NO KEEPS THEM, TURNED OFF.'],
        [answer(false), answer(true)],
        // BACK cancels the whole erase, as on every other question.
        () => {
          this.game.scenes.pop();
          this.tell('ERASE CANCELLED', 'Erase cancelled. Nothing was erased.');
        },
      ),
    );
  }

  private async erase(withPacks: boolean): Promise<void> {
    const r = eraseGameData();
    if (!r.ok) return this.failed(r.reason, r.restored, 'Nothing was erased.');
    // From here this tab's state is stale: no reload on its refused writes, and no second action
    // while the packs are being erased.
    onStaleStorage(null);
    this.busy = true;
    let packsFailed = false;
    if (withPacks) await this.env.packs.clear().catch(() => (packsFailed = true));
    this.finish(
      'ALL DATA ERASED',
      packsFailed ? 'All data erased, but the asset packs could not be erased.' : 'All data erased.',
      packsFailed ? ['ASSET PACKS COULD NOT BE', 'ERASED.'] : [],
    );
  }

  /** Back on this page from a question: its focused row said again. */
  private backHere(): void {
    this.game.scenes.pop();
    this.announce();
  }

  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    NOTE.forEach((l, i) => r.text(font, l, 128 - l.length * 4, 130 + i * 12));
  }
}

/** A question (or a done card): its title and lines drawn, its question said before the row. */
class QuestionBox extends MenuScene {
  constructor(
    game: Game,
    title: string,
    private readonly question: string,
    private readonly lines: readonly string[],
    items: MenuItem[],
    onBack: () => void,
  ) {
    super(game, title, items, onBack);
  }

  /** A line on the question's own status row (an Export first's outcome). */
  note(status: string): void {
    this.status = status;
  }

  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(it ? `${this.question} ${it.label}` : this.question);
  }

  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    // The font has capitals only (a dev build's version has lower case letters).
    const lines = this.lines
      .flatMap((l) => (l.length > 28 ? wrapText(l, 28) : [l]))
      .map((l) => l.toUpperCase());
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, 130 + i * 12));
  }
}
