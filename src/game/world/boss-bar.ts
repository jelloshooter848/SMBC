/*
 * The Bowser bar (0.4.47, roadmap #30): every Bowser, fake and real, in every castle (8-4 too, and
 * the Lost Kingdom's) has an SMB-style boss health bar while his fight is on, in the campaign
 * only: the original Crossover shows no boss health at all (its HUD is TopScreenText's score,
 * coins, world and time; Bowser.as only counts his five hits), so classic play keeps it that way.
 * Like Larry's bar on Mega Man's airship (Larry.hpMode), it shows while he fights and empties as
 * he is hit. It starts when he comes on screen (Bowser.update); a weapon kill leaves it empty for
 * BOSS_BAR_HOLD frames; a kill by the axe or a fall takes it away at once. The HUD draws it
 * (hud/boss-bar.ts).
 */

/** Frames the emptied bar stays up after a weapon kill (a beat to see it empty). */
export const BOSS_BAR_HOLD = 45;
/** Frames the notches a hit took stay lit (blinking, or held steady with reduce flashing). */
export const BOSS_BAR_LOST = 24;

export class BossBar {
  /** The boss it is for (one at a time: the last one to come on or be hit), or null: hidden. */
  private owner: object | null = null;
  max = 0;
  hp = 0;
  /** Hit points before the last hit: the notches it took glow for BOSS_BAR_LOST frames. */
  lostFrom = 0;
  /** Frames since the last hit. */
  hitAge = BOSS_BAR_LOST;
  /** Frames left of the emptied bar after a weapon kill; 0 while the fight is on. */
  private hold = 0;

  get shown(): boolean {
    return this.owner !== null;
  }

  /** Whether the bar is boss `owner`'s. */
  isFor(owner: object): boolean {
    return this.owner === owner;
  }

  /** Boss `owner` came on screen with `hp` of `max`: the bar is his (unless another's is up). */
  start(owner: object, max: number, hp: number): boolean {
    if (this.owner !== null) return false;
    this.take(owner, max, hp);
    return true;
  }

  /**
   * Boss `owner` took a hit, from `before` hit points down to `hp`: the bar is his (another's
   * gives way), a notch or more lower.
   */
  hit(owner: object, max: number, before: number, hp: number): void {
    if (this.owner !== owner) this.take(owner, max, before);
    this.lostFrom = this.hp;
    this.hp = Math.max(0, hp);
    this.hitAge = 0;
  }

  /** Boss `owner` was beaten by a weapon from `before` hit points: empty a moment, then gone. */
  beaten(owner: object, max: number, before: number): void {
    this.hit(owner, max, before, 0);
    this.hold = BOSS_BAR_HOLD;
  }

  /**
   * Boss `owner` is gone another way (the axe, a fall): the bar goes at once, unless it is already
   * showing his weapon kill.
   */
  end(owner: object): void {
    if (this.owner === owner && this.hold === 0) this.owner = null;
  }

  /** The axe was taken: whatever bar is up goes, a weapon kill's emptied one left to run out. */
  axe(): void {
    if (this.hold === 0) this.owner = null;
  }

  /** Each frame. */
  tick(alive: (owner: object) => boolean = () => true): void {
    if (this.hitAge < BOSS_BAR_LOST) this.hitAge++;
    if (this.hold > 0 && --this.hold === 0) this.owner = null;
    // Gone some other way (despawned, the level left): no bar for a boss who is not there.
    if (this.owner && this.hold === 0 && !alive(this.owner)) this.owner = null;
  }

  private take(owner: object, max: number, hp: number): void {
    this.owner = owner;
    this.max = max;
    this.hp = hp;
    this.lostFrom = hp;
    this.hitAge = BOSS_BAR_LOST;
    this.hold = 0;
  }
}
