import { expect } from 'vitest';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import {
  ClassicDifficultyScene,
  ClassicFileRulesScene,
  ClassicFilesScene,
} from '@game/scenes/original-files-menu';
import type { H } from './heroes-harness';

/*
 * B-L: picking a map set on the CLASSIC set box opens its file box; an empty file asks the map
 * difficulty, then its rules box, whose START goes on to the select. These walk that with key
 * presses, as a player does, for the tests that only need to get past it.
 */

const items = (s: unknown) => (s as { items: MenuItem[] }).items;

/** Highlight `label` on the menu on top (wrapping down) and pick it with OK. */
export function choose(h: H, label: string): void {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  const at = () => (menu as unknown as { index: number }).index;
  for (let i = 0; i < 20 && at() !== row; i++) h.tap('down');
  h.tap('jump');
}

/**
 * On a set's file box: empty FILE `slot`, then `difficulty`, then the rules box's START (the
 * rules left at the original's). Ends on whatever the START opens (the select).
 */
export function newFile(h: H, slot: 1 | 2 | 3 = 1, difficulty = 'Normal'): void {
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  choose(h, `File ${slot}`);
  expect(h.top()).toBeInstanceOf(ClassicDifficultyScene);
  choose(h, difficulty);
  expect(h.top()).toBeInstanceOf(ClassicFileRulesScene);
  choose(h, 'Start');
}

/** On the set box: map set `label`, then a new game in its FILE `slot` (newFile). */
export function newGameOf(h: H, label: string, slot: 1 | 2 | 3 = 1, difficulty = 'Normal'): void {
  choose(h, label);
  newFile(h, slot, difficulty);
}
