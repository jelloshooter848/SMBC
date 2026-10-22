import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, SETTINGS_KEY, SETTINGS_VERSION } from '@engine/save/settings';
import {
  CONTROL_IDS,
  inside,
  layoutScreen,
  overlaps,
  type Insets,
  type Rect,
  type ScreenInput,
} from '@engine/input/touch-layout';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// 0.4.73 (owner, items 78-80): Options > Video's "Integer scale: ON/OFF" row is "Picture size:
// FILL / SHARP". FILL (integerScale false) fills the screen; SHARP (integerScale true) keeps
// whole pixels and may leave a border. A new player starts on FILL; saved settings keep their
// value (no migration, owner's choice B).

useStorage();
afterEach(() => store.clear());

const SPOKEN_HINT = 'Fill: bigger picture. Sharp: crisp, even pixels, may leave a border';

function game(): H {
  return makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
}

function openVideo(h: H): MenuScene {
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
  h.idle(8);
  h.tap('jump'); // Video is the first row
  return h.top() as MenuScene;
}

const items = (m: MenuScene) => (m as unknown as { items: MenuItem[] }).items;

describe('Picture size: the Options > Video row (item 78)', () => {
  it('is the first Video row, labelled Picture size, showing Fill for a new player', () => {
    const h = game();
    const video = openVideo(h);
    const row = items(video)[0] as MenuItem;
    expect(row.label).toBe('Picture size');
    expect(row.value?.()).toBe('Fill');
    expect(items(video).some((i) => /integer/i.test(i.label))).toBe(false);
  });

  it('says its name, its value and what Fill and Sharp mean', () => {
    const h = game();
    openVideo(h);
    expect(h.said.at(-1)).toBe(`Video. Picture size: Fill. ${SPOKEN_HINT}`);
  });

  it('switches Fill -> Sharp -> Fill, saying the new value, and sets integerScale', () => {
    const h = game();
    let applied = 0;
    h.game.deps.applySettings = () => void applied++;
    const s = h.game.deps.settings as ReturnType<typeof defaultSettings>;
    openVideo(h);
    h.idle(8);
    h.tap('right');
    expect(s.video.integerScale).toBe(true);
    expect(items(h.top() as MenuScene)[0]?.value?.()).toBe('Sharp');
    expect(h.said.at(-1)).toBe(`Picture size: Sharp. ${SPOKEN_HINT}`);
    h.idle(8);
    h.tap('left');
    expect(s.video.integerScale).toBe(false);
    expect(h.said.at(-1)).toBe(`Picture size: Fill. ${SPOKEN_HINT}`);
    expect(applied).toBe(2);
  });
});

describe('Picture size: FILL is the default (item 79), with no migration (item 80)', () => {
  it('fresh settings start on FILL', () => {
    expect(defaultSettings().video.integerScale).toBe(false);
    expect(loadSettings().video.integerScale).toBe(false); // nothing saved
  });

  it('a damaged settings file falls back to FILL', () => {
    store.set(SETTINGS_KEY, '{not json');
    expect(loadSettings().video.integerScale).toBe(false);
    store.set(SETTINGS_KEY, JSON.stringify({ v: SETTINGS_VERSION, video: { integerScale: 1 } }));
    expect(loadSettings().video.integerScale).toBe(false);
  });

  it('a saved file without the field gets FILL', () => {
    store.set(SETTINGS_KEY, JSON.stringify({ v: SETTINGS_VERSION, video: { palette: 'default' } }));
    expect(loadSettings().video.integerScale).toBe(false);
  });

  for (const v of [1, 2, SETTINGS_VERSION])
    for (const saved of [true, false])
      it(`a v${v} file saved with integerScale ${saved} keeps it`, () => {
        store.set(SETTINGS_KEY, JSON.stringify({ v, video: { integerScale: saved } }));
        expect(loadSettings().video.integerScale).toBe(saved);
      });
});

// --- The touch layouts with the new default (item 79) -------------------------------------

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

interface Phone {
  name: string;
  width: number;
  height: number;
  dpr: number;
  insets: Insets;
}

/** Common phones, each both ways up (insets as their browsers report them). */
const PHONES: Phone[] = [
  {
    name: '393x852 portrait',
    width: 393,
    height: 852,
    dpr: 3,
    insets: { ...NO_INSETS, top: 59, bottom: 34 },
  },
  { name: '393x852 portrait, no insets', width: 393, height: 852, dpr: 3, insets: NO_INSETS },
  {
    name: '852x393 landscape',
    width: 852,
    height: 393,
    dpr: 3,
    insets: { top: 0, left: 59, right: 59, bottom: 21 },
  },
  { name: '852x393 landscape, no insets', width: 852, height: 393, dpr: 3, insets: NO_INSETS },
  {
    name: '390x844 portrait',
    width: 390,
    height: 844,
    dpr: 3,
    insets: { ...NO_INSETS, top: 47, bottom: 34 },
  },
  {
    name: '844x390 landscape',
    width: 844,
    height: 390,
    dpr: 3,
    insets: { top: 0, left: 47, right: 47, bottom: 21 },
  },
  {
    name: '430x932 portrait',
    width: 430,
    height: 932,
    dpr: 3,
    insets: { ...NO_INSETS, top: 59, bottom: 34 },
  },
  {
    name: '932x430 landscape',
    width: 932,
    height: 430,
    dpr: 3,
    insets: { top: 0, left: 59, right: 59, bottom: 21 },
  },
  { name: '375x667 portrait', width: 375, height: 667, dpr: 2, insets: NO_INSETS },
  { name: '667x375 landscape', width: 667, height: 375, dpr: 2, insets: NO_INSETS },
  { name: '360x800 portrait', width: 360, height: 800, dpr: 3, insets: { ...NO_INSETS, top: 24 } },
  { name: '800x360 landscape', width: 800, height: 360, dpr: 3, insets: { ...NO_INSETS, left: 24 } },
  { name: '412x915 portrait', width: 412, height: 915, dpr: 2.625, insets: { ...NO_INSETS, top: 24 } },
  { name: '915x412 landscape', width: 915, height: 412, dpr: 2.625, insets: { ...NO_INSETS, left: 24 } },
  { name: '384x832 portrait', width: 384, height: 832, dpr: 2.8125, insets: { ...NO_INSETS, top: 24 } },
  { name: '832x384 landscape', width: 832, height: 384, dpr: 2.8125, insets: { ...NO_INSETS, left: 24 } },
];

function onPhone(p: Phone, integerScale: boolean, touchScale = 1): ScreenInput {
  return {
    width: p.width,
    height: p.height,
    insets: p.insets,
    dpr: p.dpr,
    integerScale,
    touch: true,
    touchScale,
  };
}

const right = (r: Rect) => r.x + r.w;
const bottom = (r: Rect) => r.y + r.h;

describe('Picture size: the default FILL picture leaves room for the touch controls', () => {
  const fill = defaultSettings().video.integerScale;

  it('the default is the FILL picture these layouts are checked with', () => {
    expect(fill).toBe(false);
  });

  for (const p of PHONES)
    for (const touchScale of [1, 1.3, 1.6])
      it(`${p.name}, touch size ${touchScale}: no control over the picture, all in the safe area`, () => {
        const l = layoutScreen(onPhone(p, fill, touchScale));
        const upright = p.height > p.width;
        // Upright phones always take the portrait layout; sideways ones the landscape layout,
        // or the centred one where the picture already clears the controls.
        if (upright) expect(l.mode).toBe('portrait');
        else expect(['landscape', 'centred']).toContain(l.mode);
        expect(inside(l.game, l.frame)).toBe(true);
        for (const id of CONTROL_IDS) {
          expect(overlaps(l.rects[id], l.game), `${id} over the picture`).toBe(false);
          expect(inside(l.rects[id], l.frame), `${id} in the safe area`).toBe(true);
        }
        if (upright) {
          // The picture sits wholly above the controls.
          const highest = Math.min(...CONTROL_IDS.map((id) => l.rects[id].y));
          expect(bottom(l.game)).toBeLessThanOrEqual(highest);
        } else if (l.mode === 'landscape') {
          // The d-pad on its left and the buttons on its right, beside the picture.
          expect(right(l.rects.dpad)).toBeLessThanOrEqual(l.game.x);
          expect(l.rects.jump.x).toBeGreaterThanOrEqual(right(l.game));
        }
      });

  for (const p of PHONES)
    it(`${p.name}: FILL is never smaller than SHARP, and SHARP keeps whole pixels`, () => {
      const f = layoutScreen(onPhone(p, false));
      const s = layoutScreen(onPhone(p, true));
      expect(f.game.w).toBeGreaterThanOrEqual(s.game.w - 1e-6);
      expect(f.game.h).toBeGreaterThanOrEqual(s.game.h - 1e-6);
      // SHARP: a whole number of device pixels per game pixel (the game is 256 wide).
      const perPixel = (s.game.w * p.dpr) / 256;
      expect(Math.abs(perPixel - Math.round(perPixel))).toBeLessThan(1e-6);
      for (const id of CONTROL_IDS) expect(overlaps(s.rects[id], s.game), `SHARP ${id}`).toBe(false);
    });
});
