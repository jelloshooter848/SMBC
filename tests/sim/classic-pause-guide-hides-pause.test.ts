import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import { TutorialBoxScene } from '@game/tutorial/original-tutorials';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

/*
 * Item 131: while a hero's tutorial box (the Classic pause's Guide) is open, the pause box under
 * it is not drawn: only the level and the tutorial box. Closing it shows the pause again.
 */

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => ((m as { items: MenuItem[] }).items ?? []).map((i) => i.label);

function pick(h: H, label: string): void {
  const list = labels(h.top() as MenuScene);
  expect(list).toContain(label);
  h.idle(8);
  for (
    let i = 0;
    i < list.length && labels(h.top())[(h.top() as unknown as { index: number }).index] !== label;
    i++
  )
    h.tap('down');
  h.tap('jump');
}

function paused(reduceFlashing: boolean): H {
  const settings: Settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.ctx.reduceFlashing = reduceFlashing;
  h.game.classicGame(MARIO);
  h.until(() => h.top() instanceof LevelScene, 600);
  h.idle(4);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(PauseScene);
  return h;
}

const screen = (h: H) => draw(h.game.scenes).texts.map((t) => t.str.toUpperCase());

describe('item 131: the Classic pause box hides under its Guide tutorial box', () => {
  for (const reduce of [false, true])
    it(`the pause rows are not drawn while the box is open${reduce ? ' (Reduce flashing)' : ''}`, () => {
      const h = paused(reduce);
      h.idle(30); // the pause box grows open
      expect(screen(h)).toContain('CONTINUE');
      pick(h, 'Guide');
      expect(h.top()).toBeInstanceOf(TutorialBoxScene);
      for (let i = 0; i < 70; i++) {
        expect(screen(h)).not.toContain('CONTINUE');
        expect(screen(h)).not.toContain('GUIDE');
        h.idle(1);
      }
      // Closed (SKIP, past the box's guard): the pause box again.
      expect((h.top() as TutorialBoxScene).interactive).toBe(true);
      h.tap('attack');
      h.until(() => h.top() instanceof PauseScene, 120);
      h.idle(30);
      expect(screen(h)).toContain('CONTINUE');
    });
});
