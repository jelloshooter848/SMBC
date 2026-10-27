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
  setLoop,
  setTempo,
  songToDoc,
  MAX_TEMPO,
  MIN_TEMPO,
  type DocError,
} from '../music-lab/song-doc';
import {
  SONG_REFUSALS,
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

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** The game's songs offered as examples, by name. */
const EXAMPLES = [...gameSongs].sort((a, b) => a.id.localeCompare(b.id));

export interface MusicLabStart {
  /** Text to open with (a shared link's song), and the name to offer for it. */
  text: string;
  name?: string;
  /** The song came from a share link: offer to add it to the library. */
  shared?: boolean;
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

  constructor(
    private readonly game: Game,
    start?: MusicLabStart,
  ) {
    this.text = start?.text ?? NEW_SONG;
    this.name = start?.name ?? 'New song';
    this.savedText = start?.shared ? '' : this.text;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.buildPanel();
    this.check();
    this.say('Music Lab. Write a song in the text box, then press Play. Syntax help explains the notes.');
  }

  exit(): void {
    this.stop(true);
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
    if (name !== this.libraryName && name in loadSongs().songs && this.confirming !== `save:${name}`) {
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
          </fieldset>
        </div>
        <div class="editor">
          <pre aria-hidden="true"></pre>
          <textarea aria-label="Song text" aria-describedby="music-lab-status" spellcheck="false"
            autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea>
        </div>
      </div>
      <div class="foot">
        <p class="status" id="music-lab-status"></p>
        <span class="where" aria-hidden="true"></span>
      </div>`;
    // Keys typed here are the panel's: the game's keyboard (on window) never sees them go down.
    for (const type of ['keydown', 'keypress']) el.addEventListener(type, (e) => e.stopPropagation());
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
        return this.say('Share links are coming in the full build.');
      case 'help':
        return this.say('Syntax help is coming in the full build.');
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

  private refreshLibrary(): void {
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
