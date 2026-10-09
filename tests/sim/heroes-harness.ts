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
import { CardScene, CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { Captive } from '@game/entities/objects/captive';
import { newSave, writeSave, type SaveFile } from '@game/save/save-files';
import type { Action } from '@engine/input/actions';
import type { Settings } from '@engine/save/settings';
import type { Announcer } from '@engine/a11y/announcer';
import { airshipBot } from './airship-bot';

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

/**
 * `dev`: dev mode on (a file's "Chapter 2 gate: open" flag then lets the campaign into the Lost Kingdom).
 * `freshSeeds`: a fresh world seed every visit, as in play (main.ts); left off, every level keeps its
 * fixed seed, so a sim through Game repeats exactly.
 */
export function makeGame(opts: { dev?: boolean; freshSeeds?: boolean } = {}) {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = {
    ...NULL_AUDIO,
    stopMusic: vi.fn(),
    playMusic: vi.fn(),
    setTempoScale: vi.fn(),
    sfx: vi.fn(),
  };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    ...(opts.dev ? { settings: { dev: true } as Settings } : {}),
    ...(opts.freshSeeds ? { freshSeeds: true } : {}),
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

/**
 * Pages through the story cards on top (story/cards.ts: Larry, a restyled level's remark) with
 * OK until none is left; returns each card's lines.
 */
export function closeCards(h: H, max = 10): string[][] {
  const seen: string[][] = [];
  for (let i = 0; i < max && h.top() instanceof CardScene; i++) {
    seen.push([...(h.top() as CardScene).lines]);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
  }
  return seen;
}

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

/**
 * A round just passed: the freed hero's talk shows (0.4.23, docs/STORY.md 2.13); BACK skips the
 * rest of it, and the freed card follows. Returns the talk's first page.
 */
export function skipFreedTalk(h: H): readonly string[] {
  const talk = h.top();
  expect(talk).toBeInstanceOf(CardScene);
  const lines = (talk as CardScene).lines;
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap('attack');
  expect(h.top()).not.toBe(talk);
  return lines;
}

/**
 * Larry's airship deck (any `camera: auto` level with a down pipe): play it like a player (the
 * airship bot, tests/sim/airship-bot.ts: on with the scrolling screen, jumping walls and pits,
 * dodging shots, onto the stern pipe and DOWN), unhurtable. Returns once the deck is left (or
 * after `max` frames).
 */
export function rideToStern(h: H, deck: LevelScene, max = 6000): void {
  const bot = airshipBot();
  // A flow helper: the ride is made with the hero unhurtable, so every test reaches the room
  // the same way (pits and squashes still count). airship-deck.test.ts plays it with damage on.
  const assist = deck.world.assist;
  const was = assist.invulnerable;
  assist.invulnerable = true;
  try {
    for (let f = 0; f < max && h.top() === deck; f++) h.step(bot(deck.world));
  } finally {
    assist.invulnerable = was;
  }
}

/** 4-2's hidden right zone: the dead pipe's (and the anchor chain's) column, and the ceiling gap. */
export const ANCHOR_COL = 214;
export const ROOM_GAP = 220;

/**
 * Campaign 4-2 (already the top LevelScene): put the hero on the ceiling beside its gap, walk into
 * the gap and drop into the hidden right zone, wait for the anchor to crash down, then walk to
 * its chain and climb it off the top of the screen. Returns once the level has changed. The
 * anchor scene (once per file, tests/sim/anchor-scene.test.ts) is skipped with BACK: it goes up
 * the chain itself.
 */
export function dropInAndClimb(h: H, level: LevelScene, max = 1500): void {
  const w = level.world;
  const p = w.player;
  p.body.x = px(ROOM_GAP * 16 - 14);
  p.body.y = px(2 * 16) - p.body.h;
  p.body.vy = 0;
  const chainX = px(ANCHOR_COL * 16 + 8);
  for (let f = 0; f < max; f++) {
    if (h.top() instanceof CardScene || (h.top() === level && w.anchorScene)) {
      h.step(f % 2 ? ['attack'] : []);
      continue;
    }
    if (h.top() !== level) break;
    const chain = w.entities.some((e) => e.kind === 'vine' && e.alive);
    if (!chain) h.step(f < 20 ? ['right'] : []);
    else if (p.vine) h.step(['up']);
    else if (p.centerX > chainX + px(4)) h.step(['left', 'up']);
    else if (p.centerX < chainX - px(4)) h.step(['right', 'up']);
    else h.step(['up']);
  }
}
