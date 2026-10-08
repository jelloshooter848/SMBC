import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { moveX } from '../body';
import { BUMP_POP_GRAVITY, BUMP_POP_VY } from '../enemies/enemy';
import type { World } from '../../world/world';

/**
 * `poison` (Lost Levels) slides like a mushroom but hurts on touch; `clock` (Lost Levels) stays
 * on its block like a flower and adds time (both handled in World.collisions).
 */
export type PowerUpKind = 'mushroom' | '1up' | 'flower' | 'star' | 'poison' | 'clock';

/** The kinds that are the original's Mushroom (red, ST_GREEN and ST_POISON), with its gBounceHit. */
const MUSHROOMS: ReadonlySet<PowerUpKind> = new Set(['mushroom', '1up', 'poison']);

/** A hatched item's hop (PowerUp.hopOut), as a bumped mushroom's pop. */
const HOP_VY = BUMP_POP_VY;

/** An item rising out of a block, then behaving per kind. */
export class PowerUp extends Entity {
  readonly kind = 'powerup';
  private emerging = 32;
  /** Popped up by a bumped block: falls with the bounce gravity until it lands. */
  private bounced = false;
  private readonly targetY: number;

  constructor(
    tx: number,
    ty: number,
    readonly item: PowerUpKind,
  ) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 16);
    this.targetY = px((ty - 1) * 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
    this.body.vx = 0;
  }

  /**
   * An item already out (no rise from a block) hopping up from feet at (`cx`, `feet`) (subpixels,
   * its body centred on `cx`), then behaving per kind: the 1-up hatched from a Yoshi egg
   * (objects/yoshi-egg.ts) hops out and runs off to the right like any mushroom.
   */
  static hopOut(cx: number, feet: number, item: PowerUpKind): PowerUp {
    const p = new PowerUp(0, 0, item);
    p.emerging = 0;
    p.layer = 'main';
    p.body.x = cx - (p.body.w >> 1);
    p.body.y = feet - p.body.h;
    p.body.vx = item === 'flower' || item === 'clock' ? 0 : 0x01000;
    p.body.vy = -HOP_VY;
    p.bounced = true;
    return p;
  }

  /** Out of its block (not still rising): it can be touched and taken. */
  get out(): boolean {
    return this.emerging === 0;
  }

  /**
   * The block under it was bumped (Brick.hitObjectsAbove, on a bounce or a break). Mushroom.gBounceHit
   * pops it up with the same BOUNCE_AMT (350 px/s = 2.92 px/f) and BOUNCE_GRAVITY (1500 px/s² =
   * 0.208 px/f²) as KoopaGreen's, that gravity lasting until it lands (Mushroom.groundBelow puts
   * its fall gravity back), and turns it round when its middle is left of the block's
   * (`if (nx < g.hMidX) vx = -vx`). Star, FireFlower and the Clock (a plain Pickup) have no
   * gBounceHit, so they ignore the bump.
   */
  bounceHit(blockMidX: number): void {
    if (this.emerging > 0 || !MUSHROOMS.has(this.item)) return;
    const b = this.body;
    b.vy = -BUMP_POP_VY;
    b.onGround = false;
    this.bounced = true;
    if (b.x + (b.w >> 1) < blockMidX) b.vx = -b.vx;
  }

  update(world: World): void {
    const b = this.body;
    if (this.emerging > 0) {
      this.emerging--;
      b.y -= px(16) / 32;
      if (this.emerging === 0) {
        b.y = this.targetY;
        this.layer = 'main';
        if (this.item !== 'flower' && this.item !== 'clock') b.vx = 0x01000;
        if (this.item === 'star') b.vy = -0x04000;
      }
      return;
    }
    // The original's Clock (pickups/Clock.as) is a plain Pickup: it rises out of the block and
    // stays there (defyGrav, vy = 0 in Pickup.exitBrickEnd), like the flower.
    if (this.item === 'flower' || this.item === 'clock') return;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) b.vx = -b.hitWall * 0x01000;
    this.fall(world, this.item === 'star' ? 0x00300 : this.bounced ? BUMP_POP_GRAVITY : undefined);
    if (b.onGround) this.bounced = false;
    if (this.item === 'star' && b.onGround) b.vy = -0x04000;
    if (this.isBelowLevel()) this.destroy();
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    let frame: string = this.item;
    if (this.item === 'flower') frame = `flower-${(view.frame >> 3) & 1}`;
    if (this.item === 'star') frame = `star-${(view.frame >> 2) & 3}`;
    if (this.item === 'poison') frame = 'poison-mushroom';
    r.sprite(sheet, frame, this.screenX(view), this.screenY());
  }
}
