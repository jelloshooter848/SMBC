import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { WORLD_4 } from '@content/worldmap/world4';
import { WORLD_5 } from '@content/worldmap/world5';
import { WORLD_3_MEGACITY } from '@content/worldmap/world3-megacity';
import { WORLD_4_ZEBES } from '@content/worldmap/world4-zebes';
import { WORLD_5_TRANSYLVANIA } from '@content/worldmap/world5-transylvania';
import { PALETTES, SPRITES } from '@content/sprites';
import { zebesPainted } from '@content/sprites/zebes-above';
import { transylvaniaPainted } from '@content/sprites/transylvania-above';
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
import { CardScene } from '@game/scenes/message';
import { HeroSightingScene } from '@game/story/hero-sighting';
import { beat } from '@game/story/beats';
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

// 0.4.52: Worlds 4 and 5 drawn from above in campaign play (world4-zebes.ts, world5-transylvania.ts),
// World 4 in the campaign order (map/campaign-order.ts: internal 4-2, Samus's cavern, first and
// shown as 4-1). A file anywhere on them loads where it was (an old file's stale reveals dropped),
// every road walks both ways, a clear draws its road in, the slides run 3 -> 4 -> 5 -> 6 and back
// (all drawn from above since 0.4.53: no seam), and the first World 4 node is Samus's
// level, its intro card, HUD and announcer saying 4-1. Classic play keeps the real ids.

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

const W1 = ['1-0', '1-1', '1-2', '1-3', '1-4'];
const W2 = ['2-1', '2-2', '2-3', '2-4'];
const W3 = ['3-1', '3-2', '3-3', '3-4'];
const W4 = ['4-1', '4-2', '4-3', '4-4'];
const W5 = ['5-1', '5-2', '5-3', '5-4'];
const FREED = ['mario', 'luigi', 'link', 'megaman'];
const P4 = ['smb-1', 'smb-2', 'smb-3', 'smb-4'];

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

describe('the Zebes and Transylvania sheets are painted ahead while the map idles, never at load', () => {
  // First in this file: nothing before it has drawn World 4 or 5.
  const h = makeGame();
  const painted = () => [zebesPainted(), transylvaniaPainted()];

  it('paints nothing at load or on the title screen', () => {
    expect(painted()).toEqual([0, 0]);
    h.game.showTitle();
    for (let i = 0; i < 2 * PREPAINT_AFTER_FRAMES; i++) h.step();
    expect(painted()).toEqual([0, 0]);
  });

  it('paints Zebes ahead once the hero stands idle on World 3, Transylvania not yet', () => {
    open(h, {
      cleared: [...W1, ...W2, ...W3],
      freed: FREED,
      pages: P4,
      position: { page: 'smb-3', node: '3-4' },
    });
    expect(h.map().page).toBe(WORLD_3_MEGACITY);
    for (
      let i = 0;
      i < 3000 && !(lazySheetReady('zebes-above') && h.assets.sheetKeys().includes('zebes-above'));
      i++
    )
      h.step();
    expect(lazySheetReady('zebes-above')).toBe(true);
    expect(h.assets.sheetKeys()).toContain('zebes-above');
    expect(transylvaniaPainted()).toBe(0);
  });
});

const PAGES: [string, WorldMapPage, WorldMapPage, Partial<SaveFile>, string[]][] = [
  [
    'World 4',
    WORLD_4,
    WORLD_4_ZEBES,
    {
      cleared: [...W1, ...W2, ...W3, ...W4],
      secrets: ['larry'],
      freed: [...FREED, 'samus'],
      pages: [...P4, 'smb-5'],
    },
    // Start, Samus's cavern (internal 4-2), its bonus spot, then on in the campaign order and back.
    ['4-2', 'bonus-4', '4-2', '4-1', '4-3', '4-4', '4-3', '4-1', '4-2', 'start'],
  ],
  [
    'World 5',
    WORLD_5,
    WORLD_5_TRANSYLVANIA,
    {
      cleared: [...W1, ...W2, ...W3, ...W4, ...W5],
      secrets: ['bonus-5'],
      freed: [...FREED, 'samus', 'simon'],
      pages: [...P4, 'smb-5', 'smb-6'],
    },
    ['5-1', 'bonus-5', '5-1', '5-2', '5-3', '5-4', '5-3', '5-2', '5-1', 'start'],
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

describe('World 4 in the campaign order', () => {
  const before = { cleared: [...W1, ...W2, ...W3], freed: FREED, pages: P4 };

  it('leads from the start to Samus’s cavern (internal 4-2), named WORLD 4-1 on the map', () => {
    const h = makeGame();
    open(h, { ...before, position: { page: 'smb-4', node: 'start' } });
    expect(h.map().page).toBe(WORLD_4_ZEBES);
    h.tap('down');
    h.until(() => h.map().mode === 'idle', 600);
    expect(h.map().node).toBe('4-2');
    expect(hiddenHeroesAt('smb-4', '4-2').map((x) => x.hero)).toContain('samus');
    expect(h.r.texts).toContain('WORLD 4-1');
    expect(h.said.some((s) => s.includes('World 4-1'))).toBe(true);
    // Internal 4-1 waits beyond it, unopened.
    expect(h.map().page.nodes.find((n) => n.id === '4-1')?.shown).toBe('4-2');
    expect(mapHeaderLabel(WORLD_4_ZEBES, WORLD_4_ZEBES.nodes.find((n) => n.id === '4-1') ?? null)).toBe(
      'WORLD 4-2',
    );
    expect(mapHeaderLabel(WORLD_4, WORLD_4.nodes.find((n) => n.id === '4-2') ?? null)).toBe('WORLD 4-2');
  });

  it('enters Samus’s level from the first node: the intro card, HUD and announcer say 4-1', () => {
    const h = makeGame();
    open(h, { ...before, position: { page: 'smb-4', node: '4-2' } });
    h.tap('jump');
    for (let i = 0; i < 300 && !(h.game.scenes.top instanceof IntroScene); i++) h.step(i % 2 ? [] : ['jump']);
    expect(h.game.scenes.top).toBeInstanceOf(IntroScene);
    expect(h.game.state.campaignOrder).toBe(true);
    expect([h.game.state.world, h.game.state.stage]).toEqual([4, 2]);
    h.step();
    expect(h.r.texts).toContain('WORLD 4-1');
    expect(h.r.texts).toContain('4-1');
    expect(h.said.some((s) => s.startsWith('World 4-1.'))).toBe(true);
    h.until(() => h.game.scenes.top instanceof LevelScene, 400);
    expect((h.game.scenes.top as LevelScene).level.id.startsWith('4-2')).toBe(true);
    h.step();
    expect(h.r.texts).toContain('4-1');
    expect(h.r.texts).not.toContain('4-2');
  });

  it('Samus’s sighting (0.4.52, K52) plays in her level from the first node, everything shown as 4-1', () => {
    const h = makeGame();
    const story = ALL_STORY.filter((id) => id !== beat.sighting('samus'));
    open(h, { ...before, story, position: { page: 'smb-4', node: '4-2' } });
    h.tap('jump');
    const texts: string[] = [];
    const seen = () => texts.push(...h.r.texts);
    for (let i = 0; i < 600 && !(h.game.scenes.top instanceof HeroSightingScene); i++) {
      h.step(i % 2 || h.game.scenes.top instanceof LevelScene ? [] : ['jump']);
      seen();
    }
    expect(h.game.scenes.top).toBeInstanceOf(HeroSightingScene);
    expect(h.game.state.campaignOrder).toBe(true);
    h.until(() => h.game.scenes.top instanceof CardScene, 600);
    h.step();
    seen();
    expect(h.r.texts.join(' ')).toContain('SAMUS!');
    // The HUD under the sighting and its card, and the intro before it, say 4-1, never 4-2.
    expect(texts).toContain('WORLD 4-1');
    expect(texts).toContain('4-1');
    expect(texts.some((t) => /\b4-2\b/.test(t))).toBe(false);
    expect(h.said.some((s) => /\b4-2\b/.test(s))).toBe(false);
    expect(h.said.some((s) => s.includes('Samus curls into a ball'))).toBe(true);
  });

  it('draws in the road on to internal 4-1 (shown 4-2) once Samus’s cavern is cleared', () => {
    const h = makeGame();
    open(h, { ...before, freed: [...FREED, 'samus'], position: { page: 'smb-4', node: '4-2' } });
    h.game.levelCleared('4-2');
    h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'reveal', 400);
    expect(h.map().page).toBe(WORLD_4_ZEBES);
    const roads = () =>
      h.r.frames.filter((f) => f.sheet === 'zebes-above' && f.frame.startsWith('deck-')).length;
    const counts: number[] = [];
    while (h.map().mode === 'reveal') {
      h.step();
      counts.push(roads());
    }
    expect(new Set(counts).size).toBeGreaterThan(3);
    expect(h.game.pendingReveal).toEqual([]);
    walkTo(h, '4-1');
  });

  it('classic play keeps the real ids: 4-2 is WORLD 4-2', () => {
    const h = makeGame();
    h.game.devStart('4-2', MARIO, 'small');
    h.until(() => h.game.scenes.top instanceof IntroScene, 50);
    expect(h.game.state.campaignOrder).toBe(false);
    h.step();
    expect(h.r.texts).toContain('WORLD 4-2');
    expect(h.said.some((s) => s.startsWith('World 4-2.'))).toBe(true);
  });
});

describe('old files on World 4 (before the campaign order)', () => {
  it('drops pending reveals of roads the new order no longer has; nodes and kept roads stay', () => {
    file({
      cleared: [...W1, ...W2, ...W3, '4-1'],
      freed: FREED,
      pages: P4,
      position: { page: 'smb-4', node: '4-1' },
      pendingReveal: [
        'smb-4:4-1>4-2',
        'smb-4:4-2',
        'smb-4:start>4-1',
        'smb-3:3-4>smb-4',
        'smb-4:4-2>bonus-4',
      ],
    });
    expect(loadSave(1)?.pendingReveal).toEqual(['smb-4:4-2', 'smb-3:3-4>smb-4', 'smb-4:4-2>bonus-4']);
  });

  it('a file that cleared internal 4-1 first loads on it and can still reach Samus’s cavern and the start', () => {
    const h = makeGame();
    open(h, {
      cleared: [...W1, ...W2, ...W3, '4-1'],
      freed: FREED,
      pages: P4,
      position: { page: 'smb-4', node: '4-1' },
      pendingReveal: ['smb-4:4-1>4-2'],
    });
    expect(h.map().node).toBe('4-1');
    expect(h.map().mode).toBe('idle');
    walkTo(h, '4-2');
    walkTo(h, 'start');
    walkTo(h, '4-2');
    walkTo(h, '4-1');
    walkTo(h, '4-3');
  });
});

describe('the slides 3 → 4 → 5 → 6 and back', () => {
  it('runs along each exit and back, the page’s edge shaded only between above and side-on', () => {
    const h = makeGame();
    open(h, {
      cleared: [...W1, ...W2, ...W3, ...W4, ...W5],
      secrets: ['larry'],
      freed: [...FREED, 'samus', 'simon'],
      pages: [...P4, 'smb-5', 'smb-6'],
      position: { page: 'smb-3', node: '3-4' },
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
    const s34 = slide('right', 'smb-4');
    expect(h.map().page).toBe(WORLD_4_ZEBES);
    for (const id of ['4-2', '4-1', '4-3', '4-4']) walkTo(h, id);
    // RIGHT from Tourian heads for World 5 along the escape (it leaves west, then east on top).
    const s45 = slide('right', 'smb-5');
    expect(h.map().page).toBe(WORLD_5_TRANSYLVANIA);
    for (const id of ['5-1', '5-2', '5-3', '5-4']) walkTo(h, id);
    const s56 = slide('down', 'smb-6');
    // World 6 is drawn from above too since 0.4.53 (above-maps-w67.test.ts): no seam on the way.
    expect([s34, s45, s56]).toEqual([0, 0, 0]);
    expect(slide('left', 'smb-5')).toBe(0);
    expect(h.map().node).toBe('5-4');
    for (const id of ['5-3', '5-2', '5-1', 'start']) walkTo(h, id);
    expect(slide('left', 'smb-4')).toBe(0);
    expect(h.map().node).toBe('4-4');
    for (const id of ['4-3', '4-1', '4-2', 'start']) walkTo(h, id);
    expect(slide('left', 'smb-3')).toBe(0);
    expect(h.map().node).toBe('3-4');
  });
});

describe('a node’s shown label', () => {
  it('reads the table on the campaign page, the id on the classic one', () => {
    const n = (p: WorldMapPage, id: string) => p.nodes.find((x) => x.id === id) as MapNode;
    expect(mapHeaderLabel(WORLD_4_ZEBES, n(WORLD_4_ZEBES, '4-2'))).toBe('WORLD 4-1');
    expect(mapHeaderLabel(WORLD_4_ZEBES, n(WORLD_4_ZEBES, '4-3'))).toBe('WORLD 4-3');
    expect(mapHeaderLabel(WORLD_5_TRANSYLVANIA, n(WORLD_5_TRANSYLVANIA, '5-1'))).toBe('WORLD 5-1');
  });
});
