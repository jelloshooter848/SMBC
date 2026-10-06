import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';
import { CreditsScene } from '@game/scenes/credits';
import { GameOverScene, GAME_OVER_CARD_FRAMES } from '@game/scenes/game-over';
import { TitleScene } from '@game/scenes/title';
import { FileSelectScene } from '@game/scenes/file-select';
import type { MenuScene, MenuItem } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { loadSave, newSave, writeSave, type SaveFile, type SaveSlot } from '@game/save/save-files';
import { isCleared, isExitOpen, isOpen, type Dir } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import type { WorldEvent } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import type { Settings } from '@engine/save/settings';

// Campaign mode: levels picked on the world map return to it when cleared, warps open their
// target world, game over continues on the map, and the save file follows along. Every other
// start (dev select, ?level=, custom, shared, editor playtest) behaves as before and never saves.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const saveKeys = () => [...store.keys()].filter((k) => k.startsWith('smbc.save.'));

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
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  const map = () => top() as WorldMapScene;
  const level = () => top() as LevelScene;
  /** Queue a world event in the running level and let the scene handle it. */
  const fire = (ev: WorldEvent) => {
    expect(top()).toBeInstanceOf(LevelScene);
    level().world.events.push(ev);
    step();
  };
  return { game, said, step, tap, idle, until, top, map, level, fire };
}
type H = ReturnType<typeof makeGame>;

const page = (w: number) => mapPage(w) as WorldMapPage;

/** A file in `slot` with `cleared` levels and `worlds` open, standing on `node` of `world`. */
function file(
  over: Partial<SaveFile> = {},
  slot: SaveSlot = 1,
  c1 = MARIO.id,
  c2: string | null = null,
): SaveFile {
  const s = { ...newSave(slot, c1, c2), ...over };
  writeSave(s);
  return s;
}

/** Direction of the first step of a tile path. */
function dirOf(points: [number, number][]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

/** Walk the hero along the open path from its node to `to`. */
function walkTo(h: H, to: string) {
  const m = h.map();
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q as { points: [number, number][] }).points].reverse();
  h.tap(dirOf(pts));
  h.until(() => m.mode === 'idle');
  expect(m.node).toBe(to);
}

/** From the map: enter `levelId` (character select, keep the hero) and play until it runs. */
function enter(h: H, levelId: string) {
  h.game.enterLevelFromMap(levelId);
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  h.tap('jump');
  if (h.game.state.character2) {
    h.idle(12);
    h.tap('jump', 1);
  }
  h.until(() => h.top() instanceof LevelScene);
}

/** Start a level of the campaign directly (as a pipe would), skipping the map and intro card. */
function play(h: H, levelId: string) {
  h.game.startLevel(getLevel(levelId), { mode: 'stand' });
  h.step();
}

function menuItem(scene: unknown, label: string): MenuItem | undefined {
  return (scene as { items: MenuItem[] }).items.find((i) => i.label === label);
}

/** Activate menu entry `label` (it must be there). */
function choose(scene: unknown, label: string) {
  const item = menuItem(scene, label);
  expect(item?.select).toBeDefined();
  item?.select?.();
}

/** Title → Start game → file 1 (empty) → 1 PLAYER or 2 PLAYERS: a new file. */
function newFileFromTitle(h: H, two = false) {
  h.game.showTitle();
  h.idle(8);
  h.tap('start');
  const fs = h.top() as FileSelectScene;
  expect(fs).toBeInstanceOf(FileSelectScene);
  h.idle(8);
  h.tap('jump');
  expect(fs.mode).toBe('players');
  if (two) h.tap('right');
  h.tap('jump');
}

/** Step until the level runs, counting the distinct character selects shown on the way. */
function picksUntilLevel(h: H, onPick: (n: number) => void): number {
  const seen = new Set<unknown>();
  for (let i = 0; i < 2000 && !(h.top() instanceof LevelScene); i++) {
    const t = h.top();
    if (t instanceof CharacterSelectScene && !seen.has(t)) {
      seen.add(t);
      h.idle(12);
      onPick(seen.size);
    } else h.step();
  }
  expect(h.top()).toBeInstanceOf(LevelScene);
  return seen.size;
}

describe('campaign: a new file picks heroes only on entering a level', () => {
  it('new 1P file → World 1 map with Mario; 1-1 asks once; picking Link makes the file and walker Link', () => {
    const h = makeGame();
    newFileFromTitle(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.scenes.depth).toBe(1);
    expect(h.map().page.world).toBe(1);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.character2).toBeNull();
    expect(h.game.state.lives).toBe(3);
    expect(loadSave(1)?.character).toBe('mario');
    h.idle(8);
    walkTo(h, '1-1');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.said.some((t) => /choose your hero\. Mario\./i.test(t))).toBe(true); // Mario preselected
    const picks = picksUntilLevel(h, () => {
      h.tap('right'); // Luigi
      h.tap('right'); // Link
      h.tap('jump');
    });
    expect(picks).toBe(1);
    expect(h.level().level.id).toBe('1-1');
    expect(h.game.state.character).toBe(LINK);
    // The file follows the pick at once (the file select portrait reads it).
    expect(loadSave(1)?.character).toBe('link');
    expect(loadSave(1)?.character2).toBeNull();
    // Back on the map, the walker is Link; reopening the file keeps him.
    h.game.returnToMap();
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.state.character).toBe(LINK);
    const again = makeGame();
    again.game.showTitle();
    again.idle(8);
    again.tap('start');
    again.idle(8);
    again.tap('jump');
    expect(again.top()).toBeInstanceOf(WorldMapScene);
    expect(again.game.state.character).toBe(LINK);
  });

  it('a hero change at the level select starts small; keeping the hero keeps its power', () => {
    const h = makeGame();
    h.game.openFile(1, file({ powerState: 'fire', position: { world: 1, node: '1-1' } }));
    expect(h.game.state.powerState).toBe('fire');
    enter(h, '1-1'); // keeps Mario
    expect(h.game.state.powerState).toBe('fire');
    h.game.returnToMap();
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    h.tap('right'); // Luigi
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(LUIGI);
    expect(h.game.state.powerState).toBe('small');
    expect(loadSave(1)?.powerState).toBe('small');
  });

  it("a 1P file's level select ignores player two's Start (no join line)", () => {
    const h = makeGame();
    newFileFromTitle(h);
    h.game.enterLevelFromMap('1-1');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(textsOver(h, 140).some((t) => t.startsWith('P2'))).toBe(false);
    const picks = picksUntilLevel(h, () => {
      h.tap('start', 1);
      expect(drawTexts(h).some((t) => t.startsWith('P2'))).toBe(false);
      h.tap('jump');
    });
    expect(picks).toBe(1);
    expect(h.game.state.character2).toBeNull();
    expect(h.game.state.lives).toBe(3);
    const saved = loadSave(1) as SaveFile;
    expect([saved.character, saved.character2, saved.lives]).toEqual(['mario', null, 3]);
  });

  it('new 2P file → map with Mario and Luigi, 5 lives; each level select picks both, in turn', () => {
    const h = makeGame();
    newFileFromTitle(h, true);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.scenes.depth).toBe(1);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.character2).toBe(LUIGI);
    expect(h.game.state.lives).toBe(5);
    expect(loadSave(1)?.character2).toBe('luigi');
    h.idle(8);
    walkTo(h, '1-1');
    h.tap('jump');
    const picks = picksUntilLevel(h, (n) => {
      if (n === 1) {
        h.tap('right');
        h.tap('right'); // P1 → Link
        h.tap('jump');
      } else {
        h.tap('jump', 0); // player one can't confirm player two's pick
        h.tap('right', 1); // P2: Luigi → Link
        h.tap('jump', 1);
      }
    });
    expect(picks).toBe(2);
    expect(h.game.state.character).toBe(LINK);
    expect(h.game.state.character2).toBe(LINK);
    expect(h.game.state.lives).toBe(5);
    const saved = loadSave(1) as SaveFile;
    expect([saved.character, saved.character2, saved.lives]).toEqual(['link', 'link', 5]);
  });

  /** The run and the save fields a level select could change. */
  const snapshot = (h: H) => {
    const s = h.game.state;
    const f = loadSave(1) as SaveFile;
    return {
      state: [s.character.id, s.powerState, s.character2?.id ?? null, s.powerState2, s.lives],
      save: [f.character, f.powerState, f.character2, f.powerState2, f.lives],
    };
  };

  it('back from the level select of a one-player file changes nothing', () => {
    const h = makeGame();
    h.game.openFile(1, file({ powerState: 'fire', lives: 4, position: { world: 1, node: '1-1' } }));
    h.idle(4);
    const before = snapshot(h);
    const map = h.top();
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    h.tap('right'); // P1 → Luigi
    h.tap('start', 1); // P2 can't join
    h.tap('attack'); // P1 backs out
    expect(h.top()).toBe(map);
    h.idle(4);
    expect(snapshot(h)).toEqual(before);
    expect(before.state).toEqual(['mario', 'fire', null, 'full', 4]);
  });

  it("back from player two's pick on a two-player file changes nothing", () => {
    const h = makeGame();
    const over: Partial<SaveFile> = {
      powerState: 'fire',
      powerState2: 'big',
      lives: 6,
      position: { world: 1, node: '1-1' },
    };
    h.game.openFile(1, file(over, 1, MARIO.id, LUIGI.id));
    h.idle(4);
    const before = snapshot(h);
    const map = h.top();
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    h.tap('right');
    h.tap('right'); // P1 → Link
    h.tap('jump');
    const p2Pick = h.top();
    expect(p2Pick).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('right', 1);
    h.tap('attack', 1); // P2 backs out
    expect(h.top()).toBe(map);
    h.idle(4);
    expect(snapshot(h)).toEqual(before);
    expect(before.state).toEqual(['mario', 'fire', 'luigi', 'big', 6]);
  });

  it('death and continue selects offer player two no join', () => {
    // A custom level's character select shows the join line (so its absence below means something).
    const m = makeGame();
    m.game.pendingLevel = '1-1';
    m.game.showCharacterSelect();
    expect(textsOver(m, 140)).toContain('P2 PRESS START TO JOIN');
    const opens = [(h: H) => h.game.respawn('1-1', { mode: 'stand' }), (h: H) => h.game.continueGame('1-1')];
    for (const open of opens) {
      const h = makeGame();
      h.game.newGame(MARIO, '1-1');
      open(h);
      expect(h.top()).toBeInstanceOf(CharacterSelectScene);
      expect(textsOver(h, 140).some((t) => t.startsWith('P2'))).toBe(false);
      h.tap('start', 1);
      expect(textsOver(h, 4).some((t) => t.startsWith('P2'))).toBe(false);
      h.tap('jump');
      h.until(() => h.top() instanceof LevelScene);
      expect(h.game.state.character2).toBeNull();
    }
  });
});

/** The texts the top scene draws now. */
function drawTexts(h: H): string[] {
  const texts: string[] = [];
  const r = Object.assign(new NullRenderer(), {
    text(_f: unknown, str: string): void {
      texts.push(str);
    },
  });
  h.top()?.render(r);
  return texts;
}

/** The texts the top scene draws over `n` frames. */
function textsOver(h: H, n: number): string[] {
  const texts: string[] = [];
  for (let i = 0; i < n; i++) {
    h.step();
    texts.push(...drawTexts(h));
  }
  return texts;
}

describe('campaign: clears return to the map', () => {
  it('new file → map → 1-1 → exit: back on the map with 1-2 drawn in, and the file saved', () => {
    const h = makeGame();
    h.game.openFile(1, newSave(1, MARIO.id));
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(loadSave(1)?.cleared).toEqual([]);
    h.idle(8);
    walkTo(h, '1-1');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.level().level.id).toBe('1-1');
    const s = h.game.state;
    s.score = 4200;
    s.coins = 13;
    h.level().world.player.powerState = 'fire';
    s.lives = 4;
    h.fire({ type: 'exit', next: '1-2-intro' });
    // Back to the map (not the next level), drawing in what the clear opened.
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.world).toBe(1);
    expect(h.map().node).toBe('1-1');
    expect(h.map().revealing).toBe(true);
    expect(isOpen(h.game.mapProgress, page(1), '1-2')).toBe(true);
    // Saved at once, with the run carried on.
    const saved = loadSave(1) as SaveFile;
    expect(saved.cleared).toEqual(['1-1']);
    expect(saved.position).toEqual({ world: 1, node: '1-1' });
    expect([saved.lives, saved.score, saved.coins, saved.powerState]).toEqual([4, 4200, 13, 'fire']);
    expect([s.lives, s.score, s.coins, s.powerState]).toEqual([4, 4200, 13, 'fire']);
    expect(s.checkpoint).toBeNull();
    h.until(() => h.map().mode === 'idle');
    walkTo(h, '1-2');
  });

  it('clearing 1-2 through its exit sub-area records 1-2', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    enter(h, '1-2');
    expect(h.level().level.id).toBe('1-2-intro');
    play(h, '1-2-exit');
    h.fire({ type: 'exit', next: '1-3' });
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.mapProgress.cleared).toEqual(['1-1', '1-2']);
    expect(loadSave(1)?.cleared).toEqual(['1-1', '1-2']);
    expect(h.map().node).toBe('1-2');
    expect(isOpen(h.game.mapProgress, page(1), '1-3')).toBe(true);
  });

  it('the castle (Toad) clear of 1-4 opens World 2 and shows World 1 drawing in the exit', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1', '1-2', '1-3'], position: { world: 1, node: '1-4' } }));
    enter(h, '1-4');
    h.fire({ type: 'exit', next: '2-1' });
    const m = h.map();
    expect(m).toBeInstanceOf(WorldMapScene);
    expect(m.page.world).toBe(1);
    expect(m.revealing).toBe(true);
    expect(h.game.mapProgress.worlds).toEqual([1, 2]);
    expect(loadSave(1)?.worlds).toEqual([1, 2]);
    expect(loadSave(1)?.cleared).toContain('1-4');
    // The reveal ends with the road to World 2.
    const exit = page(1).exits.find((e) => e.toWorld === 2);
    expect(exit).toBeDefined();
    expect(isExitOpen(h.game.mapProgress, page(1), exit!)).toBe(true);
    h.until(() => m.mode === 'idle');
  });

  it('a warp pipe from 1-2 to 4-1 opens World 4 only; clearing 4-1 returns to the World 4 map', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    enter(h, '1-2');
    play(h, '1-2');
    h.game.state.checkpoint = { level: '1-2', x: 97 };
    h.fire({ type: 'pipe', target: { level: '4-1', x: 2, y: 12 } });
    // Owner decision (2026-10-05): the warp ends the level on the map, which slides over to
    // World 4 and draws it in; 4-1 is picked there (character select, then the WORLD card).
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.world).toBe(4);
    expect(h.map().mode).toBe('slide');
    expect(h.game.state.checkpoint).toBeNull();
    h.until(() => h.map().mode === 'reveal');
    h.until(() => h.map().mode === 'idle', 600);
    expect(h.map().node).toBe('start');
    enter(h, '4-1');
    expect(h.level().level.id).toBe('4-1');
    expect([h.game.state.world, h.game.state.stage]).toEqual([4, 1]);
    expect(h.game.mapProgress.worlds).toEqual([1, 4]);
    expect(loadSave(1)?.worlds).toEqual([1, 4]);
    expect(isOpen(h.game.mapProgress, page(4), '4-1')).toBe(true);
    expect(isOpen(h.game.mapProgress, page(2), 'start')).toBe(false);
    expect(isOpen(h.game.mapProgress, page(3), 'start')).toBe(false);
    h.fire({ type: 'exit', next: '4-2-intro' });
    const m = h.map();
    expect(m).toBeInstanceOf(WorldMapScene);
    expect(m.page.world).toBe(4);
    expect(m.node).toBe('4-1');
    expect(m.revealing).toBe(true);
    expect(loadSave(1)?.cleared).toEqual(['1-1', '4-1']);
    expect(loadSave(1)?.position).toEqual({ world: 4, node: '4-1' });
    // 1-2 itself was not cleared by the warp.
    expect(isOpen(h.game.mapProgress, page(1), '1-3')).toBe(false);
  });

  it('after a warp, the map menu WORLDS travels back to an open world, at the node left there', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    enter(h, '1-2');
    play(h, '1-2');
    h.fire({ type: 'pipe', target: { level: '4-1', x: 2, y: 12 } });
    h.until(() => h.map().mode === 'idle', 600);
    enter(h, '4-1');
    h.fire({ type: 'exit', next: '4-2-intro' });
    h.until(() => h.map().mode === 'idle');
    expect(h.map().page.world).toBe(4);
    const openWorlds = () => {
      h.tap('select');
      expect((h.top() as MenuScene).title).toBe('MAP');
      choose(h.top(), 'Worlds');
      const menu = h.top() as MenuScene;
      expect(menu.title).toBe('WORLDS');
      return menu;
    };
    // Only open worlds are listed; the current one is marked.
    let menu = openWorlds();
    const items = (menu as unknown as { items: MenuItem[] }).items;
    expect(items.map((i) => i.label)).toEqual(['World 1', 'World 4']);
    expect(items.map((i) => i.value?.())).toEqual([undefined, 'here']);
    choose(menu, 'World 1');
    const m = h.map();
    expect(m).toBeInstanceOf(WorldMapScene);
    expect(m.page.world).toBe(1);
    expect(m.node).toBe('1-2'); // where the hero warped from
    expect(h.said.some((t) => t.startsWith('World 1,') && t.includes('World 1-2'))).toBe(true);
    expect(loadSave(1)?.position).toEqual({ world: 1, node: '1-2' });
    // Clearing 1-2 still works from here.
    enter(h, '1-2');
    play(h, '1-2-exit');
    h.fire({ type: 'exit', next: '1-3' });
    expect(h.map().page.world).toBe(1);
    expect(h.game.mapProgress.cleared).toEqual(['1-1', '4-1', '1-2']);
    expect(isOpen(h.game.mapProgress, page(1), '1-3')).toBe(true);
    h.until(() => h.map().mode === 'idle');
    // And back to World 4, at 4-1; the current world just closes the menus.
    menu = openWorlds();
    choose(menu, 'World 4');
    expect(h.map().page.world).toBe(4);
    expect(h.map().node).toBe('4-1');
    h.idle(8);
    choose(openWorlds(), 'World 4');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.world).toBe(4);
    // The last nodes are saved with the file.
    expect(loadSave(1)?.lastNode).toEqual({ 1: '1-2', 4: '4-1' });
    const h2 = makeGame();
    h2.game.openFile(1);
    h2.idle(8);
    h2.tap('select');
    choose(h2.top(), 'Worlds');
    choose(h2.top(), 'World 1');
    expect(h2.map().node).toBe('1-2');
  });

  it('a world never visited is entered at its start', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1', '1-2', '1-3', '1-4'], worlds: [1, 2] }));
    h.game.travelToWorld(2);
    expect(h.map().page.world).toBe(2);
    expect(h.map().node).toBe('start');
    h.game.travelToWorld(5); // closed: nothing happens
    expect(h.map().page.world).toBe(2);
  });

  it('a pipe within the world (1-2 into its exit area) is no warp', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    play(h, '1-2');
    h.fire({ type: 'pipe', target: { level: '1-2-exit', x: 3, y: 10, exitDir: 'up' } });
    expect(h.level().level.id).toBe('1-2-exit');
    expect(h.game.mapProgress.worlds).toEqual([1]);
  });

  // Owner decision (2026-10-05): after 8-4, "Your quest is over." and the credits, then the
  // file is saved with 8-4 complete, then the title.
  it("8-4's ending rolls the credits, then saves the file cleared and goes to the title", () => {
    const h = makeGame();
    const cleared = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    h.game.openFile(
      1,
      file({
        cleared: cleared.filter((id) => id !== '8-4'),
        worlds: [1, 2, 3, 4, 5, 6, 7, 8],
        position: { world: 8, node: '8-4' },
      }),
    );
    enter(h, '8-4');
    play(h, '8-4-end');
    h.fire({ type: 'exit', next: 'end' });
    expect(h.top()).toBeInstanceOf(CreditsScene);
    expect(loadSave(1)?.gameCleared).toBe(false);
    h.idle(60);
    h.tap('start'); // fast-forwards (the original's pause button during the credits)
    h.until(() => h.top() instanceof TitleScene, 3000);
    const saved = loadSave(1) as SaveFile;
    expect(saved.gameCleared).toBe(true);
    expect(saved.cleared).toContain('8-4');
    expect(h.game.campaign).toBeNull();
    // Reopening the file shows 8-4 completed.
    h.game.openFile(1);
    expect(h.map().page.world).toBe(8);
    expect(isCleared(h.game.mapProgress, page(8), '8-4')).toBe(true);
    expect(loadSave(1)?.gameCleared).toBe(true);
  });
});

describe('campaign: other worlds draw in on arrival', () => {
  function clearCastle(h: H) {
    h.game.openFile(1, file({ cleared: ['1-1', '1-2', '1-3'], position: { world: 1, node: '1-4' } }));
    enter(h, '1-4');
    h.fire({ type: 'exit', next: '2-1' });
    h.until(() => h.map().mode === 'idle');
    // World 1's share is drawn; World 2's waits (and is saved) for the hero to get there.
    expect(h.game.pendingReveal).toContain('2:start');
    expect(h.game.pendingReveal.every((id) => id.startsWith('2:'))).toBe(true);
    expect(loadSave(1)?.pendingReveal).toContain('2:start');
  }

  it('after a castle clear, walking on to World 2 draws in its start and first path', () => {
    const h = makeGame();
    clearCastle(h);
    const exit = page(1).exits.find((e) => e.toWorld === 2)!;
    h.tap(dirOf(exit.points));
    h.until(() => h.map().page.world === 2 && h.map().mode !== 'walk' && h.map().mode !== 'slide');
    expect(h.map().mode).toBe('reveal');
    h.until(() => h.map().mode === 'idle', 600);
    expect(h.said.at(-1)).toContain('World 2-1, open');
    expect(h.game.pendingReveal).toEqual([]);
    expect(loadSave(1)?.pendingReveal).toEqual([]);
  });

  it('travelling to World 2 through the Worlds menu draws it in too', () => {
    const h = makeGame();
    clearCastle(h);
    h.game.travelToWorld(2);
    expect(h.map().page.world).toBe(2);
    expect(h.map().revealing).toBe(true);
    h.idle(2);
    h.tap('jump'); // skips
    expect(h.map().revealing).toBe(false);
    expect(h.game.pendingReveal).toEqual([]);
  });

  it("a warp's draw-in survives quitting: the reopened file shows it on the target page", () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    enter(h, '1-2');
    play(h, '1-2');
    h.fire({ type: 'pipe', target: { level: '4-1', x: 2, y: 12 } });
    // Saved right away (closing the tab now keeps it), while the map slides over to World 4.
    expect(h.map().mode).toBe('slide');
    expect(loadSave(1)?.pendingReveal).toEqual(expect.arrayContaining(['4:start', '4:4-1']));
    expect(loadSave(1)?.position).toEqual({ world: 4, node: 'start' });
    const h2 = makeGame();
    h2.game.openFile(1);
    expect(h2.map().page.world).toBe(4);
    expect(h2.map().revealing).toBe(true);
    h2.until(() => h2.map().mode === 'idle', 600);
    expect(loadSave(1)?.pendingReveal).toEqual([]);
  });
});

describe('campaign: deaths, game over and quitting', () => {
  function die(h: H) {
    const w = h.level().world;
    // Co-op: player one is already out, so player two's death ends the attempt.
    for (const p of w.players.slice(0, -1)) {
      p.out = true;
      p.hidden = true;
    }
    w.kill(w.players.at(-1) ?? w.player);
    h.until(() => !(h.top() instanceof LevelScene), 400);
  }

  it('a death with lives left keeps the usual flow and saves the lives left', () => {
    const h = makeGame();
    h.game.openFile(1, file());
    enter(h, '1-1');
    h.game.state.score = 300;
    die(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(loadSave(1)?.lives).toBe(2);
    expect(loadSave(1)?.score).toBe(300);
    h.idle(12);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(IntroScene);
    h.until(() => h.top() instanceof LevelScene);
    expect(h.level().level.id).toBe('1-1');
  });

  function toGameOver(h: H, c2: string | null = null) {
    h.game.openFile(
      2,
      file({ cleared: ['1-1', '1-2'], position: { world: 1, node: '1-3' } }, 2, LUIGI.id, c2),
    );
    enter(h, '1-3');
    const s = h.game.state;
    s.lives = 1;
    s.score = 9000;
    s.coins = 55;
    die(h);
    expect(h.top()).toBeInstanceOf(GameOverScene);
    h.idle(GAME_OVER_CARD_FRAMES);
    expect((h.top() as GameOverScene).prompting).toBe(true);
  }

  it('CONTINUE? YES: the map at the same place with 3 lives, score and coins 0, progress kept', () => {
    const h = makeGame();
    toGameOver(h);
    // Already saved as a continue leaves it.
    const saved = loadSave(2) as SaveFile;
    expect([saved.lives, saved.score, saved.coins]).toEqual([3, 0, 0]);
    expect(saved.cleared).toEqual(['1-1', '1-2']);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().node).toBe('1-3');
    const s = h.game.state;
    expect([s.lives, s.score, s.coins, s.character]).toEqual([3, 0, 0, LUIGI]);
    expect(h.game.mapProgress.cleared).toEqual(['1-1', '1-2']);
    expect(h.game.campaign).toEqual({ slot: 2 });
  });

  it('CONTINUE? YES with two players gives 5 lives and keeps both heroes', () => {
    const h = makeGame();
    toGameOver(h, LINK.id);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.state.lives).toBe(5);
    expect(h.game.state.character2).toBe(LINK);
    expect(loadSave(2)?.lives).toBe(5);
  });

  it('CONTINUE? NO: the title, with the file already saved', () => {
    const h = makeGame();
    toGameOver(h);
    h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.game.campaign).toBeNull();
    const saved = loadSave(2) as SaveFile;
    expect([saved.lives, saved.score, saved.cleared, saved.position]).toEqual([
      3,
      0,
      ['1-1', '1-2'],
      { world: 1, node: '1-3' },
    ]);
  });

  it('pause → Quit to map: no clear recorded, the run kept and saved', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    enter(h, '1-2');
    h.game.state.coins = 21;
    h.game.state.lives = 2;
    h.idle(4);
    h.tap('start');
    const pause = h.top();
    expect(pause).toBeInstanceOf(PauseScene);
    expect(menuItem(pause, 'Quit')).toBeUndefined();
    expect(menuItem(pause, 'Quit to title')).toBeDefined();
    choose(pause, 'Quit to map');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().node).toBe('1-2');
    expect(h.map().revealing).toBe(false);
    expect(h.game.mapProgress.cleared).toEqual(['1-1']);
    const saved = loadSave(1) as SaveFile;
    expect([saved.cleared, saved.coins, saved.lives]).toEqual([['1-1'], 21, 2]);
  });

  it('pause → Quit to title saves the run (no clear) and shows the title', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { world: 1, node: '1-2' } }));
    enter(h, '1-2');
    h.game.state.coins = 9;
    h.idle(4);
    h.tap('start');
    choose(h.top(), 'Quit to title');
    expect(h.top()).toBeInstanceOf(TitleScene);
    const saved = loadSave(1) as SaveFile;
    expect([saved.cleared, saved.coins, saved.position]).toEqual([['1-1'], 9, { world: 1, node: '1-2' }]);
  });

  it('the level pause hides Dev mode during campaign play but offers Assists (full menu elsewhere)', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: true } as Settings;
    h.game.openFile(1, file());
    enter(h, '1-1');
    h.idle(4);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    h.idle(4);
    expect(menuItem(h.top(), 'Dev mode')).toBeUndefined();
    expect(menuItem(h.top(), 'Assists')).toBeDefined();
    h.tap('jump'); // Continue
    h.game.devStart('1-1', MARIO, 'big');
    h.until(() => h.top() instanceof LevelScene);
    h.idle(4);
    h.tap('start');
    expect(menuItem(h.top(), 'Dev mode')).toBeDefined();
    expect(menuItem(h.top(), 'Assists')).toBeUndefined(); // inside Dev mode there
  });

  it('campaign pause without dev mode shows neither Dev mode nor Assists', () => {
    const h = makeGame();
    h.game.openFile(1, file());
    enter(h, '1-1');
    h.idle(4);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(menuItem(h.top(), 'Dev mode')).toBeUndefined();
    expect(menuItem(h.top(), 'Assists')).toBeUndefined();
  });

  it('reopening the file restores position, lives, score, coins and heroes', () => {
    const h = makeGame();
    h.game.openFile(3, file({}, 3, MARIO.id, LUIGI.id));
    enter(h, '1-1');
    const s = h.game.state;
    s.score = 1234;
    s.coins = 42;
    s.lives = 7;
    h.level().world.player.powerState = 'big';
    h.fire({ type: 'exit', next: '1-2-intro' });
    h.until(() => h.map().mode === 'idle');
    walkTo(h, '1-2');
    h.game.saveAndQuit();
    expect(h.top()).toBeInstanceOf(TitleScene);

    const h2 = makeGame();
    h2.game.openFile(3);
    const m = h2.map();
    expect(m).toBeInstanceOf(WorldMapScene);
    expect(m.node).toBe('1-2');
    const t = h2.game.state;
    expect([t.lives, t.score, t.coins, t.character, t.character2, t.powerState]).toEqual([
      7,
      1234,
      42,
      MARIO,
      LUIGI,
      'big',
    ]);
    expect(h2.game.mapProgress.cleared).toEqual(['1-1']);
  });
});

describe('non-campaign starts never touch save files', () => {
  it('a dev start: exit goes on to the next level, death and game over as before', () => {
    const h = makeGame();
    h.game.devStart('1-1', MARIO, 'big');
    h.until(() => h.top() instanceof LevelScene);
    h.fire({ type: 'exit', next: '1-2-intro' });
    expect(h.top()).toBeInstanceOf(IntroScene);
    h.until(() => h.top() instanceof LevelScene);
    expect(h.level().level.id).toBe('1-2-intro');
    h.fire({ type: 'pipe', target: { level: '4-1', x: 2, y: 12 } });
    expect(h.game.mapProgress.worlds).toEqual([1]);
    expect(saveKeys()).toEqual([]);
  });

  it('a ?level= start: deaths, game over and continue restart the world as before', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-3');
    h.until(() => h.top() instanceof LevelScene);
    h.game.state.lives = 1;
    const w = h.level().world;
    w.kill(w.player);
    h.until(() => h.top() instanceof GameOverScene, 400);
    h.idle(GAME_OVER_CARD_FRAMES);
    h.tap('jump');
    // Today's continue: character select, then the first level of the world.
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.level().level.id).toBe('1-1');
    h.tap('start');
    expect(menuItem(h.top(), 'Quit to map')).toBeUndefined();
    expect(menuItem(h.top(), 'Quit')).toBeDefined();
    expect(saveKeys()).toEqual([]);
  });

  it('the ending outside campaign mode rolls the credits, goes to the title and saves nothing', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '8-4');
    h.until(() => h.top() instanceof LevelScene);
    play(h, '8-4-end');
    h.fire({ type: 'exit', next: 'end' });
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.until(() => h.top() instanceof TitleScene, 6000);
    expect(saveKeys()).toEqual([]);
  });

  it('a campaign left for a dev start stops saving', () => {
    const h = makeGame();
    h.game.openFile(1, file());
    const before = store.get('smbc.save.1');
    h.game.devStart('1-1', MARIO, 'big');
    h.until(() => h.top() instanceof LevelScene);
    h.fire({ type: 'exit', next: '1-2-intro' });
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(store.get('smbc.save.1')).toBe(before);
  });
});
