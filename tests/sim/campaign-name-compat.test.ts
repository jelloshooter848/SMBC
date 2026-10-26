import { afterEach, describe, expect, it } from 'vitest';
import {
  SETTINGS_KEY,
  defaultSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from '@engine/save/settings';
import { urlRules } from '@game/dev-url';
import { CLASSIC_RESUME_KEY, parseResume } from '@game/run-resume';
import {
  classicFileKey,
  loadClassicFile,
  loadClearedFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import { DEV_LAST_KEY, loadDevPick } from '@game/scenes/dev-play';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// Item 76 (v0.4.73): the rules once called "Current" are called "Campaign" ('campaign'). "current"
// is the old name for Campaign: anything stored or linked before the rename (a settings blob, a
// Classic file's run, an old per-set Continue slot, a kept dev start, a `?rules=` link) reads as
// 'campaign' and keeps the rest of its data, and nothing writes 'current' again.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };

/** A kept run as an older version stored it, under the old name for Campaign rules. */
function oldRun(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    levelId: '2-1',
    rules: 'current',
    hero: 'mario',
    score: 4200,
    coins: 17,
    lives: 4,
    world: 2,
    stage: 1,
    powerState: 'fire',
    hp: 3,
    kit: {},
    warped: false,
    checkpoint: null,
    ...over,
  };
}

/** An older version's Classic file (v 1) holding `run`. */
function oldFile(run: Record<string, unknown>, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    set: 'smb',
    slot: 1,
    rules: originalFileRules(),
    continues: 2,
    tutorialsSeen: ['jump'],
    run,
    savedAt: 1234,
    ...over,
  };
}

/** No stored value anywhere holds the old name. */
function noOldNameStored(): void {
  for (const [k, v] of store) expect(v, k).not.toMatch(/"current"/);
}

function game(dev: boolean): H {
  const settings: Settings = { ...defaultSettings(), dev };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

describe('item 76: an old settings blob', () => {
  it("classicRules 'current' loads as 'campaign' and keeps every other setting", () => {
    const old = {
      ...defaultSettings(),
      classicRules: 'current',
      classicMapDifficulty: 'hard',
      video: { ...defaultSettings().video, reduceFlashing: true },
      classicDev: { ...defaultSettings().classicDev, playsClassic: ['link'] },
    };
    store.set(SETTINGS_KEY, JSON.stringify(old));
    const s = loadSettings();
    expect(s.classicRules).toBe('campaign');
    expect(s.classicMapDifficulty).toBe('hard');
    expect(s.video.reduceFlashing).toBe(true);
    expect(s.classicDev.playsClassic).toEqual(['link']);
  });

  it('an older blob without a version number migrates the same way', () => {
    const old: Record<string, unknown> = { ...defaultSettings(), classicRules: 'current' };
    delete old.v;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().classicRules).toBe('campaign');
  });

  it("saved again it is written as 'campaign', never 'current'", () => {
    store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), classicRules: 'current' }));
    saveSettings(loadSettings());
    expect(JSON.parse(store.get(SETTINGS_KEY) as string).classicRules).toBe('campaign');
    noOldNameStored();
  });

  it("'campaign' and 'classic' load as they are; anything else (a newer or damaged value) is 'classic'", () => {
    for (const v of ['campaign', 'classic'] as const) {
      store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), classicRules: v }));
      expect(loadSettings().classicRules).toBe(v);
    }
    for (const v of ['Current', 'CURRENT', 'turbo', 7, null, ['current']]) {
      store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), classicRules: v }));
      expect(loadSettings().classicRules, String(v)).toBe('classic');
    }
  });

  it('storage that throws gives the defaults (classic rules), and nothing is written', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    };
    expect(loadSettings().classicRules).toBe('classic');
    expect(store.size).toBe(0);
  });
});

describe('item 76: an old kept run (run-resume)', () => {
  it("rules 'current' reads as 'campaign' with its score, lives, hero and power", () => {
    const r = parseResume(oldRun());
    expect(r).not.toBeNull();
    expect(r?.rules).toBe('campaign');
    expect(r).toMatchObject({
      levelId: '2-1',
      hero: 'mario',
      score: 4200,
      coins: 17,
      lives: 4,
      world: 2,
      stage: 1,
      powerState: 'fire',
    });
  });

  it("'campaign' and 'classic' read as they are; another value is not a run", () => {
    expect(parseResume(oldRun({ rules: 'campaign' }))?.rules).toBe('campaign');
    expect(parseResume(oldRun({ rules: 'classic' }))?.rules).toBe('classic');
    for (const v of ['Current', 'turbo', undefined, 3])
      expect(parseResume(oldRun({ rules: v })), String(v)).toBeNull();
  });
});

describe('item 76: an old Classic file', () => {
  it("a file whose run plays 'current' loads as Campaign and keeps its data", () => {
    store.set(classicFileKey(F1), JSON.stringify(oldFile(oldRun())));
    const f = loadClassicFile(F1);
    expect(f?.run.rules).toBe('campaign');
    expect(f).toMatchObject({ continues: 2, tutorialsSeen: ['jump'], savedAt: 1234 });
    expect(f?.run).toMatchObject({ score: 4200, lives: 4, hero: 'mario', world: 2, stage: 1 });
  });

  it("saved back, the file holds 'campaign', never 'current'", () => {
    store.set(classicFileKey(F1), JSON.stringify(oldFile(oldRun())));
    const f = loadClassicFile(F1);
    expect(f).not.toBeNull();
    if (!f) return;
    expect(saveClassicFile(f)).toBe(true);
    expect(loadClassicFile(F1)?.run.rules).toBe('campaign');
    expect(loadClassicFile(F1)?.run.score).toBe(4200);
    noOldNameStored();
  });

  it("a CLEARED file (v 2) whose run played 'current' loads as Campaign, untouched in storage", () => {
    const raw = JSON.stringify(oldFile(oldRun(), { v: 2, cleared: true }));
    store.set(classicFileKey(F1), raw);
    const f = loadClearedFile(F1);
    expect(f?.run.rules).toBe('campaign');
    expect(f?.run).toMatchObject({ score: 4200, lives: 4, hero: 'mario' });
    // A CLEARED file is never written again: reading it changes nothing.
    expect(store.get(classicFileKey(F1))).toBe(raw);
  });

  it('in developer mode it goes on under Campaign rules with its power kept', () => {
    store.set(classicFileKey(F1), JSON.stringify(oldFile(oldRun())));
    const h = game(true);
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.liveRules).toBe('campaign');
    expect(h.game.state).toMatchObject({ score: 4200, coins: 17, lives: 4, world: 2, stage: 1 });
    expect(h.game.state.powerState).toBe('fire');
  });

  it('outside developer mode it goes on under Classic rules with its level, score and lives', () => {
    store.set(classicFileKey(F1), JSON.stringify(oldFile(oldRun())));
    const h = game(false);
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.liveRules).toBe('classic');
    expect(h.game.state).toMatchObject({ score: 4200, coins: 17, lives: 4, world: 2, stage: 1 });
  });
});

describe('item 76: an old per-set Continue slot', () => {
  it("migrates into FILE 1 as Campaign rules and keeps its data; nothing stored says 'current'", () => {
    store.set(CLASSIC_RESUME_KEY, JSON.stringify(oldRun({ score: 777 })));
    const h = game(true);
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.liveRules).toBe('campaign');
    expect(h.game.state.score).toBe(777);
    expect(h.game.state.powerState).toBe('fire');
    expect(loadClassicFile(F1)?.run).toMatchObject({ rules: 'campaign', score: 777, hero: 'mario' });
    pickAtContinue(h);
    h.until(() => (loadClassicFile(F1)?.savedAt ?? 0) > 1234, 600);
    expect(loadClassicFile(F1)?.run.rules).toBe('campaign');
    noOldNameStored();
  });
});

describe('item 76: a kept dev start and a dev link', () => {
  const kept = {
    branch: 'campaign',
    level: '1-1',
    name: '1-1',
    hero: 'mario',
    look: 'mario',
    power: 'big',
    kit: false,
    rules: 'current',
    classicRun: false,
    difficulty: 'normal',
  };

  it("a dev start kept with rules 'current' replays as Campaign", () => {
    store.set(DEV_LAST_KEY, JSON.stringify(kept));
    const pick = loadDevPick(game(true).game);
    expect(pick).not.toBeNull();
    expect(pick?.rules).toBe('campaign');
    expect(pick).toMatchObject({ level: '1-1', hero: 'mario', power: 'big' });
  });

  it("a dev start kept with rules 'campaign' replays as it is", () => {
    store.set(DEV_LAST_KEY, JSON.stringify({ ...kept, rules: 'campaign' }));
    expect(loadDevPick(game(true).game)?.rules).toBe('campaign');
  });

  it('`?rules=current` and `?rules=campaign` both ask for Campaign rules (dev mode only)', () => {
    const p = (q: string) => new URLSearchParams(q);
    expect(urlRules(p('?rules=current'), true)).toBe('campaign');
    expect(urlRules(p('?rules=campaign'), true)).toBe('campaign');
    expect(urlRules(p('?rules=classic'), true)).toBe('classic');
    expect(urlRules(p('?rules=current'), false)).toBeNull();
    expect(urlRules(p('?rules=campaign'), false)).toBeNull();
    expect(urlRules(p('?rules=Current'), true)).toBeNull();
  });
});
