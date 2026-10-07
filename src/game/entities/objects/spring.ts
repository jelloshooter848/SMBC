import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, vel, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Player } from '../player';

/** Frames to squash fully; the launch comes on the next one (9 frames on the spring, as before). */
const PRESS_FRAMES = 8;
/**
 * A springboard is solid ground two tiles tall (SpringRed extends Ground; its hit box runs from the
 * bottom of its map cell up the clip's height, SpringRed.setColPoints) and squashes to one tile
 * while ridden, so the launch happens with the rider's feet on top of its own map cell.
 */
export const SPRING_TALL = 32; // px
export const SPRING_SQUASHED = 16; // px

/** Flash px/s (32 px tiles) to our velocity units (16 px tiles, 60 frames a second). */
const flash = (pxPerSec: number): number => vel(pxPerSec / 2 / 60);
/** The same for an acceleration in Flash px/s². */
const flashAccel = (pxPerSec2: number): number => vel(pxPerSec2 / 2 / 3600);

/** SpringRed.defSpringPwr (500, both colours): the launch unless jump is pressed on the spring. */
export const SPRING_PLAIN = flash(500);
/** SpringRed.boostSpringPwr (1000): jump pressed while on the red spring. */
export const SPRING_BOOST = flash(1000);
/** SpringGreen.boostSpringPwr for each hero (Mario's 2750 for anyone it doesn't name). */
export const SPRING_GREEN_BOOST: Readonly<Record<string, number>> = {
  mario: flash(2750),
  luigi: flash(2750),
  megaman: flash(3000),
  bill: flash(2150),
  link: flash(2750),
  ryu: flash(2750),
  samus: flash(1750),
  simon: flash(4250),
  sophia: flash(3500),
};
/**
 * The rise after a launch uses the hero's own gravity (the launch starts no jump rise), in Flash
 * px/s²: Mario.GRAVITY 1500, Luigi.GRAVITY 1400, Link.GRAVITY 1300, Ryu.GRAVITY 1400, Samus 700
 * (Samus.as setStats), Bill 1000 (Bill.as setStats), Mega Man 1500 (MegaManBase.GRAVITY), Simon
 * 1500 (Simon.as setStats). Out of water every hero has one fixed value.
 */
export const SPRING_RISE_GRAVITY: Readonly<Record<string, number>> = {
  mario: flashAccel(1500),
  luigi: flashAccel(1400),
  link: flashAccel(1300),
  ryu: flashAccel(1400),
  samus: flashAccel(700),
  bill: flashAccel(1000),
  megaman: flashAccel(1500),
  simon: flashAccel(1500),
  sophia: flashAccel(1050),
};

/**
 * A springboard: a solid two-tile block; land on it and it squashes, then throws you up. Pressing
 * jump while on it gives the boosted launch (the green Lost Levels one goes far off the screen).
 */
export class Spring extends Entity {
  readonly kind = 'spring';
  private rider: Player | null = null;
  /** The player just launched, let through until clear of the box (the spring pops back up). */
  private launchedRider: Player | null = null;
  private t = 0;
  private boost = false;
  /** Bottom edge (subpixels): the bottom of the spring's map cell. */
  private readonly base: number;

  constructor(
    tx: number,
    ty: number,
    readonly green = false,
  ) {
    super(px(tx * 16), px((ty + 1) * 16 - SPRING_TALL), 16, SPRING_TALL);
    this.base = px((ty + 1) * 16);
    this.body.vx = 0;
    this.despawnMargin = 64;
  }

  /** Current height in px: two tiles idle, squashing to one over the ride. */
  get height(): number {
    if (!this.rider) return SPRING_TALL;
    const t = Math.min(this.t, PRESS_FRAMES);
    return SPRING_TALL - Math.round(((SPRING_TALL - SPRING_SQUASHED) * t) / PRESS_FRAMES);
  }

  private fit(): void {
    this.body.h = px(this.height);
    this.body.y = this.base - this.body.h;
  }

  /** Called by the world when a player lands on top. */
  press(p: Player): void {
    if (this.rider) return;
    this.rider = p;
    this.t = 0;
    this.boost = false;
  }

  /**
   * Called by the world every frame while a rider is on it; returns true once the launch happened.
   * `jumpPressed` is the key-down edge only: Character.pressJmpBtn sets springBoost while onSpring,
   * ButtonManager calls it only when jump goes down, and a button already held on landing gives the
   * plain bounce (SpringRed.springLaunch).
   */
  ride(jumpPressed: boolean): boolean {
    const p = this.rider;
    if (!p) return false;
    this.t++;
    if (jumpPressed) this.boost = true;
    this.fit();
    const b = p.body;
    b.vy = 0;
    b.onGround = true;
    b.y = this.body.y - b.h;
    if (this.t > PRESS_FRAMES) {
      const id = p.def.id;
      const vy = !this.boost
        ? SPRING_PLAIN
        : this.green
          ? (SPRING_GREEN_BOOST[id] ?? (SPRING_GREEN_BOOST.mario as number))
          : SPRING_BOOST;
      p.springLaunch(vy, SPRING_RISE_GRAVITY[id] ?? (SPRING_RISE_GRAVITY.mario as number));
      this.rider = null;
      this.launchedRider = p;
      this.fit();
      return true;
    }
    return false;
  }

  get busy(): boolean {
    return this.rider !== null;
  }

  /** Is `p` the player riding it right now? */
  ridBy(p: Player): boolean {
    return this.rider === p;
  }

  /**
   * Keep a player out of the box: landing on top starts the ride, a head hit from below stops the
   * rise (AnimatedObject.hitGround → groundAbove), and a side hit stops the player at the side
   * (Character.groundOnSide).
   */
  block(p: Player): void {
    if (p === this.rider) return;
    const b = p.body;
    const s = this.body;
    const overlap = b.x < s.x + s.w && b.x + b.w > s.x && b.y < s.y + s.h && b.y + b.h > s.y;
    if (!overlap) {
      if (p === this.launchedRider) this.launchedRider = null;
      return;
    }
    if (p === this.launchedRider) return;
    if (b.vy >= 0 && b.prevBottom <= s.y + px(4)) {
      b.y = s.y - b.h;
      b.vy = 0;
      b.onGround = true;
      this.press(p);
    } else if (b.vy < 0 && b.y - velToSub(b.vy) >= s.y + s.h - px(4)) {
      b.y = s.y + s.h;
      b.vy = 0;
      b.hitHead = true;
    } else if (b.x + b.w / 2 < s.x + s.w / 2) {
      b.x = s.x - b.w;
      if (b.vx > 0) b.vx = 0;
      b.hitWall = 1;
    } else {
      b.x = s.x + s.w;
      if (b.vx < 0) b.vx = 0;
      b.hitWall = -1;
    }
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const h = this.height;
    const frame = `${this.green ? 'spring-green' : 'spring'}-${h > 28 ? 0 : h > 20 ? 1 : 2}`;
    r.sprite(view.assets.sheet('items'), frame, toPx(this.body.x) - view.camX, toPx(this.base) - SPRING_TALL);
  }
}
