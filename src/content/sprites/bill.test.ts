import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { charIndex } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { billDef, billPalettes } from './bill';

type Size = [w: number, h: number];

const billFrames: Record<string, Size> = {
  idle: [16, 32],
  shoot: [16, 32],
  'walk-0': [16, 32],
  'walk-1': [16, 32],
  'walk-2': [16, 32],
  'aim-up': [16, 32],
  'aim-diag-up': [16, 32],
  'aim-diag-down': [16, 32],
  prone: [16, 32],
  'spin-0': [16, 32],
  'spin-1': [16, 32],
  'spin-2': [16, 32],
  'spin-3': [16, 32],
  hurt: [16, 32],
  die: [16, 32],
  'swim-0': [16, 32],
  'swim-1': [16, 32],
  'swim-shoot': [16, 32],
  'swim-aim-up': [16, 32],
  'swim-aim-diag-up': [16, 32],
};

const grounded = [
  'idle',
  'shoot',
  'walk-0',
  'walk-1',
  'walk-2',
  'aim-up',
  'aim-diag-up',
  'prone',
  'hurt',
  'die',
];

const spinFrames = Object.keys(billFrames).filter((f) => f.startsWith('spin'));

const size = (rows: readonly string[]): Size => [rows[0]?.length ?? 0, rows.length];

const frame = (name: string): readonly string[] => billDef.frames[name] as readonly string[];

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

/** Number of opaque pixels in the frame. */
const opaqueCount = (rows: readonly string[]): number =>
  rows.reduce((n, r) => n + r.replace(/\./g, '').length, 0);

/** Rotate a square block a quarter turn clockwise (mirrors the sheet's helper). */
const rotateCW = (rows: readonly string[]): string[] => {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
};

describe('bill sprite', () => {
  it('validates', () => {
    expect(() => validateDef('bill', billDef)).not.toThrow();
  });

  it('uses its own base palette', () => {
    expect(billDef.palette).toBe('bill');
    expect(billPalettes.bill).toBeDefined();
  });

  it.each(Object.entries(billFrames))('has frame %s with the right size', (name, [w, h]) => {
    const rows = billDef.frames[name];
    expect(rows, `missing frame ${name}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual([w, h]);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(billDef.frames).sort()).toEqual(Object.keys(billFrames).sort());
  });

  it('keeps every palette variant within 12 colours and covering every index used', () => {
    const used = maxIndex(billDef);
    expect(used).toBe(5);
    for (const [pname, colours] of Object.entries(billPalettes)) {
      expect(colours.length, pname).toBeLessThanOrEqual(12);
      expect(colours.length, `${pname} is missing index ${used}`).toBeGreaterThan(used);
      for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('ships the expected palette variants with matching lengths and a black outline', () => {
    const names = Object.keys(billPalettes);
    const baseLen = billPalettes.bill?.length;
    for (let i = 0; i < 4; i++) expect(names).toContain(`bill-star-${i}`);
    for (const [pname, colours] of Object.entries(billPalettes)) {
      expect(colours.length, pname).toBe(baseLen);
      expect(colours[0], `${pname} outline`).toBe('#000000');
    }
  });

  it('renders with every palette', () => {
    for (const [name, palette] of Object.entries(billPalettes))
      expect(() => rasterizeToBuffer(billDef, palette), `render with ${name}`).not.toThrow();
  });

  it('stands on the bottom row in grounded poses', () => {
    for (const f of grounded) expect(bottomRowIsOpaque(frame(f)), f).toBe(true);
  });

  it('lifts the boots off the floor when aiming down in the air', () => {
    expect(bottomRowIsOpaque(frame('aim-diag-down'))).toBe(false);
  });

  it('shares the headband and hair between the standing poses', () => {
    // the head occupies columns 4..13 in rows 3..11 of the idle pose; the tails trail to its left
    const headOf = (rows: readonly string[], dx: number, dy = 0): string[] =>
      rows.slice(3 + dy, 12 + dy).map((r) => r.slice(4 + dx, 14 + dx));
    const headRows = headOf(frame('idle'), 0);
    expect(
      headRows.some((r) => /2{6}/.test(r)),
      'hair drawn',
    ).toBe(true);
    expect(frame('idle')[6]?.slice(3, 14), 'headband across the brow').toBe('04444444440');
    // the eye is a dark pixel inside the face, two skin pixels from the front
    expect(frame('idle')[8]?.slice(4, 14)).toBe('0211110110');
    for (const f of ['shoot', 'aim-diag-down']) expect(headOf(frame(f), 0), f).toEqual(headRows);
    // the raised rifle or a raised hand passes the chin in the aiming and knockback poses, so
    // those are compared down to the jaw; aiming up and the knockback step a pixel back
    expect(headOf(frame('aim-diag-up'), 0).slice(0, 7)).toEqual(headRows.slice(0, 7));
    for (const f of ['aim-up', 'hurt'])
      expect(headOf(frame(f), -1).slice(0, 7), f).toEqual(headRows.slice(0, 7));
    // the run leans a pixel forward
    for (const f of ['walk-0', 'walk-2']) expect(headOf(frame(f), 1), f).toEqual(headRows);
    expect(headOf(frame('walk-1'), 1, -1)).toEqual(headRows);
  });

  it('wears the headband tails, ammo belt and waist belt in the standing poses', () => {
    for (const f of [
      'idle',
      'shoot',
      'walk-0',
      'walk-1',
      'walk-2',
      'aim-up',
      'aim-diag-up',
      'aim-diag-down',
    ]) {
      const rows = frame(f);
      // the tails trail behind the head (red pixels left of column 5 just under the band)
      expect(
        rows.slice(5, 9).some((r) => /4/.test(r.slice(0, 5))),
        `${f} tails`,
      ).toBe(true);
      // the ammo belt runs diagonally down the chest: a lone red pixel on each of several torso rows
      const belt = rows.slice(13, 20).filter((r) => /[^4]4[^4]/.test(r)).length;
      expect(belt, `${f} ammo belt`).toBeGreaterThanOrEqual(4);
      // the waist belt is a red band
      expect(
        rows.some((r) => /044444+0/.test(r)),
        `${f} waist belt`,
      ).toBe(true);
    }
  });

  it('holds the rifle level across the chest when standing and running', () => {
    for (const f of ['idle', 'shoot', 'walk-0', 'walk-2']) {
      const line = frame(f)[16] as string;
      expect(line.slice(0, 3), `${f} stock`).toBe('022');
      expect(line.slice(3, 15), `${f} barrel`).toBe('555555555555');
    }
    expect(frame('walk-1')[15]?.slice(0, 15)).toBe('022555555555555');
    // nothing grey anywhere but the barrel row
    for (const f of ['idle', 'walk-0', 'walk-2'])
      for (const [y, row] of frame(f).entries()) if (y !== 16) expect(row, `${f} row ${y}`).not.toMatch(/5/);
  });

  it('adds a muzzle flash at the barrel tip when shooting', () => {
    const idle = frame('idle');
    const shoot = frame('shoot');
    expect(rightmostColumn(idle)).toBe(14);
    expect(rightmostColumn(shoot)).toBe(15);
    expect(
      shoot
        .map((r) => r[15])
        .join('')
        .replace(/\./g, ''),
    ).toBe('545');
    expect(shoot[16]?.[15]).toBe('4');
    // everything else is the idle pose
    expect(shoot.map((r) => r.slice(0, 15))).toEqual(idle.map((r) => r.slice(0, 15)));
  });

  it('points the rifle straight up beside the head when aiming up', () => {
    const rows = frame('aim-up');
    // the barrel is a grey column with a dark edge from the top row down to the chest
    for (let y = 0; y <= 14; y++) expect(rows[y]?.slice(13, 15), `row ${y}`).toBe('50');
    expect(rows[0]).toMatch(/5/);
    // the stock drops dark below it
    expect(rows[15]?.slice(12, 15)).toBe('220');
    expect(rows[16]?.slice(12, 15)).toBe('220');
    // the front hand grips it at chin height
    expect(rows[10]?.[12]).toBe('1');
    expect(rightmostColumn(rows)).toBe(14);
  });

  it('runs the rifle diagonally up to the top right when aiming diagonally up', () => {
    const rows = frame('aim-diag-up');
    for (let i = 0; i < 8; i++) expect(rows[8 + i]?.[15 - i], `step ${i}`).toBe('5');
    // dark edge under the barrel, except where the front hand grips it over the shoulder
    for (let i = 1; i < 8; i++) if (i !== 4) expect(rows[8 + i]?.[16 - i], `edge ${i}`).toBe('0');
    expect(rows[12]?.slice(11, 15)).toBe('5110');
    expect(rows[16]?.slice(5, 9)).toBe('2250');
    expect(rightmostColumn(rows)).toBe(15);
    // nothing grey above the tip
    for (let y = 0; y < 8; y++) expect(rows[y], `row ${y}`).not.toMatch(/5/);
  });

  it('runs the rifle diagonally down to the bottom right when aiming diagonally down', () => {
    const rows = frame('aim-diag-down');
    for (let i = 0; i < 7; i++) expect(rows[15 + i]?.[9 + i], `step ${i}`).toBe('5');
    expect(rows[22]?.[15]).toBe('0');
    // stock at the front shoulder
    expect(rows[13]?.slice(5, 9)).toBe('0220');
    // tucked legs end above the floor
    for (let y = 29; y < 32; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
  });

  it('lies flat in the bottom eight rows when prone with the head and rifle to the right', () => {
    const rows = frame('prone');
    for (let y = 0; y < 24; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
    // hair and headband on the raised head at the right
    expect(rows[25]?.slice(9, 15)).toBe('022220');
    expect(rows[26]?.slice(9, 16)).toBe('0444440');
    // the rifle lies level in front, reaching the frame edge
    expect(rows[29]?.slice(8, 16)).toBe('22555555');
    // boots at the left end on the floor
    expect(rows[30]?.slice(0, 3)).toBe('022');
    expect(rows[31]?.slice(0, 3)).toBe('022');
    expect(rows[31]).toMatch(/^[02]+\.+$/);
  });

  it('throws both arms up when hurt, the rifle still in the front fist', () => {
    const rows = frame('hurt');
    expect(rows[11]?.slice(1, 4)).toBe('011');
    expect(rows[11]?.slice(12, 15)).toBe('110');
    for (let y = 4; y <= 10; y++) expect(rows[y]?.slice(13, 15), `row ${y}`).toBe('50');
  });

  it('collapses into the lower half when dying', () => {
    const rows = frame('die');
    for (let y = 0; y < 20; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
    expect(rows[31]).toBe('0'.repeat(16));
    // the rifle lies dropped on the ground behind
    expect(rows[30]?.slice(0, 3)).toBe('552');
  });

  it('tucks the somersault into the lower half and turns it a quarter per frame', () => {
    const blocks = spinFrames.map((f) => frame(f));
    for (const [i, rows] of blocks.entries()) {
      for (let y = 0; y < 16; y++) expect(rows[y], `${spinFrames[i]} row ${y}`).toBe('.'.repeat(16));
    }
    const lower = blocks.map((rows) => rows.slice(16));
    for (let i = 1; i < 4; i++) expect(lower[i], `spin-${i}`).toEqual(rotateCW(lower[i - 1] as string[]));
    expect(rotateCW(lower[3] as string[])).toEqual(lower[0]);
    // the rifle is hugged level across the middle of the tuck
    expect(lower[0]?.[9]).toBe('0225555555555550');
    // same pixel count all the way round
    const counts = new Set(lower.map((rows) => opaqueCount(rows)));
    expect(counts.size).toBe(1);
  });
});
