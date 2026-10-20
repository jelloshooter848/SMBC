import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { defaultClassicSettings, type ClassicSettings } from '@engine/save/original-options';
import { CHARACTERS } from '@game/characters/registry';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import type { ClassicOptionsScene } from '@game/scenes/original-game';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// FU-4 Random slot and FU-7b Game Mode (docs/classic/FOLLOW_UPS_PROPOSAL.md): the Classic select
// screen ends with a Random slot ("?"); Options > Game mode picks All heroes (the default: a
// select before every level and life, as today), Single hero (one pick for the run) or Single
// random (no select screen, a random hero every level and life). Survival is not built here.

useStorage();
isolateClassicRegistry({ hideExtras: true });

function classic(over: Partial<ClassicSettings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), classic: { ...defaultClassicSettings(), ...over } };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const idx = (s: unknown) => (s as { index: number }).index;
const inLevel = (h: H) => h.top() instanceof LevelScene;
const level = (h: H) => h.top() as LevelScene;

function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  return level(h);
}

function die(h: H): void {
  const w = enterLevel(h).world;
  w.kill(w.player);
  h.until(() => !inLevel(h), 400);
}

/** The Classic select (start of a run), idled until it takes input. */
function select(h: H): CharacterSelectScene {
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  expect(sel).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  return sel;
}

describe('FU-4: the Random slot', () => {
  it('ends the Classic select: Left from the first hero reaches it, spoken as Random, drawn as ?', () => {
    const h = classic();
    const sel = select(h);
    expect(sel.hasRandom).toBe(true);
    h.tap('left');
    expect(idx(sel)).toBe(sel.chars.length);
    expect(h.said.at(-1)).toBe('Random');
    const t = draw(sel).texts.map((x) => x.str);
    expect(t).toContain('RANDOM');
    // The original's grid (the extras hidden here): the "?" cell follows the last hero.
    const q = sel.slot(sel.chars.length);
    const last = sel.slot(sel.chars.length - 1);
    expect(q.y > last.y || (q.y === last.y && q.x > last.x)).toBe(true);
    // Right wraps back to the first hero.
    h.tap('right');
    expect(idx(sel)).toBe(0);
  });

  it('OK on it starts the run with a hero from the roster, the same one each time in tests', () => {
    const run = () => {
      const h = classic();
      select(h);
      h.tap('left');
      h.tap('jump');
      expect(h.top()).toBeInstanceOf(IntroScene);
      const said = h.said.find((s) => s.startsWith('Random: '));
      expect(said).toBeDefined();
      expect(CHARACTERS.map((c) => c.name)).toContain(said?.slice(8, -1));
      expect(h.game.state.character.name).toBe(said?.slice(8, -1));
      return h.game.state.character.id;
    };
    expect(run()).toBe(run());
  });

  it('after a death the select starts on the Random slot again; picking a hero there clears it', () => {
    const h = classic();
    select(h);
    h.tap('left');
    h.tap('jump');
    die(h);
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    expect(sel.hasRandom).toBe(true);
    expect(idx(sel)).toBe(sel.chars.length);
    expect(h.said.at(-1)).toMatch(/^Choose your hero\. Random\./);
    h.idle(12);
    h.tap('right'); // Mario
    h.tap('jump');
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.pickedRandom).toBe(false);
  });

  it('never outside Classic mode: free play, the custom levels’ select and the campaign', () => {
    const h = classic();
    h.game.showCharacterSelect();
    expect((h.top() as CharacterSelectScene).hasRandom).toBe(false);
    h.game.newGame(MARIO);
    die(h);
    expect((h.top() as CharacterSelectScene).hasRandom).toBe(false);
    file();
    h.game.openFile(1);
    h.game.enterLevelFromMap('1-1');
    expect((h.top() as CharacterSelectScene).hasRandom).toBe(false);
  });
});

describe('FU-7b: Game mode', () => {
  it('the decision: All heroes always selects, Single hero once, Single random never', () => {
    const g = (gameMode: ClassicSettings['gameMode']) => classic({ gameMode }).game;
    expect([g('all').classicHeroChoice(true), g('all').classicHeroChoice(false)]).toEqual([
      'select',
      'select',
    ]);
    expect([g('single').classicHeroChoice(true), g('single').classicHeroChoice(false)]).toEqual([
      'select',
      'keep',
    ]);
    expect([g('single-random').classicHeroChoice(true), g('single-random').classicHeroChoice(false)]).toEqual(
      ['random', 'random'],
    );
    // No settings (the test harnesses): All heroes.
    expect(makeGame().game.classicHeroChoice(false)).toBe('select');
  });

  it('All heroes (default): a select before the next level and after a death, as today', () => {
    const h = classic();
    select(h);
    h.tap('jump');
    die(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    enterLevel(h);
    h.game.levelExitTo('1-2');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('Single hero: one pick; deaths and new levels go on with that hero, no select', () => {
    const h = classic({ gameMode: 'single' });
    const sel = select(h);
    for (let i = 0; i < 20 && sel.chars[idx(sel)] !== LINK; i++) h.tap('right');
    h.tap('jump');
    expect(h.game.state.character).toBe(LINK);
    die(h);
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.state.character).toBe(LINK);
    const w = enterLevel(h).world;
    w.player.powerState = 'big';
    h.game.state.powerState = 'big';
    h.game.levelExitTo('1-2');
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.state.character).toBe(LINK);
    // The warp keeps the hero's power, as picking the same hero does.
    expect(h.game.state.powerState).toBe('big');
  });

  it('Single random: no select screen at the start, after a death or for a new level', () => {
    const h = classic({ gameMode: 'single-random', lives: 10 });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.classicRun).toBe(true);
    const heroes = new Set<string>([h.game.state.character.id]);
    for (let i = 0; i < 6; i++) {
      die(h);
      expect(h.top()).toBeInstanceOf(IntroScene);
      heroes.add(h.game.state.character.id);
    }
    expect(heroes.size).toBeGreaterThan(1);
    for (const id of heroes) expect(CHARACTERS.map((c) => c.id)).toContain(id);
  });
});

const items = (s: unknown) => (s as { items: MenuItem[] }).items;

function pick(h: H, label: string): void {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label.replace(/\*$/, '') === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  for (let i = 0; i < 20 && idx(menu) !== row; i++) h.tap('down');
  h.tap('jump');
}

describe('the Game mode row (CLASSIC > Options)', () => {
  it('steps All heroes → Single hero → Single random, saved, marked and spoken as changed', () => {
    const h = classic();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    expect(h.top()).toBeInstanceOf(TitleScene);
    pick(h, 'Classic');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    pick(h, 'Options');
    const o = h.top() as ClassicOptionsScene;
    const row = () => items(o)[1] as MenuItem;
    expect(row().label).toBe('Game mode');
    expect(row().value?.()).toBe('All heroes');
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Game mode: All heroes\. All heroes: choose before every level and life/);
    // Survival (v0.4.63, tests/sim/classic-survival.test.ts) comes second, as in the original's menu.
    h.tap('right');
    expect(h.settings.classic.gameMode).toBe('survival');
    h.tap('right');
    expect(h.settings.classic.gameMode).toBe('single');
    expect(row().label).toBe('Game mode*');
    expect(h.said.at(-1)).toMatch(/^Game mode: Single hero\..*Changed from the original: All heroes/);
    h.tap('right');
    expect(h.settings.classic.gameMode).toBe('single-random');
    h.tap('right');
    expect(h.settings.classic.gameMode).toBe('all');
    expect(row().label).toBe('Game mode');
    // The CLASSIC menu says when the run will not be the original's.
    h.tap('right');
    h.tap('attack');
    const menu = h.top() as ClassicMenuScene;
    expect(menu).toBeInstanceOf(ClassicMenuScene);
    expect(items(menu)[0]?.hint).toMatch(/Your own Classic options are on$/);
  });
});

describe('review fixes', () => {
  it('Single random names the picked hero with the lives card, at the start and after a death', () => {
    const h = classic({ gameMode: 'single-random', lives: 10 });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(h.said.at(-1)).toBe(`${h.game.state.character.name}. World 1-1. 10 lives.`);
    die(h);
    expect(h.said.at(-1)).toBe(`${h.game.state.character.name}. World 1-1. 9 lives.`);
    // All heroes: the card is as before (the select screen named the hero).
    const a = classic();
    select(a);
    a.tap('jump');
    expect(a.said.at(-1)).toBe('World 1-1. 3 lives.');
  });

  it('the CLASSIC menu hint counts only options that apply: with Current rules, Game mode only', () => {
    const hint = (over: Partial<ClassicSettings>, rules: 'classic' | 'current') => {
      const h = classic(over);
      h.settings.classicRules = rules;
      h.game.showClassicMenu();
      return items(h.top())[0]?.hint ?? '';
    };
    expect(hint({ lives: 7 }, 'classic')).toMatch(/Your own Classic options are on$/);
    expect(hint({ lives: 7 }, 'current')).not.toMatch(/Your own/);
    expect(hint({ gameMode: 'single' }, 'current')).toMatch(/Your own Classic options are on$/);
    expect(hint({}, 'classic')).not.toMatch(/Your own/);
  });
});
