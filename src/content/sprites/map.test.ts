import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { charIndex, hexToRgb, PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { mapDef, mapPalettes, SHORES, WATER_FRAMES } from './map';
import { PALETTES, SPRITES } from './index';
import { mapIconFrames } from './map-icons';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];

const THEMES = [
  'grass',
  'sea',
  'night',
  'mushroom',
  'sky',
  'snow',
  'coast',
  'bowser',
  'warp',
  'arena',
  'hyrule',
  'megaman',
  'zebes',
];

const tileFrames = [
  'ground',
  'tuft',
  'flowers-0',
  'flowers-1',
  'sand',
  'drift',
  'cliff',
  'tree',
  'palm',
  'hill',
  'hill-snow',
  'mountain',
  'rock',
  'ridge',
  'ridge-snow',
  'cap-left',
  'cap-mid',
  'cap-right',
  'stem',
  'wall',
  'battlement',
  'gate',
  'pipe',
  'blaster',
  'crystal',
  'moon',
  'cloud',
  ...[0, 1, 2, 3].flatMap((i) => [`star-${i}`, `lava-${i}`]),
  // The Mini Game Arena.
  'arena-floor',
  'arena-wall',
  ...[0, 1, 2, 3].flatMap((f) => [`arena-crowd-a-${f}`, `arena-crowd-b-${f}`, `arena-banner-${f}`]),
  ...[0, 1, 2].map((w) => `arena-bunting-${w}`),
  // Hyrule (World 2, 0.4.24).
  'forest',
  'palace-roof-left',
  'palace-roof-mid',
  'palace-roof-right',
  'palace-left',
  'palace-door',
  'palace-right',
  'ruins',
  'graves',
  // Mega Man's world (World 3, 0.4.26).
  'city',
  'lab-left',
  'lab-right',
  'gears',
  'crystal-flash', // Flash Man's blue crystals
  'wily-top-left',
  'wily-top-mid',
  'wily-top-right',
  'wily-left',
  'wily-gate',
  'wily-right',
  // Samus's Zebes (World 4, 0.4.27).
  'spire',
  'alien-plant',
  'chozo',
  'ship-left',
  'ship-right',
  'dome-top-left',
  'dome-top-mid',
  'dome-top-right',
  'dome-left',
  'dome-gate',
  'dome-right',
  ...Array.from({ length: WATER_FRAMES }, (_, f) => [
    `water-${f}`,
    `surf-${f}`,
    `cliff-sea-${f}`,
    `bridge-h-${f}`,
    `bridge-v-${f}`,
    `treetop-left-${f}`,
    `treetop-mid-${f}`,
    `treetop-right-${f}`,
    `trunk-${f}`,
    ...Array.from({ length: 12 }, (_, i) => `pond-${i}-${f}`),
    ...Object.keys(SHORES).map((k) => `shore-${k}-${f}`),
    ...['w', 'e', 'n', 's'].map((k) => `landing-${k}-${f}`),
  ]).flat(),
];

const actorFrames: Record<string, Size> = {
  'flag-0': T16,
  'flag-1': T16,
  'flag-2': T16,
  'twinkle-0': [8, 8],
  'twinkle-1': [8, 8],
  'twinkle-2': [8, 8],
  'twinkle-3': [8, 8],
  'smoke-0': [8, 8],
  'smoke-1': [8, 8],
  'smoke-2': [8, 8],
  bubble: [8, 8],
  'splash-0': [16, 8],
  'splash-1': [16, 8],
  'comet-0': [16, 8],
  'comet-1': [16, 8],
  'arena-tower-0': [16, 48],
  'arena-tower-1': [16, 48],
  'arena-scoreboard-0': [48, 32],
  'arena-scoreboard-1': [48, 32],
  // Hyrule's critters (World 2, 0.4.24).
  'blob-0': T16,
  'blob-1': T16,
  'fairy-0': T16,
  'fairy-1': T16,
  'zora-0': T16,
  'zora-1': T16,
  // Mega Man's robots (World 3, 0.4.26).
  'met-0': T16,
  'met-1': T16,
  'copter-0': T16,
  'copter-1': T16,
  // Zebes's Metroid (World 4, 0.4.27; its Rippers and Zoomers are the zebes sheet's).
  'metroid-0': T16,
  'metroid-1': T16,
};

function expectFrame(name: string, [w, h]: Size): void {
  const rows = mapDef.frames[name];
  expect(rows, `missing frame ${name}`).toBeDefined();
  expect(rows?.length, `${name} height`).toBe(h);
  for (const row of rows ?? []) expect(row.length, `${name} width`).toBe(w);
}

describe('map sprites', () => {
  it('validates', () => validateDef('map', mapDef));

  it('has every map tile at 16x16 and every actor frame at its size', () => {
    for (const name of tileFrames) expectFrame(name, T16);
    for (const [name, size] of Object.entries(actorFrames)) expectFrame(name, size);
    expect(Object.keys(mapDef.frames).sort()).toEqual([...tileFrames, ...Object.keys(actorFrames)].sort());
  });

  it('has one palette per theme, all with the same roles', () => {
    expect(Object.keys(mapPalettes).sort()).toEqual(THEMES.map((t) => `map-${t}`).sort());
    const lengths = new Set(Object.values(mapPalettes).map((p) => p.length));
    expect([...lengths]).toEqual([28]);
    for (const p of Object.values(mapPalettes)) for (const c of p) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(mapPalettes[mapDef.palette]).toBeDefined();
  });

  it('renders with every theme palette', () => {
    for (const [name, palette] of Object.entries(mapPalettes))
      expect(() => rasterizeToBuffer(mapDef, palette), name).not.toThrow();
  });

  it('is registered with its palettes', () => {
    expect(SPRITES['map']).toBe(mapDef);
    for (const t of THEMES) expect(PALETTES.default[`map-${t}`]).toBeDefined();
    expect(PALETTES.highContrast?.['map-bowser']).toBeDefined();
  });

  it('draws the crystal standing on plain ground, outlined, in the accent colours', () => {
    const crystal = mapDef.frames['crystal'] as readonly string[];
    const ground = mapDef.frames['ground'] as readonly string[];
    expect(crystal[15]).toBe(ground[15]);
    expect(crystal[0]?.[0]).toBe(ground[0]?.[0]);
    const px = crystal.join('');
    for (const c of '0ior') expect(px, `crystal uses '${c}'`).toContain(c);
  });

  it('draws the comet heading right: a bright head with a fading tail', () => {
    for (const name of ['comet-0', 'comet-1']) {
      const mid = (mapDef.frames[name] as readonly string[])[3] as string;
      expect(mid.lastIndexOf('o'), name).toBeGreaterThan(mid.indexOf('p'));
    }
    expect(mapDef.frames['comet-0']).not.toEqual(mapDef.frames['comet-1']);
  });

  it('water rows tile seamlessly and loop over the water frames', () => {
    const w0 = mapDef.frames['water-0'] as readonly string[];
    // Every row has an 8 px period, so the drift loops after WATER_FRAMES steps.
    for (const row of w0) expect(row.slice(0, 8)).toBe(row.slice(8));
    expect(WATER_FRAMES).toBe(8);
  });

  it('shores join their neighbours: water strips line up across tile seams', () => {
    const water = (name: string, x: number, y: number): boolean => {
      const c = (mapDef.frames[name] as readonly string[])[y]?.[x] as string;
      return '6789'.includes(c);
    };
    // A north shore continues into the next north shore and into the NE/NW corners.
    for (let y = 0; y < 16; y++) {
      expect(water('shore-n-0', 15, y), `n|n row ${y}`).toBe(water('shore-n-0', 0, y));
      expect(water('shore-n-0', 15, y), `n|ne row ${y}`).toBe(water('shore-ne-0', 0, y));
      expect(water('shore-w-0', y, 15), `w over w col ${y}`).toBe(water('shore-w-0', y, 0));
      expect(water('shore-in-nw-0', 0, y), `n|in-nw row ${y}`).toBe(water('shore-n-0', 15, y));
    }
  });
});

describe('warp pad icons', () => {
  const open = mapIconFrames['map-warp'] as readonly string[];
  const locked = mapIconFrames['map-warp-locked'] as readonly string[];
  const colours = (rows: readonly string[]) => new Set(rows.join('').replace(/\./g, ''));

  it('are 16×16 frames with the same pad outline', () => {
    for (const f of [open, locked]) {
      expect(f).toHaveLength(16);
      for (const row of f) expect(row).toHaveLength(16);
    }
    for (let y = 3; y < 16; y++)
      for (let x = 0; x < 16; x++) expect(open[y]?.[x] === '.', `${x},${y}`).toBe(locked[y]?.[x] === '.');
  });

  it('the open pad is purple and blue with a white sparkle; the locked one dim grey, no sparkle', () => {
    expect([...colours(open)].sort()).toEqual(['0', '1', 'a', 'c', 'e']);
    expect(open.slice(0, 3).join('')).toContain('1');
    expect(locked.slice(0, 3).join('')).toBe('.'.repeat(48));
    for (const bright of ['1', 'a', 'c', 'e']) expect(colours(locked).has(bright), bright).toBe(false);
  });
});

describe('secret-exit node icons', () => {
  const frame = (id: string) => mapIconFrames[id] as readonly string[];
  const at = (rows: readonly string[], x: number, y: number) => rows[y]?.[x] ?? '.';
  const cells = [...Array(256).keys()].map((i) => [i % 16, i >> 4] as const);
  /** The colour most of a frame is filled with (not the outline, the ring or the shine). */
  const body = (rows: readonly string[]) => {
    const n = new Map<string, number>();
    for (const ch of rows.join('')) if (!'.01'.includes(ch)) n.set(ch, (n.get(ch) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] as string;
  };
  const SECRET = ['map-node-secret', 'map-node-secret-cleared'];

  it('are 16×16 and keep the dot, with a white ring around it and a keyhole cut in it', () => {
    const dot = frame('map-node-open');
    for (const id of SECRET) {
      const f = frame(id);
      expect(f).toHaveLength(16);
      for (const row of f) expect(row).toHaveLength(16);
      // Every pixel of the plain dot is drawn, plus a white ring outside it.
      for (const [x, y] of cells)
        if (at(dot, x, y) !== '.') expect(at(f, x, y), `${id} ${x},${y}`).not.toBe('.');
      const ring = cells.filter(([x, y]) => at(dot, x, y) === '.' && at(f, x, y) !== '.');
      expect(ring.length, id).toBeGreaterThan(30);
      for (const [x, y] of ring) expect(at(f, x, y), `${id} ring ${x},${y}`).toBe('1');
      // The keyhole: outline-black pixels inside the dot where the plain one is coloured.
      const hole = cells.filter(([x, y]) => !'.0'.includes(at(dot, x, y)) && at(f, x, y) === '0');
      expect(hole.length, id).toBeGreaterThanOrEqual(8);
      for (const [x] of hole) expect(x >= 6 && x <= 9, id).toBe(true);
    }
    const shape = (id: string) => frame(id).map((r) => r.replace(/[^.0]/g, 'x'));
    expect(shape('map-node-secret-cleared')).toEqual(shape('map-node-secret'));
  });

  it('are filled with colours apart from the plain open and cleared dots in every palette mode', () => {
    const dist = (a: string, b: string) => {
      const [p, q] = [hexToRgb(a), hexToRgb(b)];
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    };
    const fills = ['map-node-open', 'map-node-cleared', ...SECRET].map((id) => charIndex(body(frame(id))));
    expect(new Set(fills).size).toBe(4);
    for (const mode of PALETTE_MODES) {
      const pal = resolvePalette(PALETTES, 'items', mode);
      const [open, cleared, secret, secretCleared] = fills.map((i) => pal[i] as string) as [
        string,
        string,
        string,
        string,
      ];
      for (const s of [secret, secretCleared])
        for (const plain of [open, cleared])
          expect(dist(s, plain), `${mode} ${s} vs ${plain}`).toBeGreaterThan(80);
      // Pink, then cream shaded pink: apart in every mode (purple turns pink under tritanopia).
      expect(dist(secret, secretCleared), `${mode} open vs cleared`).toBeGreaterThan(80);
    }
  });

  it('are on the items sheet', () => {
    for (const id of SECRET) expect(SPRITES.items?.frames[id], id).toBeDefined();
  });

  describe('the secret-exit castle (Lost B-4)', () => {
    const pairs = [
      ['map-castle', 'map-castle-secret'],
      ['map-castle-cleared', 'map-castle-secret-cleared'],
    ] as const;

    it('is the castle outline, flag once cleared, with a keyhole for a door', () => {
      for (const [plainId, id] of pairs) {
        const [plain, f] = [frame(plainId), frame(id)];
        expect(f).toHaveLength(16);
        for (const row of f) expect(row).toHaveLength(16);
        for (const [x, y] of cells)
          expect(at(f, x, y) === '.', `${id} ${x},${y}`).toBe(at(plain, x, y) === '.');
        // The keyhole: black where the plain castle's wall is, above and beside its door.
        const hole = cells.filter(([x, y]) => at(plain, x, y) === 'b' && at(f, x, y) === '0');
        expect(hole.length, id).toBeGreaterThanOrEqual(2);
        for (const [x, y] of hole) expect(x >= 6 && x <= 9 && y >= 9, `${id} ${x},${y}`).toBe(true);
      }
      expect(frame('map-castle-secret').join('')).not.toContain('4');
      expect(frame('map-castle-secret-cleared').slice(0, 4).join('')).toContain('4');
    });

    it('has walls apart from the plain grey castle in every palette mode', () => {
      const dist = (a: string, b: string) => {
        const [p, q] = [hexToRgb(a), hexToRgb(b)];
        return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      };
      for (const [plainId, id] of pairs) {
        const [wall, secretWall] = [charIndex(body(frame(plainId))), charIndex(body(frame(id)))];
        for (const mode of PALETTE_MODES) {
          const pal = resolvePalette(PALETTES, 'items', mode);
          expect(dist(pal[wall] as string, pal[secretWall] as string), `${id} ${mode}`).toBeGreaterThan(80);
        }
        expect(SPRITES.items?.frames[id], id).toBeDefined();
      }
    });
  });
});
