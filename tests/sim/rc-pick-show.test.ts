import { afterEach, describe, expect, it } from 'vitest';
import { SPRITES } from '@content/sprites';
import { defaultSettings } from '@engine/save/settings';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { NAME_BOX } from '@game/scenes/select-grid';
import { PICK_SHOWS, pickShowFrames } from '@game/scenes/pick-show';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// RC-007 and G-055 (docs/classic/RC_AUDIT_0.5.0.md): the picked hero acts out its pick whole, on
// the select's ground as in the original (its select is a level, 9-1a, the hero on its ground),
// never cut off by a cell; with the real moves: Mario hits a block, Simon cracks his whip, Ryu
// clings to a wall and Jason hops out of Sophia.

useStorage();
afterEach(() => store.clear());

const idx = (s: CharacterSelectScene) => (s as unknown as { index: number }).index;

/** The Classic select with the cursor on slot hero `id`, OK pressed (and OK on its looks). */
function pickHero(id: string): { h: H; sel: CharacterSelectScene } {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  for (let i = 0; i < 40 && sel.chars[idx(sel)]?.id !== id; i++) h.tap(i % 12 === 11 ? 'down' : 'right');
  expect(sel.chars[idx(sel)]?.id).toBe(id);
  h.tap('jump');
  if (sel.pickerOpen) h.tap('jump');
  expect(sel.performing).toBe(true);
  return { h, sel };
}

/** Every frame of the performance's draws (the select's own, frame by frame). */
function frames(h: H, sel: CharacterSelectScene, id: string) {
  const out: ReturnType<typeof draw>[] = [];
  for (let t = 0; t < pickShowFrames(id) - 4 && sel.performing; t++) {
    out.push(draw(sel));
    h.step();
  }
  return out;
}

/** The art's height (rows) of `frame` in sheet `key` (a sheet id may carry its palette after a colon). */
function rows(key: string, frame: string): number {
  const sheet = SPRITES[key.split(/[:@]/)[0] as string] ?? SPRITES[key];
  return sheet?.frames[frame]?.length ?? 0;
}

describe('RC-007: the pick show is never clipped', () => {
  for (const id of Object.keys(PICK_SHOWS))
    it(`${id}: the whole hero acts on the ground, under the name box, inside the screen`, () => {
      const { h, sel } = pickHero(id);
      const hero = sel.chars[idx(sel)];
      const sheet = h.game.skinFor(hero!).portrait.sheet;
      let seen = 0;
      for (const d of frames(h, sel, id)) {
        for (const s of d.sprites.filter((x) => x.key.startsWith(sheet) && x.y > 100)) {
          const ht = rows(s.key, s.frame);
          if (!ht) continue;
          seen++;
          // Feet on the ground (y 208) or above it; Samus's platform sinks a little.
          expect(s.y + ht, `${id} ${s.frame}`).toBeLessThanOrEqual(208 + (id === 'samus' ? 10 : 0));
          expect(s.x, `${id} ${s.frame}`).toBeGreaterThanOrEqual(0);
          // The head stays below a hero's own two-line name box (Mega Man beams up and away).
          if (id !== 'megaman')
            expect(s.y, `${id} ${s.frame}`).toBeGreaterThanOrEqual(NAME_BOX.y + NAME_BOX.h2);
        }
      }
      expect(seen, id).toBeGreaterThan(10);
    });
});

describe('G-055: the real moves', () => {
  const all = (id: string) => {
    const { h, sel } = pickHero(id);
    return frames(h, sel, id).flatMap((d) => d.sprites.map((s) => s.frame));
  };

  it('Mario hops into a ? block over his head, which is used once hit', () => {
    const f = all('mario');
    expect(f).toContain('small-jump');
    expect(f).toContain('question-0');
    expect(f.indexOf('used')).toBeGreaterThan(f.indexOf('question-0'));
  });

  it('Simon cracks his whip: wind-up, swing and the lash', () => {
    const f = all('simon');
    for (const x of ['whip-0', 'whip-1', 'whip-leather']) expect(f).toContain(x);
  });

  it('Ryu jumps to a wall and clings to it', () => {
    const f = all('ryu');
    expect(f).toContain('hard');
    expect(f).toContain('jump');
    expect(f).toContain('cling');
  });

  it('Jason hops out of the open Sophia and lands beside it', () => {
    const f = all('sophia');
    expect(f).toContain('open');
    expect(f).toContain('jason-jump');
    expect(f).toContain('jason-stand');
  });

  it('the cells keep their faces while the hero performs (no art drawn in a cell)', () => {
    const { h, sel } = pickHero('simon');
    h.idle(20);
    const cellBottom = 54 + 2 * 28;
    const d = draw(sel);
    expect(d.sprites.some((s) => s.frame.startsWith('whip') && s.y < cellBottom)).toBe(false);
  });
});
