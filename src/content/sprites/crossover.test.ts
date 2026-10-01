import { describe, expect, it } from 'vitest';
import { validateDef } from '@engine/gfx/pixelart';
import { charIndex } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { linkDef, linkPalettes } from './link';
import { megamanDef, megamanPalettes } from './megaman';

type Size = [w: number, h: number];

const linkFrames: Record<string, Size> = {
  idle: [16, 32],
  'walk-0': [16, 32],
  'walk-1': [16, 32],
  'walk-2': [16, 32],
  jump: [16, 32],
  crouch: [16, 32],
  'attack-0': [24, 32],
  'attack-1': [24, 32],
  'attack-2': [24, 32],
  'crouch-attack': [24, 32],
  'down-thrust': [16, 32],
  hurt: [16, 32],
  die: [16, 32],
  'climb-0': [16, 32],
  'climb-1': [16, 32],
};

const megamanFrames: Record<string, Size> = {
  idle: [16, 32],
  'idle-blink': [16, 32],
  'walk-0': [16, 32],
  'walk-1': [16, 32],
  'walk-2': [16, 32],
  jump: [16, 32],
  shoot: [24, 32],
  'walk-shoot-0': [24, 32],
  'walk-shoot-1': [24, 32],
  'walk-shoot-2': [24, 32],
  'jump-shoot': [24, 32],
  slide: [16, 32],
  hurt: [16, 32],
  'death-orb': [8, 8],
  'teleport-0': [16, 32],
  'climb-0': [16, 32],
  'climb-1': [16, 32],
  'charge-0': [16, 32],
};

const size = (rows: readonly string[]): Size => [rows[0]?.length ?? 0, rows.length];

/** Highest palette index used anywhere in the def. */
function maxIndex(def: SpriteDef): number {
  let m = -1;
  for (const rows of Object.values(def.frames))
    for (const row of rows) for (const ch of row) m = Math.max(m, charIndex(ch));
  return m;
}

function bottomRowIsOpaque(rows: readonly string[]): boolean {
  const last = rows[rows.length - 1] ?? '';
  return /[0-9a-z]/.test(last);
}

describe.each([
  ['link', linkDef, linkPalettes, linkFrames, 'link'],
  ['megaman', megamanDef, megamanPalettes, megamanFrames, 'megaman'],
] as const)('%s sprite', (name, def, palettes, expected, base) => {
  it('validates', () => {
    expect(() => validateDef(name, def)).not.toThrow();
  });

  it('uses its own base palette', () => {
    expect(def.palette).toBe(base);
    expect(palettes[base]).toBeDefined();
  });

  it.each(Object.entries(expected))('has frame %s with the right size', (frame, [w, h]) => {
    const rows = def.frames[frame];
    expect(rows, `missing frame ${frame}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual([w, h]);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(def.frames).sort()).toEqual(Object.keys(expected).sort());
  });

  it('keeps every palette variant within 12 colours and covering every index used', () => {
    const used = maxIndex(def);
    for (const [pname, colours] of Object.entries(palettes)) {
      expect(colours.length, pname).toBeLessThanOrEqual(12);
      expect(colours.length, `${pname} is missing index ${used}`).toBeGreaterThan(used);
      for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('ships the expected palette variants with matching lengths', () => {
    const names = Object.keys(palettes);
    const baseLen = palettes[base]?.length;
    for (let i = 0; i < 4; i++) expect(names).toContain(`${base}-star-${i}`);
    for (const colours of Object.values(palettes)) expect(colours.length).toBe(baseLen);
  });
});

describe('link extras', () => {
  it('has a red tunic variant', () => {
    expect(linkPalettes['link-red']).toBeDefined();
  });

  it('stands on the bottom row in grounded poses', () => {
    for (const f of ['idle', 'walk-0', 'walk-1', 'walk-2', 'crouch', 'attack-0', 'attack-1', 'attack-2'])
      expect(bottomRowIsOpaque(linkDef.frames[f] as readonly string[]), f).toBe(true);
  });

  it('keeps the body in the left 16 px of attack frames and the blade beyond it', () => {
    const full = linkDef.frames['attack-1'] as readonly string[];
    const right = full.map((r) => r.slice(16));
    expect(right.some((r) => /[0-9a-z]/.test(r))).toBe(true);
    // Blade reaches the right edge of the 24-wide frame.
    expect(full.some((r) => r[23] !== '.')).toBe(true);
  });

  it('draws the down-thrust blade below the feet', () => {
    const rows = linkDef.frames['down-thrust'] as readonly string[];
    expect(rows[31]).toMatch(/[0-9a-z]/);
  });
});

describe('megaman extras', () => {
  it('has three charge palettes', () => {
    for (let i = 0; i < 3; i++) expect(megamanPalettes[`megaman-charge-${i}`]).toBeDefined();
  });

  it('keeps the slide in the lower 16 rows', () => {
    const rows = megamanDef.frames.slide as readonly string[];
    for (let y = 0; y < 16; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
  });

  it('extends the cannon past the body in shoot frames', () => {
    for (const f of ['shoot', 'walk-shoot-0', 'walk-shoot-1', 'walk-shoot-2', 'jump-shoot']) {
      const rows = megamanDef.frames[f] as readonly string[];
      expect(
        rows.some((r) => /[0-9a-z]/.test(r.slice(16))),
        f,
      ).toBe(true);
    }
  });

  it('mirrors climb-1 from climb-0', () => {
    const a = megamanDef.frames['climb-0'] as readonly string[];
    const b = megamanDef.frames['climb-1'] as readonly string[];
    expect(b.map((r) => r.split('').reverse().join(''))).toEqual(a);
  });
});
