import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';

/*
 * The World 4 map's airship crash (owner decision 8:25 PM PDT; campaign, once): after Larry is
 * beaten and the crystal ball's card is dismissed, Larry's airship (map scale, smoking) flies in
 * over 4-2 and tips bow-down; the hero jumps out and lands on 4-2 (dust); the ship dives onto the
 * bonus spot and crashes (smoke, the wreck); Toad walks in from off screen, hammers a few times
 * (planks fly) and the wreck turns into the bonus node; Toad waves and walks off. Then the map's
 * usual secret-road reveal draws the road from 4-2 to the bonus spot (scenes/world-map.ts).
 *
 * This is the timeline and the drawing only: the map scene runs it as its `cutscene` mode, feeds
 * it the frame clock, and plays the sounds and says the lines it hands back. All art is the smb3
 * sheet's (map-airship-0/1, map-airship-tilt, map-wreck: 32x16, bow LEFT; map-smoke-0/1/2;
 * toad-map-0/1 facing the viewer, toad-map-hammer-0/1 facing right, mallet up / down;
 * map-dust-0/1); a missing frame draws nothing.
 */

/** Frames of each beat (60 a second); the whole cutscene runs CRASH_FRAMES.END (6.5 s). */
export const CRASH_FRAMES = {
  /** The ship flies in from the right edge to hover over 4-2. */
  FLY: 0,
  /** Over 4-2: it tips bow-down (map-airship-tilt). */
  TILT: 84,
  /** The hero jumps out ... */
  JUMP: 96,
  /** ... and lands on 4-2 (dust). */
  LAND: 132,
  /** The ship dives for the bonus spot ... */
  DIVE: 118,
  /** ... and crashes there: the wreck, smoke. */
  CRASH: 172,
  /** Toad walks in from off screen to the wreck ... */
  TOAD: 196,
  /** ... and hammers: one blow every HAMMER_BEAT frames, HAMMER_HITS of them ... */
  HAMMER: 244,
  /** ... the wreck turns into the bonus node ... */
  BUILD: 304,
  /** ... Toad waves, then walks on off to the right. */
  LEAVE: 334,
  END: 390,
} as const;
export const HAMMER_BEAT = 20;
/** Where Toad walks off to: past the right edge of the 256 px screen. */
const TOAD_EXIT_X = 258;
export const HAMMER_HITS = 3;
/** The smb3 sheet, which holds every frame the cutscene draws. */
const SHEET = 'smb3';

/** What the narration names: the hero(es) jumping out, the bonus node built, the skip button. */
export interface CrashNames {
  /** 'Mario', or 'Mario and Luigi' in co-op. */
  heroes: string;
  /** The bonus game's spoken name ('Toad House'). */
  bonus: string;
  /** The skip hint's button, as abilityHint says it ('JUMP (Space)'). */
  skip: string;
}

export interface CrashEvent {
  sfx?: string;
  say?: string;
}

/** A puff of smoke rising (map-smoke-0/1/2 as it thins). */
interface Puff {
  x: number;
  y: number;
  t: number;
}
/** A plank flying off the wreck under Toad's hammer. */
interface Plank {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/**
 * The cutscene for one map page: `hero` and `bonus` are the two nodes' tile positions (4-2 and
 * the bonus spot); everything is drawn in page pixels (a node's tile at x*16, y*16, feet on
 * y*16 + 10 like the map's hero).
 */
export class AirshipCrash {
  t = 0;
  private readonly puffs: Puff[] = [];
  private readonly planks: Plank[] = [];
  /** px: where the ship hovers over 4-2 (top-left of its 32x16 frame). */
  private readonly hover: { x: number; y: number };
  /** px: the wreck's top-left (centred on the bonus node, standing on its ground line). */
  readonly wreck: { x: number; y: number };
  /** px: the ground line of each node (the feet of what stands on it). */
  private readonly heroFeet: number;
  private readonly bonusFeet: number;

  constructor(
    readonly hero: { x: number; y: number },
    readonly bonus: { x: number; y: number },
  ) {
    this.heroFeet = hero.y * 16 + 10;
    this.bonusFeet = bonus.y * 16 + 10;
    this.hover = { x: hero.x * 16 - 8, y: Math.max(28, this.heroFeet - 64) };
    this.wreck = { x: bonus.x * 16 - 8, y: this.bonusFeet - 16 };
  }

  get done(): boolean {
    return this.t >= CRASH_FRAMES.END;
  }

  /** The wreck has become the bonus node (the node is drawn from now on). */
  get built(): boolean {
    return this.t >= CRASH_FRAMES.BUILD;
  }

  /** Steps one frame; the sounds and lines of the beats that start on it. */
  update(names: CrashNames): CrashEvent[] {
    const t = this.t++;
    const out: CrashEvent[] = [];
    const F = CRASH_FRAMES;
    // The skip hint rides on the first line (a line of its own would be talked over at once).
    if (t === F.FLY) out.push({ say: `Larry's airship limps over World 4, smoking. Skip: ${names.skip}.` });
    if (t === F.JUMP) {
      const verb = names.heroes.includes(' and ') ? 'jump' : 'jumps';
      out.push({ sfx: 'kick', say: `${names.heroes} ${verb} out onto 4-2!` });
    }
    if (t === F.LAND) out.push({ sfx: 'bump' });
    if (t === F.CRASH) out.push({ sfx: 'cannon', say: 'The airship crashes!' });
    if (t === F.TOAD) out.push({ say: 'Toad comes running with his hammer.' });
    if (t >= F.HAMMER && t < F.BUILD && (t - F.HAMMER) % HAMMER_BEAT === HAMMER_BEAT / 2) {
      out.push({ sfx: 'bump' });
      this.breakPlanks(t);
    }
    if (t === F.BUILD)
      out.push({ sfx: 'powerup-appear', say: `Toad turns the wreck into the ${names.bonus}!` });
    // Smoke: from the stern in flight, from the wreck until Toad has rebuilt it.
    const ship = this.ship();
    if (ship && t % 10 === 0) this.puffs.push({ x: ship.x + 24, y: ship.y - 6, t: 0 });
    if (t >= F.CRASH && t < F.BUILD && t % 12 === 0)
      this.puffs.push({ x: this.wreck.x + 8 + ((t / 12) % 2) * 8, y: this.wreck.y - 10, t: 0 });
    for (const p of this.puffs) {
      p.t++;
      p.y -= 0.4;
    }
    while (this.puffs.length && (this.puffs[0] as Puff).t >= 30) this.puffs.shift();
    for (const p of this.planks) {
      p.t++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
    }
    while (this.planks.length && (this.planks[0] as Plank).t >= 28) this.planks.shift();
    return out;
  }

  private breakPlanks(t: number): void {
    const x = this.wreck.x + 16;
    const y = this.wreck.y + 4;
    const side = ((t - CRASH_FRAMES.HAMMER) / HAMMER_BEAT) & 1 ? -1 : 1;
    this.planks.push({ x, y, vx: 0.9 * side, vy: -2, t: 0 }, { x, y, vx: 0.4 * side, vy: -2.6, t: 0 });
  }

  /** The ship's frame and top-left while it is in the air, or null (not yet in, or wrecked). */
  ship(): { frame: string; x: number; y: number } | null {
    const t = this.t;
    const F = CRASH_FRAMES;
    if (t >= F.CRASH) return null;
    const bob = (t >> 4) & 1;
    if (t < F.TILT) {
      const k = clamp01(t / F.TILT);
      const e = 1 - (1 - k) * (1 - k); // eases in to the hover
      return {
        frame: `map-airship-${(t >> 3) & 1}`,
        x: Math.round(lerp(272, this.hover.x, e)),
        y: Math.round(lerp(this.hover.y - 24, this.hover.y, e)) + bob,
      };
    }
    if (t < F.DIVE) return { frame: 'map-airship-tilt', x: this.hover.x, y: this.hover.y + bob };
    const k = clamp01((t - F.DIVE) / (F.CRASH - F.DIVE));
    return {
      frame: 'map-airship-tilt',
      x: Math.round(lerp(this.hover.x, this.wreck.x, k)),
      y: Math.round(lerp(this.hover.y, this.wreck.y, k * k)),
    };
  }

  /**
   * Where the map's hero is drawn (its node-tile top-left, as WorldMapScene.hx/hy), or null while
   * still aboard. Jumping out of the ship in an arc onto 4-2.
   */
  heroAt(): { x: number; y: number } | null {
    const t = this.t;
    const F = CRASH_FRAMES;
    const end = { x: this.hero.x * 16, y: this.hero.y * 16 };
    if (t < F.JUMP) return null;
    if (t >= F.LAND) return end;
    const k = (t - F.JUMP) / (F.LAND - F.JUMP);
    const from = { x: this.hover.x + 8, y: this.hover.y - 4 };
    return {
      x: Math.round(lerp(from.x, end.x, k)),
      y: Math.round(lerp(from.y, end.y, k) - 28 * 4 * k * (1 - k)),
    };
  }

  /** Toad's frame, top-left and facing (flip = face left), or null when off stage. */
  toad(): { frame: string; x: number; y: number; flip: boolean } | null {
    const t = this.t;
    const F = CRASH_FRAMES;
    const y = this.bonusFeet - 16;
    const stand = this.wreck.x - 14;
    const walk = `toad-map-${(t >> 3) & 1}`;
    if (t < F.TOAD || t >= F.END) return null;
    if (t < F.HAMMER) {
      const k = (t - F.TOAD) / (F.HAMMER - F.TOAD);
      return { frame: walk, x: Math.round(lerp(-18, stand, k)), y, flip: false };
    }
    if (t < F.BUILD) {
      const down = (t - F.HAMMER) % HAMMER_BEAT >= HAMMER_BEAT / 2;
      return { frame: `toad-map-hammer-${down ? 1 : 0}`, x: stand, y, flip: false };
    }
    if (t < F.LEAVE)
      return { frame: `toad-map-${(t >> 4) & 1}`, x: stand, y: y - ((t >> 3) & 1), flip: false };
    const k = (t - F.LEAVE) / (F.END - F.LEAVE);
    // He leaves forward, on to the right and off screen (0.4.35, owner: never back the way he came).
    return { frame: walk, x: Math.round(lerp(stand, TOAD_EXIT_X, k)), y, flip: false };
  }

  /**
   * A full-screen crash flash for its first frames, or null; never with reduce flashing (it
   * blinks), when the crash is only the wreck, the smoke and the sound.
   */
  flash(reduceFlashing: boolean): string | null {
    if (reduceFlashing) return null;
    const d = this.t - CRASH_FRAMES.CRASH;
    return d >= 0 && d < 8 && (d & 2) === 0 ? 'rgba(255,255,255,0.5)' : null;
  }

  /** Draws the ship or the wreck, smoke, planks, dust and Toad (the hero is the map's to draw). */
  draw(r: Renderer, assets: AssetRegistry, reduceFlashing: boolean): void {
    const sheet = assets.sheet(SHEET);
    const t = this.t;
    const F = CRASH_FRAMES;
    if (t >= F.CRASH && !this.built) r.sprite(sheet, 'map-wreck', this.wreck.x, this.wreck.y);
    for (const p of this.planks) r.rect(Math.round(p.x), Math.round(p.y), 5, 2, '#8a4a1c');
    const ship = this.ship();
    if (ship) r.sprite(sheet, ship.frame, ship.x, ship.y);
    for (const p of this.puffs)
      r.sprite(sheet, `map-smoke-${Math.min(2, (p.t / 10) | 0)}`, Math.round(p.x), Math.round(p.y));
    // Dust where the hero landed, and where the ship hit.
    const land = t - F.LAND;
    if (land >= 0 && land < 16)
      r.sprite(sheet, `map-dust-${land >> 3}`, this.hero.x * 16, this.heroFeet - 16);
    const hit = t - F.CRASH;
    if (hit >= 0 && hit < 16) {
      r.sprite(sheet, `map-dust-${hit >> 3}`, this.wreck.x - 8, this.bonusFeet - 16);
      r.sprite(sheet, `map-dust-${hit >> 3}`, this.wreck.x + 24, this.bonusFeet - 16, true);
    }
    const toad = this.toad();
    if (toad) r.sprite(sheet, toad.frame, toad.x, toad.y, toad.flip);
    const f = this.flash(reduceFlashing);
    if (f) r.rect(0, 0, 256, 240, f);
  }
}
