import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { defaultSettings } from '@engine/save/settings';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { makeGame, useStorage } from './heroes-harness';
import { fakeAudio, stubAudioGlobals } from './fake-audio';

// 0.4.73 (52A review): with Reduce flashing, BACK inside the REMIX-to-CLASSIC crossfade goes
// straight to the finished title. That is decided by CLASSIC's frame count, but the crossfade
// runs on the clock: on a slow device the overworld may already be playing. The theme then comes
// in from its loop point, never from its fanfare. The real AudioManager on a fake AudioContext.

useStorage();
beforeEach(() => {
  vi.useFakeTimers();
  stubAudioGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  const a = fakeAudio();
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const h = makeGame({
    deps: {
      ctx: { assets, audio: a.audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      settings: defaultSettings(),
      applySettings: () => {},
    },
  });
  const plays = vi.spyOn(a.seq(), 'play');
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 2);
  expect(a.current()).toBe('title');
  return { ...a, h, plays };
}

describe('the calm shortcut back from CLASSIC (Reduce flashing)', () => {
  it('the overworld already in (a slow device): the theme comes in from its loop point', () => {
    const s = setup();
    s.h.game.showClassicTitle();
    s.h.idle(2); // few frames...
    vi.advanceTimersByTime(1000); // ...but the crossfade's clock has run out
    expect(s.current()).toBe('overworld');
    s.h.tap('attack');
    const title = s.h.top() as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(title.phase).toBe('ready');
    expect(s.current()).toBe('title');
    expect(s.plays.mock.calls.at(-1)?.[2]).toBe(true); // from the loop point, not the fanfare
    vi.advanceTimersByTime(3000);
    expect(s.current()).toBe('title');
  });

  it('the theme still fading out: it only comes back up (never restarted)', () => {
    const s = setup();
    const started = s.plays.mock.calls.length;
    s.h.game.showClassicTitle();
    vi.advanceTimersByTime(100);
    s.h.tap('attack');
    expect((s.h.top() as TitleScene).phase).toBe('ready');
    vi.advanceTimersByTime(3000);
    expect(s.current()).toBe('title');
    expect(s.plays.mock.calls.length).toBe(started);
    expect(s.fade().calls.at(-1)).toMatch(/^ramp 1@/);
  });
});
