import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { moveX, moveY } from '../../entities/body';
import { Explosion } from '../../entities/effects/effects';
import { Pickup, type PickupKind } from '../../entities/objects/pickup';
import type { Player } from '../../entities/player';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import type { World } from '../../world/world';
import { MEGAMAN } from '../../characters/megaman';
import { darkSheet, drawStation, FLASH_PALETTE, MM_SOUNDS } from './art';

/*
 * The station's robots (docs/HEROES.md, Mega Man's mini game): Hopper, Turret and Drone, their
 * pellets, the weapon capsule, the boss shutter and the death-orb burst. They are the mini game's
 * own entity types, made through World's `extraEntities` (stage.ts), so World knows none of them.
 */

/** Damage of an enemy pellet or Dark Mega Man's buster shot (Mega Man's hit points). */
export const SHOT_DAMAGE = 2;

/**
 * Hurts Mega Man by `amount` hit points (his own hits are a fixed 4 through World.hurtPlayer;
 * shots here hurt less and the boss's charge shot more). Mirrors World.hurtPlayer: nothing while
 * he blinks or under the no-damage assist; knockback and a short stun; 0 hit points kills.
 * Returns whether it hurt.
 */
export function hurtHero(world: World, p: Player, amount: number, fromDir: -1 | 1): boolean {
  if (p.dead || p.out || p.invulnerable || world.assist.invulnerable) return false;
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    world.kill(p);
    return true;
  }
  p.invuln = 60;
  p.scratch.chargeT = 0;
  world.audio.sfx('hit');
  const kb = p.def.damage.kind === 'hp' ? p.def.damage.knockback : undefined;
  if (kb) {
    p.body.vx = fromDir * kb.vx;
    p.body.vy = -kb.vy;
    p.body.onGround = false;
    p.stun = 16;
    p.sliding = 0;
    p.activeMelee = null;
  }
  return true;
}

/** What the station's robots take hits from: Mega Man's buster and weapons (and a star). */
export const ROBOT_VULNERABILITY: Vulnerability = {
  buster: 'hp',
  weapon: 'hp',
  fireball: 'hp',
  sword: 'hp',
  bomb: 'hp',
  star: 'kill',
};

/** Is a body on screen (with a margin, px)? */
export function onScreen(world: World, e: Entity, margin = 0): boolean {
  const b = e.body;
  return b.x + b.w > world.camera.x - px(margin) && b.x < world.camera.right + px(margin);
}

/**
 * A station robot: hit points, Mega Man's buster and weapons hurt it, and it blows up in a small
 * explosion (no SMB-style flip) leaving one of Mega Man's drops now and then (his drop table; an
 * E-tank is kept for the weapon screen).
 */
export abstract class Robot extends Enemy {
  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.body.vx = 0;
    this.vulnerability = { ...ROBOT_VULNERABILITY };
    this.stompable = false;
    this.fallsOffLedges = false;
  }

  override hit(src: DamageSource, world: World): Reaction {
    const r = super.hit(src, world);
    if (r === 'hp' && this.alive) this.flash = 6;
    return r;
  }

  /** Frames of the hit flash (the `station-flash` palette; not with reduce flashing). */
  protected flash = 0;
  /** Drawn upside down (a turret hung under a ceiling). */
  protected upsideDown = false;

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('kick');
    this.destroy();
  }

  protected override onKilled(src: DamageSource, world: World): void {
    this.stunned = 0;
    // (An E-tank stays one: the weapon screen on MENU uses it, as Mega Man 2's does.)
    const kind: PickupKind | null = MEGAMAN.drop?.(world.rng, this) ?? null;
    if (kind) world.spawn(new Pickup(this.body.x + (this.body.w >> 1), this.body.y + this.body.h, kind));
    void src;
  }

  /** Nearest live player's centre (subpixels). */
  protected target(world: World): Player {
    return world.nearestPlayer(this.body.x + (this.body.w >> 1));
  }

  protected tick(): void {
    if (this.flash > 0) this.flash--;
  }

  /** Station robots face left: flipped when facing right; pale for a moment after a hit. */
  override render(r: Renderer, view: View): void {
    const palette = this.flash > 0 && !view.reduceFlashing ? FLASH_PALETTE : undefined;
    const x = this.screenX(view);
    drawStation(
      r,
      view.assets,
      this.currentFrame,
      x,
      this.screenY(),
      this.facing > 0,
      palette,
      this.upsideDown,
    );
  }
}

/* ---------- Hopper ---------- */

/** Frames a Hopper crouches between jumps. */
export const HOPPER_WAIT = 46;
/** Hopper jumps: a short hop, then a tall one, toward Mega Man (velocity units). */
const HOPS = [
  { vx: 0x01000, vy: 0x03400 },
  { vx: 0x01400, vy: 0x04c00 },
];
export const HOPPER_HP = 3;

/** A squat spring robot: waits crouched, then jumps toward Mega Man, short and tall in turn. */
export class Hopper extends Robot {
  readonly kind = 'hopper';
  private wait = HOPPER_WAIT;
  private hopVx = 0;
  hops = 0;
  constructor(x: number, y: number) {
    super(x, y, 14, 14, HOPPER_HP);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.currentFrame = 'hopper-0';
  }

  update(world: World): void {
    this.tick();
    if (!this.activated) {
      if (!onScreen(world, this, -8)) return this.fall(world);
      this.activated = true;
    }
    const b = this.body;
    if (b.onGround) {
      b.vx = 0;
      if (--this.wait <= 0) {
        const p = this.target(world);
        this.facing = p.centerX < b.x + (b.w >> 1) ? -1 : 1;
        const hop = HOPS[this.hops++ % HOPS.length] as (typeof HOPS)[number];
        this.hopVx = this.facing * hop.vx;
        b.vy = -hop.vy;
        b.onGround = false;
        this.wait = HOPPER_WAIT;
      }
    } else {
      // The hop's speed holds through the air, so a step met on the way up is hopped onto.
      b.vx = this.hopVx;
      moveX(b, world.map, velToSub(b.vx));
    }
    this.fall(world);
    this.currentFrame = b.onGround ? 'hopper-0' : 'hopper-1';
    if (this.isBelowLevel()) this.destroy();
  }
}

/* ---------- Met ---------- */

/** Frames a Met stays under its hat before it may peek (and only with Mega Man near). */
export const MET_HIDE = 70;
/** Frames it takes to lift its hat, then the frames it stays up (it fires MET_FIRE_AT in). */
export const MET_PEEK = 10;
export const MET_UP = 40;
const MET_FIRE_AT = 8;
/** How near (px, centre to centre) Mega Man must be for a Met to peek. */
export const MET_RANGE = 96;
export const MET_HP = 1;
/** Its shots: 1.5 px a frame, one level and two on a slant up and down (about 27°). */
const MET_SHOT = 0x01800;
const MET_SLANT = { vx: Math.round(MET_SHOT * 0.89), vy: Math.round(MET_SHOT * 0.45) };

export type MetState = 'hide' | 'peek' | 'up';

/**
 * Mega Man 2's Met: a hard hat on the floor. Hidden, its hat turns every shot away (a dink); with
 * Mega Man near it lifts the hat, fires a three-way spread at him (level, up and down a slant) and
 * hides again. One hit while it is up.
 */
export class Met extends Robot {
  readonly kind = 'met';
  state: MetState = 'hide';
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y, 14, 14, MET_HP);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.currentFrame = 'met-0';
  }

  override hit(src: DamageSource, world: World): Reaction {
    if (this.state === 'hide' && src.kind !== 'star') {
      world.audio.sfx(MM_SOUNDS.dink);
      return 'immune';
    }
    return super.hit(src, world);
  }

  update(world: World): void {
    this.tick();
    this.fall(world);
    if (!onScreen(world, this, -8)) {
      this.state = 'hide';
      this.t = 0;
      this.currentFrame = 'met-0';
      return;
    }
    const p = this.target(world);
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    this.facing = p.centerX < cx ? -1 : 1;
    this.t++;
    if (this.state === 'hide') {
      if (this.t >= MET_HIDE && Math.abs(p.centerX - cx) <= px(MET_RANGE)) {
        this.state = 'peek';
        this.t = 0;
      }
    } else if (this.state === 'peek') {
      if (this.t >= MET_PEEK) {
        this.state = 'up';
        this.t = 0;
      }
    } else {
      if (this.t === MET_FIRE_AT) this.fire(world);
      if (this.t >= MET_UP) {
        this.state = 'hide';
        this.t = 0;
      }
    }
    this.currentFrame = this.state === 'hide' ? 'met-0' : 'met-1';
  }

  private fire(world: World): void {
    const b = this.body;
    const x = b.x + (b.w >> 1) - px(3);
    const y = b.y + px(6) - px(3);
    const f = this.facing;
    for (const [vx, vy] of [
      [MET_SHOT, 0],
      [MET_SLANT.vx, -MET_SLANT.vy],
      [MET_SLANT.vx, MET_SLANT.vy],
    ] as const)
      world.spawn(new EnemyShot(x, y, f * vx, vy, PELLET, this));
    world.audio.sfx('fireball');
  }
}

/* ---------- Turret ---------- */

/** Turret cycle (frames): shut (shots bounce off), opening, open firing a burst, then shutting. */
export const TURRET_SHUT = 80;
export const TURRET_OPEN = 10;
export const TURRET_BURST = 3;
export const TURRET_GAP = 14;
const TURRET_AFTER = 24;
export const TURRET_HP = 3;
/** Pellet speed (velocity units: 1.5 px a frame). */
export const PELLET_SPEED = 0x01800;

export type TurretMount = 'floor' | 'ceiling';

/**
 * A gun turret on the floor, or hung upside down under a ceiling. Shut, its armour turns shots
 * away; it opens, fires a burst of three pellets at Mega Man and shuts again. A floor turret never
 * aims down, a ceiling turret never up.
 */
export class Turret extends Robot {
  readonly kind = 'turret';
  t = 0;
  fired = 0;
  constructor(
    x: number,
    y: number,
    readonly mount: TurretMount,
    side: -1 | 1,
  ) {
    super(x, y, 16, 16, TURRET_HP);
    this.facing = side;
    this.upsideDown = mount === 'ceiling';
    this.currentFrame = 'turret-0';
  }

  get open(): boolean {
    return this.t >= TURRET_SHUT + TURRET_OPEN;
  }

  override hit(src: DamageSource, world: World): Reaction {
    if (!this.open && src.kind !== 'star') {
      world.audio.sfx('bump');
      return 'immune';
    }
    return super.hit(src, world);
  }

  update(world: World): void {
    this.tick();
    if (!onScreen(world, this, -16)) {
      this.t = 0;
      return;
    }
    const p = this.target(world);
    const b = this.body;
    this.facing = p.centerX < b.x + (b.w >> 1) ? -1 : 1;
    this.t++;
    const fireAt = TURRET_SHUT + TURRET_OPEN;
    if (this.t >= fireAt && this.fired < TURRET_BURST && (this.t - fireAt) % TURRET_GAP === 0) {
      this.fire(world, p);
      this.fired++;
    }
    if (this.t >= fireAt + TURRET_GAP * (TURRET_BURST - 1) + TURRET_AFTER) {
      this.t = 0;
      this.fired = 0;
    }
    this.currentFrame = this.t >= TURRET_SHUT ? 'turret-1' : 'turret-0';
  }

  private fire(world: World, p: Player): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const cy = this.mount === 'floor' ? b.y + px(6) : b.y + b.h - px(6);
    let dx = p.centerX - cx;
    let dy = p.body.y + (p.body.h >> 1) - cy;
    // A floor turret aims no lower than level, a ceiling turret no higher.
    if (this.mount === 'floor') dy = Math.min(dy, 0);
    else dy = Math.max(dy, 0);
    if (dx === 0 && dy === 0) dx = this.facing;
    const len = Math.max(1, Math.hypot(dx, dy));
    const vx = Math.round((dx / len) * PELLET_SPEED);
    const vy = Math.round((dy / len) * PELLET_SPEED);
    world.spawn(new EnemyShot(cx - px(3), cy - px(3), vx, vy, PELLET, this));
    world.audio.sfx('fireball');
  }
}

/* ---------- Drone ---------- */

export const DRONE_HP = 2;
/** Sideways drift toward Mega Man (velocity units: 0.6 px a frame) and the sway (px, frames). */
const DRONE_DRIFT = 0x00999;
const DRONE_SWAY = 10;
const DRONE_PERIOD = 64;
/** The dive: straight down at 2.5 px a frame, back up at 1.25; then a rest before the next. */
const DIVE_VY = 0x02800;
const RISE_VY = 0x01400;
export const DRONE_REST = 70;

export type DronePhase = 'hover' | 'dive' | 'rise';

/**
 * A flying robot: sways up and down in a sine while drifting toward Mega Man, and when it is over
 * him dives straight down (stopping at the floor), then climbs back to its height.
 */
export class Drone extends Robot {
  readonly kind = 'drone';
  phase: DronePhase = 'hover';
  private age = 0;
  private rest = 30;
  private readonly baseY: number;
  constructor(x: number, y: number) {
    super(x, y, 14, 12, DRONE_HP);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.baseY = y;
    this.currentFrame = 'drone-0';
  }

  update(world: World): void {
    this.tick();
    if (!this.activated) {
      if (!onScreen(world, this, -8)) return;
      this.activated = true;
    }
    const b = this.body;
    const p = this.target(world);
    const dx = p.centerX - (b.x + (b.w >> 1));
    this.age++;
    if (this.phase === 'hover') {
      if (this.rest > 0) this.rest--;
      if (Math.abs(dx) > px(4)) b.x += velToSub(Math.sign(dx) * DRONE_DRIFT);
      if (dx !== 0) this.facing = dx < 0 ? -1 : 1;
      b.y = this.baseY + Math.round(Math.sin((this.age * 2 * Math.PI) / DRONE_PERIOD) * px(DRONE_SWAY));
      if (this.rest === 0 && Math.abs(dx) < px(16) && p.body.y > b.y && p.body.onGround && !p.dead)
        this.phase = 'dive';
    } else if (this.phase === 'dive') {
      b.vy = DIVE_VY;
      moveY(b, world.map, velToSub(b.vy));
      if (b.onGround || b.y > px(13 * 16) - b.h) {
        b.onGround = false;
        this.phase = 'rise';
      }
    } else {
      b.y -= velToSub(RISE_VY);
      if (b.y <= this.baseY) {
        b.y = this.baseY;
        this.age = 0;
        this.phase = 'hover';
        this.rest = DRONE_REST;
      }
    }
    this.currentFrame = `drone-${(world.frame >> 2) & 1}`;
  }
}

/* ---------- Shots ---------- */

export interface ShotSpec {
  kind: string;
  w: number;
  h: number;
  /** Hit points it takes from Mega Man. */
  damage: number;
  /** Station frame, drawn when the art exists; else `colors` (outer, inner) as boxes. */
  frame: string | null;
  colors: [string, string];
}

/** A robot's pellet. */
export const PELLET: ShotSpec = {
  kind: 'pellet',
  w: 6,
  h: 6,
  damage: SHOT_DAMAGE,
  frame: 'pellet',
  colors: ['#f8d878', '#fcfcfc'],
};

/**
 * An enemy shot: flies straight, stops at walls and floors, and hurts Mega Man by its own damage
 * (pellets and Dark Mega Man's buster 2, his charge shot 6) through `hurtHero`.
 */
export class EnemyShot extends Entity {
  readonly kind: string;
  age = 0;
  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    readonly spec: ShotSpec,
    readonly owner: Entity | null,
  ) {
    super(x, y, spec.w, spec.h);
    this.kind = spec.kind;
    this.body.vx = vx;
    this.body.vy = vy;
    this.facing = vx < 0 ? -1 : 1;
    this.layer = 'front';
    this.despawnMargin = 16;
  }

  update(world: World): void {
    const b = this.body;
    this.age++;
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    const cx = tileAt(b.x + (b.w >> 1));
    const cy = tileAt(b.y + (b.h >> 1));
    const off = b.x + b.w < world.camera.x - px(8) || b.x > world.camera.right + px(8);
    if (off || b.y > px(240) || b.y + b.h < 0 || (world.map.isSolid(cx, cy) && this.age > 2))
      return this.destroy();
    for (const p of world.activePlayers()) {
      if (!overlaps(b, p.body)) continue;
      hurtHero(world, p, this.spec.damage, b.vx > 0 ? 1 : -1);
      return this.destroy();
    }
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const { w, h, frame, colors } = this.spec;
    // A station frame (8×8, centred on the body), or two boxes (Dark Mega Man's shots).
    if (frame) drawStation(r, view.assets, frame, x - ((8 - w) >> 1), y - ((8 - h) >> 1));
    else {
      r.rect(x, y, w, h, colors[0]);
      r.rect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2), colors[1]);
    }
  }
}

/* ---------- The weapon capsule ---------- */

/**
 * The weapon capsule: hovers over its spot with a small bob; Mega Man touching it, or passing
 * anywhere above it (so a jump over the pillar cannot skip it), calls `onTake`
 * (the scene unlocks the Saw Disc and shows how to use it) and it is gone.
 */
export class WeaponCapsule extends Entity {
  readonly kind = 'capsule';
  private age = 0;
  constructor(
    x: number,
    y: number,
    private readonly onTake: (p: Player) => void,
  ) {
    super(x, y, 16, 16);
    this.despawnMargin = null;
  }

  update(world: World): void {
    this.age++;
    // Its columns from the top of the screen down to its base: a jump over it still takes it.
    const b = this.body;
    const reach = { x: b.x, y: 0, w: b.w, h: b.y + b.h };
    for (const p of world.activePlayers()) {
      if (!overlaps(reach, p.body)) continue;
      this.destroy();
      this.onTake(p);
      return;
    }
  }

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY() + (view.reduceFlashing ? 0 : ((this.age >> 4) & 1) - 1);
    const glow = !view.reduceFlashing && ((this.age >> 3) & 1) === 1;
    drawStation(r, view.assets, `capsule-${glow ? 1 : 0}`, x, y);
  }
}

/* ---------- Decor ---------- */

/**
 * Station decor (the station sheet's `window`, `console`, `girder`): in front of the bulkhead
 * plating (tiles) and behind the robots and Mega Man; never collides.
 */
export class StationDecor extends Entity {
  readonly kind = 'station-decor';
  constructor(
    readonly frame: string,
    x: number,
    y: number,
  ) {
    super(x, y, 16, 16);
    this.despawnMargin = null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    if (x < -64 || x > 272) return;
    drawStation(r, view.assets, this.frame, x, this.screenY());
  }
}

/* ---------- The boss shutter ---------- */

/** Frames the shutter takes to open or shut. */
export const SHUTTER_FRAMES = 16;

export type ShutterState = 'shut' | 'opening' | 'open' | 'closing';

/**
 * The boss room's shutter: two tiles high in the wall (the map holds solid blocks there). Opening
 * slides it up into the wall and clears the tiles; shutting slides it down and makes them solid
 * again.
 */
export class Shutter extends Entity {
  readonly kind = 'shutter';
  state: ShutterState = 'shut';
  private t = 0;
  constructor(
    readonly tx: number,
    readonly ty: number,
    private readonly solid: number,
    private readonly air: number,
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 32);
    this.despawnMargin = null;
  }

  get done(): boolean {
    return this.state === 'shut' || this.state === 'open';
  }

  open(world: World): void {
    if (this.state !== 'shut') return;
    this.state = 'opening';
    this.t = 0;
    world.audio.sfx('door-open');
  }

  close(world: World): void {
    if (this.state !== 'open') return;
    this.state = 'closing';
    this.t = 0;
    for (let i = 0; i < 2; i++) world.map.set(this.tx, this.ty + i, this.solid);
    world.audio.sfx('door-open');
  }

  update(world: World): void {
    if (this.state === 'opening' && ++this.t >= SHUTTER_FRAMES) {
      this.state = 'open';
      for (let i = 0; i < 2; i++) world.map.set(this.tx, this.ty + i, this.air);
    } else if (this.state === 'closing' && ++this.t >= SHUTTER_FRAMES) this.state = 'shut';
  }

  /** Segments of the shutter showing (of 2): it opens and shuts a segment at a time, NES style. */
  get shown(): number {
    if (this.state === 'shut') return 2;
    if (this.state === 'open') return 0;
    const half = this.t >= SHUTTER_FRAMES / 2;
    return this.state === 'opening' ? (half ? 1 : 2) : half ? 2 : 1;
  }

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    const shown = this.shown;
    // The segments still down sit at the bottom; above them the doorway is dark.
    if (shown < 2 && this.state !== 'open') r.rect(x, y, 16, 32 - shown * 16, '#000');
    for (let i = 0; i < shown; i++) drawStation(r, view.assets, 'shutter', x, y + 32 - (i + 1) * 16);
  }
}

/* ---------- The death-orb burst ---------- */

/** Frames the orbs fly before they are gone. */
export const BURST_FRAMES = 90;

/**
 * Mega Man's death burst (the classic ring of orbs): two rings of eight `death-orb`s (Mega Man's
 * sheet) flying out from a point, the inner ring at half speed; in Dark Mega Man's palette when
 * `dark`.
 */
export class OrbBurst extends Entity {
  readonly kind = 'orb-burst';
  age = 0;
  constructor(
    readonly cx: number,
    readonly cy: number,
    readonly dark = false,
  ) {
    super(cx, cy, 1, 1);
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(): void {
    if (++this.age >= BURST_FRAMES) this.destroy();
  }

  /** Each orb's screen-independent centre (px) at this age. */
  orbs(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const speed of [2, 1]) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        out.push({
          x: toPx(this.cx) + Math.round(Math.cos(a) * speed * this.age),
          y: toPx(this.cy) + Math.round(Math.sin(a) * speed * this.age),
        });
      }
    }
    return out;
  }

  render(r: Renderer, view: View): void {
    const sheet = this.dark ? darkSheet(view.assets) : view.assets.sheet('megaman');
    for (const o of this.orbs()) r.sprite(sheet, 'death-orb', o.x - view.camX - 4, o.y - 4);
  }
}
