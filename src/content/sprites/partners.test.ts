import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PARTNERS } from '@game/story/script';
import { PALETTES, SPRITES } from './index';
import { partnersDef, partnersPalettes } from './partners';
import { sophiaDef } from './sophia';

type Size = readonly [w: number, h: number];

/** The frame contract the partners (entities/objects/partner.ts) and 2-1's cave doorway render against. */
const SIZES: Record<string, Size> = {
  'old-man': [16, 32],
  'dr-light': [16, 32],
  chozo: [16, 24],
  townsperson: [16, 32],
  irene: [16, 32],
  lance: [16, 32],
  // 0.4.23 (S2): two Mushroom Kingdom folk, Toad's height, and a fairy that floats.
  villager: [16, 24],
  'pipe-keeper': [16, 24],
  fairy: [16, 16],
};
/** Partners drawn from a hero's own sheet (entities/objects/partner.ts BORROWED). */
const BORROWED = ['jason', 'fred'];
const FRAMES: Record<string, Size> = {
  ...Object.fromEntries(
    Object.entries(SIZES).flatMap(([who, s]) => [
      [`${who}-0`, s],
      [`${who}-1`, s],
    ]),
  ),
  cave: [32, 40],
};

const rows = (name: string): readonly string[] => partnersDef.frames[name] as readonly string[];
const count = (frame: readonly string[], chars: string) =>
  [...frame.join('')].filter((c) => chars.includes(c)).length;

describe('partners sheet', () => {
  it('validates', () => validateDef('partners', partnersDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(partnersDef.frames).sort()).toEqual(Object.keys(FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
    }
  });

  it("draws every partner of the script (Jason and Fred from Sophia III's sheet: her pilot and his frog)", () => {
    expect([...Object.keys(SIZES), ...BORROWED].sort()).toEqual(Object.keys(PARTNERS).sort());
    for (const f of ['jason-stand', 'fred-0']) {
      const rows = sophiaDef.frames[f] as readonly string[];
      expect([rows[0]?.length, rows.length], f).toEqual([16, 16]);
    }
  });

  it('is registered with its palette', () => {
    expect(SPRITES.partners).toBe(partnersDef);
    expect(partnersDef.palette).toBe('partners');
    expect(PALETTES.default.partners).toBe(partnersPalettes.partners);
  });

  it('renders in every colour mode', () => {
    for (const mode of PALETTE_MODES) {
      const pal = resolvePalette(PALETTES, 'partners', mode);
      expect(() => rasterizeToBuffer(partnersDef, pal), mode).not.toThrow();
    }
  });

  it('everyone stands on the bottom row, with an empty top row', () => {
    for (const name of Object.keys(FRAMES)) {
      expect(rows(name).at(-1), name).toMatch(/[^.]/);
      expect(rows(name)[0], name).toMatch(/^\.+$/);
    }
  });

  it('the idle pair differs only around the eyes (a blink, or the statue glowing brighter)', () => {
    for (const who of Object.keys(SIZES).filter((w) => w !== 'fairy')) {
      const [a, b] = [rows(`${who}-0`), rows(`${who}-1`)];
      const changed: number[] = [];
      a.forEach((r, y) => [...r].forEach((c, x) => c !== b[y]?.[x] && changed.push(y)));
      expect(changed.length, who).toBeGreaterThan(0);
      expect(Math.max(...changed) - Math.min(...changed), who).toBeLessThan(4);
    }
    expect(count(rows('chozo-1'), 'fg')).toBeGreaterThan(count(rows('chozo-0'), 'fg'));
  });

  it('each partner shows its colours: white beards, a white coat, grey stone, red bandana', () => {
    expect(count(rows('old-man-0'), '1')).toBeGreaterThan(30);
    expect(count(rows('old-man-0'), '78')).toBeGreaterThan(100);
    expect(count(rows('dr-light-0'), '12')).toBeGreaterThan(150);
    expect(count(rows('chozo-0'), '234')).toBeGreaterThan(count(rows('chozo-0'), '0'));
    expect(count(rows('chozo-0'), 'f')).toBeGreaterThan(0);
    expect(count(rows('lance-0'), '9')).toBeGreaterThan(8);
    expect(count(rows('townsperson-0'), 'hi')).toBeGreaterThan(100);
    expect(count(rows('irene-0'), 'ab')).toBeGreaterThan(100);
    // The villager's cap has blue spots (our Toad's are red); the pipe keeper's green, and he
    // carries a grey wrench; the fairy is pink with pale blue wings.
    expect(count(rows('villager-0'), 'd')).toBeGreaterThan(12);
    expect(count(rows('villager-0'), '9')).toBe(0);
    expect(count(rows('pipe-keeper-0'), 'k')).toBeGreaterThan(12);
    expect(count(rows('pipe-keeper-0'), '3')).toBeGreaterThan(5);
    expect(count(rows('fairy-0'), 'j')).toBeGreaterThan(10);
    expect(count(rows('fairy-0'), 'l')).toBeGreaterThan(10);
  });

  it("the fairy's pair is a wing beat: the wings move, the body stays", () => {
    const [a, b] = [rows('fairy-0'), rows('fairy-1')];
    expect(a).not.toEqual(b);
    expect(a.slice(9)).toEqual(b.slice(9));
    expect(count(b, 'l')).toBeGreaterThan(10);
  });

  it('the cave is a rock face with a dark doorway in the middle that meets the ground', () => {
    const f = rows('cave');
    const bottom = f.at(-1) as string;
    // the doorway: dark through the middle of the bottom row, rock on both sides
    expect(bottom.slice(8, 24)).toMatch(/^0+$/);
    expect(bottom.slice(1, 7)).toMatch(/[abc]/);
    expect(bottom.slice(25, 31)).toMatch(/[abc]/);
    // rock above the doorway's arch
    expect(f[12]?.slice(12, 20)).toMatch(/[abc]/);
    expect(count(f, 'abc')).toBeGreaterThan(count(f, '0'));
  });
});
