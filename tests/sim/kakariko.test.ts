import { describe, expect, it } from 'vitest';
import { mapPage } from '@content/worldmap';
import { getLevel } from '@content/levels';
import { DOORS, FOLK, GATE, OUTDOOR, SCREEN_AT, SCREENS, type TownDoor } from '@content/town/kakariko';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { LUIGI } from '@game/characters/luigi';
import type { CharacterDef } from '@game/characters/character';
import { TopDownWorld } from '@game/topdown/world';
import { ROOM_COLS, ROOM_ROWS, TILE, type Dir } from '@game/topdown/geometry';
import { talkTarget } from '@game/topdown/person';
import {
  TownScene,
  SWITCH_GAP,
  fullHp,
  nextHero,
  VILLAGE_NAME,
  townHudHint,
  HUD_HINT_CHARS,
  promptRow,
  TownMenuScene,
} from '@game/town/scene';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { HUD_H } from '@game/topdown/geometry';
import type { Game, ControlScheme } from '@game/scenes/game';
import { villageDungeon, villageRooms, isOutdoor } from '@game/town/village';
import { folkSpawner, Townsperson, FOLK_DEFS } from '@game/town/folk';
import { DEV_VILLAGE, KAKARIKO, SECRET_HOUSE_LEVEL } from '@game/town/secret-house';
import { overheadLook } from '@game/town/hero';
import { PALETTES, SPRITES } from '@content/sprites';
import { townArt } from '@content/sprites/town';
import { LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { TitleScene } from '@game/scenes/title';
import { isBonusArea, bonusAreaLabel } from '@game/map/bonus-spot';
import { TOWN_EXIT, MAP_EXIT } from '@game/level/schema';
import { T } from '@game/level/tiles';
import { loadSave } from '@game/save/save-files';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { MapNode, WorldMapPage } from '@game/map/types';
import {
  GUARD_AGAIN,
  GUARD_FIRST,
  HEALER_HEALS,
  HEALER_PLUMBER,
  NO_ONE_ELSE,
  oldManPages,
} from '@game/story/kakariko';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// Kakariko Village (0.4.41, the owner's approved design, release 1): World 2's hidden spot becomes
// a small walled village walked from above, as in A Link to the Past. Six screens, the rooms
// inside, townsfolk and the healer, SELECT to switch to the next freed hero, and the secret house
// whose door loads the side-view Top Secret Area (its blocks refill once per visit). Campaign only.

useStorage();

const TSA = SECRET_HOUSE_LEVEL;
const w2 = () => mapPage('smb-2') as WorldMapPage;
const node = (id: string) => w2().nodes.find((n) => n.id === id) as MapNode;
const map = (h: H) => h.top() as WorldMapScene;
const town = (h: H) => h.top() as TownScene;

/** File 1 on World 2's map with the secret spot found; `over` patches the save. */
function onWorld2(h: H, over: Parameters<typeof file>[0] = {}) {
  h.game.openFile(
    1,
    file({
      cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1'],
      pages: ['smb-1', 'smb-2'],
      secrets: ['bonus-2'],
      position: { page: 'smb-2', node: 'bonus-2' },
      story: [...ALL_STORY],
      ...over,
    }),
  );
  h.idle(8);
  h.until(() => (h.top() as WorldMapScene).mode === 'idle', 1200);
}

/** Through every card on top with OK; returns them. */
function readCards(h: H, max = 10): string[][] {
  const seen: string[][] = [];
  for (let i = 0; i < max && h.top() instanceof CardScene; i++) {
    seen.push([...(h.top() as CardScene).lines]);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
  }
  return seen;
}

/** From World 2's map into the village: JUMP on the spot, the walk in, the guard's hello read. */
function intoTown(h: H): TownScene {
  h.idle(8);
  h.tap('jump');
  expect(h.top()).toBeInstanceOf(TownScene);
  h.until(() => h.top() instanceof CardScene || town(h).free, 200);
  readCards(h);
  expect(h.top()).toBeInstanceOf(TownScene);
  return town(h);
}

/* ---------- The village as a graph of cells: who can stand where, and how they join ---------- */

type Cell = string; // "room:col,row"
const key = (room: string, col: number, row: number): Cell => `${room}:${col},${row}`;

/** Every cell the hero can stand on, room by room (the townsfolk in their places). */
function freeCells(): Map<string, Set<string>> {
  const world = new TopDownWorld(villageDungeon(), { spawners: { folk: folkSpawner } });
  const out = new Map<string, Set<string>>();
  for (const id of world.dungeon.rooms.keys()) {
    world.warpTo(id, 0, 0);
    const free = new Set<string>();
    for (let row = 0; row < ROOM_ROWS; row++)
      for (let col = 0; col < ROOM_COLS; col++) {
        const feet = { x: col * TILE + 3, y: row * TILE + 8, w: 10, h: 8 };
        if (!world.blocked(feet, 'hero')) free.add(`${col},${row}`);
      }
    out.set(id, free);
  }
  return out;
}

/** The village's cells joined: neighbours, open screen edges, and doors to their pair's step. */
function graph(): { free: Map<string, Set<string>>; next: (c: Cell) => Cell[] } {
  const free = freeCells();
  const d = villageDungeon();
  const isFree = (room: string, col: number, row: number) => free.get(room)?.has(`${col},${row}`) ?? false;
  const next = (c: Cell): Cell[] => {
    const [room, at] = c.split(':') as [string, string];
    const [col, row] = at.split(',').map(Number) as [number, number];
    const out: Cell[] = [];
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nr >= 0 && nc < ROOM_COLS && nr < ROOM_ROWS) {
        if (isFree(room, nc, nr)) out.push(key(room, nc, nr));
        continue;
      }
      // Off an outdoor screen's edge: the facing cell of the screen past it.
      const r = d.rooms.get(room);
      if (!r || r.wall !== 0) continue;
      const past = d.roomAt(r.gx + dc, r.gy + dr);
      if (!past) continue;
      const pc = (nc + ROOM_COLS) % ROOM_COLS;
      const pr = (nr + ROOM_ROWS) % ROOM_ROWS;
      if (isFree(past.id, pc, pr)) out.push(key(past.id, pc, pr));
    }
    // A door: through to its pair's step.
    const door = DOORS.find((x) => x.room === room && x.col === col && x.row === row);
    if (door && !door.to.startsWith('@')) {
      const pair = DOORS.find((x) => x.id === door.to) as TownDoor;
      out.push(key(pair.room, pair.col, pair.row + (pair.enter === 'up' ? 1 : -1)));
    }
    return out;
  };
  return { free, next };
}

/** Cells reachable from the gate, and the path to each (BFS). */
function reach(): Map<Cell, Cell | null> {
  const { next } = graph();
  const start = key(GATE.room, GATE.col, GATE.row - 2);
  const prev = new Map<Cell, Cell | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const c = queue.shift() as Cell;
    for (const n of next(c))
      if (!prev.has(n)) {
        prev.set(n, c);
        queue.push(n);
      }
  }
  return prev;
}

/** Cells on the way from the hero's cell to `to`. */
function pathTo(from: Cell, to: Cell): Cell[] {
  const { next } = graph();
  const prev = new Map<Cell, Cell | null>([[from, null]]);
  const queue = [from];
  while (queue.length && !prev.has(to)) {
    const c = queue.shift() as Cell;
    for (const n of next(c))
      if (!prev.has(n)) {
        prev.set(n, c);
        queue.push(n);
      }
  }
  expect(prev.has(to), `${from} -> ${to}`).toBe(true);
  const out: Cell[] = [];
  for (let c: Cell | null = to; c && c !== from; c = prev.get(c) ?? null) out.unshift(c);
  return out;
}

/** The cell the hero stands on (by his feet's middle). */
function heroCell(t: TownScene): Cell {
  const f = t.hero.feet();
  return key(t.world.room.id, Math.floor((f.x + f.w / 2) / TILE), Math.floor((f.y + f.h / 2) / TILE));
}

/**
 * Walks the hero with the pad, cell by cell, to `to` (a cell of any room): the arrows toward each
 * next cell, as a player would; through doors, over screen edges. Returns the frames it took.
 */
function walkTo(h: H, to: Cell, max = 4000): number {
  let t = town(h);
  let frames = 0;
  const path = pathTo(heroCell(t), to);
  for (const c of path) {
    const [room, at] = c.split(':') as [string, string];
    const [col, row] = at.split(',').map(Number) as [number, number];
    for (;;) {
      expect(frames++, `walking to ${c} (at ${heroCell(t)})`).toBeLessThan(max);
      t = town(h);
      if (!t.free) {
        h.step();
        continue;
      }
      if (t.world.room.id === room) {
        const dx = col * TILE - t.hero.x;
        const dy = row * TILE - t.hero.y;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) break;
        const held: Action[] = [];
        if (Math.abs(dx) > 1) held.push(dx < 0 ? 'left' : 'right');
        if (Math.abs(dy) > 1) held.push(dy < 0 ? 'up' : 'down');
        h.step(held);
      } else {
        // Over an edge or through a door: keep going the way the cell lies.
        const here = heroCell(t);
        const [, hat] = here.split(':') as [string, string];
        const [hc, hr] = hat.split(',').map(Number) as [number, number];
        const door = DOORS.find((d) => d.room === t.world.room.id && d.col === hc && d.row === hr);
        const dir: Action = door
          ? door.enter
          : hc === 0
            ? 'left'
            : hc === ROOM_COLS - 1
              ? 'right'
              : hr === 0
                ? 'up'
                : 'down';
        h.step([dir]);
      }
    }
  }
  return frames;
}

/** Walks out through the south gate, onto the map. */
function outOfGate(h: H) {
  walkTo(h, key(GATE.room, GATE.col, GATE.row));
  for (let i = 0; i < 300 && !(h.top() instanceof WorldMapScene); i++) h.step(['down']);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
}

/** Walks into the door `id` (from its step) and waits for the fade to end. */
function goIn(h: H, id: string) {
  const d = DOORS.find((x) => x.id === id) as TownDoor;
  walkTo(h, key(d.room, d.col, d.row + (d.enter === 'up' ? 1 : -1)));
  for (let i = 0; i < 200 && h.top() instanceof TownScene && town(h).world.room.id === d.room; i++)
    h.step([d.enter]);
  h.until(() => !(h.top() instanceof TownScene) || town(h).free, 200);
}

/* ---------- The map: the spot, its label, JUMP straight in ---------- */

describe("the map: World 2's secret spot leads into Kakariko Village", () => {
  it('the spot keeps its key, road and level, and is a town: KAKARIKO, named once found', () => {
    const n = node('bonus-2');
    expect(n).toMatchObject({
      kind: 'bonus',
      unlock: 'bonus-2',
      level: TSA,
      label: 'TOP SECRET AREA',
      town: KAKARIKO,
      townLabel: 'KAKARIKO VILLAGE',
    });
    expect(isBonusArea(n)).toBe(true);
    expect(bonusAreaLabel(n, ['bonus-2'])).toBe('TOP SECRET AREA');
    expect(bonusAreaLabel(n, ['bonus-2', KAKARIKO])).toBe('KAKARIKO VILLAGE');
  });

  it('JUMP goes straight in (no character select); the first visit finds the village; the label follows', () => {
    const h = makeGame();
    onWorld2(h);
    expect(map(h).hintLine).toBe('TOP SECRET AREA');
    expect(h.said.at(-1)).toContain('Top Secret Area, open');
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TownScene);
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    expect(h.game.mapProgress.secrets).toContain(KAKARIKO);
    expect(loadSave(1)?.secrets).toContain(KAKARIKO);
    expect(town(h).first).toBe(true);
    // In through the gate, then the guard says hello (his first-visit cards).
    h.until(() => h.top() instanceof CardScene, 200);
    expect(readCards(h)).toEqual(GUARD_FIRST.map((p) => [...p]));
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('village');
    expect(h.said.some((s) => s.startsWith('Kakariko Village.'))).toBe(true);
    // Out through the south gate: the map, on the spot, now KAKARIKO VILLAGE; saved.
    outOfGate(h);
    h.until(() => map(h).mode === 'idle', 600);
    expect(map(h).node).toBe('bonus-2');
    expect(map(h).hintLine).toBe('KAKARIKO VILLAGE');
    expect(h.said.some((s) => s.includes('Kakariko Village, open'))).toBe(true);
    expect(h.game.mapProgress.cleared).not.toContain(TSA);
    expect(h.game.town).toBeNull();
    // Again: no hello this time; talking to him gets his later line.
    h.idle(8);
    h.tap('jump');
    expect(town(h).first).toBe(false);
    h.until(() => town(h).free, 200);
    expect(h.top()).toBeInstanceOf(TownScene);
    walkTo(h, key('gate', 11, 7));
    town(h).hero.facing = 'down';
    expect(talkTarget(town(h).world)?.id).toBe('guard');
    h.tap('jump');
    expect(readCards(h)).toEqual(GUARD_AGAIN.map((p) => [...p]));
  });

  it('an old file that found the spot before the village existed reads TOP SECRET AREA until it goes in', () => {
    const h = makeGame();
    onWorld2(h);
    expect(loadSave(1)?.secrets).toEqual(['bonus-2']);
    expect(map(h).nodeLabel(node('bonus-2'))).toBe('Top Secret Area, open');
  });
});

/* ---------- Every screen and door can be reached, and the edges line up ---------- */

describe('the village: screens, doors and edges', () => {
  it('six screens, 3 wide and 2 high; every screen edge lines up with the screen past it', () => {
    expect(SCREENS).toHaveLength(6);
    for (const id of SCREENS) {
      const [gx, gy] = SCREEN_AT[id];
      const east = SCREENS.find((s) => SCREEN_AT[s][0] === gx + 1 && SCREEN_AT[s][1] === gy);
      const south = SCREENS.find((s) => SCREEN_AT[s][0] === gx && SCREEN_AT[s][1] === gy + 1);
      const { free } = graph();
      const f = (room: string, c: number, r: number) => free.get(room)?.has(`${c},${r}`) ?? false;
      if (east)
        for (let r = 0; r < ROOM_ROWS; r++)
          expect(f(id, ROOM_COLS - 1, r), `${id} | ${east} row ${r}`).toBe(f(east, 0, r));
      if (south)
        for (let c = 0; c < ROOM_COLS; c++)
          expect(f(id, c, ROOM_ROWS - 1), `${id} / ${south} col ${c}`).toBe(f(south, c, 0));
    }
  });

  it('the village is closed all round but for the south gate', () => {
    const { free } = graph();
    for (const id of SCREENS) {
      const [gx, gy] = SCREEN_AT[id];
      const f = (c: number, r: number) => free.get(id)?.has(`${c},${r}`) ?? false;
      if (gx === 0) for (let r = 0; r < ROOM_ROWS; r++) expect(f(0, r), `${id} west row ${r}`).toBe(false);
      if (gx === 2) for (let r = 0; r < ROOM_ROWS; r++) expect(f(15, r), `${id} east row ${r}`).toBe(false);
      if (gy === 0) for (let c = 0; c < ROOM_COLS; c++) expect(f(c, 0), `${id} north col ${c}`).toBe(false);
      if (gy === 1)
        for (let c = 0; c < ROOM_COLS; c++) {
          const gate = id === GATE.room && c >= 6 && c <= 9;
          expect(f(c, 10), `${id} south col ${c}`).toBe(gate);
        }
    }
  });

  it('from the gate, every screen, every room, every door and everyone can be reached', () => {
    const got = reach();
    const rooms = new Set([...got.keys()].map((c) => c.split(':')[0]));
    expect([...rooms].sort()).toEqual([...villageDungeon().rooms.keys()].sort());
    // Each door's step (the shop's door itself is shut for now).
    for (const d of DOORS)
      expect(got.has(key(d.room, d.col, d.row + (d.enter === 'up' ? 1 : -1))), d.id).toBe(true);
    for (const d of DOORS.filter((x) => !x.shut)) expect(got.has(key(d.room, d.col, d.row)), d.id).toBe(true);
    // Someone to talk to: a reachable cell beside them (or below a counter).
    for (const f of FOLK) {
      if (f.who === 'hen') continue;
      const near = [
        [0, 1],
        [0, 2],
        [1, 0],
        [-1, 0],
        [0, -1],
      ].some(([dc, dr]) => got.has(key(f.room, f.col + (dc as number), f.row + (dr as number))));
      expect(near, f.who).toBe(true);
    }
  });

  it('every door has its room, and every room its way back out to its own door', () => {
    const rooms = villageDungeon().rooms;
    for (const d of DOORS) {
      if (d.to.startsWith('@')) continue;
      const pair = DOORS.find((x) => x.id === d.to) as TownDoor;
      expect(pair.to, d.id).toBe(d.id);
      expect(rooms.has(pair.room), d.id).toBe(true);
    }
    expect(DOORS.find((d) => d.id === 'secret-house')?.to).toBe('@tsa');
    expect(DOORS.find((d) => d.id === 'shop')?.shut).toBe(true);
  });

  it('a player walks every screen and in and out of every door, from the gate, with the pad', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO] });
    intoTown(h);
    const seen = new Set<string>();
    for (const d of DOORS.filter((x) => x.enter === 'up' && !x.to.startsWith('@'))) {
      goIn(h, d.id);
      const pair = DOORS.find((x) => x.id === d.to) as TownDoor;
      expect(town(h).world.room.id, d.id).toBe(pair.room);
      expect(town(h).hero.facing).toBe('up');
      seen.add(pair.room);
      goIn(h, pair.id);
      expect(town(h).world.room.id, pair.id).toBe(d.room);
      expect(town(h).hero.facing).toBe('down');
    }
    const spots: Record<string, [number, number]> = {
      well: [8, 7],
      square: [7, 6],
      orchard: [6, 8],
      gardens: [12, 4],
      gate: [8, 6],
      healer: [7, 8],
    };
    for (const id of SCREENS) {
      const [c, r] = spots[id] as [number, number];
      walkTo(h, key(id, c, r));
      expect(town(h).world.room.id).toBe(id);
      seen.add(id);
    }
    expect([...seen].sort()).toEqual([...villageDungeon().rooms.keys()].sort());
  });

  it('collision holds: a hero wandering at random never stands in anything solid, and only leaves by the gate', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO] });
    intoTown(h);
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
    const ways: Action[][] = [
      ['up'],
      ['down'],
      ['left'],
      ['right'],
      ['up', 'left'],
      ['up', 'right'],
      ['down', 'left'],
      ['down', 'right'],
      [],
    ];
    let held: Action[] = [];
    for (let i = 0; i < 6000; i++) {
      if (!(h.top() instanceof TownScene)) {
        readCards(h);
        if (h.top() instanceof WorldMapScene) break;
        if (h.top() instanceof LevelScene) break;
        continue;
      }
      if (i % 24 === 0) held = ways[Math.floor(rnd() * ways.length)] as Action[];
      h.step(held);
      if (!(h.top() instanceof TownScene)) continue;
      const t = town(h);
      if (t.world.transition || t.fade) continue;
      expect(t.world.blocked(t.hero.feet(), 'hero'), `${heroCell(t)} frame ${i}`).toBe(false);
    }
  });
});

/* ---------- Switching heroes ---------- */

describe('SELECT switches to the next freed hero (village only)', () => {
  it('cycles only freed heroes, in character select order, wrapping; each keeps their own power and kit', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO], freed: ['mario', 'link', 'simon'] });
    h.game.state.powerState = 'fire';
    intoTown(h);
    const t = town(h);
    const at = { x: t.hero.x, y: t.hero.y, facing: t.hero.facing };
    const names: string[] = [];
    for (let i = 0; i < 4; i++) {
      h.tap('select');
      names.push(h.game.state.character.id);
      expect({ x: t.hero.x, y: t.hero.y, facing: t.hero.facing }).toEqual(at);
      h.idle(SWITCH_GAP);
    }
    expect(names).toEqual(['link', 'simon', 'mario', 'link']);
    // Mario came back fire, as he was left.
    h.tap('select');
    h.idle(SWITCH_GAP);
    h.tap('select');
    expect(h.game.state.character.id).toBe('mario');
    expect(h.game.state.powerState).toBe('fire');
    expect(h.said).toContain('Link');
    expect(h.audio.sfx).toHaveBeenCalledWith('hero-switch');
  });

  it('a second press within the gap does nothing; nobody else freed: a buzz and the line', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO], freed: ['mario', 'luigi'] });
    intoTown(h);
    h.tap('select');
    h.tap('select');
    expect(h.game.state.character.id).toBe('luigi');
    const h2 = makeGame();
    onWorld2(h2, { secrets: ['bonus-2', KAKARIKO], freed: ['mario'] });
    intoTown(h2);
    h2.tap('select');
    expect(h2.game.state.character.id).toBe('mario');
    expect(h2.audio.sfx).toHaveBeenCalledWith('bump');
    expect(h2.said.at(-1)).toBe('No One Else Has Joined You Yet.');
    expect(town(h2).notice?.text).toBe(NO_ONE_ELSE);
  });

  it('not while a card is up; whoever walks out of the gate is the hero on the map', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO], freed: ['mario', 'samus'] });
    intoTown(h);
    walkTo(h, key('gate', 11, 7));
    town(h).hero.facing = 'down';
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CardScene);
    h.tap('select');
    expect(h.game.state.character.id).toBe('mario');
    readCards(h);
    h.tap('select');
    expect(h.game.state.character.id).toBe('samus');
    outOfGate(h);
    expect(loadSave(1)?.character).toBe('samus');
  });

  it("every hero has an overhead look: Link his keep sprite, Sophia III as Jason, Luigi in Mario's set", () => {
    for (const c of CHARACTERS)
      for (const facing of ['up', 'down', 'left', 'right'] as Dir[])
        for (const step of [0, 1] as const) {
          const look = overheadLook(c, 'small', {}, facing, step);
          expect(look.frame, c.id).toMatch(/^(down|up|side)-[01]$|^jason-o-(up|down|left|right)-[01]$/);
        }
    expect(overheadLook(LINK, 'full', {}, 'down', 0).sheet).toBe('link-td');
    expect(overheadLook(LINK, 'full', { tunic: 1 }, 'down', 0).palette).toBe('link-td-blue');
    expect(overheadLook(LINK, 'full', { beam: 1, tunic: 1 }, 'down', 0).palette).toBe('link-td-red');
    expect(overheadLook(LUIGI, 'fire', {}, 'left', 1)).toEqual({
      sheet: 'td-mario',
      palette: 'td-luigi-fire',
      frame: 'side-1',
      flip: true,
    });
    expect(overheadLook(SAMUS, 'full', { varia: 1 }, 'up', 0).palette).toBe('td-samus-varia');
    const sophia = CHARACTERS.find((c) => c.id === 'sophia') as CharacterDef;
    expect(overheadLook(sophia, 'full', {}, 'left', 0)).toEqual({
      sheet: 'sophia',
      frame: 'jason-o-left-0',
      flip: false,
    });
  });
});

/* ---------- Townsfolk and the healer ---------- */

describe('townsfolk', () => {
  it('everyone has words; some change with the hero', () => {
    const ctx = (hero: CharacterDef) => ({
      hero,
      heroName: hero.name.toUpperCase(),
      firstVisit: false,
      switchButton: 'TOOLS',
    });
    for (const f of FOLK) {
      const def = FOLK_DEFS[f.who];
      expect(def, f.who).toBeDefined();
      if (f.who !== 'hen') expect(def!.pages(ctx(MARIO)).length, f.who).toBeGreaterThan(0);
    }
    expect(FOLK_DEFS.gardener!.pages(ctx(LINK))).not.toEqual(FOLK_DEFS.gardener!.pages(ctx(MARIO)));
    expect(FOLK_DEFS.kid!.pages(ctx(SAMUS))).not.toEqual(FOLK_DEFS.kid!.pages(ctx(MARIO)));
    expect(FOLK_DEFS.well!.pages(ctx(LINK))[0]?.join(' ')).toContain('LINK');
    expect(FOLK_DEFS['old-man']!.pages({ ...ctx(MARIO), switchButton: 'HERO' })).toEqual(oldManPages('HERO'));
  });

  it('every line fits a card (26 columns) and names no level by its number', () => {
    const ctx = { hero: MARIO, heroName: 'SOPHIA III', firstVisit: true, switchButton: 'TOOLS' };
    for (const [who, def] of Object.entries(FOLK_DEFS))
      for (const page of def.pages(ctx))
        for (const line of page) {
          expect(line.length, `${who}: ${line}`).toBeLessThanOrEqual(26);
          expect(line, who).not.toMatch(/\b[1-8]-[1-4]\b|\bWORLD [1-8]\b/);
        }
  });

  it('the healer heals a hero who counts hit points in full, for free; Mario gets a joke', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO], freed: ['mario', 'link'] });
    intoTown(h);
    goIn(h, 'healer-house');
    walkTo(h, key('healer-house', 7, 3));
    town(h).hero.facing = 'up';
    const coins = h.game.state.coins;
    h.tap('jump');
    expect(readCards(h)).toEqual(HEALER_PLUMBER.map((p) => [...p]));
    h.tap('select');
    expect(h.game.state.character.id).toBe('link');
    h.game.state.hp = 1;
    h.idle(SWITCH_GAP);
    h.tap('jump');
    expect(readCards(h)).toEqual(HEALER_HEALS.map((p) => [...p]));
    expect(h.game.state.hp).toBe(fullHp(LINK, h.game.state.kit));
    expect(h.game.state.hp).toBeGreaterThan(1);
    expect(h.game.state.coins).toBe(coins);
    expect(h.said).toContain('Health restored.');
  });

  it("the healer's full is each hero's own: their kit's maximum, else their start", () => {
    for (const c of CHARACTERS) {
      if (c.damage.kind !== 'hp') {
        expect(fullHp(c, {}), c.id).toBe(0);
        continue;
      }
      expect(fullHp(c, { maxHp: 12 }), c.id).toBe(12);
    }
  });

  it('the TALK prompt is said once as someone comes in reach, with its key', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO] });
    intoTown(h);
    walkTo(h, key('gate', 8, 3));
    const before = h.said.length;
    walkTo(h, key('gate', 11, 7));
    h.step(['down']);
    h.idle(4);
    expect(h.said.slice(before).filter((s) => s.startsWith('Guard.'))).toEqual(['Guard. TALK.']);
    expect(town(h).touchLabels().jump).toBe('TALK');
  });
});

/* ---------- The secret house: the Top Secret Area, refilled once per visit ---------- */

const BLOCKS = [6, 7, 8, 9, 10];
/** Stands player 1 on the Top Secret Area's pipe. */
function onPipe(l: LevelScene) {
  const b = l.world.player.body;
  b.x = px(13 * 16 + 16) - (b.w >> 1);
  b.y = px(11 * 16) - b.h;
  b.vy = 0;
}

describe('the secret house', () => {
  it('its door loads the Top Secret Area with the town hero; the pipe comes back to its step', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO], freed: ['mario', 'link'] });
    intoTown(h);
    h.tap('select');
    goIn(h, 'secret-house');
    expect(h.top()).toBeInstanceOf(LevelScene);
    const l = h.top() as LevelScene;
    expect(l.level.id).toBe(TSA);
    expect(l.world.player.def.id).toBe('link');
    expect(getLevel(TSA).zones.find((z) => z.kind === 'pipe')).toMatchObject({
      target: { level: TOWN_EXIT },
    });
    onPipe(l);
    for (let i = 0; i < 400 && !(h.top() instanceof TownScene); i++) h.step(['down']);
    expect(h.top()).toBeInstanceOf(TownScene);
    h.until(() => town(h).free, 100);
    const d = DOORS.find((x) => x.id === 'secret-house') as TownDoor;
    expect(town(h).world.room.id).toBe(d.room);
    expect([town(h).hero.x, town(h).hero.y, town(h).hero.facing]).toEqual([
      d.col * TILE,
      (d.row + 1) * TILE,
      'down',
    ]);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('village');
  });

  it('a block opened stays used for the rest of the visit, whoever goes in; the next visit finds all five full', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO], freed: ['mario', 'link'] });
    intoTown(h);
    goIn(h, 'secret-house');
    let l = h.top() as LevelScene;
    l.world.strikeBlock(9, 9, l.world.player, false);
    l.world.strikeBlock(6, 9, l.world.player, false);
    h.idle(30);
    onPipe(l);
    for (let i = 0; i < 400 && !(h.top() instanceof TownScene); i++) h.step(['down']);
    h.until(() => town(h).free, 100);
    // Another hero, same visit: still used.
    h.tap('select');
    goIn(h, 'secret-house');
    l = h.top() as LevelScene;
    expect(BLOCKS.map((x) => l.world.map.get(x, 9))).toEqual([
      T.USED,
      T.Q_FLOWER,
      T.Q_EGG,
      T.USED,
      T.Q_MUSHROOM,
    ]);
    onPipe(l);
    for (let i = 0; i < 400 && !(h.top() instanceof TownScene); i++) h.step(['down']);
    h.until(() => town(h).free, 100);
    // Out through the gate and back in from the map: a new visit, all full.
    outOfGate(h);
    h.until(() => map(h).mode === 'idle', 600);
    intoTown(h);
    goIn(h, 'secret-house');
    l = h.top() as LevelScene;
    expect(BLOCKS.map((x) => l.world.map.get(x, 9))).toEqual([
      T.Q_FLOWER,
      T.Q_FLOWER,
      T.Q_EGG,
      T.Q_MUSHROOM,
      T.Q_MUSHROOM,
    ]);
  });

  it('Pause → Quit to map from the Top Secret Area ends the visit (the next one refills)', () => {
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO] });
    intoTown(h);
    goIn(h, 'secret-house');
    expect(h.game.town).not.toBeNull();
    h.game.returnToMap();
    expect(h.game.town).toBeNull();
  });
});

/* ---------- Campaign only; the door lock ---------- */

describe('campaign only', () => {
  it('outside the campaign the Top Secret Area is as before: its pipe goes back to the title', () => {
    const h = makeGame();
    h.game.devStart(TSA, MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 400);
    const l = h.top() as LevelScene;
    expect(h.game.town).toBeNull();
    onPipe(l);
    for (let i = 0; i < 400 && h.top() instanceof LevelScene; i++) h.step(['down']);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(MAP_EXIT).not.toBe(TOWN_EXIT);
  });

  it('no file, no village: the town is only entered from a campaign map', () => {
    const h = makeGame();
    expect(h.game.campaign).toBeNull();
    expect(h.game.town).toBeNull();
    expect(VILLAGE_NAME).toBe('KAKARIKO VILLAGE');
    for (const id of SCREENS) expect(OUTDOOR[id]).toHaveLength(11);
    expect(isOutdoor('inn')).toBe(false);
  });
});

describe('the art', () => {
  it('every picture a room uses, every townsperson and every hero from above is drawn', () => {
    const town = SPRITES.town!.frames;
    for (const id of villageDungeon().rooms.keys())
      for (const cell of townArt(id) ?? [])
        for (const f of cell ?? []) expect(town[f], `${id}: ${f}`).toBeDefined();
    expect(town['door-boarded']).toBeDefined();
    expect(town['door-closed']).toBeDefined();
    const folk = SPRITES['town-folk']!.frames;
    for (const [who, def] of Object.entries(FOLK_DEFS)) {
      if (!def.frames) continue;
      for (const k of who === 'hen' ? ['-0', '-1', '-flap'] : ['-0', '-1', '-side'])
        expect(folk[`${def.frames}${k}`], `${who}${k}`).toBeDefined();
    }
    for (const k of ['puff-0', 'puff-1', 'puff-2', 'puff-calm']) expect(folk[k]).toBeDefined();
    for (const c of CHARACTERS)
      for (const facing of ['up', 'down', 'left', 'right'] as Dir[])
        for (const step of [0, 1] as const) {
          const look = overheadLook(
            c,
            c.damage.kind === 'powerup' ? 'fire' : 'full',
            { tunic: 1, varia: 1 },
            facing,
            step,
          );
          expect(SPRITES[look.sheet]?.frames[look.frame], `${c.id} ${look.frame}`).toBeDefined();
          if (look.palette) expect(PALETTES.default[look.palette], look.palette).toBeDefined();
        }
  });
});

describe('dev level select: the village for testing', () => {
  it('its `village` entry walks in with no file: every hero to switch to, nothing saved, the title after', () => {
    const h = makeGame();
    h.game.devStart(DEV_VILLAGE, MARIO, 'small');
    expect(h.top()).toBeInstanceOf(TownScene);
    expect(h.game.campaign).toBeNull();
    h.until(() => town(h).free, 200);
    expect(h.top()).toBeInstanceOf(TownScene); // no hello: nothing was found
    h.tap('select');
    expect(h.game.state.character.id).toBe('luigi');
    expect(h.game.mapProgress.secrets).not.toContain(KAKARIKO);
    outOfGate2(h);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.game.town).toBeNull();
  });
});

/** Out of the gate when no map follows (dev). */
function outOfGate2(h: H) {
  walkTo(h, key(GATE.room, GATE.col, GATE.row));
  for (let i = 0; i < 300 && h.top() instanceof TownScene; i++) h.step(['down']);
}

describe('the door lock (for a later secret)', () => {
  it("a door that needs a secret is shut, boarded, and says so, until the file's secrets have it", () => {
    const doors = DOORS.map((d) => (d.id === 'house-a' ? { ...d, needs: 'moved-log' } : d));
    expect(villageRooms(undefined, doors).find((r) => r.id === 'well')?.entrances?.[0]?.needs).toBe(
      'moved-log',
    );
    const h = makeGame();
    onWorld2(h, { secrets: ['bonus-2', KAKARIKO] });
    h.idle(8);
    h.game.enterTown();
    const t = new TownScene(h.game, { first: false, doors });
    h.game.scenes.clear();
    h.game.scenes.push(t);
    (h.game.town as { scene: TownScene }).scene = t;
    h.until(() => t.free, 200);
    walkTo(h, key('well', 5, 6));
    for (let i = 0; i < 30; i++) h.step(['up']);
    expect(t.world.room.id).toBe('well');
    expect(h.said).toContain('Closed. Ask Around.');
    h.game.mapProgress.secrets.push('moved-log');
    for (let i = 0; i < 60 && t.world.room.id === 'well'; i++) h.step(['up']);
    h.until(() => t.free, 100);
    expect(t.world.room.id).toBe('house-a');
  });

  it('none of the village doors is locked today', () => {
    expect(DOORS.filter((d) => d.needs)).toEqual([]);
    expect(Object.keys(FOLK_DEFS).length).toBeGreaterThan(10);
    void Townsperson;
    void nextHero;
  });
});

describe("the village HUD's switch hint", () => {
  /** Just enough of a game for the hint: the scheme in use and the TOOLS key bound to it. */
  const fake = (scheme: ControlScheme, code: string) =>
    ({
      deps: {
        controlScheme: () => scheme,
        settings: { input: { bindings: [{ keyboard: { select: [code] }, gamepad: { select: [code] } }] } },
      },
    }) as unknown as Game;

  it('fits the line at every input style and key name (RQ41: "SWITCH HE" was cut off)', () => {
    const keys = ['ShiftRight', 'ControlRight', 'ControlLeft', 'Backspace', 'NumpadMultiply', 'KeyQ'];
    for (const code of keys) {
      for (const scheme of ['keyboard', 'gamepad', 'touch'] as const) {
        const hint = townHudHint(fake(scheme, scheme === 'gamepad' ? 'pad:8' : code));
        expect(hint.length, `${scheme} ${code}: ${hint}`).toBeLessThanOrEqual(HUD_HINT_CHARS);
        expect(hint).toMatch(/^(TOOLS|HERO BUTTON).*: NEXT HERO$/);
      }
    }
    expect(townHudHint(fake('keyboard', 'ShiftRight'))).toBe('TOOLS (RIGHT SHIFT): NEXT HERO');
    expect(townHudHint(fake('keyboard', 'ControlRight'))).toBe('TOOLS: NEXT HERO');
    expect(townHudHint(fake('gamepad', 'pad:8'))).toBe('TOOLS (BACK): NEXT HERO');
    expect(townHudHint(fake('touch', 'ShiftRight'))).toBe('HERO BUTTON: NEXT HERO');
  });
});

describe('the village menu and the TALK prompt (RQ41)', () => {
  it('the pause panel sits over a blank HUD band (the HUD lines showed through and round it)', () => {
    const h = makeGame();
    const rects: [number, number, number, number, string][] = [];
    const r = new NullRenderer() as unknown as Renderer;
    r.rect = (x: number, y: number, w: number, hh: number, c: string) => void rects.push([x, y, w, hh, c]);
    new TownMenuScene(h.game, () => undefined).render(r);
    expect(rects[0]).toEqual([0, 0, 256, HUD_H, '#000000']);
  });

  it('the prompt goes under the townsperson when the hero talks down to them, else over them', () => {
    // Hero a tile above, facing down: the band is under the person, clear of the hero.
    expect(promptRow(80, 64)).toBe(98);
    expect(promptRow(80, 64) >= 80 + 16).toBe(true);
    // Hero below or beside: over the person, as before.
    expect(promptRow(80, 96)).toBe(68);
    expect(promptRow(80, 80)).toBe(68);
    // Kept on the screen at the edges.
    expect(promptRow(4, 20)).toBe(1);
    expect(promptRow(160, 144)).toBeLessThanOrEqual(176 - 11);
  });
});
