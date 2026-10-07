import type { Renderer } from '@engine/gfx/renderer';
import { ROOM_H, ROOM_W, TILE, centre, type Box, type Dir } from '../../topdown/geometry';
import { TdEnemy } from '../../topdown/entity';
import type { TdView } from '../../topdown/view';
import type { TopDownWorld } from '../../topdown/world';
import { box, drawPiece, HIT_PALETTE, HOT_PALETTE, LOOK } from './art';
import { Boom, Orb, ORB_FRAMES } from './mutants';

/*
 * The Plutonium Boss (an original design in NES Blaster Master style; overhead, owner decision):
 * the mutant heart of the Underworld's radiation, through which Bowser's spell reached Sophia.
 * 64×64, facing down at Jason. Two phases, every beat on the fight's own clock (frames since it
 * woke), so it plays the same every round and can be learnt:
 *
 *   1. THE SHELL (`boss-a-0/1`) drifts along the top of the room. Its vents are shut (shots clang
 *      off) for SHUT frames while it drips two orbs straight down from them; it runs hot for GLOW
 *      frames (the warning: the `plutonium-hot` palette), throws its vents open with a ring of
 *      RING_SHOTS orbs and stays open (it can be hurt) for OPEN frames, spitting one big aimed orb
 *      halfway through. SHELL_HP.
 *   2. THE CORE (`boss-b-0/1`): the shell cracks (BREAK_FRAMES of booms, nothing to fear, every
 *      orb gone) and the beating core bounces round the room on the diagonals, as the original's
 *      bosses do. Every BURST_EVERY frames it stops and runs hot (BURST_GLOW frames), then fans
 *      FAN_SHOTS orbs at Jason. Below half it is quicker and beats faster. Always open: CORE_HP.
 *
 * A hit flashes it white (`sophia-hit`; never with reduce flashing). It sleeps until Jason has
 * stepped into the room (the shutter closes behind him); its orbs vanish when it falls.
 */

export const SHELL_HP = 24;
export const CORE_HP = 20;
/** The boss's size (S3's frames). */
export const BOSS_SIZE = 64;
/** Phase 1's cycle: shut, glowing, open (frames). */
export const SHUT = 120;
export const GLOW = 30;
export const OPEN = 96;
export const CYCLE = SHUT + GLOW + OPEN;
/** Frames of the cycle at which the vents drip, and the open shell spits its big aimed orb. */
export const DRIP_AT: readonly number[] = [40, 90];
export const AIM_AT = SHUT + GLOW + OPEN / 2;
export const RING_SHOTS = 8;
export const ORB_SPEED = 1.25;
export const AIMED_SPEED = 1.5;
/** The vents (x in the frame) the drips fall from, and their height. */
export const VENTS: readonly number[] = [10, 46];
export const VENT_Y = 56;
/** Phase 1 drifts between these x (its left edge, room px). */
export const DRIFT_MIN = TILE;
export const DRIFT_MAX = ROOM_W - TILE - BOSS_SIZE;
/** Frames the shell takes to crack. */
export const BREAK_FRAMES = 90;
/** Phase 2: its pace (px on each frame of a 4-frame pattern, calm and angry), the fan. */
export const CORE_STEPS: readonly number[] = [1, 1, 1, 0];
export const ANGRY_STEPS: readonly number[] = [1, 1, 1, 1];
export const BURST_EVERY = 200;
export const BURST_GLOW = 30;
export const FAN_SHOTS = 5;
export const FAN_SPREAD = 0.3;
/** Frames it can't be hurt again after a hit (shots come in volleys). */
export const BOSS_INVULN = 12;

export type BossPhase = 'asleep' | 'shell' | 'break' | 'core' | 'dead';

/** The big aimed orb (16×16). */
class BigOrb extends Orb {
  constructor(cx: number, cy: number, vx: number, vy: number) {
    super(cx - 8, cy - 8, vx, vy, ['boss-shot-big']);
    this.w = 16;
    this.h = 16;
  }
}

export class PlutoniumBoss extends TdEnemy {
  readonly kind = 'plutonium';
  hp = SHELL_HP;
  override w = BOSS_SIZE;
  override h = BOSS_SIZE;
  override contact = 2;
  override knockable = false;
  override dropChance = 0;
  override mover = 'fly' as const;
  phase: BossPhase = 'asleep';
  /** The fight's clock: frames since it woke. */
  t = 0;
  /** Frames into the current phase. */
  phaseT = 0;
  vx = 1;
  vy = 1;
  /** Frames since its last hit (for the hit flash). */
  hitT = 99;
  /** Frames into phase 2's glow before a fan (0: moving). */
  burstT = 0;

  /** What shots hit and what hurts Jason: the shell's body, then the core within the broken shell. */
  override hurtbox(): Box {
    if (this.phase === 'core') return { x: this.x + 12, y: this.y + 12, w: 40, h: 40 };
    return { x: this.x + 6, y: this.y + 6, w: 52, h: 50 };
  }

  /** Where in phase 1's cycle it is. */
  get cycle(): number {
    return this.t % CYCLE;
  }

  /** Can it be hurt right now? */
  get open(): boolean {
    if (this.phase === 'core') return true;
    return this.phase === 'shell' && this.cycle >= SHUT + GLOW;
  }

  /** The warning glow (phase 1 before opening; phase 2 before a fan). */
  get glowing(): boolean {
    if (this.phase === 'shell') return this.cycle >= SHUT && this.cycle < SHUT + GLOW;
    if (this.phase === 'core') return this.burstT > 0;
    return false;
  }

  /** Below half in phase 2: quicker. */
  get angry(): boolean {
    return this.phase === 'core' && this.hp <= CORE_HP / 2;
  }

  /** Its pace in phase 2 (px a frame, on average). */
  get speed(): number {
    const s = this.angry ? ANGRY_STEPS : CORE_STEPS;
    return s.reduce((a, b) => a + b, 0) / s.length;
  }

  protected think(world: TopDownWorld): void {
    this.hitT++;
    if (this.phase === 'asleep') {
      if (!world.sealed) return;
      this.setPhase('shell');
      world.emit({ type: 'boss-wakes' });
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'shell':
        return this.shell(world);
      case 'break':
        return this.cracking(world);
      case 'core':
        return this.core(world);
    }
  }

  private setPhase(p: BossPhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  private shell(world: TopDownWorld): void {
    const k = this.cycle;
    if (k < SHUT) {
      // Drift half a pixel a frame, turning at the ends.
      if ((this.t & 1) === 0) {
        this.x += this.vx;
        if (this.x <= DRIFT_MIN) this.vx = 1;
        else if (this.x >= DRIFT_MAX) this.vx = -1;
      }
      if (DRIP_AT.includes(k)) {
        for (const vent of VENTS)
          world.add(new Orb(this.x + vent - 4, this.y + VENT_Y, 0, ORB_SPEED, ORB_FRAMES));
        world.emit({ type: 'boss-shot' });
      }
      return;
    }
    if (k === SHUT + GLOW) {
      const c = this.middle();
      for (let i = 0; i < RING_SHOTS; i++) {
        const a = (i / RING_SHOTS) * 2 * Math.PI + Math.PI / RING_SHOTS;
        world.add(new Orb(c.x - 4, c.y - 4, Math.cos(a) * ORB_SPEED, Math.sin(a) * ORB_SPEED, ORB_FRAMES));
      }
      world.emit({ type: 'boss-open' });
    }
    if (k === AIM_AT) {
      const c = this.middle();
      const a = this.aimAt(world, c, 0);
      world.add(new BigOrb(c.x, c.y, Math.cos(a) * AIMED_SPEED, Math.sin(a) * AIMED_SPEED));
      world.emit({ type: 'boss-shot' });
    }
  }

  private middle(): { x: number; y: number } {
    return centre(this.hurtbox());
  }

  /** The angle from `c` to Jason, turned by `turn` radians. */
  private aimAt(world: TopDownWorld, c: { x: number; y: number }, turn: number): number {
    const to = centre(world.hero.hurtbox());
    return Math.atan2(to.y - c.y, to.x - c.x) + turn;
  }

  /** Phase 1 is beaten: the shell cracks; the core beats inside it. */
  private crack(world: TopDownWorld): void {
    this.setPhase('break');
    this.hp = CORE_HP;
    this.contact = 0;
    this.invuln = 0;
    this.clearOrbs(world);
    world.emit({ type: 'boss-break' });
  }

  private cracking(world: TopDownWorld): void {
    if (this.phaseT % 12 === 1) {
      const n = this.phaseT / 12;
      world.add(new Boom(this.x + 8 + ((n * 19) % 40), this.y + 8 + ((n * 29) % 40)));
      world.emit({ type: 'boss-boom' });
    }
    if (this.phaseT < BREAK_FRAMES) return;
    // Off it goes, down and toward Jason.
    this.vx = world.hero.x + 8 < this.x + BOSS_SIZE / 2 ? -1 : 1;
    this.vy = 1;
    this.contact = 2;
    this.setPhase('core');
    world.emit({ type: 'boss-core' });
  }

  private core(world: TopDownWorld): void {
    if (this.burstT > 0) {
      if (++this.burstT >= BURST_GLOW) {
        this.burstT = 0;
        const c = this.middle();
        const half = (FAN_SHOTS - 1) / 2;
        for (let i = 0; i < FAN_SHOTS; i++) {
          const a = this.aimAt(world, c, (i - half) * FAN_SPREAD);
          world.add(new Orb(c.x - 4, c.y - 4, Math.cos(a) * ORB_SPEED, Math.sin(a) * ORB_SPEED, ORB_FRAMES));
        }
        world.emit({ type: 'boss-shot' });
      }
      return;
    }
    if (this.phaseT % BURST_EVERY === 0) {
      this.burstT = 1;
      return;
    }
    // Bounce on the diagonals inside the walls.
    const steps = (this.angry ? ANGRY_STEPS : CORE_STEPS)[this.t & 3] ?? 1;
    for (let i = 0; i < steps; i++) {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x <= TILE) this.vx = 1;
      else if (this.x + this.w >= ROOM_W - TILE) this.vx = -1;
      if (this.y <= TILE) this.vy = 1;
      else if (this.y + this.h >= ROOM_H - TILE) this.vy = -1;
    }
  }

  private clearOrbs(world: TopDownWorld): void {
    for (const e of world.entities) if (e instanceof Orb) e.dead = true;
  }

  override hurt(world: TopDownWorld, damage: number, dir: Dir): boolean {
    if (this.phase === 'asleep' || this.phase === 'break' || this.phase === 'dead') return false;
    if (!this.open) {
      if (this.invuln === 0) {
        this.invuln = BOSS_INVULN;
        world.emit({ type: 'clang' });
      }
      return false;
    }
    const hit = super.hurt(world, damage, dir);
    if (hit) {
      this.hitT = 0;
      // (the hit that cracks the shell leaves the core free to be hurt once it is out)
      if (!this.dead && (this.phase as BossPhase) !== 'break') this.invuln = BOSS_INVULN;
    }
    return hit;
  }

  override stunFor(): number {
    return 0;
  }

  override die(world: TopDownWorld): void {
    if (this.phase === 'shell') {
      this.crack(world);
      return;
    }
    this.phase = 'dead';
    this.dead = true;
    this.clearOrbs(world);
    world.emit({ type: 'kill', kind: this.kind });
    for (const [dx, dy] of [
      [8, 8],
      [40, 8],
      [8, 40],
      [40, 40],
      [24, 24],
    ] as const)
      world.add(new Boom(this.x + dx, this.y + dy));
  }

  /** Its frame now: the shell shut or open, the core beating (faster when angry). */
  frame(): string {
    if (this.phase === 'core') return `boss-b-${(this.t >> (this.angry ? 3 : 4)) & 1}`;
    return this.open || this.phase === 'break' ? 'boss-a-1' : 'boss-a-0';
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const x = ox + this.x;
    const y = oy + this.y;
    const f = this.frame();
    // A hit flashes it white for a few frames (never with reduce flashing); it runs hot before
    // it opens or fans, and while its shell cracks.
    const flash = this.hitT < 4 && !view.reduceFlashing;
    const hot = this.glowing || this.phase === 'break';
    const pal = flash ? HIT_PALETTE : hot ? HOT_PALETTE : undefined;
    const sheet = (pal ? view.sheet(view.sheets.enemies, pal) : null) ?? view.sheet(view.sheets.enemies);
    if (sheet?.frames.has(f)) {
      drawPiece(r, sheet, f, x, y, BOSS_SIZE, BOSS_SIZE, LOOK.bossShell);
      return;
    }
    // Boxes until the art is there: the shell (gone in phase 2) round the core.
    if (this.phase !== 'core') box(r, x + 4, y + 4, 56, 56, flash ? ['#fcfcfc', '#fcfcfc'] : LOOK.bossShell);
    const core = flash
      ? (['#fcfcfc', '#fcfcfc'] as const)
      : hot
        ? (['#d8f878', '#fcfcfc'] as const)
        : this.open
          ? LOOK.bossCore
          : LOOK.bossCoreShut;
    const s = this.phase === 'core' ? 40 : 20;
    box(r, x + 32 - s / 2, y + 32 - s / 2, s, s, core);
  }
}
