import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type Settings,
} from '@engine/save/settings';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { px } from '@engine/math/units';
import { cheatAssist, DEFAULT_ASSIST, NO_CHEATS } from '@game/context';
import { AssistOptionsScene } from '@game/scenes/options';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { BLOCK_MARKERS, markerFor } from '@game/world/block-markers';
import { CHARACTERS } from '@game/characters/registry';
import { tileDef } from '@game/level/tiles';
import { makeGame, store, useStorage } from './heroes-harness';

// 0.4.72 owner item 8: Assists > Show hidden items. With it on, every ? block, item brick and
// hidden block shows a small marker of what it holds over it (our own 8 x 8 art in a framed
// square), and hidden blocks show as ghost ? blocks. Off by default, saved with the assists, read
// out like every assist row. Drawing only: nothing in play changes.

useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;

/** The rects and sprites a World draws this frame. */
function draw(l: LevelScene) {
  const rects: { x: number; y: number; w: number; h: number; c: string }[] = [];
  const sprites: { frame: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    rect(x: number, y: number, w: number, h: number, c: string): void {
      rects.push({ x, y, w, h, c });
    },
    sprite(_s: SpriteSheet, frame: string, x: number, y: number): void {
      sprites.push({ frame, x, y });
    },
  });
  l.world.render(r);
  return { rects, sprites, frames: rects.filter((q) => q.w === 12 && q.h === 12 && q.c === '#fcfcfc') };
}

function level1(on: boolean) {
  const settings: Settings = { ...defaultSettings(), dev: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.ctx.assist.showHidden = on;
  h.game.devStart('1-1', CHARACTERS[0]!, 'small');
  h.until(() => h.top() instanceof LevelScene, 600);
  const l = h.top() as LevelScene;
  return { h, l };
}

describe('owner 0.4.72 item 8: Show hidden items', () => {
  it('off by default, saved with the other assists (an older file reads off)', () => {
    expect(defaultSettings().assist.showHidden).toBe(false);
    expect(DEFAULT_ASSIST.showHidden).toBe(false);
    const old = defaultSettings() as unknown as { assist: Record<string, unknown> };
    delete old.assist.showHidden;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().assist.showHidden).toBe(false);
    const on = defaultSettings();
    on.assist.showHidden = true;
    saveSettings(on);
    expect(loadSettings().assist.showHidden).toBe(true);
  });

  it('the Assists page row toggles it, applies it and reads it out', () => {
    const settings: Settings = { ...defaultSettings(), dev: true };
    let applied = 0;
    const h = makeGame({ deps: { settings, applySettings: () => void applied++ } });
    const page = new AssistOptionsScene(h.game, () => {});
    const row = items(page).find((i) => i.label === 'Show hidden items') as MenuItem;
    expect(row).toBeDefined();
    expect(row.value?.()).toBe('Off');
    h.game.scenes.push(page);
    h.idle(8);
    for (let i = 0; i < 20 && (page as unknown as { index: number }).index !== items(page).indexOf(row); i++)
      h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Show hidden items: Off\. Every block shows what it holds/);
    h.tap('right');
    expect(settings.assist.showHidden).toBe(true);
    expect(applied).toBeGreaterThan(0);
    expect(h.said.at(-1)).toMatch(/^Show hidden items: On/);
  });

  it('Classic rules pass it through (cheatAssist)', () => {
    expect(cheatAssist({ ...DEFAULT_ASSIST, showHidden: true }, () => NO_CHEATS).showHidden).toBe(true);
    expect(cheatAssist({ ...DEFAULT_ASSIST }, () => NO_CHEATS).showHidden).toBe(false);
  });

  it('1-1: a marker over each block that holds something on screen, the hidden 1-up block as a ghost', () => {
    const { l } = level1(true);
    const w = l.world;
    // The hidden 1-up block (column 64) and the blocks around it on screen.
    w.camera.x = Math.min(w.camera.maxX, px(56 * 16));
    const cam = w.camera.pxX;
    const d = draw(l);
    const first = cam >> 4;
    let held = 0;
    let hidden: [number, number] | null = null;
    for (let tx = first; tx <= first + 16; tx++)
      for (let ty = 0; ty < w.map.height; ty++) {
        const c = w.blockContentAt(tx, ty);
        if (c && markerFor(c, true)) held++;
        if (tileDef(w.map.get(tx, ty)).block?.kind === 'hidden') hidden = [tx, ty];
      }
    expect(held).toBeGreaterThan(0);
    expect(d.frames.length).toBe(held);
    expect(hidden).not.toBeNull();
    const [hx, hy] = hidden!;
    expect(w.blockContentAt(hx, hy)).toBe('1up');
    expect(
      d.sprites.some((s) => s.frame.startsWith('question-0') && s.x === hx * 16 - cam && s.y === hy * 16),
    ).toBe(true);
    expect(d.frames.some((q) => q.x === hx * 16 - cam + 2 && q.y === hy * 16 + 2)).toBe(true);
    // The 1-up's own green cap in it.
    expect(d.rects.some((q) => q.c === '#00a800' && q.x >= hx * 16 - cam && q.x < hx * 16 - cam + 16)).toBe(
      true,
    );
  });

  it('off: no markers and hidden blocks stay hidden', () => {
    const { l } = level1(false);
    const w = l.world;
    w.camera.x = Math.min(w.camera.maxX, px(56 * 16));
    const d = draw(l);
    expect(d.frames.length).toBe(0);
    expect(d.sprites.some((s) => s.frame.startsWith('question-0') && s.y === 8 * 16)).toBe(false);
  });

  it('a power-up block shows what it gives now; every marker is 8 x 8 and a plain brick has none', () => {
    expect(markerFor('powerup', true)).toBe('mushroom');
    expect(markerFor('powerup', false)).toBe('flower');
    expect(markerFor('none', true)).toBeNull();
    for (const c of ['coin', 'coins10', '1up', 'star', 'vine', 'poison', 'clock', 'key', 'egg'] as const)
      expect(markerFor(c, true), c).not.toBeNull();
    for (const [id, rows] of Object.entries(BLOCK_MARKERS)) {
      expect(rows.length, id).toBe(8);
      for (const row of rows) expect(row.length, id).toBe(8);
    }
  });
});
