/*
 * Lives and checkpoints for the mini games built on World (Mega Man, Samus, Simon, Ryu), on the
 * pattern of Bill's REST model (bill/scene.ts, bill/jungle.ts): three lives; a death with a life
 * left restarts the hero at the last checkpoint reached (the stage start, a mid-stage one, the
 * boss door); losing the last one is GAME OVER, which shows for GAME_OVER_FRAMES and only then
 * fails the round (the shared TRY AGAIN). The dev assist Infinite lives keeps the count where it
 * is; No damage needs nothing here (World reads it).
 *
 * The helper only keeps the count and the checkpoint: each scene builds its own World again at
 * `lives.start` (with its hero's `WorldStart.deathStyle`) when `lose()` says `retry`.
 */

/** Lives a round starts with (Bill's LIVES; the NES games' three). */
export const MINI_LIVES = 3;
/** GAME OVER shows this long before the round fails (Bill's GAME_OVER_FRAMES). */
export const GAME_OVER_FRAMES = 180;

/** A place a life can restart from. */
export interface MiniCheckpoint {
  /** A name for tests and the scene's own use ('start', 'mid', 'boss'...). */
  id: string;
  /** The hero's start tile there (World's WorldStart.x / y). */
  x: number;
  y: number;
  /**
   * The tile column whose crossing (the hero's centre at or past it) reaches it; left out, `x`.
   * The stage start is never "reached": it is where the round begins.
   */
  at?: number;
  /** Rows (inclusive) the hero's centre must be within to reach it (a shaft's checkpoint). */
  rows?: readonly [number, number];
}

export interface MiniLivesOptions {
  /** Lives the round starts with, counting the one in play (default MINI_LIVES). */
  lives?: number;
  /** The dev assist Infinite lives (read at each death). */
  infinite?: () => boolean;
  /** Where the round begins. */
  start: MiniCheckpoint;
  /** The checkpoints along the way, in the order they are reached. */
  checkpoints?: readonly MiniCheckpoint[];
}

export type LifeLost = 'retry' | 'over';

/** One round's lives and the checkpoint the next life starts from. */
export class MiniLives {
  /** Lives in reserve, besides the one in play (Contra's REST; the HUD's P-lives). */
  rest: number;
  /** The checkpoint the next life starts from. */
  current: MiniCheckpoint;
  private readonly infinite: () => boolean;
  private readonly checkpoints: readonly MiniCheckpoint[];

  constructor(opts: MiniLivesOptions) {
    this.rest = Math.max(1, opts.lives ?? MINI_LIVES) - 1;
    this.current = opts.start;
    this.infinite = opts.infinite ?? (() => false);
    this.checkpoints = opts.checkpoints ?? [];
  }

  /** Lives counting the one in play. */
  get lives(): number {
    return this.rest + 1;
  }

  /** The start tile of the next life (WorldStart.x / y). */
  get start(): { x: number; y: number } {
    return { x: this.current.x, y: this.current.y };
  }

  /**
   * The hero's centre is at tile (col, row): any checkpoint further along than the current one
   * that this passes becomes the current one. Returns it when one was newly reached, else null.
   */
  reach(col: number, row: number): MiniCheckpoint | null {
    const i = this.checkpoints.indexOf(this.current);
    let got: MiniCheckpoint | null = null;
    for (let k = i + 1; k < this.checkpoints.length; k++) {
      const c = this.checkpoints[k] as MiniCheckpoint;
      if (col < (c.at ?? c.x)) continue;
      if (c.rows && (row < c.rows[0] || row > c.rows[1])) continue;
      got = c;
    }
    if (got) this.current = got;
    return got;
  }

  /** Makes checkpoint `id` the current one (a boss door the scene knows it reached). */
  set(id: string): void {
    const c = this.checkpoints.find((k) => k.id === id);
    if (c) this.current = c;
  }

  /**
   * A life was lost. `retry`: another starts at `start` (one fewer in reserve, unless Infinite
   * lives is on); `over`: none was left, GAME OVER.
   */
  lose(): LifeLost {
    if (this.infinite()) return 'retry';
    if (this.rest <= 0) return 'over';
    this.rest--;
    return 'retry';
  }
}

/**
 * What the announcer says when `hero` loses a life (`rest`: the lives left in reserve after it),
 * as Bill's scene words it; GAME OVER has its own line.
 */
export function lifeLostSaid(hero: string, rest: number, infinite: boolean): string {
  if (infinite) return `${hero} is down!`;
  if (rest <= 0) return `${hero} is down! Game over.`;
  return rest === 1 ? `${hero} is down! Last life.` : `${hero} is down! ${rest} lives left.`;
}
