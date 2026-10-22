import { afterEach, describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CheatsScene } from '@game/scenes/cheats-menu';
import { ClassicHeroesScene } from '@game/scenes/disable-heroes';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { ClassicOptionRowsScene } from '@game/scenes/original-options';
import { ClassicOverwriteScene, ClassicSetScene } from '@game/scenes/original-saves';
import { ClassicTitleScene, CLASSIC_AT } from '@game/scenes/original-title';
import { OptionsScene } from '@game/scenes/options';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-01 (owner bug log on 0.4.68): CLASSIC > Options is a box over the CLASSIC title's demo, as
// the Start box and the map set box are, not the old full-screen page, and so are the pages it
// opens (More settings, Weapons, Disable heroes, Cheats). Their rows, announcements and touch
// buttons stay. RC-040 rides along: every CLASSIC box moves and goes back with the original's
// sounds (MessageBoxSounds: the fireball to move, the bump to cancel), as the Start box does.

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** Everything the scene stack draws this frame: texts (with their sheet) and sprite frames. */
function frame(h: H) {
  const texts: { str: string; x: number; y: number; sheet: string }[] = [];
  const sprites: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(s: SpriteSheet, str: string, x: number, y: number): void {
      texts.push({ str, x, y, sheet: s.id });
    },
    sprite(_s: SpriteSheet, f: string): void {
      sprites.push(f);
    },
  });
  h.game.scenes.render(r);
  return { texts, sprites };
}

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const pickRow = (h: H, label: string) => {
  const i = items(h.top()).findIndex((it) => it.label === label);
  expect(i, label).toBeGreaterThanOrEqual(0);
  (h.top() as unknown as { index: number }).index = i;
  h.idle(8);
  h.tap('jump');
};

/** The CLASSIC title with its Start box, then Options in it. */
function openOptions(h: H): ClassicOptionsScene {
  h.game.showClassicTitle('start');
  const title = h.top() as ClassicTitleScene;
  title.index = title.items.findIndex((i) => i.label === 'Options');
  h.tap('jump');
  expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
  return h.top() as ClassicOptionsScene;
}

/** The box's rows sit under CLASSIC and above a hero standing on the demo's ground. */
function inBoxRoom(texts: { str: string; y: number }[], labels: string[]): void {
  const ys = labels.map((l) => texts.find((t) => t.str.startsWith(l.toUpperCase()))?.y ?? NaN);
  for (const [i, y] of ys.entries()) expect(Number.isFinite(y), labels[i]).toBe(true);
  expect(Math.min(...ys) - 7).toBeGreaterThanOrEqual(CLASSIC_AT.y + 29);
  expect(Math.max(...ys) + 15).toBeLessThanOrEqual(208 - 32);
}

describe('BUG-01 CLASSIC > Options is a box over the demo', () => {
  it('from the Start box: a box over the title, its logo and demo still drawn and playing', () => {
    const h = classic();
    const opts = openOptions(h);
    expect(opts.translucent).toBe(true);
    const f = frame(h);
    // The title is drawn under it (its demo, the logo); no black page.
    expect(f.sprites).toContain('classic');
    expect(f.texts.some((t) => t.str === 'CLASSIC OPTIONS')).toBe(false);
    const header = f.texts.find((t) => t.str === 'OPTIONS');
    expect(header?.sheet).toMatch(/gold/);
    inBoxRoom(f.texts, ['Options', 'Game mode']);
    const title = h.game.scenes.find((s) => s instanceof ClassicTitleScene) as ClassicTitleScene;
    const t0 = title.demo.t;
    h.idle(10);
    expect(title.demo.t).toBe(t0 + 10);
    // Its rows and announcements are the page's own.
    expect(items(opts).map((i) => i.label)).toContain('More settings');
    expect(h.said.at(-1)).toMatch(/^Classic options\. Game mode/);
    expect(opts.touchLabels().jump).toBe('CHANGE');
    // BACK: the Start box again.
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicTitleScene);
  });

  it('from the map set box: a box over the title too, and BACK returns to the map set box', () => {
    const h = classic();
    h.game.showClassicMenu();
    pickRow(h, 'Options');
    expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
    expect((h.top() as ClassicOptionsScene).translucent).toBe(true);
    expect(frame(h).sprites).toContain('classic');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  });

  it('More settings, Weapons, Disable heroes and Cheats open as boxes with their names on top', () => {
    const pages: [string, new (...a: never[]) => unknown, string][] = [
      ['More settings', ClassicOptionRowsScene, 'MORE SETTINGS'],
      ['Weapons', ClassicOptionRowsScene, 'CUSTOMIZE WEAPONS'],
      ['Disable heroes', ClassicHeroesScene, 'DISABLE HEROES'],
      ['Cheats', CheatsScene, 'CHEATS'],
    ];
    for (const [row, type, name] of pages) {
      const h = classic();
      openOptions(h);
      pickRow(h, row);
      expect(h.top(), row).toBeInstanceOf(type);
      expect((h.top() as { translucent: boolean }).translucent, row).toBe(true);
      const f = frame(h);
      expect(f.sprites, row).toContain('classic');
      expect(f.texts.find((t) => t.str === name)?.sheet, row).toMatch(/gold/);
      const first = items(h.top())[0]?.label as string;
      inBoxRoom(f.texts, [name, first.replace(/\*$/, '').slice(0, 6)]);
      // Long pages scroll inside the box; BACK is its last row, reached by moving up from the top.
      h.idle(8);
      h.tap('up');
      const last = frame(h).texts.find((t) => t.str === 'BACK' && t.y < 200);
      expect(last, row).toBeDefined();
      h.tap('attack');
      expect(h.top(), row).toBeInstanceOf(ClassicOptionsScene);
    }
  });

  it('Video, audio, controls stays the full Options page; Cheats from the pause stays as it was', () => {
    const h = classic();
    openOptions(h);
    pickRow(h, 'Video, audio, controls');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(frame(h).sprites).not.toContain('classic');
    const p = classic();
    p.game.classicGame(MARIO, '1-1');
    p.until(() => p.top() instanceof LevelScene, 600);
    p.game.scenes.push(new CheatsScene(p.game, () => p.game.scenes.pop(), { all: false, translucent: true }));
    expect(frame(p).sprites).not.toContain('classic');
  });
});

describe('RC-040 the CLASSIC boxes sound as the Start box does', () => {
  const sounds = (h: H) => h.audio.sfx.mock.calls.map((c) => c[0] as string);
  const moveAndBack = (h: H): string[] => {
    h.idle(8);
    h.audio.sfx.mockClear();
    h.tap('down');
    h.tap('attack');
    return sounds(h);
  };

  it('the map set box, Options and its pages: the fireball to move, the bump to go back', () => {
    const h = classic();
    h.game.showClassicMenu();
    expect(moveAndBack(h)).toEqual(['fireball', 'bump']);
    for (const row of ['', 'More settings', 'Disable heroes', 'Cheats']) {
      const o = classic();
      openOptions(o);
      if (row) pickRow(o, row);
      expect(moveAndBack(o), row || 'Options').toEqual(['fireball', 'bump']);
    }
  });

  it('CONTINUE / NEW GAME and the overwrite warning too', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1');
    h.game.goToLevel('1-2', { mode: 'stand' });
    h.game.showClassicMenu();
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
    h.idle(8);
    h.audio.sfx.mockClear();
    h.tap('down');
    expect(sounds(h)).toEqual(['fireball']);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicOverwriteScene);
    expect(moveAndBack(h)).toEqual(['fireball', 'bump']);
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
    h.audio.sfx.mockClear();
    h.tap('attack');
    expect(sounds(h)).toEqual(['bump']);
  });

  it('every other menu keeps the menu blip (the title’s Options)', () => {
    const h = classic();
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
    expect(moveAndBack(h)).toEqual(['select', 'select']);
  });
});
