import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import type { CharacterDef } from '@game/characters/character';
import { MEGAMAN } from '@game/characters/megaman';
import { BREAKMAN_CLASSIC } from '@game/characters/protoman/classic';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { SELECT_GRID, skinCell } from '@game/scenes/select-grid';
import { draw, makeGame, useStorage } from './heroes-harness';

// Classic mode's select in the original 3.1.21's layout (CharacterSelectBox.as, CharacterSkinMenu.as;
// our own drawing): the grid of portrait cells, the name box (the look's name in quotes, the hero,
// its game), the skin menu, touch on the cells, and the campaign's select unchanged.

useStorage();

function classicSelect(settings = defaultSettings()) {
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  return { h, sel, settings };
}

const cursorTo = (h: ReturnType<typeof makeGame>, sel: CharacterSelectScene, id: string) => {
  for (let i = 0; i < 40 && sel.chars[sel.cursor]?.id !== id; i++) h.tap('right');
  expect(sel.chars[sel.cursor]?.id).toBe(id);
};

describe('the original layout: grid, name box, ground', () => {
  it('every slot is a cell nine to a row, all on screen; the name box names the hero and its game', () => {
    const { sel } = classicSelect();
    expect(sel.classicLayout).toBe(true);
    expect(sel.rows).toBe(Math.ceil((sel.chars.length + 1) / SELECT_GRID.cols));
    for (let i = 0; i <= sel.chars.length; i++) {
      const c = sel.cellOf(i);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + SELECT_GRID.cell).toBeLessThanOrEqual(256);
      expect(c.y + SELECT_GRID.cell).toBeLessThan(140);
    }
    // A hero's own look: the hero and its game only (CharNameBox.changeText with no skin name).
    expect(sel.nameBoxLines()).toEqual(['MARIO', 'SUPER MARIO BROS.']);
    const t = draw(sel).texts;
    for (const x of t) expect(x.y + 8).toBeLessThanOrEqual(240);
    // The HUD on top names the hero under the cursor.
    expect(t.find((x) => x.y === 8 && x.x === 34)?.str).toBe('MARIO');
  });

  it("a skin's name in quotes over its hero, and the hero's game", () => {
    const settings = { ...defaultSettings(), classicSkins: { megaman: 'breakman' } };
    const { h, sel } = classicSelect(settings);
    cursorTo(h, sel, 'megaman');
    expect(sel.nameBoxLines()).toEqual(['"BREAK MAN"', 'MEGA MAN', 'MEGA MAN']);
    expect(h.said.at(-1)).toBe('Break Man, Mega Man, Mega Man');
    expect(draw(sel).texts.find((x) => x.y === 8 && x.x === 34)?.str).toBe('BREAK');
  });

  it('the Random cell is held still with Reduce flashing', () => {
    const { h, sel } = classicSelect();
    h.tap('left');
    h.game.ctx.reduceFlashing = true;
    const frames = new Set<string>();
    for (let i = 0; i < 80; i++) {
      h.step();
      for (const s of draw(sel).sprites) if (s.frame.startsWith('select-random')) frames.add(s.frame);
    }
    expect(frames.size).toBe(1);
  });
});

describe('the skin menu (CharacterSkinMenu)', () => {
  it('OK on a hero with looks opens it; arrows choose, said; BACK returns unchanged', () => {
    const { h, sel, settings } = classicSelect();
    cursorTo(h, sel, 'megaman');
    h.tap('jump');
    expect(sel.pickerOpen).toBe(true);
    expect(sel.pickerSkin).toBe(MEGAMAN);
    expect(h.said.at(-1)).toMatch(/^Choose a look for Mega Man\. Mega Man, Mega Man\. 10 looks\./);
    expect(sel.touchLabels()).toMatchObject({ jump: 'OK', attack: 'BACK' });
    // The original's skin order: Mega Man, Rock, Proto Man, Break Man, ...
    h.tap('right');
    h.tap('right');
    h.tap('right');
    expect(sel.pickerSkin).toBe(BREAKMAN_CLASSIC);
    expect(h.said.at(-1)).toBe('Break Man, Mega Man, Mega Man 3.');
    // The panel: titled with the look, the HUD follows it.
    const t = draw(sel).texts;
    expect(t.some((x) => x.str === 'BREAK MAN' && x.y === sel.pickerLayout?.titleY)).toBe(true);
    expect(t.find((x) => x.y === 8 && x.x === 34)?.str).toBe('BREAK');
    h.tap('attack');
    expect(sel.pickerOpen).toBe(false);
    expect(settings.classicSkins?.megaman).toBeUndefined();
    expect(h.top()).toBe(sel);
  });

  it('OK in it remembers the look and starts the run as it', () => {
    const { h, sel, settings } = classicSelect();
    cursorTo(h, sel, 'megaman');
    h.tap('jump');
    h.tap('right');
    h.tap('right');
    h.tap('right');
    h.tap('jump');
    expect(settings.classicSkins).toEqual({ megaman: 'breakman' });
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.game.state.character).toBe(BREAKMAN_CLASSIC);
  });

  it('touch: a tap moves to a cell, a tap on the cursor cell is OK; in the menu the same', () => {
    const { h, sel } = classicSelect();
    const at = sel.chars.findIndex((x) => x.id === 'megaman');
    const c = sel.cellOf(at);
    expect(sel.tapAt(c.x + 4, c.y + 4)).toBe(true);
    h.step();
    expect(sel.cursor).toBe(at);
    sel.tapAt(c.x + 4, c.y + 4);
    h.step();
    expect(sel.pickerOpen).toBe(true);
    const L = sel.pickerLayout;
    if (!L) throw new Error('no skin menu');
    const k = skinCell(3, L);
    sel.tapAt(k.x + 4, k.y + 4);
    h.step();
    expect(sel.pickerSkin).toBe(BREAKMAN_CLASSIC);
    sel.tapAt(k.x + 4, k.y + 4);
    h.step();
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.game.state.character).toBe(BREAKMAN_CLASSIC);
  });

  // G-053 (0.5.0): Mario has a second look now; Simon has one.
  it('a hero with one look (Simon): OK picks at once', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'simon');
    expect(h.game.skinsFor(sel.chars[sel.cursor] as CharacterDef)).toHaveLength(1);
    h.tap('jump');
    expect(sel.pickerOpen).toBe(false);
  });
});

describe('the campaign select is unchanged', () => {
  it('no grid, no tap handling, the standing row', () => {
    const h = makeGame();
    h.game.showCharacterSelect();
    const sel = h.top() as CharacterSelectScene;
    expect(sel.classicLayout).toBe(false);
    expect(sel.tapAt(20, 40)).toBe(false);
    expect(sel.slot(0).y).toBe(120);
  });
});
