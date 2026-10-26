import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  DEV_LAST_KEY,
  DevCampaignScene,
  DevClassicScene,
  DevStartScene,
  areaName,
  areasOf,
  loadDevPick,
} from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { WorldMapScene } from '@game/scenes/world-map';
import { levelIds, specialLevelIds } from '@content/levels';
import { loadSave, writeSave } from '@game/save/save-files';
import { file, makeGame, store, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// O-05 (RC audit addendum): the dev Level select as pages. Dev > Classic: map set, world, level
// (or its areas), then the START page with the hero, look, power, Map difficulty, rules, mode and
// kit. Dev > Campaign: the world map and files on a scratch copy, story levels, village, tutorial,
// training rooms and games. Again replays the last start. Keys, pad and touch (MenuScene), read out.

isolateClassicRegistry();
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

function dev(): H {
  return makeGame({
    deps: {
      settings: { ...defaultSettings(), dev: true } as Settings,
      applySettings: () => {},
      listLevels: () => [...levelIds(), ...specialLevelIds()],
    },
  });
}

/** Moves the cursor of the menu on top to `label` (down, or up when nearer) and presses OK. */
function pick(h: H, label: string): number {
  const all = labels(h.top());
  const at = all.indexOf(label);
  expect(at, `${label} in ${all.join(', ')}`).toBeGreaterThanOrEqual(0);
  h.idle(8);
  const index = (h.top() as unknown as { index: number }).index;
  const down = (at - index + all.length) % all.length;
  const up = all.length - down;
  for (let i = 0; i < Math.min(down, up); i++) h.tap(down <= up ? 'down' : 'up');
  h.tap('jump');
  return Math.min(down, up) + 1;
}

/** Steps row `label` of the START page right until `pred` holds. */
function stepTo(h: H, label: string, pred: () => boolean): number {
  let n = pick(h, label) - 1; // the OK press on an adjust row stepped it once already
  for (let i = 0; i < 60 && !pred(); i++, n++) h.tap('right');
  expect(pred(), label).toBe(true);
  return n + 1;
}

const enterLevel = (h: H): LevelScene => {
  h.until(() => h.top() instanceof LevelScene, 900);
  return h.top() as LevelScene;
};

describe('O-05: the dev Level select as pages', () => {
  it('the Dev menu opens Classic and Campaign; no Again row until a start was made', () => {
    const h = dev();
    h.game.showDevMenu();
    const menu = labels(h.top());
    // BUG-09: one Level select, which opens Classic and Campaign.
    expect(menu[0]).toBe('Level select');
    expect(menu).not.toContain('Again');
    pick(h, 'Level select');
    expect(labels(h.top()).slice(0, 2)).toEqual(['Classic', 'Campaign']);
  });

  // 0.4.72 (owner item 7): no Mode row; the start is free play, and Map difficulty plays in it.
  it('keys: Lost Levels D-4 as Samus with the Fire Flower on Hard, in under 30 presses, read out', () => {
    const h = dev();
    h.game.showDevMenu();
    let presses = pick(h, 'Level select'); // BUG-09
    presses += pick(h, 'Classic');
    expect(h.top()).toBeInstanceOf(DevClassicScene);
    expect(h.said.at(-1)).toMatch(/^Classic\. Super Mario Bros\./);
    presses += pick(h, 'The Lost Levels');
    expect(labels(h.top())).toContain('World D');
    presses += pick(h, 'World D');
    presses += pick(h, 'D-4');
    const start = h.top() as DevStartScene;
    expect(start).toBeInstanceOf(DevStartScene);
    expect(labels(start)).toEqual([
      'Start',
      'Hero',
      'Look',
      'Power',
      // 0.4.72 (owner item 6): None / Yoshi.
      'Mount',
      'Map difficulty',
      'Rules',
      'Kit',
      'Back',
    ]);
    expect(h.said.at(-1)).toMatch(/^Start\. Start: Lost Levels D-4\. Starts the level/);
    presses += stepTo(h, 'Hero', () => start.hero.id === 'samus');
    presses += stepTo(h, 'Power', () => start.pick.power === 'fire');
    presses += stepTo(h, 'Map difficulty', () => start.pick.difficulty === 'hard');
    expect(h.said.at(-1)).toMatch(/^Map difficulty: Hard/);
    presses += pick(h, 'Start');
    expect(presses).toBeLessThan(30);
    const l = enterLevel(h);
    expect(l.level.id.startsWith('ll-13-4')).toBe(true);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.state.lives).toBe(99);
    expect(h.game.liveRules).toBe('classic');
    expect(h.game.ctx.mapDifficulty).toBe('hard');
    expect(l.world.mapDifficulty).toBe('hard');
    expect(h.game.state.character.id).toBe('samus');
    expect(h.game.state.powerState).toBe('fire');
  });

  it("the Hero row offers the select slots, not every look; Look steps that hero's skins", () => {
    const h = dev();
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    const heroes = start.heroes.map((c) => c.id);
    // 0.4.72 (owner): the dev select's heroes (every hero not set Off), Game.devSlotsFor.
    expect(heroes).toEqual(h.game.devSlotsFor('classic').map((c) => c.id));
    expect(heroes).not.toContain('peach');
    const hero = items(start).find((i) => i.label === 'Hero') as MenuItem;
    for (let i = 0; i < heroes.length && start.hero.id !== 'luigi'; i++) hero.adjust?.(1);
    const look = items(start).find((i) => i.label === 'Look') as MenuItem;
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(start.look.id);
      look.adjust?.(1);
    }
    expect(seen.has('luigi')).toBe(true);
    expect(seen.size).toBe(start.looks.length);
  });

  // 0.4.72 (owner item 7): every start is free play; Map difficulty plays under Classic rules.
  it('Map difficulty plays under Classic rules: else Normal, and it says so', () => {
    const h = dev();
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    const row = (l: string) => items(start).find((i) => i.label === l) as MenuItem;
    row('Map difficulty').adjust?.(1);
    expect(start.pick.difficulty).toBe('hard');
    row('Rules').adjust?.(1); // Campaign
    expect(row('Map difficulty').value?.()).toBe('Normal');
    expect(row('Map difficulty').hint).toMatch(/Only with Classic SMBC rules/);
    expect(start.pick.difficulty).toBe('normal');
    row('Start').select?.();
    enterLevel(h);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.state.lives).toBe(99);
    expect(h.game.ctx.mapDifficulty).toBeUndefined();
  });

  it('Again replays the last start in one press, and names it', () => {
    const h = dev();
    const start = new DevStartScene(h.game, { branch: 'classic', level: 'sp-2-3', name: 'Special 2-3' });
    (items(start).find((i) => i.label === 'Map difficulty') as MenuItem).adjust?.(-1); // Easy
    items(start)
      .find((i) => i.label === 'Start')
      ?.select?.();
    expect(store.has(DEV_LAST_KEY)).toBe(true);
    expect(loadDevPick(h.game)?.level).toBe('sp-2-3');
    h.game.showTitle();
    h.game.showDevMenu();
    const menu = h.top() as MenuScene;
    expect(labels(menu)[0]).toBe('Again');
    expect(items(menu)[0]?.hint).toMatch(/Special 2-3, Mario, small, Classic SMBC, Easy/);
    h.idle(8);
    h.tap('jump');
    const l = enterLevel(h);
    expect(l.level.id).toBe('sp-2-3');
    expect(h.game.ctx.mapDifficulty).toBe('easy');
  });

  it('a kept start naming a level or hero this build lacks is ignored', () => {
    const h = dev();
    store.set(DEV_LAST_KEY, JSON.stringify({ branch: 'classic', level: 'nope', name: 'x', hero: 'mario' }));
    expect(loadDevPick(h.game)).toBeNull();
    h.game.showDevMenu();
    expect(labels(h.top())).not.toContain('Again');
  });

  it('a level with rooms lists them under Areas, each a start of its own', () => {
    const h = dev();
    expect(areasOf(h.game, '1-2')).toEqual(expect.arrayContaining(['1-2', '1-2-intro', '1-2-bonus']));
    expect(areasOf(h.game, '1-1')).not.toContain('1-10');
    h.game.scenes.push(new DevClassicScene(h.game));
    pick(h, 'Super Mario Bros.');
    pick(h, 'World 1');
    pick(h, '1-2 areas');
    pick(h, '1-2 bonus');
    pick(h, 'Start');
    expect(enterLevel(h).level.id).toBe('1-2-bonus');
  });

  it('touch: OK on the page rows, CHANGE on the START page settings, BACK on every page', () => {
    const h = dev();
    h.game.scenes.push(new DevClassicScene(h.game));
    expect((h.top() as MenuScene).touchLabels().jump).toBe('OK');
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    h.game.scenes.push(start);
    h.idle(8);
    h.tap('down');
    expect(start.touchLabels().jump).toBe('CHANGE');
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(DevClassicScene);
  });
});

describe('O-05 QA: kept picks, Rules and spoken titles', () => {
  const kept = (over: Record<string, unknown>) =>
    store.set(
      DEV_LAST_KEY,
      JSON.stringify({
        branch: 'classic',
        level: '1-1',
        name: 'SMB 1-1',
        hero: 'mario',
        look: 'mario',
        power: 'small',
        kit: false,
        rules: 'classic',
        classicRun: true,
        difficulty: 'normal',
        ...over,
      }),
    );

  it("a kept power the hero does not have falls back to its first state (never 'banana', never fire on an hp hero)", () => {
    const h = dev();
    kept({ power: 'banana' });
    expect(loadDevPick(h.game)?.power).toBe('small');
    h.game.showDevMenu();
    h.idle(8);
    h.tap('jump'); // Again
    enterLevel(h);
    expect(h.game.state.powerState).toBe('small');
    kept({
      branch: 'campaign',
      hero: 'link',
      look: 'link',
      power: 'fire',
      rules: 'campaign',
      classicRun: false,
    });
    expect(loadDevPick(h.game)?.power).toBe('full');
  });

  it('a kept hero the START page no longer offers is ignored (an Expansion hero set Off)', () => {
    const h = dev();
    const s = h.game.deps.settings as Settings;
    s.classicDev = { yoshiMount: false, heroesOff: [], heroesOn: ['yoshi'] };
    kept({ hero: 'yoshi', look: 'yoshi' });
    expect(loadDevPick(h.game)?.hero).toBe('yoshi');
    // 0.4.72 (owner): Release is still offered in dev mode; Off is not.
    delete s.classicDev.heroesOn;
    expect(loadDevPick(h.game)?.hero).toBe('yoshi');
    s.classicDev.heroesOff = ['yoshi'];
    // v0.4.73 item 61 (owner): the START page offers every hero, so a hero set Off is kept too.
    expect(loadDevPick(h.game)?.hero).toBe('yoshi');
    // A look that is not that hero's is ignored too.
    kept({ hero: 'mario', look: 'link' });
    expect(loadDevPick(h.game)).toBeNull();
  });

  it('Rules keeps the hero when the other rules offer it, else the first hero; the row says who', () => {
    const h = dev();
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    h.game.scenes.push(start);
    h.idle(8);
    const row = (l: string) => items(start).find((i) => i.label === l) as MenuItem;
    for (let i = 0; i < 20 && start.hero.id !== 'samus'; i++) row('Hero').adjust?.(1);
    stepTo(h, 'Rules', () => start.pick.rules === 'campaign');
    expect(start.hero.id).toBe('samus');
    expect(h.said.at(-1)).toMatch(/^Rules: Campaign\..*Hero: Samus$/);
    row('Rules').adjust?.(1); // back to Classic SMBC
    for (let i = 0; i < 20 && start.hero.id !== 'bass'; i++) row('Hero').adjust?.(1);
    expect(start.hero.id).toBe('bass');
    row('Rules').adjust?.(1); // Campaign rules have no Bass
    expect(start.hero.id).toBe(h.game.slotsFor('campaign')[0]?.id);
    expect(row('Rules').hint).toMatch(/Hero: Mario$/);
  });

  it('page titles are said with their own casing', () => {
    const h = dev();
    h.game.scenes.push(new DevClassicScene(h.game));
    pick(h, 'The Lost Levels');
    pick(h, 'World D');
    expect(h.said.at(-1)).toMatch(/^Lost Levels D\. D-1/);
    expect((h.top() as MenuScene).title).toBe('LOST LEVELS D');
  });
});

describe('O-05 review: every area reachable, Again checked on the press, readable names', () => {
  /** Every level id the START pages under `page` start, opening each row that opens a page. */
  function reach(h: H, page: MenuScene, seen = new Set<string>()): Set<string> {
    for (const it of items(page)) {
      if (it.label === 'Back' || !it.select) continue;
      const depth = h.game.scenes.depth;
      it.select();
      const top = h.top();
      if (top instanceof DevStartScene) seen.add(top.target.level);
      else if (top !== page && h.game.scenes.depth > depth) reach(h, top as MenuScene, seen);
      while (h.game.scenes.depth > depth) h.game.scenes.pop();
    }
    return seen;
  }

  it('every SMB, Lost Levels and Special area is reached from the Classic or Campaign pages', () => {
    const h = dev();
    const classic = new DevClassicScene(h.game);
    h.game.scenes.push(classic);
    const seen = reach(h, classic);
    const campaign = new DevCampaignScene(h.game);
    // Only the pages that start levels (World map, files and games open other scenes).
    for (const label of ['Story level', 'Lost story level', 'Tutorial 1-0']) {
      h.game.scenes.push(campaign);
      const it = items(campaign).find((i) => i.label === label) as MenuItem;
      it.select?.();
      const top = h.top();
      if (top instanceof DevStartScene) seen.add(top.target.level);
      else reach(h, top as MenuScene, seen);
      while (h.top() !== classic) h.game.scenes.pop();
    }
    const missing = [...levelIds(), ...specialLevelIds()].filter((id) => !seen.has(id));
    expect(missing).toEqual([]);
    for (const id of ['8-5', '2-top-secret', '1-0-pipe']) expect(seen.has(id), id).toBe(true);
  });

  it('the world rooms outside the four levels are under Other rooms, with readable names', () => {
    const h = dev();
    h.game.scenes.push(new DevClassicScene(h.game));
    pick(h, 'Super Mario Bros.');
    pick(h, 'World 8');
    pick(h, 'Other rooms');
    expect(labels(h.top())).toContain('8-5');
    h.game.scenes.pop();
    h.game.scenes.pop();
    pick(h, 'World 2');
    pick(h, 'Other rooms');
    expect(labels(h.top())).toContain('2 top secret');
    expect(h.said.at(-1)).toMatch(/^SMB 2 other rooms\./);
    pick(h, '2 top secret');
    expect((h.top() as DevStartScene).target).toMatchObject({ level: '2-top-secret', name: '2 top secret' });
    expect(areaName('ll-10-2-intro', 'll-')).toBe('A-2 intro');
    expect(areaName('1-0-pipe', '')).toBe('1-0 pipe');
    expect(areaName('sp-3-1-bonus', 'sp-')).toBe('3-1 bonus');
  });

  it('the two Campaign world pages have their own titles', () => {
    const h = dev();
    h.game.scenes.push(new DevCampaignScene(h.game));
    pick(h, 'Story level');
    expect(h.said.at(-1)).toMatch(/^Story: SMB worlds\./);
    expect((h.top() as MenuScene).title).toBe('STORY: SMB WORLDS');
    h.game.scenes.pop();
    pick(h, 'Lost story level');
    expect(h.said.at(-1)).toMatch(/^Story: Lost Levels worlds\./);
  });

  // 0.4.72 (owner): a hero back on Release is still offered in dev mode, so only Off stops Again.
  it.each(['off'] as const)(
    // v0.4.73 item 61 (owner): the START page offers every hero, so Again starts it all the same.
    'Again is checked on the press: a hero set to %s since still starts (item 61)',
    (now) => {
      const h = dev();
      const s = h.game.deps.settings as Settings;
      s.classicDev = { yoshiMount: false, heroesOff: [], heroesOn: ['yoshi'] };
      const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
      const hero = items(start).find((i) => i.label === 'Hero') as MenuItem;
      for (let i = 0; i < 20 && start.hero.id !== 'yoshi'; i++) hero.adjust?.(1);
      saveDevPick(start);
      h.game.showTitle();
      h.game.showDevMenu();
      const menu = h.top() as MenuScene;
      expect(labels(menu)[0]).toBe('Again');
      // Dev > Classic heroes changes while the Dev menu is open.
      delete s.classicDev.heroesOn;
      if (now === 'off') s.classicDev.heroesOff = ['yoshi'];
      h.idle(8);
      h.tap('jump');
      expect(h.said.join('\n')).not.toMatch(/Again cannot start/);
      h.until(() => h.game.scenes.find((x) => x instanceof LevelScene) !== undefined, 600);
      expect(h.game.state.character.id).toBe('yoshi');
    },
  );
});

/** Keeps `start`'s pick as Again's, as its Start row does, without starting it. */
function saveDevPick(start: DevStartScene): void {
  store.set(DEV_LAST_KEY, JSON.stringify(start.pick));
}

describe('O-05: the Campaign branch', () => {
  it('a story level starts as free play under Campaign rules, with no file', () => {
    const h = dev();
    h.game.scenes.push(new DevCampaignScene(h.game));
    pick(h, 'Lost story level');
    pick(h, 'Lost world 2');
    pick(h, '2-1');
    const start = h.top() as DevStartScene;
    expect(labels(start)).toEqual(['Start', 'Hero', 'Power', 'Kit', 'Back']);
    expect(start.heroes).toEqual(h.game.deps.characters);
    pick(h, 'Start');
    const l = enterLevel(h);
    expect(l.level.id.startsWith('ll-2-1')).toBe(true);
    expect(h.game.campaign).toBeNull();
    expect(h.game.liveRules).toBe('campaign');
    expect(h.game.state.lives).toBe(99);
  });

  it('World map: a new file with every world open, played as the campaign; nothing is ever saved', () => {
    const h = dev();
    h.game.scenes.push(new DevCampaignScene(h.game));
    pick(h, 'World map');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.campaign?.scratch).toBe(true);
    expect(h.game.mapUnlockAll).toBe(true);
    h.game.autosave();
    h.game.markSeen('o05-test-beat');
    h.game.markExplained('o05-test-tip');
    expect([...store.keys()].filter((k) => k.startsWith('smbc.save.'))).toEqual([]);
  });

  it('Open a file: a copy of the slot; play on it never writes the slot', () => {
    const h = dev();
    writeSave(file({ slot: 2, lives: 7 }));
    const before = store.get('smbc.save.2');
    h.game.scenes.push(new DevCampaignScene(h.game));
    pick(h, 'Open a file');
    expect(items(h.top())[0]?.value?.()).toBe('Empty');
    pick(h, 'File 2');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.state.lives).toBe(7);
    h.game.state.lives = 1;
    h.game.autosave();
    expect(store.get('smbc.save.2')).toBe(before);
    expect(loadSave(2)?.lives).toBe(7);
  });

  it('training rooms, village, tutorial and the games are listed', () => {
    const h = dev();
    h.game.scenes.push(new DevCampaignScene(h.game));
    expect(labels(h.top())).toEqual([
      'World map',
      'Open a file',
      'Story level',
      'Lost story level',
      'Village',
      'Tutorial 1-0',
      'Training rooms',
      'Mini games',
      'Bonus games',
      'Back',
    ]);
    pick(h, 'Training rooms');
    expect(labels(h.top())).toContain('Luigi');
    expect(labels(h.top())).not.toContain('Mario');
  });
});
