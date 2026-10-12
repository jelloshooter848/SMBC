/*
 * PASTE CODE's text box (Options > Save files, 0.4.44): a DOM panel over the game, as the level
 * editor's panel is, so a phone's own keyboard, paste menu and text selection work (the canvas
 * has none). Keys typed into it never reach the game. Big type (16 px: iOS doesn't zoom in) and
 * 44 px buttons; it sits at the top of the screen, above a phone's on-screen keyboard.
 */

export interface CodeEntryOptions {
  /** The heading ('PASTE CODE INTO FILE 2'). */
  title: string;
  /** Reads the clipboard (the PASTE button; absent: the button is left out). */
  read?: () => Promise<string | null>;
  /** LOAD (or Enter): an error message to show, or null when the text was taken (the panel closes). */
  submit: (text: string) => string | null;
  /** CANCEL, Escape, or the game's B button. */
  cancel: () => void;
  /** Says a line to screen readers (the panel's own alert region says it too). */
  say?: (text: string) => void;
}

const STYLE = `
.code-entry { position: fixed; z-index: 50; left: 50%; top: max(8px, env(safe-area-inset-top));
  transform: translateX(-50%); width: min(560px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 12px; background: #000; color: #fcfcfc; border: 4px solid #fcfcfc;
  font: 16px/1.3 ui-monospace, Menlo, Consolas, monospace; text-transform: uppercase; }
.code-entry h2 { font-size: 16px; margin: 0 0 6px; letter-spacing: 1px; }
.code-entry p { margin: 0 0 8px; font-size: 13px; color: #bcbcbc; }
.code-entry textarea { display: block; width: 100%; box-sizing: border-box; height: 4.2em; resize: none;
  font: 16px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #fcfcfc; background: #0c1c48;
  border: 2px solid #3cbcfc; border-radius: 0; padding: 6px; text-transform: none;
  -webkit-user-select: text; user-select: text; touch-action: manipulation; }
.code-entry .status { min-height: 1.3em; color: #fc9838; font-size: 14px; margin: 6px 0; }
.code-entry .row { display: flex; gap: 8px; }
.code-entry button { flex: 1; min-height: 44px; font: inherit; font-size: 15px; color: #000; background: #fcfcfc;
  border: 0; border-radius: 0; cursor: pointer; touch-action: manipulation; text-transform: uppercase; }
.code-entry button.alt { background: #3c3c3c; color: #fcfcfc; }
`;

export class CodeEntryPanel {
  readonly el: HTMLElement;
  readonly box: HTMLTextAreaElement;
  private readonly status: HTMLElement;
  private closed = false;

  constructor(
    overlay: HTMLElement,
    private readonly opts: CodeEntryOptions,
  ) {
    const el = document.createElement('div');
    el.className = 'code-entry';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'code-entry-title');
    el.innerHTML = `<style>${STYLE}</style>
      <h2 id="code-entry-title"></h2>
      <p>Paste the code, or the whole message with the link. You can type it too.</p>
      <textarea aria-label="Save code" autocapitalize="characters" autocomplete="off" autocorrect="off"
        spellcheck="false" enterkeyhint="done" placeholder="XXXXX-XXXXX-XXXXX-..."></textarea>
      <div class="status" role="alert" aria-live="assertive"></div>
      <div class="row">
        ${opts.read ? '<button type="button" data-paste class="alt">Paste</button>' : ''}
        <button type="button" data-load>Load</button>
        <button type="button" data-cancel class="alt">Cancel</button>
      </div>`;
    (el.querySelector('h2') as HTMLElement).textContent = opts.title;
    this.el = el;
    this.box = el.querySelector('textarea') as HTMLTextAreaElement;
    this.status = el.querySelector('.status') as HTMLElement;
    // Keys typed here are the text box's: the game's keyboard (on window) never sees them.
    for (const type of ['keydown', 'keyup', 'keypress'])
      el.addEventListener(type, (e) => e.stopPropagation());
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      } else if (e.key === 'Enter' && !e.shiftKey && e.target === this.box) {
        e.preventDefault();
        this.load();
      }
    });
    // Touches on the panel are the panel's (the touch pad under it must not see them).
    for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend'])
      el.addEventListener(type, (e) => e.stopPropagation());
    el.querySelector('[data-load]')?.addEventListener('click', () => this.load());
    el.querySelector('[data-cancel]')?.addEventListener('click', () => this.cancel());
    el.querySelector('[data-paste]')?.addEventListener('click', () => void this.paste());
    overlay.appendChild(el);
    this.box.focus({ preventScroll: true });
  }

  get open(): boolean {
    return !this.closed;
  }

  /** Shows (and says) a line under the box. */
  show(text: string): void {
    this.status.textContent = text;
    this.opts.say?.(text);
  }

  /** The clipboard into the box, then LOAD; nothing there, the box waits for typing. */
  async paste(auto = false): Promise<void> {
    const text = (await this.opts.read?.()) ?? null;
    if (this.closed) return;
    if (text === null || !text.trim()) {
      if (!auto) this.show('NOTHING TO PASTE. TAP THE BOX AND PASTE OR TYPE THE CODE');
      return;
    }
    this.box.value = text;
    this.load(auto);
  }

  /** LOAD: the text to the scene; an error stays on screen (when `quiet`, only a valid code is taken). */
  load(quiet = false): void {
    if (this.closed) return;
    const err = this.opts.submit(this.box.value);
    if (err === null) this.close();
    else if (quiet) this.box.value = '';
    else {
      this.show(err);
      this.box.focus({ preventScroll: true });
      this.box.select();
    }
  }

  cancel(): void {
    if (this.closed) return;
    this.close();
    this.opts.cancel();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.box.blur();
    this.el.remove();
  }
}
