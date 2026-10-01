import { Actions, type Action } from './actions';
import type { Code, PlayerBindings } from './bindings';
import { defaultBindings } from './bindings';

export interface InputSource {
  /** Set of raw codes currently held. Called once per fixed step. */
  poll(): ReadonlySet<Code>;
}

/** Per-player, per-frame view of input. The headless sim provides its own implementation. */
export interface InputFrame {
  held(a: Action): boolean;
  pressed(a: Action): boolean;
  released(a: Action): boolean;
  /** Was jump pressed within the last `windowFrames` frames (and not yet consumed)? */
  bufferedJump(windowFrames: number): boolean;
  consumeJumpBuffer(): void;
  /** Signed horizontal direction: -1, 0, 1 (right wins ties, like holding both on a d-pad is impossible). */
  readonly dirX: -1 | 0 | 1;
}

export class ActionState implements InputFrame {
  private cur = new Set<Action>();
  private prev = new Set<Action>();
  private jumpPressedFrame = -1000;
  private frame = 0;

  beginFrame(next: Set<Action>): void {
    this.prev = this.cur;
    this.cur = next;
    this.frame++;
    if (this.pressed('jump')) this.jumpPressedFrame = this.frame;
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
  bufferedJump(windowFrames: number): boolean {
    return this.frame - this.jumpPressedFrame < windowFrames;
  }
  consumeJumpBuffer(): void {
    this.jumpPressedFrame = -1000;
  }
  get dirX(): -1 | 0 | 1 {
    const l = this.cur.has('left');
    const r = this.cur.has('right');
    return l && !r ? -1 : r && !l ? 1 : 0;
  }
  /** Any action held at all (used by the title screen gate). */
  get any(): boolean {
    return this.cur.size > 0;
  }
  /** Any action pressed this frame. */
  get anyPressed(): boolean {
    for (const a of this.cur) if (!this.prev.has(a)) return true;
    return false;
  }
}

/** Empty frame for scenes that ignore input. */
export const NO_INPUT: InputFrame = {
  held: () => false,
  pressed: () => false,
  released: () => false,
  bufferedJump: () => false,
  consumeJumpBuffer: () => undefined,
  dirX: 0,
};

export class InputManager {
  readonly players: ActionState[] = [];
  bindings: PlayerBindings[];
  private readonly sources: { keyboard: InputSource[]; gamepad: InputSource[]; touch: InputSource[] } = {
    keyboard: [],
    gamepad: [],
    touch: [],
  };

  constructor(playerCount = 2, bindings?: PlayerBindings[]) {
    this.bindings = bindings ?? Array.from({ length: playerCount }, (_, i) => defaultBindings(i));
    for (let i = 0; i < playerCount; i++) this.players.push(new ActionState());
  }

  addSource(kind: 'keyboard' | 'gamepad' | 'touch', src: InputSource): void {
    this.sources[kind].push(src);
  }

  /** Sample all sources once and compute every player's action set. Call at the start of each fixed step. */
  beginFrame(): void {
    const kb = union(this.sources.keyboard.map((s) => s.poll()));
    const touch = union(this.sources.touch.map((s) => s.poll()));
    const padsByIndex = this.sources.gamepad.map((s) => s.poll());
    for (let p = 0; p < this.players.length; p++) {
      const b = this.bindings[p] ?? defaultBindings(p);
      const pad = padsByIndex[b.gamepadIndex ?? p] ?? padsByIndex[0] ?? EMPTY;
      const next = new Set<Action>();
      for (const a of Actions) {
        if (b.keyboard[a].some((c) => kb.has(c))) next.add(a);
        else if (b.gamepad[a].some((c) => pad.has(c))) next.add(a);
        else if (p === 0 && touch.has(`touch:${a}`)) next.add(a);
      }
      this.players[p]?.beginFrame(next);
    }
  }

  player(i: number): ActionState {
    const p = this.players[i];
    if (!p) throw new Error(`no player ${i}`);
    return p;
  }

  rebind(player: number, kind: 'keyboard' | 'gamepad', action: Action, codes: Code[]): void {
    const b = this.bindings[player];
    if (!b) return;
    b[kind][action] = codes;
  }
}

const EMPTY: ReadonlySet<Code> = new Set();
function union(sets: ReadonlySet<Code>[]): ReadonlySet<Code> {
  if (sets.length === 1) return sets[0] as ReadonlySet<Code>;
  const out = new Set<Code>();
  for (const s of sets) for (const c of s) out.add(c);
  return out;
}
