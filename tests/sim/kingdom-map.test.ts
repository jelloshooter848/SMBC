import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { WORLD_1 } from '@content/worldmap/world1';
import { WORLD_1_KINGDOM } from '@content/worldmap/world1-kingdom';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { MAP_FADE_FRAMES, MAP_SLIDE_FRAMES, WorldMapScene } from '@game/scenes/world-map';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Dir } from '@game/map/rules';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ALL_STORY } from './story-seen';

// 0.4.48: World 1 drawn from above in campaign play (content/worldmap/world1-kingdom.ts). The page
// keeps World 1's node and road ids, so a file anywhere on it loads where it was, every road walks,
// reveals draw in, the warp spot warps and the road on slides to World 2 and back. Outside the
// campaign the classic page shows.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Records the sprite frames drawn, by sheet. */
class FrameRenderer implements Renderer {
  frames: { sheet: string; frame: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(s: SpriteSheet, frame: string, x: number, y: number): void {
    this.frames.push({ sheet: s.id, frame, x, y });
  }
}

function makeGame() {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn(), sfx: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: () => undefined } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new FrameRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    p2.next();
    r.frames = [];
    game.scenes.update([p1, p2]);
    game.scenes.render(r);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const map = () => game.scenes.top as WorldMapScene;
  return { game, step, tap, until, map, r };
}
type H = ReturnType<typeof makeGame>;

const ALL_W1 = ['1-0', '1-1', '1-2', '1-3', '1-4'];

function file(over: Partial<SaveFile> = {}): SaveFile {
  const s = { ...newSave(1, MARIO.id), story: [...ALL_STORY], ...over };
  writeSave(s);
  return s;
}

function open(h: H, over: Partial<SaveFile>): void {
  h.game.openFile(1, file(over));
  h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'idle', 1200);
  for (let i = 0; i < 10; i++) h.step(); // the map takes no press for its first frames
}

function dirOf(points: readonly (readonly [number, number])[]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

/** Walks the road between the node stood on and `to`, by the page shown's own road shapes. */
function walkTo(h: H, to: string): void {
  const m = h.map();
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q?.points ?? [])].reverse();
  h.tap(dirOf(pts));
  h.until(() => m.mode === 'idle', 600);
  expect(m.node).toBe(to);
  const n = m.page.nodes.find((x) => x.id === to);
  expect([m.hx, m.hy]).toEqual([(n?.x ?? -1) * 16, (n?.y ?? -1) * 16]);
}

describe('World 1 from above (campaign play)', () => {
  it('shows a file anywhere on World 1 on the same node, drawn from above', () => {
    for (const n of WORLD_1.nodes) {
      const h = makeGame();
      open(h, {
        cleared: ALL_W1,
        secrets: ['bonus-1'],
        pages: ['smb-1', 'smb-2'],
        position: { page: 'smb-1', node: n.id },
      });
      const m = h.map();
      expect(m.page).toBe(WORLD_1_KINGDOM);
      expect(m.node, n.id).toBe(n.id);
      const at = WORLD_1_KINGDOM.nodes.find((x) => x.id === n.id);
      expect([m.hx, m.hy]).toEqual([(at?.x ?? -1) * 16, (at?.y ?? -1) * 16]);
      // Saved back unchanged: the file keeps the node id.
      expect(loadSave(1)?.position).toEqual({ page: 'smb-1', node: n.id });
      // Drawn from the kingdom sheet, the hero from above (Kakariko's td-mario).
      h.step();
      expect(h.r.frames.some((f) => f.sheet === 'kingdom' && f.frame.startsWith('grass-'))).toBe(true);
      expect(h.r.frames.some((f) => f.sheet.startsWith('td-mario') && f.frame === 'down-0')).toBe(true);
      expect(h.r.frames.some((f) => f.frame === 'map-path-dot')).toBe(false);
    }
  });

  it('walks every road, there and back', () => {
    const h = makeGame();
    open(h, {
      cleared: ALL_W1,
      secrets: ['bonus-1'],
      pages: ['smb-1', 'smb-2'],
      position: { page: 'smb-1', node: 'start' },
    });
    for (const to of ['1-1', '1-2', 'bonus-1', '1-2', '1-3', '1-4', '1-3', '1-2', '1-1', 'start'])
      walkTo(h, to);
  });

  it('a diagonal on the touch pad (two directions at once) takes whichever has a road', () => {
    // The touch d-pad holds up and left together between 35 and 60 degrees: at 1-1 an up-left
    // thumb means the start (up), though LEFT alone leads nowhere; a diagonal with no road bumps.
    const at = (node: string) => {
      const h = makeGame();
      open(h, {
        cleared: ALL_W1,
        secrets: ['bonus-1'],
        pages: ['smb-1', 'smb-2'],
        position: { page: 'smb-1', node },
      });
      return h;
    };
    const go = (node: string, dirs: Action[]) => {
      const h = at(node);
      const bump = h.game.ctx.audio.sfx as ReturnType<typeof vi.fn>;
      bump.mockClear();
      h.step(dirs);
      h.step();
      h.until(() => h.map().mode === 'idle', 600);
      return { node: h.map().node, bumped: bump.mock.calls.some((c) => c[0] === 'bump') };
    };
    expect(go('1-1', ['left', 'up'])).toEqual({ node: 'start', bumped: false });
    expect(go('1-1', ['left', 'down'])).toEqual({ node: '1-2', bumped: false });
    expect(go('bonus-1', ['right', 'down'])).toEqual({ node: 'bonus-1', bumped: true });
  });

  it('faces the way he walks while walking, and the player while he stands', () => {
    const h = makeGame();
    open(h, { cleared: ALL_W1, pages: ['smb-1'], position: { page: 'smb-1', node: 'start' } });
    h.tap('right'); // start → 1-1 leaves east, then turns south
    h.step();
    expect(h.r.frames.some((f) => f.sheet.startsWith('td-mario') && f.frame.startsWith('side-'))).toBe(true);
    h.until(() => h.map().mode === 'idle', 600);
    h.step();
    expect(h.r.frames.some((f) => f.sheet.startsWith('td-mario') && f.frame === 'down-0')).toBe(true);
  });

  it('draws a cleared level’s road in tile by tile, then its node', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-0'], position: { page: 'smb-1', node: '1-1' } }));
    h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'idle', 1200);
    h.game.levelCleared('1-1');
    h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'reveal', 200);
    const roads = () => h.r.frames.filter((f) => f.sheet === 'kingdom' && f.frame.startsWith('road-')).length;
    const counts: number[] = [];
    while (h.map().mode === 'reveal') {
      h.step();
      counts.push(roads());
    }
    // From the open road start>1-1 (6 tiles) to that and 1-1>1-2 (7 tiles; 1-1 shared), growing.
    expect(counts[0]).toBeLessThanOrEqual(7);
    expect(counts.at(-1)).toBe(12);
    expect(counts.every((c, i) => i === 0 || c >= (counts[i - 1] as number))).toBe(true);
    expect(new Set(counts).size).toBeGreaterThan(4);
    h.step();
    expect(h.r.frames.some((f) => f.sheet === 'kingdom' && f.frame === 'node-secret')).toBe(true);
  });

  it('warps from the warp spot to the hub and back to it', () => {
    const h = makeGame();
    open(h, {
      cleared: ['1-0', '1-1', '1-2'],
      secrets: ['bonus-1'],
      position: { page: 'smb-1', node: 'bonus-1' },
    });
    expect(h.map().hintLine).toBe('WARP ZONE');
    h.step();
    expect(h.r.frames.some((f) => f.sheet === 'kingdom' && f.frame === 'warp')).toBe(true);
    h.tap('jump');
    expect(h.map().mode).toBe('fade');
    for (let i = 0; i < MAP_FADE_FRAMES; i++) h.step();
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page.id).toBe('hub');
    h.tap('jump'); // the hub's centre: back to World 1, on the warp spot
    for (let i = 0; i < MAP_FADE_FRAMES; i++) h.step();
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page).toBe(WORLD_1_KINGDOM);
    expect(h.map().node).toBe('bonus-1');
  });

  it('slides on to World 2 along the exit and back to Bowser’s fort', () => {
    const h = makeGame();
    open(h, {
      cleared: ALL_W1,
      freed: ['mario', 'luigi'],
      pages: ['smb-1', 'smb-2'],
      position: { page: 'smb-1', node: '1-4' },
    });
    expect(h.map().page).toBe(WORLD_1_KINGDOM);
    h.tap('right');
    h.until(() => h.map().mode === 'slide', 200);
    h.step();
    // Both pages in the slide: the kingdom's ground and World 2's tiles.
    expect(h.r.frames.some((f) => f.sheet === 'kingdom')).toBe(true);
    expect(h.r.frames.some((f) => f.sheet.startsWith('map@'))).toBe(true);
    for (let i = 0; i < MAP_SLIDE_FRAMES; i++) h.step();
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page).toBe(mapPage('smb-2'));
    h.tap('left');
    h.until(() => h.map().mode === 'slide', 400);
    for (let i = 0; i < MAP_SLIDE_FRAMES; i++) h.step();
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page).toBe(WORLD_1_KINGDOM);
    expect(h.map().node).toBe('1-4');
  });

  it('outside the campaign, the classic World 1 shows', () => {
    const h = makeGame();
    const m = new WorldMapScene(h.game, 'smb-1');
    expect(h.game.campaign).toBeNull();
    expect(m.page).toBe(WORLD_1);
    h.game.scenes.push(m);
    h.step();
    expect(h.r.frames.some((f) => f.sheet === 'kingdom')).toBe(false);
    expect(h.r.frames.some((f) => f.sheet === 'map@map-grass')).toBe(true);
  });
});
