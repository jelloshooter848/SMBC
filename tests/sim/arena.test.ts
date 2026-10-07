import { describe, expect, it } from 'vitest';
import type { Scene } from '@engine/scene';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { arenaPadId } from '@content/worldmap/arena';
import { ARENA_GAMES, ARENA_LOCKED, arenaGameAt } from '@game/arena';
import { WorldMapScene, MAP_FADE_FRAMES } from '@game/scenes/world-map';
import { DevMiniGameResultScene } from '@game/scenes/dev-minigames';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { isOpen, openPaths } from '@game/map/rules';
import { loadSave, type SaveFile } from '@game/save/save-files';
import { draw, file, intoBonus, makeGame, standByLuigi, store, useStorage, type H } from './heroes-harness';

// The MINI GAME ARENA (0.5.0): the hub's first pad leads to it; one pad per game the registries
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
  freed: ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill'],
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
    // Down to the first pad of the track, then along it with the d-pad.
    const first = ARENA_GAMES[0]!.id;
    const second = ARENA_GAMES[1]!.id;
    h.tap('down');
    h.until(() => m.mode === 'idle', 120);
    expect(m.node).toBe(arenaPadId(first));
    expect(h.said.at(-1)).toBe('Locked. Find This Hero First.');
    h.tap('right');
    h.until(() => m.mode === 'idle', 120);
    expect(m.node).toBe(arenaPadId(second));
    h.tap('left');
    h.until(() => m.mode === 'idle', 120);
    h.tap('up');
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
    // Drawn dark: Luigi's black silhouette and a '?'.
    const d = draw(map(h));
    const p = pad('mini-luigi');
    expect(d.sprites.some((s) => s.key.includes('luigi~silhouette'))).toBe(true);
    expect(d.texts.some((t) => t.str === '?' && t.x === p.x * 16 + 4 && t.y === p.y * 16 + 4)).toBe(true);
  });

  it('a late file: every game is found and shows in colour', () => {
    const h = makeGame();
    onArena(h, LATE);
    expect(found(h)).toEqual(ARENA_GAMES.map((g) => g.id).sort());
    const d = draw(map(h));
    expect(d.sprites.some((s) => s.key.includes('~silhouette'))).toBe(false);
    expect(d.texts.some((t) => t.str === '?')).toBe(false);
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
