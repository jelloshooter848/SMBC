import { beforeEach, expect, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { px } from '@engine/math/units';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene } from '@game/scenes/world-map';
import { LevelScene } from '@game/scenes/level';
import { CardScene, MessageScene } from '@game/scenes/message';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { Captive } from '@game/entities/objects/captive';
import { newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';

/** Shared setup for the freeing-the-heroes sims (heroes.test.ts, heroes-race.test.ts). */

export const store = new Map<string, string>();
/** Fresh stubbed localStorage before each test. */
export function useStorage(): void {
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
}

export function makeGame() {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn(), setTempoScale: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = [], a2: Action[] = []) => {
    p1.setHeld(a);
    p2.setHeld(a2);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
    game.scenes.render(r);
  };
  const tap = (a: Action, player = 0) => {
    step(player === 0 ? [a] : [], player === 1 ? [a] : []);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  return { game, said, step, tap, idle, until, top, audio };
}
export type H = ReturnType<typeof makeGame>;

/** A campaign file in slot 1, written to storage. */
export function file(over: Partial<SaveFile> = {}, c1 = MARIO.id): SaveFile {
  const s = { ...newSave(1, c1), ...over };
  writeSave(s);
  return s;
}

/** Draw a scene, recording text and the sheet/palette of each sprite. */
export function draw(scene: { render(r: Renderer): void }) {
  const texts: { str: string; x: number; y: number }[] = [];
  const sprites: { key: string; frame: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      texts.push({ str, x, y });
    },
    sprite(s: SpriteSheet, frame: string, x: number, y: number): void {
      sprites.push({ key: s.id, frame, x, y });
    },
  });
  scene.render(r);
  return { texts, sprites };
}

/** The picks a character select offers: step right through the roster, collecting each name said. */
export function offered(h: H): string[] {
  const names: string[] = [];
  for (let i = 0; i < CHARACTERS.length; i++) {
    h.tap('right');
    names.push(h.said.at(-1) ?? '');
  }
  return names;
}

/** File 1 open on the map, then into the 1-1 bonus room (falling in at column 1, as from the pipe). */
export function intoBonus(h: H, time = 300) {
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(getLevel('1-1-bonus'), { mode: 'fall', x: 1, y: 1, time });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h.top() as LevelScene;
}

export const captives = (l: LevelScene) =>
  l.world.entities.filter((e): e is Captive => e instanceof Captive && e.alive);

/** Put player 1 next to Luigi on his ledge and let him land. */
export function standByLuigi(h: H, l: LevelScene) {
  const c = captives(l)[0] as Captive;
  const p = l.world.player;
  p.body.x = c.body.x - px(18);
  p.body.y = c.body.y + c.body.h - p.body.h - px(2);
  p.body.vx = 0;
  p.body.vy = 0;
  p.body.onGround = false;
  h.until(() => p.body.onGround, 60);
  h.idle(10);
}

/** Talk to Luigi and go through the dialogue and rules cards into his mini game. */
export function talkIntoMiniGame(h: H, l: LevelScene) {
  h.tap('up');
  expect(h.top()).not.toBe(l);
  // Dialogue cards (OK goes on), then the rules card, then the round.
  for (let i = 0; i < 6 && (h.top() instanceof CardScene || h.top() instanceof MessageScene); i++) {
    h.idle(32);
    h.tap('jump');
  }
  const round = h.top();
  expect(round).not.toBeInstanceOf(CardScene);
  expect(round).not.toBeInstanceOf(MessageScene);
  expect(round).not.toBe(l);
  return round;
}
