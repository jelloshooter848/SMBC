import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { WORLD_MAP_SONGS } from '@content/music/world-maps';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene, MAP_FADE_FRAMES, MAP_SLIDE_FRAMES } from '@game/scenes/world-map';
import { CHARACTERS } from '@game/characters/registry';
import { clearLevel, type Dir } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

// A song for each world map (0.4.48): the map scene plays the page's own song, and a page change
// to a page with another song fades the old one out over the slide (or the warp's fade) before
// the new one starts, so the switch never cuts a note off mid-swing.

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
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn(), fadeOutMusic: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: () => undefined } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
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
  game.mapProgress.cleared.push('1-0');
  return { game, step, tap, idle, until, map, audio };
}

function dirOf(points: [number, number][]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

describe('the world map music', () => {
  it("plays the page's own song on arrival", () => {
    for (let w = 1; w <= 8; w++) {
      const h = makeGame();
      h.game.mapProgress.pages = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `smb-${n}`);
      h.game.mapProgress.position = { page: `smb-${w}`, node: 'start' };
      h.game.showMap(`smb-${w}`);
      h.idle(2);
      expect(h.map().page.id).toBe(`smb-${w}`);
      expect(h.audio.playMusic).toHaveBeenLastCalledWith(WORLD_MAP_SONGS[w - 1]);
    }
  });

  it('fades World 1 out over the slide, then starts World 2', () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    for (const id of ['1-1', '1-2', '1-3', '1-4']) clearLevel(prog, id, getLevel);
    h.game.showMap();
    h.idle(8);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('map-mushroom');
    const exit = (mapPage('smb-1') as WorldMapPage).exits[0] as WorldMapPage['exits'][number];
    h.tap(dirOf(exit.points));
    h.until(() => h.map().mode === 'slide', 400);
    expect(h.audio.fadeOutMusic).toHaveBeenCalledTimes(1);
    expect(h.audio.fadeOutMusic).toHaveBeenCalledWith(MAP_SLIDE_FRAMES / 60);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('map-mushroom');
    h.idle(MAP_SLIDE_FRAMES - 1);
    h.until(() => h.map().mode === 'idle', 5);
    expect(h.map().page.id).toBe('smb-2');
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('map-hyrule');
  });

  it("a warp to the hub fades out over the warp's fade, and the hub keeps the old map song", () => {
    const h = makeGame();
    const prog = h.game.mapProgress;
    clearLevel(prog, '1-1', getLevel);
    prog.secrets.push('bonus-1');
    prog.position = { page: 'smb-1', node: 'bonus-1' };
    h.game.showMap();
    h.idle(8);
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().node).toBe('bonus-1');
    h.tap('jump');
    expect(h.map().mode).toBe('fade');
    expect(h.audio.fadeOutMusic).toHaveBeenCalledWith(MAP_FADE_FRAMES / 60);
    h.idle(MAP_FADE_FRAMES);
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page.id).toBe('hub');
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('map');
  });
});
