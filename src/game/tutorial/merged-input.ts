import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';

/**
 * Several players' controls as one (training: player two's stage and question take their own
 * controls and player one's): a button counts when it does on any of them.
 */
export class MergedInput implements InputFrame {
  constructor(private readonly frames: InputFrame[]) {}
  held(a: Action): boolean {
    return this.frames.some((f) => f.held(a));
  }
  pressed(a: Action): boolean {
    return this.frames.some((f) => f.pressed(a));
  }
  released(a: Action): boolean {
    return this.frames.some((f) => f.released(a));
  }
  bufferedJump(w: number): boolean {
    return this.frames.some((f) => f.bufferedJump(w));
  }
  consumeJumpBuffer(): void {
    for (const f of this.frames) f.consumeJumpBuffer();
  }
  get dirX(): -1 | 0 | 1 {
    for (const f of this.frames) if (f.dirX !== 0) return f.dirX;
    return 0;
  }
}
