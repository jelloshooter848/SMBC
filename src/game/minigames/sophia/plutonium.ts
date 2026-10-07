import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import type { DamageSource, Reaction } from '../../rules/damage';
import type { World } from '../../world/world';
import { box, HIT_PALETTE, HOT_PALETTE, LOOK, SOPHIA_SHEET, soundId, type Fallback } from './art';

/*
 * The Plutonium Boss, side view, fought by Sophia III in the tank (owner decision: as in Blaster
 * Master, whose final boss it is). An original design in that style: a mound of glowing mutant
 * matter filling the right of its chamber, then the core that was inside it. Two phases, every
 * beat on the fight's own clock (frames since it woke), so it plays the same every round:
 *
 *   1. THE MASS (`pluto-a-0/1`, 64×64, MASS_HP): shut (shots clang off) for SHUT frames, lobbing
 *      a glob that lands where the tank stood (at LOB_AT); it runs hot for GLOW frames (the
 *      warning), then opens its maw: a ball of plutonium rolls out along the floor (jump it or
 *      hover over it) and the mass can be hurt for OPEN frames, lobbing once more.
 *   2. THE CORE (`pluto-b-0/1`, 32×32, CORE_HP): the mass bursts (BREAK_FRAMES of booms, every
 *      shot gone, nothing hurts), and the core rises and loops a slow figure of eight over the
 *      chamber's upper half (aim up, hover, or send missiles); every RAIN_EVERY frames it holds
 *      still and runs hot (RAIN_GLOW frames), then rains RAIN_DROPS drops. Below half it loops
 *      faster. Always open.
 *
 * Any attack of the tank's (or Jason's) hurts it; it can't be stomped; touching it hurts. A hit
 * flashes it white (`sophia-hit`, never with reduce flashing).
 */

export const MASS_HP = 30;
export const CORE_HP = 24;
/** Frames before it wakes (its name comes up), from the player's arrival. */
export const WAKE_AFTER = 60;
/** Phase 1's cycle. */
export const SHUT = 120;
export const GLOW = 30;
export const OPEN = 90;
export const CYCLE = SHUT + GLOW + OPEN;
/** Frames of the cycle at which it lobs a glob. */
export const LOB_AT: readonly number[] = [20, 80, SHUT + GLOW + 50];
/** A glob's flight time (frames) and gravity (px/f²). */
export const LOB_FRAMES = 60;
export const LOB_GRAVITY = 0.1;
/** The rolling ball's pace (px a frame). */
export const BALL_SPEED = 1.25;
/** Frames the mass takes to burst. */
export const BREAK_FRAMES = 90;
/** Phase 2: the loop (frames for one figure of eight, calm and angry), its middle and reach (px, room). */
export const LOOP_FRAMES = 360;
export const ANGRY_LOOP_FRAMES = 240;
export const LOOP_X = 112;
export const LOOP_Y = 72;
export const LOOP_W = 72;
export const LOOP_H = 20;
/** Phase 2's rain. */
export const RAIN_EVERY = 160;
export const RAIN_GLOW = 30;
export const RAIN_DROPS = 3;
export const DROP_SPEED = 1.5;
/** Frames it can't be hurt again after a hit (shots come in bursts). */
export const PLUTO_INVULN = 8;
/** Hit points a hit takes: an attack's own amount, at least 1. */
export const STAR_DAMAGE = 4;

export type PlutoPhase = 'asleep' | 'mass' | 'break' | 'core' | 'dead';

const SIZE = 64;
const CORE = 32;

/** Draws a frame of the sophia sheet (a palette when given and defined), or a box. */
function drawPluto(
  r: Renderer,
  view: View,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: Fallback,
  palette?: string,
  alt?: string,
): void {
  const assets = view.assets;
  for (const f of alt ? [frame, alt] : [frame])
    try {
      if (!assets.has(SOPHIA_SHEET)) break;
      let sheet = assets.sheet(SOPHIA_SHEET);
      if (palette)
        try {
          sheet = assets.sheet(SOPHIA_SHEET, palette);
        } catch {
          // no such palette yet: plain
        }
      if (sheet.frames.has(f)) {
        const fw = sheet.frames.get(f)?.w ?? w;
        const fh = sheet.frames.get(f)?.h ?? h;
        r.sprite(sheet, f, Math.round(x + (w - fw) / 2), Math.round(y + (h - fh) / 2));
        return;
      }
    } catch {
      break;
    }
  box(r, x, y, w, h, fallback);
}

/** What the boss throws: a lobbed glob, a rolling ball, a drop of rain. */
export type PlutoShotKind = 'glob' | 'ball' | 'drop';

/** One of the boss's shots: hurts the player on touch; walls and the floor stop it (a ball rolls on). */
export class PlutoShot extends Entity {
  readonly kind: string;
  age = 0;
  private fx: number;
  private fy: number;
  constructor(
    x: number,
    y: number,
    public vx: number,
    public vy: number,
    readonly shot: PlutoShotKind,
    readonly gravity = 0,
  ) {
    const size = shot === 'ball' ? 14 : shot === 'glob' ? 10 : 6;
    super(px(Math.round(x)), px(Math.round(y)), size, size);
    this.fx = x;
    this.fy = y;
    this.kind = `pluto-${shot}`;
    this.layer = 'front';
    this.despawnMargin = 32;
  }

  update(world: World): void {
    this.age++;
    this.vy += this.gravity;
    this.fx += this.vx;
    this.fy += this.vy;
    const b = this.body;
    b.x = px(Math.round(this.fx));
    b.y = px(Math.round(this.fy));
    const cx = (b.x + (b.w >> 1)) >> 12;
    const cy = (b.y + (b.h >> 1)) >> 12;
    const foot = (b.y + b.h) >> 12;
    if (this.shot === 'ball') {
      // Rolls along the floor; a wall ends it.
      if (world.map.isSolid(this.vx < 0 ? b.x >> 12 : (b.x + b.w) >> 12, cy)) return this.destroy();
    } else if (world.map.isSolid(cx, foot) || world.map.isSolid(cx, cy) || toPx(b.y) > 240) {
      if (this.shot === 'glob') world.spawn(new PlutoBoom(b.x + (b.w >> 1), b.y + (b.h >> 1)));
      return this.destroy();
    }
    const p = world.player;
    if (p.dead || p.out || !overlaps(b, p.body)) return;
    world.hurtPlayer(p, this.vx > 0 ? 1 : -1);
    if (this.shot !== 'ball') this.destroy();
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const k = view.reduceFlashing ? 0 : (this.age >> 3) & 1;
    if (this.shot === 'ball')
      drawPluto(r, view, `pluto-ball-${k}`, x - 1, y - 1, 16, 16, LOOK.bossCore, undefined, 'boss-shot-big');
    else if (this.shot === 'glob')
      drawPluto(r, view, 'pluto-glob', x - 3, y - 3, 16, 16, LOOK.orb, undefined, 'boss-shot-big');
    else drawPluto(r, view, 'pluto-drop', x - 1, y - 1, 8, 8, LOOK.orb, undefined, `boss-shot-${k}`);
  }
}

/** A boom (24×24) where a glob burst or the boss broke up. */
export class PlutoBoom extends Entity {
  readonly kind = 'pluto-boom';
  age = 0;
  constructor(cx: number, cy: number) {
    super(cx - px(12), cy - px(12), 24, 24);
    this.layer = 'front';
  }
  update(): void {
    if (++this.age >= 20) this.destroy();
  }
  render(r: Renderer, view: View): void {
    const k = Math.min(3, this.age >> 2);
    drawPluto(r, view, `boom-${k}`, toPx(this.body.x) - view.camX, toPx(this.body.y), 24, 24, LOOK.boom);
  }
}

export interface PlutoHooks {
  /** It woke (its name comes up). */
  onWake?(): void;
  /** Phase 1 is beaten: the mass bursts. */
  onBreak?(): void;
  /** It fell. */
  onDown?(): void;
}

/**
 * The Plutonium Boss. `right` and `floor` (px) are the chamber's inner right wall and its floor:
 * the mass stands against the wall on the floor.
 */
export class PlutoniumBoss extends Enemy {
  readonly kind = 'plutonium-boss';
  phase: PlutoPhase = 'asleep';
  /** The fight's clock: frames since it woke; frames into the phase. */
  t = 0;
  phaseT = 0;
  /** Frames since the player arrived (it wakes at WAKE_AFTER). */
  private idle = 0;
  invuln = 0;
  hitT = 99;
  /** Frames into phase 2's glow before the rain (0: looping). */
  rainT = 0;
  private loop = 0;
  private clangT = 0;

  constructor(
    readonly right: number,
    readonly floor: number,
    private readonly hooks: PlutoHooks = {},
  ) {
    super(px(right - SIZE), px(floor - SIZE), SIZE, SIZE);
    this.hp = MASS_HP;
    this.stompable = false;
    this.contactHurts = true;
    this.fallsOffLedges = false;
    this.despawnMargin = null;
    this.body.vx = 0;
    this.facing = -1;
    this.layer = 'main';
  }

  /** Where in phase 1's cycle it is. */
  get cycle(): number {
    return this.t % CYCLE;
  }

  /** Can it be hurt now? */
  get open(): boolean {
    if (this.phase === 'core') return true;
    return this.phase === 'mass' && this.cycle >= SHUT + GLOW;
  }

  /** Its warning glow (before it opens; before the rain). */
  get glowing(): boolean {
    if (this.phase === 'mass') return this.cycle >= SHUT && this.cycle < SHUT + GLOW;
    if (this.phase === 'core') return this.rainT > 0;
    return false;
  }

  get angry(): boolean {
    return this.phase === 'core' && this.hp <= CORE_HP / 2;
  }

  private setPhase(p: PlutoPhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  update(world: World): void {
    this.hitT++;
    if (this.invuln > 0) this.invuln--;
    if (this.clangT > 0) this.clangT--;
    if (this.phase === 'dead') return;
    if (this.phase === 'asleep') {
      if (++this.idle < WAKE_AFTER) return;
      this.setPhase('mass');
      this.hooks.onWake?.();
    }
    this.t++;
    this.phaseT++;
    if (this.phase === 'mass') this.mass(world);
    else if (this.phase === 'break') this.bursting(world);
    else if (this.phase === 'core') this.core(world);
  }

  private middle(): { x: number; y: number } {
    const b = this.body;
    return { x: toPx(b.x + (b.w >> 1)), y: toPx(b.y + (b.h >> 1)) };
  }

  private mass(world: World): void {
    const k = this.cycle;
    if (LOB_AT.includes(k)) this.lob(world);
    if (k === SHUT + GLOW) {
      // The maw opens: a ball rolls out along the floor.
      const b = this.body;
      world.spawn(new PlutoShot(toPx(b.x) - 14, this.floor - 14, -BALL_SPEED, 0, 'ball'));
      world.audio.sfx(soundId('enemyShot'));
    }
  }

  /** A glob from its top, landing where the player stands (LOB_FRAMES later). */
  private lob(world: World): void {
    const b = this.body;
    const x0 = toPx(b.x) + 8;
    const y0 = toPx(b.y) + 12;
    const p = world.player;
    const tx = toPx(p.body.x + (p.body.w >> 1)) - 5;
    const ty = this.floor - 10;
    const T = LOB_FRAMES;
    const vx = (tx - x0) / T;
    const vy = (ty - y0 - 0.5 * LOB_GRAVITY * T * T) / T;
    world.spawn(new PlutoShot(x0, y0, vx, vy, 'glob', LOB_GRAVITY));
    world.audio.sfx(soundId('enemyShot'));
  }

  /** Phase 1 beaten: the mass bursts. */
  private crack(world: World): void {
    this.setPhase('break');
    this.hp = CORE_HP;
    this.contactHurts = false;
    for (const e of world.entities) if (e instanceof PlutoShot) e.destroy();
    this.hooks.onBreak?.();
  }

  private bursting(world: World): void {
    const b = this.body;
    if (this.phaseT % 12 === 1) {
      const n = this.phaseT / 12;
      world.spawn(new PlutoBoom(b.x + px(8 + ((n * 19) % 48)), b.y + px(8 + ((n * 29) % 48))));
      world.audio.sfx(soundId('bossBoom'));
    }
    if (this.phaseT < BREAK_FRAMES) return;
    // The core rises out of the middle of what is left.
    const c = this.middle();
    b.x = px(c.x - CORE / 2);
    b.y = px(c.y - CORE / 2);
    b.w = px(CORE);
    b.h = px(CORE);
    this.contactHurts = true;
    this.loop = Math.PI / 2; // starting at the loop's right end
    this.setPhase('core');
  }

  private core(world: World): void {
    const b = this.body;
    if (this.rainT > 0) {
      if (++this.rainT >= RAIN_GLOW) {
        this.rainT = 0;
        const c = this.middle();
        const half = (RAIN_DROPS - 1) / 2;
        for (let i = 0; i < RAIN_DROPS; i++)
          world.spawn(new PlutoShot(c.x - 3, c.y + 12, (i - half) * 0.5, DROP_SPEED, 'drop'));
        world.audio.sfx(soundId('enemyShot'));
      }
      return;
    }
    if (this.phaseT % RAIN_EVERY === 0) {
      this.rainT = 1;
      return;
    }
    // A slow figure of eight over the upper half; the core moves toward its point on it.
    this.loop += (2 * Math.PI) / (this.angry ? ANGRY_LOOP_FRAMES : LOOP_FRAMES);
    const tx = LOOP_X + Math.sin(this.loop) * LOOP_W;
    const ty = LOOP_Y + Math.sin(2 * this.loop) * LOOP_H;
    const cx = toPx(b.x) + CORE / 2;
    const cy = toPx(b.y) + CORE / 2;
    const step = (to: number, from: number) => Math.max(-2, Math.min(2, to - from));
    b.x += px(step(Math.round(tx), cx));
    b.y += px(step(Math.round(ty), cy));
  }

  override hit(src: DamageSource, world: World): Reaction {
    if (src.kind === 'stomp' || src.kind === 'bump') return 'immune';
    if (this.phase === 'asleep' || this.phase === 'break' || this.phase === 'dead') return 'immune';
    if (this.invuln > 0) return 'immune';
    if (!this.open) {
      if (this.clangT === 0) {
        this.clangT = 12;
        world.audio.sfx(soundId('clang'));
      }
      return 'immune';
    }
    this.hp -= src.kind === 'star' ? STAR_DAMAGE : Math.max(1, src.amount);
    this.hitT = 0;
    this.invuln = PLUTO_INVULN;
    world.audio.sfx(soundId('hit'));
    if (this.hp > 0) return 'hp';
    if (this.phase === 'mass') {
      this.crack(world);
      return 'hp';
    }
    this.goDown(world, src);
    return 'kill';
  }

  /** It falls: a burst of booms, its shots gone. */
  private goDown(world: World, src: DamageSource): void {
    this.phase = 'dead';
    const b = this.body;
    for (const [dx, dy] of [
      [0, 0],
      [16, 0],
      [0, 16],
      [16, 16],
      [8, 8],
    ] as const)
      world.spawn(new PlutoBoom(b.x + px(dx + 4), b.y + px(dy + 4)));
    for (const e of world.entities) if (e instanceof PlutoShot) e.destroy();
    world.audio.sfx(soundId('bossBoom'));
    world.enemyKilled(this, src);
    this.destroy();
    this.hooks.onDown?.();
  }

  override render(r: Renderer, view: View): void {
    if (this.phase === 'asleep' && this.idle < WAKE_AFTER / 2) return; // it rises into view
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const flash = this.hitT < 4 && !view.reduceFlashing;
    const hot = this.glowing || this.phase === 'break';
    const pal = flash ? HIT_PALETTE : hot ? HOT_PALETTE : undefined;
    if (this.phase === 'core') {
      const beat = (this.t >> (this.angry ? 3 : 4)) & 1;
      drawPluto(
        r,
        view,
        `pluto-b-${beat}`,
        x,
        y,
        CORE,
        CORE,
        flash ? ['#fcfcfc', '#fcfcfc'] : LOOK.bossCore,
        pal,
      );
      return;
    }
    const f = this.open || this.phase === 'break' ? 'pluto-a-1' : 'pluto-a-0';
    const look: Fallback = flash ? ['#fcfcfc', '#fcfcfc'] : hot ? ['#d8f878', '#58f898'] : LOOK.bossShell;
    drawPluto(r, view, f, x, y, SIZE, SIZE, look, pal);
    const fallbackCore = !view.assets.has(SOPHIA_SHEET);
    if (fallbackCore) box(r, x + 6, y + 26, 20, 24, this.open ? LOOK.bossCore : LOOK.bossCoreShut);
  }
}
