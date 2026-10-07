import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { MAP_PAGES, mapPage } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene, MAP_SLIDE_FRAMES } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { IntroScene } from '@game/scenes/intro';
import { MenuScene, type MenuItem } from '@game/scenes/menu';
import { TitleScene } from '@game/scenes/title';
import { CHARACTERS } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { newGameState } from '@game/context';
import { loadSave, newSave } from '@game/save/save-files';
import { clearLevel, isOpen, isPageOpen } from '@game/map/rules';
import type { Dir } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import type { Settings } from '@engine/save/settings';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame() {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = [], a2: Action[] = []) => {
    p1.setHeld(a);
    p2.setHeld(a2);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
    game.scenes.render(r);
  };
  const tap = (a: Action, player = 0) => {
    step(player === 0 ? [a] : [], player === 1 ? [a] : []);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const until = (pred: () => boolean, max = 1000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const map = () => game.scenes.top as WorldMapScene;
  // Past the tutorial: 1-0 (World 1's start node) is cleared, so 1-1 is open.
  game.mapProgress.cleared.push('1-0');
  return { game, said, step, tap, idle, until, map, audio };
}

const page = (w: number) => mapPage(`smb-${w}`) as WorldMapPage;

/** Direction of the first step of a tile path. */
function dirOf(points: [number, number][]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

/** Walk the hero from its node to `to` along the path between them. */
function walkTo(h: ReturnType<typeof makeGame>, to: string) {
  const m = h.map();
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q as { points: [number, number][] }).points].reverse();
  h.tap(dirOf(pts));
  expect(m.mode).toBe('walk');
  h.until(() => m.mode === 'idle');
  expect(m.node).toBe(to);
}

describe('world map scene', () => {
  it('walks start → 1-1 and cannot pass the locked 1-2', () => {
    const h = makeGame();
    h.game.showMap();
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    // Entering says the page and the node the hero stands on.
    expect(h.said).toContain(`World 1, ${page(1).title}. World 1-0, cleared`);
    h.idle(8);
    walkTo(h, '1-1');
    expect(h.said.at(-1)).toBe('World 1-1, open');
    expect(h.game.mapProgress.position).toEqual({ page: 'smb-1', node: '1-1' });
    const back = page(1).paths.find((p) => p.to === '1-1');
    const backDir = dirOf([...(back as { points: [number, number][] }).points].reverse());
    for (const d of ['left', 'right', 'up', 'down'] as Dir[]) {
      if (d === backDir) continue;
      h.tap(d);
      h.idle(40);
      expect(h.map().node).toBe('1-1');
      expect(h.map().mode).toBe('idle');
    }
  });

  it('jump on an open level node enters it through character select', () => {
    const h = makeGame();
    h.game.showMap('smb-1');
    h.idle(8);
    const enter = vi.spyOn(h.game, 'enterLevelFromMap');
    walkTo(h, '1-1');
    h.tap('jump');
    expect(enter).toHaveBeenCalledWith('1-1');
    expect(h.game.scenes.top).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('right'); // Mario → Luigi
    h.tap('jump');
    expect(h.game.scenes.top).toBeInstanceOf(IntroScene);
    expect(h.game.state.character).toBe(LUIGI);
    expect([h.game.state.world, h.game.state.stage]).toEqual([1, 1]);
  });

  it('start on a level node opens the map menu; only jump enters', () => {
    const h = makeGame();
    h.game.showMap('smb-1');
    h.idle(8);
    walkTo(h, '1-1');
    const enter = vi.spyOn(h.game, 'enterLevelFromMap');
    h.tap('start');
    expect(enter).not.toHaveBeenCalled();
    expect((h.game.scenes.top as MenuScene).title).toBe('MAP');
    h.idle(8);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBeInstanceOf(WorldMapScene);
    h.tap('jump');
    expect(enter).toHaveBeenCalledWith('1-1');
  });

  it('enterLevelFromMap starts at the intro scene when the level has one', () => {
    const h = makeGame();
    const go = vi.spyOn(h.game, 'goToLevel');
    h.game.showMap('smb-1');
    h.game.enterLevelFromMap('1-2');
    h.idle(12);
    h.tap('start');
    expect(go).toHaveBeenCalledWith('1-2-intro', { mode: 'stand' });
  });

  it('slides to World 2 along the open exit once the World 1 castle is cleared', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    for (const id of ['1-1', '1-2', '1-3', '1-4']) clearLevel(prog, id, getLevel);
    expect(prog.pages).toContain('smb-2');
    expect(prog.position).toEqual({ page: 'smb-1', node: '1-4' });
    h.game.showMap();
    h.idle(8);
    const exit = page(1).exits[0] as WorldMapPage['exits'][number];
    expect(h.map().node).toBe(exit.from);
    // The new place is saved once the slide is over (a file in play keeps it).
    const saved: unknown[] = [];
    vi.spyOn(h.game, 'autosave').mockImplementation(() => void saved.push({ ...prog.position }));
    h.tap(dirOf(exit.points));
    h.until(() => h.map().mode === 'slide', 400);
    h.idle(MAP_SLIDE_FRAMES - 1);
    h.until(() => h.map().mode === 'idle', 5);
    expect(h.map().page.id).toBe('smb-2');
    expect(h.map().node).toBe('start');
    expect(prog.position).toEqual({ page: 'smb-2', node: 'start' });
    expect(saved.at(-1)).toEqual({ page: 'smb-2', node: 'start' });
    expect(h.said).toContain(`World 2, ${page(2).title}. World 2 start`);
  });

  it('a locked exit does not slide', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    for (const id of ['1-1', '1-2', '1-3']) clearLevel(prog, id, getLevel);
    prog.position = { page: 'smb-1', node: '1-4' };
    h.game.showMap();
    h.idle(8);
    h.tap(dirOf((page(1).exits[0] as WorldMapPage['exits'][number]).points));
    h.idle(60);
    expect(h.map().page.id).toBe('smb-1');
  });

  it('draws in what a clear opened, then saves; any button skips', () => {
    const h = makeGame();
    const autosave = vi.spyOn(h.game, 'autosave');
    const reveal = clearLevel(h.game.mapProgress, '1-1', getLevel);
    expect(reveal).toContain('smb-1:1-2');
    h.game.showMap('smb-1', { reveal });
    expect(h.map().revealing).toBe(true);
    expect(h.map().node).toBe('1-1');
    h.until(() => !h.map().revealing, 600);
    expect(autosave).toHaveBeenCalledTimes(1);
    // Then it says what opened.
    expect(h.said.at(-1)).toBe('World 1-2, open, secret exit');

    const k = makeGame();
    const save2 = vi.spyOn(k.game, 'autosave');
    const r2 = clearLevel(k.game.mapProgress, '1-1', getLevel);
    k.game.showMap('smb-1', { reveal: r2 });
    k.idle(3);
    expect(k.map().revealing).toBe(true);
    k.tap('attack');
    expect(k.map().revealing).toBe(false);
    expect(save2).toHaveBeenCalledTimes(1);
    // Input works again right away: walk on to 1-2.
    walkTo(k, '1-2');
  });

  it('select opens the map menu; save and quit falls back to the title', () => {
    const h = makeGame();
    h.game.showMap('smb-1');
    h.idle(8);
    h.tap('select');
    const menu = h.game.scenes.top as MenuScene;
    expect(menu).toBeInstanceOf(MenuScene);
    expect(menu.title).toBe('MAP');
    h.idle(8);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBeInstanceOf(WorldMapScene);
    h.tap('start'); // start on the start node opens the menu too
    h.idle(8);
    h.tap('down'); // Worlds
    h.tap('down');
    h.tap('jump'); // Save and quit
    expect(h.game.scenes.top).toBeInstanceOf(TitleScene);

    const k = makeGame();
    const quit = vi.spyOn(k.game, 'saveAndQuit');
    k.game.showMap('smb-1');
    k.idle(8);
    k.tap('select');
    k.idle(8);
    k.tap('down');
    k.tap('down');
    k.tap('jump');
    expect(quit).toHaveBeenCalled();
  });

  it('each page reveals only its own world-qualified ids', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    for (const id of ['1-1', '1-2', '1-3']) clearLevel(prog, id, getLevel);
    const reveal = clearLevel(prog, '1-4', getLevel);
    const w1 = reveal.filter((id) => id.startsWith('smb-1:'));
    const w2 = reveal.filter((id) => id.startsWith('smb-2:'));
    expect(w1.length).toBeGreaterThan(0);
    expect(w2).toContain('smb-2:start');
    // World 1's page ignores World 2's ids ('start' is on both pages).
    h.game.showMap('smb-1', { reveal: w2 });
    expect(h.map().revealing).toBe(false);
    h.game.showMap('smb-1', { reveal });
    expect(h.map().revealing).toBe(true);
    h.until(() => !h.map().revealing, 600);
    // World 2's page draws in its start, path and first level, and says the level opened.
    h.game.showMap('smb-2', { reveal });
    expect(h.map().revealing).toBe(true);
    h.until(() => !h.map().revealing, 600);
    expect(h.said.at(-1)).toContain('World 2-1, open');
  });

  it('records the position on the page shown; a closed world falls back to the position', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    clearLevel(prog, '1-1', getLevel);
    h.game.showMap('smb-2'); // World 2 is not open
    expect(h.map().page.id).toBe('smb-1');
    expect(h.map().node).toBe('1-1');
    for (const id of ['1-2', '1-3', '1-4']) clearLevel(prog, id, getLevel);
    expect(prog.position).toEqual({ page: 'smb-1', node: '1-4' });
    h.game.showMap('smb-2');
    expect(h.map().page.id).toBe('smb-2');
    expect(prog.position).toEqual({ page: 'smb-2', node: 'start' });
  });

  it('back from the map hero pick returns to the map; picking stops the map music', () => {
    const h = makeGame();
    h.game.showMap('smb-1');
    const map = h.map();
    h.idle(8);
    walkTo(h, '1-1');
    h.tap('jump');
    expect(h.game.scenes.top).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('attack');
    expect(h.game.scenes.top).toBe(map);
    h.idle(8);
    h.tap('jump');
    h.idle(12);
    h.game.state.powerState = 'fire';
    h.audio.stopMusic.mockClear();
    h.tap('jump'); // keep Mario: his power stays
    expect(h.audio.stopMusic).toHaveBeenCalled();
    expect(h.game.scenes.top).toBeInstanceOf(IntroScene);
    expect(h.game.state.powerState).toBe('fire');
  });

  it('two players: player two picks too (or keeps theirs)', () => {
    const h = makeGame();
    h.game.state = newGameState(MARIO, LUIGI);
    h.game.state.powerState2 = 'big';
    h.game.showMap('smb-1');
    h.idle(8);
    walkTo(h, '1-1');
    h.tap('jump');
    const p1Pick = h.game.scenes.top;
    h.idle(12);
    h.tap('jump'); // P1 keeps Mario
    const p2Pick = h.game.scenes.top;
    expect(p2Pick).toBeInstanceOf(CharacterSelectScene);
    expect(p2Pick).not.toBe(p1Pick);
    h.idle(12);
    h.tap('right', 1); // Luigi → Link, on player two's own device
    h.tap('jump', 1);
    expect(h.game.scenes.top).toBeInstanceOf(IntroScene);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.character2).toBe(LINK);

    // Keeping player two's hero keeps their power.
    const k = makeGame();
    k.game.state = newGameState(MARIO, LUIGI);
    k.game.state.powerState2 = 'big';
    k.game.showMap('smb-1');
    k.idle(8);
    walkTo(k, '1-1');
    k.tap('jump');
    k.idle(12);
    k.tap('jump');
    k.idle(12);
    k.tap('jump', 1);
    expect(k.game.state.character2).toBe(LUIGI);
    expect(k.game.state.powerState2).toBe('big');
  });

  it('copes with a page without nodes and one without a start node', () => {
    const h = makeGame();
    const empty: WorldMapPage = { ...page(1), id: 'x-98', nodes: [], paths: [], exits: [], actors: [] };
    const noStart: WorldMapPage = {
      ...page(1),
      id: 'x-97',
      nodes: page(1).nodes.filter((n) => n.kind !== 'start'),
      exits: [],
    };
    MAP_PAGES.push(empty, noStart);
    try {
      h.game.mapProgress.pages.push('x-97', 'x-98');
      h.game.showMap('x-98');
      expect(h.map().page.id).toBe('x-98');
      expect(h.map().node).toBe('');
      h.idle(8);
      for (const a of ['left', 'right', 'up', 'down', 'jump'] as Action[]) h.tap(a);
      expect(h.map().mode).toBe('idle');
      h.game.showMap('x-97');
      expect(h.map().node).toBe(noStart.nodes[0]!.id);
      h.idle(8);
      h.tap('right');
      h.idle(60);
      expect(h.map().mode).toBe('idle');
    } finally {
      MAP_PAGES.splice(MAP_PAGES.indexOf(empty), 2);
    }
  });
});

describe('campaign saves from the map', () => {
  it('autosave writes the run and the map progress; save and quit saves then shows the title', () => {
    const h = makeGame();
    h.game.openFile(1, { ...newSave(1, 'luigi'), cleared: ['1-0'] });
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    expect(loadSave(1)?.position).toEqual({ page: 'smb-1', node: 'start' });
    h.idle(8);
    walkTo(h, '1-1');
    clearLevel(h.game.mapProgress, '1-1', getLevel);
    h.game.state.score = 4200;
    h.game.state.coins = 9;
    h.game.autosave();
    const saved = loadSave(1)!;
    expect(saved.cleared).toEqual(['1-0', '1-1']);
    expect(saved.position).toEqual({ page: 'smb-1', node: '1-1' });
    expect(saved.score).toBe(4200);
    expect(saved.character).toBe('luigi');
    h.game.state.lives = 7;
    h.tap('select');
    h.idle(8);
    h.tap('down'); // Worlds
    h.tap('down');
    h.tap('jump'); // Save and quit
    expect(h.game.scenes.top).toBeInstanceOf(TitleScene);
    expect(loadSave(1)!.lives).toBe(7);
    expect(h.game.campaign).toBeNull();
    // The file opens again where it was left.
    h.game.openFile(1);
    expect(h.map().node).toBe('1-1');
    expect(h.game.state.lives).toBe(7);
  });

  it('outside campaign mode autosave writes nothing', () => {
    const h = makeGame();
    h.game.showMap('smb-1');
    clearLevel(h.game.mapProgress, '1-1', getLevel);
    h.game.autosave();
    h.game.saveAndQuit();
    expect(store.size).toBe(0);
    expect(h.game.scenes.top).toBeInstanceOf(TitleScene);
  });
});

describe('developer mode: unlock all on the map', () => {
  const items = (scene: unknown) => (scene as { items: MenuItem[] }).items;
  const labels = (scene: unknown) => items(scene).map((i) => i.label);
  /** Opens the map menu and lets it take input. */
  const openMenu = (h: ReturnType<typeof makeGame>) => {
    h.tap('select');
    expect((h.game.scenes.top as MenuScene).title).toBe('MAP');
    h.idle(8);
    return h.game.scenes.top as MenuScene;
  };
  const worldsListed = (h: ReturnType<typeof makeGame>) => {
    const menu = openMenu(h);
    items(menu)
      .find((i) => i.label === 'Worlds')
      ?.select?.();
    const worlds = h.game.scenes.top as MenuScene;
    expect(worlds.title).toBe('WORLDS');
    const out = labels(worlds);
    h.game.scenes.pop();
    h.game.scenes.pop();
    return out;
  };

  it('toggles from the map menu, opens every level and world without clearing any, and saves', () => {
    const h = makeGame();
    const settings = { dev: true } as Settings;
    h.game.deps.settings = settings;
    h.game.openFile(1, { ...newSave(1, 'mario'), cleared: ['1-0'] });
    h.idle(8);
    walkTo(h, '1-1');
    let menu = openMenu(h);
    expect(labels(menu).at(-1)).toBe('Unlock all');
    expect(items(menu).at(-1)?.value?.()).toBe('off');
    h.tap('up'); // wraps to the last row
    h.tap('right');
    expect(items(menu).at(-1)?.value?.()).toBe('on');
    expect(h.said.at(-1)).toMatch(/^Unlock all: on\./);
    expect(loadSave(1)?.devUnlockAll).toBe(true);
    h.tap('attack'); // back to the map
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    h.idle(8);
    // Straight past the locked nodes to the castle, then back to 1-3 and in.
    walkTo(h, '1-2');
    walkTo(h, '1-3');
    walkTo(h, '1-4');
    expect(h.said.at(-1)).toBe('World 1-4 castle, open');
    walkTo(h, '1-3');
    const enter = vi.spyOn(h.game, 'enterLevelFromMap');
    h.tap('jump');
    expect(enter).toHaveBeenCalledWith('1-3');
    expect(h.game.mapProgress.cleared).toEqual(['1-0']);
    expect(h.game.mapProgress.pages).toEqual(['smb-1']);
    // Back on the map: the Worlds menu lists every world.
    h.game.showMap();
    h.idle(8);
    expect(h.map().node).toBe('1-3');
    // Unlock all opens the Lost Levels (the story's extension, listed with it) and the hub too.
    expect(worldsListed(h)).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `World ${w}`),
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D'].map((w) => `Lost ${w}`),
      'Warp Zone',
    ]);

    // Dev mode off: the row is gone and the map is back to normal, the hero on an open node.
    settings.dev = false;
    h.game.showMap();
    h.idle(8);
    expect(h.map().node).toBe('start');
    expect(isOpen(h.game.mapProgress, page(1), '1-2', h.game.mapUnlockAll)).toBe(false);
    menu = openMenu(h);
    expect(labels(menu)).toEqual(['Continue', 'Worlds', 'Save and quit', 'Options']);
    h.tap('attack');
    h.idle(8);
    expect(worldsListed(h)).toEqual(['World 1']);
    walkTo(h, '1-1');
    h.tap('up');
    h.idle(40);
    expect(h.map().node).toBe('1-1');
    // The file keeps the flag: dev mode on again unlocks again.
    expect(loadSave(1)?.devUnlockAll).toBe(true);
    settings.dev = true;
    expect(h.game.mapUnlockAll).toBe(true);
  });

  it('turning it off from a locked world goes back to the furthest open one', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: true } as Settings;
    h.game.openFile(1, newSave(1, 'mario'));
    h.idle(8);
    const menu = openMenu(h);
    items(menu).at(-1)?.adjust?.(1);
    h.game.travelToPage('smb-5');
    expect(h.map().page.id).toBe('smb-5');
    expect(isPageOpen(h.game.mapProgress, 'smb-5')).toBe(false);
    h.idle(8);
    const again = openMenu(h);
    h.tap('up');
    h.tap('jump'); // confirm toggles too
    expect(h.game.devUnlockAll).toBe(false);
    expect(h.map().page.id).toBe('smb-1');
    expect(h.map().node).toBe('start');
    expect(again.title).toBe('MAP');
    expect(loadSave(1)?.devUnlockAll).toBe(false);
    expect(loadSave(1)?.position).toEqual({ page: 'smb-1', node: 'start' });
  });
});
