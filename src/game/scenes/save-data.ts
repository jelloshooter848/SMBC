import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { packStore, type StoredPack } from '@engine/assets/idb';
import { download } from '@engine/assets/pack-loader';
import { packZips } from '@engine/assets/pack-zip';
import { readTouchFacts } from '@engine/input/touch-logic';
import { pickFile } from '@engine/file-pick';
import {
  CHANGE_FAILURE_TEXT,
  MAX_BACKUP_CHARS,
  NOT_RESTORED_TEXT,
  REFUSAL_SAID,
  REFUSAL_TEXT,
  buildBackup,
  eraseGameData,
  parseBackup,
  readGameData,
  replaceGameData,
  type Backup,
  type BackupRefusal,
  type ChangeFailure,
} from '@engine/save/backup';
import { onStaleStorage } from '@engine/save/storage';
import {
  formatBackupCode,
  loadOnlineCode,
  ONLINE_BACKUP_KEY,
  readOnlineCode,
  withCodeUnshown,
  onlineCopy,
  saveOnlineCode,
  spokenBackupCode,
  type BackUpResult,
  type DeleteResult,
  type OnlineApi,
  type RestoreResult,
  type StoredOnlineCode,
} from '@engine/online/online-backup';
import { shareEnv } from './save-codes';
import { RestoreCodeScene } from './online-backup';
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

/** BACK UP ONLINE's "too big" message (Music Lab songs are in the data too, 0.4.77). */
export const ONLINE_TOO_BIG =
  'Your data is too big for an online backup. Use Export backup to save a file instead, or remove some custom levels or Music Lab songs. Nothing was backed up.';

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
  /**
   * BACK UP ONLINE and RESTORE FROM CODE (item 159); absent or null: no such rows (the offline
   * build, which makes no network requests).
   */
  online?: OnlineEnv | null;
}

/** The online backup's side of the browser. */
export interface OnlineEnv {
  /** navigator.onLine: false means certainly offline. */
  isOnline(): boolean;
  /** The crypto and relay code, loaded only now (import(): owner item 160). */
  load(): Promise<OnlineApi>;
}

/** The online rows' loader: none in the offline build, so its bundle holds no network code. */
function browserOnlineEnv(): OnlineEnv | null {
  if (import.meta.env.MODE === 'offline') return null;
  return {
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    load: () => import('@engine/online/nostr-backup').then((m) => m.browserOnlineApi()),
  };
}

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
    pickFile: (onPicked) => pickFile('.json,application/json', onPicked),
    packs: { list: () => packStore.list(), clear: () => packStore.clear() },
    restart() {
      // The page again from its start: its query (?dev=1) kept, its #link (a save link) dropped.
      location.replace(location.pathname + location.search);
    },
    online: browserOnlineEnv(),
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

/** The note under the page's rows, drawn and said (four lines: six rows above it online). */
const NOTE = [
  'A BACKUP HOLDS EVERY SAVE,',
  'FILE, SETTING AND LEVEL.',
  'IMPORTING ONE DOES NOT',
  'RESTORE ASSET PACKS.',
];
/** The note's one line when the page has too many rows for all four. */
const NOTE_SHORT = 'IMPORT NEVER RESTORES PACKS';
const NOTE_SAID =
  'A backup holds every save, file, setting and custom level on this device. Importing one does not restore asset packs.';

/** The pack question's lines, drawn and said (review #217: every drawn line is said). */
const PACK_ZIP_LINES = [
  'EACH PACK IS SAVED AS',
  'ITS OWN .ZIP FILE. TO USE',
  'ONE AGAIN, PICK IT WITH',
  'IMPORT PACK (.ZIP).',
];
// Item 141: a pack zip goes straight back in, on any device.
const PACK_AGAIN_SAID = 'To use one again, pick it with Import pack (.zip).';
const PACK_ZIP_SAID = `Each pack is saved as its own zip file. ${PACK_AGAIN_SAID}`;

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
    this.rebuild();
    void this.readPacks();
  }

  /** The rows; the code rows only once this device has a backup code (items 162, 168). */
  private rebuild(): void {
    const code = this.env.online ? loadOnlineCode() : null;
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
      // Item 159: online backup over Nostr, on the web build only.
      ...(this.env.online
        ? [
            {
              label: 'Back up online',
              select: () => this.backUpOnline(),
              hint: 'Save an encrypted copy on free servers, found again by a code',
            },
            {
              label: 'Restore from code',
              select: () => this.restoreFromCode(),
              // The code box's text field takes the keyboard only from inside the press's event.
              gesture: true,
              hint: 'Bring back an online backup with its code',
            },
          ]
        : []),
      ...(code
        ? [
            {
              label: 'Show my code',
              select: () => this.showMyCode(),
              hint: 'Your online backup code, to copy or share',
            },
            {
              label: 'Delete online copy',
              select: () => this.askDeleteOnline(),
              hint: 'Delete your backup on the servers; your code is kept',
            },
          ]
        : []),
      {
        label: 'Erase all data',
        select: () => this.askErase(),
        hint: 'Remove every save, file, setting and custom level from this device',
      },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
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

  /** While busy (the packs being erased) the page takes no press at all: not even BACK. */
  override update(input: InputFrame): void {
    if (this.busy) return;
    super.update(input);
  }

  override gesture(): (() => void) | null {
    return this.busy ? null : super.gesture();
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
    if (this.busy) return;
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
        `Also export ${pluralSaid(n, 'asset pack')}? ${PACK_ZIP_SAID}`,
        PACK_ZIP_LINES,
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
        said += ` With ${pluralSaid(packs.files.length, 'asset pack')}. Importing a backup does not restore asset packs. ${PACK_AGAIN_SAID}`;
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

  /** `at`: a copy restored from code, its own time (the next backup or delete follows it). */
  private askReplace(b: Backup, at?: number): void {
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
        { label: 'Yes', select: () => this.applyImport(b, at) },
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

  private applyImport(b: Backup, at?: number): void {
    this.game.scenes.pop();
    // Item 167 and reviews: a backup carrying a valid code brings it (shown once more here, and
    // after a restore its lastAt no earlier than the restored copy's own time); one without a
    // valid code keeps this device's (Erase all data is what removes it).
    const data = withCodeUnshown(b.data);
    const mine = loadOnlineCode();
    const brought = readOnlineCode(data[ONLINE_BACKUP_KEY]);
    if (!brought) {
      if (mine) data[ONLINE_BACKUP_KEY] = JSON.stringify(mine);
    } else if (at !== undefined)
      data[ONLINE_BACKUP_KEY] = JSON.stringify({
        ...brought,
        shown: false,
        lastAt: Math.max(brought.lastAt ?? 0, at),
      });
    const r = replaceGameData(data);
    if (!r.ok) return this.failed(r.reason, r.restored, 'Nothing changed.');
    const changed = brought && brought.code !== mine?.code;
    this.finish(
      'BACKUP IMPORTED',
      changed
        ? `Backup imported. This device's online backup code is now ${spokenBackupCode(brought.code)}.`
        : 'Backup imported.',
      changed ? [`CODE NOW ${formatBackupCode(brought.code)}`] : [],
    );
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
              // Item 167: with a code, the online copy is asked about first.
              // Offline there is nothing to ask: the card then shows the code that stays online.
              if (this.env.online && loadOnlineCode() && this.env.online.isOnline() !== false)
                this.askOnline();
              else this.askPacksThenErase(false);
            },
          },
        ],
        () => this.backHere(),
      ),
    );
  }

  /** BACK at any erase question: the whole erase is off. */
  private cancelErase(): void {
    this.game.scenes.pop();
    this.tell('ERASE CANCELLED', 'Erase cancelled. Nothing was erased.');
  }

  /** Item 167: ALSO DELETE YOUR ONLINE BACKUP? (NO first; BACK cancels the whole erase). */
  private askOnline(): void {
    const answer = (yes: boolean): MenuItem => ({
      label: yes ? 'Yes' : 'No',
      select: () => {
        this.game.scenes.pop();
        this.askPacksThenErase(yes);
      },
    });
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'ALSO DELETE YOUR ONLINE BACKUP?',
        'Also delete your online backup? Its code is erased with the rest either way.',
        ['ITS CODE IS ERASED WITH THE', 'REST EITHER WAY.'],
        [answer(false), answer(true)],
        () => this.cancelErase(),
      ),
    );
  }

  private askPacksThenErase(online: boolean): void {
    const n = this.packs?.length ?? 0;
    if (n > 0) this.askPacks(n, online);
    else void this.erase(false, online);
  }

  private askPacks(n: number, online = false): void {
    const answer = (yes: boolean): MenuItem => ({
      label: yes ? 'Yes' : 'No',
      select: () => {
        this.game.scenes.pop();
        void this.erase(yes, online);
      },
    });
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        `ALSO ERASE ${plural(n, 'ASSET PACK')}?`,
        `Also erase ${pluralSaid(n, 'asset pack')}? No keeps them, turned off.`,
        ['NO KEEPS THEM, TURNED OFF.'],
        [answer(false), answer(true)],
        // BACK cancels the whole erase, as on every other question.
        () => this.cancelErase(),
      ),
    );
  }

  private async erase(withPacks: boolean, online = false): Promise<void> {
    // The code is erased with the rest: when its online copy stays, the card shows it.
    const kept = this.env.online ? loadOnlineCode() : null;
    // Item 167: the online copy goes first (its code is about to be erased with the rest).
    let gone: { line: string; said: string; deleted: boolean } | null = null;
    if (online) {
      this.busy = true;
      this.tell('DELETING...', 'Deleting your online backup.');
      gone = await this.deleteForErase();
      this.busy = false;
    }
    const r = eraseGameData();
    if (!r.ok) {
      this.failed(r.reason, r.restored, 'Nothing was erased.');
      if (gone) this.game.deps.announcer?.say(gone.said);
      return;
    }
    // From here this tab's state is stale: no reload on its refused writes, and no second action
    // while the packs are being erased.
    onStaleStorage(null);
    this.busy = true;
    let packsFailed = false;
    if (withPacks) await this.env.packs.clear().catch(() => (packsFailed = true));
    const stays = kept !== null && !gone?.deleted;
    this.finish(
      'ALL DATA ERASED',
      (packsFailed ? 'All data erased, but the asset packs could not be erased.' : 'All data erased.') +
        (gone ? ` ${gone.said}` : '') +
        (stays && kept
          ? ` Your online backup stays online; write down its code to delete it later: ${spokenBackupCode(kept.code)}.`
          : ''),
      [
        ...(packsFailed ? ['ASSET PACKS COULD NOT BE', 'ERASED.'] : []),
        ...(gone ? [gone.line] : []),
        ...(stays && kept ? ['STILL ONLINE, ITS CODE:', formatBackupCode(kept.code)] : []),
      ],
    );
  }

  /** The online copy deleted for an erase: a line for its card and what is said. */
  private async deleteForErase(): Promise<{ line: string; said: string; deleted: boolean }> {
    const kept = loadOnlineCode();
    const notDeleted = (why: string) => ({
      line: 'ONLINE COPY NOT DELETED',
      said: `The online backup could not be deleted: ${why}`,
      deleted: false,
    });
    if (!kept) return notDeleted('no code is kept on this device.');
    if (this.env.online?.isOnline() === false) return notDeleted('no internet connection.');
    let api: OnlineApi | null;
    try {
      api = (await this.env.online?.load()) ?? null;
    } catch {
      api = null;
    }
    if (!api) return notDeleted('the servers could not be reached.');
    try {
      const d = await api.deleteOnline(kept.code, kept.lastAt);
      if (d.ok)
        return {
          line: `ONLINE COPY DELETED (${d.deleted} OF ${d.total})`,
          said:
            `Online backup deleted on ${d.deleted} of ${d.total} servers.` +
            (d.deleted < d.total
              ? ' The other servers could not be reached or refused, so a copy may remain there.'
              : ''),
          deleted: true,
        };
      return notDeleted(
        d.reason === 'servers' ? 'the servers could not be reached.' : 'the servers refused.',
      );
    } catch {
      return notDeleted('the servers could not be reached.');
    }
  }

  /** Back on this page from a question: its focused row said again. */
  private backHere(): void {
    this.game.scenes.pop();
    this.announce();
  }

  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    // Under the rows (64 is the first row's y, 14 a row's height), clear of the status line at
    // 200: the whole note when it fits, else its one line that matters most.
    const y = 64 + Math.min(this.items.length, this.visibleRows) * 14 + 4;
    const lines = y + 3 * 12 + 8 <= 198 ? NOTE : y + 8 <= 198 ? [NOTE_SHORT] : [];
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, y + i * 12));
  }

  // ---- Online backup (item 159) ------------------------------------------------------------

  /** Offline, both online rows say so (and nothing is loaded). */
  private needsInternet(): boolean {
    if (this.env.online?.isOnline() !== false) return false;
    this.tell(
      'NEEDS AN INTERNET CONNECTION',
      'Online backup needs an internet connection. Nothing changed.',
      true,
    );
    return true;
  }

  /** The network side, or null (said: it could not be loaded, which means no connection). */
  private async onlineApi(): Promise<OnlineApi | null> {
    try {
      return (await this.env.online?.load()) ?? null;
    } catch {
      this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
      return null;
    }
  }

  /** BACK UP ONLINE: the explainer the first time (no code kept yet), then the backup. */
  private backUpOnline(): void {
    if (this.busy || this.needsInternet()) return;
    const kept = loadOnlineCode();
    if (kept) {
      void this.runBackUp(kept);
      return;
    }
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'BACK UP ONLINE?',
        EXPLAINER_SAID,
        EXPLAINER,
        [
          { label: 'No', select: () => this.backHere() },
          {
            label: 'Yes, back up',
            select: () => {
              this.game.scenes.pop();
              void this.runBackUp(null);
            },
          },
        ],
        () => this.backHere(),
      ),
    );
  }

  /** The backup itself, under `kept`'s code or a new one; the code is shown once, after its first. */
  private async runBackUp(kept: StoredOnlineCode | null): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.tell('BACKING UP...', 'Backing up online. This takes a few seconds.');
      const api = await this.onlineApi();
      if (!api) return;
      const mine = kept ?? { code: api.newCode(), shown: false };
      // Kept first, so the online copy carries it (a restore elsewhere backs up to the same copy).
      if (!kept && !saveOnlineCode(mine))
        return this.tell(
          'STORAGE CANNOT BE READ',
          "This device's storage refused the backup code. Nothing changed.",
          true,
        );
      let text: string;
      try {
        text = buildBackup({
          gameVersion: this.env.gameVersion,
          now: this.env.now(),
          data: onlineCopy(readGameData()),
        }).text;
      } catch {
        return this.tell(
          'STORAGE CANNOT BE READ',
          "Cannot read this device's storage, so nothing was backed up.",
          true,
        );
      }
      let r: BackUpResult;
      try {
        r = await api.backUp(mine.code, text, mine.lastAt);
      } catch {
        return this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
      }
      if (!r.ok) {
        if (r.reason === 'too-big') return this.tell('TOO BIG TO BACK UP ONLINE', ONLINE_TOO_BIG, true);
        if (r.reason === 'newer')
          return this.tell(
            'A NEWER BACKUP IS ONLINE',
            'The servers already hold a newer backup under this code, from another device or a clock set ahead. Nothing was replaced.',
            true,
          );
        if (r.reason === 'refused')
          return this.tell(
            'SERVERS REFUSED THE BACKUP',
            'The servers answered but refused the backup. Try again later, and keep a backup file. Nothing was backed up.',
            true,
          );
        if (r.accepted === 0) return this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
        return this.tell(
          `ONLY ${r.accepted} OF ${r.total} SERVERS TOOK IT`,
          `Only ${r.accepted} of ${r.total} servers took the backup, so it is not safe yet. Try again later.`,
          true,
        );
      }
      const done = `BACKED UP (${r.accepted} OF ${r.total} SERVERS)`;
      const said = `Backed up to ${r.accepted} of ${r.total} servers.`;
      saveOnlineCode({ ...mine, shown: true, lastAt: r.at });
      this.rebuild();
      if (mine.shown) return this.tell(done, said);
      this.status = done;
      this.showCode(mine.code, done, said);
    } finally {
      this.busy = false;
    }
  }

  /** SHOW MY CODE (item 162): the kept code, as after the first backup. */
  private showMyCode(): void {
    const kept = loadOnlineCode();
    if (!kept) return this.rebuild();
    this.showCode(kept.code, null, '');
  }

  /** The code: COPY CODE and SHARE CODE (in the press's own event), then OK. */
  private showCode(code: string, done: string | null, said: string): void {
    const game = this.game;
    const shown = formatBackupCode(code);
    const env = shareEnv(game);
    const note = (status: string) => {
      box.note(status);
      game.deps.announcer?.say(status);
    };
    const box: QuestionBox = new QuestionBox(
      game,
      'YOUR BACKUP CODE',
      `${said ? `${said} ` : ''}Your backup code is ${spokenBackupCode(code)}. Keep this code: it is the only way to get the backup back.`,
      [shown, ...(done ? [done] : []), 'KEEP THIS CODE: IT IS THE', 'ONLY WAY TO GET IT BACK.'],
      [
        {
          label: 'Copy code',
          gesture: true,
          select: () =>
            void (env.copy?.(shown) ?? Promise.resolve(false)).then((ok) =>
              note(ok ? 'CODE COPIED' : 'COPY FAILED'),
            ),
        },
        {
          label: 'Share code',
          gesture: true,
          select: () => {
            if (!env.share) return note('NO SHARE SHEET HERE');
            void env
              .share({ title: 'SMBC REMIX backup code', text: `My SMBC REMIX backup code: ${shown}` })
              .then(() => note('CODE SHARED'))
              .catch(() => note('SHARE CANCELLED'));
          },
        },
        { label: 'OK', select: () => this.backHere() },
      ],
      () => this.backHere(),
    );
    game.scenes.push(box);
  }

  /** DELETE ONLINE COPY (owner item 168): asked first, NO first. */
  private askDeleteOnline(): void {
    if (this.busy || this.needsInternet()) return;
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'DELETE YOUR ONLINE BACKUP?',
        "Delete your online backup? The servers' copy is replaced with an empty one and they are asked to delete it. Your code is kept, so you can back up again.",
        ["THE SERVERS' COPY IS EMPTIED", 'AND THEY ARE ASKED TO DELETE', 'IT. YOUR CODE IS KEPT.'],
        [
          { label: 'No', select: () => this.backHere() },
          {
            label: 'Yes, delete',
            select: () => {
              this.game.scenes.pop();
              void this.runDelete();
            },
          },
        ],
        () => this.backHere(),
      ),
    );
  }

  private async runDelete(): Promise<void> {
    const kept = loadOnlineCode();
    if (!kept || this.busy) return;
    this.busy = true;
    try {
      this.tell('DELETING...', 'Deleting your online backup.');
      const api = await this.onlineApi();
      if (!api) return;
      let d: DeleteResult;
      try {
        d = await api.deleteOnline(kept.code, kept.lastAt);
      } catch {
        return this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
      }
      if (!d.ok) {
        if (d.reason === 'refused')
          return this.tell(
            'SERVERS REFUSED TO DELETE IT',
            'The servers refused to delete the backup. Try again later.',
            true,
          );
        if (d.reason === 'newer')
          return this.tell(
            'A NEWER BACKUP IS ONLINE',
            'The servers hold a newer backup under this code, so it was not deleted.',
            true,
          );
        return this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
      }
      saveOnlineCode({ ...kept, lastAt: d.at });
      const rest =
        d.deleted < d.total
          ? ' The other servers could not be reached or refused, so a copy may remain there.'
          : '';
      this.tell(
        `DELETED ON ${d.deleted} OF ${d.total} SERVERS`,
        `Online backup deleted on ${d.deleted} of ${d.total} servers.${rest} Your code is kept.`,
      );
    } finally {
      this.busy = false;
    }
  }

  /** RESTORE FROM CODE: the code box (in the press's own event), then the lookup. */
  private restoreFromCode(): void {
    if (this.busy || this.needsInternet()) return;
    this.status = '';
    this.game.scenes.push(new RestoreCodeScene(this.game, (code) => void this.runRestore(code)));
  }

  private async runRestore(code: string | null): Promise<void> {
    if (code === null) return this.announce();
    if (this.busy) return;
    this.busy = true;
    try {
      this.tell('LOOKING FOR THE BACKUP...', 'Looking for your backup. This takes a few seconds.');
      const api = await this.onlineApi();
      if (!api) return;
      let r: RestoreResult;
      try {
        r = await api.restore(code);
      } catch {
        return this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
      }
      if (!r.ok) {
        if (r.reason === 'servers') return this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
        if (r.reason === 'deleted')
          return this.tell(
            'THAT BACKUP WAS DELETED',
            'The backup for that code was deleted from the servers. Nothing changed.',
            true,
          );
        return this.tell(
          'NO BACKUP FOR THAT CODE',
          'No backup was found for that code. Check the code and try again. Nothing changed.',
          true,
        );
      }
      const parsed = parseBackup(r.text, this.env.gameVersion);
      if (!parsed.ok) return this.refuse(parsed.reason);
      this.askReplace(parsed.backup, r.at);
    } finally {
      this.busy = false;
    }
  }
}

/** What BACK UP ONLINE? draws (28 columns) and says, the first time (owner item 159). */
const EXPLAINER = [
  'SAVES AN ENCRYPTED COPY ON',
  'FREE SERVERS. THEY SEE AN',
  'ANONYMOUS ID AND WHEN, NOT',
  'WHO YOU ARE. THEY MAY LOSE',
  'IT: KEEP A BACKUP FILE TOO.',
];
const EXPLAINER_SAID =
  'Back up online? This saves an encrypted copy of your data on free servers, found again by a code you keep. The servers see an anonymous ID and when you backed up, nothing personal. Free servers may lose it, so keep a backup file too.';

/** No server answered (or the online code could not even be loaded). */
const UNREACHABLE = [
  'COULD NOT REACH THE SERVERS',
  'Could not reach the backup servers. Check the internet connection and try again. Nothing changed.',
] as const;

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
