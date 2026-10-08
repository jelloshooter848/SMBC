import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { DIRS, DIR_VEC, ROOM_H, ROOM_W, boxesOverlap, type Box, type Dir } from '../../topdown/geometry';
import { Pickup, TdEnemy, TdEntity } from '../../topdown/entity';
import { SPIN_FRAMES, TdHero } from '../../topdown/hero';
import { Explosion, type TdItem } from '../../topdown/items';
import { TopDownWorld } from '../../topdown/world';
import type { TdView } from '../../topdown/view';
import { box, drawPiece, LOOK } from './art';

/*
 * Jason on foot in Blaster Master's overhead mode, on the top-down kit (src/game/topdown): he
 * walks eight ways (no Zelda grid), shoots along the way he faces, throws grenades, and carries
 * the two meters of the original's overhead HUD: GUN (8 levels: each one widens and strengthens
 * the shot, and every hit he takes drops it a level) and POW (8 bars of health).
 */

/** The GUN meter's levels, and where a round starts it. */
export const GUN_LEVELS = 8;
export const GUN_START = 2;
/** POW, Jason's health in bars (a hit costs one or two). */
export const POW_MAX = 8;
/** Bars a POW capsule gives back. */
export const POW_CAPSULE = 3;

/**
 * One level of the GUN meter, Blaster Master style: short pellets at the bottom, double shots,
 * then the wave beam, which at full power goes through walls.
 */
export interface GunLevel {
  /** Shots side by side per press (a double shot; at 7-8 two waves crossing). */
  pellets: 1 | 2;
  /** The wave's swing (px each side; 0 = straight). */
  wave: number;
  /** How far a shot flies (px). */
  range: number;
  damage: number;
  /** Size of the shot's square hit box (px). */
  size: number;
  /** It flies through walls and blocks (full power). */
  through: boolean;
}

const FULL = ROOM_W;

/** GUN levels 1-8 (index 0 is level 1). */
export const GUN_TABLE: readonly GunLevel[] = [
  { pellets: 1, wave: 0, range: 40, damage: 1, size: 4, through: false },
  { pellets: 1, wave: 0, range: 80, damage: 1, size: 4, through: false },
  { pellets: 2, wave: 0, range: 96, damage: 1, size: 4, through: false },
  { pellets: 2, wave: 0, range: FULL, damage: 1, size: 4, through: false },
  { pellets: 1, wave: 8, range: FULL, damage: 2, size: 6, through: false },
  { pellets: 1, wave: 12, range: FULL, damage: 2, size: 8, through: false },
  { pellets: 2, wave: 12, range: FULL, damage: 2, size: 8, through: false },
  { pellets: 2, wave: 16, range: FULL, damage: 3, size: 8, through: true },
];

export function gunLevel(level: number): GunLevel {
  return GUN_TABLE[Math.max(1, Math.min(GUN_LEVELS, level)) - 1] as GunLevel;
}

/** Pixels a shot flies a frame. */
export const SHOT_SPEED = 4;
/** Frames between shots while SHOOT is held (a fresh press fires at once, after FIRE_GAP). */
export const AUTO_FIRE = 12;
export const FIRE_GAP = 6;
/** Volleys in the air at once. */
export const MAX_VOLLEYS = 3;
/** The wave's wavelength (px of flight). */
export const WAVE_LENGTH = 48;
/** Frames Jason shows the shooting pose. */
export const SHOOT_POSE = 8;
/** Jason's walk: pixels on each frame of a 4-frame pattern (1.25 px/frame), on each axis held. */
export const WALK_PATTERN: readonly number[] = [1, 1, 2, 1];
/** After a hit: knocked back this many frames at this many px. */
export const JASON_KNOCK_FRAMES = 6;
export const JASON_KNOCK_PX = 2;
/** How far he slides sideways round a corner he walks into (doorways). */
export const CORNER_SLIDE = 7;

/** Jason's overhead frames (the `sophia` sheet). */
export function jasonFrame(facing: Dir, walkT: number, shooting: boolean): string {
  return shooting ? `jason-o-shoot-${facing}` : `jason-o-${facing}-${(walkT >> 3) & 1}`;
}

/**
 * Jason overhead: walks eight ways at 1.25 px a frame (sliding round corners into doorways),
 * faces the way last pressed, SHOOT fires along his facing (held: auto fire), SPECIAL throws a
 * grenade (the world's item slot). A hit costs POW and drops the GUN meter a level (never below
 * 1); with the no-damage assist he keeps both. POW is the kit's hp (one per bar).
 */
export class Jason extends TdHero {
  /** GUN meter level, 1-8. */
  gun = GUN_START;
  /** Frames until he may fire again; frames left in the shooting pose. */
  fireT = 0;
  shootT = 0;
  private stepT = 0;

  constructor(x: number, y: number, maxHp = POW_MAX) {
    super(x, y, maxHp);
    this.facing = 'up';
  }

  /** Narrower than Link: a 10-px stance fits a doorway with room to spare. */
  override feet(x = this.x, y = this.y): Box {
    return { x: x + 3, y: y + 8, w: 10, h: 8 };
  }

  override hurtbox(): Box {
    return { x: this.x + 3, y: this.y + 2, w: 10, h: 13 };
  }

  /** No sword. */
  override swordBox(): Box | null {
    return null;
  }

  /** One GUN level up (a capsule); false at the top. */
  gunUp(world: TopDownWorld): boolean {
    if (this.gun >= GUN_LEVELS) return false;
    this.gun++;
    world.emit({ type: 'gun', level: this.gun, up: true });
    return true;
  }

  /** One GUN level down (a hit); never below 1. */
  gunDown(world: TopDownWorld): boolean {
    if (this.gun <= 1) return false;
    this.gun--;
    world.emit({ type: 'gun', level: this.gun, up: false });
    return true;
  }

  override hurt(world: TopDownWorld, damage: number, push: Dir): boolean {
    const was = this.hp;
    if (!super.hurt(world, damage, push)) return false;
    if (!world.noDamage() || this.hp < was) this.gunDown(world);
    if (this.kbT > 0) this.kbT = JASON_KNOCK_FRAMES;
    this.fireT = 0;
    this.shootT = 0;
    return true;
  }

  /** Puts him back on his feet (a new life): full POW, blinking for `invuln` frames. */
  revive(x: number, y: number, invuln: number): void {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.dying = 0;
    this.dead = false;
    this.kbT = 0;
    this.invuln = invuln;
    this.fireT = 0;
    this.shootT = 0;
  }

  override update(world: TopDownWorld, input: InputFrame): void {
    if (this.dead) return;
    if (this.dying) {
      super.update(world, input);
      return;
    }
    if (this.invuln > 0) this.invuln--;
    if (this.fireT > 0) this.fireT--;
    if (this.shootT > 0) this.shootT--;
    if (this.kbT > 0) {
      this.kbT--;
      const v = DIR_VEC[this.kbDir];
      this.moveBy(world, v.dx * JASON_KNOCK_PX, 0, false);
      this.moveBy(world, 0, v.dy * JASON_KNOCK_PX, false);
      return;
    }
    // Facing: the way just pressed, else keep one still held.
    for (const d of DIRS) if (input.pressed(d) && input.held(d)) this.facing = d;
    if (!input.held(this.facing)) {
      const d = DIRS.find((k) => input.held(k));
      if (d) this.facing = d;
    }
    if (input.pressed('attack') && this.fireT <= AUTO_FIRE - FIRE_GAP) this.fire(world);
    else if (input.held('attack') && this.fireT === 0) this.fire(world);
    if (input.pressed('special')) world.useItem();
    const dx = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const dy = (input.held('down') ? 1 : 0) - (input.held('up') ? 1 : 0);
    if (dx === 0 && dy === 0) return;
    const step = WALK_PATTERN[this.stepT++ % WALK_PATTERN.length] ?? 1;
    this.walkT++;
    if (dx !== 0 && !this.moveBy(world, dx * step, 0, false) && dy === 0) this.slide(world, dx, 0);
    if (dy !== 0 && !this.moveBy(world, 0, dy * step, false) && dx === 0) this.slide(world, 0, dy);
  }

  /**
   * Walking straight into a wall with an opening just beside (a doorway, a gap between blocks):
   * a pixel toward the opening, as long as it is within CORNER_SLIDE px.
   */
  private slide(world: TopDownWorld, dx: number, dy: number): void {
    for (let k = 1; k <= CORNER_SLIDE; k++)
      for (const s of [-1, 1]) {
        const ox = dx === 0 ? s * k : 0;
        const oy = dy === 0 ? s * k : 0;
        const at = this.feet(this.x + ox + dx, this.y + oy + dy);
        if (world.blocked(at, 'hero', null)) continue;
        if (world.blocked(this.feet(this.x + ox, this.y + oy), 'hero', null)) continue;
        this.moveBy(world, Math.sign(ox), Math.sign(oy), false);
        return;
      }
  }

  /** Fires a volley along his facing at his GUN level (if fewer than MAX_VOLLEYS are out). */
  fire(world: TopDownWorld): boolean {
    const volleys = new Set(
      world.entities.filter((e): e is JasonShot => e instanceof JasonShot && !e.dead).map((s) => s.volley),
    );
    if (volleys.size >= MAX_VOLLEYS) return false;
    const g = gunLevel(this.gun);
    const v = DIR_VEC[this.facing];
    const cx = this.x + 8 + v.dx * 6;
    const cy = this.y + 8 + v.dy * 6;
    const volley = ++volleyCount;
    for (let i = 0; i < g.pellets; i++) {
      const side = g.pellets === 1 ? 0 : i === 0 ? -1 : 1;
      world.add(new JasonShot(cx, cy, this.facing, g, side, volley));
    }
    this.fireT = AUTO_FIRE;
    this.shootT = SHOOT_POSE;
    world.emit({ type: 'shot', level: this.gun });
    return true;
  }

  override render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const x = ox + this.x;
    const y = oy + this.y;
    const sheet = view.sheet(view.sheets.hero);
    if (this.dying >= SPIN_FRAMES) {
      if (this.dead) return;
      const k = Math.min(3, (this.dying - SPIN_FRAMES) >> 3);
      // (booms are 24×24, centred on him)
      drawPiece(r, sheet, `boom-${k}`, x - 4, y - 4, 24, 24, LOOK.boom);
      return;
    }
    // Hurt: blinks (steady with reduce flashing).
    if ((this.invuln > 0 || this.dying) && !view.reduceFlashing && (view.frame & 2) === 0) return;
    const frame = jasonFrame(this.facing, this.walkT, this.shootT > 0);
    // (the sheet draws left as its own frames; a missing one falls back to right, flipped)
    if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y);
    else if (this.facing === 'left' && sheet?.frames.has(frame.replace('left', 'right')))
      r.sprite(sheet, frame.replace('left', 'right'), x, y, true);
    else {
      box(r, x + 3, y + 5, 10, 11, LOOK.jason);
      box(r, x + 4, y, 8, 7, LOOK.jasonHelmet);
      const v = DIR_VEC[this.facing];
      r.rect(x + 7 + v.dx * 6, y + 8 + v.dy * 7, 2, 2, '#fca044');
    }
  }
}

let volleyCount = 0;

/** The shot's look by GUN level: the low pellet (1-3), the mid shot (4-6), the top ring (7-8). */
export function shotTier(level: number): 0 | 1 | 2 {
  return level >= 7 ? 2 : level >= 4 ? 1 : 0;
}

/**
 * One of Jason's shots: flies along his facing at SHOT_SPEED for its level's range, swinging
 * side to side on a wave level (two waves cross at 7-8), side by side on a double level. Hits the
 * first mutant it touches (gone after), stops at walls and blocks unless it flies through them
 * (level 8), and at the room's edge.
 */
export class JasonShot extends TdEntity {
  override layer = 2;
  flown = 0;
  readonly damage: number;
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(
    cx: number,
    cy: number,
    readonly dir: Dir,
    readonly gun: GunLevel,
    /** -1 / 1: the left or right of a pair (the wave's phase), 0 alone. */
    readonly side: -1 | 0 | 1,
    readonly volley: number,
  ) {
    super(0, 0);
    this.w = gun.size;
    this.h = gun.size;
    this.damage = gun.damage;
    this.baseX = cx;
    this.baseY = cy;
    this.place();
  }

  /** How far it swings off its line now (across the flight). */
  private swing(): number {
    const g = this.gun;
    if (g.wave === 0) return this.side * 5;
    const phase = this.side < 0 ? Math.PI : 0;
    return Math.round(Math.sin((this.flown / WAVE_LENGTH) * 2 * Math.PI + phase) * g.wave);
  }

  private place(): void {
    const v = DIR_VEC[this.dir];
    const s = this.swing();
    const cx = this.baseX + v.dx * this.flown + (v.dx === 0 ? s : 0);
    const cy = this.baseY + v.dy * this.flown + (v.dy === 0 ? s : 0);
    this.x = Math.round(cx - this.w / 2);
    this.y = Math.round(cy - this.h / 2);
  }

  override hurtbox(): Box {
    return this.body();
  }

  update(world: TopDownWorld): void {
    this.flown += SHOT_SPEED;
    this.place();
    if (this.hit(world)) return;
    const b = this.body();
    const off = b.x + b.w < 0 || b.y + b.h < 0 || b.x > ROOM_W || b.y > ROOM_H;
    if (off || this.flown >= this.gun.range) this.dead = true;
    else if (!this.gun.through && world.blocked(b, 'shot', this)) this.dead = true;
  }

  /** The first living mutant it touches takes the hit; the shot is spent either way. */
  private hit(world: TopDownWorld): boolean {
    const me = this.body();
    for (const e of world.entities) {
      // (a solid one, a turret, is hit anywhere on its body: the shot can't get past it)
      if (!(e instanceof TdEnemy) || e.dead || !boxesOverlap(me, e.solid ? e.body() : e.hurtbox())) continue;
      e.hurt(world, this.damage, this.dir);
      this.dead = true;
      return true;
    }
    return false;
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const sheet = view.sheet(view.sheets.hero);
    const f = `gun-shot-${shotTier(GUN_TABLE.indexOf(this.gun) + 1)}`;
    // (8×8 frames, centred on the shot; they face right)
    if (sheet?.frames.has(f)) {
      const x = ox + this.x + this.w / 2 - 4;
      const y = oy + this.y + this.h / 2 - 4;
      r.sprite(sheet, f, Math.round(x), Math.round(y), this.dir === 'left');
    } else box(r, ox + this.x, oy + this.y, this.w, this.h, this.gun.wave ? LOOK.wave : LOOK.shot);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Grenades                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** A grenade flies this many frames at GRENADE_SPEED (or until it meets a wall or a mutant). */
export const GRENADE_FLIGHT = 18;
export const GRENADE_SPEED = 2;
/** Its blast: reach from the middle, damage to mutants (Jason is never hurt by his own). */
export const GRENADE_RADIUS = 22;
export const GRENADE_DAMAGE = 3;
/** How long the blast is drawn. */
export const GRENADE_BLAST_FRAMES = 24;

/** The grenade's blast: hurts mutants and opens cracked walls on its first frame, never Jason. */
export class GrenadeBlast extends Explosion {
  constructor(cx: number, cy: number) {
    super(cx, cy, GRENADE_RADIUS, GRENADE_DAMAGE, 0);
  }
  override render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const sheet = view.sheet(view.sheets.hero);
    const k = Math.min(3, Math.floor((this.t * 4) / GRENADE_BLAST_FRAMES));
    const x = ox + this.cx - 16;
    const y = oy + this.cy - 16;
    if (sheet?.frames.has(`boom-${k}`)) {
      // Four 24×24 booms overlapping make the 40-px blast.
      for (const [dx, dy] of [
        [-4, -4],
        [12, -4],
        [-4, 12],
        [12, 12],
      ] as const)
        r.sprite(sheet, `boom-${k}`, x + dx, y + dy);
    } else box(r, x + 4 + k, y + 4 + k, 24 - 2 * k, 24 - 2 * k, LOOK.boom);
  }
}

/**
 * A thrown grenade (Blaster Master's overhead grenades: as many as he likes, one in the air at a
 * time): it skips along his facing and goes off at the end of its flight, or as soon as it meets
 * a wall or a mutant.
 */
export class Grenade extends TdEntity {
  override layer = 2;
  override w = 8;
  override h = 8;
  t = 0;
  constructor(
    x: number,
    y: number,
    readonly dir: Dir,
  ) {
    super(x, y);
  }
  override hurtbox(): Box {
    return this.body();
  }
  update(world: TopDownWorld): void {
    this.t++;
    const v = DIR_VEC[this.dir];
    const moved = world.moveEntity(this, v.dx * GRENADE_SPEED, v.dy * GRENADE_SPEED, 'shot');
    const me = this.body();
    const struck = world.entities.some(
      (e) => e instanceof TdEnemy && !e.dead && boxesOverlap(me, e.hurtbox()),
    );
    if (moved && !struck && this.t < GRENADE_FLIGHT) return;
    this.dead = true;
    const blast = new GrenadeBlast(this.x + 4, this.y + 4);
    world.add(blast);
    world.emit({ type: 'blast' });
    blast.update(world); // it goes off this frame
  }
  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    // A low arc over its flight (drawn only: it hits along the floor).
    const lift = Math.round(Math.sin((Math.min(this.t, GRENADE_FLIGHT) / GRENADE_FLIGHT) * Math.PI) * 6);
    const sheet = view.sheet(view.sheets.hero);
    const f = view.reduceFlashing ? 'grenade-0' : `grenade-${(view.frame >> 2) & 1}`;
    drawPiece(r, sheet, f, ox + this.x, oy + this.y - lift, 8, 8, LOOK.grenade);
  }
}

/** Grenades: SPECIAL throws one along Jason's facing; no ammo (the original's are endless). */
export const GRENADE: TdItem = {
  id: 'grenade',
  label: 'GRENADE',
  icon: 'grenade-0',
  ready: (w) => !w.entities.some((e) => (e instanceof Grenade || e instanceof GrenadeBlast) && !e.dead),
  use: (w) => {
    const h = w.hero;
    const v = DIR_VEC[h.facing];
    w.add(new Grenade(h.x + 4 + v.dx * 8, h.y + 6 + v.dy * 8, h.facing));
    w.emit({ type: 'toss' });
    return true;
  },
};

export const UNDERWORLD_ITEMS: Readonly<Record<string, TdItem>> = { grenade: GRENADE };

/* ------------------------------------------------------------------------------------------ */
/* Capsules                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export type CapsuleKind = 'gun' | 'pow';
/** Frames a dropped capsule lies there, the last CAPSULE_BLINK of them blinking. */
export const CAPSULE_LIFE = 420;
export const CAPSULE_BLINK = 120;

/**
 * A capsule, Blaster Master style: G raises the GUN meter a level, P gives back POW_CAPSULE bars
 * of POW. Dropped ones last CAPSULE_LIFE frames (blinking toward the end; dimmed instead with
 * reduce flashing); placed ones stay until taken.
 */
export class Capsule extends Pickup {
  constructor(
    x: number,
    y: number,
    kind: CapsuleKind,
    public life = Infinity,
  ) {
    super(x, y, kind);
  }
  override update(): void {
    if (--this.life <= 0) this.dead = true;
  }
  override render(r: Renderer, view: TdView, ox: number, oy: number): void {
    if (this.hidden) return;
    const ending = this.life < CAPSULE_BLINK;
    if (ending && !view.reduceFlashing && (view.frame & 4) === 0) return;
    const sheet = view.sheet(view.sheets.enemies);
    const frame = `${this.kind}-capsule`;
    const x = ox + this.x;
    const y = oy + this.y;
    if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y);
    else {
      box(r, x + 2, y + 2, 12, 12, this.kind === 'gun' ? LOOK.gun : LOOK.pow);
      const font = view.sheet('font');
      if (font) r.text(font, this.kind === 'gun' ? 'G' : 'P', x + 4, y + 4);
    }
    if (ending && view.reduceFlashing) r.rect(x + 2, y + 2, 12, 12, 'rgba(0,0,0,0.4)');
  }
}

/* ------------------------------------------------------------------------------------------ */
/* The world                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** The top-down world with Jason in it: capsules feed his GUN and POW meters. */
export class UnderworldWorld extends TopDownWorld {
  get jason(): Jason {
    return this.hero as Jason;
  }

  override grant(what: string): void {
    if (what === 'gun') {
      this.jason.gunUp(this);
      this.emit({ type: 'pickup', kind: what });
      return;
    }
    if (what === 'pow') {
      this.hero.heal(POW_CAPSULE);
      this.emit({ type: 'pickup', kind: what });
      return;
    }
    super.grant(what);
  }
}
