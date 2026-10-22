import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { makeGame, useStorage, type H } from './heroes-harness';

// RC-041: no hint or spoken line still names the removed Classic rules row (BUG-11) or the
// Expansion heroes row (BUG-08). Every menu page reached from the CLASSIC title and the Dev menu
// is walked, with and without dev mode, and each row's label, value and hint is checked, along
// with everything said on the way.

useStorage();

const STALE =
  /Classic rules,|Classic rules row|Classic rules:|Expansion heroes row|Options > Expansion|Classic heroes page/i;
const items = (s: unknown): MenuItem[] => (s as { items?: MenuItem[] }).items ?? [];

function walk(h: H, texts: string[], depth = 0): void {
  const page = h.top() as MenuScene;
  for (const it of items(page)) {
    texts.push(it.label, it.hint ?? '', it.value?.() ?? '');
    if (depth >= 3 || it.label === 'Back' || !it.select) continue;
    if (/^(Dev mode off|Start|Again|World map|Open a file|Video, audio, controls|Enter code)$/.test(it.label))
      continue;
    const n = h.game.scenes.depth;
    try {
      it.select();
    } catch {
      continue;
    }
    if (h.game.scenes.depth > n && items(h.top()).length) walk(h, texts, depth + 1);
    while (h.game.scenes.depth > n) h.game.scenes.pop();
  }
}

describe('RC-041 no stale Rules or Expansion text', () => {
  for (const dev of [false, true])
    it(`the CLASSIC title, menu, options and the Dev menu (dev ${dev})`, () => {
      const settings: Settings = { ...defaultSettings(), dev };
      const h = makeGame({ deps: { settings, applySettings: () => {} } });
      const texts: string[] = [];
      h.game.showClassicTitle();
      texts.push(...items(h.top()).flatMap((i) => [i.label, i.hint ?? '']));
      h.game.showClassicMenu();
      walk(h, texts);
      if (dev) {
        h.game.showDevMenu();
        walk(h, texts);
      }
      texts.push(...h.said);
      const bad = texts.filter((t) => STALE.test(t));
      expect(bad).toEqual([]);
      expect(texts.length).toBeGreaterThan(20);
    });
});
