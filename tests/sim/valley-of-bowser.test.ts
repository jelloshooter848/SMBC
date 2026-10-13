import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import type * as LevelIndex from '@content/levels';
import { mapPage } from '@content/worldmap';
import { WORLD_7_GALUGA } from '@content/worldmap/world7-galuga';
import { WORLD_8_UNDERWORLD } from '@content/worldmap/world8-underworld';
import { VALLEY_LIVE, VALLEY_OF_BOWSER } from '@content/worldmap/valley-of-bowser';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { MAP_HEADER_H, MAP_SLIDE_FRAMES, WorldMapScene } from '@game/scenes/world-map';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Dir } from '@game/map/rules';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ALL_STORY } from './story-seen';

// 0.4.54: the VALLEY OF BOWSER with its switch ON, as 0.4.55 turns it on: a level '8-5' in the level
// index (here BOWSER'S CASTLE stands in as 8-4's map; the real level comes with 0.4.55) and nothing
// else changed. World 8's road on leads to the Valley (Sophia's gate), the Valley's castle is
// BOWSER'S CASTLE (never "8-5"), and its road on to the Lost Levels is open once the castle is
// cleared or on a file that has beaten the game. The slides run 7 -> 8 -> Valley -> Lost 1 and back.

vi.mock('@content/levels', async (importOriginal) => {
  const real = await importOriginal<typeof LevelIndex>();
  return {
    ...real,
    levelIds: () => [...real.levelIds(), '8-5'],
    getLevel: (id: string) => (id === '8-5' ? { ...real.getLevel('8-4'), id: '8-5' } : real.getLevel(id)),
  };
});

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

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
const W1_8 = ['1-0', ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap(world)];
const FREED = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill', 'sophia'];
const P8 = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);

function file(over: Partial<SaveFile> = {}): SaveFile {
  const s = { ...newSave(1, MARIO.id), story: [...ALL_STORY], ...over };
  writeSave(s);
  return s;
}

function open(h: H, over: Partial<SaveFile>): void {
  h.game.openFile(1, file(over));
  h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'idle', 1200);
  for (let i = 0; i < 10; i++) h.step();
}

function dirOf(points: readonly (readonly [number, number])[]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

function walkTo(h: H, to: string): void {
  const m = h.map();
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q?.points ?? [])].reverse();
  h.tap(dirOf(pts));
  h.until(() => m.mode === 'idle', 600);
  expect(m.node).toBe(to);
}

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

/** Just after 8-4 (its fake king beaten, Sophia III freed): the game not beaten yet. */
const AFTER_8_4: Partial<SaveFile> = { cleared: W1_8, freed: FREED, pages: P8, gameCleared: false };
/** A file that beat the game before the Valley existed: Lost World 1 open, the credits seen. */
const BEATEN: Partial<SaveFile> = { cleared: W1_8, freed: FREED, pages: [...P8, 'll-1'], gameCleared: true };

describe('the switch is on: a level 8-5 exists', () => {
  it('registers the Valley and leads campaign World 8’s road there; nothing else had to change', () => {
    expect(VALLEY_LIVE).toBe(true);
    expect(mapPage('valley-of-bowser')).toBe(VALLEY_OF_BOWSER);
    expect(WORLD_8_UNDERWORLD.exits.map((e) => `${e.from}>${e.to}`)).toEqual(['8-4>valley-of-bowser']);
  });
});

describe('the VALLEY OF BOWSER in play (switch on)', () => {
  it('opens after 8-4 with Sophia III freed: the road draws in, the slide arrives, its song plays', () => {
    const h = makeGame();
    open(h, { ...AFTER_8_4, position: { page: 'smb-8', node: '8-4' } });
    expect(h.game.mapProgress.pages).toContain('valley-of-bowser');
    expect(h.map().page).toBe(WORLD_8_UNDERWORLD);
    h.audio.playMusic.mockClear();
    expect(slide(h, 'right', 'valley-of-bowser')).toBe(0); // from above to above
    expect(h.map().page).toBe(VALLEY_OF_BOWSER);
    expect(h.map().node).toBe('start');
    expect(h.audio.playMusic).toHaveBeenCalledWith('map-valley');
    h.step();
    expect(h.r.frames.some((f) => f.sheet === 'valley-above')).toBe(true);
    expect(h.r.texts).toContain('VALLEY OF BOWSER');
  });

  it('names its castle BOWSER’S CASTLE on the header and to the announcer, never 8-5; its road on stays shut', () => {
    const h = makeGame();
    open(h, {
      ...AFTER_8_4,
      pages: [...P8, 'valley-of-bowser'],
      position: { page: 'valley-of-bowser', node: 'start' },
    });
    h.said.length = 0;
    walkTo(h, 'bowsers-castle');
    h.step();
    expect(h.r.texts).toContain("BOWSER'S CASTLE");
    expect(h.r.texts).toContain('VALLEY');
    expect(h.said.some((s) => s.includes("Bowser's Castle, open"))).toBe(true);
    expect(h.r.texts.some((t) => t.includes('8-5'))).toBe(false);
    expect(h.said.some((s) => s.includes('8-5'))).toBe(false);
    // Not cleared and the game not beaten: RIGHT bumps.
    h.tap('right');
    for (let i = 0; i < 60; i++) h.step();
    expect(h.map().page.id).toBe('valley-of-bowser');
    expect(h.map().node).toBe('bowsers-castle');
    expect(h.game.mapProgress.pages).not.toContain('ll-1');
  });

  it('says its name once on arrival: "VALLEY OF BOWSER", not "Valley, VALLEY OF BOWSER" (INT55)', () => {
    const h = makeGame();
    h.said.length = 0;
    open(h, {
      ...AFTER_8_4,
      pages: [...P8, 'valley-of-bowser'],
      position: { page: 'valley-of-bowser', node: 'start' },
    });
    for (let i = 0; i < 5; i++) h.step();
    expect(h.said.some((s) => s.startsWith('VALLEY OF BOWSER. '))).toBe(true);
    expect(h.said.some((s) => /Valley, VALLEY/i.test(s))).toBe(false);
  });

  it('a file that beat the game before the Valley: loads clean, the Valley opens, its road on is open', () => {
    // Its old reveal of World 8's road to Lost World 1 names a road campaign World 8 no longer has.
    const h = makeGame();
    open(h, {
      ...BEATEN,
      position: { page: 'll-1', node: 'start' },
      pendingReveal: ['smb-8:8-4>ll-1'],
    });
    expect(h.map().page.id).toBe('ll-1');
    expect(loadSave(1)?.pendingReveal.includes('smb-8:8-4>ll-1')).toBe(false);
    expect(h.game.mapProgress.pages).toContain('valley-of-bowser');
    expect(h.game.mapProgress.cleared).not.toContain('8-5');
    // Back from Lost World 1's start: to the Valley's castle, and on back to World 8.
    expect(slide(h, 'left', 'valley-of-bowser')).toBeGreaterThan(0);
    expect(h.map().node).toBe('bowsers-castle');
    expect(slide(h, 'right', 'll-1')).toBeGreaterThan(0);
    expect(slide(h, 'left', 'valley-of-bowser')).toBeGreaterThan(0);
    walkTo(h, 'start');
    expect(slide(h, 'left', 'smb-8')).toBe(0);
    expect(h.map().node).toBe('8-4');
  });

  it('slides 7 → 8 → Valley and back, all from above', () => {
    const h = makeGame();
    open(h, {
      ...BEATEN,
      pages: [...P8, 'valley-of-bowser', 'll-1'],
      position: { page: 'smb-7', node: '7-4' },
    });
    expect(h.map().page).toBe(WORLD_7_GALUGA);
    expect(slide(h, 'right', 'smb-8')).toBe(0);
    for (const id of ['8-1', '8-2', '8-3', '8-4']) walkTo(h, id);
    expect(slide(h, 'right', 'valley-of-bowser')).toBe(0);
    walkTo(h, 'bowsers-castle');
    walkTo(h, 'start');
    expect(slide(h, 'left', 'smb-8')).toBe(0);
    expect(h.map().node).toBe('8-4');
  });

  it('lists the Valley in the Worlds menu between World 8 and Lost World 1', () => {
    const h = makeGame();
    open(h, {
      ...BEATEN,
      pages: [...P8, 'valley-of-bowser', 'll-1'],
      position: { page: 'valley-of-bowser', node: 'start' },
    });
    const ids = h
      .map()
      .worldsMenuPages()
      .map((p) => p.id);
    expect(ids.slice(7, 10)).toEqual(['smb-8', 'valley-of-bowser', 'll-1']);
  });
});
