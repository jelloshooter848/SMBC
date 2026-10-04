import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { charIndex } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { ryuDef, ryuPalettes } from './ryu';

type Size = [w: number, h: number];

const ryuFrames: Record<string, Size> = {
  idle: [16, 32],
  'walk-0': [16, 32],
  'walk-1': [16, 32],
  'walk-2': [16, 32],
  jump: [16, 32],
  cling: [16, 32],
  crouch: [16, 32],
  throw: [16, 32],
  hurt: [16, 32],
  die: [16, 32],
  'slash-0': [24, 32],
  'slash-1': [24, 32],
  'crouch-slash': [24, 32],
  'spin-0': [16, 32],
  'spin-1': [16, 32],
  'spin-2': [16, 32],
  'spin-3': [16, 32],
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
  'slash-0',
  'slash-1',
  'crouch-slash',
];

const slashFrames = Object.keys(ryuFrames).filter((f) => f.includes('slash'));
const spinFrames = Object.keys(ryuFrames).filter((f) => f.startsWith('spin'));

const size = (rows: readonly string[]): Size => [rows[0]?.length ?? 0, rows.length];

const frame = (name: string): readonly string[] => ryuDef.frames[name] as readonly string[];

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

describe('ryu sprite', () => {
  it('validates', () => {
    expect(() => validateDef('ryu', ryuDef)).not.toThrow();
  });

  it('uses its own base palette', () => {
    expect(ryuDef.palette).toBe('ryu');
    expect(ryuPalettes.ryu).toBeDefined();
  });

  it.each(Object.entries(ryuFrames))('has frame %s with the right size', (name, [w, h]) => {
    const rows = ryuDef.frames[name];
    expect(rows, `missing frame ${name}`).toBeDefined();
    expect(size(rows as readonly string[])).toEqual([w, h]);
  });

  it('has no frames beyond the documented set', () => {
    expect(Object.keys(ryuDef.frames).sort()).toEqual(Object.keys(ryuFrames).sort());
  });

  it('keeps every palette variant within 12 colours and covering every index used', () => {
    const used = maxIndex(ryuDef);
    expect(used).toBe(5);
    for (const [pname, colours] of Object.entries(ryuPalettes)) {
      expect(colours.length, pname).toBeLessThanOrEqual(12);
      expect(colours.length, `${pname} is missing index ${used}`).toBeGreaterThan(used);
      for (const c of colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('ships the expected palette variants with matching lengths and a black outline', () => {
    const names = Object.keys(ryuPalettes);
    const baseLen = ryuPalettes.ryu?.length;
    for (let i = 0; i < 4; i++) expect(names).toContain(`ryu-star-${i}`);
    for (const [pname, colours] of Object.entries(ryuPalettes)) {
      expect(colours.length, pname).toBe(baseLen);
      expect(colours[0], `${pname} outline`).toBe('#000000');
    }
  });

  it('renders with every palette', () => {
    for (const [name, palette] of Object.entries(ryuPalettes))
      expect(() => rasterizeToBuffer(ryuDef, palette), `render with ${name}`).not.toThrow();
  });

  it('stands on the bottom row in grounded poses', () => {
    for (const f of grounded) expect(bottomRowIsOpaque(frame(f)), f).toBe(true);
  });

  it('lifts the boots off the floor in the jump', () => {
    expect(bottomRowIsOpaque(frame('jump'))).toBe(false);
  });

  it('shares the hooded head between the standing poses', () => {
    // the hood occupies columns 4..13 in rows 3..12 of the idle pose; the scarf hangs to its left
    const headOf = (rows: readonly string[], dx: number, dy = 0): string[] =>
      rows.slice(3 + dy, 13 + dy).map((r) => r.slice(5 + dx, 14 + dx));
    const headRows = headOf(frame('idle'), 0);
    expect(
      headRows.some((r) => /3/.test(r)),
      'eye strip drawn',
    ).toBe(true);
    expect(
      headRows.some((r) => /2{4}/.test(r)),
      'mask drawn',
    ).toBe(true);
    // the eye is a dark pixel inside the skin strip
    expect(frame('idle')[8]?.slice(8, 14)).toBe('033030');
    expect(headOf(frame('jump'), 0)).toEqual(headRows);
    // the run leans a pixel forward and rides the passing pose one pixel higher
    for (const f of ['walk-0', 'walk-2', 'throw']) expect(headOf(frame(f), 1), f).toEqual(headRows);
    expect(headOf(frame('walk-1'), 1, -1)).toEqual(headRows);
  });

  it('wears the scarf, wraps and sash in the standing poses', () => {
    for (const f of ['idle', 'walk-0', 'walk-1', 'walk-2', 'jump', 'throw']) {
      const rows = frame(f);
      // scarf tails trail behind the hood (light pixels left of column 5 near the neck)
      expect(
        rows.slice(8, 12).some((r) => /4/.test(r.slice(0, 5))),
        `${f} scarf`,
      ).toBe(true);
      // the sash is a light band across the waist
      expect(
        rows.some((r) => /0444444/.test(r)),
        `${f} sash`,
      ).toBe(true);
    }
  });

  it('carries the sheathed sword on the hip when the blade is not drawn', () => {
    for (const f of ['idle', 'walk-0', 'walk-1', 'walk-2', 'throw', 'cling', 'crouch']) {
      const rows = frame(f);
      // the grey hilt pokes out behind the back forearm with a dark edge under it
      const y = rows.findIndex((r) => /^\.{0,2}55/.test(r));
      expect(y, `${f} hilt`).toBeGreaterThan(0);
      expect(rows[y + 1]?.slice(0, y >= 0 ? 4 : 0), `${f} hilt edge`).toMatch(/^\.{0,2}00/);
    }
    for (const f of slashFrames)
      expect(
        frame(f).some((r) => /^\.{0,2}55/.test(r)),
        `${f} sword drawn`,
      ).toBe(false);
  });

  it('keeps the body inside the first 16 columns of the wide frames', () => {
    for (const f of slashFrames) {
      for (const row of frame(f)) expect(row.slice(16), f).toMatch(/^[.045]*$/);
    }
  });

  it('raises the sword behind the head in the wind-up', () => {
    const rows = frame('slash-0');
    expect(rightmostColumn(rows)).toBeLessThanOrEqual(17);
    // the glove is at the top of the raised arm, the blade steps back over the hood
    expect(rows[1]?.slice(13, 15)).toBe('22');
    expect(rows[0]?.slice(5, 10)).toBe('55555');
    expect(rows[1]?.slice(9, 13)).toBe('5555');
    // nothing of the blade below the hood line
    for (let y = 3; y < 32; y++) expect(rows[y], `row ${y}`).not.toMatch(/5/);
  });

  it('runs the blade level from the glove to column 23 in the slash', () => {
    const rows = frame('slash-1');
    const line = rows[13] as string;
    expect(line.slice(14, 16)).toBe('22');
    expect(line.slice(16)).toBe('55555555');
    expect(rows[14]?.slice(16)).toBe('00000000');
    expect(rightmostColumn(rows)).toBe(23);
    // a thin light arc sweeps from above the hood down to the tip
    const arc = rows.slice(2, 13).map((r) => r.slice(16));
    expect(arc.every((r) => /^[.4]*$/.test(r))).toBe(true);
    expect(arc.filter((r) => /4/.test(r)).length).toBe(10);
    expect(rows[2]?.slice(12, 15)).toBe('444');
    expect(rows[12]?.[23]).toBe('4');
    // the arc is only in the slash frame
    expect(frame('slash-0').some((r) => /4/.test(r.slice(16)))).toBe(false);
    expect(frame('crouch-slash').some((r) => /4/.test(r.slice(16)))).toBe(false);
  });

  it('runs the crouching blade at row 22', () => {
    const rows = frame('crouch-slash');
    const line = rows[22] as string;
    expect(line.slice(14, 16)).toBe('22');
    expect(line.slice(16)).toBe('55555555');
    expect(rows[23]?.slice(16)).toBe('00000000');
    expect(rightmostColumn(rows)).toBe(23);
  });

  it('compresses crouching poses into the lower half', () => {
    for (const f of ['crouch', 'crouch-slash']) {
      const rows = frame(f);
      for (let y = 0; y < 16; y++) expect(rows[y], `${f} row ${y}`).toMatch(/^\.+$/);
      expect(rows[31]).toMatch(/^\.+0+\.+$/);
    }
  });

  it('flattens against the right edge when clinging', () => {
    const rows = frame('cling');
    expect(rightmostColumn(rows)).toBe(15);
    // the gripping glove sits on the top right corner, above the hood
    expect(rows[1]?.slice(13)).toBe('022');
    expect(rows[2]?.slice(13)).toBe('022');
    // the shins and toes press on the right edge for most of the lower half
    const edgeRows = rows.slice(22).filter((r) => r[15] !== '.').length;
    expect(edgeRows).toBeGreaterThanOrEqual(8);
    // nothing in the left quarter below the scarf
    for (let y = 13; y < 32; y++) expect(rows[y]?.slice(0, 2), `row ${y}`).toBe('..');
  });

  it('flings the arm forward when throwing', () => {
    const rows = frame('throw');
    expect(rows[14]?.slice(12)).toBe('4422');
    expect(rows[15]?.slice(11)).toBe('00000');
  });

  it('throws both arms up when hurt', () => {
    const rows = frame('hurt');
    expect(rows[11]?.slice(1, 4)).toBe('022');
    expect(rows[11]?.slice(12, 15)).toBe('220');
    expect(rows[12]?.slice(1, 4)).toBe('044');
    expect(rows[12]?.slice(12, 15)).toBe('440');
  });

  it('collapses into the lower half when dying', () => {
    const rows = frame('die');
    for (let y = 0; y < 20; y++) expect(rows[y], `row ${y}`).toBe('.'.repeat(16));
    expect(rows[31]).toMatch(/^0+\.+$/);
  });

  it('tucks the somersault into the lower half and turns it a quarter per frame', () => {
    const blocks = spinFrames.map((f) => frame(f));
    for (const [i, rows] of blocks.entries()) {
      for (let y = 0; y < 16; y++) expect(rows[y], `${spinFrames[i]} row ${y}`).toBe('.'.repeat(16));
    }
    const lower = blocks.map((rows) => rows.slice(16));
    for (let i = 1; i < 4; i++) expect(lower[i], `spin-${i}`).toEqual(rotateCW(lower[i - 1] as string[]));
    expect(rotateCW(lower[3] as string[])).toEqual(lower[0]);
    // the blade sticks out of the tuck
    expect(lower[0]?.some((r) => r.endsWith('55'))).toBe(true);
    // same pixel count all the way round
    const counts = new Set(lower.map((rows) => opaqueCount(rows)));
    expect(counts.size).toBe(1);
  });
});
