import type { Renderer } from '@engine/gfx/renderer';
import { translucent } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, velToSub } from '@engine/math/units';
import { moveY } from '../../entities/body';
import { Entity, type View } from '../../entities/entity';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';

/**
 * Classic SMBC's Rush Coil (2026-10-07-megaman-classic-smbc-rules.md MM-C28..MM-C31;
 * `pickups/Rush.as`). Summoned free by a Select tap, he drops in from the top of the screen,
 * lands, waits, warns, and flies off; a falling hero who touches him is launched about 103 px.
 * Current keeps entities/objects/rush-coil.ts.
 */

/** Rush's fall and fly-off acceleration, 2300 px/s² (0.31944 px/f², MM-C29). */
export const RUSH_ACCEL = 0x0051c;
/** His fall speed cap, 1000 px/s (8.3333 px/f). */
export const RUSH_MAX_FALL = 0x08555;
/** He ignores ground until his feet are this close above the hero's (64 px over a lift; MM-C29). */
export const RUSH_IGNORE_ABOVE = 32;
/** Landing and exit animation lengths (SWF; Open question 4's default). */
export const RUSH_LAND_FRAMES = 8;
export const RUSH_EXIT_FRAMES = 8;
/** Waiting at full opacity, then at 75 % (the warning), before he leaves (MM-C30). */
export const RUSH_WAIT_FRAMES = 120;
export const RUSH_WARN_FRAMES = 120;
/** After a bounce he springs and leaves this much later (400 ms, MM-C31). */
export const RUSH_SPRING_FRAMES = 24;
/**
 * The bounce: 800 px/s (6.6667 px/f, 0x06AAB) in the original, which adds gravity before the
 * move; ours less one frame of the hero's gravity (MM-C10), so the arc matches frame for frame.
 */
export const RUSH_BOUNCE_VY = 0x06755;

export type RushPhase = 'drop' | 'land' | 'wait' | 'spring' | 'exit' | 'fly';

/** Rush's target x (MM-C29): the centre (subpixels) he drops onto, in front of `p`. */
export function rushTargetX(p: Player, world: World, upHeld: boolean): number {
  const b = p.body;
  const cx = b.x + (b.w >> 1);
  if (upHeld) return cx;
  const row = tileAt(b.y + (b.h >> 1));
  const front = p.facing > 0 ? b.x + b.w : b.x - 1;
  const col1 = tileAt(front);
  if (world.map.isSolid(col1, row)) return cx;
  if (world.map.isSolid(col1 + p.facing, row)) return cx + p.facing * px(10);
  return cx + p.facing * px(20);
}

export class ClassicRush extends Entity {
  readonly kind = 'rush-coil';
  phase: RushPhase = 'drop';
  /** Frames in the current phase. */
  t = 0;

  constructor(
    cx: number,
    top: number,
    readonly owner: Player,
  ) {
    super(cx - px(7), top - px(14), 14, 14);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.layer = 'back';
    this.despawnMargin = null;
    this.facing = owner.facing;
  }

  /** Summons Rush for `p` (MM-C28, MM-C29): from the top of the screen, onto the target x. */
  static summon(p: Player, world: World, upHeld: boolean): ClassicRush {
    const r = new ClassicRush(rushTargetX(p, world, upHeld), world.camera.y, p);
    world.spawn(r);
    return r;
  }

  /** Waiting (or landing): a tap sends him away, and a falling hero bounces on him. */
  get waiting(): boolean {
    return this.phase === 'land' || this.phase === 'wait';
  }

  /** A Select tap while he waits sends him off at once (MM-C28); otherwise it does nothing. */
  dismiss(): void {
    if (!this.waiting) return;
    this.setPhase('exit');
  }

  private setPhase(phase: RushPhase): void {
    this.phase = phase;
    this.t = 0;
  }

  update(world: World): void {
    const b = this.body;
    this.t++;
    switch (this.phase) {
      case 'drop': {
        b.vy = Math.min(b.vy + RUSH_ACCEL, RUSH_MAX_FALL);
        const feet = this.owner.body.y + this.owner.body.h;
        if (b.y + b.h < feet - px(RUSH_IGNORE_ABOVE)) b.y += velToSub(b.vy);
        else {
          moveY(b, world.map, velToSub(b.vy));
          if (b.onGround) {
            b.vy = 0;
            this.setPhase('land');
          }
        }
        if (this.isBelowLevel()) this.destroy();
        return;
      }
      case 'land':
        if (this.t >= RUSH_LAND_FRAMES) this.setPhase('wait');
        break;
      case 'wait':
        if (this.t >= RUSH_WAIT_FRAMES + RUSH_WARN_FRAMES) this.setPhase('exit');
        break;
      case 'spring':
        if (this.t >= RUSH_SPRING_FRAMES) this.setPhase('exit');
        return;
      case 'exit':
        if (this.t >= RUSH_EXIT_FRAMES) {
          b.vy = 0;
          this.setPhase('fly');
        }
        return;
      case 'fly':
        b.vy -= RUSH_ACCEL;
        b.y += velToSub(b.vy);
        if (b.y + b.h < world.camera.y) this.destroy();
        return;
    }
    if (this.waiting) this.bounce(world);
  }

  /** A falling hero touching him while he lands or waits is launched off his back (MM-C31). */
  private bounce(world: World): void {
    const top = this.body.y;
    for (const p of world.activePlayers()) {
      const pb = p.body;
      if (pb.onGround || p.fallSpeed <= 0 || !overlaps(pb, this.body)) continue;
      pb.y = top - pb.h;
      // The rise uses the hero's own gravity; a launch cannot be cut short (Player.launch).
      const g = p.profile.jump[0]?.fallGravity ?? 0;
      p.springLaunch(RUSH_BOUNCE_VY, g);
      world.audio.sfx('jump-big');
      this.setPhase('spring');
      return;
    }
  }

  render(r: Renderer, view: View): void {
    const frame = this.phase === 'spring' ? 'rush-coil-1' : 'rush-coil-0';
    const draw = () =>
      r.sprite(view.assets.sheet('items'), frame, this.screenX(view), this.screenY(), this.facing > 0);
    // The warning: 75 % opacity for his last 120 waiting frames (MM-C30).
    const warn = this.phase === 'wait' && this.t > RUSH_WAIT_FRAMES;
    translucent(r, warn ? 0.75 : 1, draw);
  }
}
