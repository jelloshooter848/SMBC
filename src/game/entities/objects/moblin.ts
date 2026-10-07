import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/** How close (px, centre to centre) a player on the ground comes before the Moblin sees him. */
export const MOBLIN_REACH_PX = 56;
/** Frames the Moblin stands startled (his "...!") before his cards start. */
export const MOBLIN_STARTLE_FRAMES = 30;

/**
 * The friendly Moblin hiding in 2-1's cave past its castle (`moblin x y secret=bonus-2
 * next=2-2-intro`, 0.4.10; docs/WORLD_MAP.md "The Top Secret Area"). A Zelda-style pig-faced
 * spearman in original art, 16x24, standing on the tile below (x, y), facing the way in. He
 * breathes slowly (`moblin-0/1`); the first time a player on the ground comes within reach he
 * jumps with surprise (`moblin-surprised`), everyone stops where they are, and a moment later he
 * raises one `moblin` event: the level plays his cards and ends (scenes/level.ts; campaign: 2-1
 * cleared and `secret` found).
 * Scenery: no collision, never despawns.
 */
export class Moblin extends Entity {
  readonly kind = 'moblin';
  private t = 0;
  /** Frames since he saw a player (-1: not yet). */
  private startled = -1;
  private seenBy = 0;
  /** The `moblin` event has been raised. */
  told = false;

  constructor(
    tx: number,
    ty: number,
    readonly secret: string,
    readonly next: string | null,
  ) {
    super(px(tx * 16), px((ty + 1) * 16 - 24), 16, 24);
    this.layer = 'back';
    this.despawnMargin = null;
    this.facing = -1;
  }

  /** He has seen a player (his surprise is showing or over). */
  get surprised(): boolean {
    return this.startled >= 0;
  }

  update(world: World): void {
    this.t++;
    const cx = toPx(this.body.x) + 8;
    if (this.startled < 0) {
      const players = world.activePlayers();
      const p = players.find((q) => q.body.onGround && Math.abs(toPx(q.centerX) - cx) <= MOBLIN_REACH_PX);
      if (!p) return;
      this.startled = 0;
      this.seenBy = world.players.indexOf(p);
      this.facing = toPx(p.centerX) < cx ? -1 : 1;
      world.audio.sfx('bump');
      // Everyone stops where they are: the Moblin has something to say.
      for (const q of world.players) {
        q.frozen = true;
        q.body.vx = 0;
        q.anim = 'idle';
      }
      return;
    }
    this.startled++;
    if (this.startled >= MOBLIN_STARTLE_FRAMES && !this.told) {
      this.told = true;
      world.events.push({ type: 'moblin', player: this.seenBy, secret: this.secret, next: this.next });
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('items');
    let frame = (this.t >> 5) & 1 ? 'moblin-1' : 'moblin-0';
    let lift = 0;
    if (this.startled >= 0) {
      frame = 'moblin-surprised';
      // A little jump of surprise: up 4 px and back down over his first 12 frames.
      if (this.startled < 12) lift = this.startled < 6 ? this.startled : 12 - this.startled;
    }
    // The frames face LEFT; flipped when he turns to a player on his right.
    r.sprite(sheet, frame, toPx(this.body.x) - view.camX, toPx(this.body.y) - lift, this.facing > 0);
  }
}

/**
 * A cave fire (Zelda-style, beside the Moblin): two flickering frames, slower with reduce
 * flashing. Scenery: no collision.
 */
export class CaveFire extends Entity {
  readonly kind = 'cave-fire';
  private t = 0;

  constructor(tx: number, ty: number) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  update(): void {
    this.t++;
  }

  render(r: Renderer, view: View): void {
    const step = view.reduceFlashing ? 16 : 8;
    const frame = Math.floor(this.t / step) & 1 ? 'cave-fire-1' : 'cave-fire-0';
    r.sprite(view.assets.sheet('items'), frame, toPx(this.body.x) - view.camX, toPx(this.body.y));
  }
}
