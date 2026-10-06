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
import { WorldMapScene, MAP_FADE_FRAMES } from '@game/scenes/world-map';
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
import {
  exitId,
  findLevelNode,
  isOpen,
  isPathOpen,
  isWarpOpen,
  LOST_NINE_LEVELS,
  pathId,
  revealId,
  type Dir,
} from '@game/map/rules';
import type { MapNode, PageId, WorldMapPage } from '@game/map/types';
import type { WorldEvent } from '@game/world/world';
import { loadProgress } from '@engine/save/progress';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

// The Lost Levels in campaign play (docs/WORLD_MAP.md): their levels are entered from their own
// map pages like SMB's, clears draw the next road in, warp zones (backward ones too) open and
// move to only their target page, and the three game ends (8-4, 9-4, D-4) come back to the map.

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
/** The warp node on page `id` that leads to page `to`. */
const nodeOn = (id: PageId, to: PageId) => page(id).nodes.find((n) => n.to === to) as MapNode;
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
  it('hub → Lost 1 → enter 1-1 → its exit → the Lost 1 map with 1-2 open and saved', () => {
    const h = makeGame();
    const pad = page('hub').nodes.find((n) => n.to === 'll-1') as MapNode;
    open(
      h,
      file({ cleared: ['1-1', '1-2'], pages: ['smb-1', 'hub'], position: { page: 'hub', node: pad.id } }),
    );
    h.tap('jump');
    expect(h.map().mode).toBe('fade');
    h.idle(MAP_FADE_FRAMES);
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page.id).toBe('ll-1');

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

describe('Lost Levels campaign: the game ends and the unlocks (read from the file)', () => {
  const NINE_HINT = (n: number) => `WORLD 9 - CLEAR 1-1 TO 8-4 ${n}/32`;
  const warpA = () => page('ll-8').nodes.find((n) => n.to === 'll-10') as MapNode;
  const nineExit = () => page('ll-8').exits.find((e) => e.to === 'll-9')!;

  it('the first 8-4 clear opens the World A warp and draws its road in; World 9 stays shut', () => {
    const h = makeGame();
    const castle = at('ll-8-4');
    const warp = warpA();
    expect(warp.requires).toBe('llLetters');
    expect(nineExit().requires).toBe('ll9');
    open(h, fileAt('ll-8-4'));
    expect(h.map().hintLine).toBe(NINE_HINT(3));
    enterHere(h);
    reachEnd(h, 'll-8-4-end3');
    // Recorded and saved as the card shows; the NES progress store is left alone.
    expect(loadSave(1)?.cleared).toContain('ll-8-4');
    expect(loadProgress().lost).toEqual({ world9: false, letters: false, beaten: 0 });
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(MessageScene);
    expect(h.said.at(-1)).toBe('WORLD A IS OPEN! WORLD 9 OPENS ONCE LOST 1-1 TO 8-4 ARE CLEARED (4/32).');
    press(h, 'jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-8');
    expect(h.map().node).toBe(castle.node);
    expect(h.game.pendingReveal).toContain(revealId('ll-8', warp.id));
    for (const p of page('ll-8').paths.filter((x) => x.to === warp.id || x.from === warp.id))
      expect(h.game.pendingReveal).toContain(revealId('ll-8', pathId(p)));
    expect(h.map().revealing).toBe(true);
    h.until(() => h.map().mode === 'idle', 2000);
    expect(isWarpOpen(h.game.mapProgress, warp)).toBe(true);
    expect(h.game.mapProgress.pages).not.toContain('ll-9');
    // The castle's hint line counts toward World 9.
    expect(h.map().hintLine).toBe(NINE_HINT(4));
    expect(loadSave(1)?.position).toEqual({ page: 'll-8', node: castle.node });
    // The warp leads to Lost A.
    walkTo(h, warp.id);
    expect(h.map().hintLine).toBe(warp.label);
    h.tap('jump');
    h.idle(MAP_FADE_FRAMES);
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page.id).toBe('ll-10');
    expect(h.map().node).toBe(nodeOn('ll-10', 'll-8').id);
    expect(loadSave(1)?.pages).toContain('ll-10');
  });

  it("World 8's pad → Lost A → A's portal → back on World 8's pad, both ways a fade", () => {
    const h = makeGame();
    const pad = warpA();
    const eight = ['ll-8-1', 'll-8-2', 'll-8-3', 'll-8-4'];
    open(h, file({ cleared: eight, pages: llPages(8), position: { page: 'll-8', node: pad.id } }));
    expect(h.map().node).toBe(pad.id);
    h.tap('jump');
    expect(h.map().mode).toBe('fade');
    h.idle(MAP_FADE_FRAMES);
    h.until(() => h.map().mode === 'idle', 2000);
    // Portals pair 1:1: the pad lands on A's pipe back to it.
    const portal = page('ll-10').nodes.find((n) => n.kind === 'warp') as MapNode;
    expect(portal.to).toBe('ll-8');
    expect(h.map().page.id).toBe('ll-10');
    expect(h.map().node).toBe(portal.id);
    expect(h.map().hintLine).toBe('LOST WORLD 8');
    // Off to the start and back, then through the pipe.
    walkTo(h, startOf('ll-10'));
    walkTo(h, portal.id);
    h.tap('jump');
    expect(h.map().mode).toBe('fade');
    h.idle(MAP_FADE_FRAMES);
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page.id).toBe('ll-8');
    expect(h.map().node).toBe(pad.id);
    expect(h.map().hintLine).toBe(pad.label);
    expect(loadSave(1)?.position).toEqual({ page: 'll-8', node: pad.id });
    expect(h.game.mapLastNode['ll-10']).toBe(portal.id);
  });

  it('31 of 32 with 8-4 beaten: World 9 shut, the hint says 31/32; the 32nd clear opens it, drawn in', () => {
    const h = makeGame();
    const castle = at('ll-8-4');
    const cleared = LOST_NINE_LEVELS.filter((id) => id !== 'll-3-2');
    open(h, file({ cleared, pages: llPages(8), position: { page: 'll-8', node: castle.node } }));
    expect(h.game.mapProgress.pages).not.toContain('ll-9');
    expect(h.map().hintLine).toBe(NINE_HINT(31));
    expect(h.said.some((t) => t.includes('31/32'))).toBe(true);

    // The last one, far from World 8.
    h.game.travelToPage('ll-3');
    h.until(() => h.map().mode === 'idle', 800);
    h.idle(8);
    walkTo(h, at('ll-3-2').node);
    enterHere(h);
    h.fire({ type: 'exit', next: 'll-3-3' });
    expect(h.map().page.id).toBe('ll-3');
    expect(h.game.mapProgress.pages).toContain('ll-9');
    // World 8's share waits for World 8.
    expect(h.game.pendingReveal).toContain(revealId('ll-8', exitId(nineExit())));
    expect(h.game.pendingReveal).toContain(revealId('ll-9', startOf('ll-9')));
    h.until(() => h.map().mode === 'idle', 2000);
    expect(loadSave(1)?.pages).toContain('ll-9');

    h.game.travelToPage('ll-8');
    expect(h.map().node).toBe(castle.node);
    expect(h.map().revealing).toBe(true);
    h.until(() => h.map().mode === 'idle', 2000);
    expect(h.game.pendingReveal.filter((r) => r.startsWith('ll-8:'))).toEqual([]);
    expect(h.map().hintLine).toBe('');
    h.idle(8);
    h.tap('right');
    h.until(() => h.map().page.id === 'll-9' && h.map().mode === 'idle', 2000);
  });

  it('8-4 as the 32nd clear opens World 9 at once and says so', () => {
    const h = makeGame();
    const cleared = LOST_NINE_LEVELS.filter((id) => id !== 'll-8-4');
    open(h, fileAt('ll-8-4', { cleared }));
    enterHere(h);
    reachEnd(h, 'll-8-4-end3');
    press(h, 'attack');
    expect(h.said.at(-1)).toBe('WORLD A IS OPEN! WORLD 9 IS OPEN!');
    press(h, 'jump');
    expect(h.game.pendingReveal).toContain(revealId('ll-8', exitId(nineExit())));
    h.until(() => h.map().mode === 'idle', 2000);
    expect(loadSave(1)?.pages).toContain('ll-9');
    expect(loadProgress().lost.beaten).toBe(0);
  });

  it('a warp zone taken on the way does not keep World 9 shut', () => {
    const h = makeGame();
    const cleared = LOST_NINE_LEVELS.filter((id) => id !== 'll-8-4');
    open(h, fileAt('ll-8-4', { cleared }));
    enterHere(h);
    h.game.state.warped = true;
    reachEnd(h, 'll-8-4-end3');
    press(h, 'attack');
    press(h, 'jump');
    h.until(() => h.map().mode === 'idle', 2000);
    expect(h.game.mapProgress.pages).toContain('ll-9');
  });

  it('replaying 8-4 says what is open', () => {
    const h = makeGame();
    open(h, fileAt('ll-8-4', { cleared: [...LOST_NINE_LEVELS], pages: llPages(9) }));
    enterHere(h);
    reachEnd(h, 'll-8-4-end3');
    press(h, 'attack');
    expect(h.said.at(-1)).toBe('WORLD A IS OPEN. WORLD 9 IS OPEN.');
  });

  it('9-4: the card, then the Lost 9 map with the clear saved', () => {
    const h = makeGame();
    open(h, fileAt('ll-9-4', { pages: llPages(9) }));
    enterHere(h);
    reachEnd(h, 'll-9-4');
    expect((h.top() as CardScene).lines).toEqual(['THANK YOU!']);
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-9');
    h.until(() => h.map().mode === 'idle', 800);
    expect(loadSave(1)?.cleared).toContain('ll-9-4');
  });

  it('D-4: the card, the credits, then the Lost D map with the clear saved', () => {
    const h = makeGame();
    open(h, fileAt('ll-13-4', { pages: [...llPages(8), 'll-10', 'll-11', 'll-12', 'll-13'] }));
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
