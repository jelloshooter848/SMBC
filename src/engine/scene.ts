import type { InputFrame } from './input/input-manager';
import type { Renderer } from './gfx/renderer';

export interface Scene {
  enter?(): void;
  exit?(): void;
  /** `input` is player 1; `inputs` carries every player's frame for scenes that need them. */
  update(input: InputFrame, inputs: InputFrame[]): void;
  render(r: Renderer): void;
  /** When true the scene below keeps rendering (pause menu over the level). */
  readonly translucent?: boolean;
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

  render(r: Renderer): void {
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start]?.translucent) start--;
    for (let i = start; i < this.stack.length; i++) this.stack[i]?.render(r);
  }
}
