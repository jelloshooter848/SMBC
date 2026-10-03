import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';

/** The classic sequence: up up down down left right left right B A. */
export const DEV_CODE: Action[] = [
  'up',
  'up',
  'down',
  'down',
  'left',
  'right',
  'left',
  'right',
  'attack',
  'jump',
];

/**
 * Matches a sequence of button presses. Feed it every frame; it returns true once on the frame
 * the last press lands. A wrong press restarts the match (but may start a new one).
 */
export class CheatCode {
  private pos = 0;
  constructor(readonly sequence: Action[]) {}

  feed(input: InputFrame): boolean {
    const pressed = (
      ['up', 'down', 'left', 'right', 'jump', 'attack', 'special', 'start', 'select'] as Action[]
    ).filter((a) => input.pressed(a));
    if (pressed.length === 0) return false;
    for (const a of pressed) {
      if (a === this.sequence[this.pos]) this.pos++;
      else this.pos = a === this.sequence[0] ? 1 : 0;
      if (this.pos >= this.sequence.length) {
        this.pos = 0;
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.pos = 0;
  }
}
