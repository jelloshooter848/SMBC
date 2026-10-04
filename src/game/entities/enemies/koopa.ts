import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { World } from '../../world/world';
import type { DamageSource, Reaction } from '../../rules/damage';
import { moveX } from '../body';

export const SHELL_SPEED = 0x03000; // 3 px/f
const SHELL_IDLE_FRAMES = 300;
const SHELL_WIGGLE_FRAMES = 90;
/** Red paratroopas bob this far above and below their spawn height, once per period. */
const PARA_AMPLITUDE = 48; // px
const PARA_PERIOD = 192; // frames
const PARA_HOP = 0x03800; // 3.5 px/f take-off for hopping green paratroopas

export type KoopaState = 'walk' | 'shell' | 'shell-moving' | 'wiggle';

/**
 * Koopa Troopa: green ones walk off ledges, red ones turn at them; stomping makes a kickable
 * shell. With wings it is a Paratroopa: red ones fly up and down around their spawn point,
 * green ones hop forward, and a stomp only clips the wings.
 */
export class Koopa extends Enemy {
  readonly kind = 'koopa';
  state: KoopaState = 'walk';
  wings: boolean;
  private readonly homeY: number;
  private flyT = 0;
  private shellTimer = 0;
  /** Kills by a moving shell chain for combo scoring. */
  shellCombo = 0;
  readonly color: 'green' | 'red';

  constructor(x: number, y: number, color: 'green' | 'red' = 'green', wings = false) {
    super(x, y, 12, 22);
    this.color = color;
    this.wings = wings;
    this.homeY = y;
    if (wings && color === 'red') this.body.vx = 0;
    this.fallsOffLedges = color === 'green';
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'koopa-0';
    this.vulnerability = { ...this.vulnerability, stomp: 'shell' };
  }

  override palette(): string {
    return this.color === 'red' ? 'koopa-red' : 'koopa-green';
  }

  get isMovingShell(): boolean {
    return this.state === 'shell-moving';
  }

  /** A boomerang only stuns a walking koopa; shells just deflect it. */
  override hit(src: DamageSource, world: World): Reaction {
    if ((src.kind === 'boomerang' || src.kind === 'ice') && this.state !== 'walk') return 'immune';
    return super.hit(src, world);
  }

  private becomeShell(): void {
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(14);
    b.y = bottom - b.h;
    b.vx = 0;
    this.state = 'shell';
    this.shellTimer = SHELL_IDLE_FRAMES;
    this.contactHurts = false;
    this.spriteOffsetY = 2;
    this.currentFrame = 'shell';
  }

  private standUp(): void {
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(22);
    b.y = bottom - b.h;
    this.state = 'walk';
    this.contactHurts = true;
    this.fallsOffLedges = this.color === 'green';
    b.vx = -this.walkSpeed;
    this.spriteOffsetY = 2;
  }

  /** Kick the shell away from the kicker. */
  kick(dirX: -1 | 1, world: World): void {
    this.state = 'shell-moving';
    this.body.vx = dirX * SHELL_SPEED;
    this.contactHurts = true;
    this.shellCombo = 0;
    this.fallsOffLedges = true;
    // Nudge out of the kicker so the first frame doesn't re-collide.
    this.body.x += dirX * px(4);
    world.audio.sfx('kick');
  }

  stopShell(): void {
    this.state = 'shell';
    this.body.vx = 0;
    this.contactHurts = false;
    this.shellTimer = SHELL_IDLE_FRAMES;
  }

  protected override onShell(_src: DamageSource, world: World): void {
    if (this.wings) {
      this.wings = false;
      this.body.vy = 0;
      this.body.vx = -this.walkSpeed;
      world.audio.sfx('stomp');
      return;
    }
    if (this.state === 'walk' || this.state === 'wiggle') {
      this.becomeShell();
      world.audio.sfx('stomp');
    } else if (this.state === 'shell-moving') {
      this.stopShell();
      world.audio.sfx('stomp');
    } else {
      // Stomping a resting shell kicks it in the direction the player faces away from.
      const pl = world.nearestPlayer(this.body.x).body;
      const dir: -1 | 1 = pl.x + pl.w / 2 < this.body.x + this.body.w / 2 ? 1 : -1;
      this.kick(dir, world);
    }
  }

  update(world: World): void {
    switch (this.state) {
      case 'walk':
        if (this.wings) this.fly(world);
        else this.patrol(world);
        this.currentFrame = `${this.wings ? 'koopa-fly' : 'koopa'}-${(world.frame >> 3) & 1}`;
        break;
      case 'shell':
        this.fall(world);
        if (--this.shellTimer <= 0) {
          this.state = 'wiggle';
          this.shellTimer = SHELL_WIGGLE_FRAMES;
        }
        this.currentFrame = 'shell';
        break;
      case 'wiggle':
        this.fall(world);
        this.currentFrame = (world.frame >> 2) & 1 ? 'shell-wiggle' : 'shell';
        if (--this.shellTimer <= 0) this.standUp();
        break;
      case 'shell-moving': {
        const b = this.body;
        moveX(b, world.map, velToSub(b.vx));
        if (b.hitWall !== 0) {
          b.vx = -b.hitWall * SHELL_SPEED;
          world.audio.sfx('bump');
        }
        this.fall(world);
        this.currentFrame = 'shell';
        this.facing = b.vx > 0 ? 1 : -1;
        break;
      }
    }
    if (this.isBelowLevel()) this.destroy();
  }

  private fly(world: World): void {
    const b = this.body;
    if (this.color === 'red') {
      // Bob vertically through the air, ignoring tiles, facing the nearest player.
      this.flyT++;
      b.y = this.homeY + px(Math.round(Math.sin((this.flyT * Math.PI * 2) / PARA_PERIOD) * PARA_AMPLITUDE));
      b.vy = 0;
      const pl = world.nearestPlayer(b.x).body;
      this.facing = pl.x + pl.w / 2 < b.x + b.w / 2 ? -1 : 1;
      return;
    }
    // Green: patrol, and hop again as soon as it lands.
    this.patrol(world);
    if (b.onGround) {
      b.vy = -PARA_HOP;
      b.onGround = false;
    }
  }

  /** A moving shell hitting another enemy. */
  shellDamage(): DamageSource {
    return { kind: 'shell', amount: 1, owner: this, dirX: this.body.vx > 0 ? 1 : -1 };
  }

  get bottomRow(): number {
    return toPx(this.body.y + this.body.h) >> 4;
  }
}
