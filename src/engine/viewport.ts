export const SCREEN_W = 256;
export const SCREEN_H = 240;

export interface ViewportOptions {
  integerScale: boolean;
}

/**
 * Owns the 256x240 backbuffer and presents it on the display canvas with integer scaling
 * (or stretch-to-fit) and letterboxing. Pixel art stays crisp: smoothing is off everywhere.
 */
export class Viewport {
  readonly back: HTMLCanvasElement | OffscreenCanvas;
  readonly ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private readonly displayCtx: CanvasRenderingContext2D;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  private dw = SCREEN_W;
  private dh = SCREEN_H;

  constructor(
    readonly display: HTMLCanvasElement,
    public opts: ViewportOptions = { integerScale: true },
  ) {
    this.back =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(SCREEN_W, SCREEN_H)
        : Object.assign(document.createElement('canvas'), { width: SCREEN_W, height: SCREEN_H });
    const ctx = this.back.getContext('2d') as
      OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    const dctx = display.getContext('2d');
    if (!dctx) throw new Error('2D canvas not supported');
    this.displayCtx = dctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.display.clientWidth || window.innerWidth;
    const cssH = this.display.clientHeight || window.innerHeight;
    const W = Math.floor(cssW * dpr);
    const H = Math.floor(cssH * dpr);
    if (this.display.width !== W || this.display.height !== H) {
      this.display.width = W;
      this.display.height = H;
    }
    const raw = Math.min(W / SCREEN_W, H / SCREEN_H);
    this.scale = this.opts.integerScale ? Math.max(1, Math.floor(raw)) : raw;
    this.dw = Math.round(SCREEN_W * this.scale);
    this.dh = Math.round(SCREEN_H * this.scale);
    this.offsetX = Math.floor((W - this.dw) / 2);
    this.offsetY = Math.floor((H - this.dh) / 2);
    this.displayCtx.imageSmoothingEnabled = false;
  }

  present(): void {
    const d = this.displayCtx;
    d.imageSmoothingEnabled = false;
    d.fillStyle = '#000';
    d.fillRect(0, 0, this.display.width, this.display.height);
    d.drawImage(this.back as CanvasImageSource, this.offsetX, this.offsetY, this.dw, this.dh);
  }

  /** Convert a client (CSS px) point to backbuffer coordinates. Used by touch controls and the editor. */
  toScreen(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.display.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = ((clientX - rect.left) * dpr - this.offsetX) / this.scale;
    const y = ((clientY - rect.top) * dpr - this.offsetY) / this.scale;
    return { x, y };
  }
}
