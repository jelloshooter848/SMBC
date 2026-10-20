import { describe, expect, it } from 'vitest';
import { loadProgress, recordBeat, saveProgress } from '@engine/save/progress';
import { CLASSIC_CHEAT_IDS, defaultSettings, type Settings } from '@engine/save/settings';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CheatsScene } from '@game/scenes/cheats-menu';
import { LevelScene } from '@game/scenes/level';
import { LevelSelectScene, levelSelectTarget, worldName } from '@game/scenes/level-select-cheat';
import type { MenuItem } from '@game/scenes/menu';
import { MAP_SETS, recordClassicBeat, type ClassicMenuScene } from '@game/scenes/original-game';
import { PauseScene } from '@game/scenes/pause';
import { allUnlocked, unlockAll } from '@game/cheats';
import { makeGame, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// G-006: the Map Difficulty (CLASSIC menu: left and right on a map set; the run is built for it
// and its beat status records it). G-007: the Level Select cheat (Cheats.as:47; LevelSelectMenu.as;
// PauseMenu.as:37-38), unlocked by beating every map set on Hard or by the code.

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
  for (let i = 0; i < at; i++) h.tap('down');
  h.tap('jump');
}

describe('G-006: Map Difficulty on the CLASSIC menu', () => {
  it('its own row after the map sets (NewGameOptionsMenu.as:43), changed by left, right and OK, read out and saved', () => {
    const h = classic();
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(labels(menu)).toEqual([...MAP_SETS.map((m) => m.label), 'Map difficulty', 'Options', 'Back']);
    // The map set rows no longer change it.
    expect(items(menu)[0]?.adjust).toBeUndefined();
    const row = items(menu)[MAP_SETS.length] as MenuItem;
    expect(row.value?.()).toBe('Normal');
    h.idle(8);
    for (let i = 0; i < MAP_SETS.length; i++) h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Map difficulty: Normal\. Easy, Normal or Hard/);
    h.tap('right');
    expect(S(h).classicMapDifficulty).toBe('hard');
    expect(h.said.at(-1)).toMatch(/^Map difficulty: Hard/);
    // OK (CHANGE on a phone) steps it too.
    h.tap('jump');
    expect(S(h).classicMapDifficulty).toBe('easy');
    h.tap('left');
    expect(S(h).classicMapDifficulty).toBe('hard');
    h.tap('right');
    h.tap('right');
    expect(S(h).classicMapDifficulty).toBe('normal');
    expect(menu.touchLabels().jump).toBe('CHANGE');
    for (const it of items(h.top())) expect(`${it.label} ${it.hint ?? ''}`).not.toMatch(/\d-\d/);
  });

  it('under Current rules it shows Normal, says why and does not change; a beat counts as Normal', () => {
    const h = classic({ classicMapDifficulty: 'hard', classicRules: 'current' });
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    const row = items(menu)[MAP_SETS.length] as MenuItem;
    expect(row.value?.()).toBe('Normal');
    expect(row.hint).toMatch(/Classic rules only/);
    row.adjust?.(1);
    expect(S(h).classicMapDifficulty).toBe('hard');
    h.idle(8);
    h.tap('jump'); // Super Mario Bros.
    choose(h, MARIO);
    const l = enterLevel(h);
    expect(l.world.mapDifficulty).toBe('normal');
    h.game.classicDev = false;
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(loadProgress().classicBeat?.smb).toBe('normal');
  });

  it('a run on Hard is built for it (1-1 has its Lakitu), and its beat is recorded as Hard', () => {
    const h = classic({ classicMapDifficulty: 'hard' });
    h.game.showClassicMenu();
    h.idle(8);
    h.tap('jump');
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

describe('G-007: the Level Select cheat', () => {
  it('is locked at first: no row on the Cheats page or the Classic pause menu', () => {
    const h = classic();
    expect(S(h).classicCheats.levelSelect).toBe(false);
    h.game.scenes.push(new CheatsScene(h.game, () => h.game.scenes.pop(), { all: false }));
    expect(labels(h.top())).not.toContain('Level select');
    h.game.classicGame(MARIO, '1-1');
    enterLevel(h);
    h.game.scenes.push(new PauseScene(h.game, (h.top() as LevelScene).world));
    expect(labels(h.top())).not.toContain('Level select');
  });

  it('opens once every map set is beaten on Hard (StatManager.allMapPacksBeatOnHard)', () => {
    const h = classic();
    // Every set but the last: SMB and (G-020) Super Mario Bros. Special.
    let p = recordBeat(recordBeat(loadProgress(), 'smb', 'hard'), 'special', 'hard');
    saveProgress(p);
    p = loadProgress();
    // The last set is beaten on Hard at the end of a Classic run: its card follows.
    h.game.classicGame(MARIO, '1-1');
    h.game.classicRun = true;
    h.game.classicDev = false;
    h.game.classicDifficulty = 'hard';
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('ll-13-4');
    expect(S(h).classicCheats.levelSelect).toBe(true);
    const said: string[] = [];
    for (let i = 0; i < 20 && !said.some((s) => /Level Select/.test(s)); i++) {
      said.push(h.said.at(-1) ?? '');
      h.idle(30);
      h.tap('jump');
    }
    expect(said.some((s) => /^You unlocked the Level Select cheat!/.test(s))).toBe(true);
    expect(p.classicBeat?.smb).toBe('hard');
  });

  it('the code unlocks it too', () => {
    const c = defaultSettings().classicCheats;
    unlockAll(c);
    expect(c.levelSelect).toBe(true);
  });

  it('a save that entered the code before it existed gets Enter code back, and the code opens it', () => {
    // Every rule cheat unlocked by the code, from before the Level Select cheat (Cheats.allUnlocked
    // counts all 17 locks, its own too).
    const c = defaultSettings().classicCheats;
    for (const id of CLASSIC_CHEAT_IDS) c.unlocked[id] = true;
    expect(c.levelSelect).toBe(false);
    expect(allUnlocked(c)).toBe(false);
    const h = classic({ classicCheats: c });
    h.game.scenes.push(new CheatsScene(h.game, () => h.game.scenes.pop(), { all: false }));
    expect(labels(h.top())).toContain('Enter code');
    unlockAll(c);
    expect(allUnlocked(c)).toBe(true);
  });

  it("its Map difficulty is saved by Go only; Back leaves the CLASSIC menu's as it was", () => {
    const open = () => {
      const h = classic({ classicMapDifficulty: 'normal' });
      S(h).classicCheats.levelSelect = true;
      h.game.showClassicMenu();
      h.game.scenes.push(new LevelSelectScene(h.game, () => h.game.scenes.pop()));
      h.idle(8);
      h.tap('down');
      h.tap('right'); // Hard, on this page only
      h.tap('up'); // back to the top, for pick
      return h;
    };
    const back = open();
    expect(items(back.top())[1]?.value?.()).toBe('Hard');
    expect(S(back).classicMapDifficulty).toBe('normal');
    pick(back, 'Back');
    expect(S(back).classicMapDifficulty).toBe('normal');
    const go = open();
    expect(S(go).classicMapDifficulty).toBe('normal');
    pick(go, 'Go');
    expect(S(go).classicMapDifficulty).toBe('hard');
    expect(go.game.classicDifficulty).toBe('hard');
  });

  it('its page: Map set, Difficulty, World (A-D too), Level, Go, Back; Go starts a run there on that difficulty', () => {
    const h = classic();
    S(h).classicCheats.levelSelect = true;
    h.game.showClassicMenu();
    h.game.scenes.push(new CheatsScene(h.game, () => h.game.scenes.pop(), { all: false }));
    pick(h, 'Level select');
    const page = h.top() as LevelSelectScene;
    expect(page).toBeInstanceOf(LevelSelectScene);
    expect(labels(page)).toEqual(['Map set', 'Map difficulty', 'World', 'Level', 'Go', 'Back']);
    expect(h.said.at(-1)).toMatch(/^Level select\. Map set: SMB/);
    h.idle(8);
    h.tap('right'); // Super Mario Bros. Special (G-020)
    h.tap('right'); // The Lost Levels
    expect(items(page)[0]?.value?.()).toBe('Lost Levels');
    h.tap('down');
    h.tap('right'); // Hard
    h.tap('down');
    h.tap('left'); // World 13 (D)
    expect(items(page)[2]?.value?.()).toBe('D');
    h.tap('down');
    h.tap('right'); // Level 2
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Go: D-2/);
    h.tap('jump');
    choose(h, MARIO);
    const l = enterLevel(h);
    expect(l.level.id).toBe('ll-13-2');
    expect(h.game.classicRun).toBe(true);
    expect(h.game.classicDifficulty).toBe('hard');
    expect(l.world.mapDifficulty).toBe('hard');
  });

  it('from the Classic pause menu it goes on with the run (lives and score kept)', () => {
    const h = classic();
    S(h).classicCheats.levelSelect = true;
    h.game.classicGame(MARIO, '1-1');
    h.game.classicDev = false;
    let l = enterLevel(h);
    h.game.state.score = 12345;
    h.game.state.lives = 7;
    h.game.scenes.push(new PauseScene(h.game, l.world));
    pick(h, 'Level select');
    expect(h.top()).toBeInstanceOf(LevelSelectScene);
    h.idle(8);
    h.tap('down');
    h.tap('left'); // Easy
    h.tap('down');
    h.tap('right'); // World 2
    h.tap('down');
    h.tap('down');
    h.tap('jump'); // Go: 2-1
    l = enterLevel(h);
    expect(l.level.id).toBe('2-1');
    expect(h.game.state.score).toBe(12345);
    expect(h.game.state.lives).toBe(7);
    expect(l.world.mapDifficulty).toBe('easy');
  });

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
