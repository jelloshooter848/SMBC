import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { loadClassicFile, type ClassicFileRef } from '@game/original-files';
import { LevelScene } from '@game/scenes/level';
import { makeGame, store, useStorage } from './heroes-harness';

// 0.4.72 release review: the devHero mark (review fix 2) is written whenever the run's hero is
// an unreleased Expansion hero, dev mode on or off, and a mark a file has is never dropped. So
// turning dev mode off in the middle of an Arthur run (Pause > Dev mode > off) and playing on
// still leaves a file that waits for dev mode (NOT RELEASED), never one Mario overwrites.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const arthur = () => CLASSIC_EXTRAS.find((d) => d.id === 'arthur') as CharacterDef;

function arthurRun() {
  const settings: Settings = { ...defaultSettings(), dev: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicGame(arthur(), '1-1', { ref: F1 });
  h.until(() => h.top() instanceof LevelScene, 600);
  expect(loadClassicFile(F1)?.run.devHero).toBe(true);
  return { h, settings };
}

describe('0.4.72 release review: dev mode off mid-run keeps the mark', () => {
  it('dev off mid-run, then the next write: still Arthur, still marked, NOT RELEASED, not played as Mario', () => {
    const { h, settings } = arthurRun();
    settings.dev = false;
    h.game.warpToLevel('1-2', { mode: 'stand' });
    // (warpToLevel writes the file for 1-2 at once, before the select between levels.)
    const run = loadClassicFile(F1)?.run;
    expect(run?.levelId.startsWith('1-2')).toBe(true);
    expect(run?.hero).toBe('arthur');
    expect(run?.devHero).toBe(true);
    const saved = JSON.stringify(loadClassicFile(F1));
    // A fresh session with dev mode off: the file waits, untouched.
    const off = makeGame({
      deps: { settings: { ...defaultSettings(), dev: false }, applySettings: () => {} },
    });
    expect(off.game.classicFileProblem(F1)).toBe('not-released');
    expect(off.game.resumeClassic(F1)).toBe(false);
    expect(JSON.stringify(loadClassicFile(F1))).toBe(saved);
  });

  it('a mark is never dropped by a later write (here: Mario took over mid-run)', () => {
    const { h } = arthurRun();
    h.game.setHero(0, h.game.heroSlots[0]!);
    h.game.warpToLevel('1-2', { mode: 'stand' });
    // (warpToLevel writes the file for 1-2 at once, before the select between levels.)
    const run = loadClassicFile(F1)?.run;
    expect(run?.hero).toBe('mario');
    expect(run?.devHero).toBe(true);
    // Mario is offered everywhere, so the file plays with dev mode off.
    const off = makeGame({
      deps: { settings: { ...defaultSettings(), dev: false }, applySettings: () => {} },
    });
    expect(off.game.classicFileProblem(F1)).toBeNull();
  });
});
