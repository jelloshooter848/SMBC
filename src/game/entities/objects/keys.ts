import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Player } from '../player';
import { T } from '../../level/tiles';
import type { World } from '../../world/world';
import { TALK_REACH_PX } from './captive';
import { drawTalkPrompt } from './talk-prompt';
import { PORTCULLIS_STEP } from '@content/sprites/keys';

/*
 * Keys and locked doors (0.4.52, owner design; docs/STORY.md "Simon's way in"): a small mechanic
 * built once and reused (Simon's crypt from 5-1-bonus now; Sophia III's garage from 8-1-bonus in
 * 0.4.54). Campaign only (World.storyMode): classic play keeps the coin bricks and has no doors.
 *
 * - `key-box x y hero=<id>`: lays a key box (T.BRICK_KEY) over the brick at (x, y). Bumped from
 *   below like a ? block (every hero, small or big; it never breaks), the key pops out and the box
 *   is spent. Once the room's hero is freed on the file it lays nothing: the brick keeps its coins.
 * - `key` (KeyItem): pops up a tile, hops left and falls; then lies still. In reach the TALK
 *   button reads PICK UP; pressed, the player carries it (World.keyHolder, the HUD's key icon).
 * - `locked-door x y hero=<id> to=<level> tx=<x> ty=<y>`: a door (two tiles, x y its top) in the
 *   background. Locked, its strip reads LOCKED. It OPENS BY ITSELF when the player carrying the key
 *   touches it (the padlock drops, key-get sfx, the key is used up); then UP goes through, to
 *   `to` (dropping in from the top). Once the hero is freed it stands open for good.
 * - `locked-gate x y hero=<id>`: a portcullis on the start screen (5-1's crypt gate), in the
 *   background, never in the way. While its hero is captive it is always shut: the TALK button
 *   reads OPEN, and pressing it plays the locked card (a `gate` event) once a visit; then just
 *   LOCKED. Simon's sighting draws it raised and dropping over it (story/sightings.ts, drawGate).
 *   Freed: plain scenery, shut, without its padlock.
 *
 * The key lasts one visit: death, leaving or a restart reload the room, so the box is full and
 * the door locked again; a co-op carrier who dies puts it back in its box (World.returnKey). No
 * save field: only the freed list decides the "open for good".
 */

/** The verbs on the TALK button, in priority order after TALK/READ (a person). */
export type KeyVerb = 'PICK UP' | 'OPEN' | 'LOCKED';

/** What the screen reader says (World `say` events; LevelScene announces them). */
export const KEY_SAID = {
  popped: 'A key pops out.',
  got: 'Got the key.',
  opened: 'The key turns. The door opens.',
  lockedDoor: 'A locked door.',
  locked: 'Locked.',
  back: 'The key is back in its box.',
} as const;

/** Frames the key rises out of its box (a tile, a pixel a frame), then its hop's speeds. */
export const KEY_RISE_FRAMES = 16;
const KEY_HOP_VY = -0x02000;
const KEY_HOP_VX = -0x01400;
/** Frames the padlock takes to drop off a door as it opens. */
export const PADLOCK_DROP_FRAMES = 24;

/** On the ground, on the same floor as a thing of height `bottom`, within TALK_REACH_PX of `cx`. */
function reaches(p: Player, cx: number, bottom: number): boolean {
  if (p.dead || p.out || p.hidden || !p.body.onGround) return false;
  return Math.abs(p.centerX - cx) <= px(TALK_REACH_PX) && Math.abs(p.body.y + p.body.h - bottom) <= px(8);
}

/** A thing the TALK button acts on (World.talkTarget), after a captive or a partner. */
export interface KeyThing {
  inReach(p: Player): boolean;
  /** The TALK button's word for `p` now, or null (no prompt, the button is the hero's own). */
  verb(): KeyVerb | null;
}

/* ---------------------------------------------------------------- the box */

/**
 * `key-box x y hero=<id>`: lays T.BRICK_KEY at its tile on its first update in the story (the
 * map's brick shows until then: the same art). Invisible; it stays to put the key back
 * (`refill`) when a co-op carrier dies.
 */
export class KeyBox extends Entity {
  readonly kind = 'key-box';
  private laid = false;

  constructor(
    readonly tx: number,
    readonly ty: number,
    readonly hero: string,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.despawnMargin = null;
  }

  update(world: World): void {
    if (this.laid) return;
    this.laid = true;
    if (!world.storyMode || world.captives?.isFreed(this.hero)) return this.destroy();
    world.map.set(this.tx, this.ty, T.BRICK_KEY);
  }

  /** The key is back in its box (its carrier died): the box is full again. */
  refill(world: World): void {
    world.map.set(this.tx, this.ty, T.BRICK_KEY);
  }

  render(): void {}
}

/* ---------------------------------------------------------------- the key */

/** The key: out of its box, it rises, hops left, falls and lies still until picked up. */
export class KeyItem extends Entity implements KeyThing {
  readonly kind = 'key';
  /** A player is in reach (PICK UP shows over it). */
  prompt = false;
  private t = 0;
  private readonly near = new Set<Player>();

  /** Out of the box at tile (tx, ty), rising from inside it. */
  constructor(tx: number, ty: number) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    // Behind the tiles while it rises, so it comes up out of the box (as a ? block's item).
    this.layer = 'back';
    this.despawnMargin = null;
  }

  /** Still rising out of its box (not yet free to take). */
  get rising(): boolean {
    return this.t < KEY_RISE_FRAMES;
  }

  get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  inReach(p: Player): boolean {
    return !this.rising && reaches(p, this.centerX, this.body.y + this.body.h);
  }

  verb(): KeyVerb {
    return 'PICK UP';
  }

  update(world: World): void {
    this.t++;
    if (this.t <= KEY_RISE_FRAMES) {
      this.body.y -= px(1);
      if (this.t === KEY_RISE_FRAMES) {
        this.body.vy = KEY_HOP_VY;
        this.body.vx = KEY_HOP_VX;
      }
    } else {
      // Out of the box: drawn in front of the tiles from now on (behind them as it rose).
      this.layer = 'main';
      if (!this.body.onGround) this.walk(world);
      this.fall(world);
      if (this.body.onGround) this.body.vx = 0;
      if (this.isBelowLevel()) return world.returnKey();
    }
    const near = world.activePlayers().filter((p) => this.inReach(p));
    this.prompt = near.length > 0;
    for (const p of near)
      if (!this.near.has(p))
        world.events.push({ type: 'key-near', what: 'key', player: world.players.indexOf(p) });
    this.near.clear();
    for (const p of near) this.near.add(p);
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    r.sprite(view.assets.sheet('keys'), 'key', x, y);
    if (this.prompt) drawTalkPrompt(r, view, 'PICK UP', toPx(this.centerX) - view.camX, y);
  }
}

/* ---------------------------------------------------------------- the door */

/** Where a locked door leads (its `to`, `tx`, `ty`), dropping in from the top. */
export interface DoorTarget {
  level: string;
  x: number;
  y: number;
}

/** A locked door in a room's wall (`locked-door`): LOCKED; opened by the carried key; UP enters. */
export class LockedDoor extends Entity implements KeyThing {
  readonly kind = 'locked-door';
  open = false;
  /** Frames since the key turned (the padlock's drop), or -1. */
  private dropT = -1;
  /** Players in reach last frame (each new arrival is announced once). */
  private readonly near = new Set<Player>();
  /** A player is in reach: the strip shows (LOCKED, or UP once open). */
  prompt = false;

  constructor(
    tx: number,
    ty: number,
    readonly hero: string,
    readonly target: DoorTarget | null,
    /** Open for good (its hero is freed on the file). */
    freed: boolean,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 32);
    this.layer = 'main';
    this.despawnMargin = null;
    this.open = freed;
  }

  get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  inReach(p: Player): boolean {
    return reaches(p, this.centerX, this.body.y + this.body.h);
  }

  /** LOCKED while shut; nothing on the TALK button once open (UP goes in). */
  verb(): KeyVerb | null {
    return this.open ? null : 'LOCKED';
  }

  /** Player `p` stands in the doorway (touching it: the key opens it; UP goes through). */
  touches(p: Player): boolean {
    if (p.dead || p.out || p.hidden) return false;
    const b = p.body;
    return (
      b.x < this.body.x + this.body.w &&
      b.x + b.w > this.body.x &&
      b.y < this.body.y + this.body.h &&
      b.y + b.h > this.body.y
    );
  }

  /** Standing in the open doorway on its floor: UP goes through. */
  canEnter(p: Player): boolean {
    return (
      this.open &&
      this.target !== null &&
      p.body.onGround &&
      Math.abs(p.centerX - this.centerX) <= px(8) &&
      Math.abs(p.body.y + p.body.h - (this.body.y + this.body.h)) <= px(2)
    );
  }

  update(world: World): void {
    if (this.dropT >= 0 && this.dropT < PADLOCK_DROP_FRAMES) this.dropT++;
    // The key opens it by itself as its carrier touches it.
    if (!this.open && world.keyHolder !== null) {
      const carrier = world.players[world.keyHolder];
      if (carrier && this.touches(carrier)) {
        this.open = true;
        this.dropT = 0;
        world.useKey();
      }
    }
    const near = world.activePlayers().filter((p) => this.inReach(p));
    this.prompt = near.length > 0;
    for (const p of near)
      if (!this.near.has(p) && !(world.keyHolder === world.players.indexOf(p) && !this.open))
        world.events.push({
          type: 'key-near',
          what: this.open ? 'open-door' : 'door',
          player: world.players.indexOf(p),
        });
    this.near.clear();
    for (const p of near) this.near.add(p);
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const crypt = view.assets.sheet('crypt');
    r.sprite(crypt, this.open ? 'door-open' : 'door', x, y);
    const keys = view.assets.sheet('keys');
    // The padlock on the planks, then dropping to the floor (no flash) as the key turns.
    if (!this.open) r.sprite(keys, 'padlock', x + 4, y + 13);
    else if (this.dropT >= 0 && this.dropT < PADLOCK_DROP_FRAMES) {
      const k = this.dropT / PADLOCK_DROP_FRAMES;
      r.sprite(keys, 'padlock', x + 4, Math.round(y + 13 + k * k * 11));
    }
    if (!this.prompt) return;
    if (this.open) {
      if (this.target) drawTalkPrompt(r, view, 'UP', toPx(this.centerX) - view.camX, y, 'up');
    } else drawTalkPrompt(r, view, 'LOCKED', toPx(this.centerX) - view.camX, y, 'none');
  }
}

/* ---------------------------------------------------------------- the gate */

/** A portcullis by the start (`locked-gate`): always shut while its hero is captive. */
export class LockedGate extends Entity implements KeyThing {
  readonly kind = 'locked-gate';
  /** Tried this visit: the card has played; now it just reads LOCKED. */
  tried = false;
  /** Plain scenery: its hero is freed (no padlock, no prompt). */
  readonly freed: boolean;
  prompt = false;
  private readonly near = new Set<Player>();

  constructor(
    tx: number,
    ty: number,
    readonly hero: string,
    freed: boolean,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 32);
    this.layer = 'main';
    this.despawnMargin = null;
    this.freed = freed;
  }

  get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  inReach(p: Player): boolean {
    return !this.freed && reaches(p, this.centerX, this.body.y + this.body.h);
  }

  verb(): KeyVerb | null {
    if (this.freed) return null;
    return this.tried ? 'LOCKED' : 'OPEN';
  }

  /** OPEN pressed by player `i`: the locked card, once a visit (LevelScene plays it). */
  tryOpen(world: World, i: number): void {
    if (this.freed || this.tried) return;
    this.tried = true;
    this.prompt = false; // hidden under the card; back on the next update in reach
    world.events.push({ type: 'gate', hero: this.hero, player: i });
  }

  update(world: World): void {
    const near = world.activePlayers().filter((p) => this.inReach(p));
    this.prompt = near.length > 0;
    for (const p of near)
      if (!this.near.has(p))
        world.events.push({
          type: 'key-near',
          what: this.tried ? 'locked' : 'gate',
          player: world.players.indexOf(p),
        });
    this.near.clear();
    for (const p of near) this.near.add(p);
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    drawGate(r, view, x, y, 0, !this.freed);
    if (!this.prompt) return;
    if (this.tried) drawTalkPrompt(r, view, 'LOCKED', toPx(this.centerX) - view.camX, y, 'none');
    else drawTalkPrompt(r, view, 'OPEN', toPx(this.centerX) - view.camX, y);
  }
}

/**
 * The gate at screen (x, y) (its doorway's top-left), its portcullis raised `lift` px (0 shut,
 * 32 hidden in the wall above): the dark doorway behind, the bars over it, and the padlock while
 * `locked` and shut (`swing`: px it swings aside). Shared with Simon's sighting, which raises and
 * drops it over the gate itself.
 */
export function drawGate(
  r: Renderer,
  view: View,
  x: number,
  y: number,
  lift: number,
  locked: boolean,
  swing = 0,
): void {
  r.rect(x, y, 16, 32, '#000');
  const keys = view.assets.sheet('keys');
  // The bars' lower part still showing below the wall, in PORTCULLIS_STEP px steps.
  const shown = 32 - Math.max(0, Math.min(32, Math.ceil(lift / PORTCULLIS_STEP) * PORTCULLIS_STEP));
  if (shown >= 32) {
    r.sprite(keys, 'portcullis', x, y);
    if (locked) r.sprite(keys, 'padlock', x + 4 + swing, y + 13);
  } else if (shown > 0) r.sprite(keys, `portcullis-${shown}`, x, y);
}
