import { describe, expect, it } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { getLevel } from '@content/levels';
import { campaignLevel } from '@game/level/campaign';
import { Decoration, decorInFront } from '@game/entities/objects/decoration';

// 0.4.24: the art of Link's sky palace (2-1-sky2's campaign look), its own sheet `zelda2-sky`.

const sheet = SPRITES['zelda2-sky'];
const frame = (n: string): readonly string[] => sheet?.frames[n] ?? [];
const PIECES = [
  'gate',
  'column',
  'column-broken',
  'statue',
  'statue-r',
  'crest',
  'banner',
  'curtain',
  'wall',
  'window',
  'cloud-sea',
  'brazier',
];

describe('the sky palace sheet', () => {
  it('is registered with its own palette', () => {
    expect(sheet).toBeDefined();
    expect(sheet?.palette).toBe('zelda2-sky');
    expect(PALETTES.default['zelda2-sky']?.length).toBeGreaterThanOrEqual(12);
  });

  it('has every piece the palace places, each a rectangle of palette colours', () => {
    const n = (PALETTES.default['zelda2-sky'] as readonly string[]).length;
    for (const name of PIECES) {
      const rows = frame(name);
      expect(rows.length, name).toBeGreaterThan(0);
      const w = rows[0]?.length ?? 0;
      for (const r of rows) {
        expect(r.length, name).toBe(w);
        for (const c of r) if (c !== '.') expect(parseInt(c, 36), `${name} ${c}`).toBeLessThan(n);
      }
    }
  });

  it('the two statues face each other: one is the mirror of the other', () => {
    expect(frame('statue-r')).toEqual(frame('statue').map((r) => [...r].reverse().join('')));
  });

  it('the crest over the altar is mostly gold (palette 8-a), an original triad motif', () => {
    const px = frame('crest').join('').replace(/\./g, '');
    const gold = [...px].filter((c) => c === '8' || c === '9' || c === 'a').length;
    expect(gold / px.length).toBeGreaterThan(0.35);
  });

  it('every palace piece in 2-1-sky2 is a still frame of the sheet, drawn behind the tiles', () => {
    const decor = campaignLevel(getLevel('2-1-sky2')).decor.filter((d) => d.kind.startsWith('zelda2-sky:'));
    expect(decor.length).toBeGreaterThan(20);
    for (const d of decor) {
      expect(PIECES, d.kind).toContain(d.kind.slice('zelda2-sky:'.length));
      expect(decorInFront(d.kind), d.kind).toBe(false);
      expect(new Decoration(d.kind, d.x, d.y).layer, d.kind).toBe('back');
    }
  });
});
