import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHAPTER_GATE_CARD, MapMenu, WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import type { MenuItem } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import { findLevelNode } from '@game/map/rules';
import type { PageId } from '@game/map/types';
import type { Settings } from '@engine/save/settings';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ALL_STORY } from './story-seen';

// The Chapter 2 gate (docs/WORLD_MAP.md "The Chapter 2 gate"): until Chapter 2 ships, the campaign
// plays as before up to the Lost Kingdom's map pages, but entering any Lost Kingdom level from the
// map shows a card instead; the hero stays on the map and nothing is saved. Developer mode's map
// menu lifts it per file ("Chapter 2 gate: open"), only while dev mode is on. Play outside the
// campaign (dev select, ?level=) is not gated.

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
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn(), sfx: vi.fn() };
  const settings = { dev } as Settings;
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings,
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
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  const map = () => top() as WorldMapScene;
  return { game, said, settings, audio, step, tap, idle, until, top, map };
}
type H = ReturnType<typeof makeGame>;

const SMB = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
const SMB_PAGES = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);
const LL_PAGES = Array.from({ length: 13 }, (_, i) => `ll-${i + 1}`);

/**
 * A file with 8-4 beaten and every page open, standing on `levelId`'s node with that page's earlier
 * levels cleared (Toad's scenes seen).
 */
function fileAt(levelId: string, over: Partial<SaveFile> = {}): SaveFile {
  const f = findLevelNode(levelId);
  expect(f, levelId).not.toBeNull();
  const m = /^ll-(\d+)-(\d+)$/.exec(levelId);
  const before = m ? Array.from({ length: Number(m[2]) - 1 }, (_, i) => `ll-${m[1]}-${i + 1}`) : [];
  const s: SaveFile = {
    ...newSave(1, MARIO.id),
    cleared: ['1-0', ...SMB, ...before],
    pages: [...SMB_PAGES, 'hub', ...LL_PAGES] as PageId[],
    gameCleared: true,
    secrets: ['bonus-1'],
    story: [...ALL_STORY],
    position: { page: f!.page.id, node: f!.node.id },
    ...over,
  };
  writeSave(s);
  return s;
}

/** Opens the file in slot 1 as stored and waits until the map settles. */
function open(h: H) {
  h.game.openFile(1, loadSave(1) as SaveFile);
  h.until(() => h.top() instanceof WorldMapScene && h.map().mode === 'idle', 800);
  h.idle(8);
}

/** JUMP on the node underfoot: expects the gate's card over the map, nothing saved. */
function expectBlocked(h: H, levelId: string) {
  const map = h.map();
  const node = map.node;
  const before = store.get('smbc.save.1');
  h.said.length = 0;
  h.tap('jump');
  const card = h.top();
  expect(card, levelId).toBeInstanceOf(CardScene);
  expect((card as CardScene).lines).toEqual(CHAPTER_GATE_CARD);
  expect(h.said.join(' ')).toContain('THE PATH IS BLOCKED!');
  expect(h.said.join(' ')).toContain('COME BACK IN CHAPTER 2!');
  // The map stays beneath (drawn under the box), the level never starts.
  expect(h.game.scenes.depth).toBe(2);
  h.idle(40);
  h.tap('jump');
  expect(h.top()).toBe(map);
  expect(map.mode).toBe('idle');
  expect(map.node).toBe(node);
  expect(store.get('smbc.save.1')).toBe(before);
}

const menuItem = (scene: unknown, label: string): MenuItem | undefined =>
  (scene as { items: MenuItem[] }).items.find((i) => i.label === label);

describe('the Chapter 2 gate in the campaign', () => {
  it('blocks Lost 1-1 with the announced card; the hero stays on the map, can walk, save and quit', () => {
    const h = makeGame();
    fileAt('ll-1-1', { cleared: ['1-0', ...SMB], pages: [...SMB_PAGES, 'll-1'] });
    open(h);
    expect(h.map().page.id).toBe('ll-1');
    expectBlocked(h, 'll-1-1');
    // Still the player's map: the menu opens and Save and quit goes to the title.
    h.tap('start');
    expect(h.top()).toBeInstanceOf(MapMenu);
    menuItem(h.top(), 'Save and quit')?.select?.();
    expect(loadSave(1)?.position.page).toBe('ll-1');
    expect(loadSave(1)?.cleared).not.toContain('ll-1-1');
  });

  it('blocks a later Lost level, World 9 and the A-D worlds too', () => {
    for (const id of ['ll-5-2', 'll-9-1', 'll-10-1', 'll-13-4']) {
      const h = makeGame();
      fileAt(id);
      open(h);
      expectBlocked(h, id);
    }
  });

  it('leaves the Mushroom Kingdom alone: 8-4 still opens character select', () => {
    const h = makeGame();
    fileAt('8-4');
    open(h);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('an old file saved standing on a Lost page lands on the map there, and is blocked on entry', () => {
    const h = makeGame();
    const { devGateOpen: _, ...old } = fileAt('ll-3-2');
    store.set('smbc.save.1', JSON.stringify(old));
    open(h);
    expect(h.map().page.id).toBe('ll-3');
    expectBlocked(h, 'll-3-2');
  });

  it('nothing in the campaign gets round it: a level start into a Lost level goes back to the map', () => {
    const h = makeGame();
    fileAt('8-4');
    open(h);
    h.game.goToLevel('ll-1-1', { mode: 'stand' });
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(h.game.scenes.depth).toBe(2);
    h.game.startLevel(getLevel('ll-2-1'), { mode: 'stand' });
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(h.game.scenes.find((s) => s instanceof LevelScene)).toBeUndefined();
  });
});

describe('the dev lift: map menu "Chapter 2 gate"', () => {
  it('dev mode only: the row reads closed, opens the gate for the file (saved), and Lost 1-1 starts', () => {
    const h = makeGame(true);
    fileAt('ll-1-1');
    open(h);
    h.tap('start');
    const row = menuItem(h.top(), 'Chapter 2 gate');
    expect(row?.value?.()).toBe('closed');
    // Next to "Unlock all".
    const labels = (h.top() as unknown as { items: MenuItem[] }).items.map((i) => i.label);
    expect(labels.indexOf('Chapter 2 gate')).toBe(labels.indexOf('Unlock all') + 1);
    row?.adjust?.(1);
    expect(row?.value?.()).toBe('open');
    expect(loadSave(1)?.devGateOpen).toBe(true);
    h.game.scenes.pop();
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect((h.top() as LevelScene).level.id.startsWith('ll-1-1')).toBe(true);
  });

  it('closes again from the row', () => {
    const h = makeGame(true);
    fileAt('ll-1-1', { devGateOpen: true });
    open(h);
    h.tap('start');
    menuItem(h.top(), 'Chapter 2 gate')?.adjust?.(1);
    expect(loadSave(1)?.devGateOpen).toBe(false);
    h.game.scenes.pop();
    expectBlocked(h, 'll-1-1');
  });

  it('with dev mode off: no row, and a file left open is gated again', () => {
    const h = makeGame(false);
    fileAt('ll-1-1', { devGateOpen: true });
    open(h);
    h.tap('start');
    expect(menuItem(h.top(), 'Chapter 2 gate')).toBeUndefined();
    h.game.scenes.pop();
    expectBlocked(h, 'll-1-1');
    // The file's flag is kept for when dev mode is back on.
    expect(loadSave(1)?.devGateOpen).toBe(true);
  });
});

describe('outside the campaign nothing is gated', () => {
  it('the dev level select starts Lost 1-1', () => {
    const h = makeGame(true);
    h.game.devStart('ll-1-1', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene);
    expect((h.top() as LevelScene).level.id).toBe('ll-1-1');
  });

  it('?level= (a new game straight into a level) starts Lost A-1', () => {
    const h = makeGame();
    h.game.newGame(MARIO, 'll-10-1');
    h.until(() => h.top() instanceof LevelScene);
    expect((h.top() as LevelScene).level.id).toBe('ll-10-1');
  });
});
