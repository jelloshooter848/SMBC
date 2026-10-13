import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { WORLD_7_GALUGA } from '@content/worldmap/world7-galuga';
import { WORLD_8 } from '@content/worldmap/world8';
import { WORLD_8_UNDERWORLD } from '@content/worldmap/world8-underworld';
import { VALLEY_LIVE } from '@content/worldmap/valley-of-bowser';
import { mapPage, pageLook } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { underworldPainted } from '@content/sprites/underworld-above';
import { valleyPainted } from '@content/sprites/valley-above';
import { lazySheetReady } from '@content/worldmap/above-render';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { MAP_HEADER_H, MAP_SLIDE_FRAMES, PREPAINT_AFTER_FRAMES, WorldMapScene } from '@game/scenes/world-map';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Dir } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ALL_STORY } from './story-seen';

// 0.4.54: World 8 drawn from above in campaign play (world8-underworld.ts), THE UNDERWORLD, with no
// castle on the map: 8-4's fortress is the last node. While the VALLEY OF BOWSER is not live (no
// level 8-5 yet: valley-of-bowser.ts VALLEY_LIVE) the road on leads to Lost World 1 exactly as
// before: a file anywhere on World 8 loads where it was, every road walks both ways, the slides run
// 7 -> 8 -> Lost 1 and back, and a beaten file keeps its road on. tests/sim/valley-of-bowser.test.ts
// plays the same with the switch on.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Records the sprite frames drawn, by sheet, the text drawn and the seam's shades. */
class FrameRenderer implements Renderer {
  frames: { sheet: string; frame: string; x: number; y: number }[] = [];
  texts: string[] = [];
  rects = 0;
  clear(): void {}
  rect(_x: number, y: number, _w: number, h: number): void {
    if (y === MAP_HEADER_H && h === 240 - MAP_HEADER_H) this.rects++;
  }
  text(_f: SpriteSheet, s: string): void {
    this.texts.push(s);
  }
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
  const said: string[] = [];
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (s: string) => void said.push(s) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new FrameRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    p2.next();
    r.frames = [];
    r.texts = [];
    r.rects = 0;
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
  return { game, step, tap, until, map, r, assets, said, audio };
}
type H = ReturnType<typeof makeGame>;

const world = (w: number) => [1, 2, 3, 4].map((s) => `${w}-${s}`);
const W1_7 = ['1-0', ...[1, 2, 3, 4, 5, 6, 7].flatMap(world)];
const FREED = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill'];
const P8 = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);

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

/** Leaves along the exit (or back) pressed, through the slide; returns the seam's shading count. */
function slide(h: H, dir: Action, to: string): number {
  h.tap(dir);
  h.until(() => h.map().mode === 'slide', 600);
  h.step();
  const seam = h.r.rects;
  for (let i = 0; i < MAP_SLIDE_FRAMES; i++) h.step();
  h.until(() => h.map().mode === 'idle', 800);
  expect(h.map().page.id).toBe(to);
  return seam;
}

/** A file that has beaten World 8 (and so the game): every world cleared, Sophia III freed. */
const BEATEN: Partial<SaveFile> = {
  cleared: [...W1_7, ...world(8)],
  freed: [...FREED, 'sophia'],
  secrets: ['bonus-8'],
  pages: [...P8, 'll-1'],
  gameCleared: true,
};

describe.runIf(!VALLEY_LIVE)('THE UNDERWORLD from above, the Valley not live yet (0.4.54)', () => {
  it('paints its sheet ahead while the hero idles on World 7, never at load; the Valley’s never', () => {
    // First in this file: nothing before it has drawn World 8.
    const h = makeGame();
    expect([underworldPainted(), valleyPainted()]).toEqual([0, 0]);
    open(h, {
      cleared: W1_7,
      freed: FREED,
      pages: P8.slice(0, 7),
      position: { page: 'smb-7', node: '7-4' },
    });
    expect(h.map().page).toBe(WORLD_7_GALUGA);
    for (
      let i = 0;
      i < 3000 && !(lazySheetReady('underworld-above') && h.assets.sheetKeys().includes('underworld-above'));
      i++
    )
      h.step();
    expect(lazySheetReady('underworld-above')).toBe(true);
    for (let i = 0; i < 2 * PREPAINT_AFTER_FRAMES; i++) h.step();
    expect(valleyPainted()).toBe(0);
  });

  it('shows a file on any World 8 node on the same node, drawn from above, titled THE UNDERWORLD', () => {
    for (const n of WORLD_8.nodes) {
      const h = makeGame();
      open(h, { ...BEATEN, position: { page: 'smb-8', node: n.id } });
      const m = h.map();
      expect(m.page).toBe(WORLD_8_UNDERWORLD);
      expect(m.node, n.id).toBe(n.id);
      const at = WORLD_8_UNDERWORLD.nodes.find((x) => x.id === n.id);
      expect([m.hx, m.hy], n.id).toEqual([(at?.x ?? -1) * 16, (at?.y ?? -1) * 16]);
      expect(loadSave(1)?.position).toEqual({ page: 'smb-8', node: n.id });
      h.step();
      expect(h.r.frames.some((f) => f.sheet === 'underworld-above')).toBe(true);
      expect(h.r.texts).toContain('THE UNDERWORLD');
      expect(h.r.texts.some((t) => /BOWSER/.test(t))).toBe(false);
    }
  });

  it('walks every road, there and back, and the hatch', () => {
    const h = makeGame();
    open(h, { ...BEATEN, position: { page: 'smb-8', node: 'start' } });
    expect(h.said.some((s) => s.includes('THE UNDERWORLD'))).toBe(true);
    for (const to of ['8-1', '8-2', 'bonus-8', '8-2', '8-3', '8-4', '8-3', '8-2', '8-1', 'start'])
      walkTo(h, to);
  });

  it('a beaten file walks on from 8-4 to Lost World 1 and back, as before; every slide from above until Lost 1', () => {
    const h = makeGame();
    open(h, { ...BEATEN, position: { page: 'smb-7', node: '7-4' } });
    expect(slide(h, 'right', 'smb-8')).toBe(0);
    expect(h.map().page).toBe(WORLD_8_UNDERWORLD);
    for (const id of ['8-1', '8-2', '8-3', '8-4']) walkTo(h, id);
    // RIGHT from the fortress: up the east steps and off the edge on row 5, to Lost World 1.
    const s8l = slide(h, 'right', 'll-1');
    expect(s8l).toBeGreaterThan(0); // from above to side-on
    expect(h.map().node).toBe('start');
    expect(slide(h, 'left', 'smb-8')).toBeGreaterThan(0);
    expect(h.map().node).toBe('8-4');
    expect(h.map().page).toBe(WORLD_8_UNDERWORLD);
    for (const id of ['8-3', '8-2', '8-1', 'start']) walkTo(h, id);
    expect(slide(h, 'left', 'smb-7')).toBe(0);
    expect(h.map().node).toBe('7-4');
  });

  it('brings an old file up to date: a beaten file without Lost World 1 gets the road drawn in from 8-4', () => {
    const h = makeGame();
    open(h, { ...BEATEN, pages: P8, position: { page: 'smb-8', node: '8-4' } });
    expect(h.game.mapProgress.pages).toContain('ll-1');
    // World 8's part drawn in here; Lost World 1's waits for that page.
    expect(h.game.pendingReveal.filter((id) => id.startsWith('smb-8:'))).toEqual([]);
    // Its road on is drawn from the fortress's tile to the page's edge.
    h.step();
    const roads = h.r.frames.filter((f) => f.sheet === 'underworld-above' && f.frame.startsWith('road-'));
    expect(roads.some((f) => f.x === 13 * 16 && f.y === 7 * 16)).toBe(true);
    expect(roads.some((f) => f.x === 15 * 16 && f.y === 5 * 16)).toBe(true);
  });

  it('keeps the road on sealed until Sophia III is freed, the seal at the edge', () => {
    const h = makeGame();
    open(h, {
      ...BEATEN,
      freed: FREED,
      pages: P8,
      gameCleared: true,
      position: { page: 'smb-8', node: '8-4' },
    });
    expect(h.game.mapProgress.pages).not.toContain('ll-1');
    h.tap('right');
    for (let i = 0; i < 60; i++) h.step();
    expect(h.map().page.id).toBe('smb-8');
    expect(h.map().node).toBe('8-4');
  });

  it('outside the campaign, the classic page shows, titled BOWSER’S UNDERWORLD', () => {
    const h = makeGame();
    h.game.mapProgress.pages.push('smb-8');
    const m = new WorldMapScene(h.game, 'smb-8');
    expect(m.page).toBe(WORLD_8);
    expect(pageLook(mapPage('smb-8'), false)).toBe(WORLD_8);
    h.game.scenes.push(m);
    h.step();
    expect(h.r.frames.some((f) => f.sheet.endsWith('-above'))).toBe(false);
    expect(h.r.texts).toContain("BOWSER'S UNDERWORLD");
  });
});

describe.runIf(!VALLEY_LIVE)('the map menu’s Worlds without the Valley', () => {
  it('lists World 8 then Lost World 1, no Valley', () => {
    const h = makeGame();
    open(h, { ...BEATEN, position: { page: 'smb-8', node: '8-4' } });
    const ids = h
      .map()
      .worldsMenuPages()
      .map((p: WorldMapPage) => p.id);
    expect(ids.slice(7, 9)).toEqual(['smb-8', 'll-1']);
    expect(ids).not.toContain('valley-of-bowser');
  });
});
