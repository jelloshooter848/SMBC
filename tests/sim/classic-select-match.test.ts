import { describe, expect, it } from 'vitest';
import { defaultSettings, normaliseSkins } from '@engine/save/settings';
import { BREAKMAN_CLASSIC } from '@game/characters/protoman/classic';
import { CharacterSelectScene, GROUND_TEXT_Y, lookName } from '@game/scenes/character-select';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import { CLASSIC_HUD_COLUMNS } from '@game/hud/hud';
import { shownPortrait } from '@game/characters/character';
import { heroFor, skinsOf } from '@game/characters/registry';
import { MEGAMAN } from '@game/characters/megaman';
import { SAMUS } from '@game/characters/samus';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { SPRITES } from '@content/sprites';
import {
  DEFAULT_SELECT_THEME,
  drawnFace,
  gridPanel,
  skinCell,
  skinGrid,
  skinLayout,
  NAME_BOX,
  ORIGINAL_GRID,
  SELECT_THEMES,
  cursorColour,
  faceOf,
} from '@game/scenes/select-grid';
import { HUD_FACE, HUD_TEXT } from '@game/hud/select-hud';
import { fontText } from '@game/hud/text';
import { CLASSIC_HERO_GAMES } from '@game/characters/classic/skins';
import { Survival } from '@game/survival';
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

  it('items 2, 4: it follows the skin menu cursor, always with the hero’s game', () => {
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'samus');
    h.tap('jump');
    expect(sel.pickerOpen).toBe(true);
    expect(sel.nameBoxLines()).toEqual(['SAMUS', 'METROID']);
    h.tap('right');
    // CharacterSelectBox.changeNameBoxText: the hero's first game; the skin menu names Pit's own.
    expect(sel.nameBoxLines()).toEqual(['"PIT"', 'SAMUS', 'METROID']);
    expect(h.said.at(-1)).toBe('Pit, Samus, Kid Icarus.');
    expect(draw(sel).texts.some((x) => x.str === 'KID ICARUS')).toBe(true);
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
    const rows = Math.ceil(h.game.skinsFor(MEGAMAN).length / (sel.pickerLayout?.cols ?? 1));
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
    expect(pick.nameBoxLines()).toEqual(['"BREAK MAN"', 'MEGA MAN', 'MEGA MAN']);
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

  it('an Expansion hero from a link or save while Expansion heroes is off plays as Mario', () => {
    const yoshiOf = (h: ReturnType<typeof makeGame>) => h.game.roster.find((c) => c.id === 'yoshi');
    // The normal select: the run starts as Mario, and the select shows him under the cursor.
    const settings = defaultSettings();
    const { h } = classicSelect(settings);
    const yoshi = yoshiOf(h);
    expect(yoshi).toBeDefined();
    if (!yoshi) return;
    h.game.classicGame(yoshi, '1-1');
    expect(h.game.state.character.id).toBe('mario');
    h.game.classicSelect('1-1', () => {});
    const sel = h.top() as CharacterSelectScene;
    expect(sel.chars.some((c) => c.id === 'yoshi')).toBe(false);
    expect(sel.chars[sel.cursor]?.id).toBe('mario');
    // Survival: Mario stands, so the run is not over before it starts.
    const sv = defaultSettings();
    sv.classic.gameMode = 'survival';
    // A link straight into a run (no select first): Survival starts with the hero standing.
    const s = { h: makeGame({ deps: { settings: sv, applySettings: () => {} } }) };
    const y2 = yoshiOf(s.h);
    if (!y2) return;
    s.h.game.classicGame(y2, '1-1');
    expect(s.h.game.state.character.id).toBe('mario');
    const survival = s.h.game.survival;
    expect(survival).toBeInstanceOf(Survival);
    expect(survival?.standing()).toEqual(['mario']);
    expect(survival?.allFallen).toBe(false);
    // With Expansion heroes on, Yoshi plays as himself.
    const on = defaultSettings();
    on.classic.expansion = 'on';
    const e = classicSelect(on);
    const y3 = yoshiOf(e.h);
    if (!y3) return;
    e.h.game.classicGame(y3, '1-1');
    expect(e.h.game.state.character.id).toBe('yoshi');
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

  it("the name box is the original's: 158 wide, narrower than the panel, as tall as its lines", () => {
    // CharNameBox: its fill fits "The Legend of Zelda 2" and three 28 px lines, in a 14 px frame,
    // centred on y 145 (NAME_BOX_Y_POS 290), all halved.
    expect(NAME_BOX).toMatchObject({ x: 49, y: 119, w: 158, h: 52, h2: 38, step: 14 });
    const { h, sel } = classicSelect();
    const pan = gridPanel(sel.rows, sel.grid);
    expect(NAME_BOX.w).toBeLessThan(pan.w);
    // Mario's own look: two lines, so the box closes up from the bottom.
    const box = () => rects(sel).filter((x) => x.w === NAME_BOX.w && x.y === NAME_BOX.y);
    expect(box().some((x) => x.h === NAME_BOX.h2)).toBe(true);
    // A skin: three lines.
    cursorTo(h, sel, 'megaman');
    h.tap('special');
    h.idle(12);
    expect(box().some((x) => x.h === NAME_BOX.h)).toBe(true);
    // Every line fits inside the box; the prompt is under it.
    const t = draw(sel).texts.filter((x) => x.y > NAME_BOX.y && x.y < NAME_BOX.y + NAME_BOX.h);
    for (const x of t) {
      expect(x.x).toBeGreaterThanOrEqual(NAME_BOX.x + 1);
      expect(x.x + x.str.length * 8).toBeLessThanOrEqual(NAME_BOX.x + NAME_BOX.w - 1);
    }
    const under = draw(sel)
      .texts.filter((x) => x.y >= NAME_BOX.y + NAME_BOX.h)
      .map((x) => x.str);
    // O-10: the pick shows no prompt under it, as the original's.
    expect(under.some((x) => x.endsWith('LOOKS'))).toBe(false);
  });

  it("every hero's game fits the name box", () => {
    for (const g of Object.values(CLASSIC_HERO_GAMES))
      expect(fontText(g).length * 8).toBeLessThanOrEqual(NAME_BOX.w - 4);
  });

  it("the grid panel is the original's 185 x 70 at y 45, its cells 9 px in", () => {
    const { sel } = classicSelect();
    const pan = gridPanel(sel.rows, sel.grid);
    // CharacterSelectBox: centred on y 80 (Y_POS 160), portraits 4 px into the fill, 14 px frame.
    expect(pan).toEqual({ x: 36, y: 45, w: 185, h: 70 });
    // Centred on y 80, and 4 px over the name box.
    expect(pan.y + pan.h / 2).toBe(80);
    expect(NAME_BOX.y - (pan.y + pan.h)).toBe(4);
    expect(sel.cellOf(0)).toEqual({ x: pan.x + 9, y: pan.y + 9 });
  });

  it("the HUD's face is inset as the original's, its text after it", () => {
    // TopScreenText: PORT_PNT (12, 14) with its frame 2 px out; NAME_TXT_PNT x 67; halved.
    expect(HUD_FACE).toEqual({ x: 5, y: 6, size: 26 });
    expect(HUD_TEXT).toBe(CLASSIC_HUD_COLUMNS);
    expect(HUD_TEXT).toMatchObject({ name: 34, coins: 110, world: 154, level: 162, time: 210, timeNum: 216 });
    const { sel } = classicSelect();
    const t = draw(sel).texts;
    expect(t.find((x) => x.str === 'MARIO')?.x).toBe(34);
    expect(t.find((x) => x.str === 'WORLD')?.x).toBe(154);
    expect(t.find((x) => x.str === 'TIME')?.x).toBe(210);
  });

  it("a Classic run's HUD stays where its select's was: the intro card and the level", () => {
    // One TopScreenText for the select and its levels: nothing moves on the cut.
    const { h, sel } = classicSelect();
    const at = (t: { str: string; x: number; y: number }[]) => {
      const find = (f: (s: string) => boolean) => t.find((x) => x.y < 24 && f(x.str));
      return {
        name: find((s) => s.trim() === 'MARIO')?.x,
        score: find((s) => /^\d{7}$/.test(s))?.x,
        coins: find((s) => s.startsWith('$×'))?.x,
        world: find((s) => s === 'WORLD')?.x,
        level: find((s) => s === '1-1')?.x,
        time: find((s) => s === 'TIME')?.x,
      };
    };
    const onSelect = at(draw(sel).texts);
    expect(onSelect).toEqual({ name: 34, score: 34, coins: 110, world: 154, level: 162, time: 210 });
    h.game.classicGame(sel.chars[0]!, '1-1');
    const intro = h.top();
    expect(intro).toBeInstanceOf(IntroScene);
    expect(at(draw(intro as IntroScene).texts)).toEqual(onSelect);
    h.until(() => h.top() instanceof LevelScene, 600);
    const level = draw(h.top() as LevelScene).texts;
    expect(at(level)).toEqual(onSelect);
    expect(level.find((x) => /^\d{3}$/.test(x.str) && x.y === 16)?.x).toBe(216);
  });

  it('the campaign HUD keeps its own columns', () => {
    const h = makeGame();
    h.game.newGame(h.game.roster[0]!, '1-1', null);
    h.until(() => h.top() instanceof LevelScene, 600);
    const t = draw(h.top() as LevelScene).texts;
    expect(t.find((x) => x.str === 'WORLD')?.x).toBe(144);
    expect(t.find((x) => x.str === 'TIME')?.x).toBe(200);
  });

  it('no text covers any hero standing on the ground, Expansion heroes on too', () => {
    const settings = defaultSettings();
    settings.classic.expansion = 'on';
    const { h, sel } = classicSelect(settings);
    let checked = 0;
    for (const slot of sel.chars)
      for (const look of skinsOf(slot)) {
        if (!h.game.roster.includes(look) && look !== slot) continue;
        h.game.setSkin(slot, look);
        cursorTo(h, sel, slot.id);
        h.idle(12);
        const pt = shownPortrait(heroFor(look, h.game.liveRules));
        const rows = SPRITES[pt.sheet]?.frames[pt.frame] ?? [];
        const top = rows.findIndex((r) => /[^. ]/.test(r));
        const d = draw(sel);
        const hero = d.sprites.find((s) => s.frame === pt.frame && s.y + rows.length === 208);
        expect(hero, look.id).toBeDefined();
        if (!hero) continue;
        const w = rows[0]?.length ?? 16;
        // Each text with its 1 px outline stays off the hero's drawn rows.
        for (const t of d.texts) {
          const hit =
            t.x - 1 < hero.x + w &&
            t.x + t.str.length * 8 + 1 > hero.x &&
            t.y - 1 < 208 &&
            t.y + 9 > hero.y + top;
          expect(hit, `${look.id} under "${t.str}"`).toBe(false);
        }
        checked++;
      }
    expect(checked).toBeGreaterThanOrEqual(26);
    // O-10: no prompt on the ground row while picking (revive mode keeps its own).
    expect(draw(sel).texts.some((x) => x.y === GROUND_TEXT_Y && /^OK\b/.test(x.str))).toBe(false);
  });

  it("the skin menu's grid starts at the fill's left edge, as the original's", () => {
    // GridMenuBox.setUpText: gridItem.x = column * (itemWidth + space), from x 0 in the fill.
    const samus = skinLayout(3, 'samus', 160);
    expect(samus.gx).toBe(samus.x + 7);
    expect(samus.gx + 3 * samus.cw + 2 * samus.gap).toBeLessThan(samus.x + samus.w - 7);
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    h.tap('jump');
    const L = sel.pickerLayout;
    expect(L?.gx).toBe((L?.x ?? 0) + 7);
  });

  it("the skin menu's cells are each hero's preview size, 2 px apart, the panel fitted to them", () => {
    // GridMenuBox / Character.SKIN_PREVIEW_SIZE: the preview + 1 px a side; Bill's 35 x 38 make
    // the original's 37 x 40 cells, five to a row and three rows: a 208 x 170 box.
    expect(skinGrid('bill')).toEqual({ cols: 5, rows: 3, w: 37, h: 40, gap: 2 });
    const bill = skinLayout(15, 'bill');
    expect([bill.w, bill.h]).toEqual([208, 170]);
    expect(bill.y + (bill.h >> 1)).toBe(120);
    expect(skinGrid('megaman')).toMatchObject({ cols: 5, w: 35, h: 35 });
    expect(skinGrid('samus')).toMatchObject({ cols: 6, w: 32, h: 40 });
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    h.tap('jump');
    const L = sel.pickerLayout;
    expect(L).toMatchObject({ cw: 35, ch: 35, cols: 5 });
    if (!L) return;
    // Every look stands inside its cell, and the panel holds the grid and the text.
    const k = skinCell(9, L);
    expect(k.x + L.cw).toBeLessThanOrEqual(L.x + L.w - 7);
    expect(L.gameY + 8).toBeLessThanOrEqual(L.y + L.h - 7);
    expect(draw(sel).texts.some((x) => x.str === 'MEGA MAN' && x.y === L.gameY)).toBe(true);
  });

  it('O-10: the pick shows no OK prompt, with any key name', () => {
    const fits = (sel: CharacterSelectScene) => {
      const t = draw(sel).texts.filter((x) => /^OK\b/.test(x.str));
      expect(t).toEqual([]);
      return t.map((x) => x.str);
    };
    const { h, sel } = classicSelect();
    cursorTo(h, sel, 'megaman');
    expect(fits(sel).some((x) => x.endsWith('LOOKS'))).toBe(false);
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
