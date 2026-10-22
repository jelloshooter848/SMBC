import { expect } from 'vitest';
import { CharacterSelectScene } from '@game/scenes/character-select';
import type { H } from './heroes-harness';

/**
 * BUG-03: CONTINUE goes through the hero select first (the original's Load Game). Picks the hero
 * the select opens on (the saved run's) so a test of what Continue restores goes on into the level.
 */
export function pickAtContinue(h: H): void {
  h.until(() => h.top() instanceof CharacterSelectScene, 60);
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(20);
  h.tap('jump');
  // A hero with looks opens them first (OK keeps the look shown).
  if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
}
