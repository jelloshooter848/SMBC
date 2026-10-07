import { describe, expect, it } from 'vitest';
import type { Scene } from '@engine/scene';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { arenaPadId } from '@content/worldmap/arena';
import { ARENA_FEET, ARENA_GAMES, ARENA_LOCKED, arenaGameAt } from '@game/arena';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { SPRITES } from '@content/sprites';
import { WorldMapScene, MAP_FADE_FRAMES } from '@game/scenes/world-map';
import { DevMiniGameResultScene, playRound } from '@game/scenes/dev-minigames';
import { awardPrize, type AwardOutcome } from '@game/bonus/use';
import { LevelScene } from '@game/scenes/level';
import { CharacterSelectScene } from '@game/scenes/character-select';
import type { MenuItem } from '@game/scenes/menu';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { isOpen, openPaths } from '@game/map/rules';
import { loadSave, type SaveFile } from '@game/save/save-files';
import { defaultSettings } from '@engine/save/settings';
import {
  draw,
  file,
  intoBonus,
  makeGame,
  offered,
  standByLuigi,
  store,
  useStorage,
  type H,
} from './heroes-harness';
import { ALL_STORY } from './story-seen';

// The MINI GAME ARENA (0.4.7): the hub's first pad leads to it; one pad per game the registries
// list, found by the file's own progress (met heroes, 1-0, training answers, Larry's airship, the
// bonus spot), played for fun with the Dev → Mini games round and result card, then back on the
// pad. Nothing is ever saved by a round.

useStorage();

const arena = () => mapPage('arena') as WorldMapPage;
const pad = (game: string): MapNode => arena().nodes.find((n) => n.id === arenaPadId(game)) as MapNode;
const map = (h: H) => h.top() as WorldMapScene;

/** A file every arena game is found on: every hero freed, 1-0 cleared, the crystal ball taken. */
const LATE: Partial<SaveFile> = {
  cleared: ['1-0', '1-1', '1-2', '4-1', '4-2'],
  secrets: ['bonus-1', 'larry'],
  pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4', 'hub', 'arena'],
  freed: ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill', 'sophia'],
};

/** File 1 open on the arena, the hero on `node`. */
function onArena(h: H, over: Partial<SaveFile> = {}, node = 'start'): WorldMapScene {
  h.game.openFile(1, file({ pages: ['smb-1', 'hub', 'arena'], ...over, position: { page: 'arena', node } }));
  h.idle(8);
  const m = map(h);
  expect(m).toBeInstanceOf(WorldMapScene);
  expect([m.page.id, m.node]).toEqual(['arena', node]);
  return m;
}

/** Character select is up (Larry's airship): OK on the hero highlighted. */
function confirmHero(h: H): void {
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  h.tap('jump');
  expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
}

const found = (h: H) =>
  ARENA_GAMES.filter((g) => g.found(h.game))
    .map((g) => g.id)
    .sort();

/** End whatever round is on top the way a player would: its menu's Give up (or Skip training). */
function quitRound(h: H, map: Scene): void {
  for (let f = 0; f < 3000 && !(h.top() instanceof DevMiniGameResultScene); f++) {
    if (f % 90 !== 89) {
      h.step();
      continue;
    }
    h.tap('start');
    const items = (h.top() as { items?: MenuItem[] }).items ?? [];
    const quit = items.find((i) => i.label === 'Give up' || i.label === 'Skip training');
    if (quit) quit.select?.();
    else if (items.length) h.tap('start');
  }
  expect(h.top()).toBeInstanceOf(DevMiniGameResultScene);
  expect(h.game.scenes.find((s) => s === map)).toBe(map);
}

describe('the Warp Zone hub: the Arena pad', () => {
  it('is open on a file that has only just reached the hub, and leads to the arena', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({
        cleared: ['1-0', '1-1'],
        secrets: ['bonus-1'],
        pages: ['smb-1', 'hub'],
        position: { page: 'hub', node: 'warp-arena' },
        story: [...ALL_STORY], // Toad's first-visit line: toad-guide.test.ts
      }),
    );
    h.idle(8);
    expect(map(h).hintLine).toBe('MINI GAME ARENA');
    expect(map(h).touchLabels().jump).toBe('WARP');
    h.tap('jump');
    expect(map(h).page.id).toBe('arena');
    h.idle(MAP_FADE_FRAMES + 4);
    h.until(() => map(h).mode === 'idle', 3000);
    expect(map(h).node).toBe('start');
    expect(map(h).hintLine).toBe('RETURN TO WARP ZONE');
    expect(h.said.at(-1)).toBe('Arena, MINI GAME ARENA. Warp, Return To Warp Zone');
    expect(loadSave(1)?.position).toEqual({ page: 'arena', node: 'start' });
  });
});

describe('an old file standing on the Lost Levels pad', () => {
  it('lands on the hub centre (the pad is the Arena pad now)', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({
        cleared: ['1-0', '1-1', '1-2'],
        secrets: ['bonus-1'],
        pages: ['smb-1', 'hub'],
        position: { page: 'hub', node: 'warp-lost' },
        lastNode: { hub: 'warp-lost' },
      }),
    );
    h.idle(8);
    expect([map(h).page.id, map(h).node]).toEqual(['hub', 'start']);
    expect(map(h).hintLine).toBe('RETURN TO WORLD 1');
    expect(loadSave(1)?.position).toEqual({ page: 'hub', node: 'start' });
    expect(loadSave(1)?.lastNode.hub).toBe('start');
  });
});

describe('the Mini Game Arena', () => {
  it('lists every hero mini game, the training rooms, 1-0, the airship and the bonus games', () => {
    const ids = ARENA_GAMES.map((g) => g.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'mini-luigi',
        'mini-link',
        'mini-megaman',
        'mini-samus',
        'airship',
        'bonus-toad-house',
        'bonus-memory',
        'bonus-slots',
        'stage-1-0',
        'train-luigi',
        'train-bill',
      ]),
    );
    expect(ids).not.toContain('train-mario');
    for (const g of ARENA_GAMES) {
      expect(pad(g.id), g.id).toBeDefined();
      for (const t of [g.title, g.locked]) {
        expect(t.length, t).toBeLessThanOrEqual(32);
        expect(t, 'names no buttons').toMatch(/^[A-Z0-9?' -]+$/);
      }
      expect(g.locked).toMatch(/^\?\?\? - /);
    }
  });

  it('every pad and road is walkable as soon as the arena is open, found or not', () => {
    const h = makeGame();
    const m = onArena(h);
    const prog = h.game.mapProgress;
    for (const n of arena().nodes) expect(isOpen(prog, arena(), n.id), n.id).toBe(true);
    expect(openPaths(prog, arena()).paths).toHaveLength(arena().paths.length);
    // Left to the first pad of the middle row, on along it with the d-pad, and back.
    const first = ARENA_GAMES[0]!.id;
    const third = ARENA_GAMES[2]!.id;
    h.tap('left');
    h.until(() => m.mode === 'idle', 120);
    expect(m.node).toBe(arenaPadId(first));
    expect(h.said.at(-1)).toBe('Locked. Find This Hero First.');
    h.tap('left');
    h.until(() => m.mode === 'idle', 120);
    expect(m.node).toBe(arenaPadId(third));
    h.tap('right');
    h.until(() => m.mode === 'idle', 120);
    h.tap('right');
    h.until(() => m.mode === 'idle', 120);
    expect(m.node).toBe('start');
  });

  it('a fresh file: every pad is a dark ??? pad that cannot be played', () => {
    const h = makeGame();
    onArena(h);
    expect(found(h)).toEqual([]);
    const m = map(h);
    expect(m.hintLine).toBe('RETURN TO WARP ZONE');
    // On a pad: the hint says what to find, JUMP bumps, nothing to press.
    h.game.openFile(
      1,
      file({ pages: ['smb-1', 'hub', 'arena'], position: { page: 'arena', node: arenaPadId('mini-luigi') } }),
    );
    h.idle(8);
    expect(map(h).hintLine).toBe(ARENA_LOCKED.hero);
    expect(map(h).touchLabels().jump).toBeNull();
    const saves = new Map(store);
    h.tap('jump');
    expect(h.top()).toBe(map(h));
    expect(h.said.at(-1)).toBe('Locked. Find This Hero First.');
    expect(new Map(store)).toEqual(saves);
    // Drawn dark: Luigi's black silhouette standing on the dark pad; a pad with no hero shows '?'.
    const d = draw(map(h));
    const p = pad('mini-luigi');
    expect(d.sprites.some((s) => s.key.includes('luigi~silhouette'))).toBe(true);
    expect(
      d.sprites.some((s) => s.frame === 'map-arena-locked-plate' && s.x === p.x * 16 && s.y === p.y * 16),
    ).toBe(true);
    const a = pad('airship');
    expect(
      d.sprites.some((s) => s.frame === 'map-arena-locked' && s.x === a.x * 16 && s.y === a.y * 16),
    ).toBe(true);
  });

  it('a late file: every game is found and shows in colour', () => {
    const h = makeGame();
    onArena(h, LATE);
    expect(found(h)).toEqual(ARENA_GAMES.map((g) => g.id).sort());
    const d = draw(map(h));
    expect(d.sprites.some((s) => s.key.includes('~silhouette'))).toBe(false);
    expect(d.sprites.some((s) => s.frame.startsWith('map-arena-locked'))).toBe(false);
    // Red pads for the games, blue pads for the tutorials, a figure standing on each.
    const frameAt = (game: string) =>
      d.sprites.find((s) => s.key === 'items' && s.x === pad(game).x * 16 && s.y === pad(game).y * 16)?.frame;
    expect(frameAt('mini-luigi')).toBe('map-arena-game-plate');
    expect(frameAt('bonus-memory')).toBe('map-arena-game-plate');
    expect(frameAt('train-link')).toBe('map-arena-tutorial-plate');
    expect(frameAt('stage-1-0')).toBe('map-arena-tutorial-plate');
    expect(d.sprites.some((s) => s.key === 'mario@luigi')).toBe(true);
  });

  it('finds each game by its own rule', () => {
    const h = makeGame();
    // Talked to Luigi once: his mini game; his training only once asked or freed.
    onArena(h, { met: ['mario', 'luigi'] });
    expect(found(h)).toEqual(['mini-luigi']);
    onArena(h, { tutorials: ['mario', 'link'] });
    expect(found(h)).toEqual(['train-link']);
    onArena(h, { freed: ['mario', 'samus'] });
    expect(found(h)).toEqual(['mini-samus', 'train-samus']);
    // 1-0 cleared (or skipped, which clears it).
    onArena(h, { cleared: ['1-0'] });
    expect(found(h)).toEqual(['stage-1-0']);
    // Larry's airship once boarded; the bonus games with the bonus spot (his crystal ball).
    onArena(h, { met: ['mario', 'larry'] });
    expect(found(h)).toEqual(['airship']);
    onArena(h, { secrets: ['larry'] });
    expect(found(h)).toEqual(['airship', 'bonus-memory', 'bonus-slots', 'bonus-toad-house']);
    // An older file with no `met`: its freed heroes count as met.
    const { met: _m, ...old } = { ...LATE, freed: ['mario', 'link'], secrets: [], cleared: [] } as SaveFile;
    onArena(h, old);
    expect(found(h)).toEqual(['mini-link', 'train-link']);
  });

  it('announces a found pad and labels JUMP PLAY; the hint line names the game', () => {
    const h = makeGame();
    onArena(h, LATE, arenaPadId('mini-luigi'));
    const m = map(h);
    expect(m.hintLine).toBe('MIRROR RACE');
    expect(m.touchLabels()).toMatchObject({ jump: 'PLAY', start: 'MENU' });
    expect(m.nodeLabel(pad('mini-luigi'))).toMatch(/^Mirror Race, Luigi\. JUMP.* to play, for fun\.$/);
    expect(m.nodeLabel(pad('train-link'))).toMatch(/^Link Training\. JUMP/);
    expect(arenaGameAt(pad('airship'))?.title).toBe("LARRY'S AIRSHIP");
  });

  it.each(ARENA_GAMES.map((g) => [g.id] as const))(
    '%s launches, ends with its result card, and returns to its pad with the save untouched',
    (id) => {
      const h = makeGame();
      const m = onArena(h, LATE, arenaPadId(id));
      const saves = new Map(store);
      expect(saves.size).toBe(1);
      const state = h.game.state;
      const before = { ...state, kit: { ...state.kit } };
      const progress = structuredClone(h.game.mapProgress);
      const bonus = structuredClone(h.game.bonus);
      h.tap('jump');
      // Larry's airship asks for a hero first: the current one, as preselected.
      if (id === 'airship') confirmHero(h);
      expect(h.top()).not.toBe(m);
      expect(h.game.campaign).toBeNull(); // no file open: nothing can save
      quitRound(h, m);
      const card = h.top() as DevMiniGameResultScene;
      expect(card.result).toBe('quit');
      h.idle(40);
      expect(draw(card).texts.map((t) => t.str)).toContain('QUIT');
      h.audio.playMusic.mockClear();
      h.tap('jump');
      expect(h.top()).toBe(m);
      expect([m.page.id, m.node, m.mode]).toEqual(['arena', arenaPadId(id), 'idle']);
      expect(h.audio.playMusic).toHaveBeenLastCalledWith(arena().music);
      // Nothing changed: the file byte for byte, the run, the map, the items, the heroes.
      expect(new Map(store)).toEqual(saves);
      expect(h.game.campaign).toEqual({ slot: 1 });
      expect(h.game.state).toBe(state);
      expect({ ...state, kit: { ...state.kit } }).toEqual(before);
      expect(h.game.mapProgress).toEqual(progress);
      expect(h.game.bonus).toEqual(bonus);
      expect(h.game.freed).toEqual(LATE.freed);
      expect(h.game.stageRound).toBeNull();
      expect(h.game.tutorialRun).toBeNull();
      expect(h.game.airship).toBeNull();
      // Walking on and saving later writes the file as it was.
      h.game.autosave();
      const after = loadSave(1)!;
      const was = JSON.parse(saves.get('smbc.save.1') as string) as SaveFile;
      expect({ ...after, updated: 0 }).toEqual({ ...was, updated: 0 });
    },
  );

  it('a round that passes or fails changes nothing either (Mirror Race, Luigi wins: FAIL)', () => {
    const h = makeGame();
    const m = onArena(h, LATE, arenaPadId('mini-luigi'));
    const saves = new Map(store);
    const lives = h.game.state.lives;
    h.tap('jump');
    h.until(() => h.top() instanceof DevMiniGameResultScene, 3000);
    expect((h.top() as DevMiniGameResultScene).result).toBe('fail');
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(m);
    expect(h.game.state.lives).toBe(lives);
    expect(new Map(store)).toEqual(saves);
  });

  it('developer Unlock all finds every game; a round leaves the file byte for byte', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    const m = onArena(h, { devUnlockAll: true }, arenaPadId('train-samus'));
    expect(found(h)).toEqual(ARENA_GAMES.map((g) => g.id).sort());
    expect(m.hintLine).toBe('SAMUS TRAINING');
    const saves = new Map(store);
    h.tap('jump');
    quitRound(h, m);
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(m);
    expect(new Map(store)).toEqual(saves);
    expect(h.game.freed).toEqual(['mario']);
    expect(h.game.tutorials).toEqual(['mario']);
  });

  it('a training pad not found yet asks to free the hero', () => {
    const h = makeGame();
    onArena(h, {}, arenaPadId('train-link'));
    expect(map(h).hintLine).toBe('??? - FREE THIS HERO FIRST');
    expect(h.said.at(-1)).toContain('Locked. Free This Hero First.');
  });

  it("a co-op round (Larry's airship, two players) leaves player two's hero and hit points", () => {
    const h = makeGame();
    const m = onArena(h, { ...LATE, character2: 'link', hp2: 2, powerState2: 'full' }, arenaPadId('airship'));
    const s = h.game.state;
    expect([s.character2?.id, s.hp2, s.powerState2]).toEqual(['link', 2, 'full']);
    const before = { ...s, kit: { ...s.kit }, kit2: { ...s.kit2 } };
    const saves = new Map(store);
    h.tap('jump');
    confirmHero(h);
    expect(h.game.airship).not.toBeNull();
    expect(h.game.state.character2?.id).toBe('link');
    // Hurt player two aboard, then give up.
    h.game.state.hp2 = 1;
    quitRound(h, m);
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(m);
    expect(h.game.state).toBe(s);
    expect([s.character2?.id, s.hp2, s.powerState2]).toEqual(['link', 2, 'full']);
    expect({ ...s, kit: { ...s.kit }, kit2: { ...s.kit2 } }).toEqual(before);
    expect(new Map(store)).toEqual(saves);
  });

  it('the 1-0 round: its flagpole passes, and the file keeps its own hero', () => {
    const h = makeGame();
    const m = onArena(h, { ...LATE, character: 'link' }, arenaPadId('stage-1-0'));
    const saves = new Map(store);
    h.tap('jump');
    expect(h.game.stageRound).not.toBeNull();
    expect(h.game.state.character.id).toBe('mario');
    h.until(() => h.top() instanceof LevelScene, 60);
    const level = h.top() as LevelScene;
    expect(level.level.id).toMatch(/^1-0/);
    // Straight to the exit, as the flagpole's end does.
    level.world.events.push({ type: 'exit', next: '1-1' });
    h.step();
    expect((h.top() as DevMiniGameResultScene).result).toBe('pass');
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(m);
    expect(h.game.state.character.id).toBe('link');
    expect(new Map(store)).toEqual(saves);
  });
});

type Box = [number, number, number, number];
interface Drawn {
  sheet: string;
  frame: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The opaque pixels' bounds on screen (x0, y0, x1, y1; ends exclusive). */
  box: Box;
}

/** Draws `scene`, recording every sprite in order with its frame size and opaque bounds. */
function drawBoxes(scene: { render(r: Renderer): void }): Drawn[] {
  const out: Drawn[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    sprite(sh: SpriteSheet, frame: string, x: number, y: number, flip = false): void {
      const rows = SPRITES[sh.id.split(/[@~]/)[0] as string]?.frames[frame] as readonly string[];
      const h = rows.length;
      const w = rows[0]?.length ?? 0;
      let [x0, y0, x1, y1] = [w, h, 0, 0];
      rows.forEach((row, j) =>
        [...row].forEach((c, i) => {
          if (c === '.') return;
          const u = flip ? w - 1 - i : i;
          [x0, y0, x1, y1] = [Math.min(x0, u), Math.min(y0, j), Math.max(x1, u + 1), Math.max(y1, j + 1)];
        }),
      );
      out.push({ sheet: sh.id, frame, x, y, w, h, box: [x + x0, y + y0, x + x1, y + y1] });
    },
  });
  scene.render(r);
  return out;
}

const meets = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

describe("Larry's airship pad: character select first (the one arena game played as your own hero)", () => {
  const run = (s: { character: { id: string }; powerState: string; lives: number; hp: number }) => [
    s.character.id,
    s.powerState,
    s.lives,
    s.hp,
  ];

  it('opens character select over the map; picking Link plays the round as Link; the file keeps its hero', () => {
    const h = makeGame();
    const m = onArena(h, { ...LATE, powerState: 'fire', lives: 7 }, arenaPadId('airship'));
    const s = h.game.state;
    expect(run(s)).toEqual(['mario', 'fire', 7, s.hp]);
    const before = { ...s, kit: { ...s.kit } };
    const tutorials = h.game.tutorials.slice();
    const saves = new Map(store);
    h.tap('jump');
    // The select, over the map: nothing has started yet (the file is still open).
    const select = h.top();
    expect(select).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.scenes.find((x) => x === m)).toBe(m);
    expect(h.game.campaign).toEqual({ slot: 1 });
    expect(h.game.airship).toBeNull();
    expect(h.said.at(-1)).toMatch(/^Choose your hero\. Mario\. Left and right to choose, OK to confirm\./);
    h.idle(12);
    h.tap('right'); // Luigi
    h.tap('right');
    expect(h.said.at(-1)).toBe('Link');
    h.tap('jump');
    // Link is freed but never trained on this file: no training question in a round for fun.
    const deck = h.top() as LevelScene;
    expect(deck).toBeInstanceOf(LevelScene);
    expect(deck.level.id).toBe('4-2-airship');
    expect(deck.world.player.def.id).toBe('link');
    expect(h.game.state.character.id).toBe('link');
    expect(h.game.campaign).toBeNull();
    expect(h.game.airship).not.toBeNull();
    quitRound(h, m);
    const card = h.top() as DevMiniGameResultScene;
    expect(card.lines.slice(0, 2)).toEqual(["LARRY'S AIRSHIP", 'LARRY KOOPA']);
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(m);
    expect([m.page.id, m.node, m.mode]).toEqual(['arena', arenaPadId('airship'), 'idle']);
    // The file's hero, power, lives and hit points, and the whole run, as they were.
    expect(h.game.state).toBe(s);
    expect(run(s)).toEqual(['mario', 'fire', 7, before.hp]);
    expect({ ...s, kit: { ...s.kit } }).toEqual(before);
    expect(h.game.tutorials).toEqual(tutorials);
    expect(new Map(store)).toEqual(saves);
    h.game.autosave();
    expect(loadSave(1)?.character).toBe('mario');
    expect(loadSave(1)?.powerState).toBe('fire');
    expect(loadSave(1)?.lives).toBe(7);
  });

  it('OK straight away plays as the current hero, keeping its power for the round', () => {
    const h = makeGame();
    const m = onArena(h, { ...LATE, character: 'samus', powerState: 'full', hp: 2 }, arenaPadId('airship'));
    h.tap('jump');
    expect(h.said.at(-1)).toMatch(/^Choose your hero\. Samus\./);
    confirmHero(h);
    const deck = h.top() as LevelScene;
    expect(deck.world.player.def.id).toBe('samus');
    expect(h.game.state.hp).toBe(2);
    quitRound(h, m);
  });

  it("offers only the file's freed heroes (the others are silhouettes, skipped)", () => {
    const h = makeGame();
    onArena(h, { ...LATE, freed: ['mario', 'link', 'samus'] }, arenaPadId('airship'));
    h.tap('jump');
    const select = h.top() as CharacterSelectScene;
    expect(select).toBeInstanceOf(CharacterSelectScene);
    expect(draw(select).texts.map((t) => t.str)).toContain('6 HEROES TO FIND');
    h.idle(12);
    expect(new Set(offered(h))).toEqual(new Set(['Mario', 'Link', 'Samus']));
  });

  it('developer "All heroes" offers every hero', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    onArena(h, { ...LATE, freed: ['mario'], devAllHeroes: true }, arenaPadId('airship'));
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    expect(new Set(offered(h)).size).toBe(h.game.deps.characters.length);
  });

  it('Back from the select is the arena again, on the pad, with nothing started or saved', () => {
    const h = makeGame();
    const m = onArena(h, LATE, arenaPadId('airship'));
    const s = h.game.state;
    const before = { ...s, kit: { ...s.kit } };
    const saves = new Map(store);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(select(h).touchLabels().attack).toBe('BACK');
    h.idle(12);
    h.tap('right');
    h.audio.stopMusic.mockClear();
    h.tap('attack');
    expect(h.top()).toBe(m);
    expect([m.page.id, m.node, m.mode]).toEqual(['arena', arenaPadId('airship'), 'idle']);
    expect(h.said.at(-1)).toMatch(/Larry's Airship\. JUMP.* to play, for fun\.$/);
    expect(h.audio.stopMusic).not.toHaveBeenCalled(); // the map's music played on
    expect(h.game.campaign).toEqual({ slot: 1 });
    expect(h.game.airship).toBeNull();
    expect(h.game.inRound).toBe(false);
    expect(h.game.state).toBe(s);
    expect({ ...s, kit: { ...s.kit } }).toEqual(before);
    expect(new Map(store)).toEqual(saves);
    // The map works as before: JUMP again opens the select again.
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('every other game starts at once, with no select (Shadow Duel)', () => {
    expect(ARENA_GAMES.filter((g) => g.round.asHero).map((g) => g.id)).toEqual(['airship']);
    const h = makeGame();
    const m = onArena(h, LATE, arenaPadId('mini-ryu'));
    expect(m.hintLine).toBe('SHADOW DUEL');
    h.tap('jump');
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    expect(h.top()).not.toBe(m);
    expect(h.game.campaign).toBeNull(); // the round is on
    quitRound(h, m);
  });
});

const select = (h: H) => h.top() as CharacterSelectScene;

describe('the pads drawn (a late file, every game found)', () => {
  it('each hero (or Larry, or the bonus icon) stands on its pad: feet on the plate, centred, in front of it', () => {
    const h = makeGame();
    onArena(h, LATE);
    const d = drawBoxes(map(h));
    for (const g of ARENA_GAMES) {
      const n = pad(g.id);
      const i = d.findIndex(
        (s) =>
          s.sheet === 'items' && s.frame.startsWith('map-arena-') && s.x === n.x * 16 && s.y === n.y * 16,
      );
      expect(i, g.id).toBeGreaterThanOrEqual(0);
      const fig = d[i + 1] as Drawn;
      expect(fig.frame.startsWith('map-arena-') || fig.frame === 'map-path-dot', g.id).toBe(false);
      expect(fig.y + fig.h, `${g.id} feet on the plate`).toBe(n.y * 16 + ARENA_FEET);
      expect(fig.x + fig.w / 2, `${g.id} centred`).toBe(n.x * 16 + 8);
    }
  });

  it('no figure is covered, and none covers another pad, another figure or a road', () => {
    const h = makeGame();
    onArena(h, LATE);
    const d = drawBoxes(map(h));
    const plates = d.filter((s) => s.sheet === 'items' && s.frame.startsWith('map-arena-'));
    const dots = d.filter((s) => s.frame === 'map-path-dot');
    for (const g of ARENA_GAMES) {
      const n = pad(g.id);
      const tile: Box = [n.x * 16, n.y * 16, n.x * 16 + 16, n.y * 16 + 16];
      const i = d.findIndex(
        (s) => s.sheet === 'items' && s.frame.startsWith('map-arena-') && s.x === tile[0] && s.y === tile[1],
      );
      const fig = d[i + 1] as Drawn;
      // Fully in view: nothing drawn after it overlaps it (the player's hero is on the Return pad).
      for (const later of d.slice(i + 2))
        expect(meets(fig.box, later.box), `${g.id} under ${later.frame}`).toBe(false);
      for (const p of plates)
        if (p.x !== tile[0] || p.y !== tile[1])
          expect(meets(fig.box, p.box), `${g.id} over the pad at ${p.x},${p.y}`).toBe(false);
      for (const p of plates) {
        const other = d[d.indexOf(p) + 1] as Drawn;
        if (other !== fig) expect(meets(fig.box, other.box), `${g.id} over ${other.frame}`).toBe(false);
      }
      // Roads: every dot but the ones on the pad's own tile edge.
      for (const dot of dots) {
        const cx = dot.x + 4;
        const cy = dot.y + 4;
        if (cx >= tile[0] && cx <= tile[2] && cy >= tile[1] && cy <= tile[3]) continue;
        expect(meets(fig.box, dot.box), `${g.id} over the road dot at ${cx},${cy}`).toBe(false);
      }
    }
  });
});

describe('arena rounds say nothing about the campaign', () => {
  it.each(
    ARENA_GAMES.filter((g) => g.kind === 'mini' || g.kind === 'bonus' || g.kind === 'airship').map(
      (g) => [g.id] as const,
    ),
  )("%s: the menu's Give up just ends the round", (id) => {
    const h = makeGame();
    const m = onArena(h, LATE, arenaPadId(id));
    h.tap('jump');
    if (id === 'airship') confirmHero(h);
    let hint: string | undefined;
    for (let f = 0; f < 3000 && hint === undefined; f++) {
      if (f % 90 !== 89) {
        h.step();
        continue;
      }
      h.tap('start');
      const items = (h.top() as { items?: MenuItem[] }).items ?? [];
      const quit = items.find((i) => i.label === 'Give up');
      if (quit) hint = quit.hint ?? '';
      else if (items.length) h.tap('start');
    }
    expect(hint, id).toBe('Ends the round');
    quitRound(h, m);
  });

  it('a Toad House prize in a round is just for fun: nothing added to the items', () => {
    const h = makeGame();
    onArena(h, LATE);
    const outs: AwardOutcome[] = [];
    playRound(
      h.game,
      {
        title: 'TEST',
        create: (game, done) => {
          outs.push(awardPrize(game, { kind: 'item', item: 'flower' }));
          outs.push(awardPrize(game, { kind: 'lives', amount: 1 }));
          outs.push(awardPrize(game, { kind: 'coins', amount: 10 }));
          return { update: () => done('pass'), render: () => {} };
        },
      },
      () => {},
    );
    expect(outs.map((o) => o.lines)).toEqual([
      ['YOU GOT A FIRE FLOWER!', '(JUST FOR FUN)'],
      ['1 UP!', '(JUST FOR FUN)'],
      ['10 COINS!', '(JUST FOR FUN)'],
    ]);
    expect(outs.map((o) => o.said)).toEqual([
      'You got a Fire Flower, just for fun.',
      'One more life, just for fun.',
      '10 coins, just for fun.',
    ]);
    expect(outs.every((o) => !o.stored)).toBe(true);
  });
});

describe('meeting the heroes (SaveFile.met)', () => {
  it('talking to a captive meets it (saved), and its mini game is found in the arena', () => {
    const h = makeGame();
    file({ freed: ['mario'], pages: ['smb-1', 'hub', 'arena'] });
    const l = intoBonus(h);
    expect(h.game.met).toEqual(['mario']);
    standByLuigi(h, l);
    h.tap('up');
    expect(h.game.met).toEqual(['mario', 'luigi']);
    expect(loadSave(1)?.met).toEqual(['mario', 'luigi']);
    expect(ARENA_GAMES.find((g) => g.id === 'mini-luigi')?.found(h.game)).toBe(true);
    expect(ARENA_GAMES.find((g) => g.id === 'train-luigi')?.found(h.game)).toBe(false);
  });

  it("boarding Larry's airship meets Larry", () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-0', '4-1'], pages: ['smb-1', 'smb-4'] }));
    h.idle(8);
    expect(h.game.met).not.toContain('larry');
    h.game.startLevel(getLevel('4-2-airship'), { mode: 'stand' });
    expect(h.game.met).toContain('larry');
    expect(loadSave(1)?.met).toContain('larry');
  });
});
