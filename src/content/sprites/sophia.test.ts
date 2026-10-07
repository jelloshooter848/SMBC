import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { sophiaDef, sophiaPalettes } from './sophia';
import { bmDungeonDef, bmDungeonPalettes } from './bm-dungeon';
import { dungeonDef } from './dungeon';
import { SIDE_FRAMES, SPLIT_FRAMES } from '@game/topdown/frames';
import { LADDER_SHEET, LADDER_THEMES } from '@game/entities/objects/vine';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];
const TANK: Size = [32, 32];
const S8: Size = [8, 8];
const n = (prefix: string, count: number, size: Size) =>
  Object.fromEntries(Array.from({ length: count }, (_, k) => [`${prefix}-${k}`, size]));

const TANK_FRAMES = [
  'idle',
  'drive-0',
  'drive-1',
  'drive-2',
  'drive-3',
  'jump',
  'hover-0',
  'hover-1',
  'open',
  'aim-diag',
  'aim-up',
  'turn-0',
  'turn-1',
  'turn-2',
  'tilt-up',
  'tilt-down',
];

// The frame contract of the brief (S1's character, S2's mini game) and its additions.
const SOPHIA_FRAMES: Record<string, Size> = {
  ...Object.fromEntries(TANK_FRAMES.map((f) => [f, TANK])),
  ...n('wheel', 4, S8),
  ...n('die', 4, TANK),
  ...n('boom', 4, [24, 24]),
  'cannon-0': S8,
  'cannon-1': [12, 8],
  'cannon-2': [16, 8],
  missile: [16, 8],
  ...n('missile', 2, [16, 8]),
  ...n('homing', 2, S8),
  'jason-shot': [4, 4],
  ...n('gun-shot', 3, S8),
  ...n('grenade', 2, S8),
  'jason-stand': T16,
  ...n('jason-walk', 3, T16),
  'jason-jump': T16,
  ...n('jason-climb', 2, T16),
  'jason-hurt': T16,
  'jason-die': T16,
  ...Object.fromEntries(
    ['down', 'up', 'left', 'right'].flatMap((d) => [
      [`jason-o-${d}-0`, T16],
      [`jason-o-${d}-1`, T16],
      [`jason-o-shoot-${d}`, T16],
    ]),
  ),
  'gun-capsule': T16,
  'pow-capsule': T16,
  ...n('fred', 3, T16),
  'fred-big': TANK,
  ...n('crawler', 2, T16),
  ...n('hopper', 2, T16),
  ...n('flyer', 2, T16),
  ...n('blob', 2, T16),
  ...n('eye', 2, T16),
  ...n('turret-o', 4, T16),
  ...n('boss-a', 2, [64, 64]),
  ...n('boss-b', 2, [64, 64]),
  ...n('boss-shot', 2, S8),
  'boss-shot-big': T16,
  ...n('pluto-a', 2, [64, 64]),
  ...n('pluto-b', 2, TANK),
  'pluto-glob': T16,
  ...n('pluto-ball', 2, T16),
  'pluto-drop': S8,
  'cut-chest': [32, 24],
  'cut-hole': [48, 16],
  'cut-fred-jump': T16,
  'cut-jason': [16, 24],
  'ammo-triple': T16,
  'ammo-homing': T16,
  'icon-cannon': T16,
  'icon-triple': T16,
  'icon-homing': T16,
  'icon-exit': T16,
  'hover-cell': [8, 4],
  'hover-cell-empty': [8, 4],
  ladder: T16,
  'ladder-top': T16,
};

const rows = (name: string): readonly string[] => sophiaDef.frames[name] as readonly string[];
const opaque = (f: readonly string[]) => f.join('').replace(/\./g, '').length;
const count = (f: readonly string[], chars: string) =>
  [...f.join('')].filter((c) => chars.includes(c)).length;
/** [first, last] drawn column and row. */
const bounds = (f: readonly string[]) => {
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  f.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === '.') return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }),
  );
  return { x0, x1, y0, y1 };
};
const centroid = (f: readonly string[], chars: string): [number, number] => {
  let sx = 0;
  let sy = 0;
  let k = 0;
  f.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (!chars.includes(c)) return;
      sx += x + 0.5;
      sy += y + 0.5;
      k++;
    }),
  );
  return [sx / k, sy / k];
};

describe('sophia sheet', () => {
  it('validates', () => validateDef('sophia', sophiaDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(sophiaDef.frames).sort()).toEqual(Object.keys(SOPHIA_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(SOPHIA_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    // Registered as is, plus `portrait` (the idle tank cropped, content/sprites/index.ts).
    for (const [name, rows] of Object.entries(sophiaDef.frames))
      expect(SPRITES.sophia?.frames[name]).toBe(rows);
    expect(SPRITES.sophia?.frames.portrait?.length).toBeLessThan(sophiaDef.frames.idle?.length ?? 0);
    expect(sophiaDef.palette).toBe('sophia');
    expect(Object.keys(sophiaPalettes).sort()).toEqual(
      [
        'sophia',
        'sophia-hyper',
        'sophia-crusher',
        'sophia-flash-0',
        'sophia-flash-1',
        'sophia-flash-2',
        'sophia-star-0',
        'sophia-star-1',
        'sophia-star-2',
        'sophia-star-3',
        'sophia-hit',
        'plutonium-hot',
      ].sort(),
    );
    expect(new Set(Object.values(sophiaPalettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(sophiaPalettes)) expect(PALETTES.default[name]).toBe(p);
    // every char the sheet uses has a colour
    const used = new Set(Object.values(sophiaDef.frames).flatMap((f) => [...f.join('')]));
    used.delete('.');
    for (const c of used) expect(parseInt(c, 36), c).toBeLessThan((sophiaPalettes.sophia as string[]).length);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(sophiaPalettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(sophiaDef, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(sophiaDef, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('only the hull changes between the power states and the hit flashes (SO-22, SO-23)', () => {
    const base = sophiaPalettes.sophia as string[];
    expect(base.slice(1, 4)[0]).toBe('#e44a85');
    expect((sophiaPalettes['sophia-hyper'] as string[])[1]).toBe('#e40058');
    expect((sophiaPalettes['sophia-crusher'] as string[])[1]).toBe('#b10000');
    for (const name of [
      'sophia-hyper',
      'sophia-crusher',
      'sophia-flash-0',
      'sophia-flash-1',
      'sophia-flash-2',
    ]) {
      const p = sophiaPalettes[name] as string[];
      p.forEach((c, i) => {
        if (i < 1 || i > 3) expect(c, `${name} ${i}`).toBe(base[i]);
      });
    }
    // the jets are not hull colours: they keep their colour in every hull palette
    expect(count(rows('hover-0'), 'abc')).toBeGreaterThan(count(rows('jump'), 'abc'));
    // the star recolours the hull and Jason's suit
    for (let k = 0; k < 4; k++) {
      const p = sophiaPalettes[`sophia-star-${k}`] as string[];
      expect(p[1]).not.toBe(base[1]);
      expect(p[13]).not.toBe(base[13]);
    }
  });

  it('the tank is drawn on her box: 26 px wide, centred, wheels on the box bottom (SO-3, SO-50)', () => {
    for (const name of ['idle', 'drive-1', 'drive-2', 'drive-3', 'open', 'aim-diag']) {
      const b = bounds(rows(name));
      expect(b.x1 - b.x0 + 1, name).toBe(26);
      expect((b.x0 + b.x1 + 1) / 2, name).toBe(16);
      expect(b.y1, name).toBe(23);
    }
    // facing right: the cannon's muzzle is on the right, the antenna on the left
    const [gunX] = centroid(rows('idle').slice(0, 13), '567');
    expect(gunX).toBeGreaterThan(16);
    // the drive bobs the hull on 1 and 3; the wheels turn every frame
    expect(bounds(rows('drive-1')).y0).toBe(bounds(rows('idle')).y0 + 1);
    expect(bounds(rows('drive-2')).y0).toBe(bounds(rows('idle')).y0);
    expect(new Set([0, 1, 2, 3].map((k) => rows(`wheel-${k}`).join(''))).size).toBeGreaterThan(1);
    // a jump drops the wheels; the cannon raised up reaches the top of the frame
    expect(bounds(rows('jump')).y1).toBe(27);
    expect(bounds(rows('aim-up')).y0).toBe(0);
    expect(bounds(rows('aim-up')).x1 - bounds(rows('aim-up')).x0).toBeLessThan(26);
  });

  it('turns through three-quarter, head-on and back; the corner frames are the tank at 45 degrees', () => {
    const w = (f: string) => bounds(rows(f)).x1 - bounds(rows(f)).x0 + 1;
    expect(w('turn-1')).toBeLessThan(w('turn-0'));
    expect(w('turn-0')).toBeLessThan(w('idle'));
    expect(rows('turn-2')).toEqual(rows('turn-0').map((r) => [...r].reverse().join('')));
    // the head-on frame is (nearly) symmetric
    const f = rows('turn-1');
    let diff = 0;
    f.forEach((r) => [...r].forEach((c, x) => c !== r[r.length - 1 - x] && diff++));
    expect(diff).toBeLessThan(64);
    // tilt-up raises the nose (the gun's centre above the frame's centre right), tilt-down lowers it
    const [ux, uy] = centroid(rows('tilt-up'), '5');
    const [dx, dy] = centroid(rows('tilt-down'), '5');
    expect(ux).toBeGreaterThan(16);
    expect(uy).toBeLessThan(dy);
    expect(dx).toBeGreaterThan(14);
    for (const t of ['tilt-up', 'tilt-down'])
      expect(opaque(rows(t)), t).toBeGreaterThan(opaque(rows('idle')) * 0.8);
  });

  it('Jason stands on his bottom row in a 10 px wide figure; the side mutants and Fred stand on theirs', () => {
    for (const name of [
      'jason-stand',
      'jason-walk-0',
      'jason-walk-1',
      'jason-walk-2',
      'jason-die',
      'jason-hurt',
    ]) {
      const b = bounds(rows(name));
      expect(b.y1, name).toBe(15);
    }
    const stand = bounds(rows('jason-stand'));
    expect(stand.x1 - stand.x0 + 1).toBeLessThanOrEqual(13);
    for (const name of ['crawler-0', 'crawler-1', 'hopper-0', 'hopper-1', 'fred-0'])
      expect(bounds(rows(name)).y1, name).toBe(15);
    // the hopper leaps: its body rises
    expect(centroid(rows('hopper-1'), 'j')[1]).toBeLessThan(centroid(rows('hopper-0'), 'j')[1]);
    // the mutants face left: their eyes are on the left
    expect(centroid(rows('crawler-0'), 'm')[0]).toBeLessThan(8);
    expect(centroid(rows('flyer-0'), 't')[0]).toBeLessThan(8);
  });

  it('overhead: the turret turns a quarter at a time; Jason faces four ways; the boss has two phases', () => {
    const muzzle = (k: number) =>
      centroid(rows(`turret-o-${k}`), 'a').map((v) => Math.sign(Math.round(v - 8)));
    // down, left, up, right
    expect(muzzle(0)[1]).toBe(1);
    expect(muzzle(1)[0]).toBe(-1);
    expect(muzzle(2)[1]).toBe(-1);
    expect(muzzle(3)[0]).toBe(1);
    expect(new Set(['down', 'up', 'left', 'right'].map((d) => rows(`jason-o-${d}-0`).join(''))).size).toBe(4);
    for (const d of ['down', 'up', 'left', 'right'])
      expect(rows(`jason-o-${d}-0`), d).not.toEqual(rows(`jason-o-${d}-1`));
    // phase one's vents glow when open; phase two shows the core, beating bigger
    expect(count(rows('boss-a-1'), 'n')).toBeGreaterThan(count(rows('boss-a-0'), 'n'));
    expect(count(rows('boss-b-0'), 'no')).toBeGreaterThan(count(rows('boss-a-1'), 'no'));
    expect(count(rows('boss-b-1'), 'no')).toBeGreaterThan(count(rows('boss-b-0'), 'no'));
    // the hot palette turns the glow red
    expect((sophiaPalettes['plutonium-hot'] as string[])[23]).not.toBe(
      (sophiaPalettes.sophia as string[])[23],
    );
  });

  it('side view: the mass stands against the right wall facing left, opens on its core; the core beats', () => {
    const glow = 'nop';
    for (const f of ['pluto-a-0', 'pluto-a-1']) {
      const b = bounds(rows(f));
      // on its bottom row, its back to the wall, filling the frame
      expect([b.y1, b.x1], f).toEqual([63, 63]);
      expect(b.x0, f).toBeLessThanOrEqual(1);
      expect(b.y0, f).toBeLessThanOrEqual(4);
      // the bottom row is solid across: it sits on the floor
      expect(rows(f)[63]?.replace(/[^.]/g, '').length, f).toBeLessThan(8);
      // its glow is in the hot palette's slots (the warning shows on the shut frame too)
      expect(count(rows(f), glow), f).toBeGreaterThan(60);
    }
    // open: the core shows in the throat, low on its left (where the ball rolls out)
    const shut = rows('pluto-a-0');
    const open = rows('pluto-a-1');
    const inMaw = (f: readonly string[]) =>
      count(
        f.slice(30, 52).map((r) => r.slice(0, 32)),
        glow,
      );
    expect(inMaw(open)).toBeGreaterThan(inMaw(shut) * 2);
    expect(
      centroid(
        open.map((r) => r.slice(0, 32)),
        'n',
      )[0],
    ).toBeLessThan(24);
    // the core: centred, beating bigger, glowing
    for (const f of ['pluto-b-0', 'pluto-b-1']) {
      const [cx, cy] = centroid(rows(f), glow);
      expect(Math.abs(cx - 16), f).toBeLessThan(1.5);
      expect(Math.abs(cy - 16), f).toBeLessThan(1.5);
    }
    expect(count(rows('pluto-b-1'), glow)).toBeGreaterThan(count(rows('pluto-b-0'), glow));
    // the shots are centred on their hit boxes: glob ~10 px, ball ~14 px, drop ~6 px
    const span = (f: string) => {
      const b = bounds(rows(f));
      return [b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, (b.x0 + b.x1 + 1) / 2, (b.y0 + b.y1 + 1) / 2];
    };
    for (const [f, lo, hi, mid] of [
      ['pluto-glob', 9, 15, 8],
      ['pluto-ball-0', 13, 16, 8],
      ['pluto-ball-1', 13, 16, 8],
      ['pluto-drop', 5, 8, 4],
    ] as const) {
      const [w, h, cx, cy] = span(f) as [number, number, number, number];
      expect(Math.max(w, h), f).toBeGreaterThanOrEqual(lo);
      expect(Math.max(w, h), f).toBeLessThanOrEqual(hi);
      expect(Math.abs(cx - mid), f).toBeLessThanOrEqual(1.5);
      expect(Math.abs(cy - mid), f).toBeLessThanOrEqual(1.5);
    }
    // the ball's crust turns between its two frames
    expect(rows('pluto-ball-0')).not.toEqual(rows('pluto-ball-1'));
  });

  it('explodes: a flash, a growing fireball, a burst, then smoke', () => {
    for (const p of ['boom', 'die']) {
      expect(opaque(rows(`${p}-1`))).toBeGreaterThan(opaque(rows(`${p}-0`)) * 0.9);
      expect(count(rows(`${p}-0`), '4')).toBeGreaterThan(0);
      expect(count(rows(`${p}-3`), '567')).toBeGreaterThan(count(rows(`${p}-3`), 'abc'));
    }
  });

  it("the Underworld's beanstalks are drawn as its ladders", () => {
    expect(LADDER_THEMES.has('underworld')).toBe(true);
    expect(SPRITES[LADDER_SHEET]?.frames.ladder).toBeDefined();
    expect(SPRITES[LADDER_SHEET]?.frames['ladder-top']).toBeDefined();
  });
});

describe('bm-dungeon sheet (the top-down kit)', () => {
  it("draws every frame Link's dungeon sheet draws for the kit, at its size", () => {
    validateDef('bm-dungeon', bmDungeonDef);
    const size = (f: readonly string[] | undefined) => [f?.[0]?.length, f?.length];
    for (const [name, f] of Object.entries(dungeonDef.frames))
      expect(size(bmDungeonDef.frames[name]), name).toEqual(size(f));
    for (const [name, f] of Object.entries(bmDungeonDef.frames)) {
      for (const r of f) expect(r.length, name).toBe(f[0]?.length);
      expect(f.join('').replace(/\./g, '').length, `${name} is not empty`).toBeGreaterThan(0);
    }
    // a refill held up from a chest (pickupFrame's `refill-icon`) fills a tile
    expect(size(bmDungeonDef.frames['refill-icon'])).toEqual([16, 16]);
    // the life cells: full, half, spent
    const red = (n: string) =>
      (bmDungeonDef.frames[n] as readonly string[]).join('').replace(/[^a]/g, '').length;
    expect(red('heart')).toBeGreaterThan(red('heart-half'));
    expect(red('heart-half')).toBeGreaterThan(red('heart-empty'));
  });

  it('is registered with its side and split frames and two palettes of one layout', () => {
    const sheet = SPRITES['bm-dungeon'];
    for (const f of SIDE_FRAMES) expect(sheet?.frames[`${f}-side`], f).toBeDefined();
    for (const f of SPLIT_FRAMES) {
      expect(sheet?.frames[`${f}-l`], f).toBeDefined();
      expect(sheet?.frames[`${f}-r`], f).toBeDefined();
    }
    expect(Object.keys(bmDungeonPalettes).sort()).toEqual(['bm-dungeon', 'bm-dungeon-dark']);
    expect(new Set(Object.values(bmDungeonPalettes).map((p) => p.length)).size).toBe(1);
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(bmDungeonPalettes))
        expect(() =>
          rasterizeToBuffer(sheet as typeof bmDungeonDef, resolvePalette(PALETTES, name, mode)),
        ).not.toThrow();
  });

  it('walls are drawn for the north edge: the floor side (bottom) differs from the outside (top)', () => {
    const wallTop = bmDungeonDef.frames['wall-top'] as readonly string[];
    expect(wallTop[0]).not.toEqual(wallTop[15]);
    // the doorway is open down to the floor
    const door = bmDungeonDef.frames['door-open'] as readonly string[];
    expect(door[15]?.slice(6, 10)).toBe('0000');
    // the dark lair only changes walls and floor
    const a = bmDungeonPalettes['bm-dungeon'] as string[];
    const b = bmDungeonPalettes['bm-dungeon-dark'] as string[];
    a.forEach((c, i) => (i >= 1 && i <= 6 ? expect(b[i]).not.toBe(c) : expect(b[i]).toBe(c)));
  });
});
