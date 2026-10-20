import { describe, expect, it, vi } from 'vitest';
import type { Action } from '@engine/input/actions';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { ScriptedInput } from '@game/sim/headless';
import { DevMenuScene } from '@game/scenes/dev';
import type { MenuItem } from '@game/scenes/menu';
import { makeGame, useStorage } from './heroes-harness';

// classic-patch-2 item 5: START (Escape on a keyboard) on a Dev menu toggle row leaves the menu
// and never flips the toggle; JUMP and left / right still do.

useStorage();

const items = (s: unknown): MenuItem[] => (s as { items: MenuItem[] }).items;

function open() {
  const h = makeGame({ dev: true });
  const settings = { ...defaultSettings(), dev: true };
  (h.game.deps as { settings?: Settings }).settings = settings;
  (h.game.deps as { applySettings?: () => void }).applySettings = vi.fn();
  const menu = new DevMenuScene(h.game);
  h.game.scenes.push(menu);
  const input = new ScriptedInput({ steps: [] });
  const press = (a: Action[]) => {
    input.setHeld(a);
    input.next();
    menu.update(input);
    input.setHeld([]);
    input.next();
    menu.update(input);
  };
  // Past the menu's opening wait.
  for (let i = 0; i < 8; i++) press([]);
  // Down to a toggle row.
  const at = (label: string) => {
    const want = items(menu).findIndex((i) => i.label === label);
    expect(want).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < want; i++) press(['down']);
  };
  return { h, settings, menu, press, at };
}

describe('Dev menu toggle rows and START / Escape', () => {
  it('START on the Yoshi mount row leaves the menu with the toggle unchanged', () => {
    const { h, settings, menu, press, at } = open();
    at('Classic: Yoshi mount');
    expect(settings.classicDev.yoshiMount).toBe(false);
    press(['start']);
    expect(settings.classicDev.yoshiMount).toBe(false);
    expect(h.game.scenes.top).not.toBe(menu);
  });

  it('START on a hero row leaves it on', () => {
    const { settings, press, at } = open();
    at('Classic: Yoshi');
    press(['start']);
    expect(settings.classicDev.heroesOff).toEqual([]);
  });

  it('JUMP and RIGHT still flip the toggle; START on a plain row still picks it', () => {
    const { h, settings, menu, press, at } = open();
    at('Classic: Yoshi mount');
    press(['jump']);
    expect(settings.classicDev.yoshiMount).toBe(true);
    press(['right']);
    expect(settings.classicDev.yoshiMount).toBe(false);
    expect(h.game.scenes.top).toBe(menu);
    press(['up']);
    press(['start']);
    // "Assists" opened over the Dev menu.
    expect(h.game.scenes.top).not.toBe(menu);
  });
});
