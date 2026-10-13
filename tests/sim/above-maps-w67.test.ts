import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { WORLD_6 } from '@content/worldmap/world6';
import { WORLD_7 } from '@content/worldmap/world7';
import { WORLD_8 } from '@content/worldmap/world8';
import { WORLD_5_TRANSYLVANIA } from '@content/worldmap/world5-transylvania';
import { WORLD_6_GALESBURG } from '@content/worldmap/world6-galesburg';
import { WORLD_7_GALUGA } from '@content/worldmap/world7-galuga';
import { PALETTES, SPRITES } from '@content/sprites';
import { galesburgPainted } from '@content/sprites/galesburg-above';
import { galugaPainted } from '@content/sprites/galuga-above';
import { lazySheetReady } from '@content/worldmap/above-render';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import {
  MAP_HEADER_H,
  MAP_SLIDE_FRAMES,
  mapHeaderLabel,
  PREPAINT_AFTER_FRAMES,
  WorldMapScene,
} from '@game/scenes/world-map';
import { hiddenHeroesAt } from '@game/map/captives';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Dir } from '@game/map/rules';
import type { MapNode, WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ALL_STORY } from './story-seen';

// 0.4.53: Worlds 6 and 7 drawn from above in campaign play (world6-galesburg.ts, world7-galuga.ts),
// both in the campaign order (map/campaign-order.ts): World 6 opens on Ryu's level, internal 6-2,
// shown 6-1; World 7 on Bill's, internal 7-3, shown 7-1 (then 7-1 shown 7-2, 7-2 shown 7-3). A file
// anywhere on them loads where it was (an old file's stale reveals dropped), every road walks both
// ways, a clear draws its road in, the slides run 5 -> 6 -> 7 -> 8 and back (the page's edge shaded
// only between above and side-on: 7 to 8), and the first node of each world is its hero's level,
// its intro card, HUD and announcer saying 6-1 or 7-1. Classic play keeps the real ids.

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
  return { game, step, tap, until, map, r, assets, said };
}
type H = ReturnType<typeof makeGame>;

const world = (w: number) => [1, 2, 3, 4].map((s) => `${w}-${s}`);
const W1_5 = ['1-0', ...world(1), ...world(2), ...world(3), ...world(4), ...world(5)];
const FREED = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon'];
const P6 = ['smb-1', 'smb-2', 'smb-3', 'smb-4', 'smb-5', 'smb-6'];

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

describe('the Galesburg and Galuga Island sheets are painted ahead while the map idles, never at load', () => {
  // First in this file: nothing before it has drawn World 6 or 7.
  const h = makeGame();
  const painted = () => [galesburgPainted(), galugaPainted()];

  it('paints nothing at load or on the title screen', () => {
    expect(painted()).toEqual([0, 0]);
    h.game.showTitle();
    for (let i = 0; i < 2 * PREPAINT_AFTER_FRAMES; i++) h.step();
    expect(painted()).toEqual([0, 0]);
  });

  it('paints Galesburg ahead once the hero stands idle on World 5, Galuga Island not yet', () => {
    open(h, { cleared: W1_5, freed: FREED, pages: P6, position: { page: 'smb-5', node: '5-4' } });
    expect(h.map().page).toBe(WORLD_5_TRANSYLVANIA);
    for (
      let i = 0;
      i < 3000 && !(lazySheetReady('galesburg-above') && h.assets.sheetKeys().includes('galesburg-above'));
      i++
    )
      h.step();
    expect(lazySheetReady('galesburg-above')).toBe(true);
    expect(h.assets.sheetKeys()).toContain('galesburg-above');
    expect(galugaPainted()).toBe(0);
  });
});

const PAGES: [string, WorldMapPage, WorldMapPage, Partial<SaveFile>, string[]][] = [
  [
    'World 6',
    WORLD_6,
    WORLD_6_GALESBURG,
    {
      cleared: [...W1_5, ...world(6)],
      secrets: ['bonus-6'],
      freed: [...FREED, 'ryu'],
      pages: [...P6, 'smb-7'],
    },
    // Start, Ryu's level (internal 6-2), on in the campaign order, the hot spring, and back.
    ['6-2', '6-1', '6-3', 'bonus-6', '6-3', '6-4', '6-3', '6-1', '6-2', 'start'],
  ],
  [
    'World 7',
    WORLD_7,
    WORLD_7_GALUGA,
    {
      cleared: [...W1_5, ...world(6), ...world(7)],
      secrets: ['bonus-7'],
      freed: [...FREED, 'ryu', 'bill'],
      pages: [...P6, 'smb-7', 'smb-8'],
    },
    // Start, Bill's camp (internal 7-3), the snowfield (7-1), the river (7-2), the capsule pad, the lair.
    ['7-3', '7-1', '7-2', 'bonus-7', '7-2', '7-4', '7-2', '7-1', '7-3', 'start'],
  ],
];

describe.each(PAGES)('%s from above (campaign play)', (_, classic, page, save, walk) => {
  it('shows a file on any of its nodes on the same node, drawn from above', () => {
    for (const n of classic.nodes) {
      const h = makeGame();
      open(h, { ...save, position: { page: classic.id, node: n.id } });
      const m = h.map();
      expect(m.page).toBe(page);
      expect(m.node, n.id).toBe(n.id);
      const at = page.nodes.find((x) => x.id === n.id);
      expect([m.hx, m.hy], n.id).toEqual([(at?.x ?? -1) * 16, (at?.y ?? -1) * 16]);
      expect(loadSave(1)?.position).toEqual({ page: classic.id, node: n.id });
      h.step();
      expect(h.r.frames.some((f) => f.sheet === `${page.above}-above`)).toBe(true);
      expect(h.r.frames.some((f) => f.sheet.startsWith('td-mario') && f.frame === 'down-0')).toBe(true);
      expect(h.r.frames.some((f) => f.frame === 'map-path-dot')).toBe(false);
    }
  });

  it('walks every road, there and back', () => {
    const h = makeGame();
    open(h, { ...save, position: { page: classic.id, node: 'start' } });
    for (const to of walk) walkTo(h, to);
  });

  it('outside the campaign, the classic page shows', () => {
    const h = makeGame();
    h.game.mapProgress.pages.push(classic.id);
    const m = new WorldMapScene(h.game, classic.id);
    expect(m.page).toBe(classic);
    h.game.scenes.push(m);
    h.step();
    expect(h.r.frames.some((f) => f.sheet.endsWith('-above'))).toBe(false);
  });
});

const ORDER: [string, WorldMapPage, string, string, string, Partial<SaveFile>][] = [
  // World, its page, the hero's level (internal), its label, the hero, a file arriving there.
  ['World 6', WORLD_6_GALESBURG, '6-2', '6-1', 'ryu', { cleared: W1_5, freed: FREED, pages: P6 }],
  [
    'World 7',
    WORLD_7_GALUGA,
    '7-3',
    '7-1',
    'bill',
    { cleared: [...W1_5, ...world(6)], freed: [...FREED, 'ryu'], pages: [...P6, 'smb-7'] },
  ],
];

describe.each(ORDER)('%s in the campaign order', (_, page, first, label, hero, before) => {
  const w = Number(first[0]);

  it(`leads from the start to the hero’s level (internal ${first}), named WORLD ${label} on the map`, () => {
    const h = makeGame();
    open(h, { ...before, position: { page: page.id, node: 'start' } });
    expect(h.map().page).toBe(page);
    h.tap('right');
    h.until(() => h.map().mode === 'idle', 600);
    expect(h.map().node).toBe(first);
    expect(hiddenHeroesAt(page.id, first).map((x) => x.hero)).toContain(hero);
    expect(h.r.texts).toContain(`WORLD ${label}`);
    expect(h.said.some((s) => s.includes(`World ${label}`))).toBe(true);
    // Every level node reads its campaign label; the classic page its id.
    const n = (p: WorldMapPage, id: string) => p.nodes.find((x) => x.id === id) as MapNode;
    const shown = w === 6 ? ['6-2', '6-1', '6-3', '6-4'] : ['7-2', '7-3', '7-1', '7-4'];
    expect([1, 2, 3, 4].map((s) => mapHeaderLabel(page, n(page, `${w}-${s}`)))).toEqual(
      shown.map((l) => `WORLD ${l}`),
    );
    const classic = w === 6 ? WORLD_6 : WORLD_7;
    expect(mapHeaderLabel(classic, n(classic, first))).toBe(`WORLD ${first}`);
  });

  it(`enters the hero’s level from the first node: the intro card, HUD and announcer say ${label}`, () => {
    const h = makeGame();
    open(h, { ...before, position: { page: page.id, node: first } });
    h.tap('jump');
    for (let i = 0; i < 300 && !(h.game.scenes.top instanceof IntroScene); i++) h.step(i % 2 ? [] : ['jump']);
    expect(h.game.scenes.top).toBeInstanceOf(IntroScene);
    expect(h.game.state.campaignOrder).toBe(true);
    expect([h.game.state.world, h.game.state.stage]).toEqual([w, Number(first[2])]);
    h.step();
    expect(h.r.texts).toContain(`WORLD ${label}`);
    expect(h.said.some((s) => s.startsWith(`World ${label}.`))).toBe(true);
    h.until(() => h.game.scenes.top instanceof LevelScene, 400);
    expect((h.game.scenes.top as LevelScene).level.id.startsWith(first)).toBe(true);
    h.step();
    expect(h.r.texts).toContain(label);
    expect(h.r.texts).not.toContain(first);
  });

  it('draws in the road on to the next level once the hero’s level is cleared', () => {
    const h = makeGame();
    open(h, { ...before, freed: [...(before.freed ?? []), hero], position: { page: page.id, node: first } });
    h.game.levelCleared(first);
    h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'reveal', 400);
    expect(h.map().page).toBe(page);
    const roads = () =>
      h.r.frames.filter((f) => f.sheet === `${page.above}-above` && f.frame.startsWith('road-')).length;
    const counts: number[] = [];
    while (h.map().mode === 'reveal') {
      h.step();
      counts.push(roads());
    }
    expect(new Set(counts).size).toBeGreaterThan(3);
    expect(h.game.pendingReveal).toEqual([]);
    walkTo(h, `${w}-1`);
  });

  it(`classic play keeps the real ids: ${first} is WORLD ${first}`, () => {
    const h = makeGame();
    h.game.devStart(first, MARIO, 'small');
    h.until(() => h.game.scenes.top instanceof IntroScene, 50);
    expect(h.game.state.campaignOrder).toBe(false);
    h.step();
    expect(h.r.texts).toContain(`WORLD ${first}`);
    expect(h.said.some((s) => s.startsWith(`World ${first}.`))).toBe(true);
  });
});

describe('old files on Worlds 6 and 7 (before the campaign order)', () => {
  it('drops pending reveals of roads the new order no longer has; nodes and kept roads stay', () => {
    file({
      cleared: [...W1_5, '6-1'],
      freed: FREED,
      pages: P6,
      position: { page: 'smb-6', node: '6-1' },
      pendingReveal: [
        'smb-6:start>6-1',
        'smb-6:6-1>6-2',
        'smb-6:6-2',
        'smb-6:6-2>6-3',
        'smb-6:6-3>6-4',
        'smb-6:6-3>bonus-6',
        'smb-5:5-4>smb-6',
      ],
    });
    expect(loadSave(1)?.pendingReveal).toEqual([
      'smb-6:6-2',
      'smb-6:6-3>6-4',
      'smb-6:6-3>bonus-6',
      'smb-5:5-4>smb-6',
    ]);
    file({
      cleared: [...W1_5, ...world(6), '7-1'],
      freed: [...FREED, 'ryu'],
      pages: [...P6, 'smb-7'],
      position: { page: 'smb-7', node: '7-1' },
      pendingReveal: [
        'smb-7:start>7-1',
        'smb-7:7-1>7-2',
        'smb-7:7-2>7-3',
        'smb-7:7-3>7-4',
        'smb-7:7-2>bonus-7',
      ],
    });
    // '7-1>7-2' is a road of the new order too, so it stays.
    expect(loadSave(1)?.pendingReveal).toEqual(['smb-7:7-1>7-2', 'smb-7:7-2>bonus-7']);
  });

  it('a World 6 file that cleared internal 6-1 first loads on it and can still reach Ryu’s level and the start', () => {
    const h = makeGame();
    open(h, {
      cleared: [...W1_5, '6-1'],
      freed: FREED,
      pages: P6,
      position: { page: 'smb-6', node: '6-1' },
      pendingReveal: ['smb-6:6-1>6-2'],
    });
    expect(h.map().node).toBe('6-1');
    expect(h.map().mode).toBe('idle');
    for (const id of ['6-2', 'start', '6-2', '6-1', '6-3']) walkTo(h, id);
  });

  it('a World 7 file mid-world (7-1 and 7-2 cleared, on 7-2) loads there and reaches every level', () => {
    const h = makeGame();
    open(h, {
      cleared: [...W1_5, ...world(6), '7-1', '7-2'],
      freed: [...FREED, 'ryu'],
      pages: [...P6, 'smb-7'],
      position: { page: 'smb-7', node: '7-2' },
      pendingReveal: ['smb-7:7-2>7-3', 'smb-7:7-3'],
    });
    expect(h.map().node).toBe('7-2');
    expect(h.map().mode).toBe('idle');
    for (const id of ['7-4', '7-2', '7-1', '7-3', 'start']) walkTo(h, id);
  });
});

describe('the slides 5 → 6 → 7 → 8 and back', () => {
  it('runs along each exit and back, the page’s edge shaded only between above and side-on (7 to 8)', () => {
    const h = makeGame();
    open(h, {
      cleared: [...W1_5, ...world(6), ...world(7)],
      freed: [...FREED, 'ryu', 'bill'],
      pages: [...P6, 'smb-7', 'smb-8'],
      position: { page: 'smb-5', node: '5-4' },
    });
    const slide = (dir: Action, to: string): number => {
      h.tap(dir);
      h.until(() => h.map().mode === 'slide', 600);
      h.step();
      const seam = h.r.rects;
      for (let i = 0; i < MAP_SLIDE_FRAMES; i++) h.step();
      h.until(() => h.map().mode === 'idle', 800);
      expect(h.map().page.id).toBe(to);
      return seam;
    };
    const s56 = slide('down', 'smb-6');
    expect(h.map().page).toBe(WORLD_6_GALESBURG);
    for (const id of ['6-2', '6-1', '6-3', '6-4']) walkTo(h, id);
    const s67 = slide('right', 'smb-7');
    expect(h.map().page).toBe(WORLD_7_GALUGA);
    for (const id of ['7-3', '7-1', '7-2', '7-4']) walkTo(h, id);
    const s78 = slide('right', 'smb-8');
    expect(h.map().page).toBe(WORLD_8);
    expect([s56, s67]).toEqual([0, 0]);
    expect(s78).toBeGreaterThan(0);
    expect(slide('left', 'smb-7')).toBeGreaterThan(0);
    expect(h.map().node).toBe('7-4');
    for (const id of ['7-2', '7-1', '7-3', 'start']) walkTo(h, id);
    expect(slide('left', 'smb-6')).toBe(0);
    expect(h.map().node).toBe('6-4');
    for (const id of ['6-3', '6-1', '6-2', 'start']) walkTo(h, id);
    expect(slide('left', 'smb-5')).toBe(0);
    expect(h.map().node).toBe('5-4');
  });
});
