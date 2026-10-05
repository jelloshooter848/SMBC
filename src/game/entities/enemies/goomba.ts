import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';

export class Goomba extends Enemy {
  readonly kind = 'goomba';
  constructor(x: number, y: number) {
    super(x, y, 12, 14);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'goomba-0';
    this.scores = ENEMY_SCORES.GOOMBA;
  }

  update(world: World): void {
    if (this.dying > 0) {
      if (--this.dying === 0) this.destroy();
      return;
    }
    this.patrol(world);
    this.currentFrame = `goomba-${(world.frame >> 3) & 1}`;
    if (this.isBelowLevel()) this.destroy();
  }

  protected override squash(world: World): void {
    this.dying = 30;
    this.currentFrame = 'goomba-squash';
    this.contactHurts = false;
    this.stompable = false;
    this.body.vx = 0;
    world.audio.sfx('stomp');
  }
}
