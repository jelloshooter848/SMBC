import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { DevStartScene } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { BLOCK_MARKERS, drawMarker, markerFor } from '@game/world/block-markers';
import { eggBlockOf } from '@game/characters/classic/yoshi-mount';
import { T } from '@game/level/tiles';
import { makeGame, useStorage } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// 0.4.72 review nits: a power-up block's marker is what the block really gives the hero now
// (CharacterDef.blockPowerUp, an HP hero's own pick), the Yoshi mount's egg block shows the egg,
// and the START page's Mount row starts as the Dev menu's Yoshi mount (Ride gives Yoshi).

isolateClassicRegistry();
useStorage();

const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as CharacterDef;
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const row = (s: unknown, l: string) => items(s).find((i) => i.label === l) as MenuItem;

/** The pixels drawn into the 16 x 16 cell at screen (x, y), as "x,y,colour" (marker pixels only). */
function cellPixels(l: LevelScene, x: number, y: number): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    rect(rx: number, ry: number, w: number, h: number, c: string): void {
      if (w === 1 && h === 1 && rx >= x && rx < x + 16 && ry >= y && ry < y + 16)
        out.push(`${rx - x},${ry - y},${c}`);
    },
  });
  l.world.render(r);
  return out.sort();
}
function markerPixels(id: string): string[] {
  const out: string[] = [];
  drawMarker(
    Object.assign(new NullRenderer(), {
      rect: (x: number, y: number, _w: number, _h: number, c: string) => out.push(`${x + 4},${y + 4},${c}`),
    }),
    id,
    0,
    0,
  );
  return out.sort();
}

function inLevel(id: string, rules: 'classic' | 'current', over: Partial<Settings> = {}) {
  const settings: Settings = { ...defaultSettings(), dev: true, ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.ctx.assist.showHidden = true;
  h.game.devStart('1-1', hero(id), id === 'mario' ? 'small' : 'full', false, undefined, { rules });
  h.until(() => h.top() instanceof LevelScene, 600);
  return { h, l: h.top() as LevelScene, settings };
}

describe('0.4.72 review nits', () => {
  it("a power-up block's marker is what it gives this hero (an HP hero's own pick too)", () => {
    for (const [id, rules] of [
      ['mario', 'classic'],
      ['link', 'current'],
      ['samus', 'current'],
      ['simon', 'current'],
    ] as const) {
      const { l } = inLevel(id, rules);
      const w = l.world;
      // 1-1's first power-up block, column 21.
      expect(w.blockContentAt(21, 9)).toBe('powerup');
      w.camera.x = px(15 * 16);
      const cam = w.camera.pxX;
      const gives = w.player.def.blockPowerUp(w.player);
      const want = markerFor('powerup', gives);
      expect(want, `${id}: ${gives}`).toBe(BLOCK_MARKERS[gives] ? gives : 'mushroom');
      expect(cellPixels(l, 21 * 16 - cam, 9 * 16), id).toEqual(markerPixels(want as string));
    }
  });

  it("the Yoshi mount's egg block shows the egg while a strike would give it", () => {
    const { l } = inLevel('mario', 'classic', {
      classicDev: { yoshiMount: true, heroesOff: [] },
    });
    const w = l.world;
    expect(w.ctx.classicYoshi).toBe('on');
    const egg = eggBlockOf(w);
    expect(egg).not.toBeNull();
    const [tx, ty] = (egg as string).split(',').map(Number) as [number, number];
    expect(w.map.get(tx, ty)).toBe(T.Q_POWERUP);
    expect(w.blockContentAt(tx, ty)).toBe('egg');
    // Mount off: the block's own power-up.
    const off = inLevel('mario', 'classic');
    expect(off.l.world.blockContentAt(tx, ty)).toBe('powerup');
  });

  it('the Mount row starts as the Dev menu mount: Ride gives Yoshi, On and Off give None', () => {
    const start = (yoshiMount: boolean, yoshiRide?: true) => {
      const settings: Settings = {
        ...defaultSettings(),
        dev: true,
        classicDev: { yoshiMount, heroesOff: [], ...(yoshiRide ? { yoshiRide } : {}) },
      };
      const h = makeGame({ deps: { settings, applySettings: () => {} } });
      return new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    };
    expect(row(start(true, true), 'Mount').value?.()).toBe('Yoshi');
    expect(start(true, true).pick.mount).toBe('yoshi');
    expect(row(start(true), 'Mount').value?.()).toBe('None');
    expect(row(start(false), 'Mount').value?.()).toBe('None');
  });
});
