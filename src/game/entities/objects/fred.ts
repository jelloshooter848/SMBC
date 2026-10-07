import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { Player } from '../player';
import { Partner } from './partner';
import type { World } from '../../world/world';

/**
 * Fred, Jason's frog, on Sophia III's route under 8-4 (docs/HEROES.md, campaign areas
 * 8-4-jason, 8-4-fred, 8-4-garage): `fred x y [mode=lead|swim|rest] [to=<column>]`, the tile his
 * feet stand in. Scenery that shows the way: no collision, never hurts, never despawns. Drawn
 * from Sophia's sheet (`fred-0` sitting, `fred-1` leaping, `fred-2` swimming; he faces right).
 *
 * - `lead` (Jason's area, the default): he sits by Jason until Jason is talked to or a hero comes
 *   within NEAR_PX, then hops off to the right, HOP_PX a hop, and from column `to` (the pool)
 *   dives in, falls out of sight and is gone. The announcer says so once.
 * - `swim` (the flooded tunnel): he swims on to the right while a hero is within LEAD_PX behind
 *   him (darting when one is close), bobbing; at column `to` (by the pipe) he waits for a hero to
 *   come within LEAD_PX and slips into the pipe (gone).
 * - `rest` (the garage): he sits facing the nearest hero, and now and then hops on the spot with a
 *   croak while one is near.
 * The croak is the `frog` sound. Nothing flashes.
 */

export type FredMode = 'lead' | 'swim' | 'rest';

/** A hero this close (px, centre to centre) sets him off in his `lead` mode. */
export const NEAR_PX = 32;
/** One hop: frames, distance (px) and height (px). */
export const HOP_FRAMES = 24;
export const HOP_PX = 32;
const HOP_HEIGHT = 18;
/** Between hops he sits this many frames. */
const HOP_REST = 10;
/** His dive's gravity and top speed (px/f), falling into the pool. */
const DIVE_GRAVITY = 0.25;
const DIVE_MAX = 4;
/**
 * Swimming: px a frame while a hero is within LEAD_PX behind him, and DART_SPEED while one is
 * within CLOSE_PX (or past him), so he stays ahead of the fastest swimmer.
 */
export const SWIM_SPEED = 1.5;
export const DART_SPEED = 3;
export const LEAD_PX = 80;
const CLOSE_PX = 40;
/** Resting: frames between his hops on the spot, and the hop's length. */
const REST_PERIOD = 150;
const REST_HOP = 16;

/** What the announcer says as he dives into the pool. */
export const FRED_DIVES_SAID = 'Fred dives into the pool. Follow him!';

type State = 'sit' | 'hop' | 'dive' | 'swim' | 'wait' | 'rest';

export class Fred extends Entity {
  readonly kind = 'fred';
  private state: State;
  private t = 0;
  /** Frames into the current hop (or rest). */
  private k = 0;
  /** px: where the current hop started, and the row his feet sit on. */
  private fromX = 0;
  private readonly baseY: number;
  private vy = 0;
  /** Gone: dived out of sight, or into the pipe. */
  gone = false;

  constructor(
    tx: number,
    ty: number,
    readonly mode: FredMode,
    /** Column: the pool he dives into (`lead`), or where he waits by the pipe (`swim`). */
    readonly to: number,
  ) {
    super(px(tx * 16), px((ty + 1) * 16 - 16), 16, 16);
    this.layer = 'main';
    this.despawnMargin = null;
    this.facing = 1;
    this.baseY = toPx(this.body.y);
    this.state = mode === 'swim' ? 'swim' : mode === 'rest' ? 'rest' : 'sit';
  }

  /** `fred x y` from a map's spawn props. */
  static create(tx: number, ty: number, props: Record<string, unknown> | undefined): Fred {
    const m = props?.mode;
    const mode: FredMode = m === 'swim' || m === 'rest' ? m : 'lead';
    const to = Number(props?.to);
    return new Fred(tx, ty, mode, Number.isFinite(to) ? to : tx + 4);
  }

  /** Where he is now ('sit', 'hop', 'dive', 'swim', 'wait', 'rest'), for tests. */
  get doing(): State {
    return this.state;
  }

  private get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  /** The nearest hero in play (by x), or null. */
  private nearest(world: World): Player | null {
    let best: Player | null = null;
    for (const p of world.activePlayers())
      if (!p.hidden && (!best || Math.abs(p.centerX - this.centerX) < Math.abs(best.centerX - this.centerX)))
        best = p;
    return best;
  }

  private near(world: World, reach: number): boolean {
    const p = this.nearest(world);
    return p !== null && Math.abs(p.centerX - this.centerX) <= px(reach);
  }

  update(world: World): void {
    if (this.gone) return;
    this.t++;
    switch (this.state) {
      case 'sit': {
        const talked = world.entities.some((e) => e instanceof Partner && e.who === 'jason' && e.talked);
        if (talked || this.near(world, NEAR_PX)) this.startHop(world);
        break;
      }
      case 'hop': {
        this.k++;
        const goal = Math.min(this.fromX + HOP_PX, this.to * 16);
        const f = Math.min(1, this.k / HOP_FRAMES);
        const x = Math.round(this.fromX + (goal - this.fromX) * f);
        const lift = Math.round(Math.sin(Math.PI * f) * HOP_HEIGHT);
        this.body.x = px(x);
        this.body.y = px(this.baseY - lift);
        if (this.k < HOP_FRAMES) break;
        if (goal >= this.to * 16) {
          // Over the pool: in he goes.
          this.state = 'dive';
          this.vy = 1;
          world.events.push({ type: 'say', text: FRED_DIVES_SAID });
        } else if (this.k >= HOP_FRAMES + HOP_REST) this.startHop(world);
        break;
      }
      case 'dive':
        this.vy = Math.min(DIVE_MAX, this.vy + DIVE_GRAVITY);
        this.body.y += px(this.vy);
        if (toPx(this.body.y) > world.level.height * 16 + 16) this.vanish();
        break;
      case 'swim': {
        const bob = Math.round(Math.sin(this.t / 20) * 3);
        this.body.y = px(this.baseY + bob);
        if (toPx(this.body.x) >= this.to * 16) {
          this.body.x = px(this.to * 16);
          this.state = 'wait';
          break;
        }
        // On while a hero is within LEAD_PX behind him (or past him): faster when one is close.
        const p = this.nearest(world);
        const gap = p ? this.centerX - p.centerX : Infinity;
        if (gap < px(LEAD_PX)) this.body.x += px(gap < px(CLOSE_PX) ? DART_SPEED : SWIM_SPEED);
        break;
      }
      case 'wait':
        this.body.y = px(this.baseY + Math.round(Math.sin(this.t / 20) * 3));
        if (this.near(world, LEAD_PX)) {
          world.audio.sfx('frog');
          this.vanish();
        }
        break;
      case 'rest': {
        const p = this.nearest(world);
        if (p && this.k === 0) this.facing = p.centerX < this.centerX ? -1 : 1;
        if (this.k > 0) {
          this.k++;
          const f = this.k / REST_HOP;
          this.body.y = px(this.baseY - Math.round(Math.sin(Math.PI * Math.min(1, f)) * 6));
          if (this.k >= REST_HOP) {
            this.k = 0;
            this.body.y = px(this.baseY);
          }
        } else if (this.t % REST_PERIOD === 0 && this.near(world, LEAD_PX)) {
          this.k = 1;
          world.audio.sfx('frog');
        }
        break;
      }
    }
  }

  private startHop(world: World): void {
    this.state = 'hop';
    this.k = 0;
    this.fromX = toPx(this.body.x);
    this.facing = 1;
    world.audio.sfx('frog');
  }

  private vanish(): void {
    this.gone = true;
    this.alive = false;
  }

  render(r: Renderer, view: View): void {
    if (this.gone) return;
    let frame = 'fred-0';
    if (this.state === 'hop') frame = this.k < HOP_FRAMES ? 'fred-1' : 'fred-0';
    else if (this.state === 'dive') frame = 'fred-1';
    else if (this.state === 'swim' || this.state === 'wait')
      frame = Math.floor(this.t / 10) % 2 ? 'fred-1' : 'fred-2';
    else if (this.state === 'rest' && this.k > 0) frame = 'fred-1';
    const sheet = view.assets.sheet('sophia');
    r.sprite(sheet, frame, toPx(this.body.x) - view.camX, toPx(this.body.y), this.facing < 0);
  }
}
