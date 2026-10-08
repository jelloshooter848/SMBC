import { describe, expect, it } from 'vitest';
import { mapDef, mapPalettes } from '@content/sprites/map';
import { heroSide } from '@game/map/captives';
import { localSpot } from '@game/map/world-gate';
import { WORLD_3, SKETCH_3 } from './world3';
import { WORLD_4 } from './world4';
import { MAP_WALKABLE, mapActorBounds, mapSky, pageTileFrame } from './render';

/*
 * World 3's map page as Mega Man's world (0.4.26, owner notes 5, 18 and 21: each world, its map
 * page and every level in it, is themed after the hero freed there). The page keeps NIGHT HILLS'
 * nodes, roads, bonus spot, start and local; its land is a Mega Man 2-style city map: Dr. Light's
 * lab by the start, city blocks, robot-master quarters (Metal Man's gearworks, Wood Man's forest,
 * Flash Man's crystals) and Wily's skull fortress over the castle.
 */

const at = (x: number, y: number) => SKETCH_3[y]?.[x];
const node = (id: string) => WORLD_3.nodes.find((n) => n.id === id)!;

describe('World 3: MEGA CITY', () => {
  it('is the megaman theme, titled MEGA CITY, in its own palette and night sky', () => {
    expect(WORLD_3.theme).toBe('megaman');
    expect(WORLD_3.title).toBe('MEGA CITY');
    expect(mapPalettes['map-megaman']).toHaveLength(28);
    expect(mapSky(WORLD_3)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps every node, road and the exit where NIGHT HILLS had them', () => {
    expect(WORLD_3.nodes.map((n) => [n.id, n.x, n.y])).toEqual([
      ['start', 0, 4],
      ['3-1', 4, 6],
      ['3-2', 3, 11],
      ['3-3', 9, 10],
      ['3-4', 13, 6],
      ['bonus-3', 8, 5],
    ]);
    expect(node('bonus-3')).toMatchObject({ kind: 'bonus', unlock: 'bonus-3' });
    expect(WORLD_3.paths.map((p) => `${p.from}>${p.to}:${p.points.length}`)).toEqual([
      'start>3-1:7',
      '3-1>3-2:9',
      '3-2>3-3:10',
      '3-3>3-4:9',
      '3-1>bonus-3:6',
    ]);
    expect(WORLD_3.exits).toEqual([expect.objectContaining({ from: '3-4', to: 'smb-4', gate: 'megaman' })]);
  });

  it("draws a Mega Man city map: Dr. Light's lab, city blocks, robot-master quarters, Wily's fortress", () => {
    const all = SKETCH_3.join('');
    // Dr. Light's lab stands by the start, above the first road
    expect([at(1, 3), at(2, 3)].join('')).toBe('&$');
    expect(all.match(/0/g)?.length).toBeGreaterThanOrEqual(20); // city blocks
    expect(all.match(/"/g)?.length).toBeGreaterThanOrEqual(4); // Metal Man's gearworks
    expect(all.match(/[5T]/g)?.length).toBeGreaterThanOrEqual(6); // Wood Man's forest
    expect(all.match(/A/g)?.length).toBeGreaterThanOrEqual(3); // Flash Man's crystals
    // Wily's skull fortress stands right over the castle node: its towers and skull, then its gate
    const c = node('3-4');
    expect([at(c.x - 1, c.y - 2), at(c.x, c.y - 2), at(c.x + 1, c.y - 2)].join('')).toBe('+?/');
    expect([at(c.x - 1, c.y - 1), at(c.x, c.y - 1), at(c.x + 1, c.y - 1)].join('')).toBe(';_`');
    // gearworks beside the hidden bonus spot
    const b = node('bonus-3');
    expect([at(b.x + 1, b.y), at(b.x, b.y - 1)]).toEqual(['"', '"']);
    // none of the new scenery is walkable
    for (const ch of '0&$"+?/;_`') expect(MAP_WALKABLE.has(ch), ch).toBe(false);
  });

  it("draws Flash Man's crystals blue and cyan, as in Mega Man 2, in their own frame", () => {
    expect(pageTileFrame(WORLD_3, 'A', 0)).toBe('crystal-flash');
    // other pages keep the shared crystal (its accent colours), and the gears and lamps keep theirs
    expect(pageTileFrame(WORLD_4, 'A', 0)).toBe('crystal');
    expect(pageTileFrame(WORLD_3, '"', 0)).toBe('gears');
    const rows = mapDef.frames['crystal-flash'] as readonly string[];
    const shared = mapDef.frames['crystal'] as readonly string[];
    expect(rows).toHaveLength(16);
    // the same cluster's outline and ground, only its glass recoloured
    rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        const s = shared[y]![x]!;
        if (s === 'i' || s === 'r') expect('678', `${x},${y}`).toContain(c);
        else expect(c, `${x},${y}`).toBe(s);
      }),
    );
    // its glass is blue and cyan in Mega City's palette (no red)
    const pal = mapPalettes['map-megaman']!;
    const ROLES = '0123456789abcdefghijklmnopqr';
    for (const ch of new Set([...rows.join('')].filter((c) => '678'.includes(c)))) {
      const hex = pal[ROLES.indexOf(ch)]!;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
      expect(b, `${ch} ${hex}`).toBeGreaterThan(r);
      expect(b, `${ch} ${hex}`).toBeGreaterThanOrEqual(g);
    }
  });

  it("leaves Mega Man's map hint and the local on plain ground", () => {
    const n = node('3-1');
    const side = heroSide(WORLD_3, n);
    expect(side).toBe(-1);
    expect([at(n.x + side, n.y), at(n.x + side, n.y - 1)]).toEqual(['#', '#']);
    const spot = localSpot(WORLD_3)!;
    expect(at(Math.floor(spot.x / 16), Math.floor((spot.y + 19) / 16))).toBe('#');
  });

  it('its critters are robots: Mets and propeller bots, no goombas, stars or bubbles', () => {
    const types = WORLD_3.actors.map((a) => a.type);
    for (const t of ['met', 'copter']) expect(types, t).toContain(t);
    for (const t of ['goomba', 'bubble', 'star']) expect(types, t).not.toContain(t);
    for (const a of WORLD_3.actors) {
      const [x0, y0, x1, y1] = mapActorBounds(a);
      expect(x1 > x0 && y1 > y0, a.type).toBe(true);
    }
  });
});
