import { px, tileToSub } from '@engine/math/units';
import type { LevelData } from '../level/schema';
import { Bowser } from '../entities/enemies/bowser';
import { Projectile, BOWSER_FLAME } from '../entities/projectiles/projectile';
import type { Player } from '../entities/player';
import type { World } from './world';

/** Frames from reaching the column to the first flame (the original's 450 ms fire delay). */
const FIRST_FLAME = 27;
/** Gap between flames: the original's 1500-3500 ms fire timer. */
const GAP_MIN = 90;
const GAP_RANGE = 120;
/** Bowser.MAX_FIREBALLS_ON_SCREEN in the original. */
const MAX_FLAMES = 2;

/**
 * Bowser's long-range flames (the `bowser-fire` zone, the original's `bowserFireBallStart`).
 *
 * From the zone's column on, while the castle's Bowser is still off screen, his flames fly in
 * from just past the right edge of the screen at one of three heights: the rows around his
 * mouth (Bowser.as fbLev1-3, half a tile to two and a half tiles above his feet; the NES's
 * FlameYPosData picks the same three rows). Level.as starts Bowser's fire timer for this
 * whether or not he breathes fire himself (the off-screen branch ignores shootFireballs), so a
 * hammer-only Bowser sends flames too. It stops while he is on screen (his own attack takes
 * over) and for good once he is gone; a fake Bowser (Level.bowser skips BowserFake) has none.
 */
export class BowserFire {
  private timer = FIRST_FLAME;
  /** The real Bowser has been spawned (so not finding him later means he is gone). */
  private seen = false;

  private constructor(
    /** Column the lead player must reach. */
    private readonly x: number,
    /** Bowser's spawn row: his feet are on the bottom of this row. */
    private readonly row: number,
  ) {}

  /** The level's long-range flames, or null when it has no zone or no real Bowser. */
  static forLevel(level: LevelData): BowserFire | null {
    const zone = level.zones.find((z) => z.kind === 'bowser-fire');
    const bowser = level.entities.find((e) => e.type === 'bowser' && !e.props?.fake);
    return zone && bowser ? new BowserFire(zone.x, bowser.y) : null;
  }

  update(world: World, lead: Player): void {
    if (lead.body.x < tileToSub(this.x)) return;
    const bowser = world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake && e.alive);
    if (bowser) {
      this.seen = true;
      const b = bowser.body;
      if (b.x + b.w > world.camera.x && b.x < world.camera.right) return;
    } else if (this.seen) return; // spawned and since defeated (or left behind)
    if (--this.timer > 0) return;
    this.timer = GAP_MIN + world.rng.int(GAP_RANGE);
    let flames = 0;
    for (const e of world.entities)
      if (e instanceof Projectile && e.kind === BOWSER_FLAME.kind && e.alive) flames++;
    if (flames >= MAX_FLAMES) return;
    // Centred on the row of his feet, or one or two rows above (the flame is 8 px tall).
    const y = px((this.row - world.rng.int(3)) * 16 + 4);
    world.spawn(new Projectile(world.camera.right, y, -1, BOWSER_FLAME, bowser ?? null));
    world.audio.sfx('bowser-flame');
  }
}
