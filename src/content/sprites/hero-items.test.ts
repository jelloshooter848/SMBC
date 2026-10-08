import { describe, expect, it } from 'vitest';
import { validateDef } from '@engine/gfx/pixelart';
import { HERO_ITEMS } from '@game/items/catalog';
import { sfx } from '@content/sfx/sfx';
import { heroItemPalettes, heroItemsDef } from './hero-items';
import { SPRITES } from './index';
import { itemsDef } from './items';

describe('hero item art and sounds (docs/POWERUPS.md 11)', () => {
  const own = Object.entries(HERO_ITEMS).filter(([, h]) => h.ownItems);
  const ids = own.flatMap(([, h]) => h.items.map((i) => i.id));

  it('every hero item has a 16 × 16 frame on the hero-items sheet, in its palette', () => {
    expect(SPRITES['hero-items']).toBe(heroItemsDef);
    validateDef('hero-items', heroItemsDef);
    const colours = heroItemPalettes['hero-items']!.length;
    for (const id of ids) {
      const rows = heroItemsDef.frames[id];
      expect(rows, id).toBeDefined();
      expect(rows!.length, id).toBe(16);
      for (const r of rows!) {
        expect(r.length, id).toBe(16);
        for (const c of r) if (c !== '.') expect(parseInt(c, 36), `${id} ${c}`).toBeLessThan(colours);
      }
    }
    expect(Object.keys(heroItemsDef.frames).sort()).toEqual([...ids].sort());
  });

  it('47 items, each with its own pickup sound, no two alike', () => {
    expect(ids).toHaveLength(47);
    const cues = ids.map((id) => sfx.find((s) => s.id === `item-${id}`));
    for (const [i, c] of cues.entries()) expect(c, ids[i]).toBeDefined();
    const bodies = cues.map((c) => JSON.stringify({ ...c, id: '' }));
    expect(new Set(bodies).size).toBe(ids.length);
  });

  it("Samus's Ice and Wave belt icons exist", () => {
    expect(itemsDef.frames['icon-ice-beam']).toHaveLength(8);
    expect(itemsDef.frames['icon-wave-beam']).toHaveLength(8);
  });
});
