import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { px, toPx, velToSub } from '@engine/math/units';
import type { Theme } from '../level/schema';
import { makeBody, moveX, moveY, type Body } from './body';
import type { World } from '../world/world';

/** What render() needs beyond the renderer. */
export interface View {
  camX: number; // px
  frame: number; // global animation counter
  assets: AssetRegistry;
  theme: Theme;
  reduceFlashing: boolean;
}

export type Layer = 'back' | 'main' | 'front';

/** Default gravity for things that fall (enemies, items, fragments): 0.25 px/f². */
export const ENTITY_GRAVITY = 0x00400;
export const ENTITY_MAX_FALL = 0x04000;

let nextId = 1;

export abstract class Entity {
  readonly id = nextId++;
  abstract readonly kind: string;
  body: Body;
  alive = true;
  layer: Layer = 'main';
  facing: -1 | 1 = -1;
  /** Despawn once this far off the left of the camera (px); null = never. */
  despawnMargin: number | null = 64;
  /** Draw the sprite this many px left/up of the body's top-left (sprites are often bigger than hitboxes). */
  spriteOffsetX = 0;
  spriteOffsetY = 0;

  constructor(x: number, y: number, wPx: number, hPx: number) {
    this.body = makeBody(x, y, wPx, hPx);
  }

  abstract update(world: World): void;
  abstract render(r: Renderer, view: View): void;

  /** Screen-space position for drawing. */
  protected screenX(view: View): number {
    return toPx(this.body.x) - view.camX - this.spriteOffsetX;
  }
  protected screenY(): number {
    return toPx(this.body.y) - this.spriteOffsetY;
  }

  /** Standard gravity + tile movement used by most things. */
  protected fall(world: World, gravity = ENTITY_GRAVITY, maxFall = ENTITY_MAX_FALL): void {
    const b = this.body;
    b.vy += gravity;
    if (b.vy > maxFall) b.vy = maxFall;
    moveY(b, world.map, b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy));
    if (b.onGround) b.vy = 0;
  }

  protected walk(world: World): void {
    moveX(this.body, world.map, velToSub(this.body.vx));
  }

  get bottomPx(): number {
    return toPx(this.body.y + this.body.h);
  }

  isBelowLevel(): boolean {
    return this.body.y > px(240 + 32);
  }

  destroy(): void {
    this.alive = false;
  }
}
