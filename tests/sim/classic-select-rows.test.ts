import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { makeGame } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// Classic mode's select rows (the original's grid, the Classic extras after the usual heroes): Up /
// Down move between the rows to the nearest column and say so; Left / Right still walk the whole
// roster; the free-play select's one row is unchanged.

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
  it('Down goes to the nearest hero on the next row, Up back; past the edges to the other row (RC-006)', () => {
    expect(CLASSIC_EXTRAS.length).toBeGreaterThan(1);
    const { h, sel } = classicSelect();
    expect(h.said.some((t) => t.includes('up and down for the other row'))).toBe(true);
    expect(idx(sel)).toBe(0);
    const n = sel.chars.length + 1;
    // The original's grid (its rows as the select lays them out: 5 / 6), the Random slot last.
    const ys = [...new Set(Array.from({ length: n }, (_, k) => sel.slot(k).y))].sort((a, b) => a - b);
    const rowOf = (k: number) => ys.indexOf(sel.slot(k).y);
    const rowEnd = (r: number) =>
      Math.max(...Array.from({ length: n }, (_, k) => k).filter((k) => rowOf(k) === r));
    const nearest = (from: number, row: number) => {
      let best = -1;
      for (let k = 0; k < n; k++)
        if (
          rowOf(k) === row &&
          (best < 0 ||
            Math.abs(sel.slot(k).x - sel.slot(from).x) < Math.abs(sel.slot(best).x - sel.slot(from).x))
        )
          best = k;
      return best;
    };
    const rows = sel.rows;
    expect(rows).toBe(ys.length);
    const names = ['first', 'second', 'third', 'fourth'];
    let at = 0;
    for (let r = 1; r < rows; r++) {
      const to = nearest(at, r);
      h.tap('down');
      expect(idx(sel)).toBe(to);
      expect(h.said.at(-1)).toMatch(new RegExp(`, ${names[r]} row$`));
      at = to;
    }
    // RC-006: the last row's Down goes round to the first row (CharacterSelectBox
    // .getNearestPortrait), and Up comes back.
    const last = at;
    h.tap('down');
    expect(rowOf(idx(sel))).toBe(0);
    expect(idx(sel)).toBe(nearest(last, 0));
    const wrapped = idx(sel);
    h.tap('up');
    expect(idx(sel)).toBe(nearest(wrapped, rows - 1));
    at = idx(sel);
    for (let r = rows - 2; r >= 0; r--) {
      const to = nearest(at, r);
      h.tap('up');
      expect(idx(sel)).toBe(to);
      at = to;
    }
    expect(rowOf(idx(sel))).toBe(0);
    // Up on the first row: the last row's nearest.
    h.tap('up');
    expect(rowOf(idx(sel))).toBe(rows - 1);
    expect(idx(sel)).toBe(nearest(at, rows - 1));
    h.tap('down');
    expect(rowOf(idx(sel))).toBe(0);
    at = idx(sel);
    // From the first row's right end, Down lands on the nearest column.
    for (let i = 0; i < rowEnd(0) - at; i++) h.tap('right');
    expect(idx(sel)).toBe(rowEnd(0));
    h.tap('down');
    expect(idx(sel)).toBe(nearest(rowEnd(0), 1));
  });

  it('RC-006: Left and Right wrap within the row, as the original (Simon to Mario)', () => {
    const { h, sel } = classicSelect();
    const n = sel.chars.length + 1;
    const y0 = sel.slot(0).y;
    const top = Array.from({ length: n }, (_, k) => k).filter((k) => sel.slot(k).y === y0);
    const end = Math.max(...top);
    // Left from the first hero: the first row's last, never the Random slot.
    h.tap('left');
    expect(idx(sel)).toBe(end);
    h.tap('right');
    expect(idx(sel)).toBe(0);
    for (let i = 0; i < top.length; i++) h.tap('right');
    expect(idx(sel)).toBe(0);
    // The second row wraps on its own, through the Random slot (FU-4) at its end.
    h.tap('down');
    const start = idx(sel);
    expect(sel.slot(start).y).toBeGreaterThan(y0);
    h.tap('left');
    expect(idx(sel)).toBe(sel.chars.length);
    expect(h.said.at(-1)).toBe('Random');
    h.tap('right');
    expect(idx(sel)).toBe(start);
  });

  it('one row (Classic rules set to Current, free play): Up and Down do nothing, text as today', () => {
    // Classic mode's select is the original's grid (nine to a row, then the "?" cell), so only
    // the free-play select keeps the one row.
    const { h, sel } = classicSelect('current');
    expect(sel.firstRow).toBe(sel.chars.length);
    expect(sel.rows).toBe(2);
    expect(h.said.at(-1)).toBe(
      // O-10: Classic's select names the hero and what OK does on it.
      'Select your hero. Mario, Super Mario Bros. Left and right to choose, up and down for the other row, OK: play.',
    );
    const f = makeGame();
    f.game.showCharacterSelect();
    const s2 = f.top() as CharacterSelectScene;
    f.idle(12);
    f.tap('down');
    expect(idx(s2)).toBe(0);
    expect(f.said.at(-1)).toMatch(/^Select your hero\. Left and right to choose, OK to begin\./);
  });
});
