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
import { loadJson, onStaleStorage } from '@engine/save/storage';
import { defaultSettings, SETTINGS_KEY, type HomeScreenFlags } from '@engine/save/settings';
import { FONT_COLOURS } from '@content/sprites/font';
import {
  forgetOnlineCode,
  formatBackupCode,
  loadOnlineCode,
  loadUploadedCode,
  markOnlineNoticeSeen,
  ONLINE_BACKUP_KEY,
  onlineNoticeSeen,
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
import { backToMenu, MenuScene, type MenuItem } from './menu';
import type { Game } from './game';

/*
 * Options > Save data on the REMIX title (owner items 86-88; v0.4.77 item 181: three rows, BACK
 * UP ON DEVICE, BACK UP ONLINE on the web build, and RESET GAME). BACK UP ON DEVICE holds EXPORT
 * BACKUP (one .json of every game key, and each asset pack as <name>.zip when the player says
 * YES) and IMPORT BACKUP (checked whole before anything changes, then REPLACE ALL DATA ON THIS
 * DEVICE? with EXPORT FIRST); RESET GAME asks two questions, the first offering a backup (packs
 * only with a third), and never deletes the online copy (its code is shown first). The
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

/**
 * A failed load that only reloading the page can mend (265): the browser keeps a rejected
 * import() by its URL, and no fresh URL could be made for the next try.
 */
export class ReloadToLoad extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

/**
 * `load` once, its promise kept while it works; a rejected one is dropped (item 185), so the
 * next try loads again. Item 265: Chromium keeps a rejected import() by its URL, so with `fresh`
 * each try after a failure loads `fresh(failure, n)` (the n-th retry's URL) instead of the
 * module's own name; when `fresh` has none, the failure is a ReloadToLoad.
 */
export function onlineLoader(
  load: (url: string | null) => Promise<OnlineApi>,
  fresh?: (failure: unknown, retry: number) => string | null,
): () => Promise<OnlineApi> {
  let loading: Promise<OnlineApi> | null = null;
  let retries = 0;
  let url: string | null = null;
  return () =>
    (loading ??= new Promise<OnlineApi>((res) => res(load(url))).catch((e: unknown) => {
      loading = null;
      if (!fresh) throw e;
      url = fresh(e, ++retries);
      throw url === null ? new ReloadToLoad(e) : e;
    }));
}

/**
 * Item 265: the URL to load a failed chunk again under: its own URL (named in the browser's
 * error, as Chromium and Firefox do), resolved against `base` (the page's module, through
 * new URL(..., import.meta.url)), with `?retry=n`. Null when the error names no online-code
 * chunk file under the app's own folder, `root` (resolved against `base`; by default the base
 * module's own folder): not another site, nor another app on the same origin.
 */
export function freshChunkUrl(failure: unknown, retry: number, base: string, root = './'): string | null {
  const text = failure instanceof Error ? failure.message : typeof failure === 'string' ? failure : '';
  // Without the quotes or brackets a message may put around it.
  const named = /(?:https?:\/\/)?[^\s'"()]*nostr-backup[^\s'"()]*/.exec(text)?.[0];
  if (!named) return null;
  let u: URL;
  let home: URL;
  try {
    u = new URL(named, base);
    home = new URL(root, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.origin !== new URL(base).origin) return null;
  // Its path as the browser reads it (.. and %2e%2e already resolved), under the app's folder.
  if (!home.pathname.endsWith('/') || !u.pathname.startsWith(home.pathname)) return null;
  if (!/\/nostr-backup[^/]*\.[jt]s$/.test(u.pathname)) return null;
  u.search = '';
  u.hash = '';
  u.searchParams.set('retry', String(retry));
  return u.href;
}

let loadOnline: (() => Promise<OnlineApi>) | null = null;

/** The online rows' loader: none in the offline build, so its bundle holds no network code. */
function browserOnlineEnv(): OnlineEnv | null {
  if (import.meta.env.MODE === 'offline') return null;
  const load = (loadOnline ??= onlineLoader(
    (url) =>
      (url === null
        ? import('@engine/online/nostr-backup')
        : // Item 265: a fresh specifier, so the browser fetches the chunk again.
          (import(/* @vite-ignore */ url) as Promise<{ browserOnlineApi(): OnlineApi }>)
      ).then((m) => m.browserOnlineApi()),
    (e, n) => freshChunkUrl(e, n, import.meta.url, import.meta.env.BASE_URL),
  ));
  return {
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    load,
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

/** What a backup holds, said on entering Save data and BACK UP ON DEVICE (item 181: not drawn). */
const NOTE_SAID =
  'A backup holds every save, file, setting, custom level and Music Lab song on this device. Importing one does not restore asset packs.';

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
  /** The page open over this one (BACK UP ON DEVICE or BACK UP ONLINE), null: none. */
  private sub: { page: SavePage; online: boolean } | null = null;

  constructor(game: Game, onBack: () => void) {
    super(game, 'SAVE DATA', [], onBack);
    this.env = game.deps.saveDataEnv ?? browserSaveDataEnv();
    // MenuScene adds the period before the focused row.
    this.entryTitle = `Save data. ${NOTE_SAID.slice(0, -1)}`;
    this.rebuild();
    void this.readPacks();
  }

  /** Item 181: the main page's rows (BACK UP ONLINE on the web build only). */
  private rebuild(): void {
    this.setItems([
      {
        label: 'Back up on device',
        select: () => this.openDevice(),
        hint: 'Export a backup file of this device, or import one',
      },
      // Item 159: online backup over Nostr, on the web build only.
      ...(this.env.online
        ? [
            {
              label: 'Back up online',
              select: () => this.openOnline(),
              hint: 'Back up online, restore from a code, or see your code',
            },
          ]
        : []),
      {
        label: 'Reset game',
        select: () => this.askReset(),
        hint: 'Remove every save, file, setting, custom level and Music Lab song from this device',
      },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
    if (this.sub?.online) this.sub.page.setItems(this.onlineItems());
  }

  /** BACK UP ON DEVICE's rows: today's Export and Import backup. */
  private deviceItems(): MenuItem[] {
    return [
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
      { label: 'Back', select: () => this.closePage() },
    ];
  }

  /** BACK UP ONLINE's rows; the code rows only once a copy is online (items 162, 168, 187). */
  private onlineItems(): MenuItem[] {
    const code = loadUploadedCode();
    return [
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
      ...(code
        ? [
            {
              label: 'Show most recent code',
              select: () => this.showMyCode(),
              hint: 'Your online backup code, to copy or share',
            },
            {
              label: 'Delete most recent code',
              select: () => this.askDeleteOnline(),
              hint: 'Delete your backup on the servers and forget its code on this device',
            },
          ]
        : []),
      { label: 'Back', select: () => this.closePage() },
    ];
  }

  private openPage(title: string, entry: string, items: MenuItem[], online: boolean): void {
    this.status = '';
    const page = new SavePage(
      this.game,
      title,
      entry,
      items,
      () => this.closePage(),
      () => this.busy,
    );
    this.sub = { page, online };
    this.game.scenes.push(page);
  }

  /** Back on the main page from BACK UP ON DEVICE or BACK UP ONLINE, its row said. */
  private closePage(): void {
    if (this.busy || !this.sub) return;
    this.sub = null;
    backToMenu(this.game);
  }

  private openDevice(): void {
    if (this.busy) return;
    this.openPage(
      'BACK UP ON DEVICE',
      `Back up on device. ${NOTE_SAID.slice(0, -1)}`,
      this.deviceItems(),
      false,
    );
  }

  /** BACK UP ONLINE, with its experimental note the first time on this device (items 181.3, 182). */
  private openOnline(): void {
    if (this.busy) return;
    this.openPage('BACK UP ONLINE', 'Back up online', this.onlineItems(), true);
    if (onlineNoticeSeen()) return;
    const ok = () => {
      // Kept as a game key: RESET GAME clears it. A refused write shows the note again next time.
      markOnlineNoticeSeen();
      this.game.scenes.pop();
      this.sub?.page.announcePage();
    };
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'EXPERIMENTAL FEATURE',
        NOTICE_SAID,
        NOTICE_LINES,
        [{ label: 'OK', select: ok }],
        ok,
      ),
    );
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

  /**
   * The status line of the page open now: BACK UP ON DEVICE's or BACK UP ONLINE's (with `more`,
   * a second line under it), else this one's.
   */
  private setStatus(status: string, more = ''): void {
    if (this.sub) this.sub.page.note(status, more);
    else this.status = status;
  }

  /** The status line (the open page's, and the question's when one is up) and the screen reader. */
  private tell(status: string, said: string, bump = false, more = ''): void {
    if (bump) this.game.ctx.audio.sfx('bump');
    this.setStatus(status, more);
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
    this.setStatus('');
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

  /**
   * `restored`: a copy restored from code, with its own time `at` (the next backup or delete
   * follows it).
   */
  private askReplace(b: Backup, restored?: { at?: number | undefined }): void {
    const when = new Date(b.exportedAt);
    const day = Number.isNaN(when.getTime()) ? '' : when.toISOString().slice(0, 10);
    const keys = Object.keys(b.data).length;
    // Item 230: the backup brings another code, so this device's (online) one is shown first, as
    // Reset game does: its copy stays on the servers and this device forgets it.
    const brought = readOnlineCode(b.data[ONLINE_BACKUP_KEY]);
    const mine = loadUploadedCode();
    const gone = mine && brought && brought.code !== mine.code ? formatBackupCode(mine.code) : null;
    // Review: a code never backed up online is not called an online backup code.
    const broughtOnline = !!restored || brought?.uploaded === true;
    const box: QuestionBox = new QuestionBox(
      this.game,
      'REPLACE ALL DATA ON THIS DEVICE?',
      `Replace all data on this device? The backup${day ? ` is from ${day},` : ''} game version ${b.gameVersion}, with ${pluralSaid(keys, 'item')}.` +
        (gone && mine
          ? ` It brings another ${broughtOnline ? 'online backup code' : 'backup code, not yet backed up online'}. Your online backup stays on the servers, and this device forgets its code. Keep the code to restore it: ${spokenBackupCode(mine.code)}.`
          : ''),
      [
        `BACKUP ${day}`.trim(),
        `VERSION ${b.gameVersion}`.slice(0, 28),
        plural(keys, 'ITEM'),
        ...(gone ? ['', 'YOUR CODE, KEPT ONLINE:', gone] : []),
      ],
      [
        { label: 'No', select: () => this.backHere() },
        { label: 'Yes', select: () => this.applyImport(b, restored) },
        {
          label: 'Export first',
          gesture: true,
          select: () => this.startExport(),
          hint: "Save a backup of this device's data first",
        },
        ...(gone ? [this.copyItem(gone, () => box)] : []),
      ],
      () => this.backHere(),
      gone,
    );
    this.game.scenes.push(box);
  }

  private applyImport(b: Backup, restored?: { at?: number | undefined }): void {
    this.game.scenes.pop();
    // Item 167 and reviews: a backup carrying a valid code brings it (shown once more here, and
    // after a restore its lastAt no earlier than the restored copy's own time); one without a
    // valid code keeps this device's (Reset game is what removes it). Item 189: the code is
    // stored normalised; item 187: online once restored, or when the file says it was uploaded.
    const data = withCodeUnshown(b.data);
    const mine = loadOnlineCode();
    const brought = readOnlineCode(data[ONLINE_BACKUP_KEY]);
    let uploaded = false;
    if (!brought) {
      if (mine) data[ONLINE_BACKUP_KEY] = JSON.stringify(mine);
    } else {
      // Review: an older file with this device's own code must not take back its upload or its
      // later backup time (the next backup would be refused as older, Show and Delete would go).
      const same = mine?.code === brought.code ? mine : null;
      const times = [brought.lastAt, same?.lastAt, restored?.at].filter((t) => t !== undefined);
      uploaded = !!restored || brought.uploaded === true || same?.uploaded === true;
      data[ONLINE_BACKUP_KEY] = JSON.stringify({
        ...brought,
        shown: false,
        ...(times.length ? { lastAt: Math.max(...times) } : {}),
        ...(uploaded ? { uploaded: true } : {}),
      });
    }
    // Item 184: this device's Home Screen flags win outright, set or not (device facts, not
    // save data): a file from another device neither shows a seen note again nor hides one.
    const flags = this.homeScreenFlags();
    const raw = data[SETTINGS_KEY];
    if (raw !== undefined || anyFlag(flags)) {
      const s = (raw === undefined ? defaultSettings() : JSON.parse(raw)) as { homeScreen?: unknown };
      const theirs = isRecord(s.homeScreen) ? s.homeScreen : {};
      if (
        raw === undefined ||
        (Object.keys(flags) as (keyof HomeScreenFlags)[]).some((k) => theirs[k] !== flags[k])
      )
        data[SETTINGS_KEY] = JSON.stringify({ ...s, homeScreen: flags });
    }
    const r = replaceGameData(data);
    if (!r.ok) return this.failed(r.reason, r.restored, 'Nothing changed.');
    const changed = brought && brought.code !== mine?.code;
    if (!changed) return this.finish('BACKUP IMPORTED', 'Backup imported.', []);
    // Pre-0.5.0: a code never backed up online is not called this device's online backup code.
    this.finish(
      'BACKUP IMPORTED',
      uploaded
        ? `Backup imported. This device's online backup code is now ${spokenBackupCode(brought.code)}.`
        : `Backup imported. It brings a backup code not yet backed up online: ${spokenBackupCode(brought.code)}.`,
      uploaded
        ? [`CODE NOW ${formatBackupCode(brought.code)}`]
        : [`CODE ${formatBackupCode(brought.code)}`, 'NOT YET BACKED UP ONLINE'],
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

  // ---- Reset game ------------------------------------------------------------------------

  /**
   * RESET GAME (item 181.5): today's erase, renamed. With a code whose copy is online, the code
   * comes first, with COPY CODE: the online copy stays on the servers and this device forgets
   * the code (in the offline build too, for a code an imported file brought: no network).
   */
  private askReset(): void {
    if (this.busy) return;
    this.status = '';
    const kept = loadUploadedCode();
    if (!kept) return this.askErase();
    const game = this.game;
    const shown = formatBackupCode(kept.code);
    const box: QuestionBox = new QuestionBox(
      game,
      'YOUR BACKUP CODE',
      `Reset game. Your online backup stays on the servers, and this device forgets its code. Keep the code to restore the backup: ${spokenBackupCode(kept.code)}.`,
      [...RESET_CODE_LINES, '', shown],
      [
        this.copyItem(shown, () => box),
        {
          label: 'Continue',
          select: () => {
            game.scenes.pop();
            this.askErase();
          },
        },
      ],
      () => this.cancelErase(),
      shown,
    );
    game.scenes.push(box);
  }

  /** COPY CODE (in the press's own event) on a question showing a code; the outcome noted there. */
  private copyItem(shown: string, box: () => QuestionBox): MenuItem {
    const game = this.game;
    const env = shareEnv(game);
    return {
      label: 'Copy code',
      gesture: true,
      hint: 'Copy your online backup code',
      select: () =>
        void (env.copy?.(shown) ?? Promise.resolve(false)).then((ok) => {
          const said = ok ? 'CODE COPIED' : 'COPY FAILED';
          box().note(said);
          game.deps.announcer?.say(said);
        }),
    };
  }

  private askErase(): void {
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'RESET GAME?',
        'Reset game? Every save, Classic file, setting, custom level and Music Lab song on this device goes. Export a backup first?',
        [
          'EVERY SAVE, FILE, SETTING,',
          'CUSTOM LEVEL AND MUSIC LAB',
          'SONG GOES.',
          '',
          'EXPORT A BACKUP FIRST?',
        ],
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
            label: 'Yes, reset',
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

  /** BACK at the code card or the packs question: the whole reset is off. */
  private cancelErase(): void {
    this.game.scenes.pop();
    this.tell('RESET CANCELLED', 'Reset cancelled. Nothing was erased.');
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
        `Also erase ${pluralSaid(n, 'asset pack')}? No keeps them, turned off.`,
        ['NO KEEPS THEM, TURNED OFF.'],
        [answer(false), answer(true)],
        // BACK cancels the whole reset, as on every other question.
        () => this.cancelErase(),
      ),
    );
  }

  /**
   * Item 184: the Home Screen notes this device has seen (the stored settings' and this tab's):
   * device facts, not save data, so a reset or an import keeps them. Null: none seen.
   */
  private homeScreenFlags(): HomeScreenFlags {
    const stored = loadJson<unknown>(SETTINGS_KEY);
    const hs = isRecord(stored) && isRecord(stored.homeScreen) ? stored.homeScreen : {};
    const mine = this.game.deps.settings?.homeScreen;
    const seen = (k: keyof HomeScreenFlags) => hs[k] === true || mine?.[k] === true;
    return { tipDone: seen('tipDone'), noticeDone: seen('noticeDone'), offlineDone: seen('offlineDone') };
  }

  private async erase(withPacks: boolean): Promise<void> {
    // Item 184: fresh settings carry the Home Screen flags; nothing else stays.
    const flags = this.homeScreenFlags();
    const r = anyFlag(flags)
      ? replaceGameData({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), homeScreen: flags }) })
      : eraseGameData();
    if (!r.ok) return this.failed(r.reason, r.restored, 'Nothing was erased.');
    // From here this tab's state is stale: no reload on its refused writes, and no second action
    // while the packs are being erased.
    onStaleStorage(null);
    this.busy = true;
    let packsFailed = false;
    if (withPacks) await this.env.packs.clear().catch(() => (packsFailed = true));
    this.finish(
      'GAME RESET',
      packsFailed
        ? 'Game reset: all data erased, but the asset packs could not be erased.'
        : 'Game reset: all data erased.',
      packsFailed ? ['ASSET PACKS COULD NOT BE', 'ERASED.'] : [],
    );
  }

  /** Back on the page under a question: its focused row said again. */
  private backHere(): void {
    backToMenu(this.game);
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
    const load = this.env.online?.load;
    if (!load) return null;
    try {
      const api = await load();
      loadFails.set(load, 0);
      return api;
    } catch (e) {
      // Item 185 (review): a browser may keep a failed chunk until the page is reloaded. Item
      // 265: where no fresh URL can be tried, that is said after the first failure.
      const n = (loadFails.get(load) ?? 0) + 1;
      loadFails.set(load, n);
      // The reload advice drawn as well as said (review).
      if (n >= 2 || e instanceof ReloadToLoad)
        this.tell(UNREACHABLE[0], RELOAD_SAID, true, 'RELOAD THE PAGE');
      else this.tell(UNREACHABLE[0], UNREACHABLE[1], true);
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
      // Item 226: a new code says it is not uploaded yet (an old one without the field is read
      // as uploaded once it has a backup time).
      const mine = kept ?? { code: api.newCode(), shown: false, uploaded: false };
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
        return this.tell(UNREACHABLE[0], NOT_BACKED_UP, true);
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
        // Item 186: a first backup's code is kept by now, so not "Nothing changed".
        if (r.accepted === 0) return this.tell(UNREACHABLE[0], NOT_BACKED_UP, true);
        // Item 223: a copy is on at least one server, so the code counts as online.
        if (!mine.uploaded) {
          saveOnlineCode({ ...mine, uploaded: true });
          this.rebuild();
        }
        return this.tell(
          `ONLY ${r.accepted} OF ${r.total} SERVERS TOOK IT`,
          `Only ${r.accepted} of ${r.total} servers took the backup, so it is not safe yet. Try again later.`,
          true,
        );
      }
      const done = `BACKED UP (${r.accepted} OF ${r.total} SERVERS)`;
      const said = `Backed up to ${r.accepted} of ${r.total} servers.`;
      // Item 187: online now. A refused write still shows the code below (it can be kept).
      saveOnlineCode({ ...mine, shown: true, lastAt: r.at, uploaded: true });
      this.rebuild();
      if (mine.shown) return this.tell(done, said);
      // Item 227: the open page's line (BACK UP ONLINE's), not the main page's.
      this.setStatus(done);
      this.showCode(mine.code, done, said);
    } finally {
      this.busy = false;
    }
  }

  /** SHOW MOST RECENT CODE (items 162, 181.3): the kept code, as after the first backup. */
  private showMyCode(): void {
    const kept = loadUploadedCode();
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
      // Item 181.4: the outcome, a blank line, then the code in its own colour.
      done ? [done, '', shown] : [shown],
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
      shown,
    );
    game.scenes.push(box);
  }

  /** DELETE MOST RECENT CODE (items 168, 181.3, 183): asked first, NO first. */
  private askDeleteOnline(): void {
    if (this.busy || this.needsInternet()) return;
    this.game.scenes.push(
      new QuestionBox(
        this.game,
        'DELETE YOUR ONLINE BACKUP?',
        "Delete your online backup? The servers' copy is replaced with an empty one and they are asked to delete it. This device forgets its code, so the next backup makes a new one.",
        [
          "THE SERVERS' COPY IS EMPTIED",
          'AND THEY ARE ASKED TO DELETE',
          'IT. THIS DEVICE FORGETS ITS',
          'CODE.',
        ],
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
    const kept = loadUploadedCode();
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
      // Item 181.3: the code is forgotten here; the next BACK UP ONLINE makes a new one.
      // Item 212: only when every server confirmed; otherwise the code stays, to try again.
      if (d.deleted < d.total) {
        saveOnlineCode({ ...kept, lastAt: d.at });
        // Drawn as well as said (pre-0.5.0): the code is kept, to try again.
        return this.tell(
          `DELETED ON ${d.deleted} OF ${d.total} SERVERS`,
          `Online backup deleted on ${d.deleted} of ${d.total} servers. The other servers could not be reached or refused, so a copy may remain there. Your code is kept: try Delete most recent code again to delete the rest.`,
          false,
          'CODE KEPT: TRY AGAIN',
        );
      }
      const forgot = forgetOnlineCode();
      this.rebuild();
      this.tell(
        `DELETED ON ${d.deleted} OF ${d.total} SERVERS`,
        `Online backup deleted on ${d.deleted} of ${d.total} servers. ` +
          (forgot
            ? 'This device forgot its code; the next backup makes a new one.'
            : "This device's storage refused, so it could not forget the code."),
      );
    } finally {
      this.busy = false;
    }
  }

  /** RESTORE FROM CODE: the code box (in the press's own event), then the lookup. */
  private restoreFromCode(): void {
    if (this.busy || this.needsInternet()) return;
    this.setStatus('');
    this.game.scenes.push(new RestoreCodeScene(this.game, (code) => void this.runRestore(code)));
  }

  private async runRestore(code: string | null): Promise<void> {
    if (code === null) return (this.sub?.page ?? this).announceFocus();
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
      this.askReplace(parsed.backup, { at: r.at });
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

/** Item 186: after a backup was tried (a first one's code is kept by then), not "Nothing changed". */
const NOT_BACKED_UP =
  'Could not reach the backup servers. Check the internet connection and try again. Nothing was backed up.';

/** BACK UP ONLINE's note, the first time on this device (items 181.3, 182): drawn and said. */
const NOTICE_LINES = [
  'ONLINE BACKUP IS AN',
  'EXPERIMENTAL SAVE FEATURE:',
  'SAVES MAY BE LOST. THE',
  'SAFEST WAY TO KEEP YOUR',
  'GAME IS A LOCAL BACKUP,',
  'BACK UP ON DEVICE.',
];
const NOTICE_SAID =
  'Experimental feature. Online backup is an experimental save feature, and saves may be lost. The safest way to keep your game is a local backup: Back up on device.';

/** The code card before a reset (item 181.5), above a blank line and the code. */
const RESET_CODE_LINES = [
  'YOUR ONLINE BACKUP STAYS ON',
  'THE SERVERS, AND THIS DEVICE',
  'FORGETS ITS CODE. KEEP IT',
  'TO RESTORE THE BACKUP:',
];

/** Failed loads in a row, per loader (the tab's one, shared by every Save data page). */
const loadFails = new WeakMap<() => Promise<OnlineApi>, number>();
/** A failed load that only a reload can mend (a second in a row, or one with no fresh URL). */
const RELOAD_SAID =
  'Could not reach the backup servers. Check the internet connection, then reload the page. Nothing changed.';

const anyFlag = (f: HomeScreenFlags): boolean => f.tipDone || f.noticeDone || f.offlineDone;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

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
    /** A line drawn in its own colour (a backup code, item 181.4): FONT_COLOURS.code. */
    private readonly highlight: string | null = null,
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
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    // Its colour comes from the palette book, so the colour-blind and high-contrast modes recolour it.
    const gold = this.highlight !== null ? assets.sheet('font', FONT_COLOURS.code) : font;
    // The font has capitals only (a dev build's version has lower case letters).
    const lines = this.lines
      .flatMap((l) => (l.length > 28 ? wrapText(l, 28) : [l]))
      .map((l) => l.toUpperCase());
    lines.forEach((l, i) => r.text(l === this.highlight ? gold : font, l, 128 - l.length * 4, 130 + i * 12));
  }
}

/**
 * BACK UP ON DEVICE and BACK UP ONLINE (item 181): pages whose rows run on Save data's page,
 * which shows its outcomes here. While it is busy they take no press, as it does.
 */
class SavePage extends MenuScene {
  constructor(
    game: Game,
    title: string,
    entry: string,
    items: MenuItem[],
    onBack: () => void,
    private readonly busy: () => boolean,
  ) {
    super(game, title, items, onBack);
    this.entryTitle = entry;
  }

  /** A second status line, under the first (a partial delete's CODE KEPT: TRY AGAIN). */
  private more = '';

  note(status: string, more = ''): void {
    this.status = status;
    this.more = more;
  }

  /**
   * With a second line: the status line moves up a row and the second goes in its place (the
   * menu's full-screen status row, y 200), both above the BACK line. Save data is only ever a
   * full-screen page (the title's Options), never a panel or a CLASSIC box.
   */
  override render(r: Renderer): void {
    if (!this.more) return super.render(r);
    const status = this.status;
    this.status = '';
    super.render(r);
    this.status = status;
    const font = this.game.ctx.assets.sheet('font');
    [status, this.more].forEach((l, i) => {
      const t = l.toUpperCase().slice(0, 28);
      r.text(font, t, 128 - t.length * 4, 188 + i * 12);
    });
  }

  override update(input: InputFrame): void {
    if (this.busy()) return;
    super.update(input);
  }

  override gesture(): (() => void) | null {
    return this.busy() ? null : super.gesture();
  }
}
