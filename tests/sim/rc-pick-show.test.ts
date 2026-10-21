import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPRITES } from '@content/sprites';
import { defaultSettings } from '@engine/save/settings';
import type { AudioSink } from '@engine/audio/audio-manager';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import {
  LUIGI_COLUMN_X,
  MARIO_BLOCK,
  STAND_X,
  PICK_SHOWS,
  RYU_WALL_X,
  SIMON_BRICK_X,
  pickShow,
  pickShowFrames,
} from '@game/scenes/pick-show';
import { heroFor } from '@game/characters/registry';
import { shownPortrait } from '@game/characters/character';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// RC-007 and G-055 (docs/classic/RC_AUDIT_0.5.0.md, and QA's follow-up): the picked hero acts out
// the original's own pick move (each hero's chooseCharacter) on the select's ground, whole, with
// the select and name boxes closed as the original closes them, and the props the original adds:
// Mario's block, Luigi's brick column, Simon's bricks and pork chop, Samus's hole, Ryu's wall.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const idx = (s: CharacterSelectScene) => (s as unknown as { index: number }).index;

/** The Classic select with the cursor on slot hero `id` (in look `look`), OK pressed. */
function pickHero(id: string, look?: string): { h: H; sel: CharacterSelectScene; sounds: string[] } {
  const settings = { ...defaultSettings(), ...(look ? { classicSkins: { [id]: look } } : {}) };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  const sounds: string[] = [];
  (h.audio as unknown as AudioSink).sfx = vi.fn((s: string) => void sounds.push(s));
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  for (let i = 0; i < 40 && sel.chars[idx(sel)]?.id !== id; i++) h.tap(i % 12 === 11 ? 'down' : 'right');
  expect(sel.chars[idx(sel)]?.id).toBe(id);
  h.tap('jump');
  if (sel.pickerOpen) h.tap('jump');
  expect(sel.performing).toBe(true);
  return { h, sel, sounds };
}

/** Every frame of the performance's draws. */
function frames(h: H, sel: CharacterSelectScene, id: string, look = id) {
  const out: ReturnType<typeof draw>[] = [];
  for (let t = 0; t < pickShowFrames(id, look) - 4 && sel.performing; t++) {
    out.push(draw(sel));
    h.step();
  }
  return out;
}

const rows = (key: string, frame: string) => SPRITES[key.split('@')[0] as string]?.frames[frame] ?? [];
/** The hero's sprites (the picked look's sheet), below the HUD. */
const heroOf = (d: ReturnType<typeof draw>, sheet: string) =>
  d.sprites.filter((s) => s.key.split('@')[0] === sheet && s.y > 32);

describe('RC-007: the pick show is never clipped; the boxes close as in the original', () => {
  for (const id of Object.keys(PICK_SHOWS))
    it(`${id}: the whole hero acts inside the screen, with no select or name box over it`, () => {
      const { h, sel } = pickHero(id);
      const look = h.game.skinFor(sel.chars[idx(sel)]!);
      const sheet = shownPortrait(heroFor(look, 'classic')).sheet;
      let seen = 0;
      for (const d of frames(h, sel, id)) {
        // No name box: the hero's game is no longer written under the grid.
        expect(d.texts.some((t) => t.y > 100 && t.y < 200)).toBe(false);
        for (const s of heroOf(d, sheet)) {
          const r = rows(s.key, s.frame);
          if (!r.length) continue;
          seen++;
          expect(s.x, `${id} ${s.frame}`).toBeGreaterThanOrEqual(-24);
          expect(s.x + (r[0]?.length ?? 0), `${id} ${s.frame}`).toBeLessThanOrEqual(256 + 40);
          if (id !== 'samus') expect(s.y + r.length, `${id} ${s.frame}`).toBeLessThanOrEqual(208);
        }
      }
      expect(seen, id).toBeGreaterThan(5);
    });
});

describe("G-055: the original's own moves", () => {
  const all = (id: string, look?: string) => {
    const p = pickHero(id, look);
    const d = frames(p.h, p.sel, id, look);
    return { d, f: d.flatMap((x) => x.sprites.map((s) => s.frame)), sounds: p.sounds };
  };

  it('Mario: a full jump into an invisible block 4 tiles over his feet, which shows as used once hit', () => {
    const { d, f, sounds } = all('mario');
    expect(f).toContain('small-jump');
    expect(f).not.toContain('question-0');
    const first = d.findIndex((x) => x.sprites.some((s) => s.frame === 'used'));
    expect(first).toBeGreaterThan(5);
    const block = d[first]!.sprites.find((s) => s.frame === 'used')!;
    expect(block.x).toBe(MARIO_BLOCK.x);
    expect(block.y).toBeLessThanOrEqual(MARIO_BLOCK.y);
    expect(MARIO_BLOCK.y).toBe(208 - 64);
    expect(sounds).toContain('bump');
  });

  it('Luigi: walks right, then jumps at a 5-brick column 3 tiles to his right', () => {
    const { d, f, sounds } = all('luigi');
    expect(f.some((x) => /walk/.test(x))).toBe(true);
    expect(f).toContain('small-jump');
    const bricks = d[30]!.sprites.filter((s) => s.frame === 'brick' && s.x === LUIGI_COLUMN_X);
    expect(bricks.map((b) => b.y).sort((a, b) => a - b)).toEqual([128, 144, 160, 176, 192]);
    expect(LUIGI_COLUMN_X).toBe(176);
    expect(sounds).toContain('jump-small');
  });

  it('Simon: whips and crouch-whips two bricks to pieces, then walks right onto the pork chop', () => {
    const { d, f, sounds } = all('simon');
    for (const x of [
      'whip-0',
      'whip-1',
      'whip-leather',
      'crouch',
      'crouch-whip-leather',
      'brick-piece',
      'meat',
    ])
      expect(f, x).toContain(x);
    expect(d[0]!.sprites.filter((s) => s.frame === 'brick' && s.x === SIMON_BRICK_X)).toHaveLength(2);
    expect(d.at(-1)!.sprites.some((s) => s.frame === 'brick' || s.frame === 'meat')).toBe(false);
    expect(f.some((x) => /^walk-/.test(x))).toBe(true);
    expect(sounds.filter((s) => s === 'break')).toHaveLength(2);
    expect(sounds).toContain('whip');
  });

  it('Samus: the ground under her goes and she sinks through the hole on a platform', () => {
    const { d, f } = all('samus');
    expect(f).toContain('plank');
    const ys = d.map((x) => x.sprites.find((s) => s.frame === 'plank')?.y ?? 0);
    expect(ys.at(-1)!).toBeGreaterThan(ys[0]! + 40);
  });

  it('Bill: electrocuted in star-power colours, steady with Reduce flashing', () => {
    const p = pickHero('bill');
    (p.h.game.ctx as { reduceFlashing: boolean }).reduceFlashing = false;
    const d = frames(p.h, p.sel, 'bill');
    expect(d.some((x) => x.sprites.some((s) => s.key.includes('bill-star-')))).toBe(true);
    for (let t = 0; t < 40; t++) {
      const x = pickShow('shock', t, true);
      expect(x.dx).toBe(0);
      expect(x.flash).toBeUndefined();
    }
  });

  it('Ryu: jumps to a wall from the top of the screen to the ground', () => {
    const { d, f } = all('ryu');
    expect(f).toContain('jump');
    const wall = d[20]!.sprites.filter((s) => s.frame === 'hard' && s.x === RYU_WALL_X);
    expect(Math.min(...wall.map((w) => w.y))).toBeLessThanOrEqual(0);
    expect(Math.max(...wall.map((w) => w.y))).toBe(192);
  });

  it('Sophia: the hatch opens and Jason jumps out', () => {
    const { f } = all('sophia');
    for (const x of ['open', 'jason-jump', 'jason-stand']) expect(f).toContain(x);
  });

  it('Mega Man and his skins Proto Man and Break Man teleport once; Bass never does (RC-032)', () => {
    expect(all('megaman').sounds.filter((s) => s === 'mm-teleport')).toHaveLength(1);
    expect(all('bass').sounds).not.toContain('mm-teleport');
    for (const look of ['protoman', 'breakman']) {
      const p = all('megaman', look);
      expect(
        p.sounds.filter((s) => s === 'mm-teleport'),
        look,
      ).toHaveLength(1);
      // The beam: he rises out of sight.
      const ys = p.d.map((x) =>
        x.sprites.filter((s) => s.y > 32 && s.key.includes('megaman')).map((s) => s.y),
      );
      expect(ys.at(-1)!.length, look).toBe(0);
    }
    // Proto Man's whistle stands in for the choose music.
    expect(all('megaman', 'protoman').sounds).toContain('protoman-whistle');
  });

  it('Luigi clears the column and lands on top of it', () => {
    const tops = Array.from({ length: pickShowFrames('luigi') }, (_, t) => pickShow('column', t, false));
    const on = tops.find((x) => x.dy === -80 && STAND_X + x.dx + 6 > LUIGI_COLUMN_X && x.frame !== 'jump');
    expect(on).toBeDefined();
  });

  it('Ryu climbs the wall after grabbing it, up and out of sight', () => {
    const { f } = all('ryu');
    expect(f).toContain('climb-0');
    expect(f).toContain('climb-1');
    // 120 px/s (Ryu.as 554-563): a pixel a frame, steadily up the wall.
    const at = (t: number) => pickShow('cling', t, false).dy;
    expect(at(80) - at(60)).toBe(-20);
    expect(at(pickShowFrames('ryu') - 1)).toBeLessThan(at(40));
  });

  it('Bass holds right and jumps twice (his double jump)', () => {
    const { sounds } = all('bass');
    expect(sounds.filter((s) => s === 'jump-small')).toHaveLength(2);
    const xs = Array.from({ length: 60 }, (_, t) => pickShow('dashjump', t, false).dx);
    expect(xs[59]!).toBeGreaterThan(xs[10]!);
  });

  it('a Random pick shows the picked hero in the HUD during its show', () => {
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    h.idle(12);
    h.tap('down');
    h.tap('left');
    h.tap('jump');
    expect(sel.performing).toBe(true);
    const texts = draw(sel).texts.map((t) => t.str);
    expect(texts).not.toContain('RANDOM');
    const picked = h.said.find((x) => x.startsWith('Random: '))?.slice(8, -1) ?? '';
    expect(picked).not.toBe('');
    expect(texts).toContain(picked.toUpperCase());
  });
});
