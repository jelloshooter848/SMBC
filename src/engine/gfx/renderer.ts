import type { SpriteSheet } from './spritesheet';

/**
 * Everything the game draws goes through this interface so the headless sim can use a
 * NullRenderer and the game logic never touches the DOM.
 * Coordinates are screen pixels (0..256, 0..240); callers subtract the camera.
 */
export interface Renderer {
  clear(color: string): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  /** Draw a named frame from a sprite sheet with its top-left at (x, y). */
  sprite(sheet: SpriteSheet, frame: string, x: number, y: number, flipX?: boolean, flipY?: boolean): void;
  /** Draw text with the bitmap font; `font` is a sheet whose frames are single characters. */
  text(font: SpriteSheet, str: string, x: number, y: number): void;
  /** Debug-only text using the canvas font (not pixel-perfect). */
  debugText(str: string, x: number, y: number, color?: string): void;
  line(x1: number, y1: number, x2: number, y2: number, color: string): void;
}

export class NullRenderer implements Renderer {
  clear(): void {}
  rect(): void {}
  sprite(): void {}
  text(): void {}
  debugText(): void {}
  line(): void {}
}

/**
 * Draws through `inner` moved by (dx, dy): a world drawn under a camera that also scrolls
 * vertically (World.render with a `free` camera). `clear` fills the whole target as before.
 */
export class OffsetRenderer implements Renderer {
  /** The target and the offset can be changed between frames (one instance reused). */
  constructor(
    public inner: Renderer,
    public dx: number,
    public dy: number,
  ) {}
  clear(color: string): void {
    this.inner.clear(color);
  }
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.inner.rect(x + this.dx, y + this.dy, w, h, color);
  }
  sprite(sheet: SpriteSheet, frame: string, x: number, y: number, flipX?: boolean, flipY?: boolean): void {
    this.inner.sprite(sheet, frame, x + this.dx, y + this.dy, flipX, flipY);
  }
  text(font: SpriteSheet, str: string, x: number, y: number): void {
    this.inner.text(font, str, x + this.dx, y + this.dy);
  }
  debugText(str: string, x: number, y: number, color?: string): void {
    this.inner.debugText(str, x + this.dx, y + this.dy, color);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.inner.line(x1 + this.dx, y1 + this.dy, x2 + this.dx, y2 + this.dy, color);
  }
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class CanvasRenderer implements Renderer {
  constructor(private readonly ctx: Ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }
  sprite(sheet: SpriteSheet, frame: string, x: number, y: number, flipX = false, flipY = false): void {
    const f = sheet.frames.get(frame);
    if (!f) return;
    const ctx = this.ctx;
    if (flipX || flipY) {
      ctx.save();
      ctx.translate((x | 0) + (flipX ? f.w : 0), (y | 0) + (flipY ? f.h : 0));
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(sheet.image as CanvasImageSource, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      ctx.restore();
    } else {
      ctx.drawImage(sheet.image as CanvasImageSource, f.x, f.y, f.w, f.h, x | 0, y | 0, f.w, f.h);
    }
  }
  text(font: SpriteSheet, str: string, x: number, y: number): void {
    let cx = x | 0;
    for (const ch of str) {
      if (ch !== ' ') this.sprite(font, ch, cx, y);
      cx += 8;
    }
  }
  debugText(str: string, x: number, y: number, color = '#fff'): void {
    this.ctx.font = '8px monospace';
    this.ctx.fillStyle = color;
    this.ctx.fillText(str, x, y);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x1 + 0.5, y1 + 0.5);
    this.ctx.lineTo(x2 + 0.5, y2 + 0.5);
    this.ctx.stroke();
  }
}
