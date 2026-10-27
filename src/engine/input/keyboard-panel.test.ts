import { describe, expect, it } from 'vitest';
import { KeyboardSource } from './keyboard';

/*
 * Pre-0.5.0 items 266 and 267, tests first: on a DOM panel that takes its own keys (Music Lab,
 * marked data-native-keys) the game's keyboard leaves Space and Tab to the browser, so Space
 * presses a focused button and Tab moves focus. Everywhere else (play, menus: focus on the page
 * or the canvas) Space and Tab are the game's, exactly as before.
 */

/** An element stand-in: inside a native-keys panel or not. */
const element = (inPanel: boolean) => ({
  closest: (sel: string) => (inPanel && sel === '[data-native-keys]' ? {} : null),
});

function key(type: 'keydown' | 'keyup', code: string, target?: unknown): Event {
  const e = new Event(type, { cancelable: true }) as Event & { code: string; repeat: boolean };
  e.code = code;
  e.repeat = false;
  if (target !== undefined) Object.defineProperty(e, 'target', { value: target });
  return e;
}

describe('Space and Tab in play are the game’s, as before', () => {
  for (const target of [undefined, element(false), {}])
    it(`Space goes down and up, its default stopped (target: ${target === undefined ? 'the window' : 'the page'})`, () => {
      const win = new EventTarget();
      const kb = new KeyboardSource(win);
      const down = key('keydown', 'Space', target);
      win.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      expect(kb.poll().has('Space')).toBe(true);
      expect(kb.poll().has('Space')).toBe(true);
      const up = key('keyup', 'Space', target);
      win.dispatchEvent(up);
      expect(up.defaultPrevented).toBe(true);
      expect(kb.poll().has('Space')).toBe(false);
      const tab = key('keydown', 'Tab', target);
      win.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      const arrow = key('keydown', 'ArrowDown', target);
      win.dispatchEvent(arrow);
      expect(arrow.defaultPrevented).toBe(true);
    });

  it('a tap of Space shorter than a frame still counts once', () => {
    const win = new EventTarget();
    const kb = new KeyboardSource(win);
    win.dispatchEvent(key('keydown', 'Space'));
    win.dispatchEvent(key('keyup', 'Space'));
    expect(kb.poll().has('Space')).toBe(true);
    expect(kb.poll().has('Space')).toBe(false);
  });
});

describe('on a native-keys panel the browser keeps Space and Tab', () => {
  it('Space released on a focused panel button is not stopped (the button is pressed)', () => {
    const win = new EventTarget();
    const kb = new KeyboardSource(win);
    const up = key('keyup', 'Space', element(true));
    win.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(false);
    expect(kb.poll().has('Space')).toBe(false);
  });

  it('Tab on the panel is not stopped (focus moves on)', () => {
    const win = new EventTarget();
    new KeyboardSource(win);
    for (const type of ['keydown', 'keyup'] as const) {
      const tab = key(type, 'Tab', element(true));
      win.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);
    }
  });

  it('a key held from play and released on the panel is still let go', () => {
    const win = new EventTarget();
    const kb = new KeyboardSource(win);
    win.dispatchEvent(key('keydown', 'Space'));
    win.dispatchEvent(key('keyup', 'Space', element(true)));
    kb.poll();
    expect(kb.poll().has('Space')).toBe(false);
  });
});
