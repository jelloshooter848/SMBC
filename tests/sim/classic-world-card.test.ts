import { describe, expect, it } from 'vitest';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import { INTRO_FRAMES, INTRO_FRAMES_SINGLE, IntroScene } from '../../src/game/scenes/intro';
import { CARD_GUARD_FRAMES } from '../../src/game/scenes/message';
import type { Game } from '../../src/game/scenes/game';

// G-090 (D4): the WORLD card moves on by itself, as the original's InformativeBlackScreen does
// (2000 ms, 2500 ms in Single Character), and in a Classic run a press skips it.

const press = (a: Action | null): InputFrame =>
  ({ pressed: (k: Action) => k === a }) as unknown as InputFrame;

function run(opts: { frames?: number; skippable?: boolean }, pressAt: number | null): number | null {
  let doneAt: number | null = null;
  let t = 0;
  const s = new IntroScene({} as Game, () => (doneAt = doneAt ?? t), null, opts);
  for (t = 1; t <= 400 && doneAt === null; t++) {
    const i = press(t === pressAt ? 'jump' : null);
    s.update(i, [i]);
  }
  return doneAt;
}

describe('G-090 WORLD card', () => {
  it('moves on by itself after 2 seconds, and 2.5 in Single Character', () => {
    expect(INTRO_FRAMES).toBe(120);
    expect(INTRO_FRAMES_SINGLE).toBe(150);
    expect(run({ skippable: true }, null)).toBe(INTRO_FRAMES);
    expect(run({ skippable: true, frames: INTRO_FRAMES_SINGLE }, null)).toBe(INTRO_FRAMES_SINGLE);
  });

  it('a press skips it in a Classic run, after the guard', () => {
    expect(run({ skippable: true }, CARD_GUARD_FRAMES + 5)).toBe(CARD_GUARD_FRAMES + 5);
    expect(run({ skippable: true }, 3)).toBe(INTRO_FRAMES);
  });

  it('the campaign card is unchanged: a press does not skip it', () => {
    expect(run({}, CARD_GUARD_FRAMES + 5)).toBe(INTRO_FRAMES);
  });

  it('goes on only once', () => {
    let n = 0;
    const s = new IntroScene({} as Game, () => n++, null, { skippable: true });
    for (let t = 0; t < 300; t++) s.update(press('jump'), [press('jump')]);
    expect(n).toBe(1);
  });
});
