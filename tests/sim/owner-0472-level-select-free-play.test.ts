import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { levelIds, specialLevelIds } from '@content/levels';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { DEV_LAST_KEY, DevStartScene, loadDevPick } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// 0.4.72 owner item 7: the dev Level select's START page has no Mode row; every start plays as
// its free play did (99 lives, straight back after a death, no Classic run), and its Map
// difficulty now plays in free play under Classic rules.

isolateClassicRegistry();
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const row = (s: unknown, l: string) => items(s).find((i) => i.label === l) as MenuItem;

function dev(): H {
  return makeGame({
    deps: {
      settings: { ...defaultSettings(), dev: true } as Settings,
      applySettings: () => {},
      listLevels: () => [...levelIds(), ...specialLevelIds()],
    },
  });
}
const enterLevel = (h: H): LevelScene => {
  h.until(() => h.top() instanceof LevelScene, 900);
  return h.top() as LevelScene;
};

describe('owner 0.4.72 item 7: Level select always starts as free play', () => {
  it('no Mode row on a Classic or a Campaign START page', () => {
    const h = dev();
    for (const branch of ['classic', 'campaign'] as const) {
      const s = new DevStartScene(h.game, { branch, level: '1-1', name: 'SMB 1-1' });
      expect(items(s).map((i) => i.label)).not.toContain('Mode');
    }
  });

  it('a Classic start is free play: 99 lives, no Classic run, straight back after a death', () => {
    const h = dev();
    const s = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    expect(s.pick.classicRun).toBe(false);
    row(s, 'Start').select?.();
    const l = enterLevel(h);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.liveRules).toBe('classic');
    expect(h.game.state.lives).toBe(99);
    l.world.kill(l.world.player);
    for (let i = 0; i < 400; i++) {
      h.step();
      expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    }
  });

  it('Map difficulty plays in free play under Classic rules, and goes with the start', () => {
    const h = dev();
    const s = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    row(s, 'Map difficulty').adjust?.(1);
    expect(row(s, 'Map difficulty').value?.()).toBe('Hard');
    row(s, 'Start').select?.();
    const l = enterLevel(h);
    expect(h.game.ctx.mapDifficulty).toBe('hard');
    expect(l.world.mapDifficulty).toBe('hard');
    // Any other start leaves it behind: the title, then a campaign-rules play.
    h.game.showTitle();
    expect(h.game.ctx.mapDifficulty).toBeUndefined();
  });

  it('a start kept as a Classic run (before 0.4.72) plays as free play', () => {
    const h = dev();
    store.set(
      DEV_LAST_KEY,
      JSON.stringify({
        branch: 'classic',
        level: '1-1',
        name: 'SMB 1-1',
        hero: 'mario',
        look: 'mario',
        power: 'small',
        kit: false,
        rules: 'classic',
        classicRun: true,
        difficulty: 'easy',
      }),
    );
    const p = loadDevPick(h.game);
    expect(p?.classicRun).toBe(false);
    expect(p?.difficulty).toBe('easy');
    h.game.showDevMenu();
    h.idle(8);
    h.tap('jump'); // Again
    enterLevel(h);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.state.lives).toBe(99);
    expect(h.game.ctx.mapDifficulty).toBe('easy');
  });
});
