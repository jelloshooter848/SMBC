import type { Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, vel, velToSub } from '@engine/math/units';
import { moveX } from '../../entities/body';
import type { View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import type { EntitySpawn } from '../../level/schema';
import type { Entity } from '../../entities/entity';
import { drawSophia, HIT_PALETTE, LOOK, SOPHIA_SHEET, type Fallback } from './art';

/*
 * The cavern's mutants, side view (section 1, the tank's stage; original designs in Blaster
 * Master's Area 1 style): crawlers that creep along the floor and turn at ledges, hoppers that
 * crouch and leap at the player, and flyers that hover and swoop. They are World entities (the
 * stage's `extraEntities`), hurt by every player attack (the tank's cannon and missiles, Jason's
 * gun) and touched like any enemy: World's own contact rules hurt the player. The `sophia` sheet
 * draws them facing LEFT (flipped for right); a hit flashes them (`sophia-hit`, never with reduce
 * flashing).
 */

/** What hurts a cavern mutant: any attack takes hit points; a star kills; it can't be stomped. */
export const MUTANT_VULNERABILITY: Vulnerability = {
  fireball: 'hp',
  shell: 'hp',
  bump: 'hp',
  sword: 'hp',
  buster: 'hp',
  bomb: 'hp',
  weapon: 'hp',
  lava: 'kill',
  star: 'kill',
  boomerang: 'stun',
  ice: 'stun',
};

abstract class CavernMutant extends Enemy {
  override sheet = SOPHIA_SHEET;
  protected flash = 0;
  protected abstract readonly fallback: Fallback;

  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.vulnerability = { ...MUTANT_VULNERABILITY };
    this.stompable = false;
    this.scores = ENEMY_SCORES.DEFAULT;
  }

  override hit(src: DamageSource, world: World): Reaction {
    const r = super.hit(src, world);
    if (r === 'hp' && this.alive) this.flash = 8;
    return r;
  }

  protected tick(): void {
    if (this.flash > 0) this.flash--;
  }

  override render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    const struck = this.flash > 0 && !view.reduceFlashing;
    if (struck) {
      try {
        const sheet = view.assets.has(SOPHIA_SHEET) ? view.assets.sheet(SOPHIA_SHEET, HIT_PALETTE) : null;
        if (sheet?.frames.has(this.currentFrame)) {
          r.sprite(sheet, this.currentFrame, x, y, this.facing > 0);
          return;
        }
      } catch {
        // no flash palette: drawn plain below
      }
    }
    drawSophia(
      r,
      view.assets,
      this.currentFrame,
      x,
      y,
      16,
      16,
      struck ? LOOK.boom : this.fallback,
      this.facing > 0,
    );
  }
}

/** A crawler's pace (px a frame). */
export const CRAWLER_SPEED = 0.5;

/** A crawler: creeps along the floor, turning at walls and ledges. Two hits. */
export class Crawler extends CavernMutant {
  readonly kind = 'crawler';
  protected readonly fallback = LOOK.blob;
  constructor(x: number, y: number) {
    super(x, y, 14, 10, 2);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 6;
    this.walkSpeed = vel(CRAWLER_SPEED);
    this.body.vx = -this.walkSpeed;
    this.fallsOffLedges = false;
    this.currentFrame = 'crawler-0';
  }
  update(world: World): void {
    this.tick();
    this.patrol(world);
    this.currentFrame = `crawler-${(world.frame >> 4) & 1}`;
  }
}

/** A hopper: rests HOPPER_REST frames crouched, then leaps at the player when within HOPPER_RANGE. */
export const HOPPER_REST = 50;
export const HOPPER_RANGE = 96;
export const HOPPER_JUMP = vel(3.25);
export const HOPPER_RUN = vel(1);

/** A hopper: crouches, then leaps at the player (when near), and crouches again where it lands. Two hits. */
export class Hopper extends CavernMutant {
  readonly kind = 'hopper';
  protected readonly fallback = LOOK.fred;
  private rest = HOPPER_REST;
  constructor(x: number, y: number) {
    super(x, y, 14, 14, 2);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.body.vx = 0;
    this.currentFrame = 'hopper-0';
  }
  update(world: World): void {
    this.tick();
    const b = this.body;
    const p = world.player;
    if (b.onGround) {
      b.vx = 0;
      this.facing = p.centerX > b.x + (b.w >> 1) ? 1 : -1;
      const near = Math.abs(p.centerX - (b.x + (b.w >> 1))) < px(HOPPER_RANGE) && !p.dead;
      if (this.rest > 0) this.rest--;
      else if (near) {
        b.vy = -HOPPER_JUMP;
        b.vx = this.facing * HOPPER_RUN;
        b.onGround = false;
        this.rest = HOPPER_REST;
      }
    }
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) b.vx = 0;
    this.fall(world);
    this.currentFrame = b.onGround ? 'hopper-0' : 'hopper-1';
  }
}

/** A flyer hovers until the player is within FLYER_RANGE, then swoops (FLYER_SWOOP frames) and climbs back. */
export const FLYER_RANGE = 112;
export const FLYER_SWOOP = 70;
export const FLYER_SPEED = 1.25;

/** A flyer: bobs at its post, swoops at where the player is, climbs back up, and again. One hit. */
export class Flyer extends CavernMutant {
  readonly kind = 'flyer';
  protected readonly fallback = LOOK.eye;
  private readonly homeY: number;
  private t = 0;
  /** Frames into a swoop (0: hovering), and where it is headed. */
  swoopT = 0;
  private dx = 0;
  private dy = 0;
  constructor(x: number, y: number) {
    super(x, y, 14, 10, 1);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 3;
    this.homeY = y;
    this.currentFrame = 'flyer-0';
  }
  update(world: World): void {
    this.tick();
    this.t++;
    const b = this.body;
    const p = world.player;
    if (this.swoopT > 0) {
      this.swoopT++;
      if (this.swoopT > FLYER_SWOOP) {
        // Back up to its height.
        b.y += b.y > this.homeY ? -px(1) : 0;
        if (b.y <= this.homeY) this.swoopT = 0;
      } else {
        b.x += Math.round(this.dx);
        b.y += Math.round(this.dy);
      }
    } else {
      b.y = this.homeY + px(Math.round(Math.sin(this.t / 10) * 3));
      const cx = b.x + (b.w >> 1);
      if (!p.dead && Math.abs(p.centerX - cx) < px(FLYER_RANGE) && this.t > 30) {
        const tx = p.centerX - cx;
        const ty = p.body.y + (p.body.h >> 1) - (b.y + (b.h >> 1));
        const d = Math.hypot(tx, ty) || 1;
        this.dx = (tx / d) * px(FLYER_SPEED);
        this.dy = (ty / d) * px(FLYER_SPEED);
        this.swoopT = 1;
        this.t = 0;
      }
    }
    this.facing = p.centerX > b.x + (b.w >> 1) ? 1 : -1;
    this.currentFrame = `flyer-${(world.frame >> 3) & 1}`;
  }
}

/**
 * World's `extraEntities` for the cavern: `crawler x y`, `hopper x y` (the tile its feet stand
 * in) and `flyer x y` (where it hovers).
 */
export function cavernEntities(s: EntitySpawn): Entity | undefined {
  const x = tileToSub(s.x);
  const feet = tileToSub(s.y + 1);
  switch (s.type) {
    case 'crawler':
      return new Crawler(x + px(1), feet - px(10));
    case 'hopper':
      return new Hopper(x + px(1), feet - px(14));
    case 'flyer':
      return new Flyer(x + px(1), tileToSub(s.y) + px(3));
    default:
      return undefined;
  }
}
