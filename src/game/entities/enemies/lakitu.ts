import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { Spiny } from './spiny';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

const MAX_SPEED = 0x02c00; // a little faster than a running player
const ACCEL = 0x00100;
const MAX_SPINIES = 3;
const RESPAWN_FRAMES = 420;

/**
 * Lakitu: rides a cloud along the top of the screen, swinging back and forth over the player,
 * and lobs spiny eggs. Leaves once the player reaches the end of its stretch.
 */
export class Lakitu extends Enemy {
  readonly kind = 'lakitu';
  private t = 0;
  private throwTimer = 90;
  private arm = 0;
  leaving = false;

  constructor(x: number, y: number) {
    super(x, y, 12, 20);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.scoreValue = 800;
    this.currentFrame = 'lakitu-0';
    this.layer = 'front';
    this.despawnMargin = null;
    this.activated = true;
    this.body.vx = 0;
  }

  update(world: World): void {
    const b = this.body;
    this.t++;
    const cam = world.camera;
    if (this.leaving) {
      b.vx = Math.min(MAX_SPEED, b.vx + ACCEL);
      b.x += velToSub(b.vx);
      if (b.x > cam.right + px(32)) this.destroy();
      return;
    }
    const pl = world.nearestPlayer(b.x);
    // Swing around a point a little ahead of the player, staying on screen.
    const swing = Math.round(Math.sin((this.t * Math.PI * 2) / 240) * 72);
    let target = pl.centerX + px(16 + swing);
    target = Math.max(cam.x + px(16), Math.min(cam.right - px(32), target));
    // Steer toward a speed that closes the gap in about half a second, so it eases in
    // instead of overshooting; never leave the screen.
    const want = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, Math.round((target - b.x) / 2)));
    if (b.vx < want) b.vx = Math.min(want, b.vx + ACCEL * 2);
    else b.vx = Math.max(want, b.vx - ACCEL * 2);
    b.x += velToSub(b.vx);
    b.x = Math.max(cam.x, Math.min(cam.right - px(16), b.x));
    this.facing = pl.centerX < b.x + b.w / 2 ? -1 : 1;

    if (this.arm > 0) this.arm--;
    if (--this.throwTimer <= 0) {
      this.throwTimer = 110 + world.rng.int(80);
      let spinies = 0;
      for (const e of world.entities) if (e instanceof Spiny && e.alive) spinies++;
      if (spinies < MAX_SPINIES) {
        const egg = new Spiny(b.x, b.y - px(8));
        egg.body.vx = this.facing * 0x00800;
        egg.body.vy = -0x03000;
        world.spawn(egg);
        this.arm = 16;
      }
    }
    this.currentFrame = this.arm > 0 ? 'lakitu-1' : 'lakitu-0';
  }

  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }
}

/**
 * Keeps a Lakitu over a stretch of level: sends one in from the right when the stretch starts,
 * sends a new one a while after it is defeated, and calls it off at column `end`.
 */
export class LakituZone extends Entity {
  readonly kind = 'lakitu-zone';
  private lakitu: Lakitu | null = null;
  private respawn = 0;
  private done = false;
  private readonly flyY: number;

  constructor(
    tx: number,
    ty: number,
    private readonly endCol: number,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    // Fly just under the HUD (it covers the top 32 px).
    this.flyY = Math.max(40, ty * 16 + 24);
    this.despawnMargin = null;
    this.body.vx = 0;
  }

  get current(): Lakitu | null {
    return this.lakitu;
  }

  update(world: World): void {
    if (this.done) return;
    const lead = world.nearestPlayer(world.camera.right);
    if (lead.body.x + lead.body.w >= px(this.endCol * 16)) {
      if (this.lakitu?.alive) this.lakitu.leaving = true;
      this.done = true;
      return;
    }
    if (this.lakitu?.alive) return;
    if (this.lakitu && --this.respawn > 0) return;
    const l = new Lakitu(world.camera.right - px(8), px(this.flyY));
    l.body.vx = -MAX_SPEED;
    this.lakitu = l;
    this.respawn = RESPAWN_FRAMES;
    world.spawn(l);
  }

  render(_r: Renderer, _view: View): void {}
}
