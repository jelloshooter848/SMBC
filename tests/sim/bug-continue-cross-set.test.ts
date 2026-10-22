import { afterEach, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { loadClassicResume, saveClassicResume } from '@game/run-resume';
import { makeGame, store, useStorage } from './heroes-harness';
import { pickAtContinue } from './continue-select';

useStorage();
afterEach(() => store.clear());

it('Item 8: a SMB run with a continue, a NEW GAME on another set, then SMB Continue', () => {
  const settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicGame(MARIO);
  h.game.continueGame('1-1');
  pickAtContinue(h);
  h.until(() => h.top() instanceof LevelScene, 900);
  h.idle(30);
  expect(settings.classicCheats.continuesUsed).toBe(1);
  const slot = loadClassicResume('smb');
  expect(slot).not.toBeNull();
  h.game.showTitle();
  h.game.classicSelect('ll-1-1', () => {});
  expect(settings.classicCheats.continuesUsed).toBe(0);
  h.game.showTitle();
  expect(h.game.resumeClassic('smb')).toBe(true);
  pickAtContinue(h);
  h.until(() => h.top() instanceof LevelScene, 900);
  expect(settings.classicCheats.continuesUsed, 'count after SMB Continue').toBe(1);
  h.game.cheatEvent({ beat: 'smb' });
  expect(settings.classicCheats.unlocked.infiniteLives, 'infinite lives').toBe(false);
});

/** A SMB run with one continue used, back at the title with its slot kept. */
function smbRunWithAContinue() {
  const settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicGame(MARIO);
  h.game.continueGame('1-1');
  pickAtContinue(h);
  h.until(() => h.top() instanceof LevelScene, 900);
  h.idle(30);
  h.game.showTitle();
  return { h, settings };
}

it('Item 8: the slot keeps the run its count of continues', () => {
  smbRunWithAContinue();
  expect(loadClassicResume('smb')?.continues).toBe(1);
});

it('Item 8: a count that is not a whole number of 0 or more reads as none', () => {
  smbRunWithAContinue();
  const slot = loadClassicResume('smb');
  expect(slot).not.toBeNull();
  for (const bad of [-1, 1.5, '2', null, Number.NaN]) {
    saveClassicResume({ ...slot!, continues: bad as unknown as number });
    expect(loadClassicResume('smb')?.continues, String(bad)).toBeUndefined();
  }
  saveClassicResume({ ...slot!, continues: 0 });
  expect(loadClassicResume('smb')?.continues).toBe(0);
});

it('Item 8: an older slot without a count keeps the current count', () => {
  const { h, settings } = smbRunWithAContinue();
  const { continues: _c, ...old } = loadClassicResume('smb')!;
  saveClassicResume(old);
  settings.classicCheats.continuesUsed = 3;
  expect(h.game.resumeClassic('smb')).toBe(true);
  pickAtContinue(h);
  h.until(() => h.top() instanceof LevelScene, 900);
  expect(settings.classicCheats.continuesUsed).toBe(3);
});

it('Item 8: Continue of a run with no continue clears a count another set left', () => {
  const settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicGame(MARIO);
  h.until(() => h.top() instanceof LevelScene, 900);
  h.idle(30);
  expect(loadClassicResume('smb')?.continues).toBe(0);
  h.game.showTitle();
  settings.classicCheats.continuesUsed = 2;
  expect(h.game.resumeClassic('smb')).toBe(true);
  pickAtContinue(h);
  h.until(() => h.top() instanceof LevelScene, 900);
  expect(settings.classicCheats.continuesUsed).toBe(0);
});
