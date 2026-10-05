import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES, SPRITES } from '@content/sprites/index';
import type { MapActor } from '@game/map/types';
import { MAP_PAGES } from './index';
import {
  drawMapActor,
  drawMapTile,
  MAP_ACTOR_TYPES,
  MAP_LEGEND,
  MAP_WALKABLE,
  mapSky,
  mapTileFrame,
} from './render';

/** Records every sprite drawn and fails on a frame its sheet doesn't have. */
class CheckingRenderer implements Renderer {
  readonly drawn: { sheet: string; frame: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(sheet: SpriteSheet, frame: string, x: number, y: number): void {
    expect(sheet.frames.has(frame), `${sheet.id} has "${frame}"`).toBe(true);
    expect(Number.isFinite(x) && Number.isFinite(y), `${frame} at ${x},${y}`).toBe(true);
    this.drawn.push({ sheet: sheet.id, frame, x, y });
  }
}

const registry = (): AssetRegistry => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

describe('map rendering', () => {
  it('draws every legend tile in every theme and animation frame', () => {
    const assets = registry();
    for (const page of MAP_PAGES) {
      const r = new CheckingRenderer();
      for (let t = 0; t < 400; t += 7)
        for (const ch of Object.keys(MAP_LEGEND)) drawMapTile(r, assets, page, ch, 32, 48, t);
      expect(r.drawn.every((d) => d.sheet === `map@map-${page.theme}`)).toBe(true);
      expect(r.drawn.some((d) => d.frame === 'water-7')).toBe(true);
    }
  });

  it('draws nothing for sky and unknown chars', () => {
    const r = new CheckingRenderer();
    const page = MAP_PAGES[0];
    if (!page) throw new Error('no pages');
    drawMapTile(r, registry(), page, '.', 0, 0, 0);
    drawMapTile(r, registry(), page, '?', 0, 0, 0);
    expect(r.drawn).toEqual([]);
  });

  it('animates water, lava and stars from the frame counter alone', () => {
    expect(mapTileFrame('~', 0)).toBe('water-0');
    expect(mapTileFrame('~', 8)).toBe('water-1');
    expect(mapTileFrame('~', 64)).toBe('water-0');
    expect(mapTileFrame('8', 16)).toBe('shore-n-2');
    expect(mapTileFrame('L', 12)).toBe('lava-1');
    expect(mapTileFrame('s', 0)).not.toBe(mapTileFrame('x', 0));
    expect(mapTileFrame('#', 99)).toBe('ground');
  });

  it('walkable tiles are ground-like, never water, walls or scenery', () => {
    for (const ch of '#,*:o=I(O){-}G87923146qezc[]nu') expect(MAP_WALKABLE.has(ch), ch).toBe(true);
    for (const ch of '.~L%TYHS^RCKhj!|WVPXsxDkabdfgilmprtv') expect(MAP_WALKABLE.has(ch), ch).toBe(false);
  });

  it('gives each theme its own sky colour', () => {
    const skies = MAP_PAGES.map(mapSky);
    for (const s of skies) expect(s).toMatch(/^#[0-9a-f]{6}$/);
    expect(mapSky(MAP_PAGES[7] as (typeof MAP_PAGES)[number])).toBe('#881400');
  });

  it('draws every actor type on every page over a long stretch of frames', () => {
    const assets = registry();
    for (const page of MAP_PAGES) {
      const actors: MapActor[] = [
        ...page.actors,
        ...MAP_ACTOR_TYPES.map((type): MapActor => ({ type, x: 100, y: 100, props: {} })),
      ];
      const r = new CheckingRenderer();
      for (let t = 0; t < 2000; t += 3) for (const a of actors) drawMapActor(r, assets, page, a, t);
      expect(r.drawn.length).toBeGreaterThan(0);
      for (const d of r.drawn) {
        expect(d.x, `${d.frame} x`).toBeGreaterThan(-80);
        expect(d.x, `${d.frame} x`).toBeLessThan(336);
      }
    }
  });

  it('keeps every page actor moving and on screen at some point', () => {
    const assets = registry();
    for (const page of MAP_PAGES)
      for (const a of page.actors) {
        const r = new CheckingRenderer();
        for (let t = 0; t < 1200; t += 5) drawMapActor(r, assets, page, a, t);
        expect(r.drawn.length, `${page.world} ${a.type}`).toBeGreaterThan(0);
        const spots = new Set(r.drawn.map((d) => `${d.frame}@${Math.round(d.x)},${Math.round(d.y)}`));
        expect(spots.size, `${page.world} ${a.type} animates`).toBeGreaterThan(1);
        expect(
          r.drawn.some((d) => d.x > -16 && d.x < 256 && d.y > -16 && d.y < 240),
          `${page.world} ${a.type} visible`,
        ).toBe(true);
      }
  });

  it('wraps drifting actors with the page while it slides', () => {
    const assets = registry();
    const page = MAP_PAGES[4];
    const bullet = page?.actors.find((a) => a.type === 'bullet');
    if (!page || !bullet) throw new Error('world 5 has bullets');
    const at = (a: MapActor) => {
      const r = new CheckingRenderer();
      drawMapActor(r, assets, page, a, 500);
      return r.drawn[0]?.x ?? NaN;
    };
    const home = at(bullet);
    expect(at({ ...bullet, x: bullet.x + 256 })).toBeCloseTo(home + 256);
    expect(at({ ...bullet, x: bullet.x - 100 })).toBeCloseTo(home - 100);
  });
});
