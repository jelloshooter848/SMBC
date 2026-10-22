import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { CheatsScene } from '@game/scenes/cheats-menu';
import { DevMenuScene } from '@game/scenes/dev';
import { DEV_LAST_KEY, DevLevelPage, DevStartScene } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import { LevelSelectScene } from '@game/scenes/level-select-cheat';
import { MenuScene, type MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { ClassicFileRulesScene } from '@game/scenes/original-files-menu';
import { ClassicOptionsScene } from '@game/scenes/original-game';
import { ClassicTitleScene } from '@game/scenes/original-title';
import { PauseScene } from '@game/scenes/pause';
import { QuitRunScene, QUIT_PRACTICE_TITLE } from '@game/scenes/quit-run';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { TitleScene } from '@game/scenes/title';
import {
  guidePages,
  guideTutorials,
  TUTORIAL_GUARD_FRAMES,
  TutorialBoxScene,
} from '@game/tutorial/original-tutorials';
import { draw, file, intoBonus, makeGame, store, useStorage, type H } from './heroes-harness';

// v0.4.74 PR B (menus): items 53, 54, 55, 61, 63/64 and 67.

useStorage();
afterEach(() => store.clear());

const items = (m: unknown) => (m as { items: MenuItem[] }).items;
const labels = (m: unknown) => items(m).map((i) => i.label);
const idx = (m: unknown) => (m as { index: number }).index;
const focused = (m: unknown) => items(m)[idx(m)]?.label;

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** Moves the cursor of the menu on top to `label` (from where it is) and presses OK. */
function pick(h: H, label: string): void {
  const list = labels(h.top());
  const at = list.indexOf(label);
  expect(at, `${label} in ${list.join(', ')}`).toBeGreaterThanOrEqual(0);
  h.idle(8);
  for (let i = 0; i < list.length && idx(h.top()) !== at; i++) h.tap('down');
  h.tap('jump');
}

function chooseHero(h: H): void {
  h.until(() => h.top() instanceof CharacterSelectScene, 600);
  // OK on the hero, then OK on its look (the select's look picker).
  for (let i = 0; i < 3 && h.top() instanceof CharacterSelectScene; i++) {
    h.idle(12);
    h.tap('jump');
  }
}

function inLevel(h: H): LevelScene {
  h.until(() => h.top() instanceof LevelScene, 900);
  return h.top() as LevelScene;
}

function pausedClassicRun(h: H, hero = MARIO): LevelScene {
  h.game.classicGame(hero);
  const level = inLevel(h);
  h.idle(4);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(PauseScene);
  return level;
}

/** The level's exit (Level.exitTo): what a flagpole or castle does. */
const clear = (l: LevelScene, next: string) => (l as unknown as { exitTo(n: string): void }).exitTo(next);

/** The storage keys a run may write besides the dev START page's own kept pick. */
const written = () => [...store.keys()].filter((k) => k !== DEV_LAST_KEY).sort();

describe('item 53: a new file’s rules box opens on START', () => {
  it('the cursor starts on START, says so, and UP reaches the settings above it', () => {
    const h = classic();
    h.game.showClassicFiles('smb');
    pick(h, 'File 1');
    pick(h, 'Normal');
    const r = h.top() as ClassicFileRulesScene;
    expect(r).toBeInstanceOf(ClassicFileRulesScene);
    expect(focused(r)).toBe('Start');
    expect(h.said.at(-1)).toMatch(/Start\. Start File 1 with these rules/);
    h.idle(8);
    h.tap('up');
    expect(focused(r)).toBe('Disable heroes');
    for (let i = 0; i < 3; i++) h.tap('up');
    expect(focused(r)).toBe('Game mode');
    expect(h.said.at(-1)).toMatch(/^Game mode: All heroes/);
  });
});

describe('item 54: the Classic pause is a Classic box', () => {
  it('a box (no title row), the original’s sounds, BACK closes it; the pages it opens are boxes too', () => {
    const h = classic();
    pausedClassicRun(h);
    const pause = h.top() as PauseScene;
    expect(pause.boxed).toBe(true);
    // No PAUSE title and no REMIX logo: the original's pause box has neither.
    const shot = draw(pause);
    expect(shot.texts.map((t) => t.str)).toContain('CONTINUE');
    expect(shot.texts.map((t) => t.str)).not.toContain('PAUSE');
    expect(shot.sprites.some((s) => s.frame === 'smbc-line')).toBe(false);
    h.idle(8);
    h.audio.sfx.mockClear();
    h.tap('down');
    expect(h.audio.sfx).toHaveBeenCalledWith('fireball');
    pick(h, 'Options');
    const options = h.top() as OptionsScene;
    expect(options).toBeInstanceOf(OptionsScene);
    expect(options.boxed).toBe(true);
    expect(h.said.at(-1)).toMatch(/^Options\. Video/);
    pick(h, 'Video');
    const video = h.top() as MenuScene;
    expect(video.boxed).toBe(true);
    // BACK one box at a time: Video, Options, then the pause itself (the game goes on).
    h.idle(8);
    h.audio.sfx.mockClear();
    h.tap('attack');
    expect(h.audio.sfx).toHaveBeenCalledWith('bump');
    expect(h.top()).toBe(options);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBe(pause);
    expect(h.said.at(-1)).toBe('Options');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(LevelScene);
  });

  it('Cheats and the Quit card are boxes over the level', () => {
    const h = classic();
    pausedClassicRun(h);
    pick(h, 'Cheats');
    expect(h.top()).toBeInstanceOf(CheatsScene);
    expect((h.top() as CheatsScene).boxed).toBe(true);
    h.idle(8);
    h.tap('attack');
    pick(h, 'Quit');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
  });

  it('touch: the pause shows a BACK button and OK picks the row', () => {
    const h = classic();
    pausedClassicRun(h);
    const t = (h.top() as PauseScene).touchLabels();
    expect(t.jump).toBe('OK');
    expect(t.attack).not.toBeNull();
  });

  it('the campaign pause is unchanged: the panel, no BACK', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    h.game.scenes.push(new PauseScene(h.game, l.world));
    const pause = h.top() as PauseScene;
    expect(pause.boxed).toBe(false);
    expect((pause as unknown as { onBack: unknown }).onBack).toBeNull();
    expect(draw(pause).texts.map((t) => t.str)).toContain('PAUSE');
    h.idle(8);
    pick(h, 'Options');
    expect((h.top() as MenuScene).boxed).toBe(false);
  });
});

describe('item 55: the Classic pause’s Guide is the hero’s tutorial boxes', () => {
  it('Link: his start box, then what his Mushroom and Flower bring; abilities named, never a key letter', () => {
    const h = classic();
    // The real announcer's last line (TutorialBoxScene says it again as it closes).
    Object.defineProperty(h.game.deps.announcer, 'lastText', { get: () => h.said.at(-1) ?? '' });
    pausedClassicRun(h, LINK);
    expect(guideTutorials(h.game, 'link')).toEqual([
      'linkStart',
      'linkBlueRing',
      'linkBomb',
      'linkRedRing',
      'linkBombBag',
    ]);
    pick(h, 'Guide');
    const box = h.top() as TutorialBoxScene;
    expect(box).toBeInstanceOf(TutorialBoxScene);
    expect(box.pages).toEqual(guidePages(h.game, 'link'));
    expect(box.pages[0]).toMatch(/^Link:/);
    for (const p of box.pages) expect(p).not.toMatch(/[{}]|\bpress [A-Z]\b/);
    h.idle(1);
    expect(h.said.at(-1)).toMatch(/^Tutorial, page 1 of 6\. Link:/);
    // Nothing turns a page by itself; OK does.
    h.idle(TUTORIAL_GUARD_FRAMES * 4);
    expect(box.pageIndex).toBe(0);
    h.tap('jump');
    expect(box.pageIndex).toBe(1);
    // SKIP closes it: back on the pause, which says its Guide row again.
    h.idle(TUTORIAL_GUARD_FRAMES + 1);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(h.said.at(-1)).toMatch(/^Guide/);
    // The Guide does not count as the run's own boxes seen.
    expect(h.game.classicTutorials.seen).not.toContain('linkStart');
  });

  it('Mario has his own box; a hero the original has none for gets how every hero controls', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    expect(guideTutorials(h.game, 'mario')).toEqual(['marioStart']);
    expect(guideTutorials(h.game, 'arthur')).toEqual(['firstCharacterStart']);
  });
});

describe('item 61: the dev START page offers every hero', () => {
  it('a hero Toggle heroes set Off is still offered and plays', () => {
    const h = classic({ dev: true });
    h.settings.classicDev = { yoshiMount: false, heroesOff: ['yoshi', 'arthur'] };
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    const ids = start.heroes.map((c) => c.id);
    expect(ids).toContain('yoshi');
    expect(ids).toContain('arthur');
    // Toggle heroes still decides Classic play: its select leaves them out.
    expect(h.game.devSlotsFor('classic').map((c) => c.id)).not.toContain('yoshi');
    const hero = items(start).find((i) => i.label === 'Hero') as MenuItem;
    for (let i = 0; i < 40 && start.hero.id !== 'yoshi'; i++) hero.adjust?.(1);
    expect(start.hero.id).toBe('yoshi');
    h.game.scenes.push(start);
    pick(h, 'Start');
    inLevel(h);
    expect(h.game.state.character.id).toBe('yoshi');
  });
});

describe('item 67: Pause > Dev mode > Dev mode off', () => {
  it('back on the pause, on Continue, saying so', () => {
    const h = classic({ dev: true });
    pausedClassicRun(h);
    pick(h, 'Dev mode');
    expect(h.top()).toBeInstanceOf(DevMenuScene);
    pick(h, 'Dev mode off');
    const pause = h.top() as PauseScene;
    expect(pause).toBeInstanceOf(PauseScene);
    expect(labels(pause)).not.toContain('Dev mode');
    expect(focused(pause)).toBe('Continue');
    expect(h.said.at(-1)).toBe('Dev mode off. Continue');
  });
});

describe('items 63 / 64: the dev Level select takes its runs back to itself', () => {
  function devStart(h: H, level = '1-2'): LevelScene {
    h.game.showTitle();
    h.game.showDevMenu();
    pick(h, 'Level select');
    pick(h, 'Classic');
    pick(h, 'Super Mario Bros.');
    pick(h, 'World 1');
    pick(h, level.slice(-3));
    pick(h, 'Start');
    return inLevel(h);
  }
  const onPage = (h: H, row: string) => {
    const page = h.top() as DevLevelPage;
    expect(page).toBeInstanceOf(DevLevelPage);
    expect(focused(page)).toBe(row);
    expect(h.said.at(-1)).toMatch(new RegExp(`^SMB 1\\. ${row}\\.`));
  };

  it('a cleared level goes back to its level page, on that level; BACK steps back a page at a time', () => {
    const h = classic({ dev: true });
    const before = written();
    const l = devStart(h);
    clear(l, '1-3');
    onPage(h, '1-2');
    expect(h.game.scenes.find((s) => s instanceof LevelScene)).toBeUndefined();
    h.idle(8);
    h.tap('attack');
    expect(focused(h.top())).toBe('World 1');
    expect(written()).toEqual(before);
  });

  it('Quit goes back there too', () => {
    const h = classic({ dev: true });
    devStart(h);
    h.idle(4);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(items(h.top()).find((i) => i.label === 'Quit')?.hint).toBe('Back to the level select');
    pick(h, 'Quit');
    onPage(h, '1-2');
  });

  it('after the last castle’s credits: the level select, not the title', () => {
    const h = classic({ dev: true });
    devStart(h);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(h.top()).toBeInstanceOf(DevLevelPage);
    expect(h.game.scenes.find((s) => s instanceof TitleScene)).toBeDefined();
  });

  it('a start with no START page (a dev link) still goes on to the next level', () => {
    const h = classic({ dev: true });
    h.game.devStart('1-1', MARIO, 'small');
    const l = inLevel(h);
    expect(h.game.levelSelectBack).toBe(false);
    clear(l, '1-2');
    expect(inLevel(h).level.id).toBe('1-2');
  });
});

describe('items 63 / 64: the menus’ Level Select cheat takes its practice runs back to itself', () => {
  function practice(h: H & { settings: Settings }): LevelScene {
    h.settings.classicCheats.levelSelect = true;
    h.game.showClassicTitle('start');
    pick(h, 'Options');
    pick(h, 'Cheats');
    pick(h, 'Level select');
    h.idle(8);
    h.tap('down');
    h.tap('right'); // World 2
    h.tap('down');
    h.tap('right'); // Level 2
    pick(h, 'Go');
    chooseHero(h);
    return inLevel(h);
  }
  const onGo = (h: H, level: string) => {
    const page = h.top() as LevelSelectScene;
    expect(page).toBeInstanceOf(LevelSelectScene);
    expect(focused(page)).toBe('Go');
    expect(items(page)[3]?.value?.()).toBe(level);
    expect(h.said.at(-1)).toMatch(new RegExp(`^Level select\\. Go: ${level}\\.`));
    // Over Cheats over Options over the CLASSIC title: BACK steps back one box.
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(CheatsScene);
    expect(focused(h.top())).toBe('Level select');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicTitleScene);
  };

  it('a cleared level goes back to the Level select, on that level', () => {
    const h = classic();
    const l = practice(h);
    expect(l.level.id).toMatch(/^2-2/);
    const before = written();
    clear(l, '2-3');
    expect(h.game.practiceRun).toBe(false);
    onGo(h, '2-2');
    expect(written()).toEqual(before);
  });

  it('Quit asks “Quit to the level select?”, then goes there', () => {
    const h = classic();
    practice(h);
    h.idle(4);
    h.tap('start');
    pick(h, 'Quit');
    const card = h.top() as QuitRunScene;
    expect(card.title).toBe(QUIT_PRACTICE_TITLE);
    expect(h.said.at(-1)).toBe('Quit to the level select? No');
    h.idle(8);
    h.tap('down');
    h.tap('jump');
    onGo(h, '2-2');
  });

  it('after the last castle’s credits: the Level select, not the title', () => {
    const h = classic();
    practice(h);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(h.top()).toBeInstanceOf(LevelSelectScene);
  });

  it('BACK from its hero select goes back to the Level select too', () => {
    const h = classic();
    h.settings.classicCheats.levelSelect = true;
    h.game.classicLevelSelect('3-1');
    h.until(() => h.top() instanceof CharacterSelectScene, 600);
    h.idle(12);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(LevelSelectScene);
    expect(items(h.top())[3]?.value?.()).toBe('3-1');
  });
});
