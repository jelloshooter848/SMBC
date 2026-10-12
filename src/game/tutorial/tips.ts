import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';

/*
 * The tips shown (0.4.43, owner: "you can't see what you missed"): the one place a tutorial's or a
 * training stage's tip state lives. The stage tutorial's director (stage-tutorial.ts) hands every
 * new tip it shows to `show` as it reads it out; the box keeps it on screen until the next one
 * replaces it, never on a timer; the pause menu's LAST TIPS reads `last` (tips-scene.ts).
 *
 * 0.4.45 (owner, #37: "pause the player every time a new instruction pops up"): a tip shown for
 * the first time in a run holds the game (`hold`) until a press of OK or TALK, never a timer, in 1-0
 * and in every hero's training stage. The host scenes ask `heldBy` each frame and freeze their world
 * while it holds (hero, enemies, shots, timers, camera). A short lock first eats a press already
 * under way. A tip that comes back (after a reset, a rebuild, a respawn) never holds again.
 */

/** A tip as it was shown: the box's lines (keys filled in) and its words as read out. */
export interface Tip {
  lines: readonly string[];
  said: string;
  /**
   * What makes it the same tip whatever the controls in use (its lesson, its item taken or not):
   * a tip whose key already held the game this run never holds it again. Absent: `said`.
   */
  key?: string;
}

/** How many tips LAST TIPS shows. */
export const LAST_TIPS = 3;

/** Frames a new tip ignores presses for, so a button already on its way down never closes it. */
export const TIP_LOCK_FRAMES = 18;

/** The presses that let a held tip go: OK (JUMP) or TALK. MENU opens the pause menu as ever. */
export const TIP_OK_KEYS: readonly Action[] = ['jump', 'special'];

/** A tip holding the game: whose it is (the director that showed it) and its frames so far. */
interface Hold {
  tip: Tip;
  owner: object;
  t: number;
}

export class TipLog {
  private readonly shown: Tip[] = [];
  /** The keys of the tips that have held the game this run (they never hold it again). */
  private readonly held = new Set<string>();
  private holding: Hold | null = null;

  /**
   * A tip shown now. Returns true when it is new (not the one already up: a tip read out again,
   * the same words, is not a new one).
   */
  show(tip: Tip): boolean {
    const last = this.shown.at(-1);
    if (last && last.said === tip.said) return false;
    this.shown.push({ lines: [...tip.lines], said: tip.said, ...(tip.key ? { key: tip.key } : {}) });
    if (this.shown.length > LAST_TIPS) this.shown.shift();
    return true;
  }

  /** Whether the tip with key `key` would hold the game: it never has this run. */
  wouldHold(key: string): boolean {
    return !this.held.has(key);
  }

  /**
   * `owner` (a tutorial's director) shows `tip` for the first time this run: the game holds until
   * a press (`release`). Returns whether it holds (false for a tip that already held it once).
   */
  hold(tip: Tip, owner: object): boolean {
    const key = tip.key ?? tip.said;
    if (this.held.has(key)) return false;
    this.held.add(key);
    this.holding = { tip, owner, t: 0 };
    return true;
  }

  /** The tip holding the game for `owner`, or null (another director's hold is not its own). */
  heldBy(owner: object): Tip | null {
    return this.holding?.owner === owner ? this.holding.tip : null;
  }

  /** Frames the current hold has lasted (0 when none). */
  get heldFrames(): number {
    return this.holding?.t ?? 0;
  }

  /** The hold's lock is over: a press now lets it go. */
  get unlocked(): boolean {
    return !!this.holding && this.holding.t > TIP_LOCK_FRAMES;
  }

  /**
   * One frame of `owner`'s hold: counts it, and lets it go on a new press of OK or TALK by any
   * player once the lock is over. Returns true while it still holds (the world stays frozen).
   */
  update(owner: object, inputs: readonly InputFrame[]): boolean {
    const h = this.holding;
    if (!h || h.owner !== owner) return false;
    h.t++;
    if (h.t > TIP_LOCK_FRAMES && inputs.some((i) => TIP_OK_KEYS.some((k) => i.pressed(k)))) {
      this.holding = null;
      return false;
    }
    return true;
  }

  /** Any hold ends (the tutorial ended or rebuilt its stretch: Skip this lesson, a put-back). */
  release(): void {
    this.holding = null;
  }

  /** The tip up now (the last one shown), or null. */
  get current(): Tip | null {
    return this.shown.at(-1) ?? null;
  }

  /** The last `n` tips shown, the newest first. */
  last(n = LAST_TIPS): Tip[] {
    return this.shown.slice(-n).reverse();
  }

  /** A new tutorial or training run starts: nothing shown yet, and every tip holds once again. */
  clear(): void {
    this.shown.length = 0;
    this.held.clear();
    this.holding = null;
  }
}
