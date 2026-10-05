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
import { CharacterSelectScene } from '@game/scenes/character-select';
import { FileSelectScene } from '@game/scenes/file-select';
import { TitleScene } from '@game/scenes/title';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { listSaves, loadSave, newSave, writeSave } from '@engine/save/save-files';
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

  it('a new file goes through character select (P2 may join), then is written and opened', () => {
    const h = makeGame();
    toFileSelect(h);
    h.tap('down'); // file 2
    h.tap('jump');
    expect(top(h.game)).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('right'); // Luigi
    h.tap('start', 1); // player 2 joins (Luigi preselected for P2); one right → Link
    h.tap('right', 1);
    h.tap('start');
    const save = loadSave(2)!;
    expect(save).not.toBeNull();
    expect(save.character).toBe('luigi');
    expect(save.character2).toBe('link');
    expect(save.lives).toBe(5);
    expect(save.worlds).toEqual([1]);
    expect(listSaves()[0]).toBeNull();
    expect(listSaves()[2]).toBeNull();
    expect(h.game.campaign).toEqual({ slot: 2 });
    expect(h.game.state.character).toBe(LUIGI);
    expect(h.game.state.character2).toBe(LINK);
    expect(h.game.state.lives).toBe(5);
    // Map stub: World 1's first open level.
    expect(top(h.game)).toBeInstanceOf(IntroScene);
    expect(h.game.state.world).toBe(1);
    expect(h.game.state.stage).toBe(1);
  });

  it('back from that character select returns to file select on the same file', () => {
    const h = makeGame();
    toFileSelect(h);
    h.tap('down');
    h.tap('down');
    h.tap('jump');
    h.idle(12);
    h.tap('attack');
    const fs = top(h.game) as FileSelectScene;
    expect(fs).toBeInstanceOf(FileSelectScene);
    expect(fs.index).toBe(2);
    expect(listSaves()).toEqual([null, null, null]);
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
    expect(top(h.game)).toBeInstanceOf(IntroScene);
    expect(s.world).toBe(2); // map stub: the first uncleared level of the highest world
    expect(s.stage).toBe(2);
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
