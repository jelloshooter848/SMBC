import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { charIndex } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { samusDef, samusPalettes } from './samus';

type Size = [w: number, h: number];

const samusFrames: Record<string, Size> = {
  idle: [16, 32],
  'walk-0': [16, 32],
  'walk-1': [16, 32],
  'walk-2': [16, 32],
  shoot: [16, 32],
  'walk-shoot-0': [16, 32],
  'walk-shoot-1': [16, 32],
  'walk-shoot-2': [16, 32],
  jump: [16, 32],
  'aim-up': [16, 32],
  hurt: [16, 32],
  die: [16, 32],
  'spin-0': [16, 32],
  'spin-1': [16, 32],
  'spin-2': [16, 32],
  'spin-3': [16, 32],
  'ball-0': [16, 32],
  'ball-1': [16, 32],
  'ball-2': [16, 32],
  'ball-3': [16, 32],
};

const grounded = [
  'idle',
  'walk-0',
  'walk-1',
  'walk-2',
  'shoot',
  'walk-shoot-0',
  'walk-shoot-1',
  'walk-shoot-2',
  'aim-up',
  'hurt',
  'die',
  'ball-0',
  'ball-1',
  'ball-2',
  'ball-3',
];

const size = (rows: readonly string[]): Size => [rows[0]?.length ?? 0, rows.length];

const frame = (name: string): readonly string[] => samusDef.frames[name] as readonly string[];

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

/** Rotate a square block a quarter turn clockwise (mirrors the sheet's own helper). */
function rotateCW(rows: readonly string[]): string[] {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
}

describe('samus sprite', () => {
  it('validates', () => {
    expect(() => validateDef('samus', samusDef)).not.toThrow();
  });

  it('uses its own base palette', () => {
    expect(samusDef.palette).toBe('samus');
    expect(samusPalettes.samus).toBeDefined();
  });

  it.each(Object.entries(samusFrames))('has frame %s with the right size', (name, [w, h]) => {
    const rows = samusDef.frames[name];
    expect(rows, `missing frame ${name}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual([w, h]);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(samusDef.frames).sort()).toEqual(Object.keys(samusFrames).sort());
  });

  it('keeps every palette variant within 12 colours and covering every index used', () => {
    const used = maxIndex(samusDef);
    expect(used).toBe(5);
    for (const [pname, colours] of Object.entries(samusPalettes)) {
      expect(colours.length, pname).toBeLessThanOrEqual(12);
      expect(colours.length, `${pname} is missing index ${used}`).toBeGreaterThan(used);
      for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('ships the expected palette variants with matching lengths and a black outline', () => {
    const names = Object.keys(samusPalettes);
    const baseLen = samusPalettes.samus?.length;
    expect(names).toContain('samus-varia');
    for (let i = 0; i < 4; i++) expect(names).toContain(`samus-star-${i}`);
    for (const [pname, colours] of Object.entries(samusPalettes)) {
      expect(colours.length, pname).toBe(baseLen);
      expect(colours[0], `${pname} outline`).toBe('#000000');
    }
  });

  it('renders with every palette', () => {
    for (const [name, palette] of Object.entries(samusPalettes))
      expect(() => rasterizeToBuffer(samusDef, palette), `render with ${name}`).not.toThrow();
  });

  it('stands on the bottom row in grounded poses', () => {
    for (const f of grounded) expect(bottomRowIsOpaque(frame(f)), f).toBe(true);
  });

  it('lifts the boots off the floor in the jump', () => {
    expect(bottomRowIsOpaque(frame('jump'))).toBe(false);
  });

  it('shares the helmet between the standing poses', () => {
    const helmet = frame('idle').slice(4, 14);
    expect(
      helmet.some((r) => /3/.test(r)),
      'visor drawn',
    ).toBe(true);
    for (const f of ['walk-0', 'walk-2']) expect(frame(f).slice(4, 14), f).toEqual(helmet);
    // the passing pose rides one pixel higher
    expect(frame('walk-1').slice(3, 13)).toEqual(helmet);
  });

  it('reaches the frame edge with a glowing muzzle in shoot frames', () => {
    for (const f of ['shoot', 'walk-shoot-0', 'walk-shoot-1', 'walk-shoot-2', 'jump']) {
      const rows = frame(f);
      expect(
        rows.some((r) => r[15] === '5'),
        `${f} muzzle glow`,
      ).toBe(true);
      // the barrel is dark armour running out to the right of the chest
      expect(
        rows.some((r) => /2{3}4[05]$/.test(r)),
        `${f} barrel`,
      ).toBe(true);
    }
  });

  it('points the cannon straight up beside the helmet when aiming up', () => {
    const rows = frame('aim-up');
    expect(rows[4]?.slice(12)).toMatch(/5/);
    for (let y = 6; y <= 13; y++) expect(rows[y]?.slice(12, 16), `row ${y}`).toBe('0220');
    // the helmet is still drawn to the left of the barrel
    expect(rows.slice(4, 14).some((r) => /3/.test(r.slice(0, 12)))).toBe(true);
  });

  it('keeps the somersault in the lower 16 rows and spins it a quarter turn per frame', () => {
    const spin0 = frame('spin-0');
    for (let y = 0; y < 16; y++) expect(spin0[y], `row ${y}`).toBe('.'.repeat(16));
    let block = spin0.slice(16);
    for (let i = 1; i < 4; i++) {
      block = rotateCW(block);
      const rows = frame(`spin-${i}`);
      for (let y = 0; y < 16; y++) expect(rows[y], `spin-${i} row ${y}`).toBe('.'.repeat(16));
      expect(rows.slice(16)).toEqual(block);
    }
  });

  it('draws the morph ball as a sphere resting on the floor in the lower half', () => {
    for (let i = 0; i < 4; i++) {
      const rows = frame(`ball-${i}`);
      for (let y = 0; y < 20; y++) expect(rows[y], `ball-${i} row ${y}`).toBe('.'.repeat(16));
      expect(rows[31]).toMatch(/^\.+0+\.+$/);
      // the glowing core sits in the middle of the ball on every frame
      for (let y = 25; y <= 26; y++) expect(rows[y]?.slice(7, 9), `ball-${i} core`).toBe('55');
      // the highlight walks around the rim
      expect(
        rows.some((r) => /4/.test(r)),
        `ball-${i} highlight`,
      ).toBe(true);
    }
    const b0 = frame('ball-0').slice(20);
    expect(frame('ball-1').slice(20)).not.toEqual(b0);
  });

  it('collapses into the lower half when dying', () => {
    const rows = frame('die');
    for (let y = 0; y < 20; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
    expect(rows[31]).toBe('0'.repeat(16));
  });
});
