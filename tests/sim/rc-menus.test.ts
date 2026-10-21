import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings } from '@engine/save/settings';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { TitleScene } from '@game/scenes/title';
import { MenuScene, type MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { CHARACTERS } from '@game/characters/registry';
import { saveLibrary } from '@game/level/library';
import { CardScene } from '@game/scenes/message';
import { CHAPTER1_GATE_CARD, CHAPTER1_LINK_CARD } from '@game/scenes/chapter1-gate';

// The 0.5.0 RC's title and menus batch (docs/classic/RC_AUDIT_0.5.0.md, addendum O-01..O-16, and
// RC-005..RC-007): each block names the item it checks.

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
  const sfx = vi.fn();
  const game = new Game({
    ctx: { assets, audio: { ...NULL_AUDIO, sfx }, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
    getLevel,
    characters: CHARACTERS,
    settings,
    applySettings: () => {},
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
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
  return { game, said, step, tap, idle, top, settings, sfx };
}
type H = ReturnType<typeof makeGame>;

const items = (m: unknown) => (m as { items: MenuItem[] }).items;
const cursor = (m: unknown) => (m as { index: number }).index;
const labels = (m: unknown) => items(m).map((i) => i.label);

/** Move the open menu's cursor to `label` and press OK. */
function pick(h: H, label: string): void {
  h.idle(8);
  const m = h.top();
  const row = labels(m).indexOf(label);
  expect(row, `${label} in ${labels(m).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let n = 0; cursor(h.top()) !== row && n < 40; n++) h.tap('down');
  h.tap('jump');
}

/** The finished title. */
function title(h: H): TitleScene {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  return h.top() as TitleScene;
}

/** Every string drawn this frame. */
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

describe('O-01: Custom levels moves from the title into Options', () => {
  it('the title has no Custom levels row; its Options lists Custom levels next to Level editor', () => {
    const h = makeGame();
    const t = title(h);
    expect(labels(t)).not.toContain('Custom levels');
    expect(drawn(h)).not.toContain('CUSTOM LEVELS');
    pick(h, 'Options');
    const o = labels(h.top());
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(o.indexOf('Custom levels')).toBeGreaterThan(-1);
    expect(o.indexOf('Custom levels')).toBe(o.indexOf('Level editor') - 1);
  });

  it('it opens over Options and Back returns to Options, announced', () => {
    const h = makeGame();
    title(h);
    pick(h, 'Options');
    const options = h.top();
    pick(h, 'Custom levels');
    expect(h.top()).toBeInstanceOf(MenuScene);
    expect(labels(h.top())).toEqual(['No levels yet', 'Back']);
    h.idle(4);
    h.tap('attack');
    expect(h.top()).toBe(options);
    expect(h.said.at(-1)).toContain('Custom levels');
  });

  it('a saved level goes to the select, with nothing of the menus left beneath', () => {
    saveLibrary({ v: 1, levels: { mine: 'x' } });
    const h = makeGame();
    title(h);
    pick(h, 'Options');
    pick(h, 'Custom levels');
    expect(labels(h.top())).toEqual(['mine', 'Back']);
    pick(h, 'mine');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.scenes.depth).toBe(1);
    expect(h.game.pendingLevel).toBe('custom-mine');
  });

  it("is never offered in Classic's options or in a game's Options (RC-027)", () => {
    const h = makeGame();
    for (const o of [
      new OptionsScene(h.game, () => {}, false, true),
      new OptionsScene(h.game, () => {}, true, true),
      new OptionsScene(h.game, () => {}, true),
    ]) {
      expect(labels(o)).not.toContain('Custom levels');
      expect(labels(o)).not.toContain('Level editor');
    }
  });
});

describe('O-02: the title row is "Campaign"', () => {
  it('reads Campaign, second; its card reads CAMPAIGN / CHAPTER 1 COMING SOON!, read out', () => {
    const h = makeGame();
    const t = title(h);
    expect(labels(t)).toEqual(['Classic', 'Campaign', 'Options']);
    expect(drawn(h)).toContain('CAMPAIGN');
    pick(h, 'Campaign');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(CHAPTER1_GATE_CARD.slice(0, 2)).toEqual(['CAMPAIGN', 'CHAPTER 1 COMING SOON!']);
    expect(CHAPTER1_LINK_CARD.slice(0, 2)).toEqual(['CAMPAIGN', 'CHAPTER 1 COMING SOON!']);
    expect(h.said.at(-1)).toMatch(/^CAMPAIGN CHAPTER 1 COMING SOON!/);
    for (const l of [...CHAPTER1_GATE_CARD, ...CHAPTER1_LINK_CARD]) expect(l.length).toBeLessThanOrEqual(28);
  });
});

describe('O-03: the gate card no longer says the save files are kept', () => {
  it('has no YOUR SAVE FILES ARE KEPT. line; the resume link card keeps its own line', () => {
    expect(CHAPTER1_GATE_CARD).not.toContain('YOUR SAVE FILES ARE KEPT.');
    expect(CHAPTER1_GATE_CARD).toEqual(['CAMPAIGN', 'CHAPTER 1 COMING SOON!', '', 'PLAY CLASSIC FOR NOW.']);
    expect(CHAPTER1_LINK_CARD).toContain('THIS RESUME LINK IS KEPT.');
    const h = makeGame();
    title(h);
    pick(h, 'Campaign');
    expect(h.said.at(-1)).not.toContain('SAVE FILES');
  });
});
