import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import type { CompiledSong } from '@engine/audio/mml';
import { songs as gameSongs } from '@content/music/songs';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import {
  NEW_SONG,
  parseSongDoc,
  readSettings,
  readTitle,
  setLoop,
  setTempo,
  songToDoc,
  MAX_TEMPO,
  MIN_TEMPO,
  SYNTAX_HELP,
  type DocError,
} from '../music-lab/song-doc';
import { encodeShare, songLink } from '@engine/share';
import { SITE_URL } from '@engine/site';
import {
  SONG_REFUSALS,
  clearDamagedSongLibrary,
  cleanSongName,
  deleteSong,
  loadSongs,
  renameSong,
  saveSong,
  type SongWrite,
} from '../music-lab/library';
import type { Game } from './game';

/*
 * MUSIC LAB (owner item 136): write a song in the game's MML and play it on the game's own
 * 4-channel synth. Options > Music Lab, beside the Level editor (never from a pause). A DOM panel
 * over the game, as the level editor's and PASTE CODE's are, so a phone types with its own
 * keyboard; keys and touches on it never reach the game. Nothing on it flashes or moves by itself
 * (Reduce flashing has nothing to calm); every message is said to screen readers.
 */

const TEMPO_STEP = 4;

const STYLE = `
.music-lab { position: fixed; z-index: 40; inset: 0; box-sizing: border-box; display: flex; flex-direction: column;
  gap: 8px; padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right))
  max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  background: #000; color: #fcfcfc; font: 15px/1.3 ui-monospace, Menlo, Consolas, monospace;
  -webkit-touch-callout: default; }
.music-lab * { box-sizing: border-box; }
.music-lab header { display: flex; align-items: center; gap: 8px; }
.music-lab h2 { flex: 1; margin: 0; font-size: 18px; letter-spacing: 2px; }
.music-lab .body { flex: 1; min-height: 0; display: flex; gap: 10px; }
.music-lab .side { display: flex; flex-direction: column; gap: 10px; width: 380px; flex: none; overflow-y: auto; }
.music-lab fieldset { margin: 0; padding: 6px 8px 8px; border: 2px solid #3c3c3c; display: flex; flex-direction: column; gap: 6px; }
.music-lab .row { display: flex; gap: 6px; align-items: center; }
.music-lab legend { padding: 0 4px; color: #3cbcfc; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
.music-lab button, .music-lab select, .music-lab input { font: inherit; min-height: 40px; border-radius: 0;
  touch-action: manipulation; }
.music-lab button { padding: 0 12px; color: #000; background: #fcfcfc; border: 0; cursor: pointer; text-transform: uppercase; }
.music-lab button.alt { background: #3c3c3c; color: #fcfcfc; }
.music-lab button[aria-pressed="true"] { background: #fc9838; color: #000; }
.music-lab button:focus-visible, .music-lab select:focus-visible, .music-lab input:focus-visible,
.music-lab textarea:focus-visible { outline: 3px solid #fcfc00; outline-offset: 1px; }
.music-lab select, .music-lab input { background: #0c1c48; color: #fcfcfc; border: 2px solid #3cbcfc; padding: 0 6px; min-width: 0; }
.music-lab .grow { flex: 1; min-width: 0; }
.music-lab select.grow, .music-lab input.grow { width: 0; }
.music-lab .question button:focus { outline: 3px solid #fcfc00; outline-offset: 2px; }
.music-lab input.tempo { width: 4.5em; text-align: center; }
.music-lab .editor { position: relative; flex: 1; min-width: 0; min-height: 0; border: 2px solid #3cbcfc; background: #0c1c48; }
.music-lab .editor textarea, .music-lab .editor pre { position: absolute; inset: 0; margin: 0; padding: 8px; border: 0;
  font: 15px/1.45 ui-monospace, Menlo, Consolas, monospace; white-space: pre; tab-size: 2; overflow: auto; }
.music-lab .editor pre { color: transparent; pointer-events: none; overflow: hidden; }
.music-lab .editor mark { color: transparent; background: #b81c1c; border-bottom: 3px solid #fcfc00; }
.music-lab .editor textarea { width: 100%; height: 100%; resize: none; background: transparent; color: #fcfcfc;
  caret-color: #fcfc00; -webkit-user-select: text; user-select: text; }
.music-lab .foot { display: flex; gap: 10px; align-items: baseline; min-height: 2.6em; }
.music-lab .status { flex: 1; margin: 0; color: #fcfcfc; }
.music-lab .status.error { color: #fc9838; }
.music-lab .status button { min-height: 32px; margin-left: 6px; }
.music-lab .where { color: #bcbcbc; font-size: 13px; white-space: nowrap; }
.music-lab [hidden] { display: none !important; }
.music-lab input[data-share-out] { width: 100%; font-size: 12px; }
.music-lab .question { position: absolute; z-index: 2; left: 50%; top: 30%; transform: translateX(-50%);
  width: min(520px, calc(100% - 32px)); padding: 14px; background: #000; border: 4px solid #fcfcfc; }
.music-lab .question p { margin: 0 0 12px; font-size: 16px; }
.music-lab .question button { flex: 1; }
.music-lab .help-page { position: absolute; z-index: 1; inset: 0; overflow-y: auto; background: #000;
  padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) 16px max(10px, env(safe-area-inset-left)); }
.music-lab .help-page h3 { margin: 0; font-size: 18px; letter-spacing: 2px; outline: none; }
.music-lab .help-page p { color: #bcbcbc; max-width: 60em; }
.music-lab .help-page table { border-collapse: collapse; max-width: 60em; }
.music-lab .help-page th { text-align: left; padding: 4px 16px 4px 0; vertical-align: top; white-space: nowrap; color: #3cbcfc; font-weight: normal; }
.music-lab .help-page td { padding: 4px 0; }
@media (max-width: 760px) {
  .music-lab { font-size: 14px; gap: 6px; }
  .music-lab .body { flex-direction: column; }
  .music-lab .side { width: auto; flex: none; max-height: 42%; gap: 6px; }
  .music-lab fieldset { padding: 4px 6px 6px; gap: 4px; }
  .music-lab .wide { flex-wrap: wrap; }
  .music-lab .editor { min-height: 9em; }
  .music-lab .editor textarea, .music-lab .editor pre { font-size: 14px; padding: 6px; }
  .music-lab .where { display: none; }
}
`;

/**
 * A question's answers in order; the first is selected when it opens. Clearing the library: NO
 * first (owner item 225). Adding a shared song: Add first.
 */
export function questionAnswers(
  kind: LabQuestion['kind'],
): [['no' | 'yes', string], ...['no' | 'yes', string][]] {
  return kind === 'clear'
    ? [
        ['no', 'No'],
        ['yes', 'Yes, clear it'],
      ]
    : [
        ['yes', 'Add to my songs'],
        ['no', 'Not now'],
      ];
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** The game's songs offered as examples, by name. */
const EXAMPLES = [...gameSongs].sort((a, b) => a.id.localeCompare(b.id));

export interface MusicLabStart {
  /** Text to open with (a shared link's song), and the name to offer for it. */
  text?: string;
  name?: string;
  /** The song came from a share link: offer to add it to the library. */
  shared?: boolean;
  /** A line to say once open (a share link that could not be read). */
  notice?: string;
}

/**
 * A yes/no question on the panel, spoken: clear a library this build cannot read (item 225, NO
 * selected first), or add a shared song to the library.
 */
export interface LabQuestion {
  kind: 'clear' | 'add';
  text: string;
  selected: 'yes' | 'no';
}

export class MusicLabScene implements Scene {
  /** The song text being edited. */
  text: string;
  /** Its library name (the name box). */
  name: string;
  /** The library song this text was opened from or last saved as (null: not in the library). */
  libraryName: string | null = null;
  /** The game song this text shows unchanged (read-only example: the first edit makes a copy). */
  example: string | null = null;
  /** The text as last saved or opened (unsaved changes: text differs). */
  private savedText: string;
  /** A song is playing (its compiled form: the loop button changes it as it plays). */
  playing: CompiledSong | null = null;
  status = '';
  error: DocError | null = null;
  private panel: HTMLElement | null = null;
  /** A press that needs a second to confirm (leaving with unsaved changes, deleting a song). */
  private confirming: string | null = null;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  /** The question on screen, if any. */
  question: LabQuestion | null = null;
  /** The syntax help page is open. */
  helpOpen = false;
  /** The last share link made (shown under the buttons). */
  shareUrl = '';
  private readonly start: MusicLabStart;

  constructor(
    private readonly game: Game,
    start: MusicLabStart = {},
  ) {
    this.start = start;
    this.text = start.text ?? NEW_SONG;
    this.name = cleanSongName(start.name ?? '') ?? 'New song';
    this.savedText = start.shared ? '' : this.text;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.buildPanel();
    this.check();
    const said = [
      'Music Lab. Write a song in the text box, then press Play. Syntax help explains the notes.',
    ];
    if (this.start.notice) said.push(this.start.notice);
    const problem = this.libraryProblem;
    if (problem === 'damaged')
      said.push('Your song library is damaged, so it cannot be read. Clear song library starts a new one.');
    else if (problem === 'newer')
      said.push(
        'Your song library was saved by a newer version of the game. Update the game to use it, or use Clear song library to start a new one.',
      );
    else if (problem === 'read') said.push('Songs cannot be saved: this device’s storage cannot be read.');
    this.say(said.join(' '), problem !== null);
    if (this.start.shared) {
      const name = readTitle(this.text);
      this.ask('add', `A shared song${name ? `, "${name}"` : ''}. Add it to your songs?`);
    }
    // A song does not play on in a tab in the background (review).
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function')
      document.addEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'hidden' || !this.playing) return;
    this.stop(true);
    this.status = 'Stopped: the game went to the background.';
    this.sync();
  };

  /* ---------- Questions (item 225; a shared song) ---------- */

  /** Why the library cannot be used: damaged (or newer), storage unreadable, or null. */
  get libraryProblem(): 'damaged' | 'newer' | 'read' | null {
    const lib = loadSongs();
    return lib.unreadable ? (lib.reason ?? 'read') : null;
  }

  /** Item 225: Clear song library asks first, NO selected. */
  askClearLibrary(): void {
    const problem = this.libraryProblem;
    if (problem !== 'damaged' && problem !== 'newer') {
      this.refreshLibrary();
      this.say(SONG_REFUSALS['not-damaged']);
      return;
    }
    this.ask(
      'clear',
      problem === 'newer'
        ? 'Clear the song library? It was saved by a newer version of the game (updating the game would read it), and clearing deletes it for good.'
        : 'Clear the song library? It is damaged, so it cannot be read, and clearing deletes it for good.',
    );
  }

  /** Asks `text`; the first answer (questionAnswers) is the one selected. */
  private ask(kind: LabQuestion['kind'], text: string): void {
    const q: LabQuestion = { kind, text, selected: questionAnswers(kind)[0][0] };
    this.question = q;
    this.paintQuestion();
    this.game.deps.announcer?.say(`${q.text} ${q.selected === 'no' ? 'No' : 'Yes'} is selected.`);
  }

  /** The answer to the question on screen. */
  answer(yes: boolean): void {
    const q = this.question;
    if (!q) return;
    this.question = null;
    this.paintQuestion();
    if (q.kind === 'clear') {
      if (!yes) return this.say('The song library was left as it is.');
      const r = clearDamagedSongLibrary();
      this.refreshLibrary();
      this.sync();
      if (!r.ok) return this.refused(r);
      this.say('The song library was cleared. Save adds songs again.');
      return;
    }
    if (!yes) return this.say('Not added. Save keeps it whenever you like.');
    this.addShared();
    this.box()?.focus({ preventScroll: true });
  }

  /** A shared song into the library, under its title (a free name when that one is taken). */
  private addShared(): void {
    const songs = loadSongs().songs;
    const base = this.name;
    let name = base;
    for (let n = 2; Object.hasOwn(songs, name) && n < 100; n++)
      name = cleanSongName(`${base.slice(0, 20)} ${n}`) ?? base;
    const r = saveSong(name, this.text);
    if (!r.ok) return this.refused(r);
    this.name = name;
    this.libraryName = name;
    this.savedText = this.text;
    this.refreshLibrary();
    this.sync();
    this.say(`Added "${name}" to your songs.`);
  }

  /* ---------- Share and help ---------- */

  /** A link with the song in it (no server: the text is in the link), copied when allowed. */
  async share(): Promise<void> {
    const code = await encodeShare(this.text);
    const url = songLink(code, typeof location === 'undefined' ? SITE_URL : location.href);
    this.shareUrl = url;
    const out = this.panel?.querySelector<HTMLInputElement>('[data-share-out]');
    if (out) {
      out.value = url;
      out.hidden = false;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      /* shown below to copy by hand */
    }
    this.say(
      copied
        ? 'Share link copied. Anyone who opens it can play the song and add it to their songs.'
        : 'Copy the share link from the box under Share link.',
    );
  }

  openHelp(open = true): void {
    this.helpOpen = open;
    const page = this.panel?.querySelector<HTMLElement>('.help-page');
    if (page) {
      page.hidden = !open;
      if (open) page.querySelector<HTMLElement>('h3')?.focus();
      else this.panel?.querySelector<HTMLElement>('[data-act="help"]')?.focus();
    }
    this.say(open ? 'Syntax help. Close returns to your song.' : 'Back to your song.');
  }

  exit(): void {
    this.stop(true);
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function')
      document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.panel?.remove();
    this.panel = null;
  }

  /* ---------- Playing ---------- */

  play(): void {
    const r = parseSongDoc(this.text);
    if (!r.ok) {
      this.showError(r.error, true);
      return;
    }
    const audio = this.game.ctx.audio;
    audio.unlock?.();
    const song = r.doc.compiled;
    this.playing = song;
    audio.playSong?.(song, () => {
      if (this.playing !== song) return;
      this.playing = null;
      this.sync();
      this.say('The song ended.');
    });
    this.sync();
    this.say(`Playing at tempo ${r.doc.tempo}${r.doc.loop ? ', looping' : ''}.`);
  }

  stop(quiet = false): void {
    const was = this.playing;
    this.playing = null;
    if (was) this.game.ctx.audio.stopMusic();
    if (!quiet) {
      this.sync();
      this.say('Stopped.');
    }
  }

  get tempo(): number {
    return readSettings(this.text).tempo;
  }
  get loop(): boolean {
    return readSettings(this.text).loop;
  }

  setTempo(bpm: number): void {
    const t = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(bpm)));
    this.edit(setTempo(this.text, t));
    // A tempo change restarts the song playing at the new speed.
    if (this.playing) this.play();
    else this.say(`Tempo ${t}.`);
  }

  toggleLoop(): void {
    const on = !this.loop;
    this.edit(setLoop(this.text, on));
    // The song playing follows at once (the sequencer reads the flag at each end).
    if (this.playing) this.playing.loop = on;
    this.say(on ? 'Loop on.' : 'Loop off: the song plays once.');
  }

  /* ---------- The text ---------- */

  /** The text changed (typed, or by a control): an example becomes a copy, then re-check. */
  edit(text: string, fromBox = false): void {
    if (text === this.text) return;
    // A question is open: the box is inert behind it; anything typed anyway is put back.
    if (fromBox && this.question) {
      this.syncBox();
      return;
    }
    this.text = text;
    this.confirming = null;
    if (this.example !== null) {
      const id = this.example;
      this.example = null;
      this.libraryName = null;
      this.name = cleanSongName(`${id} copy`) ?? 'Copy';
      this.savedText = '';
      this.say(
        `The game's songs can't be changed, so this is now your copy, "${this.name}". Save to keep it.`,
      );
    }
    if (!fromBox) this.syncBox();
    this.sync();
    if (fromBox) {
      // Typing: check once the typing pauses, so a half-typed note isn't an error yet.
      if (this.checkTimer) clearTimeout(this.checkTimer);
      this.checkTimer = setTimeout(() => this.check(true), 700);
    } else this.check();
  }

  /** Parse the text and show its first error (said when `say`), or clear the old one. */
  check(say = false): void {
    this.checkTimer = null;
    const r = parseSongDoc(this.text);
    if (r.ok) {
      const had = this.error !== null;
      this.error = null;
      this.paintError();
      if (had) this.say('No errors.', false);
      else this.sync();
      return;
    }
    const same = this.error && this.error.message === r.error.message && this.error.line === r.error.line;
    this.showError(r.error, say && !same);
  }

  private showError(e: DocError, say: boolean): void {
    this.error = e;
    this.paintError();
    const text = `Line ${e.line}, column ${e.col}: ${e.message}.`;
    if (say) this.say(text, true);
    else {
      this.status = text;
      this.sync();
    }
  }

  /** Put the cursor on the error. */
  goToError(): void {
    const box = this.box();
    if (!box || !this.error) return;
    box.focus();
    box.setSelectionRange(this.error.start, Math.min(this.error.end, this.text.length));
  }

  /* ---------- Songs: examples and the library ---------- */

  loadExample(id: string): void {
    const s = EXAMPLES.find((x) => x.id === id);
    if (!s) return;
    this.stop(true);
    this.text = songToDoc(s);
    this.savedText = this.text;
    this.example = id;
    this.libraryName = null;
    this.name = id;
    this.afterLoad(`The game's song "${id}". It is read-only: editing it makes your own copy.`);
  }

  newSong(): void {
    if (!this.confirmDrop('new')) return;
    this.stop(true);
    this.text = NEW_SONG;
    this.savedText = this.text;
    this.example = null;
    this.libraryName = null;
    this.name = 'New song';
    this.afterLoad('A new song.');
  }

  /** Save the text under the name box's name. */
  save(): void {
    const name = cleanSongName(this.name);
    if (!name) return this.refused({ ok: false, reason: 'name' });
    // Saving over another song of the library needs a second press.
    if (
      name !== this.libraryName &&
      Object.hasOwn(loadSongs().songs, name) &&
      this.confirming !== `save:${name}`
    ) {
      this.confirming = `save:${name}`;
      this.say(`"${name}" is already in your library. Press Save again to replace it.`);
      return;
    }
    const r = saveSong(name, this.text);
    if (!r.ok) return this.refused(r);
    this.name = name;
    this.libraryName = name;
    this.example = null;
    this.savedText = this.text;
    this.confirming = null;
    this.refreshLibrary();
    this.sync();
    this.say(`Saved "${name}".`);
  }

  open(name: string): void {
    const text = loadSongs().songs[name];
    if (text === undefined) return this.refused({ ok: false, reason: 'missing' });
    if (!this.confirmDrop(`open:${name}`)) return;
    this.stop(true);
    this.text = text;
    this.savedText = text;
    this.name = name;
    this.libraryName = name;
    this.example = null;
    this.afterLoad(`Opened "${name}".`);
  }

  /** Rename the library song this text is (to the name box's name). */
  rename(): void {
    const from = this.libraryName;
    if (from === null) {
      this.say('Save the song first; then Rename changes its name in your library.');
      return;
    }
    const r = renameSong(from, this.name);
    if (!r.ok) return this.refused(r);
    const to = cleanSongName(this.name) as string;
    this.name = to;
    this.libraryName = to;
    this.refreshLibrary();
    this.sync();
    this.say(`Renamed "${from}" to "${to}".`);
  }

  remove(name: string): void {
    if (this.confirming !== `delete:${name}`) {
      this.confirming = `delete:${name}`;
      this.say(`Press Delete again to delete "${name}" from your library.`);
      return;
    }
    this.confirming = null;
    const r = deleteSong(name);
    if (!r.ok) return this.refused(r);
    if (this.libraryName === name) {
      this.libraryName = null;
      this.savedText = '';
    }
    this.refreshLibrary();
    this.say(`Deleted "${name}".`);
  }

  /** Back to the title; with unsaved changes, a second press. */
  back(): void {
    if (!this.confirmDrop('back')) return;
    this.game.showTitle();
  }

  get dirty(): boolean {
    return this.text !== this.savedText && this.example === null;
  }

  /** Whether unsaved changes may go (none, or this is the second press of `what`). */
  private confirmDrop(what: string): boolean {
    if (!this.dirty || this.confirming === what) {
      this.confirming = null;
      return true;
    }
    this.confirming = what;
    this.say('This song has unsaved changes. Press again to drop them, or Save first.');
    return false;
  }

  private refused(r: SongWrite): void {
    if (!r.ok) this.say(SONG_REFUSALS[r.reason], true);
  }

  private afterLoad(said: string): void {
    this.confirming = null;
    this.error = null;
    this.syncBox();
    this.sync();
    this.check();
    this.say(this.error ? `${said} ${this.status}` : said);
  }

  /* ---------- Input / render ---------- */

  touchLabels(): TouchLabels {
    return NO_TOUCH_BUTTONS;
  }

  update(_input: InputFrame): void {
    // Everything is on the panel (its keys and touches never reach the game).
  }

  render(r: Renderer): void {
    r.clear('#000');
  }

  /* ---------- Panel ---------- */

  private say(text: string, isError = false): void {
    this.status = text;
    this.sync(isError);
    this.game.deps.announcer?.say(text);
  }

  private box(): HTMLTextAreaElement | null {
    return this.panel?.querySelector('textarea') ?? null;
  }

  private buildPanel(): void {
    const overlay = this.game.deps.overlay;
    if (!overlay || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = 'music-lab';
    el.dataset.nativeTouch = '';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-labelledby', 'music-lab-title');
    el.innerHTML = `<style>${STYLE}</style>
      <header>
        <h2 id="music-lab-title">MUSIC LAB</h2>
        <button type="button" class="alt" data-act="help">Syntax help</button>
        <button type="button" class="alt" data-act="back">Back</button>
      </header>
      <div class="body">
        <div class="side">
          <fieldset><legend>Play</legend>
            <div class="row wide">
              <button type="button" class="grow" data-act="play">Play</button>
              <button type="button" class="alt grow" data-act="stop">Stop</button>
              <button type="button" class="alt grow" data-act="loop" aria-pressed="true">Loop</button>
            </div>
            <div class="row">
              <label for="music-lab-tempo" class="grow">Tempo</label>
              <button type="button" class="alt" data-act="slower" aria-label="Slower">-</button>
              <input id="music-lab-tempo" class="tempo" type="number" inputmode="numeric" min="${MIN_TEMPO}" max="${MAX_TEMPO}" data-tempo>
              <button type="button" class="alt" data-act="faster" aria-label="Faster">+</button>
            </div>
          </fieldset>
          <fieldset><legend>My songs</legend>
            <div class="row">
              <input class="grow" type="text" data-name aria-label="Song name" maxlength="24" autocomplete="off" spellcheck="false">
              <button type="button" data-act="save">Save</button>
              <button type="button" class="alt" data-act="rename">Rename</button>
            </div>
            <div class="row">
              <select class="grow" data-library aria-label="Your saved songs"></select>
              <button type="button" class="alt" data-act="open">Open</button>
              <button type="button" class="alt" data-act="delete">Delete</button>
            </div>
            <div class="row" data-damaged hidden>
              <button type="button" class="grow" data-act="clear">Clear song library</button>
            </div>
          </fieldset>
          <fieldset><legend>Game songs (examples)</legend>
            <div class="row">
              <select class="grow" data-example aria-label="The game's songs">${EXAMPLES.map(
                (s) => `<option value="${esc(s.id)}">${esc(s.id)}</option>`,
              ).join('')}</select>
              <button type="button" class="alt" data-act="example">Load</button>
            </div>
          </fieldset>
          <fieldset><legend>Song</legend>
            <div class="row">
              <button type="button" class="alt grow" data-act="new">New</button>
              <button type="button" class="alt grow" data-act="share">Share link</button>
            </div>
            <input type="text" readonly data-share-out aria-label="Share link" hidden>
          </fieldset>
        </div>
        <div class="editor">
          <pre aria-hidden="true"></pre>
          <textarea aria-label="Song text" aria-describedby="music-lab-status" spellcheck="false"
            autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea>
        </div>
      </div>
      <div class="question" role="alertdialog" aria-labelledby="music-lab-question" hidden>
        <p id="music-lab-question"></p>
        <div class="row"></div>
      </div>
      <section class="help-page" aria-labelledby="music-lab-help" hidden>
        <div class="row"><h3 id="music-lab-help" tabindex="-1" class="grow">SYNTAX HELP</h3>
          <button type="button" data-act="close-help">Close</button></div>
        <p>A song is a few settings lines, then its channels. Each channel's notes run until the next
        channel's name. Spaces and new lines don't matter. Every channel should come out the same length.</p>
        <table><tbody>${SYNTAX_HELP.map(
          ([code, what]) => `<tr><th scope="row"><code>${esc(code)}</code></th><td>${esc(what)}</td></tr>`,
        ).join('')}</tbody></table>
      </section>
      <div class="foot">
        <p class="status" id="music-lab-status"></p>
        <span class="where" aria-hidden="true"></span>
      </div>`;
    // Keys typed here are the panel's: the game's keyboard (on window) never sees them go down.
    for (const type of ['keydown', 'keypress']) el.addEventListener(type, (e) => e.stopPropagation());
    // Escape answers a question NO, or closes the help.
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.question) this.answer(false);
      else if (this.helpOpen) this.openHelp(false);
    });
    // Touches on the panel are the panel's (the touch pad under it must not see them).
    for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend'])
      el.addEventListener(type, (e) => e.stopPropagation());
    overlay.appendChild(el);
    this.panel = el;

    const q = <E extends HTMLElement>(sel: string) => el.querySelector(sel) as E;
    const box = q<HTMLTextAreaElement>('textarea');
    const pre = q<HTMLPreElement>('pre');
    box.addEventListener('input', () => this.edit(box.value, true));
    box.addEventListener('scroll', () => {
      pre.scrollTop = box.scrollTop;
      pre.scrollLeft = box.scrollLeft;
    });
    const where = () => this.showWhere();
    for (const t of ['keyup', 'click', 'input', 'select']) box.addEventListener(t, where);
    box.addEventListener('keydown', (e) => {
      // Tab types two spaces (Escape, then Tab, leaves the box as usual).
      if (e.key === 'Tab' && !e.shiftKey && !this.tabOut) {
        e.preventDefault();
        box.setRangeText('  ', box.selectionStart, box.selectionEnd, 'end');
        this.edit(box.value, true);
      }
      this.tabOut = e.key === 'Escape';
    });
    q<HTMLInputElement>('[data-name]').addEventListener('input', (e) => {
      this.name = (e.target as HTMLInputElement).value;
      this.confirming = null;
    });
    const tempo = q<HTMLInputElement>('[data-tempo]');
    tempo.addEventListener('change', () => {
      const v = Number(tempo.value);
      if (Number.isFinite(v) && v > 0) this.setTempo(v);
      else tempo.value = String(this.tempo);
    });
    el.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => this.act(b.dataset.act ?? '')),
    );
    this.syncBox();
    this.refreshLibrary();
    this.sync();
    box.focus({ preventScroll: true });
  }
  private tabOut = false;

  private act(what: string): void {
    const sel = (s: string) => this.panel?.querySelector<HTMLSelectElement>(s)?.value ?? '';
    switch (what) {
      case 'play':
        return this.play();
      case 'stop':
        return this.stop();
      case 'loop':
        return this.toggleLoop();
      case 'slower':
        return this.setTempo(this.tempo - TEMPO_STEP);
      case 'faster':
        return this.setTempo(this.tempo + TEMPO_STEP);
      case 'save':
        return this.save();
      case 'rename':
        return this.rename();
      case 'open':
        return sel('[data-library]') ? this.open(sel('[data-library]')) : this.say('No saved songs yet.');
      case 'delete':
        return sel('[data-library]') ? this.remove(sel('[data-library]')) : this.say('No saved songs yet.');
      case 'example':
        return this.loadExample(sel('[data-example]'));
      case 'new':
        return this.newSong();
      case 'share':
        return void this.share();
      case 'help':
        return this.openHelp(true);
      case 'close-help':
        return this.openHelp(false);
      case 'clear':
        return this.askClearLibrary();
      case 'back':
        return this.back();
    }
  }

  /** The text box shows this.text (after a load or a control's change), keeping the cursor. */
  private syncBox(): void {
    const box = this.box();
    if (!box || box.value === this.text) return;
    const at = box.selectionStart;
    box.value = this.text;
    box.setSelectionRange(Math.min(at, this.text.length), Math.min(at, this.text.length));
    this.paintError();
  }

  /** The highlight behind the text box: the bad spot marked. */
  private paintError(): void {
    const pre = this.panel?.querySelector('pre');
    if (!pre) return;
    const e = this.error;
    const t = this.text;
    if (!e) pre.textContent = t + '\n';
    else {
      const s = Math.min(e.start, t.length);
      const end = Math.min(Math.max(e.end, s + 1), t.length);
      // A spot past the end, or on a line break, shows as a marked space.
      const bad = t.slice(s, end).replace(/\n/g, ' ') || ' ';
      pre.innerHTML = `${esc(t.slice(0, s))}<mark>${esc(bad)}</mark>${esc(t.slice(end))}\n`;
    }
    const box = this.box();
    if (box) {
      pre.scrollTop = box.scrollTop;
      pre.scrollLeft = box.scrollLeft;
    }
  }

  private showWhere(): void {
    const box = this.box();
    const out = this.panel?.querySelector('.where');
    if (!box || !out) return;
    const before = box.value.slice(0, box.selectionStart);
    const line = before.split('\n').length;
    const col = box.selectionStart - before.lastIndexOf('\n');
    out.textContent = `Ln ${line}, Col ${col}`;
  }

  /** The question box shows this.question, its selected answer focused (NO first for clearing). */
  private paintQuestion(): void {
    const box = this.panel?.querySelector<HTMLElement>('.question');
    if (!box) return;
    const q = this.question;
    box.hidden = !q;
    // While a question is open nothing behind it can be reached or typed in.
    for (const child of Array.from(this.panel?.children ?? []))
      if (child !== box && child.tagName !== 'STYLE') (child as HTMLElement).inert = !!q;
    if (!q) return;
    (box.querySelector('p') as HTMLElement).textContent = q.text;
    const row = box.querySelector('.row') as HTMLElement;
    row.innerHTML = '';
    const buttons: HTMLButtonElement[] = [];
    for (const [which, label] of questionAnswers(q.kind)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (which === 'no') b.className = 'alt';
      b.addEventListener('focus', () => q === this.question && (q.selected = which));
      b.addEventListener('click', () => this.answer(which === 'yes'));
      row.appendChild(b);
      buttons.push(b);
      if (which === q.selected) queueMicrotask(() => b.focus());
    }
    // Tab stays on the question's buttons (the rest is inert while it is open).
    row.onkeydown = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
      next?.focus();
    };
  }

  private refreshLibrary(): void {
    const damagedRow = this.panel?.querySelector<HTMLElement>('[data-damaged]');
    const problem = this.libraryProblem;
    if (damagedRow) damagedRow.hidden = problem !== 'damaged' && problem !== 'newer';
    const sel = this.panel?.querySelector<HTMLSelectElement>('[data-library]');
    if (!sel) return;
    const lib = loadSongs();
    const names = Object.keys(lib.songs).sort((a, b) => a.localeCompare(b));
    sel.innerHTML = names.length
      ? names
          .map(
            (n) => `<option value="${esc(n)}" ${n === this.libraryName ? 'selected' : ''}>${esc(n)}</option>`,
          )
          .join('')
      : `<option value="">${lib.unreadable ? '(library unreadable)' : '(none yet)'}</option>`;
  }

  /** The panel's controls show the scene's state. */
  private sync(isError = false): void {
    const el = this.panel;
    if (!el) return;
    const q = <E extends HTMLElement>(sel: string) => el.querySelector(sel) as E;
    const { tempo, loop } = readSettings(this.text);
    const t = q<HTMLInputElement>('[data-tempo]');
    if (document.activeElement !== t) t.value = String(tempo);
    q<HTMLButtonElement>('[data-act="loop"]').setAttribute('aria-pressed', String(loop));
    const play = q<HTMLButtonElement>('[data-act="play"]');
    play.textContent = this.playing ? 'Play again' : 'Play';
    const name = q<HTMLInputElement>('[data-name]');
    if (document.activeElement !== name) name.value = this.name;
    const status = q<HTMLElement>('.status');
    status.textContent = this.status;
    status.classList.toggle('error', isError || (this.error !== null && this.status.startsWith('Line ')));
    if (this.error && this.status.startsWith('Line ')) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'alt';
      go.textContent = 'Go to error';
      go.addEventListener('click', () => this.goToError());
      status.appendChild(go);
    }
  }
}
