import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { Scene } from '@engine/scene';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { MenuScene, type MenuItem } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import type { ClassicTitleScene } from '@game/scenes/original-title';
import { ClassicDifficultyScene, ClassicFileRulesScene } from '@game/scenes/original-files-menu';
import { CLASSIC_WEAPON_VALUES } from '@engine/save/original-options';
import { MORE_SETTINGS_ROWS, WEAPON_ROWS } from '@game/scenes/original-options';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// B-L: a file's rules (Map difficulty, Game mode, More settings, Weapons, Disable heroes) are
// chosen only as the file starts, in its difficulty and rules boxes. No other menu may offer them:
// not the set box, not the Start box's Options, not the pause menu, not the Level Select page, not
// any page any of them opens. This walks every menu reachable from those (developer mode off and
// on, every cheat unlocked) and checks each row.

useStorage();
afterEach(() => store.clear());

/** The per-file rows' labels (and every row of their sub-pages). */
const FILE_ROWS = new Set<string>([
  'Map difficulty',
  'Difficulty',
  'Game mode',
  'More settings',
  'Weapons',
  'Customize weapons',
  'Disable heroes',
  ...MORE_SETTINGS_ROWS.map((r) => r.label),
  ...WEAPON_ROWS.map((r) => r.label),
]);
// Weapon rows are named by hero ("Link", "Samus"): only a row with a weapon value counts.
const WEAPON_LABELS = new Set(WEAPON_ROWS.map((r) => r.label));
const WEAPON_NAMES = new Set(Object.values(CLASSIC_WEAPON_VALUES).flat() as string[]);

/** Rows whose OK leaves the menus (a run starts, the run goes on, a run is quit) or types a code. */
const LEAVES = new Set(['Back', 'Continue', 'Quit', 'Go', 'Yes', 'No', 'Start', 'Enter code', 'Give up']);

const stack = (h: H) => (h.game.scenes as unknown as { stack: Scene[] }).stack;
const items = (s: unknown) => (s as { items: MenuItem[] }).items ?? [];

function perFile(it: MenuItem): boolean {
  const label = it.label.replace(/\*$/, '');
  if (WEAPON_LABELS.has(label)) {
    const v = it.value?.();
    return v !== undefined && [...WEAPON_NAMES].some((w) => v.toLowerCase().includes(w.replace(/-/g, ' ')));
  }
  return FILE_ROWS.has(label);
}

/**
 * Every row of the menu on top and of every menu its rows open (depth first), as "path > row".
 * The file creation boxes are the one place these rows belong and are never entered.
 */
function walk(h: H, path: string, seen: string[], depth = 0): void {
  const top = h.top();
  if (!(top instanceof MenuScene) || depth > 6) return;
  if (top instanceof ClassicDifficultyScene || top instanceof ClassicFileRulesScene) return;
  // The Dev menu's Level select START page is developer mode's own start (its Map difficulty
  // builds a dev run, which has no file and never writes one): not a player's menu.
  if (/> Dev mode > Level select/.test(path)) return;
  for (const it of [...items(top)]) {
    if (perFile(it)) seen.push(`${path} > ${it.label}`);
    // Rows that leave, download or share (they need a real page) are read but not opened.
    if (!it.select || it.gesture || LEAVES.has(it.label) || /^File \d/.test(it.label)) continue;
    if (/template|export|import|download|share|copy/i.test(it.label)) continue;
    const at = stack(h).length;
    it.select();
    if (stack(h).length > at && h.top() !== top) walk(h, `${path} > ${it.label}`, seen, depth + 1);
    while (stack(h).length > at) h.game.scenes.pop();
    if (h.top() !== top) break;
  }
}

function game(dev: boolean): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev };
  settings.classicCheats.levelSelect = true;
  for (const k of Object.keys(
    settings.classicCheats.unlocked,
  ) as (keyof typeof settings.classicCheats.unlocked)[])
    settings.classicCheats.unlocked[k] = true;
  const h = makeGame({ dev, deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

describe('B-L no per-file row outside a file’s creation', () => {
  for (const dev of [false, true]) {
    it(`the CLASSIC menus: the set box, a set's file box, the Start box's Options (dev ${dev})`, () => {
      const h = game(dev);
      // A used file, so the file box shows one and ERASE FILE opens its picker.
      h.game.classicGame(MARIO, '1-1', { ref: { set: 'smb', slot: 1 } });
      h.until(() => h.top() instanceof LevelScene, 600);
      const seen: string[] = [];
      h.game.showClassicTitle('start');
      const title = h.top() as ClassicTitleScene;
      for (const it of title.items) {
        if (it.label === 'Back') continue;
        const at = stack(h).length;
        it.select?.();
        walk(h, `Classic > ${it.label}`, seen);
        while (stack(h).length > at) h.game.scenes.pop();
      }
      expect(seen).toEqual([]);
    });

    it(`the pause menu of a Classic run, and every page it opens (dev ${dev})`, () => {
      const h = game(dev);
      h.game.classicGame(MARIO, '1-1', { ref: { set: 'smb', slot: 1 } });
      h.until(() => h.top() instanceof LevelScene, 600);
      const level = h.top() as LevelScene;
      h.game.scenes.push(new PauseScene(h.game, level.world));
      const seen: string[] = [];
      walk(h, 'Pause', seen);
      expect(seen).toEqual([]);
      // Walked for real: the pause offers its Options and the Level Select page.
      const labels = items(new PauseScene(h.game, level.world)).map((i) => i.label);
      expect(labels).toEqual(expect.arrayContaining(['Options', 'Level select']));
    });
  }

  it('the guard sees the rows where they belong (a new file’s rules box)', () => {
    const h = game(false);
    h.game.showClassicMenu();
    const sets = h.top() as MenuScene;
    items(sets)[0]?.select?.();
    items(h.top())[0]?.select?.(); // FILE 1: NEW GAME
    items(h.top())[1]?.select?.(); // Normal
    expect(h.top()).toBeInstanceOf(ClassicFileRulesScene);
    expect(
      items(h.top())
        .filter(perFile)
        .map((i) => i.label),
    ).toEqual(['Game mode', 'More settings', 'Weapons', 'Disable heroes']);
  });
});
