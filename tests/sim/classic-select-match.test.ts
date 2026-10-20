import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '@game/characters/protoman/classic';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { lookName } from '@game/scenes/character-select';
import {
  DEFAULT_SELECT_THEME,
  SELECT_THEMES,
  cursorColour,
  faceOf,
  gridCell,
} from '@game/scenes/select-grid';
import { HUD_FACE } from '@game/hud/select-hud';
import { draw, makeGame, useStorage } from './heroes-harness';

// Classic mode's select matched to the original 3.1.21 (owner's screenshots and
// scratchpad research of the original's interface skins; our own art): the looks as data, the
// cursor ring, readable text, the faces, the next level's sky and ground, and the review items.

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

/** WCAG contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const l = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (l[0] ?? 0) + 0.7152 * (l[1] ?? 0) + 0.0722 * (l[2] ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('the looks (the original follows its map skin)', () => {
  it('two looks as data, SMB NES by default; the cursor ring cycles every 8 frames, still with Reduce flashing', () => {
    expect(DEFAULT_SELECT_THEME).toBe(SELECT_THEMES['smb-nes']);
    expect(SELECT_THEMES['smb-nes'].fill).toBe('#c84c0c');
    expect(SELECT_THEMES.zelda2.fill).toBe('#5c94fc');
    const cyc = SELECT_THEMES['smb-nes'].cursor;
    const seen = new Set<string>();
    for (let t = 0; t < 48; t++) seen.add(cursorColour(cyc, t, false));
    expect(seen.size).toBe(new Set(cyc).size);
    for (let t = 0; t < 48; t++) expect(cursorColour(cyc, t, true)).toBe(cyc[0]);
  });

  it('item 1: every text line is outlined in black, at least 4.5:1 against either fill', () => {
    for (const th of Object.values(SELECT_THEMES))
      expect(contrast('#000000', th.fill)).toBeGreaterThanOrEqual(4.45);
    const { sel } = classicSelect();
    const t = draw(sel).texts.filter((x) => x.str === 'MARIO' && x.y > 100);
    // Four outline passes, the look's shadow, the text.
    expect(t.length).toBe(6);
  });
});

describe('the name box (CharNameBox) and the announcer', () => {
  it("item 3: a hero's own look has two lines; another look adds its name in quotes", () => {
    const { h, sel } = classicSelect();
    expect(sel.nameBoxLines()).toEqual(['MARIO', 'SUPER MARIO BROS.']);
    cursorTo(h, sel, 'protoman');
    expect(sel.nameBoxLines()).toEqual(['PROTO MAN', 'MEGA MAN 3']);
  });

  it('items 2, 4: it follows the skin menu cursor, with the look’s game', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'pit');
    h.tap('jump');
    expect(sel.pickerOpen).toBe(true);
    expect(sel.nameBoxLines()).toEqual(['PIT', 'KID ICARUS']);
    h.tap('right');
    expect(sel.nameBoxLines()).toEqual(['"DARK PIT"', 'PIT', 'KID ICARUS: UPRISING']);
    expect(h.said.at(-1)).toBe('Dark Pit, Pit, Kid Icarus: Uprising.');
  });

  it('item 7: look, hero, game; no repeat for a hero’s own look; the Skin key says the game', () => {
    expect(lookName(PROTOMAN_CLASSIC, PROTOMAN_CLASSIC)).toBe('Proto Man');
    expect(lookName(PROTOMAN_CLASSIC, BREAKMAN_CLASSIC)).toBe('Break Man, Proto Man');
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'protoman');
    expect(h.said.at(-1)).toBe('Proto Man, Mega Man 3');
    h.tap('special');
    expect(h.said.at(-1)).toBe('Break Man, Proto Man, Mega Man 3');
  });
});

describe('the skin menu', () => {
  it('item 6: it takes the grid’s place, so no cell shows behind or under it', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'protoman');
    expect(draw(sel).sprites.some((s) => s.frame.startsWith('select-random'))).toBe(true);
    h.tap('jump');
    expect(draw(sel).sprites.some((s) => s.frame.startsWith('select-random'))).toBe(false);
  });

  it('item 8: Down on a single row bumps, not moves right', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'protoman');
    h.tap('jump');
    expect(sel.pickerSkin).toBe(PROTOMAN_CLASSIC);
    h.tap('down');
    expect(sel.pickerSkin).toBe(PROTOMAN_CLASSIC);
    h.tap('right');
    h.tap('down');
    expect(sel.pickerSkin).toBe(BREAKMAN_CLASSIC);
  });
});

describe('item 5: faces', () => {
  it("the HUD and the cells show a hero's head doubled, its top inside the box; Random a ?", () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'protoman');
    h.tap('special');
    const d = draw(sel).sprites;
    const face = faceOf('protoman', 'idle');
    // The HUD face: Break Man's head's top row 1 px inside the box (not his feet, not a strip).
    const hud = d.find((s) => s.frame === 'idle' && s.y === HUD_FACE.y + 2 - face.top * 2);
    expect(hud).toBeDefined();
    h.tap('left');
    while (!sel.chars[sel.cursor]) h.tap('right');
    // Random: the "?" in the HUD box.
    for (let i = 0; i < 40 && sel.chars[sel.cursor]; i++) h.tap('left');
    const r = draw(sel).sprites.filter((s) => s.frame === 'select-random-0' && s.y < 24);
    expect(r.length).toBe(1);
    // Cells: the same doubled head.
    const at = sel.chars.indexOf(PROTOMAN_CLASSIC);
    const c = gridCell(at);
    expect(draw(sel).sprites.some((s) => s.frame === 'idle' && s.y === c.y + 2 - face.top * 2)).toBe(true);
  });
});

describe("the next level's sky and ground", () => {
  it("the select stands on the level ahead's theme (underground for 1-2)", () => {
    const { h, sel } = classicSelect();
    const theme = () => (sel as unknown as { groundTheme(): string }).groundTheme();
    expect(theme()).toBe(h.game.deps.getLevel('1-1').theme ?? 'overworld');
    h.game.selectLevel = '1-2';
    expect(theme()).toBe(h.game.deps.getLevel('1-2').theme);
  });
});
