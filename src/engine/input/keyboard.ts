import type { Code } from './bindings';
import type { InputSource } from './input-manager';

export class KeyboardSource implements InputSource {
  readonly down = new Set<Code>();
  /** Codes pressed since the last poll, for the "press any key" gate and remap capture. */
  private justPressed: Code[] = [];
  onAnyPress: ((code: Code) => void) | null = null;

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat) return;
      this.down.add(ev.code);
      this.justPressed.push(ev.code);
      this.onAnyPress?.(ev.code);
      if (PREVENT.has(ev.code)) ev.preventDefault();
    });
    target.addEventListener('keyup', (e) => {
      const ev = e as KeyboardEvent;
      this.down.delete(ev.code);
      if (PREVENT.has(ev.code)) ev.preventDefault();
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  poll(): ReadonlySet<Code> {
    return this.down;
  }

  takeJustPressed(): Code[] {
    const out = this.justPressed;
    this.justPressed = [];
    return out;
  }
}

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']);
