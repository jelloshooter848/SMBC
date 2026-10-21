import type { Renderer } from '@engine/gfx/renderer';
import { overlaps, type AABB } from '@engine/math/aabb';
import { px, tileAt } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Explosion } from '../../entities/effects/effects';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { heroSound } from '../classic/sounds';
import { tileDef } from '../../level/tiles';
import {
  BOMB_BLAST_PX,
  BOMB_BOOST_VY,
  BOMB_DAMAGE,
  BOMB_FADE,
  BOMB_FUSE,
  BOMB_HIT,
  BOMB_LIVE,
} from './classic-weapons';

/**
 * Classic SMBC Samus's morph-ball bomb (SA-C27, SA-C28; SamusBomb.as): it hangs where it was laid
 * (no gravity), blinks through its 57-frame fuse, then its 24 x 24 blast is live for 12 frames,
 * hitting each enemy once (400, hit-stun, no armour pierce), striking the blocks in it once, and
 * boosting its owner once (any pose, not while rising); then it fades for 12 frames. Bombs never
 * hurt players.
 */
export class ClassicBomb extends Entity {
  readonly kind = 'samus-bomb';
  /** Frames since it was laid. */
  private t = 0;
  private readonly hit = new Set<number>();
  private boosted = false;
  private readonly cx: number;
  private readonly cy: number;

  /** Centred on (cx, cy) in subpixels. */
  constructor(
    cx: number,
    cy: number,
    readonly owner: Player,
  ) {
    super(cx - px(4), cy - px(4), 8, 8);
    this.cx = cx;
    this.cy = cy;
    this.layer = 'back';
    this.despawnMargin = null;
  }

  /** The blast's square while it is live, else null. */
  get blast(): AABB | null {
    if (this.t <= BOMB_FUSE || this.t > BOMB_FUSE + BOMB_LIVE) return null;
    const r = px(BOMB_BLAST_PX >> 1);
    return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 };
  }

  update(world: World): void {
    this.t++;
    if (this.t === BOMB_FUSE + 1) this.detonate(world);
    const box = this.blast;
    if (box) {
      for (const e of world.enemies) {
        if (this.hit.has(e.id) || !overlaps(box, e.body)) continue;
        this.hit.add(e.id);
        const r = e.hit(
          {
            kind: 'bomb',
            amount: BOMB_DAMAGE,
            owner: this.owner,
            dirX: e.body.x < this.cx ? -1 : 1,
            ...BOMB_HIT,
          },
          world,
        );
        world.scoreKill(e, 'bomb', r);
        if (r === 'hp') world.audio.sfx(heroSound(this.owner.def, 'hit', 'hurt-enemy'));
      }
      const p = this.owner;
      const b = p.body;
      if (!this.boosted && !p.dead && !p.vine && b.vy >= 0 && overlaps(box, b)) {
        // SA-C28: one boost per bomb, in any pose; no soft cut, no somersault.
        this.boosted = true;
        b.vy = -BOMB_BOOST_VY;
        b.onGround = false;
        p.jumpReleased = true;
        p.cutting = false;
        delete p.scratch._takeoff;
      }
    }
    if (this.t > BOMB_FUSE + BOMB_LIVE + BOMB_FADE) this.destroy();
  }

  private detonate(world: World): void {
    const r = px(BOMB_BLAST_PX >> 1);
    world.spawn(new Explosion(this.cx, this.cy, true));
    world.audio.sfx('samus-bomb'); // G-074 (was the shared `bump`)
    // Bricks and blocks in the blast are struck once (classic-bricks-and-shots BR-C13).
    for (let ty = tileAt(this.cy - r); ty <= tileAt(this.cy + r - 1); ty++)
      for (let tx = tileAt(this.cx - r); tx <= tileAt(this.cx + r - 1); tx++) {
        const def = tileDef(world.map.get(tx, ty));
        if (def.block && def.block.kind !== 'hidden')
          world.strikeBlock(tx, ty, this.owner, true, { source: 'blast', damage: BOMB_DAMAGE });
      }
  }

  render(r: Renderer, view: View): void {
    if (this.t > BOMB_FUSE) {
      // The blast ring: steady while live, then blinking out (held under Reduce flashing).
      if (this.t > BOMB_FUSE + BOMB_LIVE && !view.reduceFlashing && (view.frame & 2) === 0) return;
      r.sprite(
        view.assets.sheet('samus', 'samus'),
        'bomb-burst',
        Math.round((this.cx >> 8) - view.camX) - 8,
        Math.round(this.cy >> 8) - 8,
      );
      return;
    }
    // The 4-frame blink (held lit under Reduce flashing).
    const lit = view.reduceFlashing || ((this.t >> 2) & 1) === 0;
    r.sprite(
      view.assets.sheet('samus', 'samus'),
      lit ? 'bomb-0' : 'bomb-1',
      this.screenX(view),
      this.screenY(),
    );
  }
}
