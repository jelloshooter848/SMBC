import { afterEach, describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { saveJson } from '@engine/save/storage';
import { CLASSIC_CHARACTERS } from '@game/characters/registry';
import { startHp } from '@game/characters/character';
import { LINK } from '@game/characters/link';
import { reconcileRules } from '@game/rules/reconcile';
import { DEV_LAST_KEY, devAgainItem, type DevPick } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicOptionsScene } from '@game/scenes/original-game';
import type { ClassicTitleScene } from '@game/scenes/original-title';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-10 QA (follow-up): Again replays a start with the swapped design's power; reconcile resets a
// power that no longer fits when Plays as flips with dev mode on, both ways; and the boxed CLASSIC
// Options (B-I) shows neither the Expansion heroes nor a Rules row, dev mode on or off.

useStorage();
afterEach(() => store.clear());

function devGame(dev = true): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const level = (h: H) => {
  h.until(() => h.top() instanceof LevelScene, 600);
  return h.top() as LevelScene;
};

const pick = (power: string): DevPick => ({
  branch: 'classic',
  level: '1-1',
  name: 'SMB 1-1',
  hero: 'link',
  look: 'link',
  power,
  kit: false,
  rules: 'classic',
  classicRun: false,
  difficulty: 'normal',
});

describe('BUG-10 QA: Again plays the swapped design', () => {
  it('a kept Classic Link start with Plays as Campaign: Again starts his Campaign design at full HP', () => {
    const h = devGame();
    h.settings.classicDev.playsCampaign = ['link'];
    saveJson(DEV_LAST_KEY, pick('fire'));
    const again = devAgainItem(h.game) as MenuItem;
    expect(again).toBeTruthy();
    again.select?.();
    const l = level(h);
    expect(l.world.players[0]?.def).toBe(LINK);
    expect(h.game.state.powerState).toBe('full');
    expect(h.game.state.hp).toBe(startHp(LINK));
  });

  it('without the swap, the same kept start plays his Classic kit at its power', () => {
    const h = devGame();
    saveJson(DEV_LAST_KEY, pick('big'));
    (devAgainItem(h.game) as MenuItem).select?.();
    expect(level(h).world.players[0]?.def).toBe(CLASSIC_CHARACTERS.link);
    expect(h.game.state.powerState).toBe('big');
  });
});

describe('BUG-10 QA: reconcile with dev mode on, Plays as flipped both ways', () => {
  it('Classic Link (power-up) flipped to Campaign: reset to full HP; flipped back: reset to small', () => {
    const h = devGame();
    h.game.devClassicGame(LINK, '1-1', 'classic');
    level(h);
    h.game.state.powerState = 'fire';
    reconcileRules(h.game, 'classic');
    expect(h.game.state.powerState).toBe('fire');
    h.settings.classicDev.playsCampaign = ['link'];
    reconcileRules(h.game, 'classic');
    expect(h.game.state.powerState).toBe('full');
    expect(h.game.state.hp).toBe(startHp(LINK));
    h.settings.classicDev.playsCampaign = [];
    reconcileRules(h.game, 'classic');
    expect(h.game.state.powerState).toBe('small');
  });

  it("a power outside the design's own list is reset, not only a kind mismatch", () => {
    const h = devGame();
    h.game.devClassicGame(LINK, '1-1', 'classic');
    level(h);
    h.game.state.powerState = 'nonsense';
    reconcileRules(h.game, 'classic');
    expect(h.game.state.powerState).toBe('small');
  });
});

/** Every text the scene stack draws this frame. */
function texts(h: H): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_s: SpriteSheet, str: string): void {
      out.push(str);
    },
  });
  h.game.scenes.render(r);
  return out;
}

describe('B-I boxed CLASSIC Options: no Expansion heroes and no Rules row', () => {
  for (const dev of [false, true])
    it(`dev mode ${dev ? 'on' : 'off'}`, () => {
      const h = devGame(dev);
      h.game.showClassicTitle('start');
      const title = h.top() as ClassicTitleScene;
      title.index = title.items.findIndex((i) => i.label === 'Options');
      h.tap('jump');
      const o = h.top();
      expect(o).toBeInstanceOf(ClassicOptionsScene);
      const rows = (o as unknown as { items: MenuItem[] }).items;
      const labels = rows.map((i) => i.label);
      expect(labels).toContain('Weapons');
      for (const bad of ['Expansion heroes', 'Rules', 'Classic rules']) expect(labels).not.toContain(bad);
      for (const i of rows) expect(i.hint ?? '').not.toMatch(/Expansion heroes/);
      const drawn = texts(h).join('\n').toUpperCase();
      expect(drawn).toContain('WEAPONS');
      expect(drawn).not.toMatch(/EXPANSION HEROES|CLASSIC RULES|^RULES/m);
    });
});
