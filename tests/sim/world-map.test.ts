import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
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
import { MenuScene } from '@game/scenes/menu';
import { TitleScene } from '@game/scenes/title';
import { CHARACTERS } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { clearLevel } from '@game/map/rules';
import type { Dir } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

function makeGame() {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
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
  const until = (pred: () => boolean, max = 1000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const map = () => game.scenes.top as WorldMapScene;
  return { game, said, step, tap, idle, until, map };
}

const page = (w: number) => mapPage(w) as WorldMapPage;

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
    expect(h.said).toContain(`World 1, ${page(1).title}`);
    h.idle(8);
    walkTo(h, '1-1');
    expect(h.said.at(-1)).toBe('World 1-1, open');
    expect(h.game.mapProgress.position).toEqual({ world: 1, node: '1-1' });
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
    h.game.showMap(1);
    h.idle(8);
    const enter = vi.spyOn(h.game, 'enterLevelFromMap');
    h.tap('jump'); // the start node has no level
    expect(enter).not.toHaveBeenCalled();
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

  it('enterLevelFromMap starts at the intro scene when the level has one', () => {
    const h = makeGame();
    const go = vi.spyOn(h.game, 'goToLevel');
    h.game.showMap(1);
    h.game.enterLevelFromMap('1-2');
    h.idle(12);
    h.tap('start');
    expect(go).toHaveBeenCalledWith('1-2-intro', { mode: 'stand' });
  });

  it('slides to World 2 along the open exit once the World 1 castle is cleared', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    for (const id of ['1-1', '1-2', '1-3', '1-4']) clearLevel(prog, id, getLevel);
    expect(prog.worlds).toContain(2);
    expect(prog.position).toEqual({ world: 1, node: '1-4' });
    h.game.showMap();
    h.idle(8);
    const exit = page(1).exits[0] as WorldMapPage['exits'][number];
    expect(h.map().node).toBe(exit.from);
    h.tap(dirOf(exit.points));
    h.until(() => h.map().mode === 'slide', 400);
    h.idle(MAP_SLIDE_FRAMES - 1);
    h.until(() => h.map().mode === 'idle', 5);
    expect(h.map().page.world).toBe(2);
    expect(h.map().node).toBe('start');
    expect(prog.position).toEqual({ world: 2, node: 'start' });
    expect(h.said).toContain(`World 2, ${page(2).title}`);
  });

  it('a locked exit does not slide', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    for (const id of ['1-1', '1-2', '1-3']) clearLevel(prog, id, getLevel);
    prog.position = { world: 1, node: '1-4' };
    h.game.showMap();
    h.idle(8);
    h.tap(dirOf((page(1).exits[0] as WorldMapPage['exits'][number]).points));
    h.idle(60);
    expect(h.map().page.world).toBe(1);
  });

  it('draws in what a clear opened, then saves; any button skips', () => {
    const h = makeGame();
    const autosave = vi.fn();
    (h.game as unknown as { autosave: () => void }).autosave = autosave;
    const reveal = clearLevel(h.game.mapProgress, '1-1', getLevel);
    expect(reveal).toContain('1-2');
    h.game.showMap(1, { reveal });
    expect(h.map().revealing).toBe(true);
    expect(h.map().node).toBe('1-1');
    h.until(() => !h.map().revealing, 600);
    expect(autosave).toHaveBeenCalledTimes(1);

    const k = makeGame();
    const save2 = vi.fn();
    (k.game as unknown as { autosave: () => void }).autosave = save2;
    const r2 = clearLevel(k.game.mapProgress, '1-1', getLevel);
    k.game.showMap(1, { reveal: r2 });
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
    h.game.showMap(1);
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
    h.tap('down');
    h.tap('jump'); // Save and quit
    expect(h.game.scenes.top).toBeInstanceOf(TitleScene);

    const k = makeGame();
    const quit = vi.fn();
    (k.game as unknown as { saveAndQuit: () => void }).saveAndQuit = quit;
    k.game.showMap(1);
    k.idle(8);
    k.tap('select');
    k.idle(8);
    k.tap('down');
    k.tap('jump');
    expect(quit).toHaveBeenCalled();
  });
});
