import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { clamp, px } from '@engine/math/units';
import { fxPalette } from '@content/sprites/palette-fx';
import type { Game } from '@game/scenes/game';
import type { World } from '@game/world/world';
import { drawSparkle, WAND_SPARKLE } from '@game/entities/effects/wand-poof';
import { cardContinues, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { NO_TOUCH_BUTTONS } from '@game/touch-labels';
import { SIGHTING_SAID } from './script';
import { BURST_LIFE, type SightingDraw, type SightingScript } from './sightings';

/*
 * A hero sighting (story/sightings.ts) over the frozen level, as Luigi's run in 1-1: nothing in
 * the level moves and the clock holds. The script's frames are drawn over it (the hero in the
 * captive palette with wand sparkles drifting off them, and any scene-only props: a vine, a puff
 * of sparkles), its sounds play, and its camera pan runs. No text of its own: the announcer says
 * what happens as it starts. When it ends, or on a press of JUMP, ATTACK or MENU after the card
 * guard (SKIP on touch), the camera is put back exactly and `next` shows the card.
 */
export class HeroSightingScene implements Scene {
  readonly translucent = true;
  private t = 0;
  private done = false;
  /** The camera as the scene found it (subpixels), put back before the card. */
  private readonly camX: number;
  private readonly camY: number;

  constructor(
    private readonly game: Game,
    private readonly world: World,
    readonly script: SightingScript,
    private readonly next: () => void,
  ) {
    this.camX = world.camera.x;
    this.camY = world.camera.y;
  }

  /** Frames played so far. */
  get frame(): number {
    return this.t;
  }

  enter(): void {
    const said = SIGHTING_SAID[this.script.hero];
    if (said) this.game.deps.announcer?.say(said);
  }

  touchLabels(): TouchLabels {
    return this.t > CARD_GUARD_FRAMES ? { ...NO_TOUCH_BUTTONS, jump: 'SKIP' } : NO_TOUCH_BUTTONS;
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    if (cardContinues(this.t, inputs, ['jump', 'attack', 'start'])) return this.finish();
    const sfx = this.script.sfx?.[this.t];
    if (sfx) this.game.ctx.audio.sfx(sfx);
    this.panCamera();
    if (this.t >= this.script.frames) this.finish();
  }

  /** The script's pan: ease out to the camera's start plus dx, then back (never past the map). */
  private panCamera(): void {
    const pan = this.script.pan;
    if (!pan || this.t < pan.at) return;
    const cam = this.world.camera;
    const out = this.t < pan.back;
    const goal = out ? clamp(this.camX + px(pan.dx), 0, cam.maxX) : this.camX;
    const step = px(out ? pan.speed : pan.backSpeed);
    cam.x = cam.x < goal ? Math.min(goal, cam.x + step) : Math.max(goal, cam.x - step);
  }

  private finish(): void {
    this.done = true;
    this.world.camera.x = this.camX;
    this.world.camera.y = this.camY;
    this.next();
  }

  render(r: Renderer): void {
    const reduce = this.game.ctx.reduceFlashing;
    const camX = this.world.camera.pxX;
    for (const d of this.script.draw(this.t, reduce)) this.drawOne(r, d, camX, reduce);
  }

  private drawOne(r: Renderer, d: SightingDraw, camX: number, reduce: boolean): void {
    const assets = this.game.ctx.assets;
    if (d.kind === 'vine') {
      // As the vine entity draws its beanstalk (entities/objects/vine.ts).
      const sheet = assets.sheet('items');
      for (let y = d.base - 16; y >= d.top; y -= 16)
        r.sprite(sheet, y - 16 < d.top ? 'vine-top' : 'vine-mid', d.x - camX, y);
      return;
    }
    if (d.kind === 'burst') {
      // A ring of wand sparkles flung out, slowing and shrinking (as WandPoof, smaller).
      const k = d.age / BURST_LIFE;
      if (k >= 1) return;
      const dist = 14 * (1 - (1 - k) * (1 - k));
      const size = k < 0.4 ? 1 : 0;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = Math.round(d.x - camX + Math.cos(a) * dist);
        // Out of the grass: the lower half of the ring stays low.
        const y = Math.round(d.y + Math.min(0, Math.sin(a)) * dist * 1.4);
        const c = reduce ? i % 3 : (i + (d.age >> 2)) % 3;
        drawSparkle(r, x, y, size, WAND_SPARKLE[c] as string);
      }
      return;
    }
    const sheet = assets.sheet(d.sheet, d.fx ? fxPalette(d.palette, 'brainwashed') : d.palette);
    const h = sheet.frames.get(d.frame)?.h ?? 32;
    const x = d.x - camX;
    const y = d.feet - h;
    r.sprite(sheet, d.frame, x, y, d.flip === true);
    if (!d.sparkles) return;
    // A few wand sparkles drifting up off them (as Luigi in 1-1; one colour each with reduce flashing).
    for (let k = 0; k < 3; k++) {
      const drift = (this.t + k * 13) % 36;
      const c = reduce ? k % 3 : (k + (this.t >> 3)) % 3;
      drawSparkle(r, x + 3 + k * 5, y + 12 - (drift >> 1), 0, WAND_SPARKLE[c] as string);
    }
  }
}
