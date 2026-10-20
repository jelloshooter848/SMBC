import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { makeGame } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// The two-row select (Classic extras on a second row): Up / Down move between the rows to the
// nearest column and say so; Left / Right still walk the whole roster; one row is unchanged.

isolateClassicRegistry();

const idx = (s: CharacterSelectScene) => (s as unknown as { index: number }).index;

function classicSelect(classicRules: 'classic' | 'current' = 'classic') {
  const settings = { ...defaultSettings(), classicRules };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  return { h, sel };
}

describe('two-row character select', () => {
  it('Down goes to the nearest second-row hero, Up back; the edges bump', () => {
    expect(CLASSIC_EXTRAS.length).toBeGreaterThan(1);
    const { h, sel } = classicSelect();
    expect(sel.firstRow).toBe(CHARACTERS.length);
    expect(h.said.some((t) => t.includes('up and down for the other row'))).toBe(true);
    expect(idx(sel)).toBe(0);
    const nearest = (from: number, lo: number, hi: number) => {
      let best = lo;
      for (let k = lo; k < hi; k++)
        if (Math.abs(sel.slot(k).x - sel.slot(from).x) < Math.abs(sel.slot(best).x - sel.slot(from).x))
          best = k;
      return best;
    };
    // The second row ends with Classic mode's Random slot (FU-4): slot chars.length.
    const n = sel.chars.length + 1;
    const first = sel.firstRow;
    const down = nearest(0, first, n);
    h.tap('down');
    expect(idx(sel)).toBe(down);
    expect(h.said.at(-1)).toBe(`${sel.chars[down]?.name ?? 'Random'}, second row`);
    // FU-3: with Mega Man's variants the Classic-only heroes split over two rows, so a third row
    // follows: Down goes on to it, then bumps; Up comes back.
    h.tap('down');
    const third = idx(sel);
    expect(sel.slot(third).y).toBeGreaterThan(sel.slot(down).y);
    h.tap('down');
    expect(idx(sel)).toBe(third);
    h.tap('up');
    const second = idx(sel);
    expect(sel.slot(second).y).toBe(sel.slot(down).y);
    const up = nearest(second, 0, first);
    h.tap('up');
    expect(idx(sel)).toBe(up);
    expect(h.said.at(-1)).toBe(`${sel.chars[up]?.name}, first row`);
    h.tap('up');
    expect(idx(sel)).toBe(up);
    // From the last first-row hero, Down lands on the nearest column (the right end).
    for (let i = 0; i < first - 1 - up; i++) h.tap('right');
    expect(idx(sel)).toBe(first - 1);
    h.tap('down');
    expect(idx(sel)).toBe(nearest(first - 1, first, n));
  });

  it('Left and Right still walk the whole roster across the rows', () => {
    const { h, sel } = classicSelect();
    // Left from the first hero: the Random slot (FU-4), then the last hero.
    h.tap('left');
    expect(idx(sel)).toBe(sel.chars.length);
    h.tap('left');
    expect(idx(sel)).toBe(sel.chars.length - 1);
    h.tap('right');
    h.tap('right');
    expect(idx(sel)).toBe(0);
    for (let i = 0; i < sel.firstRow; i++) h.tap('right');
    expect(idx(sel)).toBe(sel.firstRow);
  });

  it('one row (Classic rules set to Current, free play): Up and Down do nothing, text as today', () => {
    const { h, sel } = classicSelect('current');
    expect(sel.firstRow).toBe(sel.chars.length);
    expect(h.said.at(-1)).toBe('Select your hero. Left and right to choose, OK to begin.');
    const n = h.said.length;
    h.tap('down');
    h.tap('up');
    expect(idx(sel)).toBe(0);
    expect(h.said.length).toBe(n);
    const f = makeGame();
    f.game.showCharacterSelect();
    const s2 = f.top() as CharacterSelectScene;
    f.idle(12);
    f.tap('down');
    expect(idx(s2)).toBe(0);
    expect(f.said.at(-1)).toMatch(/^Select your hero\. Left and right to choose, OK to begin\./);
  });
});
