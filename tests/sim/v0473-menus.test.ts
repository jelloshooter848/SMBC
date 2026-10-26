import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import { allUnlocked, CHEATS, unlockAll } from '@game/cheats';
import { originalFileRules } from '@game/original-files';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { CheatsScene } from '@game/scenes/cheats-menu';
import { DevMenuScene } from '@game/scenes/dev';
import { GuideIndexScene, GuideScene } from '@game/scenes/guide';
import { ClassicTutorialHeroesScene } from '@game/scenes/how-to-play-boxes';
import { DEV_LAST_KEY, DevLevelPage, DevStartScene } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import { GameOverScene } from '@game/scenes/game-over';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { ClassicFileRulesScene } from '@game/scenes/original-files-menu';
import { recordClassicBeat } from '@game/scenes/original-game';
import { PauseScene } from '@game/scenes/pause';
import { QuitRunScene } from '@game/scenes/quit-run';
import { TitleScene } from '@game/scenes/title';
import {
  guidePages,
  guideTutorials,
  TUTORIAL_GUARD_FRAMES,
  TutorialBoxScene,
} from '@game/tutorial/original-tutorials';
import { draw, file, intoBonus, makeGame, store, useStorage, type H } from './heroes-harness';

// v0.4.73 PR B (menus): items 53, 54, 55, 61, 63/64 (dev Level select), 67, 82 and 94.

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

  it('a game over goes back there too (review: as a clear, Quit and the credits do)', () => {
    const h = classic({ dev: true });
    devStart(h);
    h.game.gameOver('1-2');
    h.until(() => h.top() instanceof GameOverScene && (h.top() as GameOverScene).prompting, 900);
    h.tap('down'); // NO
    h.tap('jump');
    onPage(h, '1-2');
  });

  it('Lost 8-4 says only THANK YOU, then goes back to its level page (no PUSH BUTTON B)', () => {
    const h = classic({ dev: true });
    h.game.showTitle();
    h.game.showDevMenu();
    pick(h, 'Level select');
    pick(h, 'Classic');
    pick(h, 'The Lost Levels');
    pick(h, 'World 8');
    pick(h, '8-4');
    pick(h, 'Start');
    inLevel(h);
    h.game.showEnding('ll-8-4');
    const card = h.top() as CardScene;
    expect(card).toBeInstanceOf(CardScene);
    expect(card.lines.join(' ')).not.toMatch(/PUSH BUTTON B|SELECT A WORLD/);
    for (let i = 0; i < 6 && !(h.top() instanceof DevLevelPage); i++) {
      h.idle(CARD_GUARD_FRAMES + 60);
      h.tap('start'); // the card's OK (Start or B, as the NES card)
    }
    expect(h.top()).toBeInstanceOf(DevLevelPage);
    expect(focused(h.top())).toBe('8-4');
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

describe('item 94: the Level Select cheat is gone', () => {
  const SIXTEEN = [
    'allGroundIsBricks',
    'allHammerBros',
    'allWeaponsPierce',
    'alwaysBreakBricks',
    'bouncyPits',
    'classicSamus',
    'classicScreenScroll',
    'classicSimon',
    'everyoneCanStomp',
    'evilHammerBros',
    'extraCheckpoints',
    'infiniteAmmo',
    'infiniteLives',
    'infiniteTime',
    'invincible',
    'waterMode',
  ];

  /** Settings as an old version stored them, the Level Select cheat unlocked. */
  function oldBlob(): Settings {
    const old = defaultSettings() as unknown as { classicCheats: Record<string, unknown> };
    old.classicCheats.levelSelect = true;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    return loadSettings();
  }

  it('an old settings blob with the cheat unlocked loads cleanly', () => {
    const s = oldBlob();
    expect(s.classicCheats.unlocked.everyoneCanStomp).toBe(true);
    for (const id of SIXTEEN)
      expect(typeof s.classicCheats.unlocked[id as keyof typeof s.classicCheats.unlocked]).toBe('boolean');
  });

  it('no Level select row in CHEATS, with or without the old flag, or with dev mode’s every cheat', () => {
    for (const all of [false, true]) {
      const h = classic(oldBlob());
      h.game.scenes.push(new CheatsScene(h.game, () => h.game.scenes.pop(), { all }));
      expect(labels(h.top())).not.toContain('Level select');
      const h2 = classic();
      h2.game.scenes.push(new CheatsScene(h2.game, () => h2.game.scenes.pop(), { all }));
      expect(labels(h2.top())).not.toContain('Level select');
    }
  });

  it('no Level select row in the Classic pause, with the old flag too', () => {
    const h = classic(oldBlob());
    pausedClassicRun(h);
    expect(labels(h.top())).not.toContain('Level select');
    const d = classic({ ...oldBlob(), dev: true });
    pausedClassicRun(d);
    expect(labels(d.top())).not.toContain('Level select');
  });

  it('the other 16 cheats are as they were; the code unlocking them is every cheat', () => {
    expect(CHEATS.map((c) => c.id)).toEqual(SIXTEEN);
    const c = defaultSettings().classicCheats;
    expect(allUnlocked(c)).toBe(false);
    for (const id of SIXTEEN) c.unlocked[id as keyof typeof c.unlocked] = true;
    expect(allUnlocked(c)).toBe(true);
    const d = defaultSettings().classicCheats;
    unlockAll(d);
    expect(allUnlocked(d)).toBe(true);
    expect('levelSelect' in d).toBe(false);
  });

  it('beating every set on Hard shows no Level Select card and grants nothing', () => {
    const h = classic();
    recordClassicBeat('smb', 'hard');
    recordClassicBeat('special', 'hard');
    const rules = originalFileRules();
    rules.difficulty = 'hard';
    h.game.classicGame(MARIO, '8-4', { ref: { set: 'lost', slot: 1 }, rules });
    inLevel(h);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('ll-13-4');
    for (let i = 0; i < 30; i++) {
      h.idle(70);
      h.tap('jump');
    }
    expect(h.said.join('\n')).not.toMatch(/Level Select/i);
    expect(JSON.stringify(h.settings.classicCheats)).not.toMatch(/levelSelect/);
  });

  it('the dev Level select keeps its return (items 63 / 64)', () => {
    const h = classic({ dev: true });
    h.game.showTitle();
    h.game.showDevMenu();
    pick(h, 'Level select');
    pick(h, 'Classic');
    pick(h, 'Super Mario Bros.');
    pick(h, 'World 2');
    pick(h, '2-3');
    pick(h, 'Start');
    const l = inLevel(h);
    clear(l, '2-4');
    expect(h.top()).toBeInstanceOf(DevLevelPage);
    expect(focused(h.top())).toBe('2-3');
  });
});

describe('item 82: Classic Options > How to play is the Classic tutorial boxes', () => {
  /** The hero list's rows (no Back). */
  const heroes = (h: H) => labels(h.top()).filter((l) => l !== 'Back');

  it('CLASSIC > Options > Video, audio, controls > How to play: a box of the select’s heroes, each its tutorial', () => {
    const h = classic();
    h.game.showClassicTitle('start');
    pick(h, 'Options');
    pick(h, 'Video, audio, controls');
    pick(h, 'How to play');
    const list = h.top() as ClassicTutorialHeroesScene;
    expect(list).toBeInstanceOf(ClassicTutorialHeroesScene);
    expect(list.boxed).toBe(true);
    expect(heroes(h)).toEqual(h.game.slotsFor('classic').map((c) => c.name));
    expect(h.said.at(-1)).toMatch(/^How to play\. Mario/);
    // The CLASSIC title's demo shows round the box (its logo too), as the other CLASSIC boxes.
    const shot = draw(list);
    expect(shot.texts.map((t) => t.str)).toContain('MARIO');
    pick(h, 'Link');
    const box = h.top() as TutorialBoxScene;
    expect(box).toBeInstanceOf(TutorialBoxScene);
    expect(box.pages).toEqual(guidePages(h.game, 'link'));
    // SKIP: back on the list, on Link; BACK: one box back.
    h.idle(TUTORIAL_GUARD_FRAMES + 2);
    h.tap('attack');
    expect(h.top()).toBe(list);
    expect(focused(list)).toBe('Link');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(OptionsScene);
  });

  it('Classic pause > Options > How to play: the same list (the run’s select), a box over the level', () => {
    const h = classic();
    pausedClassicRun(h, LINK);
    pick(h, 'Options');
    pick(h, 'How to play');
    const list = h.top() as ClassicTutorialHeroesScene;
    expect(list).toBeInstanceOf(ClassicTutorialHeroesScene);
    expect(list.boxed).toBe(true);
    expect(list.translucent).toBe(true);
    expect(heroes(h)).toEqual(h.game.selectSlots.map((c) => c.name));
    pick(h, 'Samus');
    expect((h.top() as TutorialBoxScene).pages[0]).toMatch(/^Samus:/);
  });

  it('the campaign’s Options and pause keep GuideIndexScene and GuideScene', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    h.game.scenes.push(new PauseScene(h.game, l.world));
    pick(h, 'Options');
    pick(h, 'How to play');
    expect(h.top()).toBeInstanceOf(GuideIndexScene);
    pick(h, 'Mario');
    expect(h.top()).toBeInstanceOf(GuideScene);
    h.game.scenes.clear();
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
    pick(h, 'How to play');
    expect(h.top()).toBeInstanceOf(GuideIndexScene);
  });
});
