import type { Code } from './bindings';
import type { InputSource } from './input-manager';

/**
 * Keyboard input. Every keydown is latched until the next poll so a tap shorter than one
 * frame (16 ms) still counts as a press.
 */
export class KeyboardSource implements InputSource {
  readonly down = new Set<Code>();
  private latched = new Set<Code>();
  private justPressed: Code[] = [];
  private polled = new Set<Code>();
  onAnyPress: ((code: Code) => void) | null = null;

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat) return;
      this.down.add(ev.code);
      this.latched.add(ev.code);
      this.justPressed.push(ev.code);
      this.onAnyPress?.(ev.code);
      if (PREVENT.has(ev.code) && !onNativeKeysPanel(ev)) ev.preventDefault();
    });
    target.addEventListener('keyup', (e) => {
      const ev = e as KeyboardEvent;
      this.down.delete(ev.code);
      if (PREVENT.has(ev.code) && !onNativeKeysPanel(ev)) ev.preventDefault();
    });
    if (typeof window !== 'undefined') window.addEventListener('blur', () => this.down.clear());
  }

  poll(): ReadonlySet<Code> {
    this.polled = new Set(this.down);
    for (const c of this.latched) this.polled.add(c);
    this.latched.clear();
    return this.polled;
  }

  takeJustPressed(): Code[] {
    const out = this.justPressed;
    this.justPressed = [];
    return out;
  }
}

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']);

/**
 * The key is on a DOM panel that takes its own keys (Music Lab: `data-native-keys`): the browser
 * keeps Space and Tab there, so Space presses the focused button and Tab moves focus (0.5.0, items
 * 266-267). In play and the menus focus is on the page or the canvas, so nothing changes there.
 */
function onNativeKeysPanel(ev: Event): boolean {
  const t = ev.target as { closest?: (sel: string) => unknown } | null;
  return typeof t?.closest === 'function' && t.closest('[data-native-keys]') != null;
}
