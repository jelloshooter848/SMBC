import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { Game } from '@game/scenes/game';
import { PauseScene } from '@game/scenes/pause';
import { CHARACTERS } from '@game/characters/registry';
import { defaultSettings, loadSettings, saveSettings, type TouchMode } from '@engine/save/settings';
import type { LastInput } from '@engine/input/touch-logic';
import type { MenuItem } from '@game/scenes/menu';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** The pause menu's Touch controls row, with settings saved on every change like main.ts. */
function touchRow(last: LastInput) {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const settings = defaultSettings();
  const applied: TouchMode[] = [];
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings,
    applySettings: () => {
      saveSettings(settings);
      applied.push(settings.input.touch);
    },
    lastInput: () => last,
  });
  const pause = new PauseScene(game);
  const items = (pause as unknown as { items: MenuItem[] }).items;
  const row = items.find((i) => i.label === 'Touch controls');
  expect(row).toBeDefined();
  return { row: row as MenuItem, applied, settings };
}

describe('pause menu Touch controls row', () => {
  it('on touch, OK pressed again and again only toggles Auto and On (no lockout)', () => {
    const { row, applied } = touchRow('touch');
    for (let i = 0; i < 5; i++) row.select?.();
    for (let i = 0; i < 3; i++) row.adjust?.(-1);
    expect(applied).not.toContain('off');
    expect(applied.slice(0, 3)).toEqual(['on', 'auto', 'on']);
    expect(loadSettings().input.touch).not.toBe('off');
  });

  it('with a keyboard or gamepad it reaches Off, saved and shown at once', () => {
    const { row, applied } = touchRow('keys');
    row.select?.();
    expect(row.value?.()).toBe('On');
    row.select?.();
    expect(row.value?.()).toBe('Off');
    expect(applied).toEqual(['on', 'off']);
    expect(loadSettings().input.touch).toBe('off');
  });
});
