import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { WORLD_2 } from '@content/worldmap/world2';
import { WORLD_3 } from '@content/worldmap/world3';
import { WORLD_2_HYRULE } from '@content/worldmap/world2-hyrule';
import { WORLD_3_MEGACITY } from '@content/worldmap/world3-megacity';
import { WORLD_1_KINGDOM } from '@content/worldmap/world1-kingdom';
import { PALETTES, SPRITES } from '@content/sprites';
import { hyrulePainted } from '@content/sprites/hyrule-above';
import { megacityPainted } from '@content/sprites/megacity-above';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import {
  MAP_HEADER_H,
  MAP_SLIDE_FRAMES,
  mapHeaderLabel,
  PREPAINT_AFTER_FRAMES,
  WorldMapScene,
} from '@game/scenes/world-map';
import { lazySheetReady } from '@content/worldmap/above-render';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Dir } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ALL_STORY } from './story-seen';
import { resolvePalette } from '@engine/gfx/palette';
import { shadeTheme } from '@content/worldmap/above-render';

// 0.4.50: Worlds 2 and 3 drawn from above in campaign play (world2-hyrule.ts, world3-megacity.ts).
// The pages keep World 2 and 3's node and road ids, so a file anywhere on them loads where it was,
// every road walks, reveals draw in, the bonus spots show used, the slides run 1 → 2 → 3 → 4 and
// back, and each sheet is painted the first time its page shows, never when the game loads.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Records the sprite frames drawn, by sheet, and the seam's shades. */
class FrameRenderer implements Renderer {
  frames: { sheet: string; frame: string; x: number; y: number; flip: boolean }[] = [];
  rects = 0;
  clear(): void {}
  rect(_x: number, y: number, _w: number, h: number): void {
    // The seam's shade: full height under the header (drawPageSeam).
    if (y === MAP_HEADER_H && h === 240 - MAP_HEADER_H) this.rects++;
  }
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(s: SpriteSheet, frame: string, x: number, y: number, flip?: boolean): void {
    this.frames.push({ sheet: s.id, frame, x, y, flip: !!flip });
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
  return { game, step, tap, until, map, r, assets };
}
type H = ReturnType<typeof makeGame>;

const ALL_W1 = ['1-0', '1-1', '1-2', '1-3', '1-4'];
const ALL_W2 = ['2-1', '2-2', '2-3', '2-4'];
const ALL_W3 = ['3-1', '3-2', '3-3', '3-4'];
const FREED = ['mario', 'luigi', 'link', 'megaman'];

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

const PAGES: [string, WorldMapPage, WorldMapPage, string, Partial<SaveFile>][] = [
  [
    'World 2',
    WORLD_2,
    WORLD_2_HYRULE,
    'hyrule-above',
    {
      cleared: [...ALL_W1, ...ALL_W2],
      secrets: ['bonus-2', 'kakariko'],
      freed: FREED,
      pages: ['smb-1', 'smb-2', 'smb-3'],
    },
  ],
  [
    'World 3',
    WORLD_3,
    WORLD_3_MEGACITY,
    'megacity-above',
    {
      cleared: [...ALL_W1, ...ALL_W2, ...ALL_W3],
      secrets: ['bonus-3'],
      freed: FREED,
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
    },
  ],
];

describe('the sheets are painted ahead while the map idles, never when the game loads', () => {
  // First in this file: nothing before it has drawn World 2 or 3. The steps share the sheets' state.
  const h = makeGame();
  const painted = () => [hyrulePainted(), megacityPainted()];
  const ready = (id: string) => lazySheetReady(id) && h.assets.sheetKeys().includes(id);

  it('paints nothing at load or on the title screen', () => {
    expect(painted()).toEqual([0, 0]);
    h.game.showTitle();
    for (let i = 0; i < 2 * PREPAINT_AFTER_FRAMES; i++) h.step();
    expect(painted()).toEqual([0, 0]);
    expect(h.assets.sheetKeys().filter((k) => k.endsWith('-above'))).toEqual([]);
  });

  it('paints Hyrule ahead in slices once the hero stands idle on World 1, Mega City not yet', () => {
    open(h, {
      cleared: [...ALL_W1, ...ALL_W2],
      freed: FREED,
      pages: ['smb-1', 'smb-2', 'smb-3'],
      position: { page: 'smb-1', node: '1-4' },
    });
    expect(h.map().page).toBe(WORLD_1_KINGDOM);
    expect(painted()).toEqual([0, 0]);
    // About a second idle first, then a slice a frame (PREPAINT_BUDGET_MS) until the sheet is
    // painted and rasterized.
    let idle = 0;
    while (hyrulePainted() === 0 && idle < 2 * PREPAINT_AFTER_FRAMES) {
      h.step();
      idle++;
    }
    expect(idle).toBeGreaterThan(PREPAINT_AFTER_FRAMES / 2);
    const counts: number[] = [];
    for (let i = 0; i < 2000 && !ready('hyrule-above'); i++) {
      h.step();
      counts.push(hyrulePainted());
    }
    expect(ready('hyrule-above')).toBe(true);
    expect(new Set(counts).size).toBeGreaterThan(3);
    expect(megacityPainted()).toBe(0);
  });

  it('slides to World 2 with no first-show paint', () => {
    const before = hyrulePainted();
    h.tap('right');
    h.until(() => h.map().mode === 'slide', 200);
    h.step();
    expect(h.r.frames.some((f) => f.sheet === 'hyrule-above')).toBe(true);
    for (let i = 0; i < MAP_SLIDE_FRAMES; i++) h.step();
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page).toBe(WORLD_2_HYRULE);
    expect(hyrulePainted()).toBe(before);
    expect(megacityPainted()).toBe(0);
  });

  it('outside the campaign, idling paints nothing ahead (the classic pages are side-on)', () => {
    const c = makeGame();
    c.game.mapProgress.pages.push('smb-2');
    c.game.scenes.push(new WorldMapScene(c.game, 'smb-2'));
    for (let i = 0; i < 3 * PREPAINT_AFTER_FRAMES; i++) c.step();
    expect(megacityPainted()).toBe(0);
  });
});

describe.each(PAGES)('%s from above (campaign play)', (_, classic, page, sheet, save) => {
  it('shows an old file on any of its nodes on the same node, drawn from above', () => {
    for (const n of classic.nodes) {
      const h = makeGame();
      open(h, { ...save, position: { page: classic.id, node: n.id } });
      const m = h.map();
      expect(m.page).toBe(page);
      expect(m.node, n.id).toBe(n.id);
      const at = page.nodes.find((x) => x.id === n.id);
      expect([m.hx, m.hy], n.id).toEqual([(at?.x ?? -1) * 16, (at?.y ?? -1) * 16]);
      // Saved back unchanged: the file keeps the node id.
      expect(loadSave(1)?.position).toEqual({ page: classic.id, node: n.id });
      h.step();
      expect(h.r.frames.some((f) => f.sheet === sheet && /^(grass|pavement)-/.test(f.frame))).toBe(true);
      expect(h.r.frames.some((f) => f.sheet.startsWith('td-mario') && f.frame === 'down-0')).toBe(true);
      expect(h.r.frames.some((f) => f.frame === 'map-path-dot')).toBe(false);
    }
  });

  it('walks every road, there and back', () => {
    const h = makeGame();
    open(h, { ...save, position: { page: classic.id, node: 'start' } });
    const w = classic.id === 'smb-2' ? '2' : '3';
    for (const to of [
      `${w}-1`,
      `bonus-${w}`,
      `${w}-1`,
      `${w}-2`,
      `${w}-3`,
      `${w}-4`,
      `${w}-3`,
      `${w}-2`,
      `${w}-1`,
      'start',
    ])
      walkTo(h, to);
  });

  it('draws a cleared level’s road in tile by tile, then its node', () => {
    const h = makeGame();
    const w = classic.id === 'smb-2' ? '2' : '3';
    const before = classic.id === 'smb-2' ? ALL_W1 : [...ALL_W1, ...ALL_W2];
    h.game.openFile(
      1,
      file({
        cleared: before,
        freed: FREED,
        pages: save.pages ?? [],
        position: { page: classic.id, node: `${w}-1` },
      }),
    );
    h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'idle', 1200);
    h.game.levelCleared(`${w}-1`);
    h.until(() => h.map() instanceof WorldMapScene && h.map().mode === 'reveal', 400);
    expect(h.map().page).toBe(page);
    const roads = () => h.r.frames.filter((f) => f.sheet === sheet && /^(road|walk)-/.test(f.frame)).length;
    const counts: number[] = [];
    while (h.map().mode === 'reveal') {
      h.step();
      counts.push(roads());
    }
    expect(counts.every((c, i) => i === 0 || c >= (counts[i - 1] as number))).toBe(true);
    expect(new Set(counts).size).toBeGreaterThan(3);
    h.step();
    // Link's 2-1 has a secret exit (its pad keeps the keyhole); 3-1 is a plain space.
    expect(h.r.frames.some((f) => f.sheet === sheet && /^node-(secret-)?cleared$/.test(f.frame))).toBe(true);
  });

  it('outside the campaign, the classic page shows', () => {
    const h = makeGame();
    h.game.mapProgress.pages.push(classic.id);
    const m = new WorldMapScene(h.game, classic.id);
    expect(h.game.campaign).toBeNull();
    expect(m.page).toBe(classic);
    h.game.scenes.push(m);
    h.step();
    expect(h.r.frames.some((f) => f.sheet === sheet)).toBe(false);
  });
});

describe('the bonus spots from above', () => {
  it('Hyrule: the Top Secret Area’s cave sparkles until Kakariko is found', () => {
    const at = (secrets: string[]) => {
      const h = makeGame();
      open(h, { ...(PAGES[0]?.[4] ?? {}), secrets, position: { page: 'smb-2', node: '2-1' } });
      h.step();
      return h.r.frames
        .filter((f) => f.sheet === 'hyrule-above' && f.frame.startsWith('bonus'))
        .map((f) => f.frame);
    };
    expect(at(['bonus-2'])).toEqual(['bonus']);
    expect(at(['bonus-2', 'kakariko'])).toEqual(['bonus-cleared']);
  });

  it('Mega City: the hatch is open while the bonus game is, shut once used', () => {
    const at = (bonusOpen: boolean) => {
      const h = makeGame();
      open(h, { ...(PAGES[1]?.[4] ?? {}), bonusOpen, position: { page: 'smb-3', node: '3-1' } });
      h.step();
      return h.r.frames
        .filter((f) => f.sheet === 'megacity-above' && f.frame.startsWith('bonus'))
        .map((f) => f.frame);
    };
    expect(at(true)).toEqual(['bonus']);
    expect(at(false)).toEqual(['bonus-cleared']);
  });
});

describe('the slides 1 → 2 → 3 → 4 and back', () => {
  it('runs along each exit and back, with the page’s edge shaded only where the view turns', () => {
    const h = makeGame();
    open(h, {
      cleared: [...ALL_W1, ...ALL_W2, ...ALL_W3],
      freed: FREED,
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
      position: { page: 'smb-1', node: '1-4' },
    });
    const slide = (dir: Action, from: string, to: string, ids: string[]) => {
      // Walk the page to the node the slide leaves from.
      for (const id of ids) walkTo(h, id);
      expect(h.map().node).toBe(from);
      h.tap(dir);
      h.until(() => h.map().mode === 'slide', 400);
      h.step();
      const seam = h.r.rects;
      for (let i = 0; i < MAP_SLIDE_FRAMES; i++) h.step();
      h.until(() => h.map().mode === 'idle', 800);
      expect(h.map().page.id).toBe(to);
      return seam;
    };
    const s12 = slide('right', '1-4', 'smb-2', []);
    expect(h.map().page).toBe(WORLD_2_HYRULE);
    const s23 = slide('right', '2-4', 'smb-3', ['2-1', '2-2', '2-3', '2-4']);
    expect(h.map().page).toBe(WORLD_3_MEGACITY);
    const s34 = slide('right', '3-4', 'smb-4', ['3-1', '3-2', '3-3', '3-4']);
    // Above to above draws no seam; Mega City to World 4 (side-on) does.
    expect([s12, s23]).toEqual([0, 0]);
    expect(s34).toBeGreaterThan(0);
    const back = slide('left', 'start', 'smb-3', []);
    expect(h.map().page).toBe(WORLD_3_MEGACITY);
    expect(h.map().node).toBe('3-4');
    expect(back).toBeGreaterThan(0);
    for (const id of ['3-3', '3-2', '3-1', 'start']) walkTo(h, id);
    slide('left', 'start', 'smb-2', []);
    expect(h.map().node).toBe('2-4');
    for (const id of ['2-3', '2-2', '2-1', 'start']) walkTo(h, id);
    slide('left', 'start', 'smb-1', []);
    expect(h.map().page).toBe(WORLD_1_KINGDOM);
    expect(h.map().node).toBe('1-4');
  });
});

describe('a level’s shown label (the campaign order, level-order.md)', () => {
  it('names the header by the node’s shown label, the id kept for saves', () => {
    const node = { id: '4-2', kind: 'level', level: '4-2', shown: '4-1', x: 0, y: 0 } as const;
    expect(mapHeaderLabel({ ...WORLD_2, label: 'WORLD 4' }, node)).toBe('WORLD 4-1');
    expect(mapHeaderLabel(WORLD_2_HYRULE, WORLD_2_HYRULE.nodes[1] ?? null)).toBe('WORLD 2-1');
  });
});

describe('the hidden heroes from above (silhouettes beside their nodes)', () => {
  const CASES = [
    [
      'Link on Hyrule',
      'smb-2',
      '2-1',
      'link',
      [...ALL_W1, ...ALL_W2],
      ['bonus-2', 'kakariko'],
      'hyrule-above',
    ],
    [
      'Mega Man on Mega City',
      'smb-3',
      '3-1',
      'megaman',
      [...ALL_W1, ...ALL_W2, ...ALL_W3],
      ['bonus-3'],
      'megacity-above',
    ],
  ] as const;

  it.each(CASES)(
    '%s: a faint shadow in the ground’s own shade, clear of every road',
    (_, pageId, node, hero, cleared, secrets, sheet) => {
      const h = makeGame();
      open(h, {
        cleared: [...cleared],
        secrets: [...secrets],
        freed: FREED.filter((f) => f !== hero),
        pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
        position: { page: pageId, node },
        bonusOpen: true,
      });
      h.step();
      const marks = h.r.frames.filter((f) => f.sheet.includes('~shade-'));
      expect(marks.length, 'a silhouette').toBe(1);
      const mark = marks[0] as (typeof marks)[0];
      // Its shade is the look's ground shade (between its dark and main ground colours), not the
      // classic page's.
      expect(mark.sheet).toContain(`~shade-${shadeTheme(h.map().page)}`);
      const [shade] = resolvePalette(PALETTES, mark.sheet.slice(mark.sheet.indexOf('@') + 1), 'default');
      const lum = (c: string) => [1, 3, 5].reduce((a, i) => a + parseInt(c.slice(i, i + 2), 16), 0);
      const ground = PALETTES.default[sheet] as readonly string[];
      expect(lum(shade as string)).toBeGreaterThanOrEqual(lum(ground[1] as string));
      expect(lum(shade as string)).toBeLessThanOrEqual(lum(ground[2] as string));
      // It peeks out from behind its node's marker (the node's own tile is under the marker); no
      // other pixel of it lies on a road's drawn pixels.
      const n = h.map().page.nodes.find((x) => x.id === node);
      const onNode = (f: { x: number; y: number }) => f.x === (n?.x ?? -1) * 16 && f.y === (n?.y ?? -1) * 16;
      const rows = (key: string, frame: string) => SPRITES[key.split('@')[0] as string]?.frames[frame] ?? [];
      const markRows = rows(mark.sheet, mark.frame);
      const w = markRows[0]?.length ?? 0;
      const at = (x: number, y: number): boolean => {
        const r = markRows[y - mark.y];
        if (!r) return false;
        const i = x - mark.x;
        if (i < 0 || i >= w) return false;
        return (r[mark.flip ? w - 1 - i : i] ?? '.') !== '.';
      };
      const hits: string[] = [];
      for (const f of h.r.frames.filter(
        (g) => g.sheet === sheet && /^(road|walk)-/.test(g.frame) && !onNode(g),
      ))
        rows(f.sheet, f.frame).forEach((r, dy) =>
          [...r].forEach((c, dx) => {
            if (c !== '.' && at(f.x + dx, f.y + dy)) hits.push(`${f.frame}@${f.x + dx},${f.y + dy}`);
          }),
        );
      expect(hits).toEqual([]);
    },
  );
});

describe('Hyrule in the colour-blind modes', () => {
  it('keeps its dirt, rock, wood and trunks brown: no red shift turns them pink', () => {
    const base = PALETTES.default['hyrule-above'] as readonly string[];
    const ROLES = '0123456789abcdefghijklmnopqrstuvwxyz';
    for (const mode of ['deuteranopia', 'protanopia'] as const)
      for (const role of ['4', '5', '6', 'k', 'l', 'm', 'd', 'p', 'q', 'r']) {
        const i = ROLES.indexOf(role);
        expect(PALETTES[mode]?.['hyrule-above']?.[i], `${mode} ${role}`).toBe(base[i]);
      }
  });
});
