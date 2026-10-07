import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene } from '@game/scenes/world-map';
import { CHARACTERS } from '@game/characters/registry';
import type { MapNode, PageId, WorldMapPage } from '@game/map/types';
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

/** Records the sprites and text of the last frame drawn. */
class Recorder implements Renderer {
  sprites: { frame: string; x: number; y: number }[] = [];
  texts: string[] = [];
  clear(): void {
    this.sprites = [];
    this.texts = [];
  }
  rect(): void {}
  sprite(_sheet: unknown, frame: string, x: number, y: number): void {
    this.sprites.push({ frame, x, y });
  }
  text(_font: unknown, text: string): void {
    this.texts.push(text);
  }
  debugText(): void {}
  line(): void {}
}

/** The map of `pageId` with dev "Unlock all" on, the hero standing on `node`. */
function onMap(pageId: PageId, at = 'start', cleared: string[] = []) {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const game = new Game({
    ctx: {
      assets,
      audio: { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn() },
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  game.deps.settings = { dev: true } as Settings;
  game.devUnlockAll = true;
  game.mapProgress.cleared = cleared;
  game.mapProgress.position = { page: pageId, node: at };
  game.showMap(pageId);
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new Recorder();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
    game.scenes.render(r);
  };
  for (let i = 0; i < 8; i++) step();
  const map = game.scenes.top as WorldMapScene;
  expect(map).toBeInstanceOf(WorldMapScene);
  const page = mapPage(pageId) as WorldMapPage;
  const node = (id: string) => page.nodes.find((n) => n.id === id) as MapNode;
  /** The frame drawn at a node's tile (the hero is drawn after it). */
  const frameAt = (id: string) => {
    const n = node(id);
    return r.sprites.find(
      (s) => s.x === n.x * 16 && s.y === n.y * 16 && /^map-(node|castle|warp)/.test(s.frame),
    )?.frame;
  };
  return { game, map, said, r, step, node, frameAt };
}

describe('secret-exit level nodes', () => {
  it('World 1: 1-2 uses the secret-exit dot, 1-1 the normal one; castle and warp unchanged', () => {
    const h = onMap('smb-1');
    expect(h.frameAt('1-2')).toBe('map-node-secret');
    expect(h.frameAt('1-1')).toBe('map-node-open');
    expect(h.frameAt('1-3')).toBe('map-node-open');
    expect(h.frameAt('1-4')).toBe('map-castle');
  });

  it('cleared, they keep the secret-exit look (cleared variant)', () => {
    const h = onMap('smb-1', 'start', ['1-1', '1-2']);
    expect(h.frameAt('1-2')).toBe('map-node-secret-cleared');
    expect(h.frameAt('1-1')).toBe('map-node-cleared');
  });

  it('World 4: 4-2 uses the secret-exit dot, 4-1 and 4-3 the normal one', () => {
    const h = onMap('smb-4');
    expect(h.frameAt('4-2')).toBe('map-node-secret');
    expect(h.frameAt('4-1')).toBe('map-node-open');
    expect(h.frameAt('4-3')).toBe('map-node-open');
  });

  it('Lost Levels: 1-2 is marked, 1-1 is not', () => {
    const h = onMap('ll-1');
    expect(h.frameAt('ll-1-2')).toBe('map-node-secret');
    expect(h.frameAt('ll-1-1')).toBe('map-node-open');
  });

  it('Lost B-4, a castle with a warp zone, uses the secret-exit castle, open and cleared', () => {
    expect(onMap('ll-11').frameAt('ll-11-4')).toBe('map-castle-secret');
    expect(onMap('ll-11', 'start', ['ll-11-4']).frameAt('ll-11-4')).toBe('map-castle-secret-cleared');
    expect(onMap('ll-11').frameAt('ll-11-2')).toBe('map-node-open');
    expect(onMap('ll-1', 'start', ['ll-1-4']).frameAt('ll-1-4')).toBe('map-castle-cleared');
  });

  it('the announcer says "secret exit" for such a node only', () => {
    const h = onMap('smb-1');
    expect(h.map.nodeLabel(h.node('1-2'))).toBe('World 1-2, open, secret exit');
    expect(h.map.nodeLabel(h.node('1-1'))).toBe('World 1-1, open');
    const lost = onMap('ll-11', 'll-11-4');
    expect(lost.said.at(-1)).toMatch(/Lost B-4 castle, open, secret exit/);
    const h4 = onMap('smb-4', '4-2', ['4-2']);
    expect(h4.said.at(-1)).toMatch(/World 4-2, cleared, secret exit$/);
  });
});

describe('map header world label', () => {
  const world = (h: ReturnType<typeof onMap>) => h.r.texts[1];

  it('names the level on a level or castle node, just the world elsewhere', () => {
    expect(world(onMap('smb-1', '1-1'))).toBe('WORLD 1-1');
    expect(world(onMap('smb-1', '1-4'))).toBe('WORLD 1-4');
    // World 1's start is a level: Mario's tutorial stage 1-0.
    expect(world(onMap('smb-1', 'start'))).toBe('WORLD 1-0');
    expect(world(onMap('smb-2', 'start'))).toBe('WORLD 2');
    expect(world(onMap('ll-10', 'll-10-2'))).toBe('LOST A-2');
    expect(world(onMap('ll-3', 'll-3-4'))).toBe('LOST 3-4');
    expect(world(onMap('ll-3', 'hub'))).toBe('LOST 3');
    expect(world(onMap('hub'))).toBe('WARP ZONE');
  });

  it('shows just the world while walking, the level again on arrival; fits beside the title', () => {
    const h = onMap('smb-1', 'start');
    const path = (mapPage('smb-1') as WorldMapPage).paths.find((p) => p.from === 'start');
    const [[ax, ay], [bx, by]] = path?.points as [[number, number], [number, number]];
    const dir: Action = bx > ax ? 'right' : bx < ax ? 'left' : by > ay ? 'down' : 'up';
    h.step([dir]);
    h.step([dir]);
    expect(h.map.mode).toBe('walk');
    expect(world(h)).toBe('WORLD 1');
    for (let i = 0; i < 200 && h.map.mode !== 'idle'; i++) h.step();
    expect(world(h)).toBe(`WORLD ${h.map.node}`);
    const [title, label] = h.r.texts as [string, string];
    expect(title.length + label.length).toBeLessThanOrEqual(30);
  });

  it('walking off 1-1 shows "WORLD 1", then "WORLD 1-2" on arrival', () => {
    const h = onMap('smb-1', '1-1');
    expect(world(h)).toBe('WORLD 1-1');
    const path = (mapPage('smb-1') as WorldMapPage).paths.find((p) => p.from === '1-1' && p.to === '1-2');
    const [[ax, ay], [bx, by]] = path?.points as [[number, number], [number, number]];
    const dir: Action = bx > ax ? 'right' : bx < ax ? 'left' : by > ay ? 'down' : 'up';
    h.step([dir]);
    h.step();
    expect(h.map.mode).toBe('walk');
    expect(world(h)).toBe('WORLD 1');
    for (let i = 0; i < 300 && h.map.mode === 'walk'; i++) {
      expect(world(h)).toBe('WORLD 1');
      h.step();
    }
    expect(h.map.node).toBe('1-2');
    expect(world(h)).toBe('WORLD 1-2');
  });
});
