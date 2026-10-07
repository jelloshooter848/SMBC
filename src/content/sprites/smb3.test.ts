import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { smb3Def, smb3Palettes } from './smb3';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];
const TALL: Size = [16, 24];
const REEL: Size = [32, 16];
const S8: Size = [8, 8];
const MAP_SHIP: Size = [32, 16];

// The frame contract Larry's airship, the bonus spot, the map and the inventory render against.
const SMB3_FRAMES: Record<string, Size> = {
  'larry-0': TALL,
  'larry-1': TALL,
  'larry-shell-0': T16,
  'larry-shell-1': T16,
  'larry-shell-2': T16,
  'larry-shell-3': T16,
  'larry-hurt': TALL,
  'wand-blast-0': T16,
  'wand-blast-1': T16,
  'crystal-ball': T16,
  'chest-closed': T16,
  'chest-open': T16,
  'card-back': TALL,
  'card-mushroom': TALL,
  'card-flower': TALL,
  'card-star': TALL,
  'card-1up': TALL,
  'card-coin10': TALL,
  'card-coin20': TALL,
  'slot-mushroom-top': REEL,
  'slot-mushroom-mid': REEL,
  'slot-mushroom-bot': REEL,
  'slot-flower-top': REEL,
  'slot-flower-mid': REEL,
  'slot-flower-bot': REEL,
  'slot-star-top': REEL,
  'slot-star-mid': REEL,
  'slot-star-bot': REEL,
  'hammer-bro-map-0': T16,
  'hammer-bro-map-1': T16,
  'node-toad-house': T16,
  'node-spade': T16,
  'item-mushroom': T16,
  'item-flower': T16,
  'item-star': T16,
  'item-1up': T16,
  porthole: T16,
  pillar: T16,
  'ceiling-beam': T16,
  // Larry's airship deck: cannons, Rocky Wrench, the hull's fittings, the anchor and its chain.
  'cannon-r': T16,
  'cannon-l': T16,
  'cannon-ul': T16,
  'cannon-ur': T16,
  'cannon-dl': T16,
  'cannon-dr': T16,
  cannonball: T16,
  'rocky-hide': T16,
  'rocky-0': T16,
  'rocky-1': T16,
  'wrench-0': S8,
  'wrench-1': S8,
  'propeller-0': T16,
  'propeller-1': T16,
  'propeller-2': T16,
  bolt: S8,
  railing: T16,
  anchor: [32, 32],
  chain: T16,
  // The crash on the World 4 map after Larry is beaten, and Toad building the bonus spot.
  'map-airship-0': MAP_SHIP,
  'map-airship-1': MAP_SHIP,
  'map-airship-tilt': MAP_SHIP,
  'map-wreck': MAP_SHIP,
  'map-smoke-0': T16,
  'map-smoke-1': T16,
  'map-smoke-2': T16,
  'toad-map-0': T16,
  'toad-map-1': T16,
  'toad-map-hammer-0': T16,
  'toad-map-hammer-1': T16,
  'map-dust-0': T16,
  'map-dust-1': T16,
};

const rows = (name: string): readonly string[] => smb3Def.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;
const FACES = ['mushroom', 'flower', 'star', '1up'] as const;
const PICTURES = ['mushroom', 'flower', 'star'] as const;
const PARTS = ['top', 'mid', 'bot'] as const;

describe('smb3 sheet', () => {
  it('validates', () => validateDef('smb3', smb3Def));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(smb3Def.frames).sort()).toEqual(Object.keys(SMB3_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(SMB3_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES.smb3).toBe(smb3Def);
    expect(smb3Def.palette).toBe('smb3');
    expect(Object.keys(smb3Palettes).sort()).toEqual(['smb3', 'smb3-flash']);
    expect(new Set(Object.values(smb3Palettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(smb3Palettes)) expect(PALETTES.default[name]).toBe(p);
    // every index a frame uses is in the palette
    const size = (smb3Palettes.smb3 as string[]).length;
    const used = new Set(Object.values(smb3Def.frames).flatMap((f) => [...f.join('')]));
    used.delete('.');
    for (const ch of used) expect(parseInt(ch, 36), ch).toBeLessThan(size);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(smb3Palettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(pal, `${name} (${mode})`).toHaveLength((smb3Palettes.smb3 as string[]).length);
        expect(() => rasterizeToBuffer(smb3Def, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(smb3Def, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('the hit flash keeps the outline and pales everything else', () => {
    const base = smb3Palettes.smb3 as string[];
    const flash = smb3Palettes['smb3-flash'] as string[];
    expect(flash[0]).toBe(base[0]);
    for (const c of flash.slice(1)) expect(['#fcfcfc', '#bcbcbc']).toContain(c);
  });

  it('animated sets differ frame to frame', () => {
    for (const [a, b] of [
      ['larry-0', 'larry-1'],
      ['larry-0', 'larry-hurt'],
      ['wand-blast-0', 'wand-blast-1'],
      ['chest-closed', 'chest-open'],
      ['hammer-bro-map-0', 'hammer-bro-map-1'],
    ] as const)
      expect(rows(a), `${a} vs ${b}`).not.toEqual(rows(b));
    const spin = [0, 1, 2, 3].map((i) => rows(`larry-shell-${i}`).join('/'));
    expect(new Set(spin).size).toBe(4);
  });

  it('Larry stands on his bottom row, hops with his feet off it, and wears a blue mohawk', () => {
    expect(rows('larry-0').at(-1)).toMatch(/[^.]/);
    expect(rows('larry-1').at(-1)).toMatch(/^\.+$/);
    for (let i = 0; i < 4; i++) expect(rows(`larry-shell-${i}`).at(-1), `shell ${i}`).toMatch(/[^.]/);
    // the mohawk (sky blue, index b) crowns every upright frame, in its top rows
    for (const name of ['larry-0', 'larry-1', 'larry-hurt'])
      expect(rows(name).slice(0, 4).join(''), name).toContain('b');
    // the wand's pink orb (index k) only while he holds it
    expect(rows('larry-0').join('')).toContain('k');
    expect(rows('larry-1').join('')).toContain('k');
    expect(rows('larry-hurt').join('')).not.toContain('k');
  });

  it('cards share one outline; the faces are white and show their picture', () => {
    const edge = (name: string) => [
      rows(name)[0],
      rows(name).at(-1),
      rows(name)
        .map((r) => r[0])
        .join(''),
    ];
    for (const f of [...FACES, 'coin10', 'coin20']) {
      const name = `card-${f}`;
      expect(edge(name), name).toEqual(edge('card-back'));
      expect(rows(name).slice(2, 22).join(''), name).toContain('1');
      expect(
        rows(name)
          .slice(1, 23)
          .every((r) => r.startsWith('0') && r.endsWith('0')),
        name,
      ).toBe(true);
    }
    // the picture cards carry the inventory icons
    for (const f of FACES) {
      const icon = rows(`item-${f}`).join('');
      const card = rows(`card-${f}`).join('');
      for (const ch of new Set(icon.replace(/[.01]/g, ''))) expect(card, `${f} has ${ch}`).toContain(ch);
    }
    expect(rows('card-coin10')).not.toEqual(rows('card-coin20'));
    // the back is navy, not white
    expect(rows('card-back').slice(2, 22).join('')).toContain('p');
  });

  it('inventory icons keep a clear 1px margin', () => {
    for (const f of FACES) {
      const icon = rows(`item-${f}`);
      expect(icon[0], f).toMatch(/^\.+$/);
      expect(icon[15], f).toMatch(/^\.+$/);
      expect(icon.map((r) => `${r.at(0)}${r.at(-1)}`).join(''), f).toMatch(/^\.+$/);
    }
  });

  it('slot thirds are opaque and stack into whole pictures that still meet across pictures', () => {
    for (const pic of PICTURES)
      for (const part of PARTS) {
        const f = rows(`slot-${pic}-${part}`);
        expect(f.join(''), `${pic}-${part}`).not.toContain('.');
      }
    // each picture really spans its thirds: the top and bottom thirds both carry colour, not just
    // the black backdrop
    for (const pic of PICTURES)
      for (const part of PARTS)
        expect(
          rows(`slot-${pic}-${part}`).join('').replace(/0/g, '').length,
          `${pic}-${part}`,
        ).toBeGreaterThan(8);
    // the backdrop is black at every third's corners, so any third meets any other cleanly
    for (const pic of PICTURES)
      for (const part of PARTS) {
        const f = rows(`slot-${pic}-${part}`);
        for (const c of [f[0]?.[0], f[0]?.[31], f[15]?.[0], f[15]?.[31]])
          expect(c, `${pic}-${part}`).toBe('0');
      }
    // three different pictures
    const mids = PICTURES.map((p) => rows(`slot-${p}-mid`).join('/'));
    expect(new Set(mids).size).toBe(3);
  });

  it('the map Hammer Bro holds his hammer in both frames, and the spade panel shows a white spade', () => {
    for (const f of ['hammer-bro-map-0', 'hammer-bro-map-1']) expect(rows(f).join(''), f).toMatch(/[23]/);
    const spade = rows('node-spade');
    expect(spade.join('')).toContain('1');
    expect(spade.join('')).toContain('p');
  });
  it('cabin decor: a framed dark porthole, a pillar that tiles vertically, a beam that tiles sideways', () => {
    const port = rows('porthole');
    // dark glass (black with a navy sheen) inside a wooden frame with a black outline
    const glass = port
      .slice(4, 13)
      .map((r) => r.slice(4, 13))
      .join('');
    expect(glass).toMatch(/^[0pc]+$/);
    expect(glass).toContain('p');
    expect(port[0]).toMatch(/^\.0+\.$/);
    expect(port.map((r) => r[1]).join('')).toMatch(/[rji]/);
    // a pillar is the same row all the way down apart from knots, with black edges
    const pillar = rows('pillar');
    for (const r of pillar) expect(r).toMatch(/^0[a-z]{14}0$/);
    expect(pillar[0]).toBe(pillar[15]);
    const beam = rows('ceiling-beam');
    expect(beam.join('')).not.toContain('.');
    // its edge bands (outline, lit top, shadowed underside) are solid rows that meet tile to tile
    for (const y of [0, 1, 2, 10, 11, 12, 13, 14, 15]) expect(new Set(beam[y]).size, `row ${y}`).toBe(1);
  });
});

const flipX = (f: readonly string[]) => f.map((r) => [...r].reverse().join(''));
const flipY = (f: readonly string[]) => [...f].reverse();
/** Opaque mask: '#' where a pixel is drawn. */
const mask = (f: readonly string[]) => f.map((r) => r.replace(/[^.]/g, '#'));
const top = (f: readonly string[]) => f.findIndex((r) => /[^.]/.test(r));
const clear = (f: readonly string[], x0: number, y0: number, x1: number, y1: number) =>
  f
    .slice(y0, y1 + 1)
    .map((r) => r.slice(x0, x1 + 1))
    .join('')
    .replace(/\./g, '').length === 0;

describe("smb3 sheet: Larry's airship deck", () => {
  it('cannons point where they are named; the down ones hang from a ceiling', () => {
    // one cannon drawn per angle, mirrored for the other side, flipped for the hanging ones
    expect(rows('cannon-l')).toEqual(flipX(rows('cannon-r')));
    expect(rows('cannon-ul')).toEqual(flipX(rows('cannon-ur')));
    expect(rows('cannon-dr')).toEqual(flipY(rows('cannon-ur')));
    expect(rows('cannon-dl')).toEqual(flipY(rows('cannon-ul')));
    // standing cannons sit on their bottom row; hanging ones on their top row
    for (const d of ['r', 'l', 'ul', 'ur']) expect(rows(`cannon-${d}`).at(-1), d).toMatch(/[^.]/);
    for (const d of ['dl', 'dr']) expect(rows(`cannon-${d}`)[0], d).toMatch(/[^.]/);
    // the muzzle reaches its edge or corner; the opposite corner stays clear
    const r = rows('cannon-r');
    expect(
      r
        .slice(4, 10)
        .map((row) => row[15])
        .join(''),
    ).toMatch(/^[^.]+$/);
    const ur = rows('cannon-ur');
    expect(clear(ur, 13, 0, 15, 2)).toBe(false);
    expect(clear(ur, 0, 0, 2, 2)).toBe(true);
    // iron: black and greys, a dark bore, a light glint
    for (const d of ['r', 'ur'])
      expect(rows(`cannon-${d}`).join('').replace(/\./g, ''), d).toMatch(/^[0-4]+$/);
  });

  it('the cannonball is a dark round ball with a glint', () => {
    const ball = rows('cannonball');
    for (const [x, y] of [
      [0, 0],
      [15, 0],
      [0, 15],
      [15, 15],
    ] as const)
      expect(ball[y]?.[x]).toBe('.');
    const px = ball.join('').replace(/\./g, '');
    expect(px.replace(/[04]/g, '').length / px.length).toBeLessThan(0.25);
    expect(px).toMatch(/[12]/);
    expect(mask(ball)).toEqual(flipX(mask(ball)));
  });

  it('Rocky Wrench: a shut manhole, then peeking (facing left), then up to throw', () => {
    const hide = rows('rocky-hide');
    const peek = rows('rocky-0');
    const up = rows('rocky-1');
    for (const f of [hide, peek, up]) expect(f.at(-1)).toMatch(/[^.]/);
    // shut: only the lid, low on the deck, no eyes
    expect(top(hide)).toBeGreaterThanOrEqual(10);
    expect(hide.join('')).not.toContain('1');
    // peeking: the eyes show, on his left; throwing: he rises higher with the wrench in hand
    expect(peek.join('')).toContain('1');
    expect(top(peek)).toBeLessThan(top(hide));
    expect(Math.min(...peek.map((r) => (r.includes('1') ? r.indexOf('1') : 99)))).toBeLessThan(8);
    expect(top(up)).toBeLessThanOrEqual(top(peek));
    expect(up).not.toEqual(peek);
  });

  it('the wrench spins in quarter turns', () => {
    const w0 = rows('wrench-0');
    const cw = w0[0]?.split('').map((_, x) =>
      w0
        .map((r) => r[x])
        .reverse()
        .join(''),
    );
    expect(rows('wrench-1')).toEqual(cw);
    expect(w0.join('')).toMatch(/[23]/);
  });

  it('the propeller turns on a shaft coming out of the hull on its left', () => {
    const p = [0, 1, 2].map((i) => rows(`propeller-${i}`));
    expect(new Set(p.map((f) => f.join('/'))).size).toBe(3);
    const shaft = (f: readonly string[]) => f.map((r) => r.slice(0, 4));
    expect(shaft(p[1] as string[])).toEqual(shaft(p[0] as string[]));
    expect(shaft(p[2] as string[])).toEqual(shaft(p[0] as string[]));
    expect((p[0] as string[]).map((r) => r[0]).join('')).toMatch(/[^.]/);
  });

  it('decor: a round bolt, a railing that runs on sideways, an anchor and a climbable chain', () => {
    const bolt = rows('bolt');
    expect([bolt[0]?.[0], bolt[0]?.[7], bolt[7]?.[0], bolt[7]?.[7]]).toEqual(['.', '.', '.', '.']);
    expect(bolt[3]?.[3]).not.toBe('.');
    // the rail's top rows are solid edge to edge; posts stand on the bottom row with gaps between
    const rail = rows('railing');
    for (const y of [0, 1, 2, 3]) expect(rail[y], `rail row ${y}`).toMatch(/^[^.]+$/);
    expect(rail.at(-1)).toMatch(/[^.]/);
    expect(rail.at(-1)).toMatch(/\./);
    // the anchor is symmetric, its ring at the top centre (where the chain hooks on), its arms
    // resting on the ground
    const anchor = rows('anchor');
    expect(mask(anchor)).toEqual(flipX(mask(anchor)));
    expect(anchor[0]?.slice(14, 18)).toMatch(/^[^.]+$/);
    expect(anchor.at(-1)).toMatch(/[^.]/);
    // the chain tiles vertically, unbroken, down the vine's centre line (between columns 7 and 8),
    // symmetric about it
    const chain = rows('chain');
    expect(mask(chain)).toEqual(flipX(mask(chain)));
    for (const [y, r] of chain.entries()) expect(r.slice(5, 11), `row ${y}`).toMatch(/[^.]/);
    expect(chain[0]?.slice(6, 10)).toMatch(/^[^.]+$/);
    expect(chain[15]?.slice(6, 10)).toMatch(/^[^.]+$/);
    expect(chain.join('').replace(/\./g, '')).toMatch(/^[0-4]+$/);
  });
});

describe('smb3 sheet: the airship crash on the World 4 map', () => {
  it('the airship flies with a turning propeller, tips nose-down and lies wrecked', () => {
    const fly = [rows('map-airship-0'), rows('map-airship-1')];
    expect(fly[0]).not.toEqual(fly[1]);
    // only the propeller turns: the two flying frames differ in a few pixels
    const diff = (fly[0] as string[])
      .join('')
      .split('')
      .filter((c, i) => c !== (fly[1] as string[]).join('')[i]).length;
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(40);
    expect(rows('map-airship-tilt')).not.toEqual(fly[0]);
    // the wreck lies flat on the ground: its top rows are empty, its bottom row is not
    const wreck = rows('map-wreck');
    expect(top(wreck)).toBeGreaterThanOrEqual(4);
    expect(wreck.at(-1)).toMatch(/[^.]/);
    // tan deck wood and iron
    for (const f of ['map-airship-0', 'map-wreck']) expect(rows(f).join(''), f).toMatch(/[rj]/);
  });

  it('smoke puffs and landing dust animate; Toad walks and hammers', () => {
    const smoke = [0, 1, 2].map((i) => rows(`map-smoke-${i}`).join('/'));
    expect(new Set(smoke).size).toBe(3);
    expect(rows('map-dust-0')).not.toEqual(rows('map-dust-1'));
    for (const i of [0, 1]) expect(top(rows(`map-dust-${i}`)), `dust ${i}`).toBeGreaterThanOrEqual(6);
    for (const [a, b] of [
      ['toad-map-0', 'toad-map-1'],
      ['toad-map-hammer-0', 'toad-map-hammer-1'],
    ] as const)
      expect(rows(a), a).not.toEqual(rows(b));
    for (const f of ['toad-map-0', 'toad-map-1', 'toad-map-hammer-0', 'toad-map-hammer-1']) {
      // a white cap with red spots, standing on the bottom row
      expect(rows(f).join(''), f).toContain('1');
      expect(rows(f).join(''), f).toContain('d');
      expect(rows(f).at(-1), f).toMatch(/[^.]/);
    }
    for (const f of ['toad-map-hammer-0', 'toad-map-hammer-1']) expect(rows(f).join(''), f).toContain('h');
  });
});
