import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { normalizeBackupCode } from '@engine/online/online-backup';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { abilityHint } from './hints';
import { CodeEntryPanel } from './code-entry';
import { shareEnv } from './save-codes';
import type { Game } from './game';

/*
 * RESTORE FROM CODE's code box (item 159): PASTE CODE's text panel (code-entry.ts, so a phone's
 * keyboard and paste work), taking a backup code as forgivingly as a save code. A valid code
 * closes it and goes to `done`; anything else stays with the reason said; CANCEL gives null.
 */
export class RestoreCodeScene implements Scene {
  readonly translucent = true;
  panel: CodeEntryPanel | null = null;
  private t = 0;
  private finished = false;

  constructor(
    private readonly game: Game,
    private readonly done: (code: string | null) => void,
  ) {}

  enter(): void {
    const game = this.game;
    game.deps.announcer?.say(
      'Restore from code. Type your backup code, ten letters and numbers, into the text box, then Load.',
    );
    const overlay = game.deps.overlay;
    if (!overlay || typeof document === 'undefined') return;
    const env = shareEnv(game);
    this.panel = new CodeEntryPanel(overlay, {
      title: 'Restore from code',
      hint: 'Type or paste your backup code (ten letters and numbers).',
      label: 'Backup code',
      placeholder: 'ABCDE-12345',
      ...(env.read ? { read: env.read } : {}),
      submit: (text) => this.submit(text),
      cancel: () => this.cancel(),
      say: (text) => game.deps.announcer?.say(text),
    });
  }

  exit(): void {
    this.panel?.close();
    this.panel = null;
  }

  /** Text typed or pasted: the reason it is not a code, or null when it was one (the box closes). */
  submit(text: string): string | null {
    if (this.finished) return null;
    const code = normalizeBackupCode(text);
    if (!code) {
      this.game.ctx.audio.sfx('bump');
      return 'THAT IS NOT A BACKUP CODE: TEN LETTERS AND NUMBERS';
    }
    this.finished = true;
    this.game.scenes.pop();
    this.done(code);
    return null;
  }

  cancel(): void {
    if (this.finished) return;
    this.finished = true;
    this.game.scenes.pop();
    this.game.deps.announcer?.say('Cancelled.');
    this.done(null);
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
    r.clear('#000');
    const lines = ['TYPE THE BACKUP CODE IN', 'THE BOX', abilityHint(this.game, 'CANCEL', 'attack')];
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, 182 + i * 14));
  }
}
