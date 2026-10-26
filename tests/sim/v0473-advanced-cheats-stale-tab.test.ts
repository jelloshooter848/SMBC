import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  eraseClassicFile,
  originalFileRules,
  type ClassicFileRef,
  type ClassicFileRules,
} from '@game/original-files';
import { ADVANCED_OFF, advancedCheatsKey } from '@game/advanced-cheats';
import type { MenuItem } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import type { LevelScene } from '@game/scenes/level';
import { REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { AdvancedCheatsScene } from '@game/scenes/advanced-cheats-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { inLevel, keepCleared, openFiles } from './cleared-nav';

/*
 * Item 134: the Advanced cheats fingerprint is taken when the replay's world box (and so the
 * replay) is made, not when its Advanced cheats page opens or each frame the replay plays. Tab A
 * has file 1's world box open, or is replaying one of its levels; tab B erases file 1 and clears
 * it again on Hard, and turns on its Advanced cheats. Tab A's page writes nothing onto the new
 * file, and its replay does not play the new file's cheats.
 */

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const hardRules = (): ClassicFileRules => ({ ...originalFileRules(), difficulty: 'hard' });
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

function game() {
  const settings: Settings = { ...defaultSettings() };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

/** Tab B: ERASE FILE 1, a new Hard clear of it, and its Advanced cheats (No damage) turned on. */
function tabBReclears(): string {
  eraseClassicFile(A);
  keepCleared(A, { score: 3 }, hardRules());
  const b = game();
  const id = b.game.advancedCheatsId(A);
  expect(id).not.toBeNull();
  expect(
    b.game.setAdvancedCheats(A, id ?? '', { seen: true, assist: { ...ADVANCED_OFF, invulnerable: true } }),
  ).toBe(true);
  return store.get(advancedCheatsKey(A)) ?? '';
}

/** Opens Advanced cheats from the top box and flips No damage. */
function flipNoDamage(h: ReturnType<typeof game>): void {
  choose(h, 'Advanced cheats');
  expect(h.top()).toBeInstanceOf(AdvancedCheatsScene);
  const page = h.top();
  const row = labels(page).indexOf('No damage');
  h.idle(8);
  for (let i = 0; i < 20 && (page as unknown as { index: number }).index !== row; i++) h.tap('down');
  h.tap('right');
}

/** Tab A: file 1 cleared on Hard, its cheats box read, its world box open. */
function tabAWorldBox() {
  store.set(REPLAY_HELP_KEY, 'true');
  keepCleared(A, {}, hardRules());
  const h = game();
  expect(h.game.setAdvancedCheats(A, h.game.advancedCheatsId(A) ?? '', { seen: true })).toBe(true);
  openFiles(h);
  choose(h, 'File 1');
  expect(labels(h.top())).toContain('Advanced cheats');
  return h;
}

describe('item 134: a stale tab and Advanced cheats', () => {
  it('world box open, tab B clears the file again: picking Advanced cheats writes nothing on the new file', () => {
    const h = tabAWorldBox();
    const kept = tabBReclears();
    flipNoDamage(h);
    expect(store.get(advancedCheatsKey(A))).toBe(kept);
  });

  it('world box open, tab B clears the file again: the page does not show the new file’s cheats', () => {
    const h = tabAWorldBox();
    tabBReclears();
    choose(h, 'Advanced cheats');
    const page = h.top() as AdvancedCheatsScene;
    const row = items(page)[labels(page).indexOf('No damage')];
    expect(row?.value?.()).toBe('Off');
  });

  it('mid-replay, tab B clears the file again: the replay does not play its cheats, its pause page writes nothing', () => {
    const h = tabAWorldBox();
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(h.game.liveAssists().invulnerable).toBe(false);
    const kept = tabBReclears();
    expect(h.game.liveAssists()).toEqual({ ...ADVANCED_OFF });
    h.game.scenes.push(new PauseScene(h.game, (h.top() as LevelScene).world));
    flipNoDamage(h);
    expect(store.get(advancedCheatsKey(A))).toBe(kept);
    expect(h.game.liveAssists()).toEqual({ ...ADVANCED_OFF });
  });

  it('the same file still plays and keeps its own cheats (no other tab)', () => {
    const h = tabAWorldBox();
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    h.game.scenes.push(new PauseScene(h.game, (h.top() as LevelScene).world));
    flipNoDamage(h);
    expect(h.game.advancedCheatsOf(A)?.assist.invulnerable).toBe(true);
    expect(h.game.liveAssists().invulnerable).toBe(true);
  });
});
