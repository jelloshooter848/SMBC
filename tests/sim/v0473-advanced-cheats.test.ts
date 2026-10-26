import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, type AssistSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import {
  classicFileKey,
  eraseClassicFile,
  loadClearedFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
  type ClassicFileRules,
} from '@game/original-files';
import { advancedCheatsKey, advancedUnlocked, ADVANCED_OFF } from '@game/advanced-cheats';
import { REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { LevelScene } from '@game/scenes/level';
import { makeGame, store, useStorage } from './heroes-harness';
import { pickAtContinue } from './continue-select';
import { keepCleared, run } from './cleared-nav';

// v0.4.73 item 60 (owner-approved; rule 33a: the save cases were written before the code).
// Beating a map set on HARD unlocks ADVANCED CHEATS on that file only: every dev Assist, as it
// plays today, for runs of that file and nothing else (no other file, never the campaign).
//
// Where it lives: the CLEARED file (v 2) is written once, at the clear, and never again; the
// unlock is part of that one write (`advancedCheats: true`, the one source). What changes later (the rows' values, and whether its explanation
// box was read) cannot go into the frozen file, so it goes beside it, under
// `smbc-classic-advanced-<set>-<slot>`, tied to that very CLEARED file by a fingerprint of its
// stored text. ERASE FILE removes it; a later clear in the same slot never inherits it.

useStorage();

/** Changes `ref`'s Advanced cheats as a page opened now would (its file read at open). */
function setAdv(
  g: {
    advancedCheatsId(r: ClassicFileRef): string | null;
    setAdvancedCheats(r: ClassicFileRef, id: string, c: object): boolean;
  },
  ref: ClassicFileRef,
  change: object,
): boolean {
  return g.setAdvancedCheats(ref, g.advancedCheatsId(ref) ?? '', change);
}

afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const B: ClassicFileRef = { set: 'smb', slot: 2 };
const C: ClassicFileRef = { set: 'smb', slot: 3 };
const L: ClassicFileRef = { set: 'lost', slot: 1 };
const rulesOn = (difficulty: ClassicFileRules['difficulty']): ClassicFileRules => ({
  ...originalFileRules(),
  difficulty,
});
const hard = (ref: ClassicFileRef, over = {}) => keepCleared(ref, over, rulesOn('hard'));
const ls = () => (globalThis as { localStorage: Record<string, unknown> }).localStorage;

function game(over: (s: Settings) => void = () => {}) {
  const settings: Settings = { ...defaultSettings() };
  over(settings);
  const box: { g?: ReturnType<typeof makeGame>['game'] } = {};
  const h = makeGame({
    deps: {
      settings,
      applySettings: () => {},
      // As main.ts does: the live assists into the shared context.
      applyAssists: () => {
        const g = box.g;
        if (!g) return;
        const { slowMotion: _s, ...a } = g.liveAssists();
        Object.assign(g.ctx.assist, a);
      },
    },
  });
  box.g = h.game;
  return { ...h, settings };
}
const on = (over: Partial<AssistSettings>): AssistSettings => ({ ...ADVANCED_OFF, ...over });

describe('60 (a): the unlock is the file’s, at the clear', () => {
  it('a Hard clear is unlocked (stored in the CLEARED file); Normal and Easy are not', () => {
    hard(A);
    keepCleared(B, {}, rulesOn('normal'));
    keepCleared(C, {}, rulesOn('easy'));
    expect(JSON.parse(store.get(classicFileKey(A))!).advancedCheats).toBe(true);
    expect(JSON.parse(store.get(classicFileKey(B))!).advancedCheats).toBeUndefined();
    expect(advancedUnlocked(loadClearedFile(A)!)).toBe(true);
    expect(advancedUnlocked(loadClearedFile(B)!)).toBe(false);
    expect(advancedUnlocked(loadClearedFile(C)!)).toBe(false);
    const h = game();
    expect(h.game.advancedCheatsOf(A)).toEqual({ seen: false, assist: ADVANCED_OFF });
    expect(h.game.advancedCheatsOf(B)).toBeNull();
    expect(h.game.advancedCheatsOf(C)).toBeNull();
  });

  it('the stored flag is the one source: a Hard CLEARED file without it has none', () => {
    hard(A);
    const raw = JSON.parse(store.get(classicFileKey(A))!);
    delete raw.advancedCheats;
    store.set(classicFileKey(A), JSON.stringify(raw));
    expect(game().game.advancedCheatsOf(A)).toBeNull();
  });

  it('a run on Hard that is not CLEARED unlocks nothing (an empty file, a used one)', () => {
    saveClassicFile({ ...A, rules: rulesOn('hard'), continues: 0, run: run({ levelId: '4-1' }) });
    const h = game();
    expect(h.game.advancedCheatsOf(A)).toBeNull();
    expect(h.game.advancedCheatsOf(B)).toBeNull();
    expect(setAdv(h.game, A, { assist: on({ invulnerable: true }) })).toBe(false);
    expect(store.has(advancedCheatsKey(A))).toBe(false);
  });

  it('a damaged CLEARED file (unreadable) is never unlocked', () => {
    store.set(classicFileKey(A), '{"v":2,"cleared":true,"rules":{"difficulty":"hard"}}');
    expect(game().game.advancedCheatsOf(A)).toBeNull();
  });
});

describe('60: save safety', () => {
  it('the values and the read box survive a reload, and the CLEARED file is never written', () => {
    hard(A);
    const file = store.get(classicFileKey(A));
    const h = game();
    expect(setAdv(h.game, A, { assist: on({ invulnerable: true, coyoteFrames: 4 }) })).toBe(true);
    expect(setAdv(h.game, A, { seen: true })).toBe(true);
    const again = game();
    expect(again.game.advancedCheatsOf(A)).toEqual({
      seen: true,
      assist: on({ invulnerable: true, coyoteFrames: 4 }),
    });
    expect(store.get(classicFileKey(A))).toBe(file);
  });

  it('full sets: every file has its own, and a file’s never reach another', () => {
    for (const ref of [A, B, C, L]) hard(ref, ref === L ? { levelId: 'lost-8-4' } : {});
    const h = game();
    setAdv(h.game, A, { assist: on({ invulnerable: true }) });
    setAdv(h.game, C, { assist: on({ safetyFloor: true }), seen: true });
    expect(h.game.advancedCheatsOf(A)?.assist.invulnerable).toBe(true);
    expect(h.game.advancedCheatsOf(B)).toEqual({ seen: false, assist: ADVANCED_OFF });
    expect(h.game.advancedCheatsOf(C)).toEqual({ seen: true, assist: on({ safetyFloor: true }) });
    expect(h.game.advancedCheatsOf(L)).toEqual({ seen: false, assist: ADVANCED_OFF });
  });

  it('ERASE FILE clears it; a new Hard clear in that slot starts afresh (unread, all off)', () => {
    hard(A);
    const h = game();
    setAdv(h.game, A, { assist: on({ invulnerable: true }), seen: true });
    eraseClassicFile(A);
    expect(store.has(advancedCheatsKey(A))).toBe(false);
    expect(h.game.advancedCheatsOf(A)).toBeNull();
    hard(A, { score: 1 });
    expect(h.game.advancedCheatsOf(A)).toEqual({ seen: false, assist: ADVANCED_OFF });
  });

  it('a left-over entry from an earlier clear of the slot (its erase refused) is never inherited', () => {
    hard(A);
    const h = game();
    setAdv(h.game, A, { assist: on({ invulnerable: true }), seen: true });
    const left = store.get(advancedCheatsKey(A))!;
    eraseClassicFile(A);
    store.set(advancedCheatsKey(A), left);
    hard(A, { score: 2 });
    expect(game().game.advancedCheatsOf(A)).toEqual({ seen: false, assist: ADVANCED_OFF });
  });

  it('a stale tab: the file was erased (or cleared again) elsewhere, its write is refused', () => {
    hard(A);
    const stale = game();
    expect(stale.game.advancedCheatsOf(A)).not.toBeNull();
    // Another tab: ERASE, then a new run of the file.
    eraseClassicFile(A);
    saveClassicFile({ ...A, rules: rulesOn('hard'), continues: 0, run: run({ levelId: '1-1' }) });
    expect(setAdv(stale.game, A, { assist: on({ invulnerable: true }) })).toBe(false);
    expect(store.has(advancedCheatsKey(A))).toBe(false);
    // ... and cleared again on Hard: the stale tab's write goes to the new file only by its own read.
    eraseClassicFile(A);
    hard(A, { score: 3 });
    expect(stale.game.advancedCheatsOf(A)).toEqual({ seen: false, assist: ADVANCED_OFF });
  });

  it('damaged data beside the file: read as all off and unread, and written over', () => {
    hard(A);
    for (const junk of ['{', '"x"', '[]', '{"v":1,"of":5,"assist":"no"}', 'null']) {
      store.set(advancedCheatsKey(A), junk);
      expect(game().game.advancedCheatsOf(A)).toEqual({ seen: false, assist: ADVANCED_OFF });
    }
    expect(setAdv(game().game, A, { seen: true })).toBe(true);
    expect(game().game.advancedCheatsOf(A)?.seen).toBe(true);
  });

  it('each value checked: out-of-range or wrong types read as off', () => {
    hard(A);
    const h = game();
    setAdv(h.game, A, { seen: true });
    const raw = JSON.parse(store.get(advancedCheatsKey(A))!);
    raw.assist = { invulnerable: 'yes', coyoteFrames: 99, slowMotion: 7, safetyFloor: true };
    store.set(advancedCheatsKey(A), JSON.stringify(raw));
    expect(game().game.advancedCheatsOf(A)?.assist).toEqual(on({ safetyFloor: true }));
  });

  it('newer-format data (a later version’s): kept as it is, never written, nothing on, no box', () => {
    hard(A);
    const newer = JSON.stringify({ v: 2, of: 'x', future: true });
    store.set(advancedCheatsKey(A), newer);
    const h = game();
    expect(h.game.advancedCheatsOf(A)).toEqual({ seen: true, assist: ADVANCED_OFF });
    expect(setAdv(h.game, A, { assist: on({ invulnerable: true }) })).toBe(false);
    expect(store.get(advancedCheatsKey(A))).toBe(newer);
  });

  it('a downgrade: an older version ignores the entry; back on this one it reads as before', () => {
    hard(A);
    setAdv(game().game, A, { assist: on({ infiniteTime: true }), seen: true });
    const kept = store.get(advancedCheatsKey(A));
    // (v0.4.73 reads the CLEARED file without the field and never writes it or the entry.)
    expect(game().game.advancedCheatsOf(A)).toEqual({ seen: true, assist: on({ infiniteTime: true }) });
    expect(store.get(advancedCheatsKey(A))).toBe(kept);
  });

  it('storage refusing writes: false, but the game keeps the change for this session', () => {
    hard(A);
    const h = game();
    const real = ls().setItem as (k: string, v: string) => void;
    ls().setItem = (k: string, v: string) => {
      if (k === advancedCheatsKey(A)) throw new Error('quota');
      real(k, v);
    };
    expect(setAdv(h.game, A, { assist: on({ invulnerable: true }), seen: true })).toBe(false);
    expect(h.game.advancedCheatsOf(A)).toEqual({ seen: true, assist: on({ invulnerable: true }) });
    expect(store.has(advancedCheatsKey(A))).toBe(false);
    // Another session (a reload) has nothing.
    expect(game().game.advancedCheatsOf(A)?.seen).toBe(false);
  });

  it('storage reads throwing: nothing unlocked, nothing written', () => {
    hard(A);
    const h = game();
    ls().getItem = () => {
      throw new Error('blocked');
    };
    expect(h.game.advancedCheatsOf(A)).toBeNull();
    expect(setAdv(h.game, A, { seen: true })).toBe(false);
  });
});

describe('60 (c): it applies only to runs of that file', () => {
  /** A replay of `ref`'s World 1-1 (no boxes: the instructions marked read). */
  function replayOf(h: ReturnType<typeof game>, ref: ClassicFileRef) {
    h.game.replaySelect(ref, 1, 1, '1-1');
    // The hero select: Mario.
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
  }

  it('a replay of the file: its values are the live assists; leaving it: all off again', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    hard(A);
    const h = game();
    setAdv(h.game, A, { assist: on({ invulnerable: true, safetyFloor: true }), seen: true });
    replayOf(h, A);
    expect(h.game.liveAssists()).toMatchObject({ invulnerable: true, safetyFloor: true });
    expect(h.game.ctx.assist.invulnerable).toBe(true);
    h.game.leaveReplay('files');
    expect(h.game.liveAssists()).toEqual({ ...ADVANCED_OFF });
    expect(h.game.ctx.assist.invulnerable).toBe(false);
  });

  it('never another file’s replay, a file run, or the campaign', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    hard(A);
    keepCleared(B, {}, rulesOn('normal'));
    const h = game();
    setAdv(h.game, A, { assist: on({ invulnerable: true }), seen: true });
    replayOf(h, B);
    expect(h.game.liveAssists().invulnerable).toBe(false);
    h.game.leaveReplay('files');
    h.game.classicGame(MARIO, '1-1', { ref: C, rules: rulesOn('hard') });
    h.idle(5);
    expect(h.game.liveAssists().invulnerable).toBe(false);
    expect(h.game.ctx.assist.invulnerable).toBe(false);
  });

  it('dev mode on: the dev Assists, as always (the file’s values wait for dev mode off)', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    hard(A);
    const h = game((s) => {
      s.dev = true;
      s.assist.infiniteTime = true;
    });
    setAdv(h.game, A, { assist: on({ invulnerable: true }), seen: true });
    replayOf(h, A);
    expect(h.game.liveAssists()).toMatchObject({ infiniteTime: true, invulnerable: false });
    h.settings.dev = false;
    expect(h.game.liveAssists()).toMatchObject({ infiniteTime: false, invulnerable: true });
  });

  it('nothing unlocked anywhere: dev mode off plays with every assist off, as before', () => {
    const h = game((s) => {
      s.assist.invulnerable = true;
    });
    expect(h.game.liveAssists()).toEqual({ ...ADVANCED_OFF });
  });
});
