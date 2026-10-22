import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { levelIds, specialLevelIds } from '@content/levels';
import { DEV_LAST_KEY, DevStartScene, loadDevPick } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { ridingOf } from '@game/characters/classic/yoshi-mount';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// 0.4.72 owner item 6: the dev Level select's START page has a Mount row (None / Yoshi) for a
// Classic start: Yoshi starts the level riding him. Classic SMBC rules and a hero who rides only.

isolateClassicRegistry();
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const row = (s: unknown, l: string) => items(s).find((i) => i.label === l) as MenuItem;

function dev(): H & { settings: Settings } {
  const settings = { ...defaultSettings(), dev: true } as Settings;
  const h = makeGame({
    deps: { settings, applySettings: () => {}, listLevels: () => [...levelIds(), ...specialLevelIds()] },
  });
  return { ...h, settings };
}
const enterLevel = (h: H): LevelScene => {
  h.until(() => h.top() instanceof LevelScene, 900);
  h.idle(2);
  return h.top() as LevelScene;
};
const start = (h: H, level = '1-1') =>
  new DevStartScene(h.game, { branch: 'classic', level, name: 'SMB 1-1' });

describe('owner 0.4.72 item 6: the START page Mount row', () => {
  it('a Classic start has Mount after Power, None by default; a Campaign start has none', () => {
    const h = dev();
    const s = start(h);
    const labels = items(s).map((i) => i.label);
    expect(labels.indexOf('Mount')).toBe(labels.indexOf('Power') + 1);
    expect(row(s, 'Mount').value?.()).toBe('None');
    row(s, 'Mount').adjust?.(1);
    expect(row(s, 'Mount').value?.()).toBe('Yoshi');
    expect(row(s, 'Mount').hint).toMatch(/starts the level riding him/);
    const c = new DevStartScene(h.game, { branch: 'campaign', level: '1-1', name: 'World 1-1' });
    expect(items(c).map((i) => i.label)).not.toContain('Mount');
  });

  it('Yoshi: the level starts riding him (Mario, Classic SMBC rules), read out by the Again row', () => {
    const h = dev();
    const s = start(h);
    row(s, 'Mount').adjust?.(1);
    expect(s.pick.mount).toBe('yoshi');
    row(s, 'Start').select?.();
    const l = enterLevel(h);
    expect(h.game.ctx.classicYoshi).toBe('ride');
    expect(ridingOf(l.world.player)).not.toBeNull();
    // Kept for Again, named in its hint.
    h.game.showTitle();
    expect(h.game.ctx.classicYoshi).toBeUndefined();
    h.game.showDevMenu();
    expect(items(h.top() as MenuScene)[0]?.hint).toMatch(/riding Yoshi/);
    h.idle(8);
    h.tap('jump');
    expect(ridingOf(enterLevel(h).world.player)).not.toBeNull();
  });

  it('None: no Yoshi at the start, even with the Dev menu mount on Ride (it plays as On)', () => {
    const h = dev();
    h.settings.classicDev = { yoshiMount: true, yoshiRide: true, heroesOff: [] };
    row(start(h), 'Start').select?.();
    const l = enterLevel(h);
    expect(ridingOf(l.world.player)).toBeNull();
    expect(h.game.ctx.classicYoshi).toBe('on');
  });

  it("Campaign rules or a hero who never rides: '-', and nothing is ridden", () => {
    const h = dev();
    const s = start(h);
    row(s, 'Mount').adjust?.(1);
    row(s, 'Rules').adjust?.(1); // Campaign
    expect(row(s, 'Mount').value?.()).toBe('-');
    expect(s.pick.mount).toBeUndefined();
    row(s, 'Rules').adjust?.(1); // Classic SMBC again
    for (let i = 0; i < 30 && s.hero.id !== 'sophia'; i++) row(s, 'Hero').adjust?.(1);
    expect(s.hero.id).toBe('sophia');
    expect(row(s, 'Mount').value?.()).toBe('-');
    expect(s.pick.mount).toBeUndefined();
  });

  it('a kept start without a mount (before 0.4.72) starts with None', () => {
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
        classicRun: false,
        difficulty: 'normal',
      }),
    );
    expect(loadDevPick(h.game)?.mount).toBeUndefined();
  });
});
