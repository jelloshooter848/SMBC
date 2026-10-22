import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import {
  loadClassicFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import { LevelScene } from '@game/scenes/level';
import { makeGame, store, useStorage } from './heroes-harness';

// 31e (v0.4.71, #199 review): Game.classicGame(hero, level, file) starts a new game in `file`
// only when it is empty, as startClassicFile does: a used, unplayable or unreadable file is
// never started over (only ERASE FILE empties a file).

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const game = () => makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });

describe('31e: classicGame starts a file only when it is empty', () => {
  it('an empty file: the run starts in it', () => {
    const h = game();
    h.game.classicGame(MARIO, '1-1', { ref: F1 });
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(loadClassicFile(F1)?.run.hero).toBe('mario');
  });

  it('a used file: nothing starts, and the file is untouched', () => {
    saveClassicFile({
      ...F1,
      rules: originalFileRules(),
      continues: 2,
      run: {
        v: 1,
        levelId: '6-2',
        rules: 'classic',
        hero: 'luigi',
        score: 777,
        coins: 3,
        lives: 5,
        world: 6,
        stage: 2,
        powerState: 'big',
        hp: 0,
        kit: {},
        warped: false,
        checkpoint: null,
      },
    });
    const before = store.get('smbc-classic-file-smb-1');
    const h = game();
    h.game.showTitle();
    const top = h.top();
    h.game.classicGame(MARIO, '1-1', { ref: F1, rules: originalFileRules() });
    h.idle(400);
    expect(h.top()).toBe(top);
    expect(h.game.classicRun).toBe(false);
    expect(store.get('smbc-classic-file-smb-1')).toBe(before);
  });

  it('an unreadable file: nothing starts, and it is kept', () => {
    store.set('smbc-classic-file-smb-1', '{"v":2}');
    const h = game();
    h.game.showTitle();
    const top = h.top();
    h.game.classicGame(MARIO, '1-1', { ref: F1 });
    h.idle(400);
    expect(h.top()).toBe(top);
    expect(store.get('smbc-classic-file-smb-1')).toBe('{"v":2}');
  });
});
