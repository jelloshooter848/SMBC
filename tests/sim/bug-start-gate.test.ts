import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { defaultSettings } from '@engine/save/settings';
import type { TitleScene } from '@game/scenes/title';
import { needsStartGate } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { draw, makeGame, useStorage } from './heroes-harness';
import { FakeContext, fakeAudio, stubAudioGlobals } from './fake-audio';

// BUG-13 (owner): the REMIX title's rift intro was never heard: it played before any press, on a
// sound the browser still held back, and the first press both started the sound and skipped the
// intro. Now the page load's first title waits behind a start gate while sound is not running;
// its press starts the sound and the intro from its first frame, and is not a skip.

useStorage();
/** The page's own key and pointer listeners (the gate listens for any key, click or tap). */
let listeners: Record<string, ((e: unknown) => void)[]> = {};
beforeEach(() => {
  vi.useFakeTimers();
  stubAudioGlobals();
  listeners = {};
  FakeContext.last = null;
  const w = globalThis.window as unknown as Record<string, unknown>;
  w.addEventListener = (type: string, fn: (e: unknown) => void) => (listeners[type] ??= []).push(fn);
  w.removeEventListener = (type: string, fn: (e: unknown) => void) => {
    listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeContext.startState = 'running';
});

/** The first title of a page load; `browser`: the AudioContext's state once it is made. */
function launch(opts: { browser?: string; unlocked?: boolean; touch?: boolean } = {}) {
  FakeContext.startState = opts.browser ?? 'suspended';
  FakeContext.last = null;
  const a = fakeAudio(opts.unlocked ?? false);
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const settings = defaultSettings();
  if (opts.touch) settings.input.touch = 'on';
  const h = makeGame({
    deps: {
      ctx: { assets, audio: a.audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
      settings,
      applySettings: () => {},
      titleIntro: true,
    },
  });
  const jingles = vi.spyOn(a.audio, 'playJingle');
  h.game.showTitle();
  const title = h.top() as TitleScene;
  /** What the page does on a key or tap: main.ts unlocks the sound in its event, then the gate hears it. */
  const event = (type: 'keydown' | 'pointerdown') => {
    a.audio.unlock();
    for (const fn of listeners[type] ?? []) fn({});
  };
  return { ...a, h, title, jingles, event };
}

/** The words drawn (each once: its shadow is the same text). */
const texts = (s: TitleScene) => [...new Set(draw(s).texts.map((t) => t.str))];

describe('BUG-13 the start gate', () => {
  it('sound not running at launch: the gate, said, steady; no intro behind it yet', () => {
    expect(needsStartGate({ state: 'off' })).toBe(true);
    expect(needsStartGate({ state: 'suspended' })).toBe(true);
    const s = launch();
    expect(s.title.phase).toBe('gate');
    expect(s.jingles).not.toHaveBeenCalled();
    expect(s.h.said.at(-1)).toContain('Press any key to start.');
    // Steady: the same words every frame, no flash.
    for (let i = 0; i < 120; i++) {
      s.h.step();
      expect(texts(s.title)).toEqual(['PRESS ANY KEY']);
    }
    expect(s.title.phase).toBe('gate');
    expect(s.jingles).not.toHaveBeenCalled();
    expect(s.title.boltFlash()).toBe(false);
  });

  it('on touch it says TAP TO START', () => {
    const s = launch({ touch: true });
    expect(texts(s.title)).toEqual(['TAP TO START']);
    expect(s.h.said.at(-1)).toContain('Tap to start.');
  });

  it('its press starts the sound and the rift intro from frame 0, and is not a skip', () => {
    const s = launch();
    s.event('keydown');
    s.h.step(['jump']); // the same press, as the game sees it
    expect(s.title.phase).toBe('rift');
    expect(s.jingles).toHaveBeenCalledWith('title-rift');
    expect(s.audio.state).not.toBe('off');
    expect(s.seq().playing).not.toBeNull();
    // Held, then let go: the intro plays on.
    for (let i = 0; i < 20; i++) s.h.step(['jump']);
    s.h.idle(30);
    expect(s.title.phase).toBe('rift');
    expect(s.current()).toBeNull(); // still the rift jingle, not the theme
    // A later press skips it, as before.
    s.h.tap('jump');
    expect(s.title.phase).toBe('ready');
    expect(s.current()).toBe('title');
  });

  it('a key the game does not use, a click or a tap passes it too; a pad button starts the sound itself', () => {
    for (const type of ['keydown', 'pointerdown'] as const) {
      const s = launch();
      s.event(type);
      s.h.step(); // no game action at all
      expect(s.title.phase).toBe('rift');
      expect(s.jingles).toHaveBeenCalledWith('title-rift');
      s.h.idle(5);
      expect(s.title.phase).toBe('rift');
    }
    // A pad button has no page event: the gate asks for the sound itself.
    const p = launch();
    expect(p.ctx()).toBeNull();
    p.h.tap('start');
    expect(p.title.phase).toBe('rift');
    expect(p.ctx()).not.toBeNull();
    expect(p.jingles).toHaveBeenCalledWith('title-rift');
  });

  it('sound already running at launch: no gate, the intro at once', () => {
    const s = launch({ browser: 'running', unlocked: true });
    expect(s.title.phase).toBe('rift');
    expect(s.jingles).toHaveBeenCalledWith('title-rift');
  });

  it('only the page load’s first title: a second visit has no gate (and no intro)', () => {
    const s = launch();
    s.h.tap('jump');
    s.h.tap('jump');
    expect(s.title.phase).toBe('ready');
    s.h.game.showTitle();
    const again = s.h.top() as TitleScene;
    expect(again.phase).toBe('drop');
    s.h.idle(TITLE_TIMING.dropEnd + 1);
    expect(again.phase).toBe('ready');
    // Its listeners are gone with it.
    expect(listeners.keydown ?? []).toHaveLength(0);
    expect(listeners.pointerdown ?? []).toHaveLength(0);
  });
});
