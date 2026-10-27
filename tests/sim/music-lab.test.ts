import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { defaultSettings } from '@engine/save/settings';
import { adoptDataEpoch } from '@engine/save/storage';
import { decodeShare, encodeShare, songCode, songLink } from '@engine/share';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { MusicLabScene } from '@game/scenes/music-lab';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { SONG_LIBRARY_KEY, loadSongs, saveSong } from '@game/music-lab/library';
import { NEW_SONG, SYNTAX_HELP } from '@game/music-lab/song-doc';
import { makeGame, store, useStorage } from './heroes-harness';
import { fakeAudio, stubAudioGlobals } from './fake-audio';

/*
 * MUSIC LAB (owner items 136, 224, 225): opened from the title's Options beside the Level editor,
 * playing on the real AudioManager over a fake AudioContext, share links, and clearing a library
 * this build cannot read (the question spoken, NO first).
 */

useStorage();
beforeEach(() => {
  vi.useFakeTimers();
  stubAudioGlobals();
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
type S = ReturnType<typeof setup>;

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);

function pick(s: S, label: string): void {
  s.h.idle(8);
  const row = labels(s.h.top()).indexOf(label);
  expect(row, `${label} in ${labels(s.h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let n = 0; (s.h.top() as unknown as { index: number }).index !== row && n < 40; n++) s.h.tap('down');
  s.h.tap('jump');
}

function openLab(s: S): MusicLabScene {
  s.h.game.showTitle();
  s.h.idle(TITLE_TIMING.dropEnd + 10);
  expect(s.h.top()).toBeInstanceOf(TitleScene);
  pick(s, 'Options');
  pick(s, 'Music Lab');
  expect(s.h.top()).toBeInstanceOf(MusicLabScene);
  return s.h.top() as MusicLabScene;
}

describe('opening Music Lab', () => {
  it('the title’s Options lists it right after Level editor; it opens, said, music stopped', () => {
    const s = setup();
    const lab = openLab(s);
    expect(s.h.game.scenes.depth).toBe(1);
    expect(s.h.said.at(-1)).toContain('Music Lab');
    expect(s.seq().playing).toBeNull();
    expect(lab.text).toBe(NEW_SONG);
    const o = labels(new OptionsScene(s.h.game, () => {}));
    expect(o.indexOf('Music Lab')).toBe(o.indexOf('Level editor') + 1);
  });

  it('is never offered in a pause’s Options or in Classic’s (as the Level editor)', () => {
    const s = setup();
    for (const o of [
      new OptionsScene(s.h.game, () => {}, true),
      new OptionsScene(s.h.game, () => {}, false, true),
      new OptionsScene(s.h.game, () => {}, true, true),
    ])
      expect(labels(o)).not.toContain('Music Lab');
  });

  it('Back goes to the title; with unsaved changes it asks for a second press', () => {
    const s = setup();
    const lab = openLab(s);
    lab.edit(lab.text.replace('e g a g', 'e g a a'));
    lab.back();
    expect(s.h.top()).toBe(lab);
    expect(s.h.said.at(-1)).toMatch(/unsaved changes/);
    lab.back();
    expect(s.h.top()).toBeInstanceOf(TitleScene);
  });
});

describe('play and stop drive the synth', () => {
  it('Play sends the song’s notes to the four voices; Stop silences them', () => {
    const s = setup();
    const lab = openLab(s);
    const plays = vi.spyOn(s.seq(), 'play');
    const notes = vi.spyOn(s.apu().voices.pulse1, 'note');
    const drums = vi.spyOn(s.apu().voices.noise, 'note');
    lab.play();
    expect(plays).toHaveBeenCalledTimes(1);
    const song = s.seq().playing;
    expect(song?.bpm).toBe(132);
    expect(Object.keys(song?.tracks ?? {}).sort()).toEqual(['noise', 'pulse1', 'pulse2', 'triangle']);
    vi.advanceTimersByTime(100);
    expect(notes).toHaveBeenCalled();
    expect(drums).toHaveBeenCalled();
    expect(s.h.said.at(-1)).toMatch(/Playing at tempo 132/);
    lab.stop();
    expect(s.seq().playing).toBeNull();
    expect(s.h.said.at(-1)).toBe('Stopped.');
  });

  it('a song with an error is not played: the error is said with its line and column', () => {
    const s = setup();
    const lab = openLab(s);
    lab.edit('pulse1:\n  c d q9 e');
    lab.play();
    expect(s.seq().playing).toBeNull();
    expect(s.h.said.at(-1)).toBe('Line 2, column 7: pulse1: gate 1-8 expected.');
    expect(lab.error).toMatchObject({ line: 2, col: 7 });
  });

  it('tempo restarts the song at the new speed; loop changes the song as it plays', () => {
    const s = setup();
    const lab = openLab(s);
    lab.play();
    lab.setTempo(lab.tempo + 4);
    expect(s.seq().playing?.bpm).toBe(136);
    expect(lab.text).toContain('tempo: 136');
    lab.toggleLoop();
    expect(s.seq().playing?.loop).toBe(false);
    expect(lab.text).toContain('loop: off');
  });

  it('a song that does not loop ends by itself, said', () => {
    const s = setup();
    const lab = openLab(s);
    lab.edit('tempo: 300\nloop: off\npulse1: c16');
    lab.play();
    for (let i = 0; i < 20; i++) {
      s.ctx().currentTime += 0.1;
      vi.advanceTimersByTime(25);
    }
    expect(lab.playing).toBeNull();
    expect(s.h.said.at(-1)).toBe('The song ended.');
  });
});

describe('the library from Music Lab', () => {
  it('an example is read-only: the first edit makes a copy, which saves under its own name', () => {
    const s = setup();
    const lab = openLab(s);
    lab.loadExample('overworld');
    expect(lab.example).toBe('overworld');
    lab.edit(lab.text.replace('tempo: 168', 'tempo: 150'));
    expect(lab.example).toBeNull();
    expect(lab.name).toBe('overworld copy');
    lab.save();
    expect(Object.keys(loadSongs().songs)).toEqual(['overworld copy']);
  });

  it('save, rename, open, delete (a second press to delete)', () => {
    const s = setup();
    const lab = openLab(s);
    lab.name = 'Tune';
    lab.save();
    lab.name = 'Better';
    lab.rename();
    expect(Object.keys(loadSongs().songs)).toEqual(['Better']);
    lab.newSong();
    lab.open('Better');
    expect(lab.libraryName).toBe('Better');
    lab.remove('Better');
    expect(Object.keys(loadSongs().songs)).toEqual(['Better']);
    lab.remove('Better');
    expect(loadSongs().songs).toEqual({});
  });
});

describe('item 225: a library this build cannot read can be cleared from Music Lab', () => {
  it('on opening, says so; Clear song library asks, NO selected first; NO keeps it', () => {
    store.set(SONG_LIBRARY_KEY, '{damaged');
    const s = setup();
    const lab = openLab(s);
    expect(lab.libraryProblem).toBe('damaged');
    expect(s.h.said.join(' ')).toMatch(/song library is damaged/i);
    lab.askClearLibrary();
    expect(lab.question).toMatchObject({ kind: 'clear', selected: 'no' });
    expect(s.h.said.at(-1)).toMatch(/Clear the song library\?.*No is selected/);
    lab.answer(false);
    expect(lab.question).toBeNull();
    expect(store.get(SONG_LIBRARY_KEY)).toBe('{damaged');
  });

  it('YES clears it; saving works again', () => {
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 2, songs: {} }));
    const s = setup();
    const lab = openLab(s);
    lab.askClearLibrary();
    lab.answer(true);
    expect(store.has(SONG_LIBRARY_KEY)).toBe(false);
    expect(lab.libraryProblem).toBeNull();
    expect(s.h.said.at(-1)).toMatch(/cleared/i);
    lab.name = 'Fresh';
    lab.save();
    expect(Object.keys(loadSongs().songs)).toEqual(['Fresh']);
  });

  it('a readable library is never offered for clearing (a single damaged entry is skipped)', () => {
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { Good: 'pulse1: c', Bad: 4 } }));
    const s = setup();
    const lab = openLab(s);
    expect(lab.libraryProblem).toBeNull();
    lab.askClearLibrary();
    expect(lab.question).toBeNull();
    expect(Object.keys(loadSongs().songs)).toEqual(['Good']);
  });
});

describe('share links', () => {
  it('round-trip: text to a #song= link and back, offline (no network)', async () => {
    vi.useRealTimers();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const code = await encodeShare(NEW_SONG);
    const url = songLink(code, 'https://example.org/smbc/?dev=1#level=abc');
    expect(url).toBe(`https://example.org/smbc/#song=${code}`);
    expect(songCode(new URL(url).hash)).toBe(code);
    expect(await decodeShare(code)).toBe(NEW_SONG);
    expect(songCode('#level=abc')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opening a link opens Music Lab with the song and offers to add it; YES adds it', async () => {
    vi.useRealTimers();
    const s = setup();
    saveSong('New song', 'pulse1: c');
    const code = await encodeShare(NEW_SONG);
    await s.h.game.openSharedSong(code);
    const lab = s.h.top() as MusicLabScene;
    expect(lab).toBeInstanceOf(MusicLabScene);
    expect(lab.text).toBe(NEW_SONG);
    expect(lab.question).toMatchObject({ kind: 'add', selected: 'yes' });
    expect(s.h.said.join(' ')).toMatch(/shared song.*Add it to your songs\?/i);
    lab.answer(true);
    // Its title is taken: the copy gets a free name, nothing is replaced.
    expect(loadSongs().songs).toEqual({ 'New song': 'pulse1: c', 'New song 2': NEW_SONG });
    expect(lab.libraryName).toBe('New song 2');
  });

  it('NOT NOW leaves the library alone; a broken link opens an empty lab, said', async () => {
    vi.useRealTimers();
    const s = setup();
    await s.h.game.openSharedSong(await encodeShare(NEW_SONG));
    (s.h.top() as MusicLabScene).answer(false);
    expect(loadSongs().songs).toEqual({});
    await s.h.game.openSharedSong('z!!!not-a-code');
    expect(s.h.top()).toBeInstanceOf(MusicLabScene);
    expect(s.h.said.join(' ')).toMatch(/song link could not be read/i);
  });

  it('the syntax help covers every command of the game’s MML', () => {
    const all = SYNTAX_HELP.map((r) => r.join(' ')).join('\n');
    for (const cmd of ['o', 'l', 'v', '@', 'q', 'x', 'p', 'n', 'k s h', '[ ]', 'L', '^', 'r', ';'])
      expect(all, cmd).toContain(cmd);
    for (const part of ['title:', 'tempo:', 'loop:', 'pulse1:', 'pulse2:', 'triangle:', 'noise:'])
      expect(all, part).toContain(part);
  });
});
