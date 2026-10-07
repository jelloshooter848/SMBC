import { describe, expect, it } from 'vitest';
import { Rng } from '@engine/rng';
import {
  BONUS_KINDS,
  cardPrize,
  CHEST_WEIGHTS,
  dealChests,
  MEMORY_PAIRS,
  MemoryGame,
  MEMORY_COLS,
  MEMORY_ROWS,
  NSPADE_BOARDS,
  boardFaces,
  takenCards,
  nextBonusKind,
  rollWeighted,
  SLOT_CELL,
  SLOT_LIVES,
  SLOT_STRIPS,
  SlotMachine,
  type CardFace,
} from './rules';

describe('rotation', () => {
  it('goes Toad House, N-spade, spade game and round again; a missing field starts at the Toad House', () => {
    expect(BONUS_KINDS).toEqual(['toad-house', 'memory', 'slots']);
    expect(nextBonusKind({})).toBe('toad-house');
    expect([0, 1, 2, 3, 4].map((n) => nextBonusKind({ bonusNext: n }))).toEqual([
      'toad-house',
      'memory',
      'slots',
      'toad-house',
      'memory',
    ]);
    expect(nextBonusKind({ bonusNext: -1 })).toBe('toad-house');
    expect(nextBonusKind({ bonusNext: 1.5 })).toBe('toad-house');
  });
});

describe('Toad House chests', () => {
  it('deals three chests from the seed: the same seed, the same chests', () => {
    const a = dealChests(new Rng(7));
    expect(a).toHaveLength(3);
    expect(dealChests(new Rng(7))).toEqual(a);
    for (const c of a) expect(['mushroom', 'flower', 'star']).toContain(c);
  });

  it('weights mushroom 50, flower 35, star 15 (over many draws)', () => {
    expect(CHEST_WEIGHTS.reduce((s, [, w]) => s + w, 0)).toBe(100);
    const rng = new Rng(12345);
    const n = 20000;
    const count: Record<string, number> = { mushroom: 0, flower: 0, star: 0 };
    for (let i = 0; i < n; i++) count[rollWeighted(rng, CHEST_WEIGHTS)]!++;
    expect((count.mushroom as number) / n).toBeCloseTo(0.5, 1);
    expect((count.flower as number) / n).toBeCloseTo(0.35, 1);
    expect((count.star as number) / n).toBeCloseTo(0.15, 1);
  });
});

/** Positions of each face on a board. */
function where(g: MemoryGame): Map<CardFace, number[]> {
  const m = new Map<CardFace, number[]>();
  g.cards.forEach((c, i) => m.set(c.face, [...(m.get(c.face) ?? []), i]));
  return m;
}

describe('N-spade memory match', () => {
  it('has a fixed set of boards, dealt in order: each 18 cards, the nine pairs, our own layouts', () => {
    expect(NSPADE_BOARDS.length).toBeGreaterThanOrEqual(4);
    expect(MEMORY_PAIRS).toHaveLength(9);
    const layouts = new Set<string>();
    NSPADE_BOARDS.forEach((_, n) => {
      const faces = boardFaces(n);
      expect(faces).toHaveLength(MEMORY_COLS * MEMORY_ROWS);
      for (const f of new Set(MEMORY_PAIRS)) {
        const pairs = MEMORY_PAIRS.filter((p) => p === f).length;
        expect(faces.filter((x) => x === f)).toHaveLength(pairs * 2);
      }
      layouts.add(faces.join());
    });
    expect(layouts.size).toBe(NSPADE_BOARDS.length);
    // After the last board, the first again.
    expect(boardFaces(NSPADE_BOARDS.length)).toEqual(boardFaces(0));
    const g = new MemoryGame(boardFaces(2));
    expect(g.cards.map((c) => c.face)).toEqual(boardFaces(2));
    expect(g.cards.every((c) => !c.up && !c.gone)).toBe(true);
  });

  it('cards taken on an earlier visit are gone: they cannot be turned, and the rest clear the board', () => {
    const faces = boardFaces(0);
    const at = (f: CardFace) => faces.flatMap((x, i) => (x === f ? [i] : []));
    const [s1, s2] = at('star') as [number, number];
    const g = new MemoryGame(faces, [s1, s2]);
    expect(g.cards[s1]?.gone).toBe(true);
    expect(g.flip(s1)).toBe('invalid');
    expect(g.left).toBe(16);
    for (const f of new Set(faces)) {
      if (f === 'star') continue;
      const idx = at(f);
      for (let k = 0; k < idx.length; k += 2) {
        g.flip(idx[k] as number);
        expect(g.flip(idx[k + 1] as number)).toBe('match');
        expect(g.lastPair).toEqual([idx[k], idx[k + 1]]);
      }
    }
    expect(g.found).toHaveLength(8);
    expect(g.cleared).toBe(true);
    expect(g.over).toBe(true);
  });

  it('keeps only taken cards that make whole pairs on that board (anything else from a file is dropped)', () => {
    const faces = boardFaces(1);
    const at = (f: CardFace) => faces.flatMap((x, i) => (x === f ? [i] : []));
    const [c1, c2] = at('coin10') as [number, number];
    const [u1] = at('1up') as [number];
    expect(takenCards(faces, [c2, c1])).toEqual([c1, c2]);
    expect(takenCards(faces, [c1, c2, u1])).toEqual([c1, c2]); // a lone 1-up: not a pair
    expect(takenCards(faces, [c1, c1, c2, 99, -1, 'x', 2.5])).toEqual([c1, c2]);
    expect(takenCards(faces, 'nope')).toEqual([]);
  });

  it('a matching pair stays up and is found; a miss shows until hidden, then turns back', () => {
    const g = new MemoryGame(boardFaces(4));
    const w = where(g);
    const [a, b] = w.get('star') as number[];
    expect(g.flip(a as number)).toBe('first');
    expect(g.flip(a as number)).toBe('invalid'); // already up
    expect(g.flip(b as number)).toBe('match');
    expect(g.found).toEqual(['star']);
    expect(g.cards[a as number]?.matched && g.cards[b as number]?.up).toBe(true);
    const m = w.get('mushroom') as number[];
    const f = w.get('flower') as number[];
    expect(g.flip(m[0] as number)).toBe('first');
    expect(g.flip(f[0] as number)).toBe('miss');
    expect(g.misses).toBe(1);
    expect(g.flip(m[1] as number)).toBe('invalid'); // the miss is still showing
    g.hideMiss();
    expect(g.cards[m[0] as number]?.up).toBe(false);
    expect(g.cards[f[0] as number]?.up).toBe(false);
    expect(g.over).toBe(false);
  });

  it('two misses end it (the second miss stays up); nothing can be turned after', () => {
    const g = new MemoryGame(boardFaces(4));
    const w = where(g);
    const m = w.get('mushroom') as number[];
    const f = w.get('flower') as number[];
    g.flip(m[0] as number);
    g.flip(f[0] as number);
    g.hideMiss();
    g.flip(m[0] as number);
    expect(g.flip(f[0] as number)).toBe('miss');
    expect(g.over).toBe(true);
    g.hideMiss();
    expect(g.cards[f[0] as number]?.up).toBe(true);
    expect(g.flip(m[1] as number)).toBe('invalid');
  });

  it('finding every pair ends it too', () => {
    const g = new MemoryGame(boardFaces(1));
    const seen = new Set<CardFace>();
    for (const [face, idx] of where(g)) {
      for (let k = 0; k < idx.length; k += 2) {
        g.flip(idx[k] as number);
        expect(g.flip(idx[k + 1] as number)).toBe('match');
      }
      seen.add(face);
    }
    expect(g.found).toHaveLength(9);
    expect(g.over).toBe(true);
    expect(g.misses).toBe(0);
  });

  it('prizes: items for mushroom, flower and star; a life for 1-up; 10 and 20 coins', () => {
    expect(cardPrize('mushroom')).toEqual({ kind: 'item', item: 'mushroom' });
    expect(cardPrize('flower')).toEqual({ kind: 'item', item: 'flower' });
    expect(cardPrize('star')).toEqual({ kind: 'item', item: 'star' });
    expect(cardPrize('1up')).toEqual({ kind: 'lives', amount: 1 });
    expect(cardPrize('coin10')).toEqual({ kind: 'coins', amount: 10 });
    expect(cardPrize('coin20')).toEqual({ kind: 'coins', amount: 20 });
  });
});

describe('spade slot game', () => {
  it('starts each reel from the seed, scrolls the middle one the other way, and stops top to bottom', () => {
    const m = new SlotMachine(new Rng(5));
    expect(new SlotMachine(new Rng(5)).offsets).toEqual(m.offsets);
    const before = m.offsets.slice();
    m.tick();
    const len = (i: number) => (SLOT_STRIPS[i]?.length ?? 0) * SLOT_CELL;
    expect(m.offsets[0]).toBe(((before[0] as number) + 4) % len(0));
    expect(m.offsets[1]).toBe(((before[1] as number) - 4 + len(1)) % len(1));
    expect(m.next).toBe(0);
    const top = m.pictureAt(0);
    expect(m.stop()).toBe(top);
    expect(m.next).toBe(1);
    const held = m.offsets[0];
    m.tick();
    expect(m.offsets[0]).toBe(held); // a stopped reel stays put
    m.stop();
    m.stop();
    expect(m.done).toBe(true);
    expect(m.stop()).toBeNull();
  });

  it('stops on the picture nearest the window and settles on it', () => {
    const m = new SlotMachine(new Rng(5));
    m.offsets[0] = 2 * SLOT_CELL + 10; // nearer picture 2
    expect(m.indexAt(0)).toBe(2);
    m.stop();
    expect(m.offsets[0]).toBe(2 * SLOT_CELL);
    expect(m.stopped[0]).toBe(SLOT_STRIPS[0]?.[2]);
  });

  /** Stops every reel on `pic` (the first index of it on each strip). */
  function line(m: SlotMachine, pics: string[]) {
    pics.forEach((p, r) => {
      m.offsets[r] = (SLOT_STRIPS[r] as readonly string[]).indexOf(p) * SLOT_CELL;
      m.stop();
    });
  }

  it('a full picture wins lives: mushroom 2, flower 3, star 5 (SMB3)', () => {
    expect(SLOT_LIVES).toEqual({ mushroom: 2, flower: 3, star: 5 });
    for (const p of ['mushroom', 'flower', 'star'] as const) {
      const m = new SlotMachine(new Rng(1));
      line(m, [p, p, p]);
      expect(m.result()).toBe(p);
      expect(m.prize()).toEqual({ kind: 'lives', amount: SLOT_LIVES[p] });
    }
  });

  it('a mismatch wins nothing', () => {
    const m = new SlotMachine(new Rng(1));
    line(m, ['mushroom', 'mushroom', 'star']);
    expect(m.result()).toBeNull();
    expect(m.prize()).toBeNull();
    const n = new SlotMachine(new Rng(1));
    expect(n.prize()).toBeNull(); // still running
  });
});
