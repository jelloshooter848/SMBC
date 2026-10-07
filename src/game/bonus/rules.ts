import type { Rng } from '@engine/rng';
import type { ItemId } from './items';

/*
 * The rules of the three SMB3 bonus games, without scenes or drawing, so they replay exactly from
 * a seed (docs/BONUS.md). The scenes in this folder drive them frame by frame.
 */

/** The three bonus games, in the order the World 4 bonus spot rotates through them. */
export type BonusKind = 'toad-house' | 'memory' | 'slots';
export const BONUS_KINDS: readonly BonusKind[] = ['toad-house', 'memory', 'slots'];
export const isBonusKind = (x: unknown): x is BonusKind =>
  typeof x === 'string' && (BONUS_KINDS as readonly string[]).includes(x);

/** Titles shown and announced. */
export const BONUS_TITLES: Readonly<Record<BonusKind, string>> = {
  'toad-house': 'TOAD HOUSE',
  memory: 'N-SPADE',
  slots: 'SPADE GAME',
};

/** The game the bonus spot plays next on this file (save or `Game.bonus`); the rotation's start: Toad House. */
export function nextBonusKind(s: { bonusNext?: number }): BonusKind {
  const n = s.bonusNext ?? 0;
  const i = Number.isInteger(n) && n >= 0 ? n % BONUS_KINDS.length : 0;
  return BONUS_KINDS[i] as BonusKind;
}

/** What a bonus game can give: an item (to the inventory), coins or extra lives (at once). */
export type BonusPrize =
  { kind: 'item'; item: ItemId } | { kind: 'coins'; amount: number } | { kind: 'lives'; amount: number };

// ---------------------------------------------------------------- Toad House

/** What a chest holds, by weight (out of 100): mushroom 50, fire flower 35, star 15. */
export const CHEST_WEIGHTS: readonly (readonly [ItemId, number])[] = [
  ['mushroom', 50],
  ['flower', 35],
  ['star', 15],
];

/** One draw from `weights`. */
export function rollWeighted<T>(rng: Rng, weights: readonly (readonly [T, number])[]): T {
  const total = weights.reduce((a, [, w]) => a + w, 0);
  let n = rng.int(total);
  for (const [v, w] of weights) {
    if (n < w) return v;
    n -= w;
  }
  return (weights[weights.length - 1] as readonly [T, number])[0];
}

/** The three chests' contents, left to right (rolled when the house opens). */
export function dealChests(rng: Rng): ItemId[] {
  return [0, 1, 2].map(() => rollWeighted(rng, CHEST_WEIGHTS));
}

// ---------------------------------------------------------------- N-spade (memory match)

export type CardFace = 'mushroom' | 'flower' | 'star' | '1up' | 'coin10' | 'coin20';
export const MEMORY_COLS = 6;
export const MEMORY_ROWS = 3;
/** Two misses end the game (SMB3). */
export const MEMORY_MISSES = 2;
/** The nine pairs: two of mushroom, flower and 1-up, one each of star, 10 coins and 20 coins. */
export const MEMORY_PAIRS: readonly CardFace[] = [
  'mushroom',
  'mushroom',
  'flower',
  'flower',
  'star',
  '1up',
  '1up',
  'coin10',
  'coin20',
];

/** What a matched pair gives: items go to the inventory, 1-ups and coins count at once. */
export function cardPrize(face: CardFace): BonusPrize {
  switch (face) {
    case 'coin10':
      return { kind: 'coins', amount: 10 };
    case 'coin20':
      return { kind: 'coins', amount: 20 };
    case '1up':
      return { kind: 'lives', amount: 1 };
    default:
      return { kind: 'item', item: face };
  }
}

/** A Fisher-Yates shuffle with `rng`. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export interface Card {
  face: CardFace;
  /** Face up (a matched card, or one of the two being looked at). */
  up: boolean;
  matched: boolean;
}

export type FlipResult = 'first' | 'match' | 'miss' | 'invalid';

/**
 * The N-spade board: 18 cards face down (3 rows of 6, row by row), two flipped at a time. A
 * matching pair stays up and wins its prize; a miss stays up until `hideMiss` (the scene shows it
 * for a moment). Two misses, or every pair found, end it.
 */
export class MemoryGame {
  readonly cards: Card[];
  misses = 0;
  /** Faces of the pairs found, in order. */
  readonly found: CardFace[] = [];
  /** The first card of a pair being turned, or null. */
  first: number | null = null;
  /** The two cards of a miss still showing, or null. */
  missed: [number, number] | null = null;

  constructor(rng: Rng) {
    this.cards = shuffle(rng, [...MEMORY_PAIRS, ...MEMORY_PAIRS]).map((face) => ({
      face,
      up: false,
      matched: false,
    }));
  }

  get over(): boolean {
    return this.misses >= MEMORY_MISSES || this.found.length === MEMORY_PAIRS.length;
  }

  /** Whether card `i` can be turned now. */
  canFlip(i: number): boolean {
    const c = this.cards[i];
    return !!c && !c.up && !this.over && this.missed === null;
  }

  /** Turns card `i`: the first of a pair, the second (match or miss), or invalid (face up, game over, a miss showing). */
  flip(i: number): FlipResult {
    if (!this.canFlip(i)) return 'invalid';
    const c = this.cards[i] as Card;
    c.up = true;
    if (this.first === null) {
      this.first = i;
      return 'first';
    }
    const a = this.cards[this.first] as Card;
    const j = this.first;
    this.first = null;
    if (a.face === c.face) {
      a.matched = c.matched = true;
      this.found.push(c.face);
      return 'match';
    }
    this.misses++;
    this.missed = [j, i];
    return 'miss';
  }

  /** Turns a miss's two cards back down (they stay up when that miss ended the game). */
  hideMiss(): void {
    const m = this.missed;
    if (!m) return;
    this.missed = null;
    if (this.over) return;
    for (const i of m) (this.cards[i] as Card).up = false;
  }
}

// ---------------------------------------------------------------- Spade slot game

export type SlotPicture = 'mushroom' | 'flower' | 'star';
/** Lives a full picture gives (SMB3: mushroom 2-up, flower 3-up, star 5-up). */
export const SLOT_LIVES: Readonly<Record<SlotPicture, number>> = { mushroom: 2, flower: 3, star: 5 };
/** Width of one picture on a reel (px); the window shows one at a time. */
export const SLOT_CELL = 32;
/** Each reel's strip (top, middle, bottom thirds), stars the rarest. */
export const SLOT_STRIPS: readonly (readonly SlotPicture[])[] = [
  ['mushroom', 'flower', 'star', 'mushroom', 'flower', 'mushroom', 'star', 'flower'],
  ['flower', 'mushroom', 'star', 'flower', 'mushroom', 'flower', 'mushroom', 'star'],
  ['star', 'mushroom', 'flower', 'mushroom', 'star', 'flower', 'mushroom', 'flower'],
];
/** px per frame; the middle reel runs the other way (SMB3). */
export const SLOT_SPEEDS: readonly number[] = [4, -4, 4];

/**
 * The three reels, stopped top to bottom one per OK. A reel's offset is how far its strip has
 * scrolled (px): picture `i` sits in the window at offset i × SLOT_CELL. Stopping takes the
 * picture nearest the window's middle and settles on it.
 */
export class SlotMachine {
  readonly offsets: number[];
  readonly stopped: (SlotPicture | null)[] = [null, null, null];

  constructor(rng: Rng) {
    this.offsets = SLOT_STRIPS.map((s) => rng.int(s.length) * SLOT_CELL);
  }

  /** The next reel to stop (0 top .. 2 bottom), or 3 when all have stopped. */
  get next(): number {
    const i = this.stopped.indexOf(null);
    return i < 0 ? 3 : i;
  }

  get done(): boolean {
    return this.next === 3;
  }

  /** One frame: every running reel scrolls by its speed. */
  tick(): void {
    this.offsets.forEach((o, i) => {
      if (this.stopped[i] !== null) return;
      const len = (SLOT_STRIPS[i] as readonly SlotPicture[]).length * SLOT_CELL;
      this.offsets[i] = (((o + (SLOT_SPEEDS[i] as number)) % len) + len) % len;
    });
  }

  /** The index of the picture nearest the window's middle on reel `reel` now. */
  indexAt(reel: number): number {
    const strip = SLOT_STRIPS[reel] as readonly SlotPicture[];
    return Math.round((this.offsets[reel] as number) / SLOT_CELL) % strip.length;
  }

  pictureAt(reel: number): SlotPicture {
    return (SLOT_STRIPS[reel] as readonly SlotPicture[])[this.indexAt(reel)] as SlotPicture;
  }

  /** Stops the next reel on the picture in the window; null when all have stopped. */
  stop(): SlotPicture | null {
    const r = this.next;
    if (r >= 3) return null;
    const i = this.indexAt(r);
    this.offsets[r] = i * SLOT_CELL;
    const pic = this.pictureAt(r);
    this.stopped[r] = pic;
    return pic;
  }

  /** The matched picture once all three show the same one; null on a mismatch or while running. */
  result(): SlotPicture | null {
    const [a, b, c] = this.stopped;
    return a && a === b && b === c ? a : null;
  }

  /** What the round won: lives for a full picture, nothing otherwise. */
  prize(): BonusPrize | null {
    const r = this.result();
    return r ? { kind: 'lives', amount: SLOT_LIVES[r] } : null;
  }
}
