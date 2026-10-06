import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings } from '@engine/save/settings';
import { ActionLabels } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import { Game, type ControlScheme } from '@game/scenes/game';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { OptionsScene, AssistOptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import { DevMenuScene } from '@game/scenes/dev';
import { GuideScene } from '@game/scenes/guide';
import { FileSelectScene } from '@game/scenes/file-select';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CHARACTERS } from '@game/characters/registry';
import { MENU_TOUCH_LABELS } from '@game/touch-labels';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** A button named by its letter ("A", "BUTTON B"): labels and captions never do that. */
const LETTER = /\b(BUTTON )?[ABC]\b/;
/**
 * The same in prose, where "a" is also the article: a letter or START/SELECT used as a button
 * ("press A", "B: back", "(B)", "A/Start", "push button B", "start to confirm").
 */
const PROSE = new RegExp(
  [
    String.raw`\b(button|press|push|tap|hold)\s+[abc]\b`,
    String.raw`\([abc]\)`,
    String.raw`\b[abc]\s*:`,
    String.raw`\b[abc]\s*\/`,
    String.raw`\/\s*[abc]\b`,
    String.raw`\b(press|push|tap)\s+(start|select)\b`,
    String.raw`\b(start|select)\s+(to|button)\b`,
  ].join('|'),
  'i',
);
/** The Lost Levels ending card keeps the owner's NES wording verbatim. */
const ALLOWED = new Set(['PUSH BUTTON B']);

const assets = { sheet: (name: string) => ({ name, frames: new Map() }) } as unknown as AssetRegistry;

function makeGame(scheme: ControlScheme) {
  return new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings: defaultSettings(),
    applySettings: () => undefined,
    controlScheme: () => scheme,
  });
}

/** Every string a scene draws (the menus' footers included). */
function drawn(scene: Scene, frames = 64): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      out.push(str);
    },
  });
  // Footers blink: draw at two phases.
  const s = scene as unknown as { t: number };
  for (const t of [0, frames]) {
    s.t = t;
    scene.render(r);
  }
  return out;
}

function menuTexts(m: MenuScene): string[] {
  const items = (m as unknown as { items: MenuItem[] }).items;
  return [m.title, ...items.flatMap((i) => [i.label, i.hint ?? '']), ...drawn(m)];
}

function clean(texts: string[]): string[] {
  return texts.filter((t) => t && !ALLOWED.has(t));
}

describe('player-facing text names abilities, never button letters', () => {
  it('ActionLabels', () => {
    for (const l of Object.values(ActionLabels)) {
      expect(l).not.toMatch(LETTER);
      expect(l).not.toMatch(PROSE);
    }
  });

  it('the guides, in every scheme and their footers (touch shows no keys at all)', () => {
    for (const c of CHARACTERS) {
      const g = c.guide;
      for (const ctl of g.controls) if (ctl.touch) expect(ctl.touch).not.toMatch(LETTER);
      const prose = [
        g.tagline,
        ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '']),
        ...g.powerups.map((x) => x.does),
        ...(g.belt ?? []).flatMap((x) => [x.name, x.does]),
        ...(g.tips ?? []),
      ];
      for (const t of prose) expect(t, c.name).not.toMatch(PROSE);
      const touch = new GuideScene(makeGame('touch'), c, () => {});
      for (const l of [...touch.text, touch.backHint]) expect(l, `${c.name}: ${l}`).not.toMatch(PROSE);
      expect(touch.backHint).toBe('BACK');
    }
  });

  it('menus, their hints and footers', () => {
    const game = makeGame('touch');
    const texts: string[] = [];
    game.showTitle();
    texts.push(...menuTexts(game.scenes.top as MenuScene));
    const options = new OptionsScene(game, () => game.scenes.pop());
    game.scenes.push(options);
    texts.push(...menuTexts(options));
    for (const label of ['Video', 'Audio', 'Controls', 'How to play']) {
      const it = (options as unknown as { items: MenuItem[] }).items.find((i) => i.label === label);
      it?.select?.();
      texts.push(...menuTexts(game.scenes.top as MenuScene));
      game.scenes.pop();
    }
    for (const m of [
      new PauseScene(game, null),
      new DevMenuScene(game),
      new AssistOptionsScene(game, () => undefined),
    ])
      texts.push(...menuTexts(m));
    texts.push(...drawn(new FileSelectScene(game)), ...drawn(new CharacterSelectScene(game)));
    for (const t of clean(texts)) expect(t, t).not.toMatch(PROSE);
    // The touch captions of every menu scene.
    for (const l of Object.values(MENU_TOUCH_LABELS)) if (l) expect(l).not.toMatch(LETTER);
    expect(texts).toContain('BACK');
  });

  it('with a keyboard the footers name the ability, then the real key', () => {
    const game = makeGame('keyboard');
    const options = new OptionsScene(game, () => undefined);
    expect(drawn(options)).toContain('BACK (X)');
    expect(drawn(new CharacterSelectScene(game))).toContain('PRESS OK (Z)');
  });
});
