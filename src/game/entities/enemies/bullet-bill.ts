import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/** `BulletBill.SPEED` = 170 px/s on the original's 32-px tiles: 85 px/s here, 1.42 px/f. */
export const BULLET_SPEED = 0x016ab;
/** `Canon.SHOOT_TMR_DUR_MIN/MAX` = 1000-3500 ms: 60-209 frames, before every shot attempt. */
const FIRE_MIN = 60;
const FIRE_SPREAD = 150;
/** `Canon.MAX_BULLET_BILLS`: blaster bills alive in the whole level at once (`Canon.BILL_DCT`). */
const MAX_BLASTER_BILLS = 2;

/** Bullet Bill: flies straight through everything. Fireballs bounce off; a stomp drops it. */
export class BulletBill extends Enemy {
  readonly kind = 'bullet-bill';
  /** Fired by a blaster (counts towards `Canon.BILL_DCT`'s limit of two). */
  fromBlaster = false;

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

/**
 * Sits on a blaster barrel tile and fires Bullet Bills at the nearest player now and then
 * (`com/smbc/ground/Canon.as`: a random 1.0-3.5 s timer before the first shot and after every
 * attempt; an attempt is skipped while two blaster bills are out or the player is close).
 */
export class BulletLauncher extends Entity {
  readonly kind = 'bullet-launcher';
  /** Frames to the next shot attempt; 0 until the first update draws it (`Canon.initiate`). */
  private timer = 0;

  constructor(
    readonly tx: number,
    readonly ty: number,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
  }

  update(world: World): void {
    if (this.timer === 0) this.timer = FIRE_MIN + world.rng.int(FIRE_SPREAD);
    if (--this.timer > 0) return;
    this.timer = FIRE_MIN + world.rng.int(FIRE_SPREAD);
    let out = 0;
    for (const e of world.entities) if (e instanceof BulletBill && e.alive && e.fromBlaster) out++;
    if (out >= MAX_BLASTER_BILLS) return;
    const cam = world.camera;
    const b = this.body;
    // Only while the barrel is on screen (give or take a tile).
    if (b.x + b.w < cam.x - px(16) || b.x > cam.right + px(16)) return;
    const pl = world.nearestPlayer(b.x + px(8));
    const dx = pl.centerX - (b.x + px(8));
    // No point-blank shots: holds fire while you are within 2 tiles (`Canon.STOP_SHOOT_DIST`).
    if (Math.abs(dx) <= px(32)) return;
    const dir: -1 | 1 = dx < 0 ? -1 : 1;
    const x = dir < 0 ? b.x - px(14) : b.x + px(16);
    const bill = new BulletBill(x, b.y + px(2), dir);
    bill.fromBlaster = true;
    world.spawn(bill);
    world.audio.sfx('kick');
  }

  render(_r: Renderer, _view: View): void {}
}
