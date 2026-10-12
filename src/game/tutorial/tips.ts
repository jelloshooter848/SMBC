/*
 * The tips shown (0.4.43, owner: "you can't see what you missed"): the one place a tutorial's or a
 * training stage's tip state lives. The stage tutorial's director (stage-tutorial.ts) hands every
 * new tip it shows to `show` as it reads it out; the box keeps it on screen until the next one
 * replaces it, never on a timer; the pause menu's LAST TIPS reads `last` (tips-scene.ts).
 *
 * 0.4.45 will freeze the game while a new tip first shows, until a press: that hook belongs in
 * `show`, which is told every tip and says whether it is new.
 */

/** A tip as it was shown: the box's lines (keys filled in) and its words as read out. */
export interface Tip {
  lines: readonly string[];
  said: string;
}

/** How many tips LAST TIPS shows. */
export const LAST_TIPS = 3;

export class TipLog {
  private readonly shown: Tip[] = [];

  /**
   * A tip shown now. Returns true when it is new (not the one already up: a tip read out again,
   * the same words, is not a new one).
   */
  show(tip: Tip): boolean {
    const last = this.shown.at(-1);
    if (last && last.said === tip.said) return false;
    this.shown.push({ lines: [...tip.lines], said: tip.said });
    if (this.shown.length > LAST_TIPS) this.shown.shift();
    return true;
  }

  /** The tip up now (the last one shown), or null. */
  get current(): Tip | null {
    return this.shown.at(-1) ?? null;
  }

  /** The last `n` tips shown, the newest first. */
  last(n = LAST_TIPS): Tip[] {
    return this.shown.slice(-n).reverse();
  }

  /** A new tutorial or training run starts: nothing shown yet. */
  clear(): void {
    this.shown.length = 0;
  }
}
