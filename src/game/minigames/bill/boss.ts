import { ALIEN_PALETTE, box, drawContra, hasContraFrame, LOOK } from './art';
import { Foe, Thing, type Paint } from './foes';
import type { Box, Jungle } from './jungle';
import { BASE_Y, LAIR_CAM, LAIR_Y, WALL_X } from './stage';

/*
 * The two-phase boss. Phase 1, the defense wall at the stage's end (NES Contra stage 1's): two
 * wall cannons lob shells at where Bill stands, a sniper on top fires at him, and the sensor core
 * glows in the door. Destroying the core blows the wall apart (the cannons and sniper with it).
 * Phase 2, Red Falcon in its lair behind the wall: a pulsing alien heart set in organic walls,
 * and two mouths in the flesh overhead that spit larvae, which crawl at Bill and leap. Shooting
 * the heart until it bursts wins.
 *
 * Every pattern runs on the fight's own clock (no dice), so the boss is the same every round.
 */

/** Hit points. */
export const CORE_HP = 24;
export const WALL_CANNON_HP = 10;
export const SNIPER_HP = 1;
export const HEART_HP = 48;
export const POD_HP = 12;
/** The wall cannons' shells: every CANNON_EVERY frames each, the second CANNON_EVERY/2 later. */
export const CANNON_EVERY = 96;
export const CANNON_FIRST = 40;
export const SHELL_VY = 1;
export const SHELL_G = 0.06;
/** The sniper's shots. */
export const SNIPER_EVERY = 110;
export const SNIPER_FIRST = 70;
/** The breach: booms over the wall, then it is gone. */
export const BREACH_FRAMES = 120;
/** The mouths: one opens every POD_EVERY/2 frames, by turns; a larva comes out POD_SPIT in. */
export const POD_EVERY = 200;
export const POD_FIRST = 60;
export const POD_OPEN = 24;
export const POD_SPIT = 12;
export const MAX_LARVAE = 3;
/** Larvae: crawl speed, the leap (when within LARVA_LEAP px), and the rest between leaps. */
export const LARVA_CRAWL = 0.5;
export const LARVA_LEAP = 32;
export const LARVA_LEAP_VY = 2.6;
export const LARVA_LEAP_VX = 1.5;
export const LARVA_REST = 60;

/** The wall's top (px) and its width. */
export const WALL_TOP = 64;
export const WALL_W = 96;
/** The door in its foot (its left 32 px), where the core sits: the core's top (px). */
export const DOOR_H = 64;
export const CORE_TOP = BASE_Y - DOOR_H + 16;

/** The defense wall itself: armour (it soaks up shots) and its look. */
export class DefenseWall extends Thing {
  readonly kind = 'defense-wall';
  broken = false;
  constructor() {
    super(WALL_X + WALL_W / 2, BASE_Y);
    this.pinned = true;
    this.shield = true;
    this.back = true;
  }
  /** Its armour: the face above the door (the core in the door takes the shots there). */
  override hurtBox(): Box | null {
    return this.broken ? null : { x: WALL_X, y: WALL_TOP, w: WALL_W, h: BASE_Y - DOOR_H - WALL_TOP };
  }
  update(): void {
    this.t++;
  }
  render(p: Paint): void {
    const x = WALL_X - p.camX;
    if (x > 256) return;
    if (this.broken) {
      // Wrecked plates along its foot.
      for (let i = 0; i < WALL_W; i += 32)
        drawContra(p.r, p.assets, 'defense-wall-broken', x + i, BASE_Y - 32, 32, 32, LOOK.wallTrim);
      return;
    }
    if (hasContraFrame(p.assets, 'defense-wall')) {
      // Steel plates, the crown with the sniper's ledge, and the door with the core's recess.
      for (let i = 0; i < WALL_W; i += 32) {
        drawContra(p.r, p.assets, 'defense-wall-top', x + i, WALL_TOP, 32, 32, LOOK.wall);
        for (let y = WALL_TOP + 32; y < BASE_Y; y += 32)
          if (i > 0 || y < BASE_Y - DOOR_H)
            drawContra(p.r, p.assets, 'defense-wall', x + i, y, 32, 32, LOOK.wall);
      }
      drawContra(p.r, p.assets, 'defense-wall-door', x, BASE_Y - DOOR_H, 32, DOOR_H, LOOK.wallTrim);
      return;
    }
    box(p.r, x, WALL_TOP, WALL_W, BASE_Y - WALL_TOP, LOOK.wall);
    for (let y = WALL_TOP + 8; y < BASE_Y; y += 24)
      for (let i = 0; i < 6; i++) p.r.rect(x + 6 + i * 16, y, 2, 2, '#202020');
    box(p.r, x - 2, WALL_TOP, WALL_W + 2, 8, LOOK.wallTrim);
    box(p.r, x, BASE_Y - DOOR_H, 32, DOOR_H, LOOK.wallTrim);
  }
}

/** The glowing sensor core in the wall's door: destroy it and the wall falls. */
export class WallCore extends Foe {
  readonly kind = 'core';
  constructor() {
    super(WALL_X + 16, BASE_Y, CORE_HP);
    this.pinned = true;
    this.back = true;
  }
  override hurtBox(): Box {
    return { x: WALL_X + 2, y: CORE_TOP, w: 28, h: 32 };
  }
  override boomY(): number {
    return CORE_TOP + 16;
  }
  update(): void {
    this.tick();
  }
  override die(j: Jungle): void {
    super.die(j);
    j.breach();
  }
  render(p: Paint): void {
    // It pulses slowly; with reduce flashing it glows steadily (no strobing).
    const f = p.rf ? 1 : (p.t >> 4) % 3;
    const x = this.x - 16 - p.camX;
    drawContra(
      p.r,
      p.assets,
      `core-${f}`,
      x,
      CORE_TOP,
      32,
      32,
      f === 2 ? LOOK.coreLit : LOOK.core,
      false,
      this.flash(p),
    );
  }
}

/** One of the two cannons on the wall's face: it lobs a shell to land where Bill stands. */
export class WallCannon extends Foe {
  readonly kind = 'wall-cannon';
  private firedT = -99;
  constructor(readonly index: 0 | 1) {
    super(WALL_X - 7, 108 + index * 22, WALL_CANNON_HP);
    this.pinned = true;
  }
  override hurtBox(): Box {
    return { x: WALL_X - 16, y: this.y - 12, w: 18, h: 12 };
  }
  override boomY(): number {
    return this.y - 6;
  }
  /** Fires on the fight's clock: `bossT` frames into the wall fight. */
  fires(bossT: number): boolean {
    const t = bossT - CANNON_FIRST - this.index * (CANNON_EVERY / 2);
    return t >= 0 && t % CANNON_EVERY === 0;
  }
  update(j: Jungle): void {
    this.tick();
    if (j.phase !== 'wall' || !this.fires(j.phaseT) || !j.bill.alive) return;
    const mx = WALL_X - 16;
    const my = this.y - 6;
    // A shell lobbed to come down on Bill's x.
    const target = j.bill.y - 12;
    const disc = SHELL_VY * SHELL_VY + 2 * SHELL_G * Math.max(0, target - my);
    const t = (SHELL_VY + Math.sqrt(disc)) / SHELL_G;
    const vx = Math.max(-2.4, Math.min(-0.4, (j.bill.x - mx) / t));
    j.foeShot(mx, my, vx, -SHELL_VY, SHELL_G, 'shell');
    this.firedT = this.t;
    j.sound('enemyShot');
  }
  render(p: Paint): void {
    const firing = this.t - this.firedT < 8;
    drawContra(
      p.r,
      p.assets,
      `wall-cannon-${firing ? 1 : 0}`,
      WALL_X - 20 - p.camX,
      this.y - 14,
      32,
      16,
      LOOK.gun,
      false,
      this.flash(p),
    );
  }
}

/** The sniper on top of the wall. */
export class WallSniper extends Foe {
  readonly kind = 'sniper';
  constructor() {
    // On the ledge along the wall's crown.
    super(WALL_X + 12, WALL_TOP + 6, SNIPER_HP);
    this.pinned = true;
  }
  override hurtBox(): Box {
    return { x: this.x - 6, y: this.y - 28, w: 12, h: 28 };
  }
  update(j: Jungle): void {
    this.tick();
    if (j.phase !== 'wall' || !j.bill.alive) return;
    const t = j.phaseT - SNIPER_FIRST;
    if (t >= 0 && t % SNIPER_EVERY === 0) j.aimedShot(this.x - 8, this.y - 22, 0);
  }
  render(p: Paint): void {
    drawContra(
      p.r,
      p.assets,
      'rifleman-0',
      this.x - 8 - p.camX,
      this.y - 32,
      16,
      30,
      LOOK.rifleman,
      false,
      this.flash(p),
    );
  }
}

/** Red Falcon's heart: it beats in the lair's back wall; shoot it until it bursts. */
export class Heart extends Foe {
  readonly kind = 'heart';
  constructor() {
    super(LAIR_CAM + 200, LAIR_Y - 12, HEART_HP);
    this.pinned = true;
    this.back = true;
  }
  override hurtBox(): Box {
    return { x: this.x - 24, y: this.y - 60, w: 48, h: 60 };
  }
  override boomY(): number {
    return this.y - 30;
  }
  update(): void {
    this.tick();
  }
  override die(j: Jungle): void {
    super.die(j);
    j.heartDown();
  }
  render(p: Paint): void {
    // It beats: a slow swell; with reduce flashing it stays still (no strobing).
    const f = p.rf ? 0 : ([0, 1, 2, 1][(p.t >> 3) & 3] as number);
    drawContra(
      p.r,
      p.assets,
      `falcon-heart-${f}`,
      this.x - 32 - p.camX,
      this.y - 64,
      64,
      64,
      f === 2 ? LOOK.heartLit : LOOK.heart,
      false,
      this.flash(p) ?? ALIEN_PALETTE,
    );
  }
}

/** A mouth in the flesh overhead: it opens by turns and spits a larva. */
export class Pod extends Foe {
  readonly kind = 'pod';
  constructor(
    x: number,
    readonly index: 0 | 1,
  ) {
    super(x, 56, POD_HP);
    this.pinned = true;
  }
  override hurtBox(): Box {
    return { x: this.x - 14, y: this.y - 24, w: 28, h: 24 };
  }
  /** Frames into its cycle (negative: not started), on the lair fight's clock. */
  cycle(lairT: number): number {
    const t = lairT - POD_FIRST - this.index * (POD_EVERY / 2);
    return t < 0 ? -1 : t % POD_EVERY;
  }
  get openNow(): boolean {
    return this.lastCycle >= 0 && this.lastCycle < POD_OPEN;
  }
  private lastCycle = -1;
  update(j: Jungle): void {
    this.tick();
    if (j.phase !== 'lair') return;
    this.lastCycle = this.cycle(j.phaseT);
    if (this.lastCycle === POD_SPIT && j.count('larva') < MAX_LARVAE) j.spawn(new Larva(this.x, this.y + 6));
  }
  render(p: Paint): void {
    drawContra(
      p.r,
      p.assets,
      `pod-${this.openNow ? 1 : 0}`,
      this.x - 16 - p.camX,
      this.y - 28,
      32,
      32,
      LOOK.pod,
      false,
      this.flash(p) ?? ALIEN_PALETTE,
    );
  }
}

/** A larva: drops from a mouth, crawls at Bill and leaps at him. */
export class Larva extends Foe {
  readonly kind = 'larva';
  vx = 0;
  vy = 0;
  air = true;
  rest = 0;
  face: -1 | 1 = -1;
  constructor(x: number, y: number) {
    super(x, y, 1);
    this.frail = true;
  }
  override hurtBox(): Box {
    return { x: this.x - 7, y: this.y - 11, w: 14, h: 11 };
  }
  override harmBox(): Box {
    return { x: this.x - 6, y: this.y - 10, w: 12, h: 10 };
  }
  override boomY(): number {
    return this.y - 6;
  }
  update(j: Jungle): void {
    this.tick();
    const toward = j.bill.x < this.x ? -1 : 1;
    if (!this.air) this.face = toward;
    if (this.rest > 0) this.rest--;
    if (this.air) {
      this.x += this.vx;
      this.vy = Math.min(4, this.vy + 0.15);
      this.y += this.vy;
      if (this.y >= LAIR_Y) {
        this.y = LAIR_Y;
        this.air = false;
        this.vx = 0;
        this.vy = 0;
      }
    } else {
      this.x += toward * LARVA_CRAWL;
      if (j.bill.alive && this.rest === 0 && Math.abs(j.bill.x - this.x) < LARVA_LEAP) {
        this.air = true;
        this.vy = -LARVA_LEAP_VY;
        this.vx = toward * LARVA_LEAP_VX;
        this.rest = LARVA_REST;
      }
    }
    this.x = Math.max(LAIR_CAM + 4, Math.min(LAIR_CAM + 252, this.x));
  }
  render(p: Paint): void {
    drawContra(
      p.r,
      p.assets,
      this.air ? 'larva-1' : 'larva-0',
      this.x - 8 - p.camX,
      this.y - 16,
      16,
      12,
      LOOK.larva,
      this.face > 0,
      ALIEN_PALETTE,
    );
  }
}

/** The breach's booms: (frame, x offset from the wall, y), the same every time. */
export const BREACH_BOOMS: readonly [number, number, number][] = [
  [0, 16, 172],
  [12, 60, 120],
  [24, 30, 80],
  [36, 80, 160],
  [48, 10, 110],
  [60, 70, 64],
  [72, 40, 140],
  [84, 88, 100],
  [96, 24, 176],
  [108, 64, 176],
];
/** The win's chain of booms over the lair: (frame, x offset from the lair's left, y). */
export const WIN_BOOMS: readonly [number, number, number][] = [
  [0, 200, 160],
  [10, 184, 130],
  [20, 216, 180],
  [30, 150, 100],
  [40, 230, 120],
  [50, 120, 170],
  [60, 196, 90],
  [70, 90, 60],
  [80, 170, 196],
  [90, 60, 120],
  [100, 210, 60],
  [110, 30, 180],
];
export const WIN_BOOM_FRAMES = 130;
