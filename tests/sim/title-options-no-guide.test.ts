import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import { WorldMapScene } from '@game/scenes/world-map';
import { GuideIndexScene } from '@game/scenes/guide';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// 0.4.73 (owner, item 81): the REMIX title's Options has no How to play (the owner's iPhone shot
// had HOW TO PLAY between CONTROLS and ASSET PACKS). The Campaign's Options keep it: the world
// map's and the Campaign pause's, and the Campaign pause keeps its own Guide row.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const index = (h: H) => (h.top() as unknown as { index: number }).index;

function game(dev = false): H {
  const settings = { ...defaultSettings(), ...(dev ? { dev: true } : {}) };
  return makeGame({ dev, deps: { settings, applySettings: () => {} } });
}

/** Moves to row `label` on the menu on top and picks it. */
function pick(h: H, label: string): void {
  h.idle(8);
  const at = labels(h.top()).indexOf(label);
  expect(at, `${label} in ${labels(h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  while (index(h) !== at) h.tap(index(h) < at ? 'down' : 'up');
  h.tap('jump');
}

/** Title > Options. */
function titleOptions(h: H): MenuScene {
  h.game.showTitle();
  h.idle(400);
  pick(h, 'Options');
  expect(h.top()).toBeInstanceOf(OptionsScene);
  return h.top() as MenuScene;
}

describe('item 81: the title Options has no How to play', () => {
  for (const dev of [false, true])
    it(`title > Options lists no How to play (dev mode ${dev ? 'on' : 'off'})`, () => {
      const h = game(dev);
      const o = titleOptions(h);
      expect(labels(o)).not.toContain('How to play');
      // Controls is followed straight by what came after How to play.
      const l = labels(o);
      expect(l.slice(0, 3)).toEqual(['Video', 'Audio', 'Controls']);
      expect(l[l.indexOf('Controls') + 1]).toBe(dev ? 'Save files' : 'Asset packs');
      expect(l).toContain('Asset packs');
      expect(l.at(-1)).toBe('Back');
    });

  it("the title's Options hint no longer offers How to play", () => {
    const h = game();
    h.game.showTitle();
    h.idle(400);
    const row = (h.top() as unknown as { items: MenuItem[] }).items.find((i) => i.label === 'Options');
    expect(row?.hint ?? '').not.toMatch(/how to play/i);
  });

  it('focus and announcements step straight from Controls to Asset packs and back', () => {
    const h = game();
    titleOptions(h);
    expect(h.said.at(-1)).toBe('Options. Video');
    h.idle(8);
    h.tap('down');
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toBe('Controls');
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toBe('Asset packs');
    h.idle(8);
    h.tap('up');
    expect(h.said.at(-1)).toBe('Controls');
    // Into Controls and back: the Options page says its focused row again.
    h.idle(8);
    h.tap('jump');
    expect(h.said.at(-1)).toMatch(/^Controls\. /);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(h.said.at(-1)).toBe('Controls');
    // Back to the title, which says its focused row again.
    h.idle(8);
    h.tap('attack');
    expect(h.said.at(-1)).toMatch(/^Options\b/);
  });

  it('wrapping past the ends of the title Options never lands on a missing row', () => {
    const h = game();
    const o = titleOptions(h);
    const n = labels(o).length;
    for (let i = 0; i < n * 2; i++) {
      h.idle(8);
      h.tap('down');
      expect(labels(o)[index(h)]).toBeDefined();
      expect(h.said.at(-1)).not.toMatch(/how to play/i);
    }
  });
});

describe('item 81: the Campaign Options keep How to play', () => {
  it("the world map's pause > Options has How to play, and it opens the guides", () => {
    const h = game(true);
    const map = new WorldMapScene(h.game, 'smb-1');
    h.game.scenes.push(map);
    (map as unknown as { openPause(): void }).openPause();
    pick(h, 'Options');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(labels(h.top())).toContain('How to play');
    pick(h, 'How to play');
    expect(h.top()).toBeInstanceOf(GuideIndexScene);
    const names = labels(h.top()).filter((l) => l !== 'Back');
    expect(names).toEqual(h.game.roster.map((c) => c.name));
  });

  it('the Campaign pause > Options has How to play, and the pause keeps its Guide row', () => {
    const h = game(true);
    h.game.scenes.push(new PauseScene(h.game, null));
    expect(h.game.classicRun).toBeFalsy();
    expect(labels(h.top()).some((l) => /^Guide\b/.test(l))).toBe(true);
    pick(h, 'Options');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(labels(h.top())).toContain('How to play');
    pick(h, 'How to play');
    expect(h.top()).toBeInstanceOf(GuideIndexScene);
  });

  it('the translucent (in-game) Options keep How to play after Controls (v0.4.77 item 192: no Asset packs)', () => {
    const h = game();
    const o = new OptionsScene(h.game, () => {}, true);
    const l = labels(o);
    expect(l.indexOf('How to play')).toBeGreaterThan(l.indexOf('Controls'));
    expect(l).not.toContain('Asset packs');
  });

  it("Classic's Options keep How to play", () => {
    const h = game();
    expect(labels(new OptionsScene(h.game, () => {}, false, true))).toContain('How to play');
    expect(labels(new OptionsScene(h.game, () => {}, true, true))).toContain('How to play');
  });
});
