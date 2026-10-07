import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { WAND_BREAK_SAID } from '../../story/script';
import type { World } from '../../world/world';
import { Entity, type View } from '../entity';
import { drawSparkle, WAND_SPARKLE } from './wand-poof';

/** Frames (from the axe's drop, World.updateBossClear) the wand spins up before it cracks. */
export const WAND_CRACK_AT = 40;
/** Frames the cracked wand hangs in the air before it breaks and the rift opens. */
export const WAND_BREAK_AT = 56;
/** Frames the rift takes to open, its pieces flying out meanwhile. */
const RIFT_OPEN = 16;
/** The pieces are all in the rift: the scene is over (the rift stays, humming). */
export const WAND_SCENE_FRAMES = 120;
/** Frames of the white flash as it cracks (off with reduce flashing). */
export const WAND_FLASH_FRAMES = 6;
/** The pieces (six: one per Koopaling, docs/STORY.md section 3, decision 7). */
const PIECES = 6;
/** How far the pieces fly out from the break before they swirl in (px). */
const SPREAD = 30;

const ease = (k: number) => 1 - (1 - k) * (1 - k);

/**
 * The wand breaking at the end of 8-4 (campaign only, docs/STORY.md 2.12). As the axe drops the
 * king, the wand spins up out of his hand to the spot over the lava, cracks with a white flash
 * (with reduce flashing: no flash, the cracked wand held steady in a white rim instead) and breaks
 * into six glowing pieces; a jagged crack opens in the air there, the pieces swirl into it, and it
 * stays open, shimmering slowly (held still with reduce flashing), with a few motes drifting in,
 * for the rest of the scene. Said once by the announcer as it cracks, with a "crack" sound. Art:
 * the `wand` sheet (content/sprites/wand.ts).
 */
export class WandBreak extends Entity {
  readonly kind = 'wand-break';
  private age = 0;
  /** Where the wand starts (the king's hand), px. */
  private readonly fromX: number;
  private readonly fromY: number;

  /** (handX, handY): the king's hand; (riftX, riftY): the rift's centre; px. */
  constructor(handX: number, handY: number, riftX: number, riftY: number) {
    super(px(riftX), px(riftY), 1, 1);
    this.fromX = handX;
    this.fromY = handY;
    this.layer = 'front';
    this.despawnMargin = null;
  }

  /** Frames since the axe dropped the king. */
  get frames(): number {
    return this.age;
  }
  /** Whether the rift is open (from the break on, for good). */
  get riftOpen(): boolean {
    return this.age >= WAND_BREAK_AT;
  }
  /** Whether the pieces are still on their way into the rift. */
  get piecesOut(): boolean {
    return this.age >= WAND_BREAK_AT && this.age < WAND_SCENE_FRAMES;
  }

  update(world: World): void {
    this.age++;
    if (this.age === WAND_CRACK_AT) {
      world.audio.sfx('wand-crack');
      world.events.push({ type: 'say', text: WAND_BREAK_SAID });
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('wand');
    const rx = toPx(this.body.x) - view.camX;
    const ry = toPx(this.body.y);
    const t = this.age;
    if (t >= WAND_BREAK_AT) this.renderRift(r, view, rx, ry);
    if (t < WAND_CRACK_AT) {
      // The spin up: an eighth of a turn every 4 frames, easing into the spot over the lava.
      const k = ease(t / WAND_CRACK_AT);
      const x = Math.round(this.fromX - view.camX + (rx - (this.fromX - view.camX)) * k);
      const y = Math.round(this.fromY + (ry - this.fromY) * k);
      const step = (t >> 2) & 7;
      r.sprite(sheet, `wand-${step & 3}`, x - 10, y - 10, step >= 4, step >= 4);
    } else if (t < WAND_BREAK_AT) {
      r.sprite(sheet, view.reduceFlashing ? 'wand-glow' : 'wand-crack', rx - 10, ry - 10);
      // One white flash as it cracks, fading out; with reduce flashing none at all.
      const f = t - WAND_CRACK_AT;
      if (!view.reduceFlashing && f < WAND_FLASH_FRAMES) {
        const a = (0.75 * (1 - f / WAND_FLASH_FRAMES)).toFixed(2);
        r.rect(0, view.camY ?? 0, SCREEN_W, SCREEN_H, `rgba(252,252,252,${a})`);
      }
    }
    if (this.piecesOut) this.renderPieces(r, view, rx, ry);
  }

  private renderRift(r: Renderer, view: View, rx: number, ry: number): void {
    const sheet = view.assets.sheet('wand');
    const open = this.age - WAND_BREAK_AT;
    // Opening in two steps, then the slow shimmer (half a second a frame); held still with
    // reduce flashing.
    const frame =
      open < RIFT_OPEN / 2
        ? 'rift-open-0'
        : open < RIFT_OPEN
          ? 'rift-open-1'
          : view.reduceFlashing
            ? 'rift-0'
            : `rift-${(this.age >> 5) & 1}`;
    r.sprite(sheet, frame, rx - 12, ry - 28);
    if (open < RIFT_OPEN) return;
    // The hum: three motes drifting into the crack from the sides, over and over.
    for (let i = 0; i < 3; i++) {
      const k = ((this.age + i * 16) % 48) / 48;
      const side = i & 1 ? 1 : -1;
      const x = Math.round(rx + side * 22 * (1 - k));
      const y = Math.round(ry - 18 + i * 18 + 4 * (1 - k));
      const c = view.reduceFlashing ? i : (i + (this.age >> 3)) % 3;
      drawSparkle(r, x, y, k < 0.5 ? 1 : 0, WAND_SPARKLE[c] as string);
    }
  }

  private renderPieces(r: Renderer, view: View, rx: number, ry: number): void {
    const sheet = view.assets.sheet('wand');
    const t = this.age - WAND_BREAK_AT;
    const out = t < RIFT_OPEN;
    // Flung out, then swirled in: a turn and a half as the circle closes.
    const k = out ? ease(t / RIFT_OPEN) : (t - RIFT_OPEN) / (WAND_SCENE_FRAMES - WAND_BREAK_AT - RIFT_OPEN);
    const radius = out ? SPREAD * k : SPREAD * (1 - k);
    const turn = out ? 0 : k * k * Math.PI * 3;
    if (radius < 2 && !out) return;
    for (let i = 0; i < PIECES; i++) {
      const a = (i / PIECES) * Math.PI * 2 + turn;
      const x = Math.round(rx + Math.cos(a) * radius);
      const y = Math.round(ry + Math.sin(a) * radius * 0.8);
      r.sprite(sheet, `piece-${i % 3}`, x - 4, y - 4);
    }
  }
}
