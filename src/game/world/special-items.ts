import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entities/entity';
import { overlaps } from '@engine/math/aabb';
import { Enemy } from '../entities/enemies/enemy';
import { Firebar } from '../entities/enemies/firebar';
import { Podoboo } from '../entities/enemies/podoboo';
import { isWorldItem, type PowerUp } from '../entities/objects/powerup';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Player } from '../entities/player';
import type { World } from './world';

/*
 * Super Mario Bros. Special's items (G-022; ground/Brick.as 420-434, characters/Character.as
 * 1619-1665): the Atom, the Hammer and the Wing. Each is a plain Pickup that rises out of its
 * block and stays there; any hero takes it for 1000 points (their SCORE_VALUE) and the power-up
 * sound. Here for both rules: the Special map set plays under Classic or Current rules alike.
 */

/** Atom.SCORE_VALUE, HammerPickup.SCORE_VALUE, Wing.SCORE_VALUE. */
export const SPECIAL_ITEM_POINTS = 1000;
/** HammerWeapon.destroyTimer: 10 s. */
export const HAMMER_FRAMES = 600;
/** Character.WING_TIMER_DURATION: 10 s. */
export const WING_FRAMES = 600;
/** HammerWeapon swaps between overhead and forward each ANIM_MODERATE_TMR tick (75 ms). */
const HAMMER_SWING_MS = 75;

/** What each item does, read out as it is taken (it shows no text). */
export const SPECIAL_ITEM_SAID = {
  atom: 'Atom: every enemy on screen is defeated.',
  hammer: 'Hammer: for ten seconds it swings over you and strikes any enemy it touches.',
  wing: 'Wing: for ten seconds you swim through the air.',
  rabbit: 'Full power: you are powered up all the way.',
} as const;

export type SpecialItem = keyof typeof SPECIAL_ITEM_SAID;

export function isSpecialItem(kind: string): kind is SpecialItem {
  return kind === 'atom' || kind === 'hammer' || kind === 'wing' || kind === 'rabbit';
}

/** Player `p` takes Special item `e` (Character.hitPickup's ATOM, HAMMER and WING cases). */
export function takeSpecialItem(world: World, p: Player, e: PowerUp & { item: SpecialItem }): void {
  world.addScore(SPECIAL_ITEM_POINTS, e.body.x, e.body.y);
  world.audio.sfx('powerup');
  world.events.push({ type: 'say', text: SPECIAL_ITEM_SAID[e.item] });
  switch (e.item) {
    case 'atom':
      defeatOnScreen(world);
      break;
    case 'hammer':
      // A new hammer replaces the one the hero holds (`hammerWeapon.destroy()`).
      for (const h of world.entities) if (h instanceof HammerWeapon && h.owner === p) h.destroy();
      world.spawn(new HammerWeapon(p));
      break;
    case 'wing':
      world.wingSwim(WING_FRAMES);
      break;
    case 'rabbit':
      fullPowerUp(world, p);
      break;
  }
}

/**
 * Character.fullyPowerup (the ExplodingRabbitPowerup, P_UP_SCORE_VAL): with Classic power-ups,
 * the Mushroom if the hero lacks it, then the Fire Flower if he lacks it, both at once with no
 * animation (hitRandomUpgrade(charNum, false)), through the hero's own power-up code. Under
 * Current rules, the hero's own next two upgrades. Their own points and sounds are not played
 * (the item's 1000 are).
 */
export function fullPowerUp(world: World, p: Player): void {
  const quiet = Object.create(world, {
    audio: { value: NULL_AUDIO },
    addScore: { value: () => {} },
    events: { value: [] },
  }) as World;
  for (let i = 0; i < FULL_POWER_STEPS; i++) {
    const kind = world.rules === 'current' ? p.def.blockPowerUp(p) : 'flower';
    if (isWorldItem(kind)) continue;
    if (world.rules === 'current') quiet.powerUp(p, kind);
    else p.def.behaviour.onPowerUp(p, kind, quiet);
  }
  if (p.transition) {
    p.transition = null;
    p.refitHitbox();
  }
}

/** fullyPowerup's two steps: the Mushroom, then the Fire Flower. */
export const FULL_POWER_STEPS = 2;

/**
 * Level.killAllEnemiesOnScreen (the Atom): every enemy on screen is defeated, each scoring as if
 * a Star had (scoreStar). Fire bars and Podoboos are projectiles in the original, so they stay.
 */
export function defeatOnScreen(world: World): number {
  const left = world.camera.x;
  const right = world.camera.right;
  let n = 0;
  for (const e of [...world.entities]) {
    if (!(e instanceof Enemy) || !e.alive || e instanceof Firebar || e instanceof Podoboo) continue;
    if (e.body.x + e.body.w < left || e.body.x > right) continue;
    const dir = e.body.x + e.body.w / 2 < (left + right) / 2 ? -1 : 1;
    const r = e.hit({ kind: 'star', amount: 1, owner: null, dirX: dir }, world);
    if (r !== 'immune') {
      world.addScore(e.scoreFor('star'), e.body.x, e.body.y);
      n++;
    }
  }
  return n;
}

/**
 * HammerWeapon (projectiles/HammerWeapon.as): for 10 s a hammer swings with its hero, held
 * overhead and then forward at the feet, swapping every 75 ms. It passes through everything and
 * defeats any enemy it touches (damage int.MAX/4, pierce 11: nothing withstands it, as a Star; it
 * scores the enemy's attack points). It goes when the hero dies.
 */
export class HammerWeapon extends Entity {
  readonly kind = 'hammer-weapon';
  private t = 0;

  constructor(readonly owner: Player) {
    super(owner.body.x, owner.body.y, 16, 16);
    this.despawnMargin = null;
    this.place();
  }

  /** Overhead (HammerWeapon's "above" frame) or forward ("side"). */
  get overhead(): boolean {
    return Math.floor((this.t * 1000) / 60 / HAMMER_SWING_MS) % 2 === 0;
  }

  /** On top of the hero's head, or in front of him with its middle half a tile above his feet. */
  private place(): void {
    const o = this.owner.body;
    const b = this.body;
    if (this.overhead) {
      b.x = o.x + (o.w >> 1) - px(8);
      b.y = o.y - px(16);
    } else {
      b.x = this.owner.facing > 0 ? o.x + o.w : o.x - px(16);
      b.y = o.y + o.h - px(16);
    }
  }

  update(world: World): void {
    const p = this.owner;
    if (++this.t > HAMMER_FRAMES || p.dead || p.out) {
      this.destroy();
      return;
    }
    this.place();
    for (const e of [...world.entities]) {
      if (!(e instanceof Enemy) || !e.alive || e instanceof Firebar || e instanceof Podoboo) continue;
      if (!overlaps(this.body, e.body)) continue;
      const r = e.hit({ kind: 'star', amount: 1, owner: this, dirX: p.facing }, world);
      if (r !== 'immune') world.addScore(e.scoreFor('weapon'), e.body.x, e.body.y);
    }
  }

  /**
   * The hammer where it is now. It swaps place 13 times a second, so under Reduce flashing both
   * places are drawn, steady (it strikes only where it is).
   */
  render(r: Renderer, view: View): void {
    if (this.owner.hidden) return;
    const sheet = view.assets.sheet('items');
    const o = this.owner.body;
    const up = { x: toPx(o.x + (o.w >> 1)) - 8 - view.camX, y: toPx(o.y) - 16 };
    const side = {
      x: (this.owner.facing > 0 ? toPx(o.x + o.w) : toPx(o.x) - 16) - view.camX,
      y: toPx(o.y + o.h) - 16,
    };
    if (view.reduceFlashing || this.overhead) r.sprite(sheet, 'hammer-up', up.x, up.y);
    if (view.reduceFlashing || !this.overhead)
      r.sprite(sheet, 'hammer-side', side.x, side.y, this.owner.facing < 0);
  }
}
