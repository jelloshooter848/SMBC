import { describe, expect, it } from 'vitest';
import { urlLevelStart } from '@game/dev-url';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { classicBeatStatus } from '@game/scenes/original-game';
import { makeGame, useStorage } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

isolateClassicRegistry({ hideExtras: true });
useStorage();

// G-020 (0.5.0, #181): a `?level=` link to a Special level starts a Classic Special run outside
// dev mode, as SMB and Lost Levels links do.

const start = (level: string, dev = false) => urlLevelStart(new URLSearchParams({ level }), dev);

describe('?level= links to Special', () => {
  it('start a Classic run there with dev mode off, from sp-1-1 to sp-8-4', () => {
    for (const id of ['sp-1-1', 'sp-4-2', 'sp-8-4']) expect(start(id), id).toBe('classic');
    // As SMB and Lost Levels links do.
    expect(start('4-2')).toBe('classic');
    expect(start('ll-13-4')).toBe('classic');
  });

  it('not past the set, nor its inner areas (a run starts at a level)', () => {
    for (const id of ['sp-9-1', 'sp-0-1', 'sp-1-5', 'sp-1-1-bonus', 'sp-4-3-bonus'])
      expect(start(id), id).toBeNull();
  });

  it('with dev mode on, any level is free play as before', () => {
    expect(start('sp-4-3-bonus', true)).toBe('free');
  });
});

// #181: a link's Classic run counts toward cheat goals and a set's BEATEN mark as the Level Select
// cheat's runs do (the original's Level Select start counts: LevelSelectMenu.as 115-131 only sets
// the map pack and difficulty; StatManager.beatGameHandler 506-529 asks nothing of the start). A
// dev-mode run never counts.
describe('a link run counts as a Level Select run does', () => {
  const run = (dev: boolean) => {
    const h = makeGame({ deps: { settings: { ...defaultSettings() }, applySettings: () => {} } });
    h.game.devClassicGame(MARIO, 'sp-8-4', 'classic', dev);
    expect(h.game.classicRun).toBe(true);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('sp-8-4-end4');
    return h.game.deps.settings as Settings;
  };

  it('with dev mode off (a shared link): its goals count and the set is beaten', () => {
    const s = run(false);
    expect(classicBeatStatus('special')).toBe('normal');
    expect(s.classicCheats.beaten.special).toBe(true);
    expect(s.classicCheats.unlocked.allHammerBros).toBe(true);
  });

  it('a dev-mode run never counts', () => {
    const s = run(true);
    expect(classicBeatStatus('special')).toBe('none');
    expect(s.classicCheats.beaten.special).toBe(false);
  });
});
