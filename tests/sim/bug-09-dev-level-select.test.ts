import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { DevCampaignScene, DevClassicScene, DevLevelPagesScene, DevStartScene } from '@game/scenes/dev-play';
import { DevMenuScene } from '@game/scenes/dev';
import { DevMiniGamesScene } from '@game/scenes/dev-minigames';
import { DevBonusGamesScene } from '@game/bonus/dev';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { levelIds, specialLevelIds } from '@content/levels';
import { DEV_VILLAGE } from '@game/town/secret-house';
import { makeGame, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// BUG-09: the Dev menu has one Level select. It nests Classic (the O-05 map set pages), Campaign,
// Mini games and Bonus games; the old one-page list is no longer opened (deprecated), and every
// id it listed (each level, special level, editor level and the village) is reached from the pages.
// The cheat Level select (Classic options > Cheats) is a different scene and stays as it was.

isolateClassicRegistry();
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const CUSTOM = 'custom-my-level';

function dev(): H {
  return makeGame({
    deps: {
      settings: { ...defaultSettings(), dev: true } as Settings,
      applySettings: () => {},
      listLevels: () => [...levelIds(), ...specialLevelIds(), CUSTOM],
    },
  });
}

function pick(h: H, label: string): void {
  const all = labels(h.top());
  const at = all.indexOf(label);
  expect(at, `${label} in ${all.join(', ')}`).toBeGreaterThanOrEqual(0);
  h.idle(8);
  const index = (h.top() as unknown as { index: number }).index;
  for (let i = 0; i < (at - index + all.length) % all.length; i++) h.tap('down');
  h.tap('jump');
}

/** Pages that open something other than a level's START page (not walked). */
const NOT_WALKED = new Set([
  'Back',
  'World map',
  'Open a file',
  'Training rooms',
  'Mini games',
  'Bonus games',
]);

function reach(h: H, page: MenuScene, seen = new Set<string>()): Set<string> {
  for (const it of items(page)) {
    if (NOT_WALKED.has(it.label) || !it.select) continue;
    const depth = h.game.scenes.depth;
    it.select();
    const top = h.top();
    if (top instanceof DevStartScene) seen.add(top.target.level);
    else if (top !== page && h.game.scenes.depth > depth) reach(h, top as MenuScene, seen);
    while (h.game.scenes.depth > depth) h.game.scenes.pop();
  }
  return seen;
}

describe('BUG-09 one dev Level select', () => {
  it('the Dev menu has one Level select and none of its pages as rows of its own', () => {
    const h = dev();
    h.game.showDevMenu();
    const menu = labels(h.top());
    expect(menu.filter((l) => /level select/i.test(l))).toEqual(['Level select']);
    for (const l of ['Classic', 'Campaign', 'Mini games', 'Bonus games']) expect(menu).not.toContain(l);
    expect(h.top()).toBeInstanceOf(DevMenuScene);
  });

  it('Level select opens Classic, Campaign, Mini games and Bonus games, read out', () => {
    const h = dev();
    h.game.showDevMenu();
    pick(h, 'Level select');
    expect(h.top()).toBeInstanceOf(DevLevelPagesScene);
    expect(labels(h.top())).toEqual(['Classic', 'Campaign', 'Mini games', 'Bonus games', 'Back']);
    expect(h.said.at(-1)).toMatch(/^Level select\. Classic\. /);
    const opens: [string, unknown][] = [
      ['Classic', DevClassicScene],
      ['Campaign', DevCampaignScene],
      ['Mini games', DevMiniGamesScene],
      ['Bonus games', DevBonusGamesScene],
    ];
    for (const [label, type] of opens) {
      pick(h, label);
      expect(h.top()).toBeInstanceOf(type as new (...a: never[]) => unknown);
      h.idle(8);
      h.tap('attack'); // BACK
      expect(h.top()).toBeInstanceOf(DevLevelPagesScene);
    }
    pick(h, 'Back');
    expect(h.top()).toBeInstanceOf(DevMenuScene);
  });

  it('every id the old one-page list offered is reached from the Level select pages', () => {
    const h = dev();
    const pages = new DevLevelPagesScene(h.game);
    h.game.scenes.push(pages);
    const seen = reach(h, pages);
    const old = [...(h.game.deps.listLevels?.() ?? []), DEV_VILLAGE];
    expect(old.filter((id) => !seen.has(id))).toEqual([]);
    expect(seen.has(CUSTOM)).toBe(true);
  });

  it('from the pause menu its pages are seen through, as the Dev menu is', () => {
    const h = dev();
    h.game.scenes.push(new DevMenuScene(h.game, true));
    pick(h, 'Level select');
    expect((h.top() as MenuScene).translucent).toBe(true);
    pick(h, 'Classic');
    expect((h.top() as MenuScene).translucent).toBe(true);
  });
});
