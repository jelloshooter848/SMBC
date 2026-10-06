import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { IntroScene } from '@game/scenes/intro';
import { FileSelectScene } from '@game/scenes/file-select';
import { WorldMapScene } from '@game/scenes/world-map';
import { TitleScene } from '@game/scenes/title';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { listSaves, loadSave, newSave, writeSave } from '@game/save/save-files';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Sheets record their name and palette so the portraits can be checked. */
const assets = {
  sheet: (name: string, palette?: string) => ({ name, palette, frames: new Map() }),
} as unknown as AssetRegistry;

function makeGame() {
  const said: string[] = [];
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const step = (a1: Action[] = [], a2: Action[] = []) => {
    p1.setHeld(a1);
    p2.setHeld(a2);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
  };
  const tap = (a: Action, player = 0) => {
    step(player === 0 ? [a] : [], player === 1 ? [a] : []);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  return { game, said, step, tap, idle };
}

const top = (g: Game) => g.scenes.top;

/** Title → Start game → file select. */
function toFileSelect(h: ReturnType<typeof makeGame>): FileSelectScene {
  h.game.showTitle();
  h.idle(8);
  h.tap('start');
  const fs = top(h.game) as FileSelectScene;
  expect(fs).toBeInstanceOf(FileSelectScene);
  h.idle(8);
  return fs;
}

function draw(scene: FileSelectScene) {
  const texts: string[] = [];
  const sprites: { sheet: string; palette: string | undefined; frame: string }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      texts.push(str);
    },
    sprite(s: SpriteSheet, frame: string): void {
      const sh = s as unknown as { name: string; palette?: string };
      sprites.push({ sheet: sh.name, palette: sh.palette, frame });
    },
  });
  scene.render(r);
  return { texts, sprites };
}

function usedFile(slot: 1 | 2 | 3, c1: string, c2: string | null = null) {
  const s = newSave(slot, c1, c2);
  s.cleared = ['1-1', '1-2', '1-3', '1-4', '2-1'];
  s.worlds = [1, 2];
  s.position = { world: 2, node: '2-1' };
  s.lives = 4;
  s.score = 31337;
  s.coins = 12;
  s.powerState = 'big';
  writeSave(s);
  return s;
}

describe('file select', () => {
  it('Start game opens it; three empty files say NEW GAME and are announced', () => {
    const h = makeGame();
    const fs = toFileSelect(h);
    expect(h.said.some((t) => /select a file.*file 1\. new game/i.test(t))).toBe(true);
    const { texts } = draw(fs);
    expect(texts.filter((t) => t === 'NEW GAME')).toHaveLength(3);
    expect(texts).toContain('ERASE FILE');
    h.tap('down');
    expect(h.said.at(-1)).toBe('File 2. New game.');
  });

  it('NEW → 1 PLAYER opens straight on the World 1 map with Mario (no character select)', () => {
    const h = makeGame();
    const fs = toFileSelect(h);
    h.tap('down'); // file 2
    h.tap('jump');
    // A small 1 PLAYER / 2 PLAYERS choice, 1 PLAYER first.
    expect(top(h.game)).toBe(fs);
    expect(fs.mode).toBe('players');
    expect(fs.two).toBe(false);
    expect(draw(fs).texts).toEqual(expect.arrayContaining(['1 PLAYER', '2 PLAYERS']));
    expect(listSaves()).toEqual([null, null, null]);
    h.tap('jump');
    // The file opens on World 1's map, at the start, without a character select.
    const map = top(h.game) as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(map.page.world).toBe(1);
    expect(map.node).toBe('start');
    expect(h.game.scenes.depth).toBe(1); // nothing (no character select) under or over the map
    const save = loadSave(2)!;
    expect(save).not.toBeNull();
    expect(save.character).toBe('mario');
    expect(save.character2).toBeNull();
    expect(save.lives).toBe(3);
    expect(save.powerState).toBe('small');
    expect(save.worlds).toEqual([1]);
    expect(listSaves()[0]).toBeNull();
    expect(listSaves()[2]).toBeNull();
    expect(h.game.campaign).toEqual({ slot: 2 });
    // The map walker is Mario.
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.character2).toBeNull();
    expect(h.game.state.lives).toBe(3);
  });

  it('NEW → 2 PLAYERS opens the map with Mario and Luigi and 5 lives; the card shows both', () => {
    const h = makeGame();
    const fs = toFileSelect(h);
    h.tap('jump');
    h.tap('right');
    expect(fs.two).toBe(true);
    expect(h.said.at(-1)).toBe('Two players');
    h.tap('jump');
    expect(top(h.game)).toBeInstanceOf(WorldMapScene);
    expect(h.game.scenes.depth).toBe(1);
    const save = loadSave(1)!;
    expect([save.character, save.character2, save.lives]).toEqual(['mario', 'luigi', 5]);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.character2).toBe(LUIGI);
    expect(h.game.state.lives).toBe(5);
    // Back on the file select, the card shows both heroes.
    const again = makeGame();
    const fs2 = toFileSelect(again);
    const { sprites } = draw(fs2);
    expect(sprites).toContainEqual({ sheet: 'mario', palette: 'mario', frame: 'small-idle' });
    expect(sprites).toContainEqual({ sheet: 'mario', palette: 'luigi', frame: 'small-idle' });
    expect(again.said.at(-1)).toMatch(/File 1\. Mario and Luigi\./);
  });

  it('back from the 1 PLAYER / 2 PLAYERS choice returns to the file list on the same file', () => {
    const h = makeGame();
    const fs = toFileSelect(h);
    h.tap('down');
    h.tap('down');
    h.tap('jump');
    expect(fs.mode).toBe('players');
    h.tap('right');
    h.tap('attack');
    expect(top(h.game)).toBe(fs);
    expect(fs.mode).toBe('choose');
    expect(fs.index).toBe(2);
    expect(listSaves()).toEqual([null, null, null]);
    // A second back leaves for the title, as usual.
    h.tap('select');
    expect(top(h.game)).toBeInstanceOf(TitleScene);
  });

  it('a file saved before heroes were picked on the map still loads, straight onto its map', () => {
    // A version-1 file from an older build: no lastNode, pendingReveal or devUnlockAll yet.
    store.set(
      'smbc.save.1',
      JSON.stringify({
        v: 1,
        slot: 1,
        character: 'luigi',
        character2: 'link',
        lives: 6,
        score: 900,
        coins: 3,
        powerState: 'big',
        cleared: ['1-1'],
        worlds: [1],
        secrets: [],
        position: { world: 1, node: '1-1' },
      }),
    );
    const h = makeGame();
    toFileSelect(h);
    h.tap('jump');
    const map = top(h.game) as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(map.node).toBe('1-1');
    expect(h.game.state.character).toBe(LUIGI);
    expect(h.game.state.character2).toBe(LINK);
    expect([h.game.state.lives, h.game.state.score, h.game.state.powerState]).toEqual([6, 900, 'big']);
    expect(loadSave(1)!.cleared).toEqual(['1-1']);
  });

  it('a used file shows its stats and loads into the game', () => {
    usedFile(1, 'luigi');
    const done = usedFile(3, 'mario', 'link');
    done.gameCleared = true;
    writeSave(done);
    const h = makeGame();
    const fs = toFileSelect(h);
    expect(h.said.at(-1)).toMatch(
      /File 1\. Luigi\. World 2\. 5 of 32 levels cleared\. 4 lives\. Score 31337\./,
    );
    const { texts, sprites } = draw(fs);
    expect(texts).toEqual(expect.arrayContaining(['FILE 1', 'WORLD 2', '5/32', '×4', '0031337', 'NEW GAME']));
    // Luigi uses the mario sheet with the luigi palette; file 3 shows both heroes and a star.
    expect(sprites).toContainEqual({ sheet: 'mario', palette: 'luigi', frame: 'small-idle' });
    expect(sprites).toContainEqual({ sheet: 'link', palette: 'link', frame: 'idle' });
    expect(sprites.filter((s) => s.frame === 'star-0')).toHaveLength(1);
    h.tap('up');
    h.tap('up');
    expect(h.said.at(-1)).toMatch(/File 3\. Mario and Link\..*Game cleared\./);
    h.tap('down');
    h.tap('down'); // file 1
    h.tap('jump');
    expect(h.game.campaign).toEqual({ slot: 1 });
    const s = h.game.state;
    expect(s.character).toBe(LUIGI);
    expect(s.character2).toBeNull();
    expect(s.lives).toBe(4);
    expect(s.score).toBe(31337);
    expect(s.coins).toBe(12);
    expect(s.powerState).toBe('big');
    // The map opens where the file left the hero, with the file's progress.
    const map = top(h.game) as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(map.page.world).toBe(2);
    expect(map.node).toBe('2-1');
    expect(h.game.mapProgress.cleared).toEqual(['1-1', '1-2', '1-3', '1-4', '2-1']);
    expect(h.game.mapProgress.worlds).toEqual([1, 2]);
    expect(loadSave(1)!.cleared).toHaveLength(5); // progress untouched
  });

  it('erase: bottom row, pick a file, NO keeps it, YES erases it', () => {
    usedFile(2, 'mario');
    const h = makeGame();
    const fs = toFileSelect(h);
    h.tap('up'); // wraps to ERASE FILE
    expect(h.said.at(-1)).toBe('Erase file.');
    h.tap('jump');
    expect(fs.mode).toBe('erase');
    expect(fs.index).toBe(1); // lands on the first used file
    expect(draw(fs).texts).toContain('ERASE WHICH FILE?');
    h.tap('up'); // file 1 is empty: nothing to erase
    h.tap('jump');
    expect(fs.mode).toBe('erase');
    expect(h.said.at(-1)).toBe('File 1 is empty.');
    h.tap('down');
    h.tap('jump');
    expect(fs.mode).toBe('confirm');
    expect(fs.yes).toBe(false);
    expect(h.said.at(-1)).toMatch(/^Erase file 2\? No/);
    h.tap('jump'); // NO
    expect(fs.mode).toBe('erase');
    expect(loadSave(2)).not.toBeNull();
    h.tap('jump');
    h.tap('left');
    expect(fs.yes).toBe(true);
    expect(draw(fs).texts).toContain('ERASE FILE 2?');
    h.tap('jump'); // YES
    expect(loadSave(2)).toBeNull();
    expect(fs.mode).toBe('choose');
    expect(h.said.at(-1)).toMatch(/^File 2 erased\. File 2\. New game\./);
    expect(top(h.game)).toBe(fs);
  });

  it('ERASE FILE with no files bumps, says so and stays in choose mode', () => {
    const h = makeGame();
    const fs = toFileSelect(h);
    h.tap('up');
    h.tap('jump');
    expect(fs.mode).toBe('choose');
    expect(fs.index).toBe(3);
    expect(h.said.at(-1)).toBe('No files to erase.');
    expect(top(h.game)).toBe(fs);
  });

  it('an unreadable file shows UNREADABLE, cannot be played and must be erased first', () => {
    store.set('smbc.save.1', '{broken');
    const h = makeGame();
    const fs = toFileSelect(h);
    expect(h.said.at(-1)).toMatch(/File 1: unreadable\. Erase it/);
    expect(draw(fs).texts).toContain('UNREADABLE');
    h.tap('jump');
    expect(top(h.game)).toBe(fs);
    expect(h.said.at(-1)).toBe('File 1 is unreadable. Erase it first.');
    expect(store.get('smbc.save.1')).toBe('{broken');
    // It counts as a file to erase.
    h.tap('up');
    h.tap('jump');
    expect(fs.mode).toBe('erase');
    expect(fs.index).toBe(0);
    h.tap('jump');
    h.tap('right');
    h.tap('jump');
    expect(store.has('smbc.save.1')).toBe(false);
    expect(h.said.at(-1)).toMatch(/File 1 erased\. File 1\. New game\./);
    h.tap('jump');
    expect(fs.mode).toBe('players');
  });

  it('back leaves erase mode, then goes to the title', () => {
    usedFile(1, 'mario');
    const h = makeGame();
    const fs = toFileSelect(h);
    h.tap('up');
    h.tap('jump');
    expect(fs.mode).toBe('erase');
    h.tap('attack');
    expect(fs.mode).toBe('choose');
    expect(top(h.game)).toBe(fs);
    h.tap('select');
    expect(top(h.game)).toBeInstanceOf(TitleScene);
    expect(loadSave(1)).not.toBeNull();
  });

  it('character select keeps starting a plain game for other callers; non-campaign starts clear the slot', () => {
    const h = makeGame();
    h.game.campaign = { slot: 1 };
    h.game.newGame(MARIO, '1-1');
    expect(h.game.campaign).toBeNull();
    h.game.campaign = { slot: 1 };
    h.game.devStart('1-1', MARIO, 'big');
    expect(h.game.campaign).toBeNull();
    h.game.campaign = { slot: 1 };
    h.game.showTitle();
    expect(h.game.campaign).toBeNull();
    h.game.showCustomLevels();
    h.game.pendingLevel = '1-2';
    h.game.showCharacterSelect();
    h.idle(12);
    h.tap('start');
    expect(top(h.game)).toBeInstanceOf(IntroScene);
    expect(h.game.state.stage).toBe(2);
    expect(h.game.campaign).toBeNull();
    expect(listSaves()).toEqual([null, null, null]);
  });
});
