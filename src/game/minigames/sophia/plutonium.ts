import type { Renderer } from '@engine/gfx/renderer';
import { ROOM_H, ROOM_W, TILE, centre, type Box, type Dir } from '../../topdown/geometry';
import { TdEnemy } from '../../topdown/entity';
import type { TdView } from '../../topdown/view';
import type { TopDownWorld } from '../../topdown/world';
import { box, drawPiece, LOOK } from './art';
import { Boom, Orb } from './mutants';

/*
 * The Plutonium Boss (an original design in NES Blaster Master style; overhead, owner decision):
 * the mutant heart of the Underworld's radiation, through which Bowser's spell reached Sophia.
 * Two phases, every beat on the fight's own clock (frames since it woke), so it plays the same
 * every round and can be learnt:
 *
 *   1. THE SHELL (48×48) drifts along the top of the room. Its core is shut (shots clang off) for
 *      SHUT frames, dripping two orbs straight down from its vents; it glows GLOW frames (the
 *      warning), opens with a ring of RING_SHOTS orbs, and stays open (it can be hurt) for OPEN
 *      frames, spitting one aimed orb halfway through. SHELL_HP.
 *   2. THE CORE (32×32): the shell bursts (BREAK_FRAMES of booms, nothing to fear, every orb
 *      gone) and the core bounces round the room on the diagonals, like the original's bosses.
 *      Every BURST_EVERY frames it stops and glows (BURST_GLOW frames), then fans FAN_SHOTS orbs at
 *      Jason. Below half it is quicker. Always open: CORE_HP.
 *
 * It sleeps until Jason has stepped into the room (the shutter closes behind him); its orbs
 * vanish when it falls.
 */

export const SHELL_HP = 20;
export const CORE_HP = 16;
/** Phase 1's cycle: shut, glowing, open (frames). */
export const SHUT = 120;
export const GLOW = 30;
export const OPEN = 96;
export const CYCLE = SHUT + GLOW + OPEN;
/** Frames of the cycle at which the vents drip, and the open core spits an aimed orb. */
export const DRIP_AT: readonly number[] = [40, 90];
export const AIM_AT = SHUT + GLOW + OPEN / 2;
export const RING_SHOTS = 8;
export const ORB_SPEED = 1.25;
export const AIMED_SPEED = 1.75;
/** Phase 1 drifts between these x (its left edge, room px). */
export const DRIFT_MIN = 2 * TILE;
export const DRIFT_MAX = ROOM_W - 2 * TILE - 48;
/** Frames the shell takes to burst. */
export const BREAK_FRAMES = 90;
/** Phase 2: the fan's rhythm and shape. */
export const BURST_EVERY = 200;
export const BURST_GLOW = 30;
export const FAN_SHOTS = 5;
export const FAN_SPREAD = 0.3;
/** Frames it can't be hurt again after a hit (shots come in volleys). */
export const BOSS_INVULN = 8;

export type BossPhase = 'asleep' | 'shell' | 'break' | 'core' | 'dead';

/** The boss's orbs (its own frames). */
const BOSS_ORB = ['boss-shot-0', 'boss-shot-1'] as const;

export class PlutoniumBoss extends TdEnemy {
  readonly kind = 'plutonium';
  hp = SHELL_HP;
  override w = 48;
  override h = 48;
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

  override hurtbox(): Box {
    if (this.phase === 'core') return { x: this.x + 3, y: this.y + 3, w: 26, h: 26 };
    return { x: this.x + 4, y: this.y + 6, w: 40, h: 38 };
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

  /** Frames into phase 2's glow before a fan (0: moving). */
  burstT = 0;

  /** Below half in phase 2: quicker. */
  get angry(): boolean {
    return this.phase === 'core' && this.hp <= CORE_HP / 2;
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
        return this.bursting(world);
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
        for (const vent of [6, 34]) world.add(new Orb(this.x + vent, this.y + 40, 0, ORB_SPEED, BOSS_ORB));
        world.emit({ type: 'boss-shot' });
      }
      return;
    }
    if (k === SHUT + GLOW) {
      const c = this.middle();
      for (let i = 0; i < RING_SHOTS; i++) {
        const a = (i / RING_SHOTS) * 2 * Math.PI + Math.PI / RING_SHOTS;
        world.add(new Orb(c.x - 4, c.y - 4, Math.cos(a) * ORB_SPEED, Math.sin(a) * ORB_SPEED, BOSS_ORB));
      }
      world.emit({ type: 'boss-open' });
    }
    if (k === AIM_AT) this.aimed(world, 0, AIMED_SPEED);
  }

  private middle(): { x: number; y: number } {
    return centre(this.hurtbox());
  }

  /** One orb at Jason, turned by `turn` radians. */
  private aimed(world: TopDownWorld, turn: number, speed: number): void {
    const c = this.middle();
    const to = centre(world.hero.hurtbox());
    const a = Math.atan2(to.y - c.y, to.x - c.x) + turn;
    world.add(new Orb(c.x - 4, c.y - 4, Math.cos(a) * speed, Math.sin(a) * speed, BOSS_ORB));
    world.emit({ type: 'boss-shot' });
  }

  /** Phase 1 is beaten: the shell bursts; the core drops out of it. */
  private crack(world: TopDownWorld): void {
    this.setPhase('break');
    this.hp = CORE_HP;
    this.contact = 0;
    this.invuln = 0;
    this.clearOrbs(world);
    world.emit({ type: 'boss-break' });
  }

  private bursting(world: TopDownWorld): void {
    if (this.phaseT % 12 === 1) {
      const n = this.phaseT / 12;
      world.add(new Boom(this.x + ((n * 19) % 32), this.y + ((n * 29) % 32)));
      world.emit({ type: 'boss-boom' });
    }
    if (this.phaseT < BREAK_FRAMES) return;
    // The core: 32×32, from the shell's middle, heading down and toward Jason.
    const hero = world.hero;
    this.x += 8;
    this.y += 8;
    this.w = 32;
    this.h = 32;
    this.vx = hero.x + 8 < this.x + 16 ? -1 : 1;
    this.vy = 1;
    this.contact = 2;
    this.setPhase('core');
    world.emit({ type: 'boss-core' });
  }

  private core(world: TopDownWorld): void {
    if (this.burstT > 0) {
      if (++this.burstT >= BURST_GLOW) {
        this.burstT = 0;
        const half = (FAN_SHOTS - 1) / 2;
        for (let i = 0; i < FAN_SHOTS; i++) this.aimed(world, (i - half) * FAN_SPREAD, ORB_SPEED);
      }
      return;
    }
    if (this.phaseT % BURST_EVERY === 0) {
      this.burstT = 1;
      return;
    }
    // Bounce on the diagonals inside the walls: a pixel a frame (one and a half when angry).
    const steps = this.angry && (this.t & 1) === 0 ? 2 : 1;
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
      [-8, -8],
      [16, -8],
      [-8, 16],
      [16, 16],
      [4, 4],
    ] as const)
      world.add(new Boom(this.x + 4 + dx, this.y + 4 + dy));
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const sheet = view.sheet(view.sheets.enemies);
    const x = ox + this.x;
    const y = oy + this.y;
    // A hit flashes it for a few frames (never with reduce flashing).
    const flash = this.hitT < 4 && !view.reduceFlashing;
    if (this.phase === 'core') {
      const f = flash ? 'boss-core-hit' : this.glowing ? 'boss-core-1' : 'boss-core-0';
      drawPiece(r, sheet, f, x, y, 32, 32, flash ? ['#fcfcfc', '#fcfcfc'] : LOOK.bossCore);
      if (this.glowing && !sheet?.frames.has(f)) box(r, x + 8, y + 8, 16, 16, ['#fcfcfc', '#d8f878']);
      return;
    }
    const f = flash
      ? 'boss-shell-hit'
      : this.open
        ? 'boss-shell-open'
        : this.glowing
          ? 'boss-shell-glow'
          : 'boss-shell';
    drawPiece(r, sheet, f, x, y, 48, 48, flash ? ['#fcfcfc', '#fcfcfc'] : LOOK.bossShell);
    if (!sheet?.frames.has(f)) {
      // The core in its middle: grey shut, glowing before it opens, green open.
      const core = this.open
        ? LOOK.bossCore
        : this.glowing
          ? (['#d8f878', '#fcfcfc'] as const)
          : LOOK.bossCoreShut;
      box(r, x + 16, y + 16, 16, 16, core);
      if ((this.phase as BossPhase) === 'break') box(r, x + 12, y + 12, 24, 24, LOOK.boom);
    }
  }
}
