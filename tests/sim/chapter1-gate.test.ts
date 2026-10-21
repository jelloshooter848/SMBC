import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings, SETTINGS_KEY } from '@engine/save/settings';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { TitleScene } from '@game/scenes/title';
import { FileSelectScene } from '@game/scenes/file-select';
import { LoadCodeScene } from '@game/scenes/save-codes';
import { CardScene } from '@game/scenes/message';
import { CARD_BOTTOM, CHAPTER1_GATE_CARD, CHAPTER1_LINK_CARD } from '@game/scenes/chapter1-gate';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import type { MenuItem } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { newSave, writeSave } from '@game/save/save-files';
import { encodeSaveCode } from '@game/save/save-code';

// 0.5.0 Classic remake, batch 1 (docs/classic/GAP_LIST_0.5.0.md section 9): the story campaign
// ("Chapter 1") is closed outside dev mode (G-100, G-101), every save is kept (G-102), and the
// title lists Classic first (G-112) with every hero in colour (G-111).

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame(dev = false) {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const settings = { ...defaultSettings(), dev };
  const clearSaveLink = vi.fn();
  const sfx = vi.fn();
  const game = new Game({
    ctx: { assets, audio: { ...NULL_AUDIO, sfx }, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
    getLevel,
    characters: CHARACTERS,
    settings,
    applySettings: () => {},
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    clearSaveLink,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    game.scenes.update([p1]);
    game.scenes.render(r);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const top = () => game.scenes.top;
  return { game, said, step, tap, idle, top, clearSaveLink, settings, sfx };
}
type H = ReturnType<typeof makeGame>;

/** A menu's rows and cursor (protected on MenuScene). */
const items = (m: unknown) => (m as { items: MenuItem[] }).items;
const cursor = (m: unknown) => (m as { index: number }).index;
const labels = (m: unknown) => items(m).map((i) => i.label);

/** The finished title, then DOWN to `label` and OK. */
function choose(h: H, label: string): void {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  const title = h.top() as TitleScene;
  const row = labels(title).indexOf(label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < row; i++) h.tap('down');
  h.tap('jump');
}

/** The card's lines as drawn (its box goes over the title, which keeps drawing beneath). */
function drawn(h: H): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      out.push(str);
    },
  });
  h.game.scenes.render(r);
  return out;
}

/** Some of everything the campaign keeps: two files, the progress record and the settings. */
function seedSaves(): Map<string, string> {
  writeSave({ ...newSave(1, 'mario'), freed: ['mario', 'luigi'], cleared: ['1-0', '1-1'] });
  writeSave({ ...newSave(3, 'link'), freed: ['mario', 'link', 'samus'] });
  store.set('smbc.progress', JSON.stringify({ v: 1, best: 'w3' }));
  store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), dev: false }));
  return new Map(store);
}

describe('G-112: the title menu', () => {
  it('lists Classic first, then Chapter 1 and Options (O-01: no Custom levels); Classic is highlighted', () => {
    const h = makeGame();
    h.game.showTitle();
    const title = h.top() as TitleScene;
    expect(labels(title)).toEqual(['Classic', 'Chapter 1', 'Options']);
    expect(cursor(title)).toBe(0);
    expect(h.said.at(-1)).toMatch(/Classic\. The original game, as it was$/);
  });

  it('with dev mode on, Dev mode is the fourth row and Chapter 1 is still second', () => {
    const h = makeGame(true);
    h.game.showTitle();
    expect(labels(h.top())).toEqual(['Classic', 'Chapter 1', 'Options', 'Dev mode']);
  });

  it("Chapter 1's hint says it is coming soon (outside dev mode), with no level numbers", () => {
    const h = makeGame();
    h.game.showTitle();
    const row = items(h.top())[1];
    expect(row?.hint).toBe('Coming soon');
  });
});

describe('G-100: Chapter 1 shows "COMING SOON!" outside dev mode', () => {
  it('the card goes over the title, is read out, and the file select never opens', () => {
    const h = makeGame();
    choose(h, 'Chapter 1');
    const card = h.top();
    expect(card).toBeInstanceOf(CardScene);
    expect((card as CardScene).lines).toEqual(CHAPTER1_GATE_CARD);
    expect(h.said.at(-1)).toBe(
      'CHAPTER 1 COMING SOON! PLAY CLASSIC FOR NOW. YOUR SAVE FILES ARE KEPT. OK to continue.',
    );
    expect(h.sfx).toHaveBeenCalledWith('bump');
    const text = drawn(h);
    for (const l of CHAPTER1_GATE_CARD.filter(Boolean)) expect(text).toContain(l);
    // The title keeps drawing beneath the box.
    expect(text).toContain('CLASSIC');
  });

  it('every line fits the box (28 columns)', () => {
    for (const l of [...CHAPTER1_GATE_CARD, ...CHAPTER1_LINK_CARD]) expect(l.length).toBeLessThanOrEqual(28);
  });

  it('it never moves on by itself; OK closes it back onto the title, on the same row', () => {
    const h = makeGame();
    choose(h, 'Chapter 1');
    const card = h.top();
    h.idle(600);
    expect(h.top()).toBe(card);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(cursor(h.top())).toBe(1);
  });

  it('MENU and BACK close it too', () => {
    for (const key of ['start', 'attack'] as const) {
      const h = makeGame();
      choose(h, 'Chapter 1');
      h.idle(40);
      h.tap(key);
      expect(h.top()).toBeInstanceOf(TitleScene);
    }
  });

  it('with dev mode on, Chapter 1 opens the file select as Start game did', () => {
    const h = makeGame(true);
    choose(h, 'Chapter 1');
    expect(h.top()).toBeInstanceOf(FileSelectScene);
  });

  it("with dev mode turned on, the row's hint names the story mode", () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    h.settings.dev = true;
    h.game.showTitle();
    expect(items(h.top())[1]?.hint).toBe('The story mode');
  });
});

describe('G-101: a resume link (#save=) outside dev mode', () => {
  it('shows the link card instead of loading; nothing is written and the link stays in the address', () => {
    const before = seedSaves();
    const h = makeGame();
    h.game.saveLink = encodeSaveCode({ ...newSave(2, 'mario'), freed: ['mario', 'luigi', 'link'] });
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines).toEqual(CHAPTER1_LINK_CARD);
    expect(h.said.at(-1)).toContain('THIS RESUME LINK IS KEPT.');
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
    // Asked once per page load; the address keeps the link (no clearSaveLink), nothing loaded.
    h.idle(60);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.clearSaveLink).not.toHaveBeenCalled();
    expect(new Map(store)).toEqual(before);
  });

  it('with dev mode on, the link asks which file to load it into, as before', () => {
    const h = makeGame(true);
    h.game.saveLink = encodeSaveCode({ ...newSave(2, 'mario'), freed: ['mario', 'luigi'] });
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    expect(h.top()).toBeInstanceOf(LoadCodeScene);
  });
});

describe('G-102: every campaign save is kept', () => {
  it('the title, the gate card and a Classic visit leave the files, progress and settings as they were', () => {
    const before = seedSaves();
    const h = makeGame();
    choose(h, 'Chapter 1');
    h.idle(40);
    h.tap('jump');
    h.game.showTitle();
    expect(new Map(store)).toEqual(before);
  });

  it('the files are all there again once the campaign opens (dev mode)', () => {
    seedSaves();
    const h = makeGame(true);
    choose(h, 'Chapter 1');
    expect(h.top()).toBeInstanceOf(FileSelectScene);
    expect(store.has('smbc.save.1')).toBe(true);
    expect(store.has('smbc.save.3')).toBe(true);
  });
});

describe('G-111: the title hero row', () => {
  it('outside dev mode every hero stands in colour, whatever the save files hold', () => {
    seedSaves();
    const h = makeGame();
    h.game.showTitle();
    const title = h.top() as TitleScene;
    expect(title.heroes.map((x) => x.def.id)).toEqual(CHARACTERS.map((c) => c.id));
    expect(title.heroes.every((x) => x.freed)).toBe(true);
  });

  it('with dev mode on (the campaign open) it shows the most advanced file, as before', () => {
    seedSaves();
    const h = makeGame(true);
    h.game.showTitle();
    const title = h.top() as TitleScene;
    expect(title.heroes.filter((x) => x.freed).map((x) => x.def.id)).toEqual(['mario', 'link', 'samus']);
  });
});

describe('G-100: the card sits clear of the title', () => {
  it('its box ends above the version line (y 228), so the build string stays readable', () => {
    const h = makeGame();
    choose(h, 'Chapter 1');
    const rects: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      rect(x: number, y: number, w: number, hh: number, c: string): void {
        rects.push({ x, y, w, h: hh, c });
      },
    });
    (h.top() as CardScene).render(r);
    const frame = rects.find((b) => b.x === 12 && b.c === '#fcfcfc');
    expect(frame).toBeDefined();
    expect((frame?.y ?? 0) + (frame?.h ?? 0)).toBe(CARD_BOTTOM);
    expect(CARD_BOTTOM).toBeLessThan(228);
  });
});
