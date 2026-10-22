import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LevelScene } from '@game/scenes/level';

import { classicFileKey, loadClassicFile, type ClassicFileRef } from '@game/original-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// RC-004 (0.5.0 RC audit): opening a shared `?level=` link (main.ts -> devClassicGame with dev
// mode off) replaced the player's CLASSIC > Continue run with the link's, with no prompt. A link
// run now never writes the resume slot, and its game over or credits never clear it.

useStorage();

/** B-L: SMB's FILE 1 (an old single or per-set slot migrates into it). */
const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const loadClassicResume = () => loadClassicFile(F1)?.run ?? null;
afterEach(() => store.clear());

function classic(): H & { settings: Settings } {
  const settings = defaultSettings();
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const inLevel = (h: H) => h.top() instanceof LevelScene;

/**
 * Per-set saves: every resume slot in storage, by key (one per map set). The seeded run's own
 * (SMB's) is checked to be there, so a comparison is never between two empty stores.
 */
const slots = () =>
  Object.fromEntries([...store.entries()].filter(([k]) => k.startsWith('smbc-classic-file')));
function seededSlots(): Record<string, string> {
  const s = slots();
  expect(s[classicFileKey(F1)]).toMatch(/"levelId":"4-2"/);
  return s;
}

/** A Classic mode run as Luigi at 4-2 with 50,000 points: the slot a link must not replace. */
function seeded(): H & { settings: Settings } {
  const h = classic();
  h.game.classicGame(LUIGI, '4-1', { ref: F1 });
  h.until(() => inLevel(h), 600);
  h.game.state.score = 50000;
  h.game.goToLevel('4-2', { mode: 'stand' });
  h.game.showTitle();
  return h;
}

describe('RC-004 a link run leaves the Continue slot alone', () => {
  it('a release link (dev mode off) to ll-9-1 plays, and the slot still holds 4-2', () => {
    const h = seeded();
    const before = seededSlots();
    expect(loadClassicResume()).toMatchObject({ levelId: '4-2', hero: 'luigi', score: 50000 });
    h.game.devClassicGame(MARIO, 'll-9-1', 'classic', false);
    h.until(() => inLevel(h), 600);
    expect(h.game.classicRun).toBe(true);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^ll-9-1/);
    expect(slots()).toEqual(before);
    // Its next WORLD card does not write it either.
    h.game.goToLevel('ll-9-2', { mode: 'stand' });
    expect(slots()).toEqual(before);
  });

  it("the link run's game over and credits do not clear it", () => {
    const h = seeded();
    const before = seededSlots();
    h.game.devClassicGame(MARIO, '1-1', 'classic', false);
    h.until(() => inLevel(h), 600);
    h.game.gameOver('1-1');
    expect(slots()).toEqual(before);
    h.game.devClassicGame(MARIO, '8-4', 'classic', false);
    h.until(() => inLevel(h), 600);
    h.game.showEnding('8-4');
    expect(slots()).toEqual(before);
  });

  it('a Classic mode run after the link writes the slot again', () => {
    const h = seeded();
    h.game.devClassicGame(MARIO, '1-1', 'classic', false);
    h.until(() => inLevel(h), 600);
    h.game.showTitle();
    h.game.classicGame(MARIO, '2-1', { ref: F1 });
    expect(loadClassicResume()).toMatchObject({ levelId: expect.stringMatching(/^2-1/), hero: 'mario' });
  });
});
