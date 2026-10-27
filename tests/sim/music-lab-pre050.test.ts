import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { getLevel } from '@content/levels';
import { Announcer } from '@engine/a11y/announcer';
import { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { defaultSettings } from '@engine/save/settings';
import { adoptDataEpoch } from '@engine/save/storage';
import { MAX_LEVEL_LINK_BYTES, encodeShare } from '@engine/share';
import { serializeTextMap } from '@game/level/textmap';
import { LEAVE_EDITOR_HELP, MusicLabScene } from '@game/scenes/music-lab';
import { MAX_SONG_CHARS } from '@game/music-lab/library';
import { makeGame, useStorage } from './heroes-harness';
import { Param, fakeAudio, stubAudioGlobals } from './fake-audio';

/*
 * Pre-0.5.0 PR 1 (Music Lab and share-link hardening), tests first: Play with extreme notes and
 * slides (256), the song-link cap kept (257), level links capped and real levels still opening,
 * every line said when several come at once (259), how to leave the editor (261), and loading a
 * game song over unsaved changes (268).
 */

useStorage();
beforeEach(() => {
  vi.useFakeTimers();
  stubAudioGlobals();
  adoptDataEpoch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(announcer?: Announcer) {
  const a = fakeAudio();
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const h = makeGame({
    deps: {
      ctx: { assets, audio: a.audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      settings: defaultSettings(),
      applySettings: () => {},
      ...(announcer ? { announcer } : {}),
    },
  });
  return { ...a, h };
}
const lab = (s: ReturnType<typeof setup>) => s.h.top() as MusicLabScene;

/** The synth refuses a non-finite value, as Web Audio's AudioParam does (TypeError). */
function strictParams(): void {
  const set = Param.prototype.setValueAtTime;
  const ramp = Param.prototype.linearRampToValueAtTime;
  vi.spyOn(Param.prototype, 'setValueAtTime').mockImplementation(function (this: Param, v, t) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError('non-finite value');
    set.call(this, v, t);
  });
  vi.spyOn(Param.prototype, 'linearRampToValueAtTime').mockImplementation(function (this: Param, v, t) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError('non-finite value');
    ramp.call(this, v, t);
  });
}

describe('256: Play with extreme notes or slides never throws', () => {
  for (const [what, text] of [
    ['a huge slide', 'pulse1: p99999 c4 c4'],
    ['a stacked sharp run', `pulse1: c${'+'.repeat(19_000)} c4`],
    ['a deep flat run', `pulse1: o0 c${'-'.repeat(5_000)} c4`],
    ['a slide on the triangle', 'triangle: p-99999 c4'],
  ] as const)
    it(`${what}: an error at the spot, nothing sent to the synth`, () => {
      const s = setup();
      s.h.game.openMusicLab();
      strictParams();
      lab(s).edit(text);
      expect(() => {
        lab(s).play();
        vi.advanceTimersByTime(3000);
      }).not.toThrow();
      expect(lab(s).playing).toBeNull();
      expect(lab(s).error?.message).toMatch(/note|slide/);
    });

  it('the ends of the range play', () => {
    const s = setup();
    s.h.game.openMusicLab();
    strictParams();
    lab(s).edit('pulse1: o8 g+++++++ p96 c p-96 c o0 c-');
    expect(() => {
      lab(s).play();
      vi.advanceTimersByTime(3000);
    }).not.toThrow();
    expect(lab(s).error).toBeNull();
  });
});

describe('257: a song link is inflated only up to its cap', () => {
  it('a link that inflates far past a song is refused as unreadable, never inflated whole', async () => {
    vi.useRealTimers();
    const s = setup();
    // Ten million zeros: about 10 KB of link. Inflated uncapped it would be read, then called too long.
    const code = await encodeShare('0'.repeat(10_000_000));
    const RealDS = globalThis.DecompressionStream;
    let fed = 0;
    class CountingDS {
      readonly readable: ReadableStream<Uint8Array>;
      readonly writable: WritableStream<BufferSource>;
      constructor(f: CompressionFormat) {
        const real = new RealDS(f);
        const tap = new TransformStream<BufferSource, BufferSource>({
          transform(chunk, c) {
            fed += (chunk as ArrayBufferView).byteLength;
            c.enqueue(chunk);
          },
        });
        void tap.readable.pipeTo(real.writable as WritableStream<BufferSource>).catch(() => {});
        this.readable = real.readable as ReadableStream<Uint8Array>;
        this.writable = tap.writable;
      }
    }
    vi.stubGlobal('DecompressionStream', CountingDS);
    await s.h.game.openSharedSong(code);
    expect(lab(s)).toBeInstanceOf(MusicLabScene);
    expect(s.h.said.join(' ')).toMatch(/song link could not be read/i);
    expect(s.h.said.join(' ')).not.toMatch(/too long to open/i);
    expect(fed).toBeLessThan(((code.length - 1) * 3) / 4 - 1024);
    expect(MAX_SONG_CHARS * 4).toBeLessThan(10_000_000);
  });
});

describe('255 (review): the 71-character link of zeros after ]', () => {
  it('opens fast, its error shown', async () => {
    vi.useRealTimers();
    const s = setup();
    const code = await encodeShare('pulse1:[c]' + '0'.repeat(19_000) + '99999');
    expect(code.length).toBeLessThan(100);
    const t0 = Date.now();
    await s.h.game.openSharedSong(code);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(lab(s).error?.message).toMatch(/too long to read/);
  });
});

describe('285: the 81-character link of a million notes', () => {
  const bomb = ['pulse1', 'pulse2', 'triangle']
    .map((ch) => `${ch}:[${'c'.repeat(440)}]560\n`)
    .concat(`noise:[${'k'.repeat(440)}]560\n`)
    .join('');

  it('opens fast, "too many notes" shown and said; Play is refused fast too', async () => {
    vi.useRealTimers();
    const s = setup();
    const code = await encodeShare(bomb);
    expect(code.length).toBeLessThan(100);
    let t0 = Date.now();
    await s.h.game.openSharedSong(code);
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(lab(s).error?.message).toMatch(/too many notes/);
    expect(s.h.said.join(' ')).toMatch(/too many notes/);
    lab(s).answer(false);
    t0 = Date.now();
    lab(s).play();
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(lab(s).playing).toBeNull();
    expect(s.h.said.at(-1)).toMatch(/too many notes/);
  });
});

describe('level links: capped, real levels still open', () => {
  it('the largest built-in level opens from its link', async () => {
    vi.useRealTimers();
    const s = setup();
    const play = vi.spyOn(s.h.game, 'playShared').mockImplementation(() => {});
    const text = serializeTextMap(getLevel('ll-5-1'));
    await s.h.game.openSharedLevel(await encodeShare(text));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0]?.[0].width).toBe(getLevel('ll-5-1').width);
  });

  it('an editor level at the widest (1024 tiles) opens from its link', async () => {
    vi.useRealTimers();
    const s = setup();
    const play = vi.spyOn(s.h.game, 'playShared').mockImplementation(() => {});
    const base = getLevel('8-5');
    const w = 1024;
    const tiles = new Uint16Array(w * base.height);
    for (let y = 0; y < base.height; y++)
      for (let x = 0; x < w; x++) tiles[y * w + x] = base.tiles[y * base.width + (x % base.width)] as number;
    const entities = [];
    for (let k = 0; k * base.width < w; k++)
      for (const e of base.entities)
        if (e.x + k * base.width < w) entities.push({ ...e, x: e.x + k * base.width });
    const text = serializeTextMap({ ...base, width: w, tiles, entities, decor: [] });
    expect(text.length).toBeLessThan(MAX_LEVEL_LINK_BYTES / 20);
    await s.h.game.openSharedLevel(await encodeShare(text));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0]?.[0].width).toBe(1024);
  });

  it('a link that inflates past the cap is refused; nothing is played', async () => {
    vi.useRealTimers();
    const s = setup();
    const play = vi.spyOn(s.h.game, 'playShared').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await s.h.game.openSharedLevel(await encodeShare('0'.repeat(MAX_LEVEL_LINK_BYTES + 1)));
    expect(play).not.toHaveBeenCalled();
    expect(warn.mock.calls.join(' ')).toMatch(/too big/);
  });
});

describe('259: several lines at once are all said', () => {
  /** A real Announcer on a stand-in live region, frames run by hand. */
  function live() {
    const el = { textContent: '' };
    let frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => {
      frames.push(f);
      return frames.length;
    });
    const frame = (): string => {
      const run = frames;
      frames = [];
      for (const f of run) f();
      return el.textContent;
    };
    return { announcer: new Announcer(el as unknown as HTMLElement), frame };
  }

  it('a shared link: the intro, its error and the add question are all heard', async () => {
    vi.useRealTimers();
    const l = live();
    const s = setup(l.announcer);
    l.frame();
    await s.h.game.openSharedSong(await encodeShare('title: Tune\npulse1: c q9 d'));
    const heard = l.frame();
    expect(heard).toMatch(/^Music Lab\./);
    expect(heard).toMatch(/Line 2, column \d+: pulse1: gate 1-8 expected\./);
    expect(heard).toMatch(/Add it to your songs\? Yes is selected\.$/);
  });

  it('Tempo on a game song: "now your copy" and the tempo are both heard', () => {
    const l = live();
    const s = setup(l.announcer);
    s.h.game.openMusicLab();
    lab(s).loadExample('overworld');
    l.frame();
    lab(s).setTempo(lab(s).tempo + 4);
    const heard = l.frame();
    expect(heard).toMatch(/this is now your copy/);
    expect(heard).toMatch(/Tempo \d+\.$/);
  });

  it('Loop on a game song while it plays: the copy, and the loop', () => {
    const l = live();
    const s = setup(l.announcer);
    s.h.game.openMusicLab();
    lab(s).loadExample('overworld');
    lab(s).play();
    l.frame();
    lab(s).toggleLoop();
    const heard = l.frame();
    expect(heard).toMatch(/this is now your copy/);
    expect(heard).toMatch(/Loop (on|off)/);
  });

  it('the tab hidden (frames paused), then back: the next line is not run onto the old ones', () => {
    const l = live();
    const listeners = new Map<string, () => void>();
    let state = 'visible';
    vi.stubGlobal('document', {
      get visibilityState() {
        return state;
      },
      addEventListener: (t: string, f: () => void) => listeners.set(t, f),
      removeEventListener: () => {},
    });
    const s = setup(l.announcer);
    s.h.game.openMusicLab();
    l.frame();
    lab(s).toggleLoop();
    state = 'hidden';
    listeners.get('visibilitychange')?.();
    state = 'visible';
    listeners.get('visibilitychange')?.();
    lab(s).toggleLoop();
    expect(l.frame()).toBe('Loop on.');
  });

  it('a line in a later frame is said on its own', () => {
    const l = live();
    const s = setup(l.announcer);
    s.h.game.openMusicLab();
    lab(s).play();
    l.frame();
    lab(s).stop();
    expect(l.frame()).toBe('Stopped.');
  });
});

describe('261: how to leave the song text', () => {
  it('Escape then Tab, or Shift+Tab', () => {
    expect(LEAVE_EDITOR_HELP).toMatch(/Escape, then Tab/);
    expect(LEAVE_EDITOR_HELP).toMatch(/Shift\+Tab/);
    expect(LEAVE_EDITOR_HELP).toMatch(/two spaces/);
  });
});

describe('268: loading a game song asks before dropping unsaved changes', () => {
  it('unsaved changes: the first Load asks, the second loads', () => {
    const s = setup();
    s.h.game.openMusicLab();
    const l = lab(s);
    l.edit(l.text.replace('e g a g', 'e g a a'));
    const mine = l.text;
    l.loadExample('overworld');
    expect(l.text).toBe(mine);
    expect(l.example).toBeNull();
    expect(s.h.said.at(-1)).toMatch(/unsaved changes/);
    l.loadExample('overworld');
    expect(l.example).toBe('overworld');
    expect(l.text).not.toBe(mine);
  });

  it('no unsaved changes (a saved song, or another game song): loads at once', () => {
    const s = setup();
    s.h.game.openMusicLab();
    const l = lab(s);
    l.loadExample('overworld');
    expect(l.example).toBe('overworld');
    l.loadExample('castle');
    expect(l.example).toBe('castle');
  });

  it('asking for one game song, then loading another, still asks again', () => {
    const s = setup();
    s.h.game.openMusicLab();
    const l = lab(s);
    l.edit(l.text.replace('e g a g', 'e g a a'));
    l.loadExample('overworld');
    l.loadExample('castle');
    expect(l.example).toBeNull();
    l.loadExample('castle');
    expect(l.example).toBe('castle');
  });
});
