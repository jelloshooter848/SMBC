import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import { CONTRA_FLASH, drawContra, box, JUNGLE_THEME, LOOK, tileSheet } from './art';
import type { Box, Jungle } from './jungle';
import { C, TILE, WATER_Y, type WeaponId } from './stage';

/*
 * Jungle Assault's foes, pickups and set pieces, all original designs in NES Contra's style:
 * running soldiers and riflemen (Red Falcon's possessed troops), rotating wall guns, pop-up
 * cannons, flying weapon capsules and pillbox sensors (shot open, they leave a falcon), the
 * exploding bridges and the explosions. The contra sheet's foes face LEFT (flipped for right).
 */

/** What a piece draws with. */
export interface Paint {
  r: Renderer;
  assets: AssetRegistry;
  camX: number;
  /** Frames since the round began (animation). */
  t: number;
  /** Reduce flashing: no strobing lights, flashes or blinking. */
  rf: boolean;
}

export abstract class Thing {
  alive = true;
  abstract readonly kind: string;
  /** Centre x and bottom y (px; flyers: their centre). */
  x: number;
  y: number;
  t = 0;
  /** Kept when it scrolls off the left (bridges, boss parts). */
  pinned = false;
  /** Absorbs Bill's shots without harm (the wall's armour, checked after everything else). */
  shield = false;
  /** Dies touching the barrier (B). */
  frail = false;
  /** Drawn behind the foes (set pieces). */
  back = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  /** Where Bill's shots hit it (null: they pass by). */
  hurtBox(): Box | null {
    return null;
  }
  /** Touching it kills Bill. */
  harmBox(): Box | null {
    return null;
  }
  hit(_damage: number, _j: Jungle): void {}
  abstract update(j: Jungle): void;
  abstract render(p: Paint, j: Jungle): void;
}

/** A foe with hit points: hits sound, the last one blows it up. */
export abstract class Foe extends Thing {
  hp: number;
  hurtT = 0;
  constructor(x: number, y: number, hp: number) {
    super(x, y);
    this.hp = hp;
  }
  override hit(damage: number, j: Jungle): void {
    if (this.hp <= 0 || !this.alive) return;
    this.hp -= damage;
    this.hurtT = 6;
    if (this.hp <= 0) this.die(j);
    else j.sound('hit');
  }
  die(j: Jungle): void {
    this.alive = false;
    j.boom(this.x, this.boomY(), false);
  }
  /** Where its explosion goes (px). */
  boomY(): number {
    return this.y - 14;
  }
  tick(): void {
    this.t++;
    if (this.hurtT > 0) this.hurtT--;
  }
  /** The hit flash's palette while it is hurt (never with reduce flashing). */
  flash(p: Paint): string | undefined {
    return this.hurtT > 0 && !p.rf && (this.hurtT & 2) === 0 ? CONTRA_FLASH : undefined;
  }
}

/** On screen (px of slack past the edges). */
export function onScreen(j: Jungle, x: number, slack = 0): boolean {
  return x >= j.camX - slack && x <= j.camX + 256 + slack;
}

/* ---------- Running soldiers ---------- */

export const SOLDIER_SPEED = 1.25;
/** A soldier's hop off a ledge's end (px/f). */
export const SOLDIER_HOP = 2;

export class Soldier extends Foe {
  readonly kind = 'soldier';
  vy = 0;
  air = false;
  constructor(
    x: number,
    y: number,
    readonly dir: -1 | 1,
  ) {
    super(x, y, 1);
    this.frail = true;
  }
  override hurtBox(): Box {
    return { x: this.x - 6, y: this.y - 28, w: 12, h: 28 };
  }
  override harmBox(): Box {
    return { x: this.x - 5, y: this.y - 26, w: 10, h: 26 };
  }
  update(j: Jungle): void {
    this.tick();
    this.x += this.dir * SOLDIER_SPEED;
    if (!this.air) {
      if (j.floorKindAt(this.x, this.y) === null) {
        // The ledge ends: he jumps down to the next tier.
        this.air = true;
        this.vy = -SOLDIER_HOP;
      }
    } else {
      const prev = this.y;
      this.vy = Math.min(4, this.vy + 0.2);
      this.y += this.vy;
      if (this.vy > 0) {
        const floor = j.floorBetween(this.x, prev, this.y, null);
        if (floor !== null) {
          this.y = floor;
          this.air = false;
          this.vy = 0;
        } else if (this.y >= WATER_Y && j.waterAt(this.x)) {
          this.alive = false;
          j.sound('splash');
        }
      }
    }
    if (this.x < j.camX - 32 || this.x > j.camX + 300 || this.y > 260) this.alive = false;
  }
  render(p: Paint): void {
    const frame = this.air ? 'soldier-jump' : `soldier-run-${(this.t >> 3) % 3}`;
    drawContra(
      p.r,
      p.assets,
      frame,
      this.x - 8 - p.camX,
      this.y - 32,
      16,
      28,
      LOOK.soldier,
      this.dir > 0,
      this.flash(p),
    );
  }
}

/* ---------- Riflemen ---------- */

/** Frames between a standing rifleman's shots; a bush rifleman's hide, rise, stand and sink. */
export const RIFLE_EVERY = 120;
export const BUSH_HIDE = 100;
export const BUSH_RISE = 10;
export const BUSH_UP = 56;
/** Frames into its stand a bush rifleman fires. */
export const BUSH_FIRE_AT = 18;
/** Riflemen hold their fire with Bill closer than this (px). */
export const RIFLE_MIN = 28;
/** Enemy bullet speed (px/f). */
export const BULLET_SPEED = 1.75;

export class Rifleman extends Foe {
  readonly kind = 'rifleman';
  face: -1 | 1 = -1;
  fireT = 50;
  constructor(
    x: number,
    y: number,
    readonly bush: boolean,
  ) {
    super(x, y, 1);
  }
  /** A bush rifleman's state now. */
  get pose(): 'stand' | 'hidden' | 'rise' | 'up' | 'sink' {
    if (!this.bush) return 'stand';
    const c = this.t % (BUSH_HIDE + BUSH_RISE + BUSH_UP + BUSH_RISE);
    if (c < BUSH_HIDE) return 'hidden';
    if (c < BUSH_HIDE + BUSH_RISE) return 'rise';
    if (c < BUSH_HIDE + BUSH_RISE + BUSH_UP) return 'up';
    return 'sink';
  }
  override hurtBox(): Box | null {
    const pose = this.pose;
    if (pose === 'stand' || pose === 'up') return { x: this.x - 6, y: this.y - 30, w: 12, h: 30 };
    return null;
  }
  override harmBox(): Box | null {
    return this.bush ? null : { x: this.x - 5, y: this.y - 28, w: 10, h: 28 };
  }
  update(j: Jungle): void {
    if (!onScreen(j, this.x, -8)) {
      // Waits off screen (a bush rifleman's cycle starts when he comes into view).
      if (this.bush) return;
    }
    this.tick();
    const bill = j.bill;
    this.face = bill.x < this.x ? -1 : 1;
    // (no shot at point-blank range: a rifleman fires at Bill across the screen)
    if (!bill.alive || !onScreen(j, this.x, -8) || Math.abs(bill.x - this.x) < RIFLE_MIN) return;
    if (this.bush) {
      const c = this.t % (BUSH_HIDE + BUSH_RISE + BUSH_UP + BUSH_RISE);
      if (c === BUSH_HIDE + BUSH_RISE + BUSH_FIRE_AT) j.aimedShot(this.x + this.face * 8, this.y - 22, 8);
      return;
    }
    if (--this.fireT <= 0) {
      this.fireT = RIFLE_EVERY;
      j.aimedShot(this.x + this.face * 8, this.y - 22, 8);
    }
  }
  render(p: Paint): void {
    const x = this.x - 8 - p.camX;
    const flip = this.face > 0;
    if (!this.bush) {
      drawContra(
        p.r,
        p.assets,
        `rifleman-${this.fireT < 12 ? 1 : 0}`,
        x,
        this.y - 32,
        16,
        30,
        LOOK.rifleman,
        flip,
        this.flash(p),
      );
      return;
    }
    // Crouched in his bush (only his helmet shows), then up out of it to fire.
    if (this.pose === 'up')
      drawContra(p.r, p.assets, 'rifleman-1', x, this.y - 32, 16, 30, LOOK.rifleman, flip, this.flash(p));
    else drawContra(p.r, p.assets, 'rifleman-bush', x, this.y - 32, 16, 32, LOOK.bush, flip);
  }
}

/* ---------- Rotating wall guns ---------- */

/** Wall guns turn one 30° step every TURN_EVERY frames toward Bill, then fire. */
export const GUN_STEPS = 12;
export const TURN_EVERY = 8;
export const GUN_FIRE_EVERY = 72;
export const GUN_OPEN = 24;
export const GUN_HP = 8;

/** A wall gun step's angle (radians): step 0 points left, the steps go round clockwise. */
export const stepAngle = (i: number): number => Math.PI + (i * Math.PI) / 6;

export class WallGun extends Foe {
  readonly kind = 'wall-gun';
  state: 'shut' | 'opening' | 'active' = 'shut';
  step = 0;
  fireT = 30;
  constructor(x: number, y: number) {
    super(x, y, GUN_HP);
    this.back = true;
  }
  get cy(): number {
    return this.y - 16;
  }
  override hurtBox(): Box | null {
    return this.state === 'shut' ? null : { x: this.x - 14, y: this.y - 30, w: 28, h: 28 };
  }
  override boomY(): number {
    return this.y - 16;
  }
  /** The step pointing nearest Bill. */
  target(j: Jungle): number {
    const a = Math.atan2(j.bill.y - 12 - this.cy, j.bill.x - this.x) - Math.PI;
    return (((Math.round(a / (Math.PI / 6)) % GUN_STEPS) + GUN_STEPS) % GUN_STEPS) as number;
  }
  update(j: Jungle): void {
    if (this.state === 'shut') {
      if (this.x - j.camX < 232) this.state = 'opening';
      else return;
    }
    this.tick();
    if (this.state === 'opening') {
      if (this.t >= GUN_OPEN) this.state = 'active';
      return;
    }
    if (!j.bill.alive) return;
    const goal = this.target(j);
    if (this.t % TURN_EVERY === 0 && goal !== this.step) {
      const d = (goal - this.step + GUN_STEPS) % GUN_STEPS;
      this.step = (this.step + (d <= GUN_STEPS / 2 ? 1 : GUN_STEPS - 1)) % GUN_STEPS;
    }
    if (this.fireT > 0) this.fireT--;
    if (this.fireT === 0 && goal === this.step && onScreen(j, this.x, -8)) {
      this.fireT = GUN_FIRE_EVERY;
      const a = stepAngle(this.step);
      j.foeShot(
        this.x + Math.cos(a) * 14,
        this.cy + Math.sin(a) * 14,
        Math.cos(a) * BULLET_SPEED,
        Math.sin(a) * BULLET_SPEED,
      );
    }
  }
  render(p: Paint): void {
    const x = this.x - 16 - p.camX;
    const y = this.y - 32;
    drawContra(
      p.r,
      p.assets,
      `wall-gun-${this.step}`,
      x,
      y,
      32,
      32,
      this.state === 'shut' ? LOOK.gun : LOOK.gunOpen,
      false,
      this.flash(p),
    );
    if (!hasFrame(p, 'wall-gun-0')) {
      const a = stepAngle(this.step);
      const cx = this.x - p.camX;
      p.r.line(cx, this.cy, cx + Math.cos(a) * 15, this.cy + Math.sin(a) * 15, '#fcfcfc');
    }
  }
}

/* ---------- Pop-up cannons ---------- */

export const CANNON_RISE = 32;
export const CANNON_FIRE_EVERY = 90;
export const CANNON_HP = 8;
/** How near (px) Bill comes before a cannon rises. */
export const CANNON_WAKE = 176;
/** Its three aims: left, 30° up and 60° up (it only ever faces left, as Contra's). */
export const CANNON_ANGLES = [Math.PI, (7 * Math.PI) / 6, (4 * Math.PI) / 3] as const;

export class Cannon extends Foe {
  readonly kind = 'cannon';
  state: 'hidden' | 'rising' | 'up' = 'hidden';
  aimIdx = 0;
  fireT = 30;
  constructor(x: number, y: number) {
    super(x, y, CANNON_HP);
    this.back = true;
  }
  override hurtBox(): Box | null {
    if (this.state === 'hidden' || (this.state === 'rising' && this.t < 12)) return null;
    return { x: this.x - 14, y: this.y - 22, w: 28, h: 22 };
  }
  override boomY(): number {
    return this.y - 12;
  }
  update(j: Jungle): void {
    const bill = j.bill;
    if (this.state === 'hidden') {
      if (bill.alive && onScreen(j, this.x, -16) && Math.abs(bill.x - this.x) < CANNON_WAKE)
        this.state = 'rising';
      else return;
    }
    this.tick();
    if (this.state === 'rising') {
      if (this.t >= CANNON_RISE) this.state = 'up';
      return;
    }
    const a = Math.atan2(bill.y - 12 - (this.y - 14), bill.x - this.x);
    let best = 0;
    for (let i = 1; i < 3; i++) {
      const d = (k: number) =>
        Math.abs(
          Math.atan2(Math.sin(a - (CANNON_ANGLES[k] as number)), Math.cos(a - (CANNON_ANGLES[k] as number))),
        );
      if (d(i) < d(best)) best = i;
    }
    this.aimIdx = best;
    if (--this.fireT <= 0 && bill.alive && bill.x < this.x && onScreen(j, this.x, -8)) {
      this.fireT = CANNON_FIRE_EVERY;
      const ang = CANNON_ANGLES[best] as number;
      j.foeShot(
        this.x + Math.cos(ang) * 16,
        this.y - 14 + Math.sin(ang) * 16,
        Math.cos(ang) * BULLET_SPEED,
        Math.sin(ang) * BULLET_SPEED,
      );
    } else if (this.fireT < 0) this.fireT = 0;
  }
  render(p: Paint): void {
    const x = this.x - 16 - p.camX;
    if (hasFrame(p, 'popup-cannon-0')) {
      // The hatch flush with the floor, half risen, then up with its barrel to the left.
      const f = this.state === 'hidden' ? 0 : this.state === 'rising' ? 1 : 2;
      drawContra(
        p.r,
        p.assets,
        `popup-cannon-${f}`,
        x,
        this.y - 32,
        32,
        32,
        LOOK.cannon,
        false,
        this.flash(p),
      );
      return;
    }
    if (this.state === 'hidden') return;
    const rise = this.state === 'rising' ? Math.min(22, Math.round((this.t * 22) / CANNON_RISE)) : 22;
    {
      box(p.r, x + 2, this.y - rise, 28, rise, LOOK.cannon);
      if (this.state === 'up') {
        const ang = CANNON_ANGLES[this.aimIdx] as number;
        const cx = this.x - p.camX;
        p.r.line(cx, this.y - 14, cx + Math.cos(ang) * 16, this.y - 14 + Math.sin(ang) * 16, '#fcfcfc');
      }
    }
  }
}

/* ---------- Weapon falcons, capsules and pillboxes ---------- */

export const FALCON_GRAVITY = 0.12;

/** A falcon (an eagle badge with its letter): touching it takes the weapon. */
export class Falcon extends Thing {
  readonly kind = 'falcon';
  vy: number;
  landed = false;
  constructor(
    x: number,
    y: number,
    readonly weapon: WeaponId,
    public vx: number,
    vy: number,
  ) {
    super(x, y);
    this.vy = vy;
  }
  box(): Box {
    return { x: this.x - 12, y: this.y - 16, w: 24, h: 16 };
  }
  update(j: Jungle): void {
    this.t++;
    if (!this.landed) {
      const prev = this.y;
      this.x += this.vx;
      this.vy = Math.min(3, this.vy + FALCON_GRAVITY);
      this.y += this.vy;
      if (this.vy > 0) {
        const floor = j.floorBetween(this.x, prev, this.y, null);
        if (floor !== null) {
          this.y = floor;
          this.landed = true;
        } else if (this.y >= WATER_Y + 8 && j.waterAt(this.x)) this.alive = false;
      }
      if (this.y > 260) this.alive = false;
    }
    const b = j.bill.touchBox();
    if (b && overlaps(b, this.box())) {
      this.alive = false;
      j.giveWeapon(this.weapon);
    }
    if (this.x < j.camX - 24) this.alive = false;
  }
  render(p: Paint): void {
    const x = this.x - 12 - p.camX;
    drawContra(p.r, p.assets, `falcon-${this.weapon}`, x, this.y - 16, 24, 16, LOOK.falcon);
    if (!p.assets.has('contra') || !hasFrame(p, `falcon-${this.weapon}`))
      p.r.text(p.assets.sheet('font'), this.weapon, Math.round(x) + 8, this.y - 12);
  }
}

function hasFrame(p: Paint, frame: string): boolean {
  try {
    return p.assets.sheet('contra').frames.has(frame);
  } catch {
    return false;
  }
}

export const CAPSULE_SPEED = 1.25;
/** The capsule's sine flight: amplitude (px) and frames a wave. */
export const CAPSULE_WAVE = 14;
export const CAPSULE_PERIOD = 90;

/** A flying weapon capsule: in from the left edge on a sine wave; shot down, it drops its falcon. */
export class Capsule extends Foe {
  readonly kind = 'capsule';
  readonly baseY: number;
  constructor(
    x: number,
    y: number,
    readonly weapon: WeaponId,
  ) {
    super(x, y, 1);
    this.baseY = y;
  }
  override hurtBox(): Box {
    return { x: this.x - 12, y: this.y - 8, w: 24, h: 16 };
  }
  override boomY(): number {
    return this.y;
  }
  update(j: Jungle): void {
    this.tick();
    this.x += CAPSULE_SPEED;
    this.y = this.baseY + Math.sin((this.t * 2 * Math.PI) / CAPSULE_PERIOD) * CAPSULE_WAVE;
    if (this.x > j.camX + 280) this.alive = false;
  }
  override die(j: Jungle): void {
    super.die(j);
    j.spawn(new Falcon(this.x, this.y + 8, this.weapon, 0.5, -3));
  }
  render(p: Paint): void {
    drawContra(
      p.r,
      p.assets,
      `capsule-${(this.t >> 3) & 1}`,
      this.x - 12 - p.camX,
      this.y - 8,
      24,
      16,
      LOOK.capsule,
    );
  }
}

/** A pillbox sensor's cycle (frames): shut, opening, open, closing. */
export const PILLBOX_SHUT = 90;
export const PILLBOX_TURN = 10;
export const PILLBOX_OPEN = 80;
export const PILLBOX_HP = 5;

/** A pillbox sensor in the ground: it opens and closes; shoot it while it is open for its falcon. */
export class Pillbox extends Foe {
  readonly kind = 'pillbox';
  constructor(
    x: number,
    y: number,
    readonly weapon: WeaponId,
  ) {
    super(x, y, PILLBOX_HP);
    this.back = true;
  }
  /** 0 shut, 1 half open, 2 open. */
  get open(): 0 | 1 | 2 {
    const c = this.t % (PILLBOX_SHUT + PILLBOX_OPEN + 2 * PILLBOX_TURN);
    if (c < PILLBOX_SHUT) return 0;
    if (c < PILLBOX_SHUT + PILLBOX_TURN) return 1;
    if (c < PILLBOX_SHUT + PILLBOX_TURN + PILLBOX_OPEN) return 2;
    return 1;
  }
  override hurtBox(): Box | null {
    return this.open === 0 ? null : { x: this.x - 14, y: this.y - 30, w: 28, h: 28 };
  }
  override boomY(): number {
    return this.y - 16;
  }
  update(j: Jungle): void {
    // Its cycle starts once it is on screen.
    if (onScreen(j, this.x) || this.t > 0) this.tick();
  }
  override die(j: Jungle): void {
    super.die(j);
    j.spawn(new Falcon(this.x, this.y - 16, this.weapon, -0.5, -3.5));
  }
  render(p: Paint): void {
    const o = this.open;
    drawContra(
      p.r,
      p.assets,
      `pillbox-${o}`,
      this.x - 16 - p.camX,
      this.y - 32,
      32,
      32,
      o === 2 ? LOOK.pillboxOpen : LOOK.pillbox,
      false,
      this.flash(p),
    );
  }
}

/* ---------- Explosions ---------- */

export const BOOM_FRAMES = 24;

export class Boom extends Thing {
  readonly kind = 'boom';
  constructor(
    x: number,
    y: number,
    readonly big: boolean,
  ) {
    super(x, y);
  }
  update(): void {
    if (++this.t >= BOOM_FRAMES) this.alive = false;
  }
  render(p: Paint): void {
    const f = Math.min(3, (this.t * 4) / BOOM_FRAMES) | 0;
    const x = this.x - 16 - p.camX;
    if (p.assets.has('contra') && hasFrame(p, `boom-${f}`)) {
      drawContra(p.r, p.assets, `boom-${f}`, x, this.y - 16, 32, 32, LOOK.boom);
      return;
    }
    const s = 8 + f * 6;
    box(p.r, this.x - s / 2 - p.camX, this.y - s / 2, s, s, LOOK.boom);
  }
}

/* ---------- Exploding bridges ---------- */

/** Frames from Bill stepping on to the first segment flashing; each flashes, then blows; the step. */
export const BRIDGE_FIRST = 12;
export const BRIDGE_FLASH = 12;
export const BRIDGE_STEP = 16;
/** How far onto the first segment (px) Bill steps before it goes. */
export const BRIDGE_TRIGGER = 4;

/** A steel girder bridge that blows up segment by segment once Bill steps on it (Contra stage 1). */
export class BlastBridge extends Thing {
  readonly kind = 'bridge';
  /** Frames since Bill set it off (-1: not yet). */
  fuse = -1;
  constructor(
    readonly col: number,
    readonly len: number,
    readonly row: number,
  ) {
    super(col * TILE, (row + 1) * TILE);
    this.pinned = true;
    this.back = true;
  }
  /** When segment `i` flashes, and when it blows (fuse frames). */
  static flashAt(i: number): number {
    return BRIDGE_FIRST + i * BRIDGE_STEP;
  }
  static boomAt(i: number): number {
    return BlastBridge.flashAt(i) + BRIDGE_FLASH;
  }
  /** Segments still standing. */
  standing(j: Jungle): number {
    let n = 0;
    for (let i = 0; i < this.len; i++) if (j.cell(this.col + i, this.row) === C.BRIDGE) n++;
    return n;
  }
  update(j: Jungle): void {
    const start = this.col * TILE;
    if (this.fuse < 0) {
      if (j.bill.alive && j.bill.x >= start + BRIDGE_TRIGGER && j.bill.x < start + this.len * TILE)
        this.fuse = 0;
      else return;
    }
    this.fuse++;
    for (let i = 0; i < this.len; i++)
      if (this.fuse === BlastBridge.boomAt(i)) {
        j.setCell(this.col + i, this.row, C.AIR);
        j.boom(start + i * TILE + 8, this.row * TILE + 6, false);
      }
    if (this.fuse > BlastBridge.boomAt(this.len)) this.alive = false;
  }
  render(p: Paint, j: Jungle): void {
    const tiles = tileSheet(p.assets, JUNGLE_THEME);
    for (let i = 0; i < this.len; i++) {
      if (j.cell(this.col + i, this.row) !== C.BRIDGE) continue;
      const x = (this.col + i) * TILE - p.camX;
      if (x < -16 || x > 256) continue;
      const y = this.row * TILE;
      const flashing = this.fuse >= BlastBridge.flashAt(i);
      // A segment about to blow flashes (a steady warning colour with reduce flashing).
      const lit = flashing && (p.rf || (p.t & 2) === 0);
      if (i === 0) {
        // The end post's red light blinks (steady with reduce flashing).
        const light = p.rf ? 0 : (p.t >> 4) & 1;
        drawContra(
          p.r,
          p.assets,
          `blast-bridge-${light}`,
          x,
          y,
          16,
          16,
          lit ? LOOK.bridgeLight : LOOK.bridge,
          false,
          lit ? CONTRA_FLASH : undefined,
        );
        if (!hasFrame(p, 'blast-bridge-0')) p.r.rect(x + 2, y - 4, 3, 3, light ? '#fc3c3c' : '#a80000');
        continue;
      }
      const sheet = tiles.sheet;
      const name = `bridge@${tiles.theme}`;
      if (sheet && (sheet.frames.has(name) || sheet.frames.has('bridge')))
        p.r.sprite(sheet, sheet.frames.has(name) ? name : 'bridge', x, y);
      else box(p.r, x, y, 16, 16, LOOK.bridge);
      if (lit) p.r.rect(x, y, 16, 16, 'rgba(252,60,60,0.45)');
    }
  }
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
