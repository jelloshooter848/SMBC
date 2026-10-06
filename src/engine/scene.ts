import type { InputFrame } from './input/input-manager';
import type { Renderer } from './gfx/renderer';
import type { TouchLabels } from './input/touch';

export interface Scene {
  enter?(): void;
  exit?(): void;
  /** `input` is player 1; `inputs` carries every player's frame for scenes that need them. */
  update(input: InputFrame, inputs: InputFrame[]): void;
  render(r: Renderer): void;
  /** When true the scene below keeps rendering (pause menu over the level). */
  readonly translucent?: boolean;
  /** What the on-screen touch buttons say while this scene is on top (absent = A, B, C...). */
  touchLabels?(): TouchLabels;
}

export class SceneStack {
  private readonly stack: Scene[] = [];

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }
  get depth(): number {
    return this.stack.length;
  }

  push(s: Scene): void {
    this.stack.push(s);
    s.enter?.();
  }
  pop(): Scene | undefined {
    const s = this.stack.pop();
    s?.exit?.();
    return s;
  }
  replace(s: Scene): void {
    this.pop();
    this.push(s);
  }
  clear(): void {
    while (this.stack.length) this.pop();
  }

  update(inputs: InputFrame[]): void {
    const first = inputs[0];
    if (first) this.top?.update(first, inputs);
  }

  /** Draws the nearest opaque scene, then only the topmost overlay (stacked menus don't bleed through). */
  render(r: Renderer): void {
    const top = this.stack.length - 1;
    let base = top;
    while (base > 0 && this.stack[base]?.translucent) base--;
    this.stack[base]?.render(r);
    if (top !== base) this.stack[top]?.render(r);
  }
}
