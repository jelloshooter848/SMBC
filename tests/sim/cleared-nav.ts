import { expect } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { CardScene, MessageScene } from '@game/scenes/message';
import { CreditsScene } from '@game/scenes/credits';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicNoteScene } from '@game/scenes/original-replay';
import {
  originalFileRules,
  saveClearedFile,
  type ClassicFileRef,
  type ClassicFileRules,
} from '@game/original-files';
import type { ClassicResume } from '@game/run-resume';
import type { MapSetId } from '@engine/save/progress';
import { makeGame, store, type H } from './heroes-harness';
import { choose } from './classic-files-nav';

/*
 * v0.4.73 PR 2: CLEARED files and the level replay. Shared steps for its tests: a game with
 * settings, beating a map set in a file (the credits, then the cheat cards), a CLEARED file
 * written straight to storage, and the file box of a set.
 */

export type G = H & { settings: Settings };

export function classic(over: (s: Settings) => void = () => {}): G {
  const settings: Settings = { ...defaultSettings() };
  over(settings);
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

export const inLevel = (h: H) => h.top() instanceof LevelScene;

export const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '8-4',
  rules: 'classic',
  hero: 'mario',
  score: 98700,
  coins: 12,
  lives: 4,
  world: 8,
  stage: 4,
  powerState: 'fire',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});

/** A CLEARED file of `ref`, written as the game writes one. */
export function keepCleared(
  ref: ClassicFileRef,
  over: Partial<ClassicResume> = {},
  rules: ClassicFileRules = originalFileRules(),
): void {
  expect(saveClearedFile({ ...ref, rules, continues: 0, run: run(over) })).toBe(true);
}

/** The stored text of every Classic file and old key (to check nothing was written). */
export function stored(): string {
  return JSON.stringify(
    [...store.entries()]
      .filter(([k]) => k.startsWith('smbc-classic-'))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** A file run of `ref` at the last castle of its set (`level`), beaten: the ending and the credits. */
export function beat(h: G, ref: ClassicFileRef, level = '8-4'): void {
  h.game.classicGame(MARIO, level, { ref });
  h.until(() => inLevel(h), 900);
  h.game.state.score = 55500;
  h.game.state.lives = 6;
  h.game.showEnding(level);
  expect(h.top()).toBeInstanceOf(CreditsScene);
  (h.game as unknown as { afterCredits(from: string): void }).afterCredits(level);
}

/** OK through the cheat cards after the credits (each waits for a press). */
export function closeUnlockCards(h: H, max = 20): void {
  for (let i = 0; i < max && (h.top() instanceof MessageScene || h.top() instanceof CardScene); i++) {
    h.idle(40);
    h.tap('jump');
  }
}

/** OK through the Classic note box on top (every page), as a player reads it. */
export function readNote(h: H, max = 10): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < max && h.top() instanceof ClassicNoteScene; i++) {
    const note = h.top() as ClassicNoteScene;
    pages.push([...note.lines]);
    h.idle(40);
    h.tap('jump');
  }
  return pages;
}

const SET_LABEL: Record<MapSetId, string> = {
  smb: 'Super Mario Bros.',
  special: 'SMB Special',
  lost: 'The Lost Levels',
};

/** The CLASSIC menu, then map set `set`'s file box. */
export function openFiles(h: H, set: MapSetId = 'smb'): ClassicFilesScene {
  h.game.showClassicMenu();
  choose(h, SET_LABEL[set]);
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  return h.top() as ClassicFilesScene;
}
