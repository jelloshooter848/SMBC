import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';

/**
 * The goal pole. Its body is a thin column over the whole shaft so touching it anywhere
 * triggers the level-clear sequence. It also owns the flag that slides down.
 */
export class Flagpole extends Entity {
  readonly kind = 'flagpole';
  /** Flag top in px. */
  flagY: number;
  readonly baseY: number; // px: top of the base block
  readonly topY: number; // px: top of the shaft (ball row)

  constructor(
    readonly tx: number,
    ballRow: number,
    baseRow: number,
  ) {
    super(px(tx * 16 + 7), px(ballRow * 16), 2, (baseRow - ballRow) * 16);
    this.topY = ballRow * 16;
    this.baseY = baseRow * 16;
    this.flagY = (ballRow + 1) * 16;
    this.layer = 'back';
    this.despawnMargin = null;
  }

  /** Slide the flag down; returns true once it reaches the base. */
  lowerFlag(speed = 2): boolean {
    this.flagY = Math.min(this.flagY + speed, this.baseY - 16);
    return this.flagY >= this.baseY - 16;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), 'flag', this.tx * 16 - 8 - view.camX, this.flagY);
  }

  /** Score tier for the player's foot height at contact (SMB1: 100/400/800/2000/5000). */
  scoreForFeet(feetPx: number): number {
    const fromBase = this.baseY - feetPx; // px above the base block
    if (fromBase >= 10 * 16 - 8) return 5000;
    if (fromBase >= 7 * 16) return 2000;
    if (fromBase >= 4 * 16) return 800;
    if (fromBase >= 2 * 16) return 400;
    return 100;
  }

  get grabX(): number {
    return toPx(this.body.x);
  }
}
