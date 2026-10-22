import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { defaultSettings } from '@engine/save/settings';
import { MUSIC_FADE_IN_S } from '@engine/audio/audio-manager';
import { TitleScene } from '@game/scenes/title';
import { ClassicTitleScene, SMASH } from '@game/scenes/original-title';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { TITLE_MUSIC } from '@game/scenes/title-music';
import type { MenuItem } from '@game/scenes/menu';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { makeGame, useStorage } from './heroes-harness';
import { fakeAudio, stubAudioGlobals } from './fake-audio';

// BUG-12 (owner): the music between the REMIX title ('title') and the CLASSIC title (the demo's
// 'overworld') joins smoothly, through the music fade, never a hard cut. The real AudioManager
// on a fake AudioContext.

useStorage();
beforeEach(() => {
  vi.useFakeTimers();
  stubAudioGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup(reduceFlashing = false) {
  const a = fakeAudio();
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const h = makeGame({
    deps: {
      ctx: { assets, audio: a.audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing },
      settings: defaultSettings(),
      applySettings: () => {},
    },
  });
  const plays = vi.spyOn(a.seq(), 'play');
  const sfx = vi.spyOn(a.audio, 'sfx');
  /** The REMIX title, finished, its theme playing. */
  const remix = () => {
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 2);
    expect(a.current()).toBe('title');
  };
  /** CLASSIC from the REMIX title's menu, its smash (if any) over, the overworld playing. */
  const classic = () => {
    remix();
    h.game.showClassicTitle();
    h.idle(SMASH.end + 2);
    vi.advanceTimersByTime(1000);
    expect(a.current()).toBe('overworld');
  };
  const now = () => a.ctx().currentTime;
  return { ...a, h, plays, sfx, remix, classic, now };
}

describe('BUG-12 REMIX to CLASSIC with the smash', () => {
  it('the theme fades out over the fall, ending just before impact', () => {
    expect(TITLE_MUSIC.fallOut).toBeLessThan(SMASH.drop / 60);
    expect(TITLE_MUSIC.fallOut).toBeGreaterThanOrEqual((SMASH.drop - 2) / 60);
    const s = setup();
    s.remix();
    s.sfx.mockClear();
    s.h.game.showClassicTitle();
    expect(s.fade().calls.at(-1)).toBe(`ramp 0@${s.now() + TITLE_MUSIC.fallOut}`);
    // Through the fall, the theme fading and no overworld yet.
    s.h.idle(SMASH.drop - 1);
    expect(s.current()).toBe('title');
    expect(s.sfx).not.toHaveBeenCalledWith('stamp');
    // The impact frame: the overworld starts with a short rise, the smash on top of it.
    s.h.idle(1);
    expect(s.current()).toBe('overworld');
    expect(s.sfx).toHaveBeenCalledWith('stamp');
    expect(s.fade().calls.slice(-2)).toEqual([
      `set 0@${s.now()}`,
      `ramp 1@${s.now() + TITLE_MUSIC.impactIn}`,
    ]);
    expect(TITLE_MUSIC.impactIn).toBeCloseTo(0.2);
  });

  it('a press mid-fall starts the overworld at once; BACK mid-fall brings the theme back up', () => {
    const s = setup();
    s.remix();
    s.h.game.showClassicTitle();
    s.h.idle(4);
    s.h.tap('jump'); // OK: the Start box, the smash cut short
    expect(s.current()).toBe('overworld');
    expect(s.fade().calls.at(-1)).toBe(`ramp 1@${s.now() + TITLE_MUSIC.impactIn}`);

    const b = setup();
    b.remix();
    const started = b.plays.mock.calls.length;
    b.h.game.showClassicTitle();
    b.h.idle(4);
    b.h.tap('attack'); // BACK before the impact
    expect(b.h.top()).toBeInstanceOf(TitleScene);
    expect(b.current()).toBe('title');
    // The theme was never stopped: it just rises back from where its fade had got to.
    expect(b.plays.mock.calls.length).toBe(started);
    expect(b.fade().calls.at(-1)).toMatch(/^ramp 1@/);
    vi.advanceTimersByTime(2000);
    b.h.idle(SMASH.end);
    expect(b.current()).toBe('title');
    expect(b.plays.mock.calls.length).toBe(started);
  });
});

describe('BUG-12 REMIX to CLASSIC with Reduce flashing (no smash)', () => {
  it('a plain crossfade: the theme out over 0.4 s, then the overworld rises', () => {
    const s = setup(true);
    s.remix();
    s.h.game.showClassicTitle();
    expect(s.fade().calls.at(-1)).toBe(`ramp 0@${s.now() + TITLE_MUSIC.crossOut}`);
    vi.advanceTimersByTime(TITLE_MUSIC.crossOut * 1000 - 10);
    expect(s.current()).toBe('title');
    vi.advanceTimersByTime(10);
    expect(s.current()).toBe('overworld');
    expect(s.fade().calls.slice(-2)).toEqual([`set 0@${s.now()}`, `ramp 1@${s.now() + TITLE_MUSIC.crossIn}`]);
    expect(TITLE_MUSIC.crossOut).toBeCloseTo(0.4);
  });

  it('BACK mid-crossfade: the theme comes back up, and the overworld never follows', () => {
    const s = setup(true);
    s.remix();
    const started = s.plays.mock.calls.length;
    s.h.game.showClassicTitle();
    vi.advanceTimersByTime(100);
    s.h.tap('attack');
    expect(s.h.top()).toBeInstanceOf(TitleScene);
    vi.advanceTimersByTime(2000);
    expect(s.current()).toBe('title');
    expect(s.plays.mock.calls.length).toBe(started);
    expect(s.fade().calls.at(-1)).toMatch(/^ramp 1@/);
  });
});

describe('BUG-12 CLASSIC to REMIX (Back)', () => {
  it('the overworld fades out over 0.4 s, then the theme rises with its usual fade-in', () => {
    const s = setup();
    s.classic();
    s.h.tap('attack'); // BACK on the demo
    const title = s.h.top() as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(s.fade().calls.at(-1)).toBe(`ramp 0@${s.now() + TITLE_MUSIC.backOut}`);
    vi.advanceTimersByTime(TITLE_MUSIC.backOut * 1000 - 10);
    expect(s.current()).toBe('overworld');
    vi.advanceTimersByTime(10);
    expect(s.current()).toBe('title');
    expect(s.fade().calls.slice(-2)).toEqual([`set 0@${s.now()}`, `ramp 1@${s.now() + MUSIC_FADE_IN_S}`]);
    // The drop waits for the fade-out, so its stamp still lands on the theme's fanfare.
    s.sfx.mockClear();
    s.h.idle(TITLE_TIMING.dropStamp);
    expect(s.sfx).not.toHaveBeenCalledWith('stamp');
    s.h.idle(Math.round(TITLE_MUSIC.backOut * 60) + 1);
    expect(s.sfx).toHaveBeenCalledWith('stamp');
  });

  it('pressing through the fade-out never leaves the music silent or two songs going', () => {
    const s = setup();
    s.classic();
    s.h.tap('attack');
    s.h.tap('jump'); // the drop finished at once, mid fade-out
    vi.advanceTimersByTime(100);
    s.h.game.showClassicTitle(); // straight back to CLASSIC (no smash yet: the theme still fading)
    vi.advanceTimersByTime(3000);
    s.h.idle(SMASH.end + 2);
    expect(s.current()).toBe('overworld');
    expect(s.fade().calls.at(-1)).toMatch(/^ramp 1@/);
  });

  it('mute and the volume sliders still work mid-fade', () => {
    const s = setup();
    s.classic();
    s.audio.setVolumes({ master: 0.6, music: 0.4 });
    s.h.tap('attack');
    s.audio.setVolumes({ muted: true });
    expect(s.apu().master.gain.value).toBe(0);
    s.audio.setVolumes({ muted: false, music: 0.8 });
    expect(s.apu().musicGain.gain.value).toBe(0.8);
    expect(s.apu().master.gain.value).toBeCloseTo(0.3);
    vi.advanceTimersByTime(1000);
    expect(s.current()).toBe('title');
    expect(s.apu().musicGain.gain.value).toBe(0.8);
  });
});

describe('BUG-12 the CLASSIC boxes over the demo keep the overworld going', () => {
  it('Start, the map set box, Options and its pages, their Backs and the CLASSIC menu: no restart, no cut', () => {
    const s = setup();
    s.classic();
    const started = s.plays.mock.calls.length;
    const fades = () => s.fade().calls.filter((c) => c.startsWith('ramp 0@')).length;
    const faded = fades();
    const g = s.h.game;
    s.h.tap('jump'); // the Start box
    const title = s.h.top() as ClassicTitleScene;
    title.items[0]?.select?.(); // Start: the map set box
    expect(s.h.top()).toBeInstanceOf(ClassicMenuScene);
    s.h.idle(30);
    // B-L: a set's file box over it, and back; then the Start box's Options.
    const sets = s.h.top() as unknown as { items: MenuItem[] };
    sets.items[0]?.select?.();
    s.h.idle(5);
    g.scenes.pop();
    title.items[1]?.select?.();
    expect(s.h.top()).toBeInstanceOf(ClassicOptionsScene);
    const opts = s.h.top() as ClassicOptionsScene;
    // Each sub-page that opens a page of rows, and back.
    for (const it of (opts as unknown as { items: MenuItem[] }).items) {
      if (it.label === 'Back' || it.adjust) continue;
      const depth = g.scenes.depth;
      it.select?.();
      s.h.idle(5);
      while (g.scenes.depth > depth) g.scenes.pop();
    }
    g.scenes.pop(); // Options closed
    s.h.tap('attack'); // the map set box's BACK: the Start box
    s.h.idle(8);
    expect(s.h.top()).toBeInstanceOf(ClassicTitleScene);
    // The CLASSIC menu as a run or a select comes back to it, and the CLASSIC title's Start box.
    g.showClassicMenu();
    s.h.idle(10);
    g.showClassicTitle('start');
    s.h.idle(10);
    vi.advanceTimersByTime(2000);
    expect(s.current()).toBe('overworld');
    expect(s.plays.mock.calls.length).toBe(started);
    expect(fades()).toBe(faded);
  });

  it('MAIN MENU after a game over: the overworld starts once, at full level', () => {
    const s = setup();
    s.classic();
    s.audio.playJingle('game-over');
    const started = s.plays.mock.calls.length;
    s.h.game.showClassicMenu();
    expect(s.current()).toBe('overworld');
    expect(s.plays.mock.calls.length).toBe(started + 1);
    expect(s.fade().calls.at(-1)).toMatch(/^set 1@/);
    s.h.idle(30);
    vi.advanceTimersByTime(2000);
    expect(s.plays.mock.calls.length).toBe(started + 1);
  });
});
