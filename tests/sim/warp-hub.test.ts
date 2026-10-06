import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene, WorldsMenu, MAP_FADE_FRAMES } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import { isOpen, isWarpOpen, type Dir } from '@game/map/rules';
import { T } from '@game/level/tiles';
import type { Zone } from '@game/level/schema';
import type { WorldMapPage } from '@game/map/types';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import type { Settings } from '@engine/save/settings';

// The 0.4.0 Warp Zone: in campaign play the 1-2 warp zone has one pipe, which records secret
// bonus-1 and opens the road to World 1's warp spot; the spot warps to the hub, whose Lost
// Levels pad opens once SMB 8-4 is beaten (the file's gameCleared).

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Records text drawn (the HUD, the warp zone's labels, the map's header and hint line). */
class TextRenderer implements Renderer {
  texts: { s: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  sprite(): void {}
  debugText(): void {}
  line(): void {}
  text(_font: SpriteSheet, s: string, x: number, y: number): void {
    this.texts.push({ s, x, y });
  }
}

function makeGame() {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn(), sfx: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new TextRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    p2.next();
    r.texts = [];
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
  const until = (pred: () => boolean, max = 2000, held: Action[] = []) => {
    for (let i = 0; i < max && !pred(); i++) step(held);
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  const map = () => top() as WorldMapScene;
  const level = () => top() as LevelScene;
  return { game, said, step, tap, idle, until, top, map, level, r, audio };
}
type H = ReturnType<typeof makeGame>;

function dirOf(points: [number, number][]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

function walkTo(h: H, to: string) {
  const m = h.map();
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q as { points: [number, number][] }).points].reverse();
  h.tap(dirOf(pts));
  h.until(() => m.mode === 'idle');
  expect(m.node).toBe(to);
}

/** Jump on the warp node underfoot and wait out the fade (and any draw-in) on the next page. */
function warp(h: H, to: string) {
  h.tap('jump');
  expect(h.map().mode).toBe('fade');
  expect(h.map().page.id).toBe(to);
  h.idle(MAP_FADE_FRAMES);
  h.until(() => h.map().mode === 'idle', 800);
}

/** Opens map menu → Worlds; its labels and where the cursor starts (both menus stay open). */
function worldsMenu(h: H): { labels: string[]; cursor: number } {
  h.tap('select');
  (h.top() as unknown as { items: MenuItem[] }).items.find((i) => i.label === 'Worlds')?.select?.();
  const menu = h.top() as WorldsMenu;
  expect(menu).toBeInstanceOf(WorldsMenu);
  expect((menu as MenuScene).title).toBe('WORLDS');
  return {
    labels: (menu as unknown as { items: MenuItem[] }).items.map((i) => i.label),
    cursor: menu.cursor,
  };
}

const pipesIn = (zones: Zone[], x0: number, x1: number) =>
  zones.filter((z): z is Zone & { kind: 'pipe' } => z.kind === 'pipe' && z.x >= x0 && z.x < x1);

function file(over: Partial<SaveFile> = {}): SaveFile {
  const s = { ...newSave(1, MARIO.id), ...over };
  writeSave(s);
  return s;
}

describe('campaign: the 1-2 warp zone secret and the Warp Zone hub', () => {
  it('1-2 → one pipe → World 1 warp spot → hub → Lost Levels pad locked, then open → Lost Levels 1', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { page: 'smb-1', node: '1-2' } }));
    h.idle(8);
    // In the warp zone room, standing on its middle pipe.
    h.game.startLevel(getLevel('1-2'), { x: 182, y: 9, mode: 'stand' });
    h.step();
    const lvl = h.level().level;
    const room = pipesIn(lvl.zones, 176, 192);
    expect(room).toHaveLength(1);
    expect(room[0]).toMatchObject({ x: 182, target: { secret: 'bonus-1' } });
    expect(lvl.zones.find((z) => z.kind === 'warp')).toMatchObject({ worlds: [] });
    for (const x of [178, 179, 186, 187])
      for (const y of [10, 11, 12]) expect(lvl.tiles[y * lvl.width + x], `${x},${y}`).toBe(T.AIR);
    // The welcome text shows, but no world numbers over the pipe.
    h.step();
    expect(h.r.texts.some((t) => t.s === 'WELCOME TO WARP ZONE!')).toBe(true);
    expect(h.r.texts.some((t) => /^[1-8]$/.test(t.s) && t.y < 160)).toBe(false);

    // Down the pipe: 1-2 counts as cleared, the secret is kept, and the map draws in the road
    // from 1-2 to the warp spot.
    h.until(() => h.top() instanceof WorldMapScene, 300, ['down']);
    const prog = h.game.mapProgress;
    expect(prog.cleared).toEqual(['1-1', '1-2']);
    expect(prog.secrets).toEqual(['bonus-1']);
    expect(h.game.pendingReveal).toEqual(
      expect.arrayContaining(['smb-1:1-2>1-3', 'smb-1:1-3', 'smb-1:1-2>bonus-1', 'smb-1:bonus-1']),
    );
    expect(h.map().page.id).toBe('smb-1');
    expect(h.map().revealing).toBe(true);
    // Loaded, a file with clears counts the tutorial (1-0) as cleared too.
    expect(loadSave(1)).toMatchObject({ cleared: ['1-0', '1-1', '1-2'], secrets: ['bonus-1'] });
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().node).toBe('1-2');
    const w1 = mapPage('smb-1') as WorldMapPage;
    expect(isOpen(prog, w1, 'bonus-1')).toBe(true);

    // Walk to the warp spot, straight from 1-2: the hint line names where it goes.
    walkTo(h, 'bonus-1');
    expect(h.map().hintLine).toBe('WARP ZONE');
    h.step();
    expect(h.r.texts.some((t) => t.s === 'WARP ZONE' && t.y > 220)).toBe(true);
    expect(h.said.at(-1)).toBe('Warp, Warp Zone');

    // To the hub: it opens, the hero arrives on its centre, the position is saved.
    warp(h, 'hub');
    expect(h.map().node).toBe('start');
    expect(prog.pages).toEqual(['smb-1', 'hub']);
    expect(loadSave(1)).toMatchObject({ pages: ['smb-1', 'hub'], position: { page: 'hub', node: 'start' } });
    h.step();
    expect(h.r.texts.some((t) => t.s === 'WARP ZONE' && t.y < 24)).toBe(true); // the header label
    // The centre is the warp back to World 1 (arriving did not warp).
    expect(h.map().hintLine).toBe('RETURN TO WORLD 1');

    // The Lost Levels pad: locked until 8-4 is beaten; the hint line says so.
    walkTo(h, 'warp-lost');
    expect(h.map().hintLine).toBe('LOST LEVELS - BEAT 8-4 TO UNLOCK');
    h.step();
    expect(h.r.texts.some((t) => t.s === 'LOST LEVELS - BEAT 8-4 TO UNLOCK')).toBe(true);
    h.audio.sfx.mockClear();
    h.tap('jump');
    expect(h.audio.sfx).toHaveBeenCalledWith('bump');
    expect(h.map().mode).toBe('idle');
    expect(h.map().page.id).toBe('hub');
    expect(h.said.at(-1)).toBe('Lost Levels - Beat 8-4 To Unlock, locked');
    expect(h.map().hintLine).toBe('LOST LEVELS - BEAT 8-4 TO UNLOCK');
    // A mystery pad never opens.
    walkTo(h, 'start');
    walkTo(h, 'warp-mystery-1');
    expect(h.map().hintLine).toBe('??? - A FUTURE SECRET');
    h.tap('jump');
    expect(h.map().page.id).toBe('hub');

    // 8-4 beaten: the pad opens and leads to the Lost Levels' first page.
    walkTo(h, 'start');
    walkTo(h, 'warp-lost');
    h.game.mapProgress.gameCleared = true;
    expect(h.map().hintLine).toBe('LOST LEVELS');
    warp(h, 'll-1');
    // Portals pair 1:1: the pad lands on Lost 1's warp back to the hub, which lands on the pad.
    expect(h.map().node).toBe('hub');
    expect(loadSave(1)).toMatchObject({ gameCleared: true, position: { page: 'll-1', node: 'hub' } });
    expect(loadSave(1)?.pages).toEqual(['smb-1', 'hub', 'll-1']);
    expect(loadSave(1)?.lastNode).toMatchObject({ 'smb-1': 'bonus-1', hub: 'warp-lost', 'll-1': 'hub' });
    h.step();
    expect(h.r.texts.some((t) => t.s === 'LOST 1')).toBe(true);
    expect(h.map().hintLine).toBe('RETURN TO WARP ZONE');
    warp(h, 'hub');
    expect(h.map().node).toBe('warp-lost');
    expect(loadSave(1)?.position).toEqual({ page: 'hub', node: 'warp-lost' });
  });

  it("the hub's centre warps back to World 1's warp spot, which warps to the hub again", () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({
        cleared: ['1-1', '1-2'],
        secrets: ['bonus-1'],
        pages: ['smb-1', 'hub'],
        position: { page: 'hub', node: 'start' },
      }),
    );
    h.idle(8);
    expect(h.map().page.id).toBe('hub');
    warp(h, 'smb-1');
    expect(h.map().node).toBe('bonus-1');
    expect(loadSave(1)?.position).toEqual({ page: 'smb-1', node: 'bonus-1' });
    warp(h, 'hub');
    expect(h.map().node).toBe('start');
    // The Worlds menu lists the hub (the current page, first, under the cursor), then SMB.
    expect(worldsMenu(h)).toEqual({ labels: ['Warp Zone', 'World 1'], cursor: 0 });
  });

  it('the Worlds menu: current group first, then the Warp Zone, then other groups; cursor on HERE', () => {
    const h = makeGame();
    const pages = ['smb-1', 'smb-2', 'smb-3', 'hub', 'll-1', 'll-2'];
    h.game.openFile(1, file({ pages, position: { page: 'smb-2', node: 'start' } }));
    h.idle(8);
    expect(worldsMenu(h)).toEqual({ labels: ['World 1', 'World 2', 'World 3', 'Warp Zone'], cursor: 1 });
    h.game.scenes.pop();
    h.game.scenes.pop();
    h.game.travelToPage('ll-2');
    h.idle(8);
    expect(worldsMenu(h)).toEqual({ labels: ['Lost 1', 'Lost 2', 'Warp Zone'], cursor: 1 });
    h.game.scenes.pop();
    h.game.scenes.pop();
    h.game.travelToPage('hub');
    h.idle(8);
    expect(worldsMenu(h)).toEqual({
      labels: ['Warp Zone', 'World 1', 'World 2', 'World 3', 'Lost 1', 'Lost 2'],
      cursor: 0,
    });
    // Confirming right away keeps the hero here.
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('hub');
  });

  it('the fade switches the header at its midpoint; arriving on the hub reads only the arrival node', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({ cleared: ['1-1', '1-2'], secrets: ['bonus-1'], position: { page: 'smb-1', node: 'bonus-1' } }),
    );
    h.idle(8);
    const header = () => h.r.texts.filter((t) => t.y < 10).map((t) => t.s);
    h.tap('jump');
    expect(h.map().mode).toBe('fade');
    expect(header()).toContain('WORLD 1');
    h.idle(MAP_FADE_FRAMES / 2 - 3);
    expect(header()).toContain('WORLD 1');
    expect(header()).not.toContain('WARP ZONE');
    h.idle(3);
    expect(header()).toContain('WARP ZONE');
    const from = h.said.length;
    h.until(() => h.map().mode === 'reveal', 60);
    h.until(() => h.map().mode === 'idle', 800);
    const said = h.said.slice(from);
    expect(said).toEqual([`Warp Zone, ${mapPage('hub')!.title}. Warp, Return To World 1`]);
    // A pad's hint is read when the hero stands on it.
    walkTo(h, 'warp-lost');
    expect(h.said.at(-1)).toBe('Lost Levels - Beat 8-4 To Unlock, locked');
  });

  it('the warp spot stays hidden without the secret, and a plain 1-2 clear does not find it', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-1'], position: { page: 'smb-1', node: '1-2' } }));
    h.idle(8);
    h.game.startLevel(getLevel('1-2-exit'), { mode: 'stand' });
    h.step();
    h.level().world.events.push({ type: 'exit', next: '1-3' });
    h.step();
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(isOpen(h.game.mapProgress, mapPage('smb-1')!, 'bonus-1')).toBe(false);
  });

  it('outside campaign play the 1-2 warp zone keeps its three numbered pipes', () => {
    const h = makeGame();
    h.game.devStart('1-2', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 400);
    const lvl = h.level().level;
    expect(pipesIn(lvl.zones, 176, 192).map((p) => [p.x, p.target.level, p.target.secret])).toEqual([
      [178, '4-1', undefined],
      [182, '3-1', undefined],
      [186, '2-1', undefined],
    ]);
    expect(lvl.zones.find((z) => z.kind === 'warp')).toMatchObject({ worlds: [4, 3, 2], secret: 'bonus-1' });
    expect(lvl).toBe(getLevel('1-2'));
  });

  it('the 4-2 warp zones still skip worlds in campaign play', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({ cleared: ['4-1'], pages: ['smb-1', 'smb-4'], position: { page: 'smb-4', node: '4-2' } }),
    );
    h.idle(8);
    h.game.startLevel(getLevel('4-2-warp'), { mode: 'stand' });
    h.step();
    expect(pipesIn(h.level().level.zones, 48, 64)).toHaveLength(3);
    expect(h.level().level).toBe(getLevel('4-2-warp'));
  });

  it('developer unlock all opens the hub and its pads, except the mystery ones', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: true } as Settings;
    h.game.openFile(1, file({ devUnlockAll: true }));
    h.idle(8);
    h.game.travelToPage('hub');
    expect(h.map().page.id).toBe('hub');
    const hub = mapPage('hub')!;
    const node = (id: string) => hub.nodes.find((n) => n.id === id)!;
    const all = h.game.mapUnlockAll;
    expect(isWarpOpen(h.game.mapProgress, node('warp-lost'), all)).toBe(true);
    expect(isWarpOpen(h.game.mapProgress, node('start'), all)).toBe(true);
    for (const id of ['warp-mystery-1', 'warp-mystery-2', 'warp-mystery-3'])
      expect(isWarpOpen(h.game.mapProgress, node(id), all), id).toBe(false);
    h.idle(8);
    walkTo(h, 'warp-lost');
    expect(h.map().hintLine).toBe('LOST LEVELS');
    warp(h, 'll-1');
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    // The pad works only through Unlock all: the trip opens nothing in the file.
    expect(h.game.mapProgress.gameCleared).toBe(false);
    expect(h.game.mapProgress.pages).toEqual(['smb-1']);
    expect(loadSave(1)?.pages).toEqual(['smb-1']);
    // Unlock all off: the Lost Levels are closed again and the hero is back on World 1.
    h.game.deps.settings = { dev: false } as Settings;
    h.game.showMap();
    expect(h.map().page.id).toBe('smb-1');
  });

  it('with Unlock all and no secret, the warp spot and its road show and the spot warps to the hub', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: true } as Settings;
    h.game.openFile(1, file({ devUnlockAll: true }));
    h.idle(8);
    const w1 = mapPage('smb-1')!;
    expect(isOpen(h.game.mapProgress, w1, 'bonus-1', true)).toBe(true);
    expect(w1.paths.find((p) => p.to === 'bonus-1')?.from).toBe('1-2');
    walkTo(h, '1-1');
    walkTo(h, '1-2');
    walkTo(h, 'bonus-1');
    expect(h.map().hintLine).toBe('WARP ZONE');
    warp(h, 'hub');
    expect(h.map().node).toBe('start');
    // The trip records nothing: no secret, no page, no clear.
    const prog = h.game.mapProgress;
    expect([prog.secrets, prog.pages, prog.cleared]).toEqual([[], ['smb-1'], []]);
    const after = loadSave(1)!;
    expect([after.secrets, after.pages, after.cleared, after.gameCleared]).toEqual([
      [],
      ['smb-1'],
      [],
      false,
    ]);
    // The hub's centre returns to the spot, which walks on to 1-2 (not stranded).
    warp(h, 'smb-1');
    expect(h.map().node).toBe('bonus-1');
    walkTo(h, '1-2');
    walkTo(h, 'bonus-1');
  });

  it('turning Unlock all off hides the warp spot again and moves the hero off it', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: true } as Settings;
    h.game.openFile(1, file({ devUnlockAll: true, position: { page: 'smb-1', node: 'bonus-1' } }));
    h.idle(8);
    expect(h.map().node).toBe('bonus-1');
    h.tap('select');
    (h.top() as unknown as { items: MenuItem[] }).items.at(-1)?.adjust?.(-1);
    expect(h.game.devUnlockAll).toBe(false);
    h.game.scenes.pop();
    expect(isOpen(h.game.mapProgress, mapPage('smb-1')!, 'bonus-1', h.game.mapUnlockAll)).toBe(false);
    expect(h.map().node).toBe('start');
    expect(loadSave(1)?.position).toEqual({ page: 'smb-1', node: 'start' });
    expect(loadSave(1)?.secrets).toEqual([]);
  });

  it('a warp zone pipe in a 4-2 sub-area opens World 8 on the map (its page found through 4-2)', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({
        cleared: ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4', '4-1'],
        pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
        position: { page: 'smb-4', node: '4-2' },
      }),
    );
    h.idle(8);
    // Standing on the first warp pipe of the vine area above 4-2 (it leads to 8-1).
    h.game.startLevel(getLevel('4-2-warp'), { x: 50, y: 9, mode: 'stand' });
    h.step();
    h.until(() => h.top() instanceof WorldMapScene, 300, ['down']);
    expect(h.map().page.id).toBe('smb-8');
    expect(h.game.mapProgress.pages).toContain('smb-8');
    expect(h.game.mapProgress.pages).not.toContain('smb-5');
    expect(loadSave(1)?.pages).toContain('smb-8');
    expect(h.game.mapProgress.cleared).not.toContain('4-2');
  });
});
