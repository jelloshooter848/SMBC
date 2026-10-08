import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { ActionState, NO_INPUT } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import { DEFAULT_ASSIST } from '../context';
import { Game } from '../scenes/game';
import { CHARACTERS } from '../characters/registry';
import { MARIO } from '../characters/mario';
import { BONUS_GUARD_FRAMES } from './common';
import { cursorStep, MemoryScene } from './memory';
import { MEMORY_COLS, MEMORY_ROWS } from './rules';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame(): Game {
  const assets = {
    sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
    has: () => false,
  } as unknown as AssetRegistry;
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
  });
  game.newGame(MARIO, '1-1');
  return game;
}

/** The N-spade on board 0 (rows FUCDFU / MMUFSC / UMFDMS) with cards `taken` on earlier visits, past the guard. */
function nspade(taken: number[]): { game: Game; scene: MemoryScene; tap: (a: Action) => void } {
  const game = makeGame();
  game.bonus.spadeBoard = 0;
  game.bonus.spadeTaken = taken;
  const scene = new MemoryScene(game, 1, () => {});
  game.scenes.push(scene);
  for (let i = 0; i <= BONUS_GUARD_FRAMES; i++) game.scenes.update([NO_INPUT]);
  const input = new ActionState();
  const tap = (a: Action) => {
    input.beginFrame(new Set([a]));
    game.scenes.update([input]);
    input.beginFrame(new Set());
    game.scenes.update([input]);
  };
  return { game, scene, tap };
}

describe('N-spade: the cursor skips taken cards', () => {
  it('starts on the first card still on the board', () => {
    const { scene } = nspade([0, 4]);
    expect(scene.cursor).toBe(1);
  });

  it('left and right pass over cards taken on earlier visits (wrapping round the row)', () => {
    const { scene, tap } = nspade([0, 4]);
    tap('left');
    expect(scene.cursor).toBe(5);
    tap('left');
    expect(scene.cursor).toBe(3);
    tap('right');
    expect(scene.cursor).toBe(5);
    tap('right');
    expect(scene.cursor).toBe(1);
  });

  it('up and down pass over them too', () => {
    const { scene, tap } = nspade([0, 4]);
    tap('left'); // 5
    tap('left'); // 3
    tap('left'); // 2
    tap('left'); // 1
    tap('down'); // 7
    tap('left'); // 6
    expect(scene.cursor).toBe(6);
    tap('up'); // the top row's card in column 0 is taken: its nearest card, 1
    expect(scene.cursor).toBe(1);
    tap('down'); // column 1's middle card, 7
    expect(scene.cursor).toBe(7);
  });

  it('a pair found on this visit is taken too: the cursor moves off it and passes over it', () => {
    const { scene, tap } = nspade([]);
    tap('down'); // 6, a mushroom
    tap('jump');
    tap('right'); // 7, its pair
    tap('jump');
    expect(scene.board.cards[6]?.matched && scene.board.cards[7]?.matched).toBe(true);
    expect(scene.cursor).toBe(8);
    tap('left');
    expect(scene.cursor).toBe(11);
  });

  it('when the rest of a column is taken, up and down go to the nearest card in the next row', () => {
    // Column 2 (C, U, F) keeps only its top card: 8 and 12 (1-ups), 0 and 14 (flowers) are taken.
    const { scene, tap } = nspade([0, 8, 12, 14]);
    expect(scene.cursor).toBe(1);
    tap('right');
    expect(scene.cursor).toBe(2);
    tap('down'); // the middle row's nearest card to column 2 (7 and 9 tie: the right one)
    expect(scene.cursor).toBe(9);
    tap('left'); // 7 (8 is taken)
    tap('left'); // 6
    tap('up'); // column 0 has only 6 left: the nearest card in the top row, 1
    expect(scene.cursor).toBe(1);
  });
});

describe('N-spade: every card left can be reached', () => {
  it('from any card, for every set of taken cards', () => {
    const n = MEMORY_COLS * MEMORY_ROWS;
    const moves = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const;
    for (let mask = 0; mask < 1 << n; mask++) {
      const taken = (c: number, r: number) => ((mask >> (r * MEMORY_COLS + c)) & 1) === 1;
      const left = [...Array(n).keys()].filter((i) => !((mask >> i) & 1));
      const from = left[0];
      if (from === undefined) continue;
      const seen = new Set([from]);
      const todo = [from];
      while (todo.length) {
        const i = todo.pop() as number;
        for (const [dc, dr] of moves) {
          const [c, r] = cursorStep(taken, i % MEMORY_COLS, Math.floor(i / MEMORY_COLS), dc, dr);
          const j = r * MEMORY_COLS + c;
          if (!seen.has(j)) {
            seen.add(j);
            todo.push(j);
          }
        }
      }
      if (seen.size !== left.length)
        throw new Error(`taken mask ${mask}: reached ${seen.size} of ${left.length}`);
    }
  });

  it('the review case: row 1 is reached when only columns 0 and 4 hold cards there and above', () => {
    // Board 0 with every face but the F and M pairs at 4, 6, 9 and 16 taken.
    const { scene, tap } = nspade([0, 1, 2, 3, 5, 7, 8, 10, 11, 12, 13, 14, 15, 17]);
    expect(scene.cursor).toBe(4);
    tap('down');
    expect([6, 9]).toContain(scene.cursor);
  });
});
