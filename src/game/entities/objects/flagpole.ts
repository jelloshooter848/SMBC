import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { flagPoleScore } from '../../rules/score';

/**
 * Height (px) of the pole the grab score is measured against: the original's hit box, TILE_SIZE*9.3
 * up from the base block (FlagPole.as initiate(), the commented-out `hRect.height = TILE_SIZE*9.3`;
 * the live box comes from the pole graphic), so the shaft and the bottom of the ball. Every pole
 * stands on the same rows, as in the original.
 */
const POLE_SCORE_HEIGHT = 9.3 * 16;

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
  /** Flag top before it is lowered (px). */
  readonly flagTopY: number;

  constructor(
    readonly tx: number,
    ballRow: number,
    baseRow: number,
  ) {
    super(px(tx * 16 + 7), px(ballRow * 16), 2, (baseRow - ballRow) * 16);
    this.topY = ballRow * 16;
    this.baseY = baseRow * 16;
    this.flagY = (ballRow + 1) * 16;
    this.flagTopY = this.flagY;
    this.layer = 'back';
    this.despawnMargin = null;
  }

  /** Lowest flag top: resting just above the base block. */
  get flagStopY(): number {
    return this.baseY - 16;
  }

  /** Slide the flag down; returns true once it reaches the base. */
  lowerFlag(speed = 2): boolean {
    this.flagY = Math.min(this.flagY + speed, this.flagStopY);
    return this.flagY >= this.flagStopY;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), 'flag', this.tx * 16 - 8 - view.camX, this.flagY);
  }

  /**
   * Points for a grab whose vertical middle is at `midYPx`, measured against the pole's height
   * from the bottom (FlagPole.touchPlayer with ScoreValue.FLAG_POLE_HEIGHT_1..5).
   */
  scoreForGrab(midYPx: number): number {
    return flagPoleScore(midYPx, this.baseY - POLE_SCORE_HEIGHT, this.baseY);
  }

  /**
   * Top of the grab's score text (px). FlagPole.updateStats mirrors it to the flag about the
   * middle of the flag's run: it starts where the flag stops and rises as the flag drops, ending
   * where the flag started.
   */
  get scoreTextY(): number {
    return this.flagTopY + this.flagStopY - this.flagY;
  }

  get grabX(): number {
    return toPx(this.body.x);
  }

  /** Right edge of the shaft (px), where the score text sits (the original's hRht). */
  get rightPx(): number {
    return toPx(this.body.x + this.body.w);
  }
}

/** The flagpole grab's score: follows the pole's mirrored flag height and stays up until the level ends. */
export class FlagScore extends Entity {
  readonly kind = 'flag-score';
  constructor(
    readonly pole: Flagpole,
    readonly text: string,
  ) {
    super(px(pole.rightPx), px(pole.scoreTextY), 1, 1);
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    r.text(view.assets.sheet('font'), this.text, this.pole.rightPx - view.camX, this.pole.scoreTextY);
  }
}
