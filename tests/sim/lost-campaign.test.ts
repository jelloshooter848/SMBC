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
  pathId,
  revealId,
  type Dir,
} from '@game/map/rules';
import type { MapNode, PageId, WorldMapPage } from '@game/map/types';
import type { WorldEvent } from '@game/world/world';
import { LOST_WARPED } from '@game/level/lost-campaign';
import { loadProgress, LOST_LETTERS_GAMES, PROGRESS_KEY } from '@engine/save/progress';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

// The Lost Levels in campaign play (docs/WORLD_MAP.md): their levels are entered from their own
// map pages like SMB's, clears draw the next road in, warp zones (backward ones too) open and
// move to only their target page, and the three game ends (8-4, 9-4, D-4) come back to the map.
//
// Until the Lost Levels pages land these run on stand-in pages that follow the contract
// (lost-pages.fixture.ts); everything is found by lookup, so the real pages slot in.
vi.mock('@content/worldmap/lost', async () => {
  const { LOST_FIXTURE_PAGES } = await import('./lost-pages.fixture');
  return { LOST_PAGES: LOST_FIXTURE_PAGES };
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

  it('a warp pipe opens and moves to only its target page, and the file remembers the warp', () => {
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
    expect(saved.secrets).toContain(LOST_WARPED);
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
    expect(h.game.mapProgress.secrets).not.toContain(LOST_WARPED);
  });

  it('World 9-1 is entered in its first area', () => {
    const h = makeGame();
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, lost: { world9: true, letters: false, beaten: 1 } }));
    open(h, fileAt('ll-9-1', { pages: [...llPages(9)] }));
    enterHere(h);
    expect(h.level().level.id).toBe('ll-9-1-start');
  });
});

describe('Lost Levels campaign: the game ends', () => {
  it('a warpless 8-4: the card, the tally, then the Lost 8 map with World 9 opened and drawn in', () => {
    const h = makeGame();
    const castle = at('ll-8-4');
    open(h, fileAt('ll-8-4'));
    enterHere(h);
    reachEnd(h, 'll-8-4-end3');
    // Recorded and saved as the card shows.
    expect(loadProgress().lost).toEqual({ world9: true, letters: false, beaten: 1 });
    expect(loadSave(1)?.cleared).toContain('ll-8-4');
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(MessageScene);
    expect(h.said.at(-1)).toBe('WORLD 9 IS OPEN! GAMES BEATEN 1');
    press(h, 'jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-8');
    expect(h.map().node).toBe(castle.node);
    const exit = page('ll-8').exits.find((e) => e.to === 'll-9');
    expect(exit?.requires).toBe('ll9');
    expect(h.game.pendingReveal).toContain(revealId('ll-8', exitId(exit!)));
    expect(h.map().revealing).toBe(true);
    h.until(() => h.map().mode === 'idle', 2000);
    expect(h.game.mapProgress.pages).toContain('ll-9');
    const saved = loadSave(1) as SaveFile;
    expect(saved.pages).toContain('ll-9');
    expect(saved.position).toEqual({ page: 'll-8', node: castle.node });
    expect(saved.pendingReveal.filter((r) => r.startsWith('ll-8:'))).toEqual([]);
  });

  it('a warped 8-4 counts a game but does not open World 9', () => {
    const h = makeGame();
    open(h, fileAt('ll-8-4', { secrets: ['bonus-1', LOST_WARPED] }));
    enterHere(h);
    expect(h.game.state.warped).toBe(true); // the file's warp carries into the run
    reachEnd(h, 'll-8-4-end3');
    expect(loadProgress().lost).toEqual({ world9: false, letters: false, beaten: 1 });
    press(h, 'attack');
    expect(h.said.at(-1)).toContain('WITHOUT WARP ZONES');
    press(h, 'jump');
    expect(h.map().page.id).toBe('ll-8');
    h.until(() => h.map().mode === 'idle', 2000);
    expect(h.game.mapProgress.cleared).toContain('ll-8-4');
    expect(h.game.mapProgress.pages).not.toContain('ll-9');
  });

  it('an SMB warp zone earlier in the session does not count against a Lost Levels run', () => {
    const h = makeGame();
    open(h, fileAt('ll-8-4'));
    h.game.state.warped = true; // e.g. a 4-2 warp zone
    enterHere(h);
    expect(h.game.state.warped).toBe(false);
  });

  it(`the ${LOST_LETTERS_GAMES}th game opens the World A warp on Lost 8 and draws its road in`, () => {
    const h = makeGame();
    store.set(
      PROGRESS_KEY,
      JSON.stringify({ v: 1, lost: { world9: false, letters: false, beaten: LOST_LETTERS_GAMES - 1 } }),
    );
    const warp = page('ll-8').nodes.find((n) => n.to === 'll-10') as MapNode;
    expect(warp.requires).toBe('llLetters');
    // Cleared before: the warp node already shows, locked.
    open(h, fileAt('ll-8-4', { cleared: ['ll-8-1', 'll-8-2', 'll-8-3', 'll-8-4'], secrets: [LOST_WARPED] }));
    expect(isWarpOpen(h.game.mapProgress, warp)).toBe(false);
    enterHere(h);
    reachEnd(h, 'll-8-4-end3');
    press(h, 'attack');
    expect(h.said.at(-1)).toContain('WORLDS A-D ARE OPEN!');
    press(h, 'jump');
    expect(h.map().page.id).toBe('ll-8');
    expect(h.game.pendingReveal).toContain(revealId('ll-8', warp.id));
    const roads = page('ll-8').paths.filter((p) => p.to === warp.id || p.from === warp.id);
    for (const p of roads) expect(h.game.pendingReveal).toContain(revealId('ll-8', pathId(p)));
    h.until(() => h.map().mode === 'idle', 2000);
    expect(isWarpOpen(h.game.mapProgress, warp)).toBe(true);
    expect(h.game.mapProgress.pages).not.toContain('ll-9');
  });

  it(`after ${LOST_LETTERS_GAMES} games beaten the World A warp is open and leads to Lost A`, () => {
    const h = makeGame();
    store.set(
      PROGRESS_KEY,
      JSON.stringify({ v: 1, lost: { world9: false, letters: true, beaten: LOST_LETTERS_GAMES } }),
    );
    const warp = page('ll-8').nodes.find((n) => n.to === 'll-10') as MapNode;
    open(h, fileAt('ll-8-4', { cleared: ['ll-8-1', 'll-8-2', 'll-8-3', 'll-8-4'] }));
    walkTo(h, warp.id);
    expect(h.map().hintLine).toBe(warp.label ?? page('ll-10').title);
    h.tap('jump');
    h.idle(MAP_FADE_FRAMES);
    h.until(() => h.map().mode === 'idle', 800);
    expect(h.map().page.id).toBe('ll-10');
    expect(h.game.mapProgress.pages).toContain('ll-10');
  });

  it('9-4: the card, then the Lost 9 map with the clear saved', () => {
    const h = makeGame();
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, lost: { world9: true, letters: false, beaten: 1 } }));
    open(h, fileAt('ll-9-4'));
    enterHere(h);
    reachEnd(h, 'll-9-4');
    expect((h.top() as CardScene).lines).toEqual(['THANK YOU!']);
    press(h, 'attack');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.map().page.id).toBe('ll-9');
    h.until(() => h.map().mode === 'idle', 800);
    expect(loadSave(1)?.cleared).toContain('ll-9-4');
    expect(loadProgress().lost.beaten).toBe(1);
  });

  it('D-4: the card, the credits, then the Lost D map with the clear saved', () => {
    const h = makeGame();
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, lost: { world9: false, letters: true, beaten: 8 } }));
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
