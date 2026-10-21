import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { TitleScene } from '@game/scenes/title';
import type { ClassicTitleScene } from '@game/scenes/original-title';
import { CLASSIC_AT } from '@game/scenes/original-title';
import type { ClassicMenuScene } from '@game/scenes/original-game';
import { BOX_ROW_H, BOX_ROWS } from '@game/scenes/menu-box';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-02 (owner bug log on 0.4.68): going from the REMIX title to the CLASSIC title moved the
// "SMB CROSSOVER" logo down, and CLASSIC under it pushed the boxes down over the demo's ground
// and heroes. Now SMB and CROSSOVER stay exactly where the REMIX title has them, CLASSIC sits in
// the REMIX stamp's place, and every box over the demo ends above a hero standing on its ground.

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H {
  const settings = { ...defaultSettings(), ...over };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

/** The demo's ground top (1-1's floor, row 13) and a big hero's height on it. */
const GROUND_Y = 208;
const BIG_HERO_H = 32;
/** CLASSIC's art: 173 x 29; the REMIX stamp's: 92 x 44 at (160, 54) (title.ts). */
const CLASSIC = { w: 173, h: 29 };
const STAMP = { x: 160, y: 54, w: 92, h: 44 };

const logoParts = (sprites: { key: string; frame: string; x: number; y: number }[]) =>
  sprites
    .filter((s) => s.key === 'title-logo' && (s.frame === 'smb-tag' || s.frame.startsWith('cross-')))
    .map(({ frame, x, y }) => ({ frame, x, y }));

/** Every row's text in a box drawn by `scene` (the labels given), as drawn. */
function boxRows(scene: { render: (r: never) => void }, labels: string[]) {
  const t = draw(scene as never).texts;
  return labels.map((l) => t.find((x) => x.str === l.toUpperCase()));
}

describe('BUG-02 the CLASSIC title keeps the REMIX title’s logo place', () => {
  it('SMB and CROSSOVER are drawn exactly where the REMIX title draws them', () => {
    const h = classic();
    h.game.showTitle();
    const title = h.top() as TitleScene;
    for (let i = 0; i < 1000 && title.phase !== 'ready'; i++) h.idle(1);
    expect(title.phase).toBe('ready');
    const remix = logoParts(draw(title).sprites);
    expect(remix).toHaveLength(10);
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    // During the smash and after it.
    expect(logoParts(draw(ct).sprites)).toEqual(remix);
    ct.finishSmash();
    expect(logoParts(draw(ct).sprites)).toEqual(remix);
  });

  it('REMIX stands in its own place until CLASSIC lands there, inside the screen', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    const stamp = draw(ct).sprites.find((s) => s.frame === 'remix');
    expect(stamp).toMatchObject({ x: STAMP.x, y: STAMP.y });
    // CLASSIC ends where the stamp ends and is level with its middle.
    expect(CLASSIC_AT.x + CLASSIC.w).toBe(STAMP.x + STAMP.w);
    expect(Math.abs(CLASSIC_AT.y + CLASSIC.h / 2 - (STAMP.y + STAMP.h / 2))).toBeLessThanOrEqual(1);
    expect(CLASSIC_AT.x).toBeGreaterThanOrEqual(0);
    ct.finishSmash();
    expect(draw(ct).sprites.find((s) => s.frame === 'classic')).toMatchObject(CLASSIC_AT);
  });

  it('the Start box and the map set box sit under CLASSIC and above a hero on the ground', () => {
    const top = CLASSIC_AT.y + CLASSIC.h;
    const bottom = GROUND_Y - BIG_HERO_H;
    const check = (rows: ({ y: number } | undefined)[]) => {
      const ys = rows.map((r) => r?.y ?? NaN);
      expect(ys.every(Number.isFinite)).toBe(true);
      // Each row's text has its cell's padding over and under it (BOX_PAD 5 + 2).
      expect(Math.min(...ys) - 7).toBeGreaterThanOrEqual(top);
      expect(Math.max(...ys) + 8 + 7).toBeLessThanOrEqual(bottom);
    };
    for (const dev of [false, true]) {
      const h = classic(dev ? ({ dev: true, classicRules: 'current' } as Partial<Settings>) : {});
      h.game.showClassicTitle('start');
      check(boxRows(h.top() as never, ['Start', 'Options', 'Back']));
      h.game.showClassicMenu();
      const menu = h.top() as ClassicMenuScene;
      check(
        boxRows(menu as never, ['Super Mario Bros.', 'SMB Special', 'The Lost Levels', 'Options', 'Back']),
      );
    }
    // A full box is no taller than that room.
    expect(BOX_ROWS * BOX_ROW_H + 10).toBeLessThanOrEqual(bottom - top);
  });
});
