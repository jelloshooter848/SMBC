import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { loadClassicFile, type ClassicFileRef } from '@game/original-files';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

// 0.4.72 review fix 2 (save safety): a Classic file run played in dev mode as a hero only dev
// mode's select offers (an unreleased Expansion hero, Release state) is marked so (its run's
// devHero). With dev mode off it does not play as Mario and is never rewritten: its row says NOT
// RELEASED and how to play it. Dev mode on again: it plays as that hero. Since 0.4.73 (item 40)
// a file of an unreleased Expansion hero without the mark is NOT RELEASED too
// (unreleased-hero-unmarked-file.test.ts); P1 (polish-resume-unoffered-hero.test.ts) applies only
// to heroes that are neither offered nor Expansion heroes.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const arthur = () => CLASSIC_EXTRAS.find((d) => d.id === 'arthur') as CharacterDef;

function game(dev: boolean) {
  const settings: Settings = { ...defaultSettings(), dev };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** Dev mode: a file run as Arthur into 1-1, its WORLD card written. */
function arthurFile() {
  const h = game(true);
  h.game.classicGame(arthur(), '1-1', { ref: F1 });
  h.until(() => h.top() instanceof LevelScene, 600);
  expect(h.game.state.character.id).toBe('arthur');
  const f = loadClassicFile(F1);
  expect(f?.run.hero).toBe('arthur');
  return { h, saved: JSON.stringify(f) };
}

describe("0.4.72 review fix 2: a dev-only hero's file waits for dev mode", () => {
  it('the run is marked as played by a hero only dev mode offers', () => {
    const { h } = arthurFile();
    expect(loadClassicFile(F1)?.run.devHero).toBe(true);
    // A released hero's run is not.
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 2 } });
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(loadClassicFile({ set: 'smb', slot: 2 })?.run.devHero).toBeUndefined();
  });

  it('dev mode off: NOT RELEASED, how to play it, never played as Mario, the file untouched', () => {
    const { saved } = arthurFile();
    const h = game(false);
    expect(h.game.classicFileProblem(F1)).toBe('not-released');
    expect(h.game.classicFileState(F1)).toBe('unplayable');
    expect(h.game.classicFileAt(F1)).toBeNull();
    expect(h.game.resumeClassic(F1)).toBe(false);
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    const box = h.top() as ClassicFilesScene;
    expect(box).toBeInstanceOf(ClassicFilesScene);
    const row = items(box)[0] as MenuItem;
    expect(row.value?.()).toBe('NOT RELEASED');
    expect(row.hint).toMatch(/Its hero, Arthur, is not released yet\. Turn dev mode on to play it/);
    choose(h, 'File 1');
    expect(h.top()).toBe(box);
    expect(h.said.at(-1)).toMatch(/^File 1: its hero, Arthur, is not released yet/);
    h.idle(30);
    expect(JSON.stringify(loadClassicFile(F1))).toBe(saved);
  });

  it('dev mode on again: the file plays as Arthur', () => {
    const { saved } = arthurFile();
    const off = game(false);
    expect(off.game.resumeClassic(F1)).toBe(false);
    const on = game(true);
    expect(on.game.classicFileProblem(F1)).toBeNull();
    expect(on.game.resumeClassic(F1)).toBe(true);
    expect(on.game.state.character.id).toBe('arthur');
    expect(JSON.parse(saved).run.hero).toBe('arthur');
  });

  it('dev mode with Arthur set Off: HERO OFF, as 31d', () => {
    arthurFile();
    const h = game(true);
    h.settings.classicDev = { yoshiMount: false, heroesOff: ['arthur'] };
    expect(h.game.classicFileProblem(F1)).toBe('hero-off');
  });
});
