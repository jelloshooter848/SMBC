import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';
import { CheatCode, DEV_CODE } from './cheat';

const press = (a: Action | null): InputFrame => ({
  held: () => false,
  pressed: (x) => x === a,
  released: () => false,
  bufferedJump: () => false,
  consumeJumpBuffer: () => undefined,
  dirX: 0,
});

function type(code: CheatCode, actions: (Action | null)[]): boolean[] {
  return actions.map((a) => code.feed(press(a)));
}

describe('CheatCode', () => {
  it('matches the full sequence with idle frames in between', () => {
    const code = new CheatCode(DEV_CODE);
    const seq: (Action | null)[] = [];
    for (const a of DEV_CODE) seq.push(a, null, null);
    const results = type(code, seq);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[results.length - 3]).toBe(true);
  });

  it('restarts on a wrong press', () => {
    const code = new CheatCode(DEV_CODE);
    expect(type(code, ['up', 'up', 'down', 'jump']).some(Boolean)).toBe(false);
    expect(type(code, DEV_CODE).at(-1)).toBe(true);
  });

  it('treats a wrong press that is the first action as a fresh start', () => {
    const code = new CheatCode(['up', 'down', 'jump']);
    expect(type(code, ['up', 'up', 'down', 'jump']).at(-1)).toBe(true);
  });

  it('can be matched again after completing', () => {
    const code = new CheatCode(['jump', 'attack']);
    expect(type(code, ['jump', 'attack', 'jump', 'attack']).filter(Boolean)).toHaveLength(2);
  });
});
