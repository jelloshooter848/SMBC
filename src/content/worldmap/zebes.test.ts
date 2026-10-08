import { describe, expect, it } from 'vitest';
import { mapPalettes } from '@content/sprites/map';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide } from '@game/map/captives';
import { guardRoad } from '@game/map/hammer-bro';
import { localSpot } from '@game/map/world-gate';
import { WORLD_4, SKETCH_4 } from './world4';
import { MAP_ACTOR_TYPES, MAP_WALKABLE, drawMapActor, mapActorBounds, mapSky } from './render';

/*
 * World 4's map page as Samus's world (0.4.27, owner notes 5, 18 and 21: each world, its map page
 * and every level in it, is themed after the hero freed there). The page keeps MUSHROOM WOODS'
 * nodes, roads, the airship's bonus spot (Larry's road, the crystal ball's reveal, the Hammer
 * Bro), the start and its local; its land is the planet Zebes: rock spires, alien plants, lava
 * pools, Samus's gunship landed by the start, a Chozo statue by 4-2 and Tourian's glass dome over
 * the castle; Rippers, Zoomers and a Metroid for critters.
 */

const at = (x: number, y: number) => SKETCH_4[y]?.[x];
const node = (id: string) => WORLD_4.nodes.find((n) => n.id === id)!;
const SCENERY = 'Λψχ«»┌┬┐└┴┘';

describe('World 4: PLANET ZEBES', () => {
  it('is the zebes theme, titled PLANET ZEBES, in its own palette and night sky', () => {
    expect(WORLD_4.theme).toBe('zebes');
    expect(WORLD_4.title).toBe('PLANET ZEBES');
    expect(mapPalettes['map-zebes']).toHaveLength(28);
    expect(mapSky(WORLD_4)).toMatch(/^#[0-9a-f]{6}$/);
    expect(mapSky(WORLD_4)).not.toBe('#5c94fc'); // never MUSHROOM WOODS' daylight
  });

  it('keeps every node, road, the exit and the seal where MUSHROOM WOODS had them', () => {
    expect(WORLD_4.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 6],
      ['4-1', 4, 3],
      ['4-2', 4, 11],
      ['4-3', 10, 11],
      ['4-4', 13, 5],
      ['bonus-4', 2, 13],
    ]);
    // the airship's bonus spot: Larry's crystal ball opens it, a Hammer Bro guards it
    expect(node('bonus-4')).toMatchObject({ kind: 'bonus', unlock: 'larry', guard: 'hammer-bro' });
    expect(WORLD_4.paths.map((p) => `${p.from}>${p.to}:${p.points.length}:${p.exit ?? ''}`)).toEqual([
      'start>4-1:8:',
      '4-1>4-2:13:',
      '4-2>4-3:11:',
      '4-3>4-4:12:',
      '4-2>bonus-4:5:secret:larry',
    ]);
    expect(WORLD_4.exits).toEqual([expect.objectContaining({ from: '4-4', to: 'smb-5', gate: 'samus' })]);
    expect(guardRoad(WORLD_4, 'bonus-4').length).toBeGreaterThan(1);
  });

  it("draws Zebes: spires, alien plants, lava pools, the gunship, the Chozo statue, Tourian's dome", () => {
    const all = SKETCH_4.join('');
    expect(all.match(/Λ/g)?.length).toBeGreaterThanOrEqual(12); // rock spires
    expect(all.match(/ψ/g)?.length).toBeGreaterThanOrEqual(10); // alien plants
    expect(all.match(/L/g)?.length).toBeGreaterThanOrEqual(4); // a lava pool
    expect(all).toContain('abdf'); // and the pond, a lava lake on Zebes
    expect(all).not.toMatch(/[()O!T,*]/); // no mushrooms, trees or flowers left
    // Samus's gunship landed beside the start
    const s = node('start');
    const ship = all.indexOf('«»');
    expect(ship).toBeGreaterThanOrEqual(0);
    const [sx, sy] = [ship % 16, Math.floor(ship / 16)];
    expect(Math.abs(sx - s.x) + Math.abs(sy - s.y)).toBeLessThanOrEqual(4);
    // the Chozo statue next to 4-2 (Samus's level)
    const n = node('4-2');
    const chozo = all.indexOf('χ');
    expect(Math.max(Math.abs((chozo % 16) - n.x), Math.abs(Math.floor(chozo / 16) - n.y))).toBe(1);
    // Tourian's glass dome stands right over the castle node: its glass, then its base and gate
    const c = node('4-4');
    expect([at(c.x - 1, c.y - 2), at(c.x, c.y - 2), at(c.x + 1, c.y - 2)].join('')).toBe('┌┬┐');
    expect([at(c.x - 1, c.y - 1), at(c.x, c.y - 1), at(c.x + 1, c.y - 1)].join('')).toBe('└┴┘');
    // none of the new scenery is walkable, and no road runs over it
    for (const ch of SCENERY) expect(MAP_WALKABLE.has(ch), ch).toBe(false);
  });

  it("leaves Samus's map hint, the local and the airship's crash site on plain ground", () => {
    const n = node('4-2');
    const side = heroSide(WORLD_4, n);
    expect(side).toBe(-1);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['#', '#']);
    const spot = localSpot(WORLD_4)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
    // the wreck lands on the bonus spot: plain ground round it
    const b = node('bonus-4');
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
    ])
      expect(at(b.x + dx, b.y + dy), `${dx},${dy}`).toBe('#');
  });

  it('its critters are Zebes creatures: Rippers, Zoomers and a Metroid; no Lakitu or goombas', () => {
    const types = WORLD_4.actors.map((a) => a.type);
    for (const t of ['ripper', 'zoomer', 'metroid']) {
      expect(MAP_ACTOR_TYPES as readonly string[], t).toContain(t);
      expect(types, t).toContain(t);
    }
    for (const t of ['lakitu', 'goomba', 'koopa', 'bubble']) expect(types, t).not.toContain(t);
    for (const a of WORLD_4.actors) {
      const [x0, y0, x1, y1] = mapActorBounds(a);
      expect(x1 > x0 && y1 > y0, a.type).toBe(true);
    }
  });

  it('a Zoomer crawls round the edge of its rock: up, along and down, turned to cling', () => {
    const a = registry();
    const zoomer = WORLD_4.actors.find((x) => x.type === 'zoomer')!;
    const seen = new Set<number>();
    const [x0, y0, x1, y1] = mapActorBounds(zoomer);
    for (let f = 0; f < 2000; f += 7) {
      const drawn: { frame: string; x: number; y: number; rotate: number }[] = [];
      const r = Object.assign(new NullRenderer(), {
        sprite(s: SpriteSheet, frame: string, x: number, y: number, _fx?: boolean, _fy?: boolean, rot?: number) {
          drawn.push({ frame: `${s.id} ${frame}`, x, y, rotate: rot ?? 0 });
        },
      });
      drawMapActor(r, a, WORLD_4, zoomer, f);
      expect(drawn).toHaveLength(1);
      const d = drawn[0]!;
      expect(d.frame).toMatch(/^zebes@zebes zoomer-[01]$/);
      expect(d.x >= x0 && d.x + 16 <= x1 && d.y >= y0 && d.y + 16 <= y1, `${f}`).toBe(true);
      seen.add(d.rotate);
    }
    expect([...seen].sort((p, q) => p - q)).toEqual([0, 90, 180, 270]);
  });
});

const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};
