import { describe, expect, it } from 'vitest';
import { charIndex } from '@engine/gfx/palette';
import { PALETTES, SPRITES } from '@content/sprites';
import { SELECT_FACE_IDS } from '@content/sprites/select-faces';

// O-11 (RC audit 0.5.0): the weak select faces redrawn to one standard, Bass's and Sophia's in
// their sprites' colours.

const REDRAWN = [
  'mario',
  'luigi',
  'link',
  'samus',
  'simon',
  'megaman',
  'bass',
  'bill',
  'sophia',
  'zelda-nes',
  'zelda-snes',
  'zelda-gb',
  'quickman',
  'mario3',
  'luigi3',
];

const facePalette = PALETTES.default['select-faces'] ?? [];
const rowsOf = (id: string): readonly string[] => SPRITES['select-faces']?.frames[id] ?? [];
/** The colours face `id` draws with. */
const coloursOf = (id: string): Set<string> => {
  const out = new Set<string>();
  for (const r of rowsOf(id))
    for (const ch of r) {
      const i = charIndex(ch);
      if (i >= 0) out.add((facePalette[i] ?? '').toLowerCase());
    }
  return out;
};

describe('O-11: the redrawn select faces', () => {
  it('each is 24 x 24 and draws only with colours the face palette has', () => {
    expect(facePalette.length).toBeLessThanOrEqual(36);
    for (const id of REDRAWN) {
      expect(SELECT_FACE_IDS, id).toContain(id);
      const rows = rowsOf(id);
      expect(rows, id).toHaveLength(24);
      for (const r of rows) {
        expect(r.length, id).toBe(24);
        for (const ch of r)
          if (charIndex(ch) >= 0) expect(facePalette[charIndex(ch)], `${id} ${ch}`).toBeDefined();
      }
    }
  });

  it("each has a rim in its own colours, never the HUD box's black", () => {
    for (const id of REDRAWN) {
      const rows = rowsOf(id);
      const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
      for (let y = 0; y < 24; y++)
        for (let x = 0; x < 24; x++) {
          if (charIndex(at(x, y)) < 0) continue;
          const edge = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((c) => c === '.');
          if (edge) expect(at(x, y), `${id} (${x}, ${y})`).not.toBe('0');
        }
    }
  });

  it("Bass's, Sophia's and Quick Man's faces wear their sprites' colours", () => {
    const pal = (name: string): readonly string[] =>
      (PALETTES.default[name] ?? []).map((c) => c.toLowerCase());
    // Bass: the orange helmet and the gold fins (bass.ts roles 2 and 5), no longer a grey helmet.
    const bass = pal('bass');
    expect(coloursOf('bass')).toContain(bass[2]);
    expect(coloursOf('bass')).toContain(bass[5]);
    // Sophia: the three pinks of her hull and her light blue canopy (sophia palette 1-3 and 8).
    const sophia = pal('sophia');
    for (const k of [1, 2, 3, 8]) expect(coloursOf('sophia'), `sophia ${k}`).toContain(sophia[k]);
    // Quick Man: his red and his gold crest.
    const quick = pal('quickman');
    expect(coloursOf('quickman')).toContain(quick[1]);
    expect(coloursOf('quickman')).toContain(quick[5]);
  });

  it('the Zelda looks have their own face, not the princess one recoloured', () => {
    const shape = (id: string): string =>
      rowsOf(id)
        .map((r) => r.replace(/[^.]/g, '#'))
        .join('/');
    expect(shape('zelda-nes')).not.toBe(shape('peach'));
    expect(shape('zelda-snes')).toBe(shape('zelda-nes'));
    expect(shape('zelda-gb')).toBe(shape('zelda-nes'));
  });
});
