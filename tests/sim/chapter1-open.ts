import type { Settings } from '@engine/save/settings';
import type { Game } from '@game/scenes/game';

/*
 * 0.5.0 (G-100..G-112): the title lists Classic first, then Chapter 1, and Chapter 1 (the story
 * campaign) opens only with dev mode on until it ships. The campaign's end-to-end sims start
 * from the title as a player with dev mode on would: this helper turns it on, then the sim goes
 * DOWN one row (past Classic) to Chapter 1.
 */

/** Turn dev mode on for `game` (before `showTitle`, so the title lists the open Chapter 1 row). */
export function openChapter1(game: Game): void {
  const s = game.deps.settings;
  if (s) s.dev = true;
  else (game.deps as { settings?: Settings }).settings = { dev: true } as Settings;
}

