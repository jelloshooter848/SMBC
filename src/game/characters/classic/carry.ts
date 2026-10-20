import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import { Entity, type View } from '../../entities/entity';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { MovementProfile } from '../profile';
import type { Enemy } from '../../entities/enemies/enemy';
import { Koopa } from '../../entities/enemies/koopa';
import { Bowser } from '../../entities/enemies/bowser';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import { T, tileDef } from '../../level/tiles';
import type { DamageSource } from '../../rules/damage';
import { startStopwatch, stopwatchRunning } from './freeze';

/**
 * The shared pluck, lift, carry, throw and ride system (Classic Peach, 2026-10-19 report PE-9..PE-14;
 * Toad later as a second profile). A hero's def calls `carryUpdate` from its behaviour's update,
 * `carryRooted` from `rooted`, `carryStands` from `standsOnEnemies`, `carryDrop` from onHurt and
 * `carryVanish` from the pipe, vine, stairs, flagpole and axe hooks. Everything per hero is in its
 * CarryProfile; every number marked (T) in the report is a tuning value.
 */
export interface CarryProfile {
  /** Frames the lift roots the hero (Peach 20, 10 with the Flower). */
  liftFrames(p: Player): number;
  /** Rise caps (px) while carrying, stand and run tiers; absent: no penalty. */
  carryCap?: { stand: number; run: number };
  /** May run while carrying (Attack throws instead when false). */
  carryRun: boolean;
  /** A thrown vegetable's speed ahead (plus half the hero's own), its rise, gravity and fall cap. */
  throwVx: number;
  throwVy: number;
  throwGravity: number;
  throwFall: number;
  /** A thrown enemy's speed ahead. */
  enemyThrowVx: number;
  /** Vegetable damage (Classic units) and a thrown enemy's against Bowser. */
  vegDamage: number;
  enemyBossDamage: number;
  /** May lift the plain brick under the feet (D-PE-3). */
  liftBricks: boolean;
  /** Thrown vegetables fly on through what they kill (the Flower's Power Pluck). */
  pierceVeg(p: Player): boolean;
  /** Which enemies may be ridden and lifted. */
  liftable(e: Enemy): boolean;
  /** Which tiles (by name) may be plucked from. */
  pluckTiles: ReadonlySet<string>;
  /** Plucks in a row before the next is a Stopwatch (5: the 6th), and its freeze length. */
  watchAfter: number;
  watchFrames: number;
  /** Chance of a POW block per pluck. */
  powChance: number;
  /** A vegetable set down lies this many frames. */
  lieFrames: number;
  /** Frames of the throw pose. */
  throwPose: number;
}

export type HeldKind = 'turnip' | 'pow' | 'brick' | 'enemy';
export interface Held {
  kind: HeldKind;
  enemy?: Enemy;
}

interface CarryState {
  /** Frames left of a lift (rooted). */
  lift: number;
  /** What the lift brings up on its last frame. */
  pending: Held | 'watch' | null;
  /** The brick tile to take out at the lift's end (D-PE-3). */
  brickAt: { tx: number; ty: number } | null;
  held: Held | null;
  /** Frames left of the throw pose. */
  throwT: number;
  /** Standing on an enemy at the last update (for the pose). */
  riding: boolean;
}

const states = new WeakMap<Player, CarryState>();

/** The hero's carry state (made on first use). */
export function carryState(p: Player): CarryState {
  let s = states.get(p);
  if (!s) {
    s = { lift: 0, pending: null, brickAt: null, held: null, throwT: 0, riding: false };
    states.set(p, s);
  }
  return s;
}

/** What the hero carries now, or null. */
export function carried(p: Player): Held | null {
  return states.get(p)?.held ?? null;
}
/** In a lift now. */
export function lifting(p: Player): boolean {
  return (states.get(p)?.lift ?? 0) > 0;
}
/** In the throw pose now. */
export function throwing(p: Player): boolean {
  return (states.get(p)?.throwT ?? 0) > 0;
}
/** Stood on an enemy at the last update. */
export function ridingNow(p: Player): boolean {
  return states.get(p)?.riding ?? false;
}

/* ---------- the things ---------- */

const VEG_BASE: ProjectileSpec = {
  kind: 'carry-turnip',
  damage: 'weapon',
  amount: 400,
  speed: 0x04000,
  vy: -0x01000,
  gravity: 0x00200,
  maxFall: 0x04000,
  arc: true,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: null,
  w: 12,
  h: 12,
  sheet: 'peach-items',
  frames: ['turnip'],
  frameRate: 1,
  classicHit: { pierce: 0 },
  onBlocked: 'burst',
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
};

/** The thrown vegetable for profile `cp` (Flower: on through each kill). */
function vegSpec(cp: CarryProfile, kind: 'turnip' | 'pow' | 'brick', pierce: boolean): ProjectileSpec {
  const base: ProjectileSpec = {
    ...VEG_BASE,
    amount: cp.vegDamage,
    vy: cp.throwVy,
    gravity: cp.throwGravity,
    maxFall: cp.throwFall,
    kind: `carry-${kind}`,
    frames: [kind],
  };
  if (kind === 'pow') return { ...base, hitsEnemies: false };
  return pierce && kind === 'turnip' ? { ...base, pierceKillsOnly: true } : base;
}

/** Kinds of this module's thrown things (the one-in-the-air cap). */
const THROWN_KINDS = new Set(['carry-turnip', 'carry-pow', 'carry-brick', 'carry-enemy']);

function drawItem(r: Renderer, view: View, frame: string, x: number, y: number, flip = false): void {
  if (frame === 'brick') {
    const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
    const f = sheet.frames.has(`brick@${view.theme}`) ? `brick@${view.theme}` : 'brick';
    r.sprite(sheet, f, toPx(x) - view.camX, toPx(y));
    return;
  }
  r.sprite(view.assets.sheet('peach-items'), frame, toPx(x) - view.camX, toPx(y), flip);
}

/** A thrown vegetable, brick or POW block (PE-12). */
export class ThrownThing extends Projectile {
  constructor(
    x: number,
    y: number,
    dir: -1 | 1,
    spec: ProjectileSpec,
    owner: Player,
    vx: number,
    readonly what: 'turnip' | 'pow' | 'brick',
  ) {
    super(x, y, dir, spec, owner, { vx, vy: spec.vy ?? 0 });
  }
  override burst(world: World): void {
    if (!this.alive) return;
    const b = this.body;
    if (this.what === 'brick') {
      // It shatters on its first hit or on ground: the four brick pieces, 50 points.
      world.breakPieces(tileAt(b.x + (b.w >> 1) - px(8)), tileAt(b.y + (b.h >> 1) - px(8)));
      world.addScore(50, b.x, b.y);
      world.audio.sfx('break');
    } else if (this.what === 'pow') powJolt(world, this.owner as Player);
    this.destroy();
  }
  override render(r: Renderer, view: View): void {
    drawItem(r, view, this.what, this.body.x - px(2), this.body.y - px(2), this.facing < 0);
  }
}

/** Dropped by a hit: falls straight down and is gone on landing (a POW jolts). PE-13. */
export class DroppedThing extends Projectile {
  constructor(
    x: number,
    y: number,
    owner: Player,
    readonly what: 'turnip' | 'pow' | 'brick',
  ) {
    super(x, y, 1, { ...VEG_BASE, kind: 'carry-drop', hitsEnemies: false, speed: 0, vy: 0 }, owner, {
      vx: 0,
      vy: 0,
    });
  }
  override burst(world: World): void {
    if (!this.alive) return;
    if (this.what === 'pow') powJolt(world, this.owner as Player);
    this.destroy();
  }
  override render(r: Renderer, view: View): void {
    drawItem(r, view, this.what, this.body.x - px(2), this.body.y - px(2));
  }
}

/**
 * A thrown enemy (PE-12): flies in an arc drawn upside down, kills the first enemy it touches
 * outright, armour included, as a kicked shell (Bowser: `enemyBossDamage`), and both flip out. A wall
 * or the ground ends it (it flips out; 100 points at a wall). It passes over blocks.
 */
export class ThrownEnemy extends Projectile {
  constructor(
    x: number,
    y: number,
    dir: -1 | 1,
    readonly enemy: Enemy,
    owner: Player,
    vx: number,
    vy: number,
    gravity: number,
    maxFall: number,
    readonly bossDamage: number,
  ) {
    super(
      x,
      y,
      dir,
      {
        ...VEG_BASE,
        kind: 'carry-enemy',
        hitsEnemies: false,
        vy,
        gravity,
        maxFall,
        w: toPx(enemy.body.w),
        h: toPx(enemy.body.h),
        classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: false },
      },
      owner,
      { vx, vy },
    );
  }
  private flipOut(world: World): void {
    const e = this.enemy;
    e.body.x = this.body.x;
    e.body.y = this.body.y;
    e.classicKill({ kind: 'shell', amount: 1, owner: null, dirX: this.facing }, world);
  }
  override update(world: World): void {
    super.update(world);
    if (!this.alive) return;
    for (const e of world.enemies) {
      if (!overlaps(this.body, e.body)) continue;
      const src: DamageSource = {
        kind: 'weapon',
        amount: this.bossDamage,
        owner: this,
        dirX: this.facing,
        ...(e instanceof Bowser ? {} : { instant: true as const }),
      };
      const r = e.hit(src, world);
      if (r === 'immune') continue;
      world.scoreKill(e, 'shell', r);
      world.audio.sfx('stomp');
      this.flipOut(world);
      this.destroy();
      return;
    }
  }
  override burst(world: World): void {
    if (!this.alive) return;
    if (!this.body.onGround) world.addScore(100, this.body.x, this.body.y);
    this.flipOut(world);
    this.destroy();
  }
  override render(r: Renderer, view: View): void {
    const e = this.enemy;
    if (!e.currentFrame) return;
    r.sprite(
      view.assets.sheet(e.sheet, e.drawPalette(view)),
      e.currentFrame,
      toPx(this.body.x) - view.camX - e.spriteOffsetX,
      toPx(this.body.y) - e.spriteOffsetY,
      this.facing > 0,
      true,
    );
  }
}

/** What the hero carries, drawn over the head (it has no collision of its own, PE-13). */
export class CarriedThing extends Entity {
  readonly kind = 'carried-thing';
  constructor(
    readonly owner: Player,
    readonly held: Held,
  ) {
    super(owner.body.x, owner.body.y - px(16), 16, 16);
    this.despawnMargin = null;
    this.layer = 'front';
    this.follow();
  }
  private follow(): void {
    const ob = this.owner.body;
    const e = this.held.enemy;
    const w = e ? e.body.w : px(16);
    const h = e ? e.body.h : px(16);
    this.body.w = w;
    this.body.h = h;
    this.body.x = ob.x + (ob.w >> 1) - (w >> 1);
    this.body.y = ob.y - h + px(this.owner.powerState === 'small' || this.owner.crouching ? 1 : 2);
  }
  update(): void {
    const s = states.get(this.owner);
    if (!s || s.held !== this.held || this.owner.dead || this.owner.out) return this.destroy();
    this.follow();
  }
  render(r: Renderer, view: View): void {
    const o = this.owner;
    if (o.hidden || (o.frozen && !o.dead)) return;
    this.follow();
    const e = this.held.enemy;
    if (e) {
      e.body.x = this.body.x;
      e.body.y = this.body.y;
      e.facing = o.facing;
      e.render(r, view);
    } else drawItem(r, view, this.held.kind, this.body.x, this.body.y, o.facing < 0);
  }
}

/** A vegetable set down (Down + Attack): lies still, liftable, for `life` frames (PE-12). */
export class LyingThing extends Entity {
  readonly kind = 'lying-thing';
  constructor(
    x: number,
    y: number,
    readonly what: 'turnip' | 'pow' | 'brick',
    private life: number,
  ) {
    super(x, y, 16, 16);
  }
  update(world: World): void {
    if (--this.life <= 0) return this.destroy();
    this.fall(world);
  }
  render(r: Renderer, view: View): void {
    drawItem(r, view, this.what, this.body.x, this.body.y);
  }
}

/** The leaves left in the ground for a moment after a pluck (cosmetic, PE-14). */
export class Sprout extends Entity {
  readonly kind = 'sprout';
  constructor(
    x: number,
    y: number,
    private life = 20,
  ) {
    super(x, y, 8, 4);
  }
  update(): void {
    if (--this.life <= 0) this.destroy();
  }
  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('peach-items'), 'sprout', toPx(this.body.x) - view.camX, toPx(this.body.y));
  }
}

/** The Stopwatch shown over the hero's head for a moment after it is plucked (used at once). */
export class WatchShow extends Entity {
  readonly kind = 'watch-show';
  constructor(
    readonly owner: Player,
    private life = 40,
  ) {
    super(owner.body.x, owner.body.y, 16, 16);
    this.layer = 'front';
    this.despawnMargin = null;
  }
  update(): void {
    if (--this.life <= 0 || this.owner.dead) this.destroy();
  }
  render(r: Renderer, view: View): void {
    const ob = this.owner.body;
    const x = ob.x + (ob.w >> 1) - px(8);
    r.sprite(view.assets.sheet('peach-items'), 'watch', toPx(x) - view.camX, toPx(ob.y) - 18);
  }
}

/* ---------- the world side ---------- */

/** Takes `e` out of the world (kept alive, HP and state kept, PE-11): it does nothing while held. */
function takeEnemy(world: World, e: Enemy): void {
  const i = world.entities.indexOf(e);
  if (i >= 0) world.entities.splice(i, 1);
  e.stopFrames = 0;
  if (e instanceof Koopa && e.wings) {
    // A lifted Paratroopa loses its wings.
    e.wings = false;
    (e as { glide: boolean }).glide = false;
    if (e.state === 'walk') e.body.vx = -e.walkSpeed;
  }
}

/** Puts a held enemy back with feet at `feetY`, centred on `cx`, walking `dir` (it resumes). */
function putEnemy(world: World, e: Enemy, cx: number, feetY: number, dir: -1 | 1): void {
  const b = e.body;
  b.x = cx - (b.w >> 1);
  b.y = feetY - b.h;
  b.vy = 0;
  b.onGround = false;
  b.prevBottom = b.y + b.h;
  e.facing = dir;
  const still = e instanceof Koopa && e.state !== 'walk';
  if (!still && b.vx !== 0) b.vx = dir * Math.abs(b.vx);
  else if (!still && e.kind !== 'bullet-bill') b.vx = dir * e.walkSpeed;
  world.entities.push(e);
}

/**
 * The POW block's jolt (PE-14): the screen shakes 2 px for 16 frames (none with Reduce flashing,
 * World.shake), and every on-screen enemy standing on ground takes the block-bump hit.
 */
export function powJolt(world: World, by: Player): void {
  world.shake(16, 2);
  world.audio.sfx('bump');
  const left = world.camera.x;
  const right = world.camera.right;
  for (const e of world.enemies) {
    const b = e.body;
    if (!b.onGround || b.x + b.w < left || b.x > right) continue;
    const src: DamageSource = {
      kind: 'bump',
      amount: 1,
      owner: null,
      dirX: b.x + (b.w >> 1) < by.centerX ? -1 : 1,
      fromX: b.x + (b.w >> 1),
      by,
    };
    const r = e.hit(src, world);
    world.scoreKill(e, 'bump', r);
  }
}

/** The tile under the hero's centre, just below the feet. */
function tileUnder(p: Player): { tx: number; ty: number } {
  return { tx: tileAt(p.centerX), ty: tileAt(p.feetY) };
}

/** A set-down vegetable under the hero's feet, if any. */
function lyingUnder(p: Player, world: World): LyingThing | null {
  const b = p.body;
  const feet = { x: b.x, y: b.y + b.h - px(4), w: b.w, h: px(6) };
  for (const e of world.entities) if (e instanceof LyingThing && e.alive && overlaps(feet, e.body)) return e;
  return null;
}

/** Special pressed now would start a lift (on the ground or on an enemy, hands free). */
function startsLift(p: Player, input: InputFrame): boolean {
  const s = states.get(p);
  return (
    input.pressed('special') &&
    !(s && (s.held || s.lift > 0)) &&
    (p.body.onGround || (s?.riding ?? false)) &&
    !p.crouching
  );
}

/** CharacterBehaviour.rooted: during a lift (and on its first frame) she cannot walk or jump. */
export function carryRooted(p: Player, input: InputFrame): boolean {
  return lifting(p) || startsLift(p, input);
}

/** CharacterDef.standsOnEnemies: a liftable enemy, out of the water and without a Star. */
export function carryStands(cp: CarryProfile, p: Player, e: Enemy): boolean {
  return !p.inWater && p.star <= 0 && cp.liftable(e);
}

/** Starts a lift of what is under her (PE-10): the enemy ridden, a lying vegetable, a brick, a pluck. */
function startLift(cp: CarryProfile, p: Player, world: World): void {
  const s = carryState(p);
  const ride = world.ridingEnemy(p);
  let pending: CarryState['pending'];
  s.brickAt = null;
  if (ride && cp.liftable(ride)) {
    // Held still under her while she lifts it.
    ride.stopFrames = Math.max(ride.stopFrames, cp.liftFrames(p) + 1);
    pending = { kind: 'enemy', enemy: ride };
    p.scratch._pluck = 0;
  } else {
    const lying = p.body.onGround ? lyingUnder(p, world) : null;
    const at = tileUnder(p);
    const tile = world.map.get(at.tx, at.ty);
    if (lying) {
      lying.destroy();
      pending = { kind: lying.what };
      p.scratch._pluck = 0;
    } else if (!p.body.onGround) return;
    else if (cp.liftBricks && tile === T.BRICK) {
      s.brickAt = at;
      pending = { kind: 'brick' };
      p.scratch._pluck = 0;
    } else if (cp.pluckTiles.has(tileDef(tile).name)) {
      const run = p.scratch._pluck ?? 0;
      if (run >= cp.watchAfter) {
        pending = 'watch';
        p.scratch._pluck = 0;
      } else if (world.rng.float() < cp.powChance) {
        pending = { kind: 'pow' };
        p.scratch._pluck = 0;
      } else {
        pending = { kind: 'turnip' };
        p.scratch._pluck = run + 1;
      }
      world.spawn(new Sprout(tileToSub(at.tx) + px(4), tileToSub(at.ty) - px(4)));
    } else return;
  }
  s.pending = pending;
  s.lift = cp.liftFrames(p);
  p.body.vx = 0;
}

/** The lift's last frame: the thing comes up over her head. */
function finishLift(p: Player, world: World): void {
  const s = carryState(p);
  const pending = s.pending;
  s.pending = null;
  if (!pending) return;
  if (pending === 'watch') {
    // The Stopwatch is used at once (PE-14).
    if (!stopwatchRunning(world)) startStopwatch(world, WATCH_FRAMES.get(p) ?? 300);
    else world.audio.sfx('magic');
    world.spawn(new WatchShow(p));
    return;
  }
  if (pending.kind === 'enemy') {
    const e = pending.enemy as Enemy;
    if (!e.alive || !world.entities.includes(e)) return;
    takeEnemy(world, e);
  }
  if (pending.kind === 'brick' && s.brickAt) {
    world.map.set(s.brickAt.tx, s.brickAt.ty, T.AIR);
    world.brickHp.delete(`${s.brickAt.tx},${s.brickAt.ty}`);
    s.brickAt = null;
  }
  s.held = pending;
  world.spawn(new CarriedThing(p, pending));
  world.audio.sfx('kick');
}

/** The Stopwatch length per hero (set from the profile on each update). */
const WATCH_FRAMES = new WeakMap<Player, number>();

/** Things of hers in the air now (the cap of one, PE-12). */
function inAir(p: Player, world: World): number {
  let n = 0;
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.owner === p && THROWN_KINDS.has(e.kind)) n++;
  return n;
}

/** Throws what she carries ahead (PE-12). */
function throwHeld(cp: CarryProfile, p: Player, world: World): void {
  const s = carryState(p);
  const h = s.held;
  if (!h || inAir(p, world) >= 1) return;
  s.held = null;
  const b = p.body;
  const dir = p.facing;
  const ob = b.y;
  if (h.kind === 'enemy' && h.enemy) {
    const e = h.enemy;
    const x = b.x + (b.w >> 1) - (e.body.w >> 1);
    world.spawn(
      new ThrownEnemy(
        x,
        ob - e.body.h,
        dir,
        e,
        p,
        dir * cp.enemyThrowVx,
        cp.throwVy,
        cp.throwGravity,
        cp.throwFall,
        cp.enemyBossDamage,
      ),
    );
  } else {
    const kind = h.kind as 'turnip' | 'pow' | 'brick';
    const spec = vegSpec(cp, kind, cp.pierceVeg(p));
    const vx = dir * (cp.throwVx + (Math.abs(b.vx) >> 1));
    const x = b.x + (b.w >> 1) - px(spec.w >> 1);
    world.spawn(new ThrownThing(x, ob - px(spec.h), dir, spec, p, vx, kind));
  }
  s.throwT = cp.throwPose;
  world.audio.sfx('kick');
}

/** Down + Attack on the ground: sets it down 12 px ahead (PE-11, PE-12). */
function setDown(cp: CarryProfile, p: Player, world: World): void {
  const s = carryState(p);
  const h = s.held;
  if (!h) return;
  s.held = null;
  const cx = p.centerX + p.facing * px(12);
  if (h.kind === 'enemy' && h.enemy) putEnemy(world, h.enemy, cx, p.feetY, p.facing);
  else world.spawn(new LyingThing(cx - px(8), p.feetY - px(16), h.kind as 'turnip', cp.lieFrames));
  world.audio.sfx('kick');
}

/**
 * A hit (PE-13): what she carries drops straight down (a vegetable or brick is gone on landing, a
 * POW jolts, an enemy resumes), and a lift in progress ends.
 */
export function carryDrop(p: Player, world: World): void {
  const s = states.get(p);
  if (!s) return;
  s.lift = 0;
  s.pending = null;
  s.brickAt = null;
  s.throwT = 0;
  const h = s.held;
  s.held = null;
  if (!h) return;
  const b = p.body;
  if (h.kind === 'enemy' && h.enemy) putEnemy(world, h.enemy, p.centerX, b.y, p.facing);
  else world.spawn(new DroppedThing(b.x + (b.w >> 1) - px(6), b.y - px(12), p, h.kind as 'turnip'));
}

/** A pipe, vine, stairs, the flagpole or the axe (PE-13, D-PE-7): what she carries is gone. */
export function carryVanish(p: Player): void {
  const s = states.get(p);
  if (!s) return;
  s.lift = 0;
  s.pending = null;
  s.brickAt = null;
  const h = s.held;
  s.held = null;
  if (h?.enemy) h.enemy.destroy();
}

/** A fresh life or a co-op drop-in: nothing carried. */
export function carryReset(p: Player): void {
  states.delete(p);
}

/**
 * The profile she moves with now: the base, with the carry caps and no run while carrying
 * (PE-5), or `squat` while a Power Squat is charged (PE-8). Cached per base and coyote setting.
 */
const variants = new WeakMap<MovementProfile, Map<string, MovementProfile>>();
export function carryProfileFor(
  cp: CarryProfile,
  base: MovementProfile,
  now: MovementProfile,
  mode: 'base' | 'carry' | 'squat',
  squat?: MovementProfile['rise'],
): MovementProfile {
  let m = variants.get(base);
  if (!m) {
    m = new Map();
    variants.set(base, m);
  }
  const key = `${mode}:${now.coyoteFrames}`;
  let v = m.get(key);
  if (!v) {
    const rise = base.rise as NonNullable<MovementProfile['rise']>;
    if (mode === 'carry' && cp.carryCap) {
      const [stand, run] = rise.tiers;
      v = {
        ...base,
        coyoteFrames: now.coyoteFrames,
        canRun: cp.carryRun,
        rise: {
          ...rise,
          tiers: [
            { ...(stand as NonNullable<typeof stand>), cap: cp.carryCap.stand },
            { ...(run as NonNullable<typeof run>), cap: cp.carryCap.run },
          ],
        },
      };
    } else if (mode === 'carry') v = { ...base, coyoteFrames: now.coyoteFrames, canRun: cp.carryRun };
    else if (mode === 'squat' && squat)
      v = { ...base, coyoteFrames: now.coyoteFrames, rise: squat, crouchJump: false };
    else v = { ...base, coyoteFrames: now.coyoteFrames };
    m.set(key, v);
  }
  return v;
}

/**
 * The carry part of the hero's update (after movement): the lift's count, then Special lifts and
 * Attack throws (Down + Attack on the ground sets down). Not on a vine (the World never calls
 * update there). Returns true when it used this frame's Attack.
 */
export function carryUpdate(cp: CarryProfile, p: Player, input: InputFrame, world: World): boolean {
  const s = carryState(p);
  WATCH_FRAMES.set(p, cp.watchFrames);
  s.riding = world.ridingEnemy(p) !== null;
  if (s.throwT > 0) s.throwT--;
  if (s.lift > 0) {
    if (--s.lift === 0) finishLift(p, world);
    return false;
  }
  if (s.held) {
    if (input.pressed('attack')) {
      if (input.held('down') && (p.body.onGround || s.riding)) setDown(cp, p, world);
      else throwHeld(cp, p, world);
      return true;
    }
    return false;
  }
  if (input.pressed('special') && p.floatT === 0 && (p.body.onGround || s.riding) && !p.crouching) {
    startLift(cp, p, world);
    // A lift that started counts its first frame now.
    if (s.lift > 0 && --s.lift === 0) finishLift(p, world);
  }
  return false;
}
