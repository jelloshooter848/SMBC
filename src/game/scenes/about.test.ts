import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { defaultSettings } from '@engine/save/settings';
import { ScriptedInput } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { Game } from './game';
import { MENU_Y, type TitleScene } from './title';
import { OptionsScene } from './options';
import { AboutScene, ABOUT_LINES } from './about';
import { CreditsScene } from './credits';
import { TITLE_TIMING } from './title-anim';

/** 0.4.72 (owner, title option A): the minimal REMIX title and Options > About. */

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const assets = {
  sheet: (name: string, palette?: string) => ({ id: name, name, palette, image: null, frames: new Map() }),
} as unknown as AssetRegistry;

function makeGame(opts: { audio?: AudioSink; scheme?: 'keyboard' | 'touch' } = {}) {
  const said: string[] = [];
  const game = new Game({
    ctx: { assets, audio: opts.audio ?? NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    titleIntro: false,
  });
  game.deps.settings = defaultSettings();
  game.deps.applySettings = () => undefined;
  game.deps.controlScheme = () => opts.scheme ?? 'keyboard';
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const step = (a1: Action[] = []) => {
    p1.setHeld(a1);
    p2.setHeld([]);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  return { game, said, step, tap, idle };
}

function texts(scene: { render(r: Renderer): void }): { str: string; x: number; y: number }[] {
  const out: { str: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      out.push({ str, x, y });
    },
  });
  scene.render(r);
  return out;
}

const labels = (s: unknown) => (s as { items: { label: string }[] }).items.map((i) => i.label);
const indexOf = (s: unknown) => (s as { index: number }).index;

/** The title's Options, then its About row. */
function openAbout(h: ReturnType<typeof makeGame>): AboutScene {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  h.tap('down');
  h.tap('down');
  h.tap('jump'); // Options
  const options = h.game.scenes.top as OptionsScene;
  expect(options).toBeInstanceOf(OptionsScene);
  h.idle(6);
  const rows = labels(options);
  const at = rows.indexOf('About');
  while (indexOf(options) !== at) h.tap('down');
  h.tap('jump');
  const about = h.game.scenes.top as AboutScene;
  expect(about).toBeInstanceOf(AboutScene);
  h.idle(6);
  return about;
}

describe('the REMIX title, option A (minimal)', () => {
  it('is the logo, the three-row menu moved down, the heroes and the speaker: no credits, no version, no key label', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const title = h.game.scenes.top as TitleScene;
    const all = texts(title);
    const strs = all.map((x) => x.str);
    expect(strs.filter((s) => s !== '>' && s !== '')).toEqual(
      // Shadowed text draws twice (its shadow first).
      ['CLASSIC', 'CLASSIC', 'CAMPAIGN', 'CAMPAIGN', 'OPTIONS', 'OPTIONS'],
    );
    expect(all.find((x) => x.str === 'CLASSIC')?.y).toBe(MENU_Y + 1);
    expect(MENU_Y).toBe(118);
    // The third row ends well above the heroes' heads (the ground is y 208, heroes up to 32 tall).
    expect(MENU_Y + 2 * 12 + 8).toBeLessThan(208 - 32);
    expect(strs.some((s) => s.startsWith('('))).toBe(false);
  });

  it('SELECT still toggles the sound, and the title still says its key and keeps the credit', () => {
    const h = makeGame();
    h.game.showTitle();
    const said = h.said.at(-1) ?? '';
    expect(said).toContain(
      'Made by jelloshooter848. Based on Super Mario Bros. Crossover by Exploding Rabbit.',
    );
    expect(said).toMatch(/Sound on\. SOUND \(RIGHT SHIFT\) mutes it\./);
    h.idle(TITLE_TIMING.dropEnd + 10);
    h.tap('select');
    expect(h.game.deps.settings?.audio.muted).toBe(true);
    expect(h.said.at(-1)).toBe('Sound off.');
  });

  it('"DEV MODE UNLOCKED" flashes clear of the menu (on the ground row)', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const title = h.game.scenes.top as TitleScene;
    (title as unknown as { unlockedFlash: number }).unlockedFlash = 112; // an "on" frame of its blink
    const line = texts(title).find((x) => x.str === 'DEV MODE UNLOCKED');
    expect(line?.y).toBeGreaterThan(208);
  });
});

describe('Options > About', () => {
  it('is on the title Options, just above Back; not on the pause or world map Options', () => {
    const h = makeGame();
    const rows = labels(new OptionsScene(h.game, () => undefined));
    expect(rows.at(-2)).toBe('About');
    expect(rows.at(-1)).toBe('Back');
    expect(labels(new OptionsScene(h.game, () => undefined, true))).not.toContain('About');
    expect(labels(new OptionsScene(h.game, () => undefined, true, true))).not.toContain('About');
    expect(labels(new OptionsScene(h.game, () => undefined, false, true))).not.toContain('About');
  });

  it('shows the version, MADE BY and the Exploding Rabbit credit, with Credits and Back rows', () => {
    const h = makeGame();
    const about = openAbout(h);
    const strs = texts(about).map((x) => x.str);
    expect(strs).toContain('ABOUT');
    for (const [s] of ABOUT_LINES) if (s) expect(strs).toContain(s);
    expect(strs).toContain('MADE BY JELLOSHOOTER848');
    expect(strs).toContain('AND EXPLODING RABBIT');
    expect(strs).toContain(`VERSION ${__APP_VERSION__}`.toUpperCase());
    expect(labels(about)).toEqual(['Credits', 'Back']);
    // Every line fits the screen.
    for (const t of texts(about)) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.str.length * 8).toBeLessThanOrEqual(256);
    }
  });

  it('is announced: its text, the version and the focused row', () => {
    const h = makeGame();
    openAbout(h);
    const said = h.said.at(-1) ?? '';
    expect(said).toMatch(/^About\. Super Mario Bros\. Crossover: REMIX\. Made by jelloshooter848\./);
    expect(said).toContain('Jay Pavlina and Exploding Rabbit');
    expect(said).toContain(`Version ${__APP_VERSION__}.`);
    expect(said).toMatch(/Credits\. The full credits roll$/);
    h.tap('down');
    expect(h.said.at(-1)).toBe('Back');
  });

  it('Credits plays the credits roll; at its end, About again and the title theme', () => {
    const music: string[] = [];
    const audio: AudioSink = { ...NULL_AUDIO, playMusic: (id) => void music.push(id) };
    const h = makeGame({ audio });
    const about = openAbout(h);
    h.tap('jump');
    expect(h.game.scenes.top).toBeInstanceOf(CreditsScene);
    expect(music.at(-1)).toBe('credits');
    expect(h.said.at(-1)).toMatch(/^Credits\./);
    h.step(['start']); // faster
    let n = 0;
    while (h.game.scenes.top instanceof CreditsScene && n++ < 20000) h.tap('jump');
    expect(h.game.scenes.top).toBe(about);
    expect(music.at(-1)).toBe('title');
    expect(h.said.at(-1)).toBe('Credits. The full credits roll');
  });

  it('Back (the row or the BACK button) returns to Options', () => {
    const h = makeGame();
    openAbout(h);
    h.tap('attack');
    expect(h.game.scenes.top).toBeInstanceOf(OptionsScene);
    expect(h.said.at(-1)).toBe('About. Version and credits');
    h.tap('jump');
    h.idle(6);
    h.tap('down');
    h.tap('jump');
    expect(h.game.scenes.top).toBeInstanceOf(OptionsScene);
  });

  it('on touch: OK picks a row and BACK goes back', () => {
    const h = makeGame({ scheme: 'touch' });
    const about = openAbout(h);
    expect(about.touchLabels()).toMatchObject({ jump: 'OK', attack: 'BACK' });
  });
});
