import { afterEach, describe, expect, it } from 'vitest';
import { toPx } from '@engine/math/units';
import { loadProgress, allSetsBeaten } from '@engine/save/progress';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import {
  classicFileKey,
  eraseClassicFile,
  loadClassicFile,
  originalFileRules,
  type ClassicFileRef,
} from '@game/original-files';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import { QUIT_RUN_TITLE, QUIT_SELECT_TITLE, QuitRunScene } from '@game/scenes/quit-run';
import {
  ClassicMenuScene,
  classicBeatStatus,
  recordClassicBeat,
} from '@game/scenes/original-game';
import { draw, store, useStorage } from './heroes-harness';
import { classic, inLevel, type G } from './cleared-nav';

/*
 * v0.4.77 (owner-approved), rule 33a: these tests come before the change.
 * 196/197: a Classic run's Pause > Quit > YES goes to the run's mid-run character select for the
 * same level, with nothing lost (lives, score), the level from its start; the select's BACK keeps
 * the Quit card, whose YES is the CLASSIC menu. A run with no mid-run select (Single random)
 * keeps going to the CLASSIC menu. 178: the "can't save" note on every Quit box. 203: no BEATEN
 * mark or "Beaten on" anywhere, while progress.classicBeat is kept.
 */

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const idx = (s: unknown) => (s as { index: number }).index;
const screen = (h: G) =>
  draw(h.game.scenes as never)
    .texts.map((x) => x.str)
    .join(' ');

function fileRun(h: G = classic()): G {
  h.game.classicGame(MARIO, '1-1', { ref: A });
  h.until(() => inLevel(h), 900);
  h.idle(4);
  return h;
}

/** Pause, then its Quit row: the Quit card. */
function pauseQuit(h: G): QuitRunScene {
  h.tap('start');
  const pause = h.top() as PauseScene;
  expect(pause).toBeInstanceOf(PauseScene);
  h.idle(6);
  const row = labels(pause).indexOf('Quit');
  expect(row).toBeGreaterThan(0);
  for (let n = 0; idx(pause) !== row && n < 20; n++) h.tap('down');
  h.tap('jump');
  const card = h.top() as QuitRunScene;
  expect(card).toBeInstanceOf(QuitRunScene);
  return card;
}

/** YES on the Quit card on top. */
function yes(h: G): void {
  h.idle(6);
  h.tap('down');
  h.tap('jump');
}

describe('196/197: Pause > Quit > YES goes to the mid-run select', () => {
  it('the Quit row and the card: "Back to character select", "QUIT TO CHARACTER SELECT?", no file promise', () => {
    const h = fileRun();
    h.tap('start');
    const quit = items(h.top()).find((i) => i.label === 'Quit');
    expect(quit?.hint).toBe('Back to character select');
    h.tap('start');
    h.idle(4);
    const card = pauseQuit(h);
    expect(card.title).toBe(QUIT_SELECT_TITLE);
    expect(QUIT_SELECT_TITLE).toBe('QUIT TO CHARACTER SELECT?');
    expect(h.said.at(-1)).toBe('Quit to character select? No');
    h.idle(4);
    expect(screen(h)).toContain('QUIT TO CHARACTER SELECT?');
    expect(screen(h)).not.toMatch(/WAITS IN ITS FILE/);
  });

  it('YES: the select for the same level, the same lives and score; nothing is lost', () => {
    const h = fileRun();
    const s = h.game.state;
    s.score = 4200;
    s.lives = 5;
    s.coins = 7;
    s.checkpoint = { level: '1-1', x: 82 };
    pauseQuit(h);
    yes(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.selectLevel).toBe('1-1');
    expect(h.game.state.lives).toBe(5);
    expect(h.game.state.score).toBe(4200);
    expect(h.game.state.coins).toBe(7);
    // A fresh entry: no checkpoint, no clock carried.
    expect(h.game.state.checkpoint).toBeNull();
    expect(h.game.state.time).toBeNull();
    // The file holds that level's start with the same lives and score (as at a new level).
    const f = loadClassicFile(A);
    expect(f?.run.levelId).toBe('1-1');
    expect(f?.run.lives).toBe(5);
    expect(f?.run.score).toBe(4200);
    expect(f?.run.checkpoint ?? null).toBeNull();
  });

  it('picking a hero starts that level from its start', () => {
    const h = fileRun();
    h.game.state.checkpoint = { level: '1-1', x: 82 };
    pauseQuit(h);
    yes(h);
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    h.until(() => inLevel(h), 900);
    const l = h.top() as LevelScene;
    expect(l.level.id).toBe('1-1');
    expect(toPx(l.world.player.body.x)).toBeLessThan(200);
    expect(h.game.state.lives).toBe(loadClassicFile(A)?.run.lives);
  });

  it('BACK on that select keeps the Quit card, and its YES goes to the CLASSIC menu', () => {
    const h = fileRun();
    pauseQuit(h);
    yes(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('attack');
    const card = h.top() as QuitRunScene;
    expect(card).toBeInstanceOf(QuitRunScene);
    expect(card.title).toBe(QUIT_RUN_TITLE);
    expect(h.said.at(-1)).toBe('Quit to the Classic menu? No');
    yes(h);
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    expect(h.game.classicRun).toBe(false);
    // The file still holds the run at that level's start.
    expect(loadClassicFile(A)?.run.levelId).toBe('1-1');
  });

  it('NO on the Pause > Quit card goes back to the pause, and the run plays on', () => {
    const h = fileRun();
    pauseQuit(h);
    h.idle(6);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(h.game.classicRun).toBe(true);
  });

  it('a developer Classic run (no file) goes to its select too, and writes nothing', () => {
    const h = classic((s) => void (s.dev = true));
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    h.until(() => inLevel(h), 900);
    h.idle(4);
    h.game.state.lives = 4;
    const before = [...store.keys()].filter((k) => k.includes('classic')).sort();
    const card = pauseQuit(h);
    expect(card.title).toBe(QUIT_SELECT_TITLE);
    yes(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.selectLevel).toBe('1-1');
    expect(h.game.state.lives).toBe(4);
    expect([...store.keys()].filter((k) => k.includes('classic')).sort()).toEqual(before);
  });

  it('a link run (no file) goes to its select', () => {
    const h = classic();
    h.game.devClassicGame(LINK, '1-2', 'classic', false);
    h.until(() => inLevel(h), 900);
    h.idle(4);
    pauseQuit(h);
    yes(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.selectLevel).toBe('1-2');
  });

  it('Single random (no mid-run select) keeps the CLASSIC menu card and goes there', () => {
    const h = classic();
    const rules = originalFileRules();
    rules.options.gameMode = 'single-random';
    h.game.classicGame(MARIO, '1-1', { ref: A, rules });
    h.until(() => inLevel(h), 900);
    h.idle(4);
    h.tap('start');
    expect(items(h.top()).find((i) => i.label === 'Quit')?.hint).toBe('Back to the Classic menu');
    h.tap('start');
    h.idle(4);
    const card = pauseQuit(h);
    expect(card.title).toBe(QUIT_RUN_TITLE);
    yes(h);
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  });

  it('storage throwing: YES still reaches the select with the lives and score kept', () => {
    const h = fileRun();
    h.game.state.score = 900;
    const lives = h.game.state.lives;
    pauseQuit(h);
    const ls = (globalThis as { localStorage?: unknown }).localStorage;
    const deny = () => {
      throw new Error('denied');
    };
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: deny, setItem: deny, removeItem: deny };
    try {
      yes(h);
      expect(h.top()).toBeInstanceOf(CharacterSelectScene);
      expect(h.game.state.score).toBe(900);
      expect(h.game.state.lives).toBe(lives);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = ls;
    }
  });

  it('a stale tab (another window took the file): YES reaches the select and leaves their file alone', () => {
    const t1 = fileRun();
    const t2 = classic();
    eraseClassicFile(A);
    t2.game.classicGame(LINK, '1-1', { ref: A });
    t2.until(() => inLevel(t2), 900);
    const theirs = store.get(classicFileKey(A));
    pauseQuit(t1);
    yes(t1);
    expect(t1.top()).toBeInstanceOf(CharacterSelectScene);
    expect(store.get(classicFileKey(A))).toBe(theirs);
  });
});

describe('178: the "can\'t save" note on every Quit box', () => {
  it('shown and said each time the Quit box opens, not only the first', () => {
    const t1 = fileRun();
    const t2 = classic();
    eraseClassicFile(A);
    t2.game.classicGame(LINK, '1-1', { ref: A });
    t2.until(() => inLevel(t2), 900);
    for (let n = 0; n < 3; n++) {
      pauseQuit(t1);
      expect(t1.said.at(-1)).toMatch(/changed in another window/i);
      t1.idle(4);
      expect(screen(t1)).toMatch(/ANOTHER WINDOW/);
      // NO, then Continue: back in the level.
      t1.tap('jump');
      expect(t1.top()).toBeInstanceOf(PauseScene);
      t1.idle(4);
      while (idx(t1.top()) !== 0) t1.tap('up');
      t1.tap('jump');
      expect(inLevel(t1)).toBe(true);
      t1.idle(4);
    }
  });
});

describe('203: no BEATEN mark, the beat still kept', () => {
  it('a beaten set shows no mark and says no "Beaten on", full screen or as a box', () => {
    recordClassicBeat('smb', 'hard');
    const h = classic();
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(menu).toBeInstanceOf(ClassicMenuScene);
    for (const it of items(menu)) expect(it.hint ?? '').not.toMatch(/Beaten/i);
    expect(draw(menu).texts.some((t) => /BEATEN/.test(t.str))).toBe(false);
    expect(h.said.join(' ')).not.toMatch(/Beaten/i);
    h.game.showClassicTitle('start');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    expect(draw(h.top() as ClassicMenuScene).texts.some((t) => /BEATEN/.test(t.str))).toBe(false);
    expect(h.said.at(-1)).not.toMatch(/Beaten/i);
  });

  it('classicBeatStatus, progress.classicBeat and allSetsBeaten still report it', () => {
    recordClassicBeat('smb', 'hard');
    recordClassicBeat('special');
    recordClassicBeat('lost', 'easy');
    expect(classicBeatStatus('smb')).toBe('hard');
    expect(classicBeatStatus('special')).toBe('normal');
    expect(loadProgress().classicBeat).toEqual({ smb: 'hard', special: 'normal', lost: 'easy' });
    expect(allSetsBeaten(loadProgress(), 'easy')).toBe(true);
    expect(allSetsBeaten(loadProgress(), 'normal')).toBe(false);
  });
});
