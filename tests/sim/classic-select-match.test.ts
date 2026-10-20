import { describe, expect, it } from 'vitest';
import { defaultSettings, normaliseSkins } from '@engine/save/settings';
import { BREAKMAN_CLASSIC } from '@game/characters/protoman/classic';
import { CharacterSelectScene, lookName } from '@game/scenes/character-select';
import { MEGAMAN } from '@game/characters/megaman';
import { SAMUS } from '@game/characters/samus';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { SPRITES } from '@content/sprites';
import {
  DEFAULT_SELECT_THEME,
  drawnFace,
  NAME_BOX,
  ORIGINAL_GRID,
  SKIN_GRID,
  SELECT_THEMES,
  cursorColour,
  faceOf,
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
    cursorTo(h, sel, 'megaman');
    expect(sel.nameBoxLines()).toEqual(['MEGA MAN', 'MEGA MAN']);
  });

  it('items 2, 4: it follows the skin menu cursor, with the look’s game', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'samus');
    h.tap('jump');
    expect(sel.pickerOpen).toBe(true);
    expect(sel.nameBoxLines()).toEqual(['SAMUS', 'METROID']);
    h.tap('right');
    expect(sel.nameBoxLines()).toEqual(['"PIT"', 'SAMUS', 'KID ICARUS']);
    expect(h.said.at(-1)).toBe('Pit, Samus, Kid Icarus.');
  });

  it('item 7: look, hero, game; no repeat for a hero’s own look; the Skin key says the game', () => {
    expect(lookName(MEGAMAN, MEGAMAN)).toBe('Mega Man');
    expect(lookName(MEGAMAN, BREAKMAN_CLASSIC)).toBe('Break Man, Mega Man');
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    expect(h.said.at(-1)).toBe('Mega Man, Mega Man');
    h.tap('special');
    // SKIN steps to the next look in the original's skin order (Rock).
    expect(h.said.at(-1)).toBe('Rock, Mega Man, Mega Man');
  });
});

describe('the skin menu', () => {
  it('item 6: it takes the grid’s place, so no cell shows behind or under it', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    expect(draw(sel).sprites.some((s) => s.frame.startsWith('select-random'))).toBe(true);
    h.tap('jump');
    expect(draw(sel).sprites.some((s) => s.frame.startsWith('select-random'))).toBe(false);
  });

  it('item 8: Down on a single row bumps, not moves right', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    h.tap('jump');
    expect(sel.pickerSkin).toBe(MEGAMAN);
    // Mega Man's looks fill two rows, so Down moves a row; on the last it bumps.
    const rows = Math.ceil(h.game.skinsFor(MEGAMAN).length / SKIN_GRID.cols);
    for (let i = 0; i < rows - 1; i++) h.tap('down');
    const last = sel.pickerSkin;
    h.tap('down');
    expect(sel.pickerSkin).toBe(last);
  });
});

describe('item 5: faces', () => {
  it("the HUD box and the cells show the look's drawn face; Random a ?", () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    h.tap('special');
    const d = draw(sel).sprites;
    // The HUD box: Rock's face inside its 1 px frame; his cell too.
    expect(d.some((s) => s.frame === 'rock' && s.y === HUD_FACE.y + 1)).toBe(true);
    const c = sel.cellOf(sel.chars.findIndex((x) => x.id === 'megaman'));
    expect(d.some((s) => s.frame === 'rock' && s.y === c.y + 1)).toBe(true);
    // Random: the "?" in the HUD box.
    for (let i = 0; i < 40 && sel.chars[sel.cursor]; i++) h.tap('left');
    expect(draw(sel).sprites.filter((s) => s.frame === 'select-random-0' && s.y < 26).length).toBe(1);
    // A look with no drawn face would show its art's head doubled (faceOf finds its top row).
    expect(faceOf('megaman-classic', 'portrait').top).toBeGreaterThanOrEqual(0);
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

/** Every rectangle a render draws (the harness records only text and sprites). */
function rects(sel: CharacterSelectScene): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    rect(x: number, y: number, w: number, h: number): void {
      out.push({ x, y, w, h });
    },
  });
  sel.render(r);
  return out;
}

describe('the original roster, Expansion heroes and old saves', () => {
  it("the select is the original's eleven heroes and Random, in its order, two rows of six", () => {
    const { sel } = classicSelect();
    expect(sel.chars.map((c) => c.id)).toEqual([
      'mario',
      'luigi',
      'link',
      'samus',
      'simon',
      'megaman',
      'bass',
      'bill',
      'ryu',
      'sophia',
    ]);
    expect(sel.grid).toBe(ORIGINAL_GRID);
    expect(sel.grid.cols).toBe(6);
    expect(sel.rows).toBe(2);
    for (let i = 0; i <= sel.chars.length; i++) {
      const c = sel.cellOf(i);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + sel.grid.cell).toBeLessThanOrEqual(256);
    }
  });

  it('Expansion heroes on adds the heroes the original never had, after it', () => {
    const settings = defaultSettings();
    const { h, sel } = classicSelect(settings);
    for (const id of ['vicviper', 'warriors', 'arthur', 'yoshi'])
      expect(sel.chars.some((c) => c.id === id)).toBe(false);
    settings.classic.expansion = 'on';
    h.game.classicSelect('1-1', () => {});
    const on = h.top() as CharacterSelectScene;
    expect(on.chars.slice(10).map((c) => c.id)).toEqual(['vicviper', 'warriors', 'arthur', 'yoshi']);
    // Still no variant: they are skins in every case.
    for (const d of h.game.skinsFor(MEGAMAN).slice(1)) expect(on.chars).not.toContain(d);
  });

  it('an old save or link naming a look that had its own slot plays on, as that look', () => {
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicGame(BREAKMAN_CLASSIC, '1-1');
    expect(h.game.state.character).toBe(BREAKMAN_CLASSIC);
    expect(settings.classicSkins).toEqual({ megaman: 'breakman' });
    expect(h.game.skinFor(MEGAMAN)).toBe(BREAKMAN_CLASSIC);
    const pick = new CharacterSelectScene(h.game, {
      player: 0,
      current: BREAKMAN_CLASSIC,
      onPick: () => {},
      random: true,
    });
    pick.enter();
    expect(pick.chars[pick.cursor]).toBe(MEGAMAN);
    expect(pick.nameBoxLines()).toEqual(['"BREAK MAN"', 'MEGA MAN', 'MEGA MAN 3']);
  });

  it('skin choices saved on the old Proto Man, Pit and Francesca slots move to Mega Man and Samus', () => {
    expect(normaliseSkins({ protoman: 'breakman' })).toEqual({ megaman: 'breakman' });
    expect(normaliseSkins({ pit: 'darkpit' })).toEqual({ samus: 'darkpit' });
    expect(normaliseSkins({ francesca: 'doropie' })).toEqual({ megaman: 'doropie' });
    // A skin the host chose itself stays; the old slot's own look adds nothing.
    expect(normaliseSkins({ megaman: 'rock', protoman: 'breakman' })).toEqual({ megaman: 'rock' });
    expect(normaliseSkins({ megaman: 'megaman', protoman: 'breakman' })).toEqual({ megaman: 'breakman' });
    expect(normaliseSkins({ pit: 'pit' })).toBeUndefined();
    const settings = defaultSettings();
    settings.classicSkins = normaliseSkins({ protoman: 'breakman', pit: 'darkpit' }) ?? {};
    const { h } = classicSelect(settings);
    expect(h.game.skinFor(MEGAMAN).id).toBe('breakman');
    expect(h.game.skinFor(SAMUS).id).toBe('darkpit');
  });
});

describe("the select's backdrop and its name box", () => {
  it("it draws the next level's scenery over its sky, and none underground", () => {
    const { h, sel } = classicSelect();
    const scenery = () =>
      draw(sel).sprites.filter((s) => s.frame.startsWith('hill') || s.frame.startsWith('bush'));
    expect(scenery().length).toBeGreaterThan(0);
    h.game.selectLevel = '1-2';
    expect(scenery()).toEqual([]);
  });

  it('the name box grows open, at once with Reduce flashing', () => {
    const { h, sel } = classicSelect();
    const boxW = () =>
      Math.max(
        0,
        ...rects(sel)
          .filter((x) => x.y > 90 && x.h >= 8)
          .map((x) => x.w),
      );
    h.game.ctx.reduceFlashing = true;
    h.tap('right');
    expect(boxW()).toBe(NAME_BOX.w);
    h.game.ctx.reduceFlashing = false;
    h.tap('right');
    expect(boxW()).toBeLessThan(NAME_BOX.w);
    h.idle(10);
    expect(boxW()).toBe(NAME_BOX.w);
  });
});

describe('the original\u2019s rows, box and faces', () => {
  it('row 1 is Mario, Luigi, Link, Samus, Simon; row 2 Mega Man, Bass, Bill, Ryu, Sophia III and Random', () => {
    const { sel } = classicSelect();
    const row = (i: number) => sel.slot(i).y;
    for (let i = 1; i < 5; i++) expect(row(i)).toBe(row(0));
    for (let i = 5; i <= sel.chars.length; i++) expect(row(i)).toBe(row(5));
    expect(row(5)).toBeGreaterThan(row(0));
    // Each row starts at the grid's left (alignPortraits).
    expect(sel.cellOf(5).x).toBe(sel.cellOf(0).x);
    expect(sel.chars[5]?.id).toBe('megaman');
  });

  it('the name box is the original\u2019s 200 x 72 (400 x 150 halved), with our prompt in its bottom row', () => {
    const { sel } = classicSelect();
    const box = rects(sel).filter((x) => x.w === NAME_BOX.w && x.h === NAME_BOX.h);
    expect(box.length).toBeGreaterThan(0);
    const t = draw(sel).texts.map((x) => x.str);
    expect(t.some((x) => x.includes('TO PICK'))).toBe(true);
  });

  it('its prompt always fits inside the rivets, dropping a long key name', () => {
    const fits = (sel: CharacterSelectScene) => {
      const t = draw(sel).texts.filter((x) => /^OK\b/.test(x.str));
      expect(t.length).toBeGreaterThan(0);
      for (const x of t) {
        expect(x.x).toBeGreaterThanOrEqual(128 - NAME_BOX.w / 2 + 11);
        expect(x.x + x.str.length * 8).toBeLessThanOrEqual(128 + NAME_BOX.w / 2 - 11);
      }
      return t.map((x) => x.str);
    };
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    expect(fits(sel).some((x) => x.endsWith('LOOKS'))).toBe(true);
    const settings = defaultSettings();
    const keys = settings.input.bindings[0];
    if (keys) keys.keyboard.jump = ['NumpadEnter'];
    const long = classicSelect(settings);
    cursorTo(long.h, long.sel, 'megaman');
    fits(long.sel);
  });

  it('a game ending in a full stop is said with one ("Super Mario Bros.", not "Bros..")', () => {
    const { h, sel } = classicSelect();
    const mario = sel.chars[0]!;
    h.game.classicGame(mario, '1-1');
    const pick = new CharacterSelectScene(h.game, {
      player: 0,
      current: mario,
      onPick: () => {},
      random: true,
    });
    pick.enter();
    expect(h.said.at(-1)).toContain('Choose your hero. Mario, Super Mario Bros. Left');
    for (const x of h.said) expect(x).not.toContain('..');
  });

  it('every hero, skin and Expansion hero has its own drawn 24 x 24 face', () => {
    for (const id of [
      ...['mario', 'luigi', 'link', 'samus', 'simon', 'megaman', 'bass', 'bill', 'ryu', 'sophia'],
      ...['rock', 'protoman', 'breakman', 'cutman', 'fireman', 'iceman', 'francesca', 'doropie', 'rokko'],
      ...['pit', 'darkpit', 'peach', 'vicviper', 'warriors', 'arthur', 'yoshi'],
    ]) {
      const rows = SPRITES['select-faces']?.frames[id];
      expect(rows, id).toHaveLength(24);
      for (const r of rows ?? []) expect(r.length, id).toBe(24);
      expect(drawnFace(id)?.frame).toBe(id);
    }
  });

  it('every slot hero has its own drawn face in its cell and the HUD box', () => {
    const { h, sel } = classicSelect();
    const faces = () => draw(sel).sprites.filter((x) => x.key.startsWith('select-faces'));
    expect(faces().map((x) => x.frame)).toEqual(
      expect.arrayContaining([
        'mario',
        'luigi',
        'link',
        'samus',
        'simon',
        'megaman',
        'bass',
        'bill',
        'ryu',
        'sophia',
      ]),
    );
    // The HUD box (the cursor's hero) too: Mario in it and in his cell.
    expect(faces().filter((x) => x.frame === 'mario').length).toBe(2);
    // Each look has its own: Break Man's on Mega Man's slot.
    h.game.setSkin(MEGAMAN, BREAKMAN_CLASSIC);
    expect(faces().some((x) => x.frame === 'megaman')).toBe(false);
    expect(faces().some((x) => x.frame === 'breakman')).toBe(true);
  });
});
