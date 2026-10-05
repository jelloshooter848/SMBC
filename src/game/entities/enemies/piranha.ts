import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';
import type { Theme } from '../../level/schema';

const HEIGHT = 24;
const RISE_FRAMES = 32;
const HOLD_FRAMES = 60;
const HIDDEN_FRAMES = 60;
/**
 * It stays in its pipe while the player's centre is closer than this to the pipe's centre
 * (exclusive). The original (PiranhaGreen.as) uses ±2 tiles; PiranhaRed.as narrows it to ±1.4
 * tiles, so a red plant comes out with the player much closer. Everything else is shared.
 */
export const HIDE_RADIUS_GREEN = px(32);
export const HIDE_RADIUS_RED = Math.round(px(16 * 1.4)); // 22.4 px

/** Palette for a plant's colour: red or green in every area theme, like the turtles. */
export function piranhaPalette(red: boolean): string {
  return red ? 'piranha-red' : 'piranha-green';
}

/**
 * Lives in a pipe at (tx, ty) = the pipe's top-left tile. Won't come out while the player is close.
 * With `hanging` (The Lost Levels' upside-down piranha) the pipe hangs from the ceiling and
 * (tx, ty) is its bottom-left rim tile: the plant comes out of the rim's bottom edge, head down,
 * on the same timings. It hangs above the player, so it can't be stomped; touching it hurts.
 */
export class Piranha extends Enemy {
  readonly kind = 'piranha';
  private phase: 'hidden' | 'rising' | 'up' | 'sinking' = 'hidden';
  private t = HIDDEN_FRAMES;
  /** Subpixels: y of the pipe opening (the top edge, or the bottom edge when hanging). */
  private readonly mouthY: number;
  private readonly centerX: number; // subpixels
  private readonly pipeLeft: number; // subpixels: the pipe is 32 px wide from here

  constructor(
    tx: number,
    ty: number,
    readonly hanging = false,
    readonly red = false,
  ) {
    // Centred on the 32px pipe (the original's shiftRight): sprite at +8, 12px hitbox at +10.
    super(px(tx * 16 + 10), px(ty * 16), 12, 0);
    this.mouthY = px((hanging ? ty + 1 : ty) * 16);
    this.centerX = px(tx * 16 + 16);
    this.pipeLeft = px(tx * 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
    this.vulnerability = {
      fireball: 'kill',
      shell: 'kill',
      star: 'kill',
      sword: 'kill',
      buster: 'kill',
      bomb: 'kill',
      weapon: 'kill',
      boomerang: 'immune',
      ice: 'immune',
      stomp: 'hurtAttacker',
    };
    if (hanging) {
      this.stompable = false;
      this.corpseFlipY = true; // knocked out head-down, as it hung
    }
    this.scoreValue = 200;
    this.body.vx = 0;
    this.body.y = this.mouthY;
    this.currentFrame = 'piranha-0';
  }

  private set visible(pxVisible: number) {
    const v = Math.max(0, Math.min(HEIGHT, pxVisible));
    this.body.h = px(v);
    this.body.y = this.hanging ? this.mouthY : this.mouthY - this.body.h;
    this.contactHurts = v > 4;
  }

  private get visiblePx(): number {
    return toPx(this.body.h);
  }

  override palette(_view: View): string {
    return piranhaPalette(this.red);
  }

  protected override corpsePalette(_theme: Theme): string {
    return piranhaPalette(this.red);
  }

  /** Too close to come out: within the hide radius, or (upright plants) over the pipe's top. */
  playerBlocks(world: World): boolean {
    const pl = world.nearestPlayer(this.centerX).body;
    const radius = this.red ? HIDE_RADIUS_RED : HIDE_RADIUS_GREEN;
    if (Math.abs(pl.x + pl.w / 2 - this.centerX) < radius) return true;
    // PiranhaGreen.as: an upright plant (either colour) never rises under a player standing on
    // or above its pipe, however far from the centre.
    return (
      !this.hanging &&
      pl.x + pl.w > this.pipeLeft &&
      pl.x < this.pipeLeft + px(32) &&
      pl.y + pl.h <= this.mouthY
    );
  }

  update(world: World): void {
    const playerNear = this.playerBlocks(world);
    this.t--;
    switch (this.phase) {
      case 'hidden':
        this.visible = 0;
        if (this.t <= 0 && !playerNear) {
          this.phase = 'rising';
          this.t = RISE_FRAMES;
        }
        break;
      case 'rising':
        this.visible = Math.round(((RISE_FRAMES - this.t) / RISE_FRAMES) * HEIGHT);
        if (this.t <= 0) {
          this.phase = 'up';
          this.t = HOLD_FRAMES;
        }
        break;
      case 'up':
        this.visible = HEIGHT;
        if (this.t <= 0) {
          this.phase = 'sinking';
          this.t = RISE_FRAMES;
        }
        break;
      case 'sinking':
        this.visible = Math.round((this.t / RISE_FRAMES) * HEIGHT);
        if (this.t <= 0) {
          this.phase = 'hidden';
          this.t = HIDDEN_FRAMES;
        }
        break;
    }
    this.currentFrame = `piranha-${(world.frame >> 3) & 1}`;
  }

  override render(r: Renderer, view: View): void {
    if (this.visiblePx <= 0) return;
    // Draw the whole 24-tall sprite anchored to the pipe mouth; the pipe tiles (drawn later) cover
    // the rest. Hanging, it is flipped head-down and grows below the rim.
    const sheet = view.assets.sheet(this.sheet, this.palette(view));
    const x = toPx(this.body.x) - view.camX - 2;
    const mouth = toPx(this.mouthY);
    if (this.hanging) r.sprite(sheet, this.currentFrame, x, mouth + this.visiblePx - HEIGHT, false, true);
    else r.sprite(sheet, this.currentFrame, x, mouth - this.visiblePx);
  }
}
