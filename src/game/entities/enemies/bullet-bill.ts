import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

export const BULLET_SPEED = 0x01400; // 1.25 px/f
const FIRE_MIN = 150;
const FIRE_SPREAD = 120;

/** Bullet Bill: flies straight through everything. Fireballs bounce off; a stomp drops it. */
export class BulletBill extends Enemy {
  readonly kind = 'bullet-bill';

  constructor(x: number, y: number, dir: -1 | 1) {
    super(x, y, 14, 12);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.currentFrame = 'bullet';
    this.scores = ENEMY_SCORES.BULLET_BILL;
    this.layer = 'front';
    this.activated = true;
    this.despawnMargin = 32;
    this.facing = dir;
    this.body.vx = dir * BULLET_SPEED;
    this.vulnerability = { ...this.vulnerability, fireball: 'immune', boomerang: 'immune', ice: 'immune' };
  }

  update(world: World): void {
    const b = this.body;
    b.x += velToSub(b.vx);
    if (b.x > world.camera.right + px(32) || b.x + b.w < world.camera.x - px(32)) this.destroy();
  }

  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }
}

/** Sits on a blaster barrel tile and fires Bullet Bills at the nearest player now and then. */
export class BulletLauncher extends Entity {
  readonly kind = 'bullet-launcher';
  private timer: number;

  constructor(
    readonly tx: number,
    readonly ty: number,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
    this.timer = 60 + ((tx * 37) % 90);
  }

  update(world: World): void {
    if (--this.timer > 0) return;
    this.timer = FIRE_MIN + world.rng.int(FIRE_SPREAD);
    const cam = world.camera;
    const b = this.body;
    // Only while the barrel is on screen (give or take a tile).
    if (b.x + b.w < cam.x - px(16) || b.x > cam.right + px(16)) return;
    const pl = world.nearestPlayer(b.x + px(8));
    const dx = pl.centerX - (b.x + px(8));
    // No point-blank shots: SMB1 holds fire while you stand next to (or on) the cannon.
    if (Math.abs(dx) <= px(32)) return;
    const dir: -1 | 1 = dx < 0 ? -1 : 1;
    const x = dir < 0 ? b.x - px(14) : b.x + px(16);
    world.spawn(new BulletBill(x, b.y + px(2), dir));
    world.audio.sfx('kick');
  }

  render(_r: Renderer, _view: View): void {}
}
