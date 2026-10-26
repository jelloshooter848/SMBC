import { describe, expect, it } from 'vitest';
import { loadProgress } from '@engine/save/progress';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { levelSelectTarget, worldName } from '@game/scenes/level-targets';
import type { MenuItem } from '@game/scenes/menu';
import { MAP_SETS, recordClassicBeat, type ClassicMenuScene } from '@game/scenes/original-game';
import { makeGame, useStorage, type H } from './heroes-harness';
import { choose as go } from './classic-files-nav';
import { isolateClassicRegistry } from './classic-registry';

// G-006: the Map Difficulty (B-L: chosen as a file starts, fixed for the file; the run is built
// for it and its beat status records it). G-007's Level Select cheat was removed in v0.4.73 (item 94).

isolateClassicRegistry({ hideExtras: true });
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const S = (h: H) => h.game.deps.settings as Settings;
const labels = (s: unknown) => items(s).map((i) => i.label);

function classic(over: Partial<Settings> = {}): H {
  return makeGame({ deps: { settings: { ...defaultSettings(), ...over }, applySettings: () => {} } });
}

const inLevel = (h: H) => h.top() instanceof LevelScene;
function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  return h.top() as LevelScene;
}
function choose(h: H, def: CharacterDef): void {
  h.until(() => h.top() instanceof CharacterSelectScene, 600);
  h.idle(12);
  const said = () => h.said.at(-1)?.split(', ')[0];
  for (let i = 0; i <= CHARACTERS.length && said() !== def.name; i++) h.tap('right');
  h.tap('jump');
}
/** Moves the cursor of the menu on top to `label` and presses OK. */
function pick(h: H, label: string): void {
  const at = labels(h.top()).indexOf(label);
  expect(at, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  // From where the cursor is (v0.4.73 item 53: a new file's rules box opens on START).
  const n = labels(h.top()).length;
  const from = (h.top() as unknown as { index: number }).index;
  for (let i = 0; i < (at - from + n) % n; i++) h.tap('down');
  h.tap('jump');
}

describe('G-006: Map Difficulty on the CLASSIC menu', () => {
  it('B-L: chosen as a file starts (its difficulty box), not on the set box; kept with the file', () => {
    const h = classic();
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(labels(menu)).toEqual([...MAP_SETS.map((m) => m.label), 'Back']);
    pick(h, 'Super Mario Bros.');
    pick(h, 'File 1');
    expect(labels(h.top())).toEqual(['Easy', 'Normal', 'Hard', 'Back']);
    expect(h.said.at(-1)).toMatch(/Choose the map difficulty; it is fixed for this file\. Normal/);
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Hard\. The original's harder version of every level/);
    h.tap('jump');
    pick(h, 'Start');
    choose(h, MARIO);
    expect(enterLevel(h).world.mapDifficulty).toBe('hard');
    // The shared setting is not the file's, and is left alone.
    expect(S(h).classicMapDifficulty).toBe('normal');
    for (const it of items(menu)) expect(`${it.label} ${it.hint ?? ''}`).not.toMatch(/\d-\d/);
  });

  it('a saved Campaign rules setting is ignored (BUG-11): a Hard file plays Hard', () => {
    const h = classic({ classicRules: 'current', dev: true });
    h.game.showClassicMenu();
    pick(h, 'Super Mario Bros.');
    pick(h, 'File 1');
    go(h, 'Hard');
    pick(h, 'Start');
    choose(h, MARIO);
    expect(enterLevel(h).world.mapDifficulty).toBe('hard');
  });

  it('under Campaign rules (a dev START page run) every level plays Normal; a beat counts as Normal', () => {
    const h = classic({ classicMapDifficulty: 'hard', dev: true });
    h.game.devClassicGame(MARIO, '1-1', 'current');
    const l = enterLevel(h);
    expect(l.world.mapDifficulty).toBe('normal');
    h.game.classicDev = false;
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(loadProgress().classicBeat?.smb).toBe('normal');
  });

  it('a run on Hard is built for it (1-1 has its Lakitu), and its beat is recorded as Hard', () => {
    const h = classic();
    h.game.showClassicMenu();
    pick(h, 'Super Mario Bros.');
    pick(h, 'File 1');
    go(h, 'Hard');
    pick(h, 'Start');
    choose(h, MARIO);
    const l = enterLevel(h);
    expect(h.game.ctx.mapDifficulty).toBe('hard');
    expect(l.world.mapDifficulty).toBe('hard');
    expect(l.world.level.entities.some((e) => e.type === 'lakitu')).toBe(true);
    recordClassicBeat('smb', h.game.classicDifficulty);
    expect(loadProgress().classicBeat?.smb).toBe('hard');
  });

  it('a campaign or free-play run never has one', () => {
    const h = classic({ classicMapDifficulty: 'hard' });
    h.game.newGame(MARIO, '1-1');
    const l = enterLevel(h);
    expect(h.game.ctx.mapDifficulty).toBeUndefined();
    expect(l.world.mapDifficulty).toBe('normal');
    expect(l.world.level.entities.some((e) => e.type === 'lakitu')).toBe(false);
  });
});

// v0.4.73 item 94: the Level Select cheat is gone; its level ids stay (the dev Level select, a
// CLEARED file's replay: level-targets.ts).
describe('level ids', () => {
  it('names worlds as the original (10-13 are A-D) and starts a level at its intro or first area', () => {
    const h = classic();
    expect([1, 9, 10, 13].map(worldName)).toEqual(['1', '9', 'A', 'D']);
    const lost = MAP_SETS.find((m) => m.id === 'lost');
    const smb = MAP_SETS.find((m) => m.id === 'smb');
    if (!lost || !smb) throw new Error('map sets');
    expect(levelSelectTarget(h.game, smb, 1, 2)).toBe('1-2-intro');
    expect(levelSelectTarget(h.game, lost, 9, 1)).toBe('ll-9-1-start');
    expect(levelSelectTarget(h.game, smb, 8, 4)).toBe('8-4');
  });
});
