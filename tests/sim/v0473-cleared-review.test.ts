import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLASSIC_CHEAT_IDS } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { CreditsScene } from '@game/scenes/credits';
import { PauseScene } from '@game/scenes/pause';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicNoteScene, ClassicReplayLevelsScene, REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import {
  classicFileKey,
  loadClearedFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import { draw, store, useStorage, type H } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { classic, inLevel, keepCleared, openFiles, run, stored } from './cleared-nav';

// v0.4.73 PR 2, the break-it review's findings: the credits ending on their own with no cheat
// card leave no level behind; no Level select inside a replay; v0.4.72's own rules leave a
// CLEARED file alone; a file erased by another tab while its boxes were open; a storage read
// that throws never lets a run write over a CLEARED file; the instructions show BACK.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const helpSeen = () => store.set(REPLAY_HELP_KEY, 'true');

function refuse(call: 'getItem' | 'setItem', only: (k: string) => boolean): void {
  const ls = (globalThis as { localStorage: Record<string, (...a: string[]) => unknown> }).localStorage;
  const real = ls[call] as (...a: string[]) => unknown;
  ls[call] = (...a: string[]) => {
    if (only(a[0] as string)) throw new Error(`${call} refused`);
    return real(...a);
  };
}

describe('review 1: the credits finishing with no cheat card', () => {
  it('leave no level under the file box (the run is left as any way back leaves it)', () => {
    const h = classic((s) => {
      for (const id of CLASSIC_CHEAT_IDS) s.classicCheats.unlocked[id] = true;
      s.classicCheats.levelSelect = true;
      s.classicCheats.beaten.smb = true;
    });
    h.game.classicGame(MARIO, '8-4', { ref: A });
    h.until(() => inLevel(h), 900);
    h.game.showEnding('8-4');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    // The roll as a player sees it: FASTER, then OK once it waits.
    h.tap('start');
    for (let i = 0; i < 40 && h.top() instanceof CreditsScene; i++) {
      h.idle(120);
      h.tap('jump');
    }
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    expect(h.game.scenes.find((s) => s instanceof LevelScene)).toBeUndefined();
    expect(h.game.classicRun).toBe(false);
    expect(loadClearedFile(A)).not.toBeNull();
  });
});

describe('review 2: Pause > Level select', () => {
  it('is not offered inside a replay (it is in a file run)', () => {
    keepCleared(A);
    helpSeen();
    const h = classic((s) => (s.classicCheats.levelSelect = true));
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    const world = (h.top() as LevelScene).world;
    expect(items(new PauseScene(h.game, world)).map((i) => i.label)).not.toContain('Level select');
    store.clear();
    const f = classic((s) => (s.classicCheats.levelSelect = true));
    f.game.classicGame(MARIO, '1-1', { ref: { set: 'smb', slot: 2 } });
    f.until(() => inLevel(f), 900);
    expect(items(new PauseScene(f.game, (f.top() as LevelScene).world)).map((i) => i.label)).toContain(
      'Level select',
    );
  });
});

/*
 * Review 3: v0.4.72's own rules, frozen here as it shipped them (original-files.ts at ff1e5a43):
 * a file reads only as `v: 1` (parseFile), and a migrated old save goes into the first slot with
 * nothing stored (placeRun: !hasClassicFile). An older version therefore never reads a CLEARED
 * file as a run and never places an old save into it.
 */
const v0472 = {
  readsAsFile: (raw: unknown) => !!raw && typeof raw === 'object' && (raw as { v?: unknown }).v === 1,
  freeSlot: (set: string) => [1, 2, 3].find((slot) => !store.has(`smbc-classic-file-${set}-${slot}`)),
};

describe('review 3: a downgrade to v0.4.72', () => {
  it("v0.4.72's rules leave a CLEARED file alone: not a run, and no free slot", () => {
    keepCleared(A);
    const raw = JSON.parse(store.get(classicFileKey(A)) as string) as unknown;
    expect(v0472.readsAsFile(raw)).toBe(false);
    expect(v0472.freeSlot('smb')).toBe(2);
    for (const slot of [2, 3] as const) keepCleared({ set: 'smb', slot });
    expect(v0472.freeSlot('smb')).toBeUndefined();
  });
});

describe('review 4: a CLEARED file erased by another tab while its boxes are open', () => {
  it('picking a level says so and shows the file box again', () => {
    keepCleared(A);
    helpSeen();
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
    store.delete(classicFileKey(A));
    choose(h, '1-1');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(h.said.at(-1)).toMatch(/^File 1 is no longer cleared\./);
    expect(items(h.top())[0]?.value?.()).toBe('NEW GAME');
  });
});

describe('review 6: a storage read that throws', () => {
  it('never lets a run write over a CLEARED file', () => {
    keepCleared(A, { score: 777 });
    const before = stored();
    refuse('getItem', (k) => k === classicFileKey(A));
    expect(
      saveClassicFile({ ...A, rules: originalFileRules(), continues: 0, run: run({ levelId: '1-1' }) }),
    ).toBe(false);
    expect(stored()).toBe(before);
  });

  it('a stale run in the same file writes nothing at its WORLD card or game over', () => {
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '1-1', world: 1, stage: 1 }),
    });
    const h = classic();
    expect(h.game.resumeClassic(A)).toBe(true);
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    store.delete(classicFileKey(A));
    keepCleared(A, { score: 4242 });
    const before = stored();
    refuse('getItem', (k) => k === classicFileKey(A));
    h.game.levelExitTo('1-2', { world: 1, stage: 1 });
    h.game.gameOver(null);
    expect(stored()).toBe(before);
  });
});

describe('review 7: the instructions show BACK on screen', () => {
  it('the BACK line is drawn under them', () => {
    keepCleared(A);
    const h: H = classic();
    openFiles(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    h.idle(40);
    const text = draw(h.top() as ClassicNoteScene)
      .texts.map((t) => t.str)
      .join(' ');
    expect(text).toMatch(/\bBACK\b/);
    expect(text).toMatch(/\bOK\b/);
  });
});
