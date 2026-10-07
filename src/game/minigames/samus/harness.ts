import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import type { Action } from '@engine/input/actions';
import type { Scene } from '@engine/scene';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import type { MiniGameResult } from '../types';
import { recordingAudio } from '../megaman/harness';
import { SAMUS_MINIGAME } from '.';
import { px, tileToSub } from '@engine/math/units';
import { APPEAR_FRAMES, EscapeScene, type EscapeOptions } from './scene';
import { BrainTank, BRAIN_HITS, Cannon, CannonShot, Rinka, RinkaSpawner } from './tourian';
import { MINI_LIVES } from '../lives';
import { EscapeBot, type CautiousOptions } from './bot';

/*
 * Test support for Zebes Escape (not shipped code paths): a real Game with the round pushed over
 * a stand-in level scene, as the unlock flow does, and the bot runs the tests and the sim share.
 */

export interface HarnessOptions extends EscapeOptions {
  /** Leave the scene on top when it reports (the flow is slow to pop it). */
  keep?: boolean;
  assets?: AssetRegistry;
}

/**
 * A real Game with the escape pushed over a stand-in level scene; `done` records each result and
 * pops the scene (the flow's job) unless `keep` is set.
 */
export function escapeHarness(opts: HarnessOptions = {}) {
  const said: string[] = [];
  const { audio, log } = recordingAudio();
  const tempo: number[] = [];
  audio.setTempoScale = (s: number) => void tempo.push(s);
  const game = new Game({
    ctx: {
      assets: opts.assets ?? new AssetRegistry({ default: {} }),
      audio,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const below: Scene = { update() {}, render() {} };
  game.scenes.push(below);
  const results: MiniGameResult[] = [];
  const done = (r: MiniGameResult) => {
    results.push(r);
    if (!opts.keep) game.scenes.pop();
  };
  const custom: EscapeOptions = {};
  if (opts.seed !== undefined) custom.seed = opts.seed;
  if (opts.countdown !== undefined) custom.countdown = opts.countdown;
  const scene = Object.keys(custom).length
    ? new EscapeScene(game, done, custom)
    : (SAMUS_MINIGAME.create(game, done) as EscapeScene);
  game.scenes.push(scene);
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = [], n = 1) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(held);
      input.next();
      game.scenes.update([input]);
    }
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  /** Plays `bot` until the round reports (or `max` frames); the frames played. */
  const play = (bot: EscapeBot, max = 12000) => {
    let i = 0;
    for (; i < max && results.length === 0; i++) step(bot.next(scene));
    return i;
  };
  return {
    game,
    scene,
    below,
    results,
    said,
    log,
    tempo,
    step,
    tap,
    play,
    /** The life in play's World (a new one after each lost life). */
    get world() {
      return scene.world;
    },
  };
}

export type EscapeHarness = ReturnType<typeof escapeHarness>;

/** Past her materialising: Samus can move (in Tourian, or on the escape once the bomb is set). */
export function ready(h: EscapeHarness): void {
  h.step([], APPEAR_FRAMES);
  if (h.scene.phase !== 'tourian' && h.scene.phase !== 'escape')
    throw new Error(`not in play after materialising: ${h.scene.phase}`);
}

/**
 * Puts Samus standing (or curled, `ball`) with her feet on row `feetRow` at `x` px (her body's
 * left), the room and the camera on her.
 */
export function warp(h: EscapeHarness, x: number, feetRow: number, ball = false): void {
  const p = h.scene.player;
  p.scratch.ball = ball ? 1 : 0;
  p.refitHitbox();
  const b = p.body;
  b.x = px(x);
  b.y = tileToSub(feetRow) - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  h.scene.syncRoom(h.world, true);
  h.world.spawnInView();
}

/**
 * Skips Tourian: Samus in the brain's chamber, the brain destroyed by missiles (as a play would),
 * so the time bomb is set and the escape is on.
 */
export function setBomb(h: EscapeHarness): void {
  warp(h, 68 * 16, 57);
  clearCreatures(h);
  const brain = h.world.entities.find((e): e is BrainTank => e instanceof BrainTank);
  if (!brain) throw new Error('no brain');
  for (let i = 0; i < BRAIN_HITS; i++)
    brain.hit({ kind: 'weapon', amount: 3, owner: null, dirX: 1 }, h.world);
  if (h.scene.phase !== 'escape') throw new Error(`no escape: ${h.scene.phase}`);
}

/** Sheets with no frames (and no zebes sheet): every draw falls back to nothing, text is kept. */
export const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** Clears Tourian's guards out of the way (Rinkas and their spawners, cannons unless kept, shots). */
export function clearCreatures(h: EscapeHarness, keepCannons = false): void {
  for (const e of h.world.entities)
    if (
      e instanceof Rinka ||
      e instanceof RinkaSpawner ||
      e instanceof CannonShot ||
      (e instanceof Cannon && !keepCannons)
    )
      e.destroy();
}

/** One round played by a bot: how it ended, the time left and what it cost. */
export function botRun(opts: Partial<CautiousOptions> = {}, max = 30000) {
  const h = escapeHarness();
  const bot = new EscapeBot(opts);
  let lost = 0;
  let hp = h.scene.player.hp;
  let frames = 0;
  for (; frames < max && h.results.length === 0; frames++) {
    h.step(bot.next(h.scene));
    const now = h.scene.player.hp;
    if (now < hp) lost += hp - now;
    hp = now;
  }
  const p = h.scene.player;
  return {
    result: h.results[0] ?? 'timeout',
    phase: h.scene.phase,
    frames,
    secondsLeft: h.scene.seconds,
    /** Lives lost on the way (3 on a game over). */
    livesLost: MINI_LIVES - h.scene.lives.lives,
    hp,
    lost,
    x: p.body.x >> 12,
    row: (p.body.y + p.body.h) >> 12,
    visited: bot.visited,
  };
}
