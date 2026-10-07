import type { Renderer } from '@engine/gfx/renderer';
import { overlaps, type AABB } from '@engine/math/aabb';
import { px, tileToSub, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { moveX, moveY } from '../../entities/body';
import { Explosion } from '../../entities/effects/effects';
import type { DamageSource, Reaction } from '../../rules/damage';
import type { World } from '../../world/world';
import { drawZebes, ZEBES_FLASH, ZEBES_RED } from './art';
import { Creature, CREATURE_VULNERABILITY } from './creatures';

/*
 * Tourian's doors, barriers, brain and guards (docs/HEROES.md, Samus's mini game), as in the NES
 * Metroid's last area, in our own design: bubble doors that a shot opens (red ones only to
 * missiles) and that lead on to the next room; the Zebetite-like barriers that feed the brain,
 * which only missiles wear down and which grow back if left; the brain in its glass tank; the
 * ceiling cannons firing in turn; and the Rinkas, rings that leave their spawners and fly straight
 * at Samus through the rock. They are the mini game's own entity types (stage.ts) and act only
 * in the room Samus is in.
 */

/** What Tourian's entities ask of the scene. */
export interface TourianHooks {
  /** The entity is in the room on screen (guards elsewhere hold still). */
  active(e: Entity): boolean;
  /** The brain is dead and the escape is on: the guards stop. */
  calm(): boolean;
  /** Samus walked into an open door. */
  onDoor(door: Door, world: World): void;
  /** The brain was destroyed. */
  onBrain(brain: BrainTank, world: World): void;
}

/** Keeps the players out of `box` sideways (a closed door, a barrier, the tank): it is a wall to them. */
function blockPlayers(world: World, box: AABB): void {
  for (const p of world.activePlayers()) {
    const b = p.body;
    if (!overlaps(b, box)) continue;
    if (b.x + (b.w >> 1) < box.x + (box.w >> 1)) {
      b.x = box.x - b.w;
      if (b.vx > 0) b.vx = 0;
    } else {
      b.x = box.x + box.w;
      if (b.vx < 0) b.vx = 0;
    }
  }
}

/**
 * A fixture that takes shots but is no creature: never scored, never stomped, harmless to touch;
 * every hit reports 'immune' so the shot bursts on it.
 */
abstract class Fixture extends Enemy {
  /** Frames of the hit flash (not with reduce flashing). */
  flash = 0;
  constructor(x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
    this.contactHurts = false;
    this.stompable = false;
    this.fallsOffLedges = false;
    this.despawnMargin = null;
    this.body.vx = 0;
    this.vulnerability = {};
  }

  override hit(src: DamageSource, world: World): Reaction {
    this.struck(src, world);
    return 'immune';
  }

  /** A shot or blast reached it. */
  protected abstract struck(src: DamageSource, world: World): void;

  protected tickFlash(): void {
    if (this.flash > 0) this.flash--;
  }

  protected tint(view: View, base?: string): string | undefined {
    return this.flash > 0 && !view.reduceFlashing ? ZEBES_FLASH : base;
  }
}

/** A missile (Samus's MISSILE spec deals `weapon` damage). */
const isMissile = (src: DamageSource) => src.kind === 'weapon';
/** Anything of Samus's that opens a blue door: beams (any), missiles, bombs. */
const opensBlue = (src: DamageSource) =>
  src.kind === 'buster' || src.kind === 'ice' || src.kind === 'weapon' || src.kind === 'bomb';

/* ---------- Doors ---------- */

/** Frames a door stays open before its bubble closes again (unless Samus is in it). */
export const DOOR_OPEN_FRAMES = 240;
/** Missiles a red door takes (the NES Metroid's red doors take five). */
export const DOOR_RED_MISSILES = 5;

export type DoorColor = 'blue' | 'red';

/**
 * A bubble door (16x48) in a gap of a room's wall, paired with the next room's door beside it. A
 * blue one opens to any shot, a red one to its fifth missile (and is a plain door from then on).
 * Closed, it is a wall; open, Samus walks in and the scene scrolls her into the next room, where
 * both bubbles close behind her. Left open, it closes again by itself.
 */
export class Door extends Fixture {
  readonly kind = 'door';
  open = false;
  /** Frames until it closes. */
  openFor = 0;
  /** Missiles a red door has taken. */
  hits = 0;
  constructor(
    readonly tx: number,
    readonly ty: number,
    public color: DoorColor,
    private readonly hooks: TourianHooks,
    private readonly doors: Map<string, Door>,
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 48);
    this.layer = 'front';
    doors.set(`${tx},${ty}`, this);
  }

  /** The other bubble of this door (the next room's), once spawned. */
  get pair(): Door | null {
    return this.doors.get(`${this.tx - 1},${this.ty}`) ?? this.doors.get(`${this.tx + 1},${this.ty}`) ?? null;
  }

  /** Which way going through it leads: +1 right (its pair is to its right), -1 left. */
  get leads(): -1 | 1 {
    return this.doors.has(`${this.tx + 1},${this.ty}`) ? 1 : -1;
  }

  protected override struck(src: DamageSource, world: World): void {
    if (this.open) return;
    if (this.color === 'red') {
      if (!isMissile(src)) return;
      this.flash = 8;
      if (++this.hits < DOOR_RED_MISSILES) {
        world.audio.sfx('bump');
        return;
      }
      this.color = 'blue';
      const pair = this.pair;
      if (pair) pair.color = 'blue';
    } else if (!opensBlue(src)) return;
    this.openUp(world);
  }

  /** The bubble pops: open for a while. */
  openUp(world: World | null): void {
    this.open = true;
    this.openFor = DOOR_OPEN_FRAMES;
    world?.audio.sfx('door-open');
  }

  close(): void {
    this.open = false;
    this.openFor = 0;
  }

  update(world: World): void {
    this.tickFlash();
    if (!this.open) {
      blockPlayers(world, this.body);
      return;
    }
    const p = world.player;
    const inIt = !p.dead && overlaps(p.body, this.body);
    // Into the door: her centre past its near edge, going its way.
    if (inIt && this.hooks.active(this)) {
      const cx = p.body.x + (p.body.w >> 1);
      const into = this.leads > 0 ? cx >= this.body.x + px(4) : cx <= this.body.x + this.body.w - px(4);
      if (into) {
        this.hooks.onDoor(this, world);
        return;
      }
    }
    if (--this.openFor <= 0 && !inIt) this.close();
    else if (this.openFor < 0) this.openFor = 0;
  }

  override render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    if (this.open) return drawZebes(r, view.assets, 'bubble-door-open', x, y);
    drawZebes(
      r,
      view.assets,
      'bubble-door',
      x,
      y,
      false,
      false,
      this.tint(view, this.color === 'red' ? ZEBES_RED : undefined),
    );
  }
}

/* ---------- Zebetites ---------- */

/** Missiles a barrier takes. */
export const ZEBETITE_HITS = 4;
/** Frames after its last hit before a damaged barrier grows back one stage. */
export const ZEBETITE_REGEN = 150;

/**
 * A barrier (16x48) feeding the brain, in a gap under a wall from the ceiling: a wall to Samus
 * until broken. Beams and bombs glance off; each missile wears it down a stage; left alone it
 * grows back a stage at a time.
 */
export class Zebetite extends Fixture {
  readonly kind = 'zebetite';
  hits = 0;
  private since = 0;
  constructor(tx: number, ty: number) {
    super(tileToSub(tx), tileToSub(ty), 16, 48);
  }

  protected override struck(src: DamageSource, world: World): void {
    if (!isMissile(src)) return;
    this.flash = 8;
    this.since = 0;
    if (++this.hits < ZEBETITE_HITS) {
      world.audio.sfx('hurt-enemy');
      return;
    }
    const b = this.body;
    for (let i = 0; i < 3; i++) world.spawn(new Explosion(b.x + px(8), b.y + px(8 + i * 16), true));
    world.audio.sfx('break');
    this.destroy();
  }

  update(world: World): void {
    this.tickFlash();
    if (this.hits > 0 && ++this.since >= ZEBETITE_REGEN) {
      this.hits--;
      this.since = 0;
    }
    blockPlayers(world, this.body);
  }

  override render(r: Renderer, view: View): void {
    drawZebes(
      r,
      view.assets,
      `zebetite-${Math.min(3, this.hits)}`,
      this.screenX(view),
      this.screenY(),
      false,
      false,
      this.tint(view),
    );
  }
}

/* ---------- The brain ---------- */

/** Missiles the brain takes. */
export const BRAIN_HITS = 6;
/** Frames the brain's tank goes on exploding once it is destroyed. */
export const BRAIN_BOOM_FRAMES = 60;

/**
 * The brain in its glass tank (48x64, on the floor under a wall to the ceiling): a wall to Samus
 * while it lives. Beams glance off the glass; missiles crack it and hurt the brain; the last one
 * destroys it (explosions, the glass gone, the way past it open) and the scene sets the time bomb.
 */
export class BrainTank extends Fixture {
  readonly kind = 'brain';
  hits = 0;
  defeated = false;
  private boom = 0;
  private readonly rng = new Rng(77);
  constructor(
    tx: number,
    ty: number,
    private readonly hooks: TourianHooks,
  ) {
    super(tileToSub(tx), tileToSub(ty), 48, 64);
  }

  protected override struck(src: DamageSource, world: World): void {
    if (this.defeated || !isMissile(src)) return;
    this.flash = 10;
    if (++this.hits < BRAIN_HITS) {
      world.audio.sfx('hurt-enemy');
      return;
    }
    this.defeated = true;
    this.boom = BRAIN_BOOM_FRAMES;
    world.audio.sfx('explosion');
    this.hooks.onBrain(this, world);
  }

  /**
   * Destroyed, the brain is dead and gone (from the start of a life after the bomb, too): on its
   * next update it leaves its wreck.
   */
  destroyed(): void {
    this.defeated = true;
    this.hits = BRAIN_HITS;
    this.boom = 0;
  }

  update(world: World): void {
    this.tickFlash();
    if (!this.defeated) {
      blockPlayers(world, this.body);
      return;
    }
    // Done exploding: the tank gives way to its wreck, which no shot stops on.
    if (this.boom === 0) {
      world.spawn(new TankWreck(this.body.x, this.body.y));
      this.destroy();
      return;
    }
    if (this.boom > 0) {
      this.boom--;
      if (this.boom % 8 === 0) {
        const b = this.body;
        world.spawn(
          new Explosion(
            b.x + px(8 + this.rng.int(32)),
            b.y + px(16 + this.rng.int(40)),
            this.boom % 16 !== 0,
          ),
        );
      }
    }
  }

  override render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    if (this.defeated && this.boom === 0) return drawZebes(r, view.assets, 'tank-broken', x, y);
    // The brain pulses (slowly; still with reduce flashing), then the glass over it.
    const pulse = view.reduceFlashing ? 0 : (view.frame >> 4) & 1;
    drawZebes(r, view.assets, `brain-${pulse}`, x + 8, y + 24, false, false, this.tint(view));
    drawZebes(r, view.assets, this.hits * 2 >= BRAIN_HITS ? 'tank-cracked' : 'tank', x, y);
  }
}

/** What is left of the tank: glass on the floor, scenery behind Samus (no shot stops on it). */
export class TankWreck extends Entity {
  readonly kind = 'tank-wreck';
  constructor(x: number, y: number) {
    super(x, y, 48, 64);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  update(): void {}

  render(r: Renderer, view: View): void {
    drawZebes(r, view.assets, 'tank-broken', this.screenX(view), this.screenY());
  }
}

/* ---------- Cannons ---------- */

/** Frames between a cannon's shots, and its aims in turn (down-left, down, down-right, down). */
export const CANNON_EVERY = 90;
export const CANNON_AIMS: readonly (-1 | 0 | 1)[] = [-1, 0, 1, 0];
/** A cannon shot's speed (velocity units: 1.5 px a frame). */
export const CANNON_SHOT_SPEED = 0x01800;

/**
 * A ceiling cannon (16x16, hung under the ceiling by its tile): it cannot be destroyed; while
 * Samus is in its room it fires a shot every CANNON_EVERY frames, turning its barrel each time.
 */
export class Cannon extends Fixture {
  readonly kind = 'cannon';
  /** Shots fired so far. */
  fired = 0;
  private t = 0;
  constructor(
    tx: number,
    ty: number,
    private readonly hooks: TourianHooks,
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 16);
    this.t = (tx * 37) % CANNON_EVERY;
  }

  protected override struck(): void {}

  /** Where its barrel points now (-1 down-left, 0 down, 1 down-right). */
  get aim(): -1 | 0 | 1 {
    return CANNON_AIMS[this.fired % CANNON_AIMS.length] as -1 | 0 | 1;
  }

  update(world: World): void {
    if (this.hooks.calm() || !this.hooks.active(this)) return;
    if (++this.t < CANNON_EVERY) return;
    this.t = 0;
    const aim = this.aim;
    const b = this.body;
    const diag = aim === 0 ? 1 : Math.SQRT1_2;
    world.spawn(
      new CannonShot(
        b.x + px(8 + aim * 7),
        b.y + px(14),
        Math.round(aim * CANNON_SHOT_SPEED * diag),
        Math.round(CANNON_SHOT_SPEED * diag),
        this.hooks,
      ),
    );
    this.fired++;
  }

  override render(r: Renderer, view: View): void {
    drawZebes(r, view.assets, `cannon-${this.aim + 1}`, this.screenX(view), this.screenY());
  }
}

/**
 * A cannon's shot: straight on, gone on the rock or out of its room (through a door's gap); it
 * hurts Samus as a touch does.
 */
export class CannonShot extends Entity {
  readonly kind = 'cannon-shot';
  constructor(
    cx: number,
    cy: number,
    vx: number,
    vy: number,
    private readonly hooks?: TourianHooks,
  ) {
    super(cx - px(3), cy - px(3), 6, 6);
    this.body.vx = vx;
    this.body.vy = vy;
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(world: World): void {
    const b = this.body;
    moveX(b, world.map, velToSub(b.vx));
    moveY(b, world.map, velToSub(b.vy));
    if (b.hitWall !== 0 || b.onGround || b.hitHead || this.isBelowLevel()) return this.destroy();
    if (this.hooks && !this.hooks.active(this)) return this.destroy();
    for (const p of world.activePlayers()) {
      if (overlaps(p.body, b)) {
        world.hurtPlayer(p, b.vx >= 0 ? 1 : -1);
        this.destroy();
        return;
      }
    }
  }

  render(r: Renderer, view: View): void {
    // A white-hot core in an orange glow; one colour with reduce flashing.
    const x = this.screenX(view);
    const y = this.screenY();
    r.rect(x, y, 6, 6, '#e45c10');
    if (view.reduceFlashing || ((view.frame >> 2) & 1) === 0) r.rect(x + 2, y + 2, 2, 2, '#fcfcfc');
  }
}

/* ---------- Rinkas ---------- */

/** A Rinka's speed (velocity units: 1 px a frame), its pause on coming out, and the wait for the next. */
export const RINKA_SPEED = 0x01000;
export const RINKA_EMERGE = 8;
export const RINKA_RESPAWN = 90;
/** The first Rinka's wait after Samus comes into the room. */
export const RINKA_FIRST = 40;

/**
 * A ring that comes out of its spawner, pauses a moment, then flies straight at where Samus was,
 * through the rock, until it leaves the room. One beam shot (or anything) downs it, and it may
 * leave energy or missiles behind, as Metroid's did.
 */
export class Rinka extends Creature {
  readonly kind = 'rinka';
  private t = 0;
  constructor(
    cx: number,
    cy: number,
    private readonly hooks: TourianHooks,
  ) {
    super(cx - px(8), cy - px(8), 16, 16, 1);
    this.vulnerability = { ...CREATURE_VULNERABILITY, ice: 'kill' };
    this.currentFrame = 'rinka-0';
  }

  update(world: World): void {
    this.tickFlash();
    if (!this.hooks.active(this) || this.hooks.calm()) return this.destroy();
    const b = this.body;
    if (++this.t === RINKA_EMERGE) {
      const p = world.player;
      const dx = p.body.x + (p.body.w >> 1) - (b.x + (b.w >> 1));
      const dy = p.body.y + (p.body.h >> 1) - (b.y + (b.h >> 1));
      const len = Math.max(1, Math.hypot(dx, dy));
      b.vx = Math.round((dx / len) * RINKA_SPEED);
      b.vy = Math.round((dy / len) * RINKA_SPEED);
    }
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    this.currentFrame = `rinka-${(world.frame >> 3) & 1}`;
  }
}

/**
 * Where Rinkas come from (a point in the rock): while Samus is in its room and its last Rinka is
 * gone, it sends out another after a wait.
 */
export class RinkaSpawner extends Entity {
  readonly kind = 'rinka-spawner';
  /** Its Rinka in flight. */
  child: Rinka | null = null;
  private wait = RINKA_FIRST;
  constructor(
    tx: number,
    ty: number,
    private readonly hooks: TourianHooks,
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 16);
    this.despawnMargin = null;
    this.layer = 'back';
  }

  update(world: World): void {
    if (this.hooks.calm()) return;
    if (!this.hooks.active(this)) {
      this.wait = RINKA_FIRST;
      return;
    }
    if (this.child?.alive) return;
    if (this.child) {
      this.child = null;
      this.wait = RINKA_RESPAWN;
    }
    if (--this.wait > 0) return;
    const b = this.body;
    this.child = new Rinka(b.x + px(8), b.y + px(8), this.hooks);
    world.spawn(this.child);
  }

  render(): void {}
}
