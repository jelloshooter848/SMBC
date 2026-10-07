import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { Explosion } from '../../entities/effects/effects';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import type { World } from '../../world/world';
import { drawZebes, ZEBES_FLASH } from './art';

/*
 * Zebes's creatures and fixtures (docs/HEROES.md, Samus's mini game): the base the creatures of
 * Tourian build on (tourian.ts: the Rinka) and the alarm lights. They are the mini game's own
 * entity types, made through World's `extraEntities` (stage.ts).
 */

/** Is a body inside the camera's view (both ways), with a margin in px? */
export function inView(world: World, e: Entity, margin = 0): boolean {
  const b = e.body;
  const c = world.camera;
  return (
    b.x + b.w > c.x - px(margin) &&
    b.x < c.right + px(margin) &&
    b.y + b.h > c.y - px(margin) &&
    b.y < c.bottom + px(margin)
  );
}

/** What the cavern's creatures take hits from: Samus's beam, missiles and bombs (and a star). */
export const CREATURE_VULNERABILITY: Vulnerability = {
  buster: 'hp',
  weapon: 'hp',
  bomb: 'hp',
  fireball: 'hp',
  sword: 'hp',
  star: 'kill',
  ice: 'stun',
};

/**
 * A creature of Zebes: hit points, blows up in a small explosion (no SMB-style flip), leaves
 * Samus's drops now and then (energy, missiles), and stays alive however far the camera goes
 * (the escape runs up and down and back left through the cavern).
 */
export abstract class Creature extends Enemy {
  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.body.vx = 0;
    this.vulnerability = { ...CREATURE_VULNERABILITY };
    this.stompable = false;
    this.fallsOffLedges = false;
    this.despawnMargin = null;
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('kick');
    this.destroy();
  }

  override hit(src: DamageSource, world: World): Reaction {
    const r = super.hit(src, world);
    if (r === 'hp' && this.alive) this.flash = 6;
    return r;
  }

  /** Frames of the hit flash (the `zebes-flash` palette; not with reduce flashing). */
  flash = 0;
  /** Drawn upside down (a Zoomer under a ceiling). */
  protected flipY = false;

  protected tickFlash(): void {
    if (this.flash > 0) this.flash--;
  }

  /** The palette to draw with: pale for a moment after a hit. */
  protected paletteNow(view: View): string | undefined {
    return this.flash > 0 && !view.reduceFlashing ? ZEBES_FLASH : undefined;
  }

  /** The zebes creatures face left: flipped when facing right. */
  override render(r: Renderer, view: View): void {
    if (this.stunned > 0 && !view.reduceFlashing && (view.frame & 3) === 0) return;
    drawZebes(
      r,
      view.assets,
      this.currentFrame,
      this.screenX(view),
      this.screenY(),
      this.facing > 0,
      this.flipY,
      this.paletteNow(view),
    );
  }
}

/* ---------- Fixtures ---------- */

/** Frames between an alarm light's turns (on, off). */
export const ALARM_BLINK = 16;

/**
 * Scenery from the zebes sheet: `chozo` (the 32×32 statue facing right, by its top-left tile),
 * `alarm` (a 16×16 wall light: it blinks, or stays lit with reduce flashing), `door` (a 16×48
 * bubble door). Drawn behind Samus and the creatures.
 */
export class ZebesDecor extends Entity {
  readonly kind = 'zebes-decor';
  constructor(
    readonly name: 'chozo' | 'alarm' | 'door',
    x: number,
    y: number,
  ) {
    super(x, y, name === 'chozo' ? 32 : 16, name === 'chozo' ? 32 : name === 'door' ? 48 : 16);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    if (this.name === 'alarm') {
      const lit = view.reduceFlashing || ((view.frame / ALARM_BLINK) | 0) % 2 === 0;
      drawZebes(r, view.assets, lit ? 'alarm-1' : 'alarm-0', x, y);
      return;
    }
    if (this.name === 'door') {
      drawZebes(r, view.assets, 'bubble-door', x, y);
      return;
    }
    // The orb in its hands glows on and off slowly; steady with reduce flashing.
    const glow = view.reduceFlashing || ((view.frame >> 5) & 1) === 1;
    drawZebes(r, view.assets, glow ? 'chozo-1' : 'chozo-0', x, y);
  }
}

/** Screen-space helper for the tests: a body's top-left in px. */
export const bodyPx = (e: Entity) => ({ x: toPx(e.body.x), y: toPx(e.body.y) });
