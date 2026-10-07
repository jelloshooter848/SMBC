import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { IntroScene } from '@game/scenes/intro';
import { CardScene, MessageScene } from '@game/scenes/message';
import { CreditsScene } from '@game/scenes/credits';
import { TitleScene } from '@game/scenes/title';
import { GameOverScene, GAME_OVER_CARD_FRAMES } from '@game/scenes/game-over';
import type { MenuItem } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile } from '@game/save/save-files';
import { exitId, findLevelNode, isExitOpen, isOpen, isPathOpen, revealId, type Dir } from '@game/map/rules';
import type { MapNode, PageId, WorldMapPage } from '@game/map/types';
import type { WorldEvent } from '@game/world/world';
import { loadProgress } from '@engine/save/progress';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

// The Lost Levels in campaign play (docs/WORLD_MAP.md): the story's extension (0.4.7). SMB 8-4's
// ending opens a road from World 8 to Lost World 1; their levels are entered from their own map
// pages like SMB's, clears draw the next road in, each castle opens the next world in play order
// (1-8, 9, A-D) whatever warps were taken, the warp zones (backward ones too) still open and move
// to only their target page as on the NES, and the game ends (8-4, 9-4, D-4, the final ending)
// come back to the map.

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
  const until = (pred: () => boolean, max = 2000, held: Action[] = []) => {
    for (let i = 0; i < max && !pred(); i++) step(held);
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  const map = () => top() as WorldMapScene;
  const level = () => top() as LevelScene;
  const fire = (ev: WorldEvent) => {
    expect(top()).toBeInstanceOf(LevelScene);
    level().world.events.push(ev);
    step();
  };
  return { game, said, step, tap, idle, until, top, map, level, fire };
}
type H = ReturnType<typeof makeGame>;

const page = (id: PageId) => mapPage(id) as WorldMapPage;
const startOf = (id: PageId) => (page(id).nodes.find((n) => n.kind === 'start') as MapNode).id;
/** The node a level sits on, by the level → page lookup. */
function at(levelId: string): { page: PageId; node: string } {
  const f = findLevelNode(levelId);
  expect(f, levelId).not.toBeNull();
  return { page: f!.page.id, node: f!.node.id };
}
/** Every Lost Levels page from 'll-1' up to `last` (play order), with SMB 1 and the hub. */
const llPages = (last: number) => ['smb-1', 'hub', ...Array.from({ length: last }, (_, i) => `ll-${i + 1}`)];

function file(over: Partial<SaveFile> = {}): SaveFile {
  const s = { ...newSave(1, MARIO.id), gameCleared: true, secrets: ['bonus-1'], ...over };
  writeSave(s);
  return s;
}

/** A file standing on `levelId`'s node, with that page's earlier levels cleared. */
function fileAt(levelId: string, over: Partial<SaveFile> = {}): SaveFile {
  const { page: pid, node } = at(levelId);
  const w = Number(/^ll-(\d+)-/.exec(levelId)?.[1]);
  const stage = Number(/-(\d+)$/.exec(levelId)?.[1]);
  const cleared = Array.from({ length: stage - 1 }, (_, i) => `ll-${w}-${i + 1}`);
  return file({ cleared, pages: llPages(w), position: { page: pid, node }, ...over });
}

function dirOf(points: [number, number][]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

/** Walk the hero along open roads (breadth first) to node `to` of the page shown. */
function walkTo(h: H, to: string) {
  for (let hops = 0; hops < 24 && h.map().node !== to; hops++) {
    const m = h.map();
    const pg = m.page;
    const prog = h.game.mapProgress;
    const first = new Map<string, [number, number][]>();
    const queue = [m.node];
    const seen = new Set(queue);
    while (queue.length) {
      const id = queue.shift() as string;
      for (const p of pg.paths) {
        if (!isPathOpen(prog, pg, p)) continue;
        const other = p.from === id ? p.to : p.to === id ? p.from : null;
        if (other === null || seen.has(other)) continue;
        seen.add(other);
        const pts = p.from === id ? p.points : [...p.points].reverse();
        first.set(other, id === m.node ? pts : (first.get(id) as [number, number][]));
        queue.push(other);
      }
    }
    const pts = first.get(to);
    expect(pts, `no road to ${to}`).toBeDefined();
    h.tap(dirOf(pts!));
    h.until(() => m.mode === 'idle');
  }
  expect(h.map().node).toBe(to);
}

/** From the map: enter the level underfoot (character select, keep the hero) until it runs. */
function enterHere(h: H) {
  h.tap('jump');
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene);
}

/** Waits out a card's guard, then presses `action` once. */
function press(h: H, action: Action) {
  h.idle(40);
  h.tap(action);
}

/** Opens the file in slot 1 as stored (loaded and brought up to date) and waits until it settles. */
function openStored(h: H, _written: SaveFile) {
  open(h, loadSave(1) as SaveFile);
}

/** Opens the file on the map and waits until it settles. */
function open(h: H, save: SaveFile) {
  h.game.openFile(1, save);
  h.until(() => h.top() instanceof WorldMapScene && h.map().mode === 'idle', 800);
  h.idle(8);
}

/** Plays `areaId` (the castle's end area) and reaches its `next=end` exit. */
function reachEnd(h: H, areaId: string) {
  h.game.startLevel(getLevel(areaId), { mode: 'stand' });
  h.step();
  h.fire({ type: 'exit', next: 'end' });
  expect(h.top()).toBeInstanceOf(CardScene);
}

const menuItem = (scene: unknown, label: string): MenuItem | undefined =>
  (scene as { items: MenuItem[] }).items.find((i) => i.label === label);

describe('Lost Levels campaign: maps, clears and warps', () => {
  it("World 8's road → Lost 1 → enter 1-1 → its exit → the Lost 1 map with 1-2 open and saved", () => {
    const h = makeGame();
    const smb = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    open(
      h,
      file({
        cleared: smb,
        pages: [...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`), 'll-1'],
        position: { page: 'smb-8', node: '8-4' },
      }),
    );
    h.tap('right');
    expect(h.map().mode).toBe('walk');
    h.until(() => h.map().page.id === 'll-1' && h.map().mode === 'idle', 2000);
    expect(h.map().node).toBe('start');

    const one = at('ll-1-1');
    expect(one.page).toBe('ll-1');
    walkTo(h, one.node);
    enterHere(h);
    expect(h.level().level.id.startsWith('ll-1-1')).toBe(true);
    h.fire({ type: 'exit', next: 'll-1-2' });
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-1');
    const two = at('ll-1-2');
    expect(h.game.pendingReveal).toContain(revealId('ll-1', two.node));
    h.until(() => h.map().mode === 'idle', 800);
    expect(isOpen(h.game.mapProgress, page('ll-1'), two.node)).toBe(true);
    const saved = loadSave(1) as SaveFile;
    expect(saved.cleared).toContain('ll-1-1');
    expect(saved.position).toEqual({ page: 'll-1', node: one.node });
    expect(saved.pendingReveal).toEqual([]);
    // And on: 1-2 is entered from its node like any level.
    walkTo(h, two.node);
    enterHere(h);
    expect(h.level().level.id.startsWith('ll-1-2')).toBe(true);
  });

  it('a warp pipe opens and moves to only its target page', () => {
    const h = makeGame();
    open(h, fileAt('ll-1-2'));
    enterHere(h);
    const room = getLevel('ll-1-2-warp');
    const pipe = room.zones.find((z) => z.kind === 'pipe' && z.target.level === 'll-3-1');
    expect(pipe?.kind).toBe('pipe');
    h.game.startLevel(room, { mode: 'stand' });
    h.step();
    h.fire({ type: 'pipe', target: (pipe as { target: { level: string; x: number; y: number } }).target });
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-3');
    expect(h.map().mode).toBe('slide');
    h.until(() => h.map().mode === 'idle', 1200);
    const p = h.game.mapProgress;
    expect(p.pages).toContain('ll-3');
    expect(p.pages).not.toContain('ll-2');
    expect(p.pages).not.toContain('ll-4');
    expect(p.cleared).not.toContain('ll-1-2');
    expect(p.position).toEqual({ page: 'll-3', node: startOf('ll-3') });
    expect(h.game.state.warped).toBe(true);
    const saved = loadSave(1) as SaveFile;
    expect(saved.position.page).toBe('ll-3');

    // Backward: 3-1's warp zone goes back to World 1's page (already open), and only moves there.
    walkTo(h, at('ll-3-1').node);
    enterHere(h);
    const back = getLevel('ll-3-1-exit').zones.find((z) => z.kind === 'pipe' && z.target.level === 'll-1-1');
    h.game.startLevel(getLevel('ll-3-1-exit'), { mode: 'stand' });
    h.step();
    h.fire({ type: 'pipe', target: (back as { target: { level: string; x: number; y: number } }).target });
    expect(h.map().page.id).toBe('ll-1');
    h.until(() => h.map().mode === 'idle', 1200);
    expect(h.game.mapProgress.pages).toEqual(llPages(1).concat('ll-3'));
  });

  it('a pipe within a level stays in the level', () => {
    const h = makeGame();
    open(h, fileAt('ll-1-2'));
    enterHere(h);
    const lvl = getLevel('ll-1-2');
    const pipe = lvl.zones.find(
      (z) => z.kind === 'pipe' && getLevel(z.target.level).world === lvl.world && z.target.level !== lvl.id,
    );
    expect(pipe).toBeDefined();
    h.game.startLevel(lvl, { mode: 'stand' });
    h.step();
    h.fire({ type: 'pipe', target: (pipe as { target: { level: string; x: number; y: number } }).target });
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(h.game.mapProgress.pages).toEqual(llPages(1));
  });

  it('World 9-1 is entered in its first area', () => {
    const h = makeGame();
    open(h, fileAt('ll-9-1', { pages: [...llPages(9)] }));
    enterHere(h);
    expect(h.level().level.id).toBe('ll-9-1-start');
  });
});

describe("Lost Levels campaign: the story's extension (0.4.7), the game ends and the roads", () => {
  /** Main levels whose castle ends the game (`next=end`), with the end area to play. */
  const END_AREAS: Record<string, string> = {
    'll-8-4': 'll-8-4-end3',
    'll-9-4': 'll-9-4',
    'll-13-4': 'll-13-4-end',
  };
  const nextOf = (id: string) => {
    const [, w, s] = /^ll-(\d+)-(\d)$/.exec(id) as RegExpExecArray;
    return Number(s) < 4 ? `ll-${w}-${Number(s) + 1}` : `ll-${Number(w) + 1}-1`;
  };
  const SMB = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
  const SMB_PAGES = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);

  /** Walk to level `id`'s node on the page shown, play it and leave by its normal exit. */
  function clear(h: H, id: string) {
    walkTo(h, at(id).node);
    enterHere(h);
    const end = END_AREAS[id];
    if (!end) {
      h.fire({ type: 'exit', next: nextOf(id) });
      expect(h.top()).toBeInstanceOf(WorldMapScene);
    } else {
      reachEnd(h, end);
      press(h, 'attack');
      if (id === 'll-13-4') {
        expect(h.top()).toBeInstanceOf(CreditsScene);
        h.until(() => h.top() instanceof WorldMapScene, 8000);
      }
    }
    expect(h.map().page.id).toBe(at(id).page);
    h.until(() => h.map().mode === 'idle', 2000);
    expect(h.game.mapProgress.cleared).toContain(id);
  }
  /** From the castle, walk off the page along its world exit to page `to`. */
  function walkOn(h: H, to: PageId) {
    const e = h.map().page.exits.find((x) => x.to === to);
    expect(e, `a road on to ${to}`).toBeDefined();
    walkTo(h, e!.from);
    h.tap(dirOf(e!.points));
    h.until(() => h.map().page.id === to && h.map().mode === 'idle', 2000);
    expect(h.map().node).toBe(startOf(to));
  }
  /** Takes the warp zone pipe in `room` to `level` (the NES warp, kept in the campaign). */
  function warpPipe(h: H, room: string, level: string) {
    const pipe = getLevel(room).zones.find((z) => z.kind === 'pipe' && z.target.level === level);
    expect(pipe, `${room} → ${level}`).toBeDefined();
    h.game.startLevel(getLevel(room), { mode: 'stand' });
    h.step();
    h.fire({ type: 'pipe', target: (pipe as { target: { level: string; x: number; y: number } }).target });
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    h.until(() => h.map().mode === 'idle', 2000);
    expect(h.map().page.id).toBe(at(level).page);
  }

  it('the story: SMB 8-4 → the road → Lost 1 → warps → Lost 8-4 → 9 → A → B → C → D-4, the final ending', () => {
    const h = makeGame();
    open(
      h,
      file({
        cleared: SMB.filter((id) => id !== '8-4'),
        gameCleared: false,
        pages: SMB_PAGES,
        position: { page: 'smb-8', node: '8-4' },
      }),
    );
    const road = page('smb-8').exits.find((e) => e.to === 'll-1');
    expect(road?.from).toBe('8-4');
    expect(isExitOpen(h.game.mapProgress, page('smb-8'), road!)).toBe(false);
    // Nothing leads on from World 8's castle yet.
    h.tap('right');
    expect(h.map().page.id).toBe('smb-8');

    // SMB 8-4: "Your quest is over.", the credits, then World 8 with the road drawn in.
    enterHere(h);
    h.game.startLevel(getLevel('8-4-end'), { mode: 'stand' });
    h.step();
    h.fire({ type: 'exit', next: 'end' });
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.until(() => h.top() instanceof WorldMapScene, 8000);
    expect(h.map().page.id).toBe('smb-8');
    expect(h.map().node).toBe('8-4');
    expect(h.game.pendingReveal).toContain(revealId('smb-8', exitId(road!)));
    expect(h.map().revealing).toBe(true);
    h.until(() => h.map().mode === 'idle', 2000);
    expect(isExitOpen(h.game.mapProgress, page('smb-8'), road!)).toBe(true);
    expect(loadSave(1)).toMatchObject({ gameCleared: true, position: { page: 'smb-8', node: '8-4' } });
    expect(loadSave(1)?.pages).toContain('ll-1');

    // Walk the road to Lost World 1 (a slide), back to World 8 and on again.
    walkOn(h, 'll-1');
    expect(h.game.pendingReveal.filter((r) => r.startsWith('ll-1:'))).toEqual([]);
    expect(isOpen(h.game.mapProgress, page('ll-1'), at('ll-1-1').node)).toBe(true);
    h.tap('left');
    h.until(() => h.map().page.id === 'smb-8' && h.map().mode === 'idle', 2000);
    expect(h.map().node).toBe('8-4');
    walkOn(h, 'll-1');

    // Lost 1-1, then 1-2's warp zone (NES): on to World 3, skipping World 2.
    clear(h, 'll-1-1');
    walkTo(h, at('ll-1-2').node);
    enterHere(h);
    warpPipe(h, 'll-1-2-warp', 'll-3-1');
    expect(h.game.state.warped).toBe(true);
    for (const id of ['ll-3-1', 'll-3-2', 'll-3-3', 'll-3-4']) clear(h, id);
    walkOn(h, 'll-4');
    for (const id of ['ll-4-1', 'll-4-2', 'll-4-3', 'll-4-4']) clear(h, id);
    walkOn(h, 'll-5');
    clear(h, 'll-5-1');
    // 5-2's warp zone: on to World 8, skipping 6 and 7.
    walkTo(h, at('ll-5-2').node);
    enterHere(h);
    warpPipe(h, 'll-5-2-warp', 'll-8-1');
    for (const id of ['ll-8-1', 'll-8-2', 'll-8-3']) clear(h, id);
    // No pad to World A beside the keep any more, and no count toward World 9.
    expect(page('ll-8').nodes.some((n) => n.kind === 'warp')).toBe(false);
    walkTo(h, at('ll-8-4').node);
    expect(h.map().hintLine).toBe('');

    // Lost 8-4 (warped all the way): the NES card, then World 8 with the road to World 9 drawn in.
    clear(h, 'll-8-4');
    const p = h.game.mapProgress;
    expect(p.pages).toContain('ll-9');
    for (const skipped of ['ll-2', 'll-6', 'll-7', 'll-10']) expect(p.pages).not.toContain(skipped);
    expect(loadSave(1)?.pages).toContain('ll-9');
    walkOn(h, 'll-9');
    for (const id of ['ll-9-1', 'll-9-2', 'll-9-3', 'll-9-4']) clear(h, id);
    // 9-4 opens World A (the NES ended the game here).
    expect(p.pages).toContain('ll-10');
    walkOn(h, 'll-10');
    for (const w of [10, 11, 12]) {
      for (const s of [1, 2, 3, 4]) clear(h, `ll-${w}-${s}`);
      walkOn(h, `ll-${w + 1}`);
    }
    for (const id of ['ll-13-1', 'll-13-2', 'll-13-3']) clear(h, id);
    const pages = p.pages.slice();

    // D-4: the final ending (the card, the credits), then World D's map; nothing more opens.
    clear(h, 'll-13-4');
    expect(h.map().node).toBe(at('ll-13-4').node);
    expect(p.pages).toEqual(pages);
    const saved = loadSave(1) as SaveFile;
    expect(saved.cleared).toContain('ll-13-4');
    expect(saved.position).toEqual(at('ll-13-4'));
    expect(h.game.campaign).toEqual({ slot: 1 });
    // The NES progress store is left alone.
    expect(loadProgress().lost).toEqual({ world9: false, letters: false, beaten: 0 });
  }, 120_000); // 33 levels played from the map

  it('Lost 8-4: the NES card, then the World 8 map with the road to World 9 drawn in (warped or not)', () => {
    for (const warped of [false, true]) {
      const h = makeGame();
      const castle = at('ll-8-4');
      open(h, fileAt('ll-8-4'));
      expect(h.map().hintLine).toBe('');
      enterHere(h);
      h.game.state.warped = warped;
      reachEnd(h, 'll-8-4-end3');
      expect((h.top() as CardScene).lines[2]).toBe('YOUR QUEST IS OVER.');
      // Recorded and saved as the card shows.
      expect(loadSave(1)?.cleared).toContain('ll-8-4');
      expect(loadSave(1)?.pages).toContain('ll-9');
      press(h, 'attack');
      expect(h.top()).toBeInstanceOf(WorldMapScene);
      expect(h.map().page.id).toBe('ll-8');
      expect(h.map().node).toBe(castle.node);
      const nine = page('ll-8').exits.find((e) => e.to === 'll-9')!;
      expect(h.game.pendingReveal).toContain(revealId('ll-8', exitId(nine)));
      expect(h.game.pendingReveal).not.toContain(revealId('ll-10', startOf('ll-10')));
      h.until(() => h.map().mode === 'idle', 2000);
      expect(h.game.mapProgress.pages).not.toContain('ll-10');
      expect(loadProgress().lost.beaten).toBe(0);
      h.tap('right');
      h.until(() => h.map().page.id === 'll-9' && h.map().mode === 'idle', 2000);
      store.clear();
    }
  });

  it('replaying Lost 8-4 goes back to the map with nothing new', () => {
    const h = makeGame();
    open(h, fileAt('ll-8-4', { cleared: ['ll-8-1', 'll-8-2', 'll-8-3', 'll-8-4'], pages: llPages(9) }));
    enterHere(h);
    reachEnd(h, 'll-8-4-end3');
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.pendingReveal).toEqual([]);
    expect(h.map().mode).toBe('idle');
  });

  it('9-4: the card, then the Lost 9 map with the road to World A drawn in and saved', () => {
    const h = makeGame();
    open(h, fileAt('ll-9-4', { pages: llPages(9) }));
    enterHere(h);
    reachEnd(h, 'll-9-4');
    expect((h.top() as CardScene).lines).toEqual(['THANK YOU!']);
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-9');
    const a = page('ll-9').exits.find((e) => e.to === 'll-10')!;
    expect(h.game.pendingReveal).toContain(revealId('ll-9', exitId(a)));
    h.until(() => h.map().mode === 'idle', 2000);
    expect(loadSave(1)?.cleared).toContain('ll-9-4');
    expect(loadSave(1)?.pages).toContain('ll-10');
    // A's start walks back to World 9's castle.
    h.tap('right');
    h.until(() => h.map().page.id === 'll-10' && h.map().mode === 'idle', 2000);
    h.tap('left');
    h.until(() => h.map().page.id === 'll-9' && h.map().mode === 'idle', 2000);
    expect(h.map().node).toBe(at('ll-9-4').node);
  });

  it('D-4: the card, the credits, then the Lost D map with the clear saved', () => {
    const h = makeGame();
    open(h, fileAt('ll-13-4', { pages: llPages(13) }));
    enterHere(h);
    reachEnd(h, 'll-13-4-end');
    expect(loadSave(1)?.cleared).toContain('ll-13-4');
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.until(() => h.top() instanceof WorldMapScene, 8000);
    expect(h.map().page.id).toBe('ll-13');
    expect(h.map().node).toBe(at('ll-13-4').node);
    h.until(() => h.map().mode === 'idle', 800);
    const saved = loadSave(1) as SaveFile;
    expect(saved.cleared).toContain('ll-13-4');
    expect(saved.position.page).toBe('ll-13');
    expect(saved.gameCleared).toBe(true); // SMB's, untouched
    expect(h.game.campaign).toEqual({ slot: 1 });
  });
});

describe('Lost Levels campaign: files from before 0.4.7 load with nothing lost', () => {
  it('a file that beat SMB 8-4 gets the road to Lost World 1, drawn in on World 8', () => {
    const h = makeGame();
    const smb = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    openStored(
      h,
      file({
        cleared: smb,
        gameCleared: true,
        pages: [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`),
        position: { page: 'smb-8', node: '8-4' },
      }),
    );
    expect(h.game.mapProgress.pages).toContain('ll-1');
    expect(loadSave(1)?.pages).toContain('ll-1');
    // World 8's share drawn in when the map first showed (open waited for idle); Lost 1's waits.
    expect(h.game.pendingReveal.filter((r) => r.startsWith('smb-8:'))).toEqual([]);
    expect(h.game.pendingReveal).toContain(revealId('ll-1', startOf('ll-1')));
    h.tap('right');
    h.until(() => h.map().page.id === 'll-1' && h.map().mode === 'idle', 2000);
    expect(isOpen(h.game.mapProgress, page('ll-1'), at('ll-1-1').node)).toBe(true);
  });

  it("standing elsewhere, the road waits in World 8's share of the reveal", () => {
    const h = makeGame();
    const smb = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    h.game.openFile(
      1,
      file({ cleared: smb, pages: ['smb-1', 'smb-2', 'smb-8'], position: { page: 'smb-2', node: '2-1' } }),
    );
    expect(h.game.pendingReveal).toContain('smb-8:8-4>ll-1');
    h.until(() => h.map().mode === 'idle', 800);
    expect(loadSave(1)?.pendingReveal).toContain('smb-8:8-4>ll-1');
  });

  it('a file mid-Lost-Levels (reached through the hub) keeps every page and clear; Lost 1 walks back to World 8', () => {
    const h = makeGame();
    const smb = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    const lost = ['ll-1-1', 'll-1-2', 'll-1-3', 'll-1-4', 'll-2-1'];
    const pages = [...new Set([...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`), ...llPages(2)])];
    // Before 0.4.7 the hero could stand on Lost 1's warp back to the hub, which is gone.
    openStored(h, file({ cleared: [...smb, ...lost], pages, position: { page: 'll-1', node: 'hub' } }));
    expect(h.map().page.id).toBe('ll-1');
    expect(h.map().node).toBe('start');
    const p = h.game.mapProgress;
    expect(p.cleared).toEqual(expect.arrayContaining([...smb, ...lost]));
    expect([...p.pages].sort()).toEqual([...pages].sort());
    expect(loadSave(1)?.position).toEqual({ page: 'll-1', node: 'start' });
    // Lost 1's start walks back along the road to World 8's castle, and on again.
    h.tap('left');
    h.until(() => h.map().page.id === 'smb-8' && h.map().mode === 'idle', 2000);
    expect(h.map().node).toBe('8-4');
    h.tap('right');
    h.until(() => h.map().page.id === 'll-1' && h.map().mode === 'idle', 2000);
    // On to World 2 as before, where 2-1 is cleared and 2-2 open.
    walkOn2(h);
    expect(isOpen(p, page('ll-2'), at('ll-2-2').node)).toBe(true);
  });

  it('a file with World 9 open by the old 32-level rule, or World A by its pad, keeps them', () => {
    const h = makeGame();
    const nine = Array.from({ length: 32 }, (_, i) => `ll-${Math.floor(i / 4) + 1}-${(i % 4) + 1}`);
    // World A opened through World 8's pad (8-4 beaten), World 9 through the 32 clears; the hero
    // stood on A's pipe back to World 8, which is gone.
    openStored(
      h,
      file({
        cleared: [...nine, 'll-10-1'],
        pages: [...llPages(9), 'll-10'],
        position: { page: 'll-10', node: 'warp-ll-8' },
      }),
    );
    expect(h.map().page.id).toBe('ll-10');
    expect(h.map().node).toBe('start');
    const p = h.game.mapProgress;
    expect(p.pages).toEqual(expect.arrayContaining(['ll-9', 'll-10']));
    expect(isOpen(p, page('ll-10'), at('ll-10-2').node)).toBe(true);
    // World A without 9-4: nothing re-locks; the Worlds menu still reaches every open page.
    expect(
      h
        .map()
        .worldsMenuPages()
        .map((x) => x.id),
    ).toEqual(expect.arrayContaining(['ll-9', 'll-10']));
  });

  it("a file with only World A open (warped past 8, 8-4 beaten) gets World 9 too, and a hero on World 8's old pad stands at the castle", () => {
    const h = makeGame();
    const eight = ['ll-8-1', 'll-8-2', 'll-8-3', 'll-8-4'];
    openStored(
      h,
      file({
        cleared: eight,
        pages: [...llPages(8), 'll-10'],
        position: { page: 'll-8', node: 'warp-ll-10' },
      }),
    );
    expect(h.map().page.id).toBe('ll-8');
    expect(h.map().node).toBe(at('ll-8-4').node);
    expect(h.game.mapProgress.pages).toContain('ll-9');
    expect(h.game.mapProgress.pages).toContain('ll-10');
    h.tap('right');
    h.until(() => h.map().page.id === 'll-9' && h.map().mode === 'idle', 2000);
  });
});

/** From Lost 1's start, walk to its castle and on along the road to World 2. */
function walkOn2(h: H) {
  walkTo(h, at('ll-1-4').node);
  const e = page('ll-1').exits[0]!;
  h.tap(dirOf(e.points));
  h.until(() => h.map().page.id === 'll-2' && h.map().mode === 'idle', 2000);
}

describe('Lost Levels campaign: deaths and quitting', () => {
  function die(h: H) {
    const w = h.level().world;
    w.kill(w.player);
    h.until(() => !(h.top() instanceof LevelScene), 400);
  }

  it("the death select's Return to map goes to the Lost Levels page", () => {
    const h = makeGame();
    const two = at('ll-2-2');
    open(h, fileAt('ll-2-2'));
    enterHere(h);
    die(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-2');
    expect(h.map().node).toBe(two.node);
    expect(loadSave(1)?.position).toEqual(two);
  });

  it('game over and CONTINUE go back to the Lost Levels page', () => {
    const h = makeGame();
    open(h, fileAt('ll-5-3'));
    enterHere(h);
    h.game.state.lives = 1;
    die(h);
    expect(h.top()).toBeInstanceOf(GameOverScene);
    h.idle(GAME_OVER_CARD_FRAMES);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-5');
    expect(h.map().node).toBe(at('ll-5-3').node);
    expect(h.game.state.lives).toBe(3);
  });

  it('Quit to map goes back to the Lost Levels page', () => {
    const h = makeGame();
    open(h, fileAt('ll-4-1'));
    enterHere(h);
    h.tap('start');
    menuItem(h.top(), 'Quit to map')?.select?.();
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-4');
    expect(h.map().node).toBe(at('ll-4-1').node);
  });
});

describe('Lost Levels outside the campaign (dev select, ?level=) are unchanged', () => {
  it('a warpless 8-4 goes on to World 9 (ll-9-1-start), a warped one to the title, saving no file', () => {
    for (const warped of [false, true]) {
      const h = makeGame();
      h.game.newGame(MARIO, 'll-8-4');
      h.game.state.warped = warped;
      h.game.showEnding('ll-8-4');
      press(h, 'attack');
      expect(h.top()).toBeInstanceOf(MessageScene);
      if (warped) expect(h.said.at(-1)).toContain('WITHOUT WARP ZONES');
      else expect(h.said.at(-1)).toBe('GAMES BEATEN 1');
      press(h, 'jump');
      if (warped) expect(h.top()).toBeInstanceOf(TitleScene);
      else {
        expect(h.top()).toBeInstanceOf(IntroScene);
        h.until(() => h.top() instanceof LevelScene);
        expect(h.level().level.id).toBe('ll-9-1-start');
      }
      expect([...store.keys()].filter((k) => k.startsWith('smbc.save'))).toEqual([]);
      store.clear();
    }
  });

  it('a dev-start warp pipe still warps straight into the level', () => {
    const h = makeGame();
    h.game.devStart('ll-1-2-warp', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene);
    const pipe = h.level().level.zones.find((z) => z.kind === 'pipe' && z.target.level === 'll-3-1');
    h.fire({ type: 'pipe', target: (pipe as { target: { level: string; x: number; y: number } }).target });
    expect(h.top()).not.toBeInstanceOf(WorldMapScene);
    expect(h.game.state.warped).toBe(true);
    expect(h.game.mapProgress.secrets).toEqual([]);
  });
});
