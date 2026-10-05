import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';
import { moveY } from '../body';

/** Score text that floats up (100, 200, 1UP...). */
export class ScorePopup extends Entity {
  readonly kind = 'score-popup';
  private life = 40;
  constructor(
    x: number,
    y: number,
    readonly text: string,
  ) {
    super(x, y, 1, 1);
    this.layer = 'front';
    this.despawnMargin = null;
  }
  update(): void {
    this.body.y -= px(1);
    if (--this.life <= 0) this.destroy();
  }
  render(r: Renderer, view: View): void {
    r.text(view.assets.sheet('font'), this.text, toPx(this.body.x) - view.camX, toPx(this.body.y));
  }
}

/** A coin popping out of a block: rises, falls, then awards itself. */
export class CoinPop extends Entity {
  readonly kind = 'coin-pop';
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y, 8, 16);
    this.layer = 'back';
    this.body.vy = -0x05000;
  }
  update(world: World): void {
    this.t++;
    this.body.vy += 0x00500;
    this.body.y += velToSub(this.body.vy);
    if (this.t >= 32) {
      this.destroy();
      world.addScore(200, this.body.x, this.body.y - px(16));
    }
  }
  render(r: Renderer, view: View): void {
    const f = `coin-${(view.frame >> 2) & 3}`;
    r.sprite(view.assets.sheet('items'), f, toPx(this.body.x) - view.camX - 4, toPx(this.body.y));
  }
}

/** Brick fragment flying off a broken brick. */
export class BrickPiece extends Entity {
  readonly kind = 'brick-piece';
  constructor(x: number, y: number, vx: number, vy: number) {
    super(x, y, 8, 8);
    this.layer = 'front';
    this.body.vx = vx;
    this.body.vy = vy;
    this.despawnMargin = null;
  }
  update(): void {
    this.body.vy += 0x00400;
    this.body.x += velToSub(this.body.vx);
    this.body.y += velToSub(this.body.vy);
    if (this.isBelowLevel()) this.destroy();
  }
  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), 'brick-piece', toPx(this.body.x) - view.camX, toPx(this.body.y));
  }
}

/** The tile itself hopping up when hit from below. The map holds an invisible solid tile meanwhile. */
export class BlockBump extends Entity {
  readonly kind = 'block-bump';
  private t = 0;
  constructor(
    readonly tx: number,
    readonly ty: number,
    readonly frame: string,
    readonly restoreTile: number,
    private readonly onDone: () => void,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.layer = 'back';
    this.despawnMargin = null;
  }
  update(world: World): void {
    this.t++;
    if (this.t >= 12) {
      world.map.set(this.tx, this.ty, this.restoreTile);
      this.onDone();
      this.destroy();
    }
  }
  render(r: Renderer, view: View): void {
    const lift = this.t < 6 ? this.t * 1.5 : (12 - this.t) * 1.5;
    const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
    const f = sheet.frames.has(`${this.frame}@${view.theme}`) ? `${this.frame}@${view.theme}` : this.frame;
    r.sprite(sheet, f, this.tx * 16 - view.camX, this.ty * 16 - Math.round(lift));
  }
}

/** Simple sprite that shows a frame for N frames (fireball burst, puff). */
export class Flash extends Entity {
  readonly kind = 'flash';
  private life: number;
  constructor(
    x: number,
    y: number,
    readonly sheet: string,
    readonly frame: string,
    life = 8,
    readonly offsetX = 0,
    readonly offsetY = 0,
  ) {
    super(x, y, 1, 1);
    this.life = life;
    this.layer = 'front';
  }
  update(): void {
    if (--this.life <= 0) this.destroy();
  }
  render(r: Renderer, view: View): void {
    r.sprite(
      view.assets.sheet(this.sheet),
      this.frame,
      toPx(this.body.x) - view.camX + this.offsetX,
      toPx(this.body.y) + this.offsetY,
    );
  }
}

/** Bomb blast: three growing frames drawn centred on the blast point. */
export class Explosion extends Entity {
  readonly kind = 'explosion';
  private age = 0;
  constructor(
    cx: number,
    cy: number,
    readonly small = false,
  ) {
    super(cx - px(16), cy - px(16), 32, 32);
    this.layer = 'front';
  }
  update(): void {
    if (++this.age >= (this.small ? 12 : 24)) this.destroy();
  }
  render(r: Renderer, view: View): void {
    // A small blast only shows the first two stages.
    const f = this.small ? Math.min(1, this.age >> 3) : Math.min(2, this.age >> 3);
    r.sprite(view.assets.sheet('items'), `explosion-${f}`, this.screenX(view), this.screenY());
  }
}

/** A dead enemy flipped upside down, falling off the screen. */
export class Corpse extends Entity {
  readonly kind = 'corpse';
  constructor(
    x: number,
    y: number,
    wPx: number,
    hPx: number,
    readonly sheet: string,
    readonly palette: string | undefined,
    readonly frame: string,
    dirX: -1 | 1,
    readonly flipV = true,
    readonly spriteOffX = 0,
    readonly spriteOffY = 0,
    /** Draw the frame mirrored vertically (an enemy that was hanging upside down). */
    readonly mirrorY = false,
  ) {
    super(x, y, wPx, hPx);
    this.body.vx = dirX * 0x01000;
    this.body.vy = -0x03000;
    this.layer = 'front';
  }
  update(): void {
    this.body.vy += 0x00400;
    this.body.x += velToSub(this.body.vx);
    this.body.y += velToSub(this.body.vy);
    if (this.isBelowLevel()) this.destroy();
  }
  render(r: Renderer, view: View): void {
    // Vertical flip is drawn by inverting via a transform-free trick: we rely on a "-flip" frame if present,
    // otherwise draw as-is (the fall itself reads as death).
    const sheet = view.assets.sheet(this.sheet, this.palette);
    const flipped = `${this.frame}-flip`;
    const f = this.flipV && sheet.frames.has(flipped) ? flipped : this.frame;
    r.sprite(
      sheet,
      f,
      toPx(this.body.x) - view.camX - this.spriteOffX,
      toPx(this.body.y) - this.spriteOffY,
      this.body.vx > 0,
      this.mirrorY,
    );
  }
}

/** Keep `moveY` referenced for effects that need tile landing later. */
export const _effectsMoveY = moveY;
