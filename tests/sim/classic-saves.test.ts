import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MAP_SET_IDS } from '@engine/save/progress';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { LevelScene } from '@game/scenes/level';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelSelectScene } from '@game/scenes/level-select-cheat';
import type { MenuItem } from '@game/scenes/menu';
import { MAP_SETS, mapSetOf, type ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicOverwriteScene, ClassicSetScene, openClassicSet } from '@game/scenes/classic-set-prompt';
import { CLASSIC_RESUME_KEY, classicResumeKey, loadClassicResume, resumeSetOf } from '@game/run-resume';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// Per-set saves (owner, before 0.5.0; O-07 "Classic keeps Continue", G-008): one resume slot per
// map set; picking a set that has one asks CONTINUE / NEW GAME, NEW GAME warns first (Cancel
// focused); a set with none starts a new game at once. Written at each WORLD card, cleared by a
// game over and the ending, never by a dev or link run (RC-004); the old single slot migrates.

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}, dev = false): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over, ...(dev ? { dev: true } : {}) };
  const h = makeGame({ dev, deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const idx = (s: unknown) => (s as { index: number }).index;
const slotKeys = () => [...store.keys()].filter((k) => k.startsWith(CLASSIC_RESUME_KEY));
const inLevel = (h: H) => h.top() instanceof LevelScene;
const SET = (id: string) => MAP_SETS.find((s) => s.id === id) as (typeof MAP_SETS)[number];

/** A run of `levelId`'s set kept in its slot (written by the game, at its WORLD card). */
function playTo(h: H, levelId: string, lives = 3): void {
  h.game.classicGame(MARIO, levelId);
  h.game.state.lives = lives;
  h.game.goToLevel(levelId, { mode: 'stand' });
}

/** The CLASSIC menu with set `id` highlighted, then picked (OK). */
function pick(h: H, id: string): void {
  h.game.showClassicMenu();
  const menu = h.top() as ClassicMenuScene;
  (menu as unknown as { index: number }).index = MAP_SETS.findIndex((s) => s.id === id);
  h.idle(8);
  h.tap('jump');
}

describe('per-set saves: one slot per map set', () => {
  it('each set writes its own slot; the others keep theirs', () => {
    const h = classic();
    playTo(h, '1-2');
    playTo(h, 'sp-2-1');
    playTo(h, 'll-3-1');
    expect(slotKeys().sort()).toEqual(MAP_SET_IDS.map((s) => classicResumeKey(s)).sort());
    expect(loadClassicResume('smb')?.levelId).toMatch(/^1-2/);
    expect(loadClassicResume('special')?.levelId).toMatch(/^sp-2-1/);
    expect(loadClassicResume('lost')?.levelId).toMatch(/^ll-3-1/);
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
  });

  it('resumeSetOf agrees with the menu’s mapSetOf for every set', () => {
    for (const id of ['1-1', '8-4', 'sp-1-1', 'sp-8-4', 'll-1-1', 'll-13-4', '1-2-bonus'])
      expect(resumeSetOf(id)).toBe(mapSetOf(id).id);
  });

  it('the CLASSIC menu has no global Continue; a set with a save says so in its hint', () => {
    const h = classic();
    playTo(h, 'll-2-1', 4);
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(labels(menu)).not.toContain('Continue');
    expect(labels(menu).slice(0, MAP_SETS.length)).toEqual(MAP_SETS.map((s) => s.label));
    expect(items(menu)[2]?.hint).toMatch(/Saved run: World 2-1, 4 lives/);
    expect(items(menu)[0]?.hint).not.toMatch(/Saved run/);
  });
});

describe('per-set saves: CONTINUE / NEW GAME', () => {
  it('a set with no save goes straight to a new game (the select), as before', () => {
    const h = classic();
    playTo(h, 'll-1-1');
    pick(h, 'smb');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('a set with a save asks CONTINUE / NEW GAME, CONTINUE focused, and says so', () => {
    const h = classic();
    playTo(h, '4-2', 2);
    pick(h, 'smb');
    const p = h.top();
    expect(p).toBeInstanceOf(ClassicSetScene);
    expect(labels(p)).toEqual(['Continue', 'New game']);
    expect(idx(p)).toBe(0);
    expect(h.said.at(-1)).toMatch(/^Super Mario Bros\.\. Saved run: World 4-2, 2 lives\. Continue/);
    const t = draw(p as ClassicSetScene).texts.map((x) => x.str);
    expect(t).toContain('SUPER MARIO BROS.');
    expect(t).toContain('SAVED: WORLD 4-2, 2 LIVES');
  });

  it('CONTINUE plays that set’s run on from its WORLD card', () => {
    const h = classic();
    playTo(h, '1-3');
    h.game.state.score = 4200;
    h.game.goToLevel('1-3', { mode: 'stand' });
    playTo(h, 'll-2-1');
    h.game.showTitle();
    pick(h, 'smb');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
    h.idle(8);
    h.tap('jump');
    h.until(() => inLevel(h), 600);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^1-3/);
    expect(h.game.state.score).toBe(4200);
    expect(h.game.scenes.depth).toBe(1);
  });

  it('Back from the prompt returns to the CLASSIC menu on that set', () => {
    const h = classic();
    playTo(h, 'sp-1-2');
    pick(h, 'special');
    h.idle(8);
    h.tap('attack');
    const menu = h.top() as ClassicMenuScene;
    expect(labels(menu)).toContain('SMB Special');
    expect(idx(menu)).toBe(1);
    expect(h.said.at(-1)).toMatch(/^SMB Special\./);
  });
});

describe('per-set saves: the overwrite warning', () => {
  function toWarning(h: H): ClassicOverwriteScene {
    playTo(h, '3-1', 3);
    pick(h, 'smb');
    h.idle(8);
    h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicOverwriteScene);
    return h.top() as ClassicOverwriteScene;
  }

  it('NEW GAME warns, with Cancel focused, announced, drawn', () => {
    const h = classic();
    const w = toWarning(h);
    expect(labels(w)).toEqual(['Cancel', 'New game']);
    expect(idx(w)).toBe(0);
    expect(h.said.at(-1)).toMatch(
      /^Overwrite save\? A new game of Super Mario Bros\. overwrites its saved run, World 3-1, 3 lives\. Cancel/,
    );
    const t = draw(w).texts.map((x) => x.str);
    expect(t).toEqual(
      expect.arrayContaining(['OVERWRITE SAVE?', 'OVERWRITES ITS SAVED RUN:', 'WORLD 3-1, 3 LIVES']),
    );
  });

  it('it waits for a press: idling never answers it', () => {
    const h = classic();
    const w = toWarning(h);
    h.idle(3600);
    expect(h.top()).toBe(w);
    expect(loadClassicResume('smb')?.levelId).toMatch(/^3-1/);
  });

  it('Cancel (OK on the focused entry) keeps the save and goes back to the prompt', () => {
    const h = classic();
    toWarning(h);
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
    expect(loadClassicResume('smb')?.levelId).toMatch(/^3-1/);
  });

  it('Back is Cancel too', () => {
    const h = classic();
    toWarning(h);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
  });

  it('confirmed NEW GAME starts the set again; its first WORLD card overwrites the slot', () => {
    const h = classic();
    toWarning(h);
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^New game/);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.scenes.depth).toBe(1);
    h.game.classicGame(LINK, '1-1');
    expect(loadClassicResume('smb')).toMatchObject({ levelId: expect.stringMatching(/^1-1/), hero: 'link' });
  });

  it('openClassicSet takes the caller’s new game (for the CLASSIC title’s Start menu)', () => {
    const h = classic();
    let started = 0;
    openClassicSet(h.game, SET('lost'), { back: () => {}, newGame: () => started++ });
    expect(started).toBe(1);
    playTo(h, 'll-1-2');
    h.game.showClassicMenu();
    openClassicSet(h.game, SET('lost'), { back: () => {}, newGame: () => started++ });
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
  });
});

describe('per-set saves: writing and clearing', () => {
  it('a game over clears only its own set’s slot', () => {
    const h = classic();
    playTo(h, 'll-1-1');
    playTo(h, '1-1');
    h.game.gameOver('1-1');
    expect(loadClassicResume('smb')).toBeNull();
    expect(loadClassicResume('lost')).not.toBeNull();
  });

  it('the ending clears only its own set’s slot', () => {
    const h = classic();
    playTo(h, '1-1');
    playTo(h, 'sp-8-4');
    h.game.showEnding('sp-8-4');
    expect(loadClassicResume('special')).toBeNull();
    expect(loadClassicResume('smb')).not.toBeNull();
  });

  it('a developer Classic run never writes any slot', () => {
    const h = classic({}, true);
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    h.game.devClassicGame(MARIO, 'll-1-1', 'classic');
    expect(slotKeys()).toEqual([]);
  });
});

describe('per-set saves: the old single slot migrates', () => {
  const old = (levelId: string, lives = 3) =>
    JSON.stringify({
      v: 1,
      levelId,
      rules: 'classic',
      hero: 'luigi',
      score: 900,
      coins: 5,
      lives,
      world: 5,
      stage: 2,
      powerState: 'big',
      hp: 0,
      kit: {},
      warped: false,
      checkpoint: null,
    });

  it('into the slot of its level’s set, and the old key goes', () => {
    store.set(CLASSIC_RESUME_KEY, old('ll-5-2'));
    expect(loadClassicResume('lost')).toMatchObject({ levelId: 'll-5-2', hero: 'luigi', score: 900 });
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
    expect(slotKeys()).toEqual([classicResumeKey('lost')]);
  });

  it('the CLASSIC menu offers it on that set', () => {
    store.set(CLASSIC_RESUME_KEY, old('5-2'));
    const h = classic();
    pick(h, 'smb');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
  });

  it('an old slot still there is the newer run (an older build wrote it); a broken one is dropped', () => {
    const h = classic();
    playTo(h, '1-2');
    playTo(h, 'll-1-1');
    store.set(CLASSIC_RESUME_KEY, old('5-2'));
    expect(loadClassicResume('smb')?.levelId).toBe('5-2');
    expect(loadClassicResume('lost')?.levelId).toMatch(/^ll-1-1/);
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
    store.set(CLASSIC_RESUME_KEY, '{"v":1}');
    expect(loadClassicResume('smb')?.levelId).toBe('5-2');
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(false);
  });
});

describe('per-set saves: phone touch', () => {
  it('the prompt and the warning show OK and BACK', () => {
    const h = classic();
    playTo(h, '2-1');
    pick(h, 'smb');
    const p = h.top() as ClassicSetScene;
    expect(p.touchLabels()).toMatchObject({ jump: 'OK', attack: 'BACK' });
    h.idle(8);
    h.tap('down');
    h.tap('jump');
    const w = h.top() as ClassicOverwriteScene;
    expect(w.touchLabels()).toMatchObject({ jump: 'OK', attack: 'BACK' });
  });
});

describe('per-set saves: the Level Select cheat', () => {
  it('Go from the menus on a set with a save warns first (Cancel focused)', () => {
    const h = classic();
    playTo(h, '2-1');
    h.game.showClassicMenu();
    h.game.scenes.push(new LevelSelectScene(h.game, () => h.game.scenes.pop()));
    const page = h.top() as LevelSelectScene;
    (page as unknown as { index: number }).index = labels(page).indexOf('Go');
    h.idle(8);
    h.tap('jump');
    const w = h.top();
    expect(w).toBeInstanceOf(ClassicOverwriteScene);
    expect(idx(w)).toBe(0);
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBe(page);
    expect(loadClassicResume('smb')?.levelId).toMatch(/^2-1/);
  });

  it('a run it takes to another set moves its slot there', () => {
    const h = classic();
    playTo(h, '2-1');
    h.until(() => inLevel(h), 600);
    h.game.classicLevelSelect('ll-3-1', 'normal');
    expect(loadClassicResume('smb')).toBeNull();
    expect(loadClassicResume('lost')?.levelId).toMatch(/^ll-3-1/);
  });
});
