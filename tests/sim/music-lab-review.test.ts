import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { defaultSettings } from '@engine/save/settings';
import { adoptDataEpoch } from '@engine/save/storage';
import { encodeShare } from '@engine/share';
import type { MusicLabScene } from '@game/scenes/music-lab';
import { questionAnswers } from '@game/scenes/music-lab';
import { ONLINE_TOO_BIG } from '@game/scenes/save-data';
import { MAX_SONG_CHARS, SONG_LIBRARY_KEY } from '@game/music-lab/library';
import { makeGame, store, useStorage } from './heroes-harness';
import { fakeAudio, stubAudioGlobals } from './fake-audio';

/*
 * The break-it review of Music Lab (v0.4.77), tests first: what the scene does with hostile or
 * odd links, leaving while a song plays, the tab going to the background, and its questions.
 */

useStorage();
let docListeners: Map<string, Set<() => void>>;
let visibility = 'visible';
beforeEach(() => {
  vi.useFakeTimers();
  stubAudioGlobals();
  docListeners = new Map();
  visibility = 'visible';
  // A document that keeps its listeners, so the tab can "go to the background".
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (t: string, f: () => void) => {
      if (!docListeners.has(t)) docListeners.set(t, new Set());
      docListeners.get(t)?.add(f);
    },
    removeEventListener: (t: string, f: () => void) => docListeners.get(t)?.delete(f),
    createElement: () => ({ setAttribute() {}, play: () => Promise.resolve(), getContext: () => null }),
  });
  adoptDataEpoch();
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
  return { ...a, h };
}

const lab = (s: ReturnType<typeof setup>) => s.h.top() as MusicLabScene;
const hide = () => {
  visibility = 'hidden';
  for (const f of docListeners.get('visibilitychange') ?? []) f();
};

describe('leaving and the background', () => {
  it('leaving Music Lab while a song plays stops it at once', () => {
    const s = setup();
    s.h.game.openMusicLab();
    const l = lab(s);
    l.play();
    expect(s.seq().playing?.id).toBe('music-lab');
    s.h.game.showTitle();
    expect(l.playing).toBeNull();
    expect(s.seq().playing?.id).not.toBe('music-lab');
  });

  it('the tab going to the background stops the song; leaving removes the listener', () => {
    const s = setup();
    // The AudioManager keeps its own listener: count only the lab's.
    const before = docListeners.get('visibilitychange')?.size ?? 0;
    s.h.game.openMusicLab();
    expect(docListeners.get('visibilitychange')?.size).toBe(before + 1);
    const l = lab(s);
    l.play();
    hide();
    expect(l.playing).toBeNull();
    expect(s.seq().playing).toBeNull();
    s.h.game.showTitle();
    expect(docListeners.get('visibilitychange')?.size ?? 0).toBe(before);
  });
});

describe('questions', () => {
  it('Clear song library: NO is the first answer and selected; adding a shared song: Add first, selected', () => {
    expect(questionAnswers('clear').map(([w]) => w)).toEqual(['no', 'yes']);
    expect(questionAnswers('add').map(([w]) => w)).toEqual(['yes', 'no']);
  });

  it('the shared-song question selects Add, said', async () => {
    vi.useRealTimers();
    const s = setup();
    await s.h.game.openSharedSong(await encodeShare('title: Tune\npulse1: c'));
    expect(lab(s).question).toMatchObject({ kind: 'add', selected: 'yes' });
    expect(s.h.said.at(-1)).toMatch(/Add it to your songs\? Yes is selected\./);
  });

  it('while a question is open the song text cannot change from the box', () => {
    store.set(SONG_LIBRARY_KEY, '{nope');
    const s = setup();
    s.h.game.openMusicLab();
    const l = lab(s);
    const before = l.text;
    l.askClearLibrary();
    l.edit('pulse1: c', true);
    expect(l.text).toBe(before);
    l.answer(false);
    l.edit('pulse1: c', true);
    expect(l.text).toBe('pulse1: c');
  });

  it('a newer library says so, and suggests updating the game, apart from the damaged wording', () => {
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 3, songs: {} }));
    const s = setup();
    s.h.game.openMusicLab();
    expect(lab(s).libraryProblem).toBe('newer');
    expect(s.h.said.join(' ')).toMatch(/newer version.*update the game/i);
    expect(s.h.said.join(' ')).not.toMatch(/damaged/i);
    lab(s).askClearLibrary();
    expect(lab(s).question).toMatchObject({ kind: 'clear', selected: 'no' });
    expect(lab(s).question?.text).toMatch(/newer version/);
  });
});

describe('hostile and odd links', () => {
  it('shared text longer than a song may be is refused before parsing', async () => {
    vi.useRealTimers();
    const s = setup();
    await s.h.game.openSharedSong(await encodeShare('pulse1: ' + 'c '.repeat(MAX_SONG_CHARS)));
    expect(lab(s).question).toBeNull();
    expect(lab(s).text).not.toContain('c c c c c c c c c c c c');
    expect(s.h.said.join(' ')).toMatch(/too long/i);
  });

  it('the hostile repeat link opens without hanging, its error shown', async () => {
    vi.useRealTimers();
    const s = setup();
    const t0 = Date.now();
    await s.h.game.openSharedSong('rcHVsc2UxOiBbW1tbYzY0XTk5XTk5XTk5XTk5');
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(lab(s).text).toBe('pulse1: [[[[c64]99]99]99]99');
    expect(lab(s).error?.message).toMatch(/too long/);
  });

  it('a shared song with an error still takes its name from its title line', async () => {
    vi.useRealTimers();
    const s = setup();
    await s.h.game.openSharedSong(await encodeShare('title: Rough cut\npulse1: c z'));
    expect(lab(s).name).toBe('Rough cut');
  });
});

describe('Save data', () => {
  it('the online backup’s too-big message names Music Lab songs as well as custom levels', () => {
    expect(ONLINE_TOO_BIG).toMatch(/custom levels or Music Lab songs/);
  });
});
