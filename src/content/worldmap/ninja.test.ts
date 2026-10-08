import { describe, expect, it } from 'vitest';
import { mapPalettes } from '@content/sprites/map';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { heroSide } from '@game/map/captives';
import { localSpot } from '@game/map/world-gate';
import { WORLD_6, SKETCH_6 } from './world6';
import { MAP_ACTOR_TYPES, MAP_WALKABLE, drawMapActor, mapActorBounds, mapSky, pageTileFrame } from './render';

/*
 * World 6's map page as Ryu's world (0.4.29, owner notes 5, 18 and 21: each world, its map page
 * and every level in it, is themed after the hero freed there). The page keeps SNOW NIGHT's
 * nodes, roads, the seal, the start and its local; its land is a ninja game's night under a full
 * moon: DRAGON VALLEY, the Hayabusa village and its dojo by the start, a bamboo forest round 6-1,
 * the night city's rooftops and neon by 6-2, snowy mountain passes round 6-3 and the demon temple,
 * Jaquio's fortress, over 6-4; hawks, ninjas leaping between the rooftops and a masked ninja's
 * silhouette for critters.
 */

const at = (x: number, y: number) => SKETCH_6[y]?.[x];
const node = (id: string) => WORLD_6.nodes.find((n) => n.id === id)!;
const SCENERY = '¤⌐¬▛▀▜▙▄▟';
const count = (ch: string) => [...SKETCH_6.join('')].filter((c) => c === ch).length;
const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

/** Every sprite `actor` draws over `frames` frames, as `sheet frame x y`. */
function drawn(
  actor: (typeof WORLD_6.actors)[number],
  frames: number,
): { f: string; x: number; y: number }[] {
  const a = registry();
  const out: { f: string; x: number; y: number }[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, frame: string, x: number, y: number) {
      out.push({ f: `${s.id} ${frame}`, x, y });
    },
  });
  for (let t = 0; t < frames; t += 3) drawMapActor(r, a, WORLD_6, actor, t);
  return out;
}

describe('World 6: DRAGON VALLEY', () => {
  it('is the ninja theme, titled DRAGON VALLEY, in its own palette and night sky', () => {
    expect(WORLD_6.theme).toBe('ninja');
    expect(WORLD_6.title).toBe('DRAGON VALLEY');
    expect(mapPalettes['map-ninja']).toHaveLength(28);
    expect(mapSky(WORLD_6)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps every node, road, the exit and the seal where SNOW NIGHT had them', () => {
    expect(WORLD_6.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 11],
      ['6-1', 2, 7],
      ['6-2', 7, 4],
      ['6-3', 12, 9],
      ['6-4', 14, 6],
      ['bonus-6', 10, 12],
    ]);
    expect(WORLD_6.paths.map((p) => `${p.from}>${p.to}:${p.points.length}`)).toEqual([
      'start>6-1:7',
      '6-1>6-2:9',
      '6-2>6-3:11',
      '6-3>6-4:6',
      '6-3>bonus-6:6',
    ]);
    expect(WORLD_6.exits).toEqual([
      expect.objectContaining({ from: '6-4', to: 'smb-7', side: 'right', gate: 'ryu' }),
    ]);
    // every road tile is walkable
    for (const p of [...WORLD_6.paths, ...WORLD_6.exits])
      for (const [x, y] of p.points) expect(MAP_WALKABLE.has(WORLD_6.tiles[y]![x]!), `${x},${y}`).toBe(true);
  });

  it("draws Ryu's world: the village and its dojo, bamboo, the night city, snowy passes, the demon temple", () => {
    const all = SKETCH_6.join('');
    expect(count('Ħ')).toBeGreaterThanOrEqual(3); // the Hayabusa village
    expect(count('T')).toBeGreaterThanOrEqual(12); // the bamboo forest
    expect(count('0') + count('¤')).toBeGreaterThanOrEqual(6); // the night city
    expect(count('¤')).toBeGreaterThanOrEqual(2); // its neon signs
    expect(count('S') + count('^') + count('j')).toBeGreaterThanOrEqual(12); // the snowy passes
    expect(all).toContain('D'); // the full moon
    // the page's own frames for the shared tiles
    expect(pageTileFrame(WORLD_6, 'T', 0)).toBe('bamboo');
    expect(pageTileFrame(WORLD_6, 'Ħ', 0)).toBe('minka');
    expect(pageTileFrame(WORLD_6, '0', 0)).toBe('ng-rooftops');
    expect(pageTileFrame(WORLD_6, 'D', 0)).toBe('full-moon');
    // the village sits round the start, the dojo with it
    const start = node('start');
    const dojo = all.indexOf('⌐¬');
    expect(dojo).toBeGreaterThanOrEqual(0);
    const [dx, dy] = [dojo % 16, Math.floor(dojo / 16)];
    expect(Math.max(Math.abs(dx - start.x), Math.abs(dy - start.y))).toBeLessThanOrEqual(5);
    // the city's rooftops stand by 6-2
    const c2 = node('6-2');
    for (let i = 0; i < all.length; i++)
      if (all[i] === '0' || all[i] === '¤')
        expect(
          Math.abs((i % 16) - c2.x) + Math.abs(Math.floor(i / 16) - c2.y),
          `city ${i}`,
        ).toBeLessThanOrEqual(5);
    // the demon temple stands over 6-4: its roofs over its walls and gate
    const c4 = node('6-4');
    const temple = all.indexOf('▛▀▜');
    const [tx, ty] = [temple % 16, Math.floor(temple / 16)];
    expect([at(tx, ty + 1), at(tx + 1, ty + 1), at(tx + 2, ty + 1)].join('')).toBe('▙▄▟');
    expect(Math.abs(tx + 1 - c4.x)).toBeLessThanOrEqual(1);
    expect(c4.y - (ty + 1)).toBeGreaterThanOrEqual(1);
    expect(c4.y - (ty + 1)).toBeLessThanOrEqual(2);
    // none of the new scenery is walkable, and no road runs over it
    for (const ch of SCENERY) expect(MAP_WALKABLE.has(ch), ch).toBe(false);
    expect(all).not.toMatch(/[{}|~]/);
  });

  it("leaves Ryu's map hint (the crystal ball's silhouette), the local and the seal on plain ground", () => {
    const n = node('6-4');
    const side = heroSide(WORLD_6, n);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['#', '#']);
    const spot = localSpot(WORLD_6)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
    const seal = WORLD_6.exits[0]!.points.at(-1)!;
    expect(at(seal[0], seal[1])).toBe('#');
  });

  it('its critters are hawks, leaping ninjas and a masked ninja; no Koopas, Cheeps or clouds', () => {
    const types = WORLD_6.actors.map((a) => a.type);
    for (const t of ['hawk', 'ninja', 'masked-ninja']) {
      expect(MAP_ACTOR_TYPES as readonly string[], t).toContain(t);
      expect(types, t).toContain(t);
    }
    for (const t of ['koopa', 'cheep', 'cloud', 'bubble']) expect(types, t).not.toContain(t);
    for (const a of WORLD_6.actors) {
      const [x0, y0, x1, y1] = mapActorBounds(a);
      expect(x1 > x0 && y1 > y0, a.type).toBe(true);
      expect(y0, `${a.type} under the header`).toBeGreaterThanOrEqual(24);
    }
  });

  it('a hawk glides round and flaps, in its bounds', () => {
    const hawk = WORLD_6.actors.find((x) => x.type === 'hawk')!;
    const [x0, y0, x1, y1] = mapActorBounds(hawk);
    const d = drawn(hawk, 1200);
    // Ryu's hawk (the ninja sheet's, his mini game's)
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['ninja hawk-0', 'ninja hawk-1']));
    for (const s of d)
      expect(s.x >= x0 && s.x + 16 <= x1 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
  });

  it('a ninja leaps from rooftop to rooftop and back: crouched on the roofs, airborne between', () => {
    const ninja = WORLD_6.actors.find((x) => x.type === 'ninja')!;
    const [x0, y0, x1, y1] = mapActorBounds(ninja);
    const d = drawn(ninja, 1200);
    expect(new Set(d.map((s) => s.f))).toEqual(
      new Set(['map@map-ninja ninja-crouch', 'map@map-ninja ninja-leap']),
    );
    const ys = d.map((s) => s.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(12); // an arc, not a line
    for (const s of d)
      expect(s.x >= x0 && s.x + 16 <= x1 && s.y >= y0 && s.y + 16 <= y1, `${s.x},${s.y}`).toBe(true);
    // it lands on both roofs
    const crouched = d.filter((s) => s.f.endsWith('crouch')).map((s) => s.x);
    expect(Math.max(...crouched) - Math.min(...crouched)).toBeGreaterThanOrEqual(24);
  });

  it("the masked ninja's silhouette stands still, its scarf streaming", () => {
    const masked = WORLD_6.actors.find((x) => x.type === 'masked-ninja')!;
    const d = drawn(masked, 600);
    expect(new Set(d.map((s) => s.f))).toEqual(new Set(['map@map-ninja masked-0', 'map@map-ninja masked-1']));
    expect(new Set(d.map((s) => `${s.x},${s.y}`)).size).toBe(1);
  });
});
