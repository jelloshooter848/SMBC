import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { toPx } from '@engine/math/units';
import type { LevelData } from '../level/schema';
import { World, type WorldEvent, type WorldStart } from '../world/world';
import { DEFAULT_ASSIST, newGameState, type AssistOptions, type GameState } from '../context';
import type { CharacterDef } from '../characters/character';

/** Scripted input: each step sets the held actions from `frame` onward (presses are edges of holds). */
export interface InputScript {
  steps: { frame: number; hold: Action[] }[];
}

export class ScriptedInput implements InputFrame {
  private cur = new Set<Action>();
  private prev = new Set<Action>();
  private frame = -1;
  private jumpAt = -1000;
  private override: Action[] | null = null;
  constructor(private readonly script: InputScript) {}

  /** Replace the script for the next frame (used by controllers). */
  setHeld(actions: Action[]): void {
    this.override = actions;
  }

  next(): void {
    this.frame++;
    this.prev = this.cur;
    let held: Action[] = [];
    if (this.override) held = this.override;
    else for (const s of this.script.steps) if (s.frame <= this.frame) held = s.hold;
    this.cur = new Set(held);
    if (this.pressed('jump')) this.jumpAt = this.frame;
  }
  held(a: Action): boolean {
    return this.cur.has(a);
  }
  pressed(a: Action): boolean {
    return this.cur.has(a) && !this.prev.has(a);
  }
  released(a: Action): boolean {
    return !this.cur.has(a) && this.prev.has(a);
  }
  bufferedJump(window: number): boolean {
    return this.frame - this.jumpAt < window;
  }
  consumeJumpBuffer(): void {
    this.jumpAt = -1000;
  }
  get dirX(): -1 | 0 | 1 {
    const l = this.cur.has('left');
    const r = this.cur.has('right');
    return l && !r ? -1 : r && !l ? 1 : 0;
  }
}

export interface SimOptions {
  level: LevelData;
  character: CharacterDef;
  script: InputScript;
  maxFrames: number;
  assist?: Partial<AssistOptions>;
  state?: Partial<GameState>;
  /** Called every frame; return true to stop early. */
  until?: (world: World, frame: number) => boolean;
  /** Reactive input: when given, replaces the script each frame. */
  controller?: (world: World, frame: number) => Action[];
  /** Start overrides (position, mode, carried timer), as a pipe transfer would pass them. */
  start?: WorldStart;
}

export interface SimResult {
  frames: number;
  outcome: 'cleared' | 'died' | 'timeout' | 'stopped' | 'pipe';
  playerX: number; // px
  playerY: number;
  score: number;
  coins: number;
  lives: number;
  events: WorldEvent[];
  world: World;
}

/** Run a level with scripted input and no rendering or audio. Deterministic. */
export function runSim(opts: SimOptions): SimResult {
  const assets = new AssetRegistry({ default: {} });
  const state = { ...newGameState(opts.character), ...opts.state };
  const world = new World(
    opts.level,
    { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST, ...opts.assist }, reduceFlashing: true },
    state,
    opts.start,
  );
  const input = new ScriptedInput(opts.script);
  const events: WorldEvent[] = [];
  let outcome: SimResult['outcome'] = 'timeout';
  let frames = 0;
  for (; frames < opts.maxFrames; frames++) {
    if (opts.controller) input.setHeld(opts.controller(world, frames));
    input.next();
    world.update([input]);
    events.push(...world.events.splice(0));
    const last = events[events.length - 1];
    if (last?.type === 'exit') {
      outcome = 'cleared';
      break;
    }
    if (last?.type === 'died') {
      outcome = 'died';
      break;
    }
    if (last?.type === 'pipe') {
      outcome = 'pipe';
      break;
    }
    if (opts.until?.(world, frames)) {
      outcome = 'stopped';
      break;
    }
  }
  return {
    frames,
    outcome,
    playerX: toPx(world.player.body.x),
    playerY: toPx(world.player.body.y),
    score: state.score,
    coins: state.coins,
    lives: state.lives,
    events,
    world,
  };
}
