import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { charIndex } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { simonDef, simonPalettes } from './simon';

type Size = [w: number, h: number];

const simonFrames: Record<string, Size> = {
  idle: [16, 32],
  'walk-0': [16, 32],
  'walk-1': [16, 32],
  'walk-2': [16, 32],
  jump: [16, 32],
  crouch: [16, 32],
  throw: [16, 32],
  hurt: [16, 32],
  die: [16, 32],
  'whip-0': [48, 32],
  'whip-1': [48, 32],
  'whip-leather': [48, 32],
  'whip-chain': [48, 32],
  'whip-star': [48, 32],
  'crouch-whip-leather': [48, 32],
  'crouch-whip-chain': [48, 32],
  'crouch-whip-star': [48, 32],
  'swim-0': [16, 32],
  'swim-1': [16, 32],
};

const grounded = [
  'idle',
  'walk-0',
  'walk-1',
  'walk-2',
  'crouch',
  'throw',
  'hurt',
  'die',
  'whip-0',
  'whip-1',
  'whip-leather',
  'whip-chain',
  'whip-star',
  'crouch-whip-leather',
  'crouch-whip-chain',
  'crouch-whip-star',
];

const whipFrames = Object.keys(simonFrames).filter((f) => f.includes('whip'));

/** Standing strikes carry the lash at row 14, crouching ones at row 22; each whip type has a reach. */
const strikes: [frame: string, row: number, tip: number][] = [
  ['whip-leather', 14, 31],
  ['whip-chain', 14, 39],
  ['whip-star', 14, 47],
  ['crouch-whip-leather', 22, 31],
  ['crouch-whip-chain', 22, 39],
  ['crouch-whip-star', 22, 47],
];

const size = (rows: readonly string[]): Size => [rows[0]?.length ?? 0, rows.length];

const frame = (name: string): readonly string[] => simonDef.frames[name] as readonly string[];

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

/** Rightmost column holding an opaque pixel anywhere in the frame (-1 when empty). */
function rightmostColumn(rows: readonly string[]): number {
  let m = -1;
  for (const row of rows) {
    const idx = row.search(/[0-9a-z][.]*$/);
    if (idx >= 0) m = Math.max(m, idx);
  }
  return m;
}

describe('simon sprite', () => {
  it('validates', () => {
    expect(() => validateDef('simon', simonDef)).not.toThrow();
  });

  it('uses its own base palette', () => {
    expect(simonDef.palette).toBe('simon');
    expect(simonPalettes.simon).toBeDefined();
  });

  it.each(Object.entries(simonFrames))('has frame %s with the right size', (name, [w, h]) => {
    const rows = simonDef.frames[name];
    expect(rows, `missing frame ${name}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual([w, h]);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(simonDef.frames).sort()).toEqual(Object.keys(simonFrames).sort());
  });

  it('keeps every palette variant within 12 colours and covering every index used', () => {
    const used = maxIndex(simonDef);
    expect(used).toBe(5);
    for (const [pname, colours] of Object.entries(simonPalettes)) {
      expect(colours.length, pname).toBeLessThanOrEqual(12);
      expect(colours.length, `${pname} is missing index ${used}`).toBeGreaterThan(used);
      for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('ships the expected palette variants with matching lengths and a black outline', () => {
    const names = Object.keys(simonPalettes);
    const baseLen = simonPalettes.simon?.length;
    for (let i = 0; i < 4; i++) expect(names).toContain(`simon-star-${i}`);
    for (const [pname, colours] of Object.entries(simonPalettes)) {
      expect(colours.length, pname).toBe(baseLen);
      expect(colours[0], `${pname} outline`).toBe('#000000');
    }
  });

  it('renders with every palette', () => {
    for (const [name, palette] of Object.entries(simonPalettes))
      expect(() => rasterizeToBuffer(simonDef, palette), `render with ${name}`).not.toThrow();
  });

  it('stands on the bottom row in grounded poses', () => {
    for (const f of grounded) expect(bottomRowIsOpaque(frame(f)), f).toBe(true);
  });

  it('lifts the boots off the floor in the jump', () => {
    expect(bottomRowIsOpaque(frame('jump'))).toBe(false);
  });

  it('shares the head between the standing poses', () => {
    const headRows = frame('idle').slice(3, 13);
    expect(
      headRows.some((r) => /2/.test(r)),
      'hair drawn',
    ).toBe(true);
    expect(
      headRows.some((r) => /1/.test(r)),
      'face drawn',
    ).toBe(true);
    for (const f of ['walk-0', 'walk-2', 'jump']) expect(frame(f).slice(3, 13), f).toEqual(headRows);
    // the passing pose rides one pixel higher
    expect(frame('walk-1').slice(2, 12)).toEqual(headRows);
    // the strike frames keep the same head at the left of the wide frame
    for (const f of ['whip-leather', 'whip-chain', 'whip-star'])
      expect(
        frame(f)
          .slice(3, 13)
          .map((r) => r.slice(0, 16)),
        f,
      ).toEqual(headRows);
  });

  it('hangs the coiled whip on the hip when the whip is not in use', () => {
    for (const f of ['idle', 'walk-0', 'walk-1', 'walk-2', 'jump', 'throw', 'hurt']) {
      const rows = frame(f);
      // the coil is a light ring around a dark hole, low on the back (left) side of the body
      expect(
        rows.slice(20, 26).some((r) => /^.?5005/.test(r)),
        `${f} coil`,
      ).toBe(true);
    }
    for (const f of whipFrames) {
      const rows = frame(f);
      expect(
        rows.slice(20, 26).some((r) => /^.?5005/.test(r)),
        `${f} has no coil`,
      ).toBe(false);
    }
  });

  it('keeps the body inside the first 16 columns of the wide frames', () => {
    for (const f of whipFrames) {
      for (const row of frame(f)) expect(row.slice(16), f).toMatch(/^[.05]*$/);
    }
  });

  it.each(strikes)('%s runs the lash level from the fist to column %i', (f, row, tip) => {
    const rows = frame(f);
    const line = rows[row] as string;
    // skin fist on the frame edge of the body, lash from column 16 to the tip
    expect(line[15]).toBe('1');
    expect(line.slice(16, tip + 1)).toMatch(/^5+0?5*$/);
    expect(line[tip]).toBe('5');
    expect(rightmostColumn(rows)).toBe(tip);
    // a dark edge directly under the lash so it reads over light ground
    expect(rows[row + 1]?.slice(16, 28)).toBe('0'.repeat(12));
  });

  it('gives the chain whip knots and the morning star a ball at the tip', () => {
    for (const [f, row] of [
      ['whip-chain', 14],
      ['crouch-whip-chain', 22],
    ] as const) {
      const knots = (frame(f)[row - 1] as string).slice(16, 40);
      expect(knots, f).toMatch(/^(\.\.55\.\.){4}$/);
      expect(knots.match(/55/g)?.length, `${f} knots`).toBe(4);
    }
    for (const [f, row] of [
      ['whip-star', 14],
      ['crouch-whip-star', 22],
    ] as const) {
      const rows = frame(f);
      expect(rows[row - 2]?.slice(43), `${f} ball top`).toBe('..5..');
      expect(rows[row]?.slice(43), `${f} ball core`).toBe('55055');
      expect(rows[row + 2]?.slice(43), `${f} ball bottom`).toBe('..5..');
    }
  });

  it('draws the wind-up and mid-swing lash where the animation expects it', () => {
    const windup = frame('whip-0');
    expect(rightmostColumn(windup)).toBeLessThanOrEqual(20);
    // the lash loops back over the head
    expect(windup.slice(0, 3).some((r) => /5/.test(r.slice(0, 16)))).toBe(true);
    const swing = frame('whip-1');
    expect(rightmostColumn(swing)).toBeLessThanOrEqual(29);
    expect(
      swing.some((r) => r[28] === '5'),
      'tip near column 28',
    ).toBe(true);
    // the arc rises above the shoulder line before it comes down
    expect(swing.slice(4, 8).some((r) => /5/.test(r.slice(16)))).toBe(true);
  });

  it('compresses crouching poses into the lower half', () => {
    for (const f of ['crouch', 'crouch-whip-leather', 'crouch-whip-chain', 'crouch-whip-star']) {
      const rows = frame(f);
      for (let y = 0; y < 16; y++) expect(rows[y], `${f} row ${y}`).toMatch(/^\.+$/);
      expect(rows[31]).toMatch(/^\.+0+\.+$/);
    }
  });

  it('raises the arm up and forward when throwing', () => {
    const rows = frame('throw');
    // the open hand sits in the top right corner above the shoulder line
    expect(rows[8]?.slice(13)).toBe('011');
    expect(rows[13]?.slice(12, 15)).toBe('110');
  });

  it('throws both arms up when hurt', () => {
    const rows = frame('hurt');
    for (let y = 7; y <= 12; y++) {
      expect(rows[y]?.slice(0, 4), `row ${y} back arm`).toBe('0110');
      expect(rows[y]?.slice(13), `row ${y} front arm`).toBe('011');
    }
  });

  it('collapses into the lower half when dying', () => {
    const rows = frame('die');
    for (let y = 0; y < 20; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
    expect(rows[31]).toBe('0'.repeat(16));
  });
});
